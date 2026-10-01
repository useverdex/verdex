// Asset Yield: what sits idle in a wallet on Robinhood Chain, put to work through public contracts
// only. A stock goes into a one-sided Uniswap v3 band just above its price: it earns the pool fee on
// every trade that reaches the band and is sold only if the price climbs through it. Cash (USDG) goes
// into Spark Savings USDG, an ERC-4626 vault that accrues the Spark rate every second. Every call is
// built here and signed in the wallet; Verdex holds nothing and adds no contract.
import { useQuery } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi, formatUnits, parseAbi, type Address } from 'viem'
import type { Asset } from './api'
import { MULTICALL3, USDG, addLiquidity, alignDown, alignUp, approveIfNeeded, client, ensureChain, fullRange, rawToTick, sendTx, stockPriceToRaw, stockTokens, tickBand, type Pool, type Position, type StockToken, type TxCtx } from './pools'

// ---- Cash: Spark Savings USDG ----
export const SPARK_USDG = { address: '0xde770c84FE66E063336b31737cFE9790f18c4087' as Address, symbol: 'spUSDG', decimals: 6, name: 'Spark Savings USDG' }
export const SPARK_URL = 'https://app.spark.fi/savings'
const vaultAbi = parseAbi([
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)',
  'function balanceOf(address) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function depositCap() view returns (uint256)',
  'function vsr() view returns (uint256)',
])
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

export type Savings = {
  apy: number // percent, compounded from the per-second rate the vault reports
  totalUsd: number
  capUsd: number
  shares: bigint
  balance: number // USDG the shares are worth now
  wallet: bigint // USDG in the wallet, raw
  walletUsdg: number
}

// The vault's per-second rate (ray) compounded over a year, as a percentage.
export const apyFromRate = (ray: bigint) => (Math.exp(SECONDS_PER_YEAR * Math.log(Number(ray) / 1e27)) - 1) * 100

export async function readSavings(owner?: Address): Promise<Savings> {
  const c = client()
  const zero = '0x0000000000000000000000000000000000000000' as Address
  const who = owner ?? zero
  const r = await c.multicall({
    multicallAddress: MULTICALL3,
    contracts: [
      { address: SPARK_USDG.address, abi: vaultAbi, functionName: 'vsr' },
      { address: SPARK_USDG.address, abi: vaultAbi, functionName: 'totalAssets' },
      { address: SPARK_USDG.address, abi: vaultAbi, functionName: 'depositCap' },
      { address: SPARK_USDG.address, abi: vaultAbi, functionName: 'balanceOf', args: [who] },
      { address: USDG.address, abi: erc20Abi, functionName: 'balanceOf', args: [who] },
    ],
  })
  const get = <T,>(i: number, fallback: T): T => (r[i].status === 'success' ? (r[i].result as T) : fallback)
  const shares = owner ? get<bigint>(3, 0n) : 0n
  const assets = shares > 0n ? await c.readContract({ address: SPARK_USDG.address, abi: vaultAbi, functionName: 'convertToAssets', args: [shares] }) : 0n
  const wallet = owner ? get<bigint>(4, 0n) : 0n
  return {
    apy: apyFromRate(get<bigint>(0, 10n ** 27n)),
    totalUsd: Number(formatUnits(get<bigint>(1, 0n), 6)),
    capUsd: Number(formatUnits(get<bigint>(2, 0n), 6)),
    shares,
    balance: Number(formatUnits(assets, 6)),
    wallet,
    walletUsdg: Number(formatUnits(wallet, 6)),
  }
}
export function useSavings(owner?: Address) {
  return useQuery({ queryKey: ['savings', owner?.toLowerCase()], queryFn: () => readSavings(owner), staleTime: 30_000, refetchInterval: 60_000, retry: 2 })
}

// Approve USDG once for the vault, then one deposit; the shares land in the wallet.
export async function depositSavings(ctx: TxCtx, amount: bigint) {
  await ensureChain(ctx)
  await approveIfNeeded(ctx, USDG.address, amount, SPARK_USDG.address)
  return sendTx(ctx, SPARK_USDG.address, encodeFunctionData({ abi: vaultAbi, functionName: 'deposit', args: [amount, ctx.account.address] }))
}
// Redeems a share of the vault balance back to USDG in the same wallet.
export async function withdrawSavings(ctx: TxCtx, shares: bigint, pct: number) {
  await ensureChain(ctx)
  const part = pct >= 100 ? shares : (shares * BigInt(Math.round(Math.min(100, Math.max(0, pct)) * 100))) / 10_000n
  if (part <= 0n) throw new Error('Nothing to withdraw')
  return sendTx(ctx, SPARK_USDG.address, encodeFunctionData({ abi: vaultAbi, functionName: 'redeem', args: [part, ctx.account.address, ctx.account.address] }))
}

// ---- Stocks: a one-sided band above the price ----
export const BANDS: { label: string; pct: number }[] = [
  { label: '+2%', pct: 0.02 },
  { label: '+5%', pct: 0.05 },
  { label: '+10%', pct: 0.1 },
]

// Ticks for a band that starts just above the current price and ends at price × (1 + pct). The
// position holds only the stock while the price is below the band, so nothing else is deposited.
export function sellBand(pool: Pool, pct: number): [number, number] {
  const top = rawToTick(stockPriceToRaw(pool, pool.price * (1 + pct)))
  const [minT, maxT] = fullRange(pool.spacing)
  if (pool.stockIsToken0) {
    const lower = alignUp(pool.tick + 1, pool.spacing)
    const upper = Math.max(lower + pool.spacing, alignUp(top, pool.spacing))
    return [lower, Math.min(upper, maxT)]
  }
  const upper = alignDown(pool.tick, pool.spacing)
  const lower = Math.min(upper - pool.spacing, alignDown(top, pool.spacing))
  return [Math.max(lower, minT), upper]
}
// The average price the stock is sold at if the price climbs through the whole band: the geometric
// mean of its two edges, which is what a one-sided Uniswap v3 position realises.
export function bandAverage(pool: Pool, lower: number, upper: number) {
  const [lo, hi] = tickBand(pool, lower, upper)
  return Math.sqrt(lo * hi)
}

// The best pool to put a stock to work in: USDG quote first, enough liquidity to be a real market,
// then the highest fee APR.
export function bestPool(pools: Pool[], stock: Address): Pool | null {
  const mine = pools.filter((p) => (p.stockIsToken0 ? p.token0 : p.token1).address.toLowerCase() === stock.toLowerCase())
  const pick = (list: Pool[]) => list.filter((p) => p.liquidityUsd >= 1_000).sort((a, b) => b.feeApr - a.feeApr)[0] ?? list.sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0] ?? null
  return pick(mine.filter((p) => p.quote.symbol === 'USDG')) ?? pick(mine)
}

export type Idle = { stock: StockToken; balance: bigint; qty: number; pool: Pool | null; priceUsd: number; valueUsd: number }

// Every stock token the wallet holds on Robinhood Chain, with the pool it would work in.
export async function readIdle(owner: Address, assets: Asset[], pools: Pool[]): Promise<Idle[]> {
  const stocks = stockTokens(assets)
  if (!stocks.length) return []
  const c = client()
  const bal = await c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts: stocks.map((s) => ({ address: s.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [owner] as const })) })
  const priceOf = new Map<string, number>()
  for (const a of assets) for (const tk of a.tokens) priceOf.set(tk.address.toLowerCase(), tk.price || a.price)
  const out: Idle[] = []
  stocks.forEach((s, i) => {
    const r = bal[i]
    if (r.status !== 'success' || (r.result as bigint) === 0n) return
    const balance = r.result as bigint
    const qty = Number(formatUnits(balance, s.decimals))
    const pool = bestPool(pools, s.address)
    const priceUsd = pool?.priceUsd || priceOf.get(s.address.toLowerCase()) || 0
    out.push({ stock: s, balance, qty, pool, priceUsd, valueUsd: qty * priceUsd })
  })
  return out.sort((a, b) => b.valueUsd - a.valueUsd)
}
export function useIdle(owner: Address | undefined, assets: Asset[] | undefined, pools: Pool[] | undefined) {
  return useQuery({ queryKey: ['idle', owner?.toLowerCase(), pools?.length ?? 0], queryFn: () => readIdle(owner!, assets!, pools!), enabled: !!owner && !!assets && !!pools, staleTime: 30_000, retry: 1 })
}

// Puts an amount of the stock into the band. Only the stock side is sent; the engine's minimums
// and deadline apply as for any position.
export function putToWork(ctx: TxCtx, pool: Pool, lower: number, upper: number, amount: bigint) {
  return addLiquidity(ctx, pool, lower, upper, pool.stockIsToken0 ? amount : 0n, pool.stockIsToken0 ? 0n : amount)
}

// What a position is doing right now, in the words of this page.
export type WorkState = 'earning' | 'waiting' | 'sold'
export function workState(p: Position): WorkState {
  if (p.inRange) return 'earning'
  const stock = p.pool.stockIsToken0 ? p.amount0 : p.amount1
  const quote = p.pool.stockIsToken0 ? p.amount1 : p.amount0
  return stock > 0 && quote === 0 ? 'waiting' : 'sold'
}
export const WORK_LABEL: Record<WorkState, string> = { earning: 'Earning', waiting: 'Waiting above the price', sold: 'Sold, holding the quote' }
