// Verdex Pools: liquidity for tokenized stocks on Robinhood Chain, through the Uniswap v3 contracts
// already deployed there. The pool list is discovered from the factory for every stock token the
// site knows, market figures come from DexScreener, the price and tick from the pool itself, and
// positions from the position manager. Every transaction is built here and signed in the wallet.
import { useQuery } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi, formatUnits, maxUint256, parseAbi, type Address, type WalletClient } from 'viem'
import { ROBINHOOD, type Asset } from './api'
import { chainMeta, publicClientFor, waitForTx, type ChainX } from './lifi'
import { readEthUsd } from './token'

export const FACTORY = '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA' as Address
export const POSITION_MANAGER = '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3' as Address
export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address
export const USDG = { address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as Address, symbol: 'USDG', decimals: 6 }
export const WETH = { address: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as Address, symbol: 'WETH', decimals: 18 }
export const QUOTES = [USDG, WETH]
export const FEE_TIERS = [100, 500, 3000, 10000] as const
export const TICK_SPACING: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 }
export const MIN_TICK = -887272
export const MAX_TICK = 887272
export const RPC = 'https://rpc.mainnet.chain.robinhood.com/'
const DEXSCREENER = 'https://api.dexscreener.com/latest/dex/pairs/robinhood/'

const factoryAbi = parseAbi(['function getPool(address,address,uint24) view returns (address)'])
const poolAbi = parseAbi(['function liquidity() view returns (uint128)', 'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool)'])
export const positionManagerAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
  'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
  'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) payable returns (uint256 amount0,uint256 amount1)',
  'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns (uint256 amount0,uint256 amount1)',
  'function burn(uint256 tokenId) payable',
  'function unwrapWETH9(uint256 amountMinimum,address recipient) payable',
  'function sweepToken(address token,uint256 amountMinimum,address recipient) payable',
  'function refundETH() payable',
  'function multicall(bytes[] data) payable returns (bytes[] results)',
])

export type PoolToken = { address: Address; symbol: string; decimals: number }
export type Pool = {
  address: Address
  fee: number
  spacing: number
  token0: PoolToken
  token1: PoolToken
  stockIsToken0: boolean
  ticker: string
  name: string
  logo?: string
  quote: PoolToken
  sqrtPriceX96: bigint
  tick: number
  liquidity: bigint
  price: number // stock in quote
  priceUsd: number // stock in USD
  quoteUsd: number
  liquidityUsd: number
  volume24hUsd: number
  feeApr: number
  txns24h: number
}
export type StockToken = { address: Address; symbol: string; decimals: number; ticker: string; name: string; logo?: string }

export const client = () => publicClientFor({ id: ROBINHOOD, key: 'robinhood', name: 'Robinhood Chain', chainType: 'EVM', logoURI: '', mainnet: true, metamask: { rpcUrls: [RPC] } })
const lc = (a: string) => a.toLowerCase()
const sortTokens = (a: PoolToken, b: PoolToken): [PoolToken, PoolToken] => (lc(a.address) < lc(b.address) ? [a, b] : [b, a])

// The stock tokens on Robinhood Chain, from the assets the site already lists.
export function stockTokens(assets: Asset[]): StockToken[] {
  const out: StockToken[] = []
  const seen = new Set<string>()
  for (const a of assets)
    for (const tk of a.tokens) {
      if (tk.chainId !== ROBINHOOD || seen.has(lc(tk.address))) continue
      seen.add(lc(tk.address))
      out.push({ address: tk.address as Address, symbol: tk.symbol, decimals: tk.decimals, ticker: a.ticker, name: a.name, logo: a.logo })
    }
  return out
}

// Every pool the factory has for a stock against USDG or WETH at any fee tier, with liquidity.
export async function discoverPools(stocks: StockToken[]): Promise<Pool[]> {
  const c = client()
  const combos = stocks.flatMap((s) => QUOTES.flatMap((q) => FEE_TIERS.map((fee) => ({ s, q, fee }))))
  const found = await c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts: combos.map(({ s, q, fee }) => ({ address: FACTORY, abi: factoryAbi, functionName: 'getPool' as const, args: [s.address, q.address, fee] as const })) })
  const cands = combos.map((x, i) => ({ ...x, address: found[i].status === 'success' ? (found[i].result as Address) : undefined })).filter((x): x is typeof x & { address: Address } => !!x.address && x.address !== '0x0000000000000000000000000000000000000000')
  if (!cands.length) return []
  const state = await c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts: cands.flatMap((p) => [{ address: p.address, abi: poolAbi, functionName: 'liquidity' as const }, { address: p.address, abi: poolAbi, functionName: 'slot0' as const }]) })
  const [ethUsd, market] = await Promise.all([readEthUsd().catch(() => 0), readMarket(cands.map((p) => p.address))])
  const pools: Pool[] = []
  cands.forEach((p, i) => {
    const liq = state[i * 2], s0 = state[i * 2 + 1]
    if (liq.status !== 'success' || s0.status !== 'success') return
    const liquidity = liq.result as bigint
    const [sqrtPriceX96, tick] = s0.result as unknown as [bigint, number]
    if (liquidity === 0n) return
    const stock: PoolToken = { address: p.s.address, symbol: p.s.symbol, decimals: p.s.decimals }
    const [token0, token1] = sortTokens(stock, p.q)
    const stockIsToken0 = lc(token0.address) === lc(stock.address)
    const price = stockPrice(sqrtPriceX96, token0, token1, stockIsToken0)
    const quoteUsd = lc(p.q.address) === lc(WETH.address) ? ethUsd : 1
    const m = market.get(lc(p.address))
    const priceUsd = m?.priceUsd || price * quoteUsd
    const liquidityUsd = m?.liquidityUsd ?? 0
    const volume24hUsd = m?.volume24hUsd ?? 0
    pools.push({ address: p.address, fee: p.fee, spacing: TICK_SPACING[p.fee], token0, token1, stockIsToken0, ticker: p.s.ticker, name: p.s.name, logo: p.s.logo, quote: p.q, sqrtPriceX96, tick, liquidity, price, priceUsd, quoteUsd, liquidityUsd, volume24hUsd, feeApr: liquidityUsd > 0 ? ((volume24hUsd * (p.fee / 1_000_000) * 365) / liquidityUsd) * 100 : 0, txns24h: m?.txns24h ?? 0 })
  })
  return pools.sort((a, b) => b.liquidityUsd - a.liquidityUsd)
}

type MarketRow = { priceUsd: number; liquidityUsd: number; volume24hUsd: number; txns24h: number }
async function readMarket(addresses: Address[]): Promise<Map<string, MarketRow>> {
  const out = new Map<string, MarketRow>()
  for (let i = 0; i < addresses.length; i += 30) {
    try {
      const r = await fetch(DEXSCREENER + addresses.slice(i, i + 30).join(','))
      if (!r.ok) continue
      const j = (await r.json()) as { pairs?: { pairAddress: string; priceUsd?: string; liquidity?: { usd?: number }; volume?: { h24?: number }; txns?: { h24?: { buys: number; sells: number } } }[] }
      for (const p of j.pairs ?? []) out.set(lc(p.pairAddress), { priceUsd: Number(p.priceUsd ?? 0), liquidityUsd: p.liquidity?.usd ?? 0, volume24hUsd: p.volume?.h24 ?? 0, txns24h: (p.txns?.h24?.buys ?? 0) + (p.txns?.h24?.sells ?? 0) })
    } catch {
      /* the pool still lists with onchain figures only */
    }
  }
  return out
}

export function usePools(assets: Asset[] | undefined) {
  const stocks = assets ? stockTokens(assets) : []
  return useQuery({ queryKey: ['verdex-pools', stocks.length], queryFn: () => discoverPools(stocks), enabled: stocks.length > 0, staleTime: 60_000, refetchInterval: 60_000, retry: 2 })
}

// Price maths. Prices inside are "raw": token1 base units per token0 base unit.
const Q96 = 2 ** 96
export const rawPrice = (sqrtPriceX96: bigint) => (Number(sqrtPriceX96) / Q96) ** 2
export const tickToRaw = (tick: number) => 1.0001 ** tick
export const rawToTick = (raw: number) => Math.floor(Math.log(raw) / Math.log(1.0001))
export function stockPrice(sqrtPriceX96: bigint, token0: PoolToken, token1: PoolToken, stockIsToken0: boolean) {
  const human = rawPrice(sqrtPriceX96) * 10 ** (token0.decimals - token1.decimals) // token1 per token0
  return stockIsToken0 ? human : 1 / human
}
// A stock price in the quote, as a raw token1/token0 price.
export function stockPriceToRaw(pool: Pool, price: number) {
  const human = pool.stockIsToken0 ? price : 1 / price
  return human / 10 ** (pool.token0.decimals - pool.token1.decimals)
}
export function rawToStockPrice(pool: Pool, raw: number) {
  const human = raw * 10 ** (pool.token0.decimals - pool.token1.decimals)
  return pool.stockIsToken0 ? human : 1 / human
}
export const alignDown = (tick: number, spacing: number) => Math.floor(tick / spacing) * spacing
export const alignUp = (tick: number, spacing: number) => Math.ceil(tick / spacing) * spacing
export function fullRange(spacing: number): [number, number] {
  return [alignUp(MIN_TICK, spacing), alignDown(MAX_TICK, spacing)]
}
// Ticks for a stock price band [lo, hi] in the quote, aligned outward so the band contains both prices.
export function rangeTicks(pool: Pool, lo: number, hi: number): [number, number] {
  const a = rawToTick(stockPriceToRaw(pool, lo)), b = rawToTick(stockPriceToRaw(pool, hi))
  const lower = alignDown(Math.min(a, b), pool.spacing), upper = alignUp(Math.max(a, b) + 1, pool.spacing)
  return [Math.max(lower, fullRange(pool.spacing)[0]), Math.min(Math.max(upper, lower + pool.spacing), fullRange(pool.spacing)[1])]
}
export function tickBand(pool: Pool, lower: number, upper: number): [number, number] {
  const p = [rawToStockPrice(pool, tickToRaw(lower)), rawToStockPrice(pool, tickToRaw(upper))]
  return [Math.min(p[0], p[1]), Math.max(p[0], p[1])]
}

// Liquidity for given raw amounts, and the raw amounts a liquidity holds, at the pool's current price.
type Amounts = { amount0: number; amount1: number }
export function liquidityFor(sqrtP: number, lower: number, upper: number, amount0: number, amount1: number) {
  const sa = Math.sqrt(tickToRaw(lower)), sb = Math.sqrt(tickToRaw(upper))
  if (sqrtP <= sa) return amount0 * ((sa * sb) / (sb - sa))
  if (sqrtP >= sb) return amount1 / (sb - sa)
  const l0 = amount0 * ((sqrtP * sb) / (sb - sqrtP)), l1 = amount1 / (sqrtP - sa)
  return Math.min(l0, l1)
}
export function amountsFor(sqrtP: number, lower: number, upper: number, L: number): Amounts {
  const sa = Math.sqrt(tickToRaw(lower)), sb = Math.sqrt(tickToRaw(upper))
  if (sqrtP <= sa) return { amount0: L * ((sb - sa) / (sa * sb)), amount1: 0 }
  if (sqrtP >= sb) return { amount0: 0, amount1: L * (sb - sa) }
  return { amount0: L * ((sb - sqrtP) / (sqrtP * sb)), amount1: L * (sqrtP - sa) }
}
export const sqrtRaw = (sqrtPriceX96: bigint) => Number(sqrtPriceX96) / Q96
// Given one side in raw units, the other side for the same liquidity in this range.
export function pairAmount(pool: Pool, lower: number, upper: number, side: 0 | 1, amount: number): Amounts {
  const sp = sqrtRaw(pool.sqrtPriceX96)
  const L = side === 0 ? liquidityFor(sp, lower, upper, amount, Number.MAX_VALUE) : liquidityFor(sp, lower, upper, Number.MAX_VALUE, amount)
  const a = amountsFor(sp, lower, upper, L)
  return side === 0 ? { amount0: amount, amount1: a.amount1 } : { amount0: a.amount0, amount1: amount }
}
export const toRaw = (human: number, decimals: number) => BigInt(Math.floor(human * 10 ** decimals))
export const fromRaw = (raw: bigint | number, decimals: number) => Number(raw) / 10 ** decimals

// Positions.
export type Position = {
  tokenId: bigint
  pool: Pool
  lower: number
  upper: number
  liquidity: bigint
  amount0: number
  amount1: number
  fees0: number
  fees1: number
  inRange: boolean
  valueUsd: number
  feesUsd: number
  band: [number, number]
}
export async function readPositions(owner: Address, pools: Pool[]): Promise<Position[]> {
  const c = client()
  const n = await c.readContract({ address: POSITION_MANAGER, abi: positionManagerAbi, functionName: 'balanceOf', args: [owner] })
  if (n === 0n) return []
  const ids = await c.multicall({ multicallAddress: MULTICALL3, contracts: Array.from({ length: Number(n) }, (_, i) => ({ address: POSITION_MANAGER, abi: positionManagerAbi, functionName: 'tokenOfOwnerByIndex' as const, args: [owner, BigInt(i)] as const })) })
  const tokenIds = ids.filter((r) => r.status === 'success').map((r) => r.result as bigint)
  const raw = await c.multicall({ multicallAddress: MULTICALL3, contracts: tokenIds.map((id) => ({ address: POSITION_MANAGER, abi: positionManagerAbi, functionName: 'positions' as const, args: [id] as const })) })
  const byKey = new Map(pools.map((p) => [`${lc(p.token0.address)}-${lc(p.token1.address)}-${p.fee}`, p]))
  const out: Position[] = []
  for (let i = 0; i < tokenIds.length; i++) {
    const r = raw[i]
    if (r.status !== 'success') continue
    const [, , token0, token1, fee, lower, upper, liquidity, , , owed0, owed1] = r.result as unknown as [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint]
    const pool = byKey.get(`${lc(token0)}-${lc(token1)}-${fee}`)
    if (!pool || (liquidity === 0n && owed0 === 0n && owed1 === 0n)) continue
    const a = amountsFor(sqrtRaw(pool.sqrtPriceX96), lower, upper, Number(liquidity))
    // Uncollected fees: what a collect would pay right now, simulated as the owner.
    let f0 = owed0, f1 = owed1
    try {
      const sim = await c.simulateContract({ address: POSITION_MANAGER, abi: positionManagerAbi, functionName: 'collect', args: [{ tokenId: tokenIds[i], recipient: owner, amount0Max: 2n ** 128n - 1n, amount1Max: 2n ** 128n - 1n }], account: owner })
      ;[f0, f1] = sim.result as unknown as [bigint, bigint]
    } catch {
      /* keep the stored owed amounts */
    }
    const amount0 = fromRaw(a.amount0, pool.token0.decimals), amount1 = fromRaw(a.amount1, pool.token1.decimals)
    const fees0 = fromRaw(f0, pool.token0.decimals), fees1 = fromRaw(f1, pool.token1.decimals)
    const usd0 = pool.stockIsToken0 ? pool.priceUsd : pool.quoteUsd, usd1 = pool.stockIsToken0 ? pool.quoteUsd : pool.priceUsd
    out.push({ tokenId: tokenIds[i], pool, lower, upper, liquidity, amount0, amount1, fees0, fees1, inRange: pool.tick >= lower && pool.tick < upper, valueUsd: amount0 * usd0 + amount1 * usd1, feesUsd: fees0 * usd0 + fees1 * usd1, band: tickBand(pool, lower, upper) })
  }
  return out.sort((a, b) => b.valueUsd - a.valueUsd)
}
export function usePositions(owner: Address | undefined, pools: Pool[] | undefined) {
  return useQuery({ queryKey: ['verdex-positions', owner?.toLowerCase(), pools?.length ?? 0], queryFn: () => readPositions(owner!, pools!), enabled: !!owner && !!pools?.length, staleTime: 30_000, retry: 1 })
}

// Transactions. Each one switches to Robinhood Chain if needed, approves once per token when the
// allowance is short, then sends one transaction and waits for it.
export type Phase = 'idle' | 'switching' | 'approving' | 'confirming' | 'pending' | 'done' | 'failed'
export const PHASE_LABEL: Record<Phase, string> = { idle: '', switching: 'Switch to Robinhood Chain in your wallet…', approving: 'Approve once in your wallet…', confirming: 'Confirm in your wallet…', pending: 'Waiting for the network…', done: 'Done', failed: 'Failed' }
export type TxCtx = { walletClient: WalletClient; account: { address: Address; chainId: number }; chain: ChainX | undefined; switchChain: (chainId: number, meta?: ReturnType<typeof chainMeta>) => Promise<void>; onPhase: (p: Phase) => void }
const SLIPPAGE = 0.005
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
const isWeth = (t: PoolToken) => lc(t.address) === lc(WETH.address)
const chainX = (ctx: TxCtx): ChainX => ctx.chain ?? ({ id: ROBINHOOD, key: 'robinhood', name: 'Robinhood Chain', chainType: 'EVM', logoURI: '', mainnet: true, metamask: { rpcUrls: [RPC] } } as ChainX)

export async function ensureChain(ctx: TxCtx) {
  if (ctx.account.chainId !== ROBINHOOD) {
    ctx.onPhase('switching')
    await ctx.switchChain(ROBINHOOD, chainMeta(chainX(ctx)))
  }
}
export async function approveIfNeeded(ctx: TxCtx, token: Address, amount: bigint, spender: Address = POSITION_MANAGER) {
  const c = client()
  const allowance = await c.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [ctx.account.address, spender] })
  if (allowance >= amount) return
  ctx.onPhase('approving')
  const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, maxUint256] }) })
  await waitForTx(chainX(ctx), hash)
}
export async function sendTx(ctx: TxCtx, to: Address, data: `0x${string}`, value?: bigint) {
  ctx.onPhase('confirming')
  const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, to, data, value })
  ctx.onPhase('pending')
  await waitForTx(chainX(ctx), hash)
  ctx.onPhase('done')
  return hash
}
const send = (ctx: TxCtx, data: `0x${string}`, value?: bigint) => sendTx(ctx, POSITION_MANAGER, data, value)

// Adds a new position. The WETH side is paid in ETH from the wallet and any unused ETH is refunded
// in the same transaction.
export async function addLiquidity(ctx: TxCtx, pool: Pool, lower: number, upper: number, amount0: bigint, amount1: bigint) {
  await ensureChain(ctx)
  const sp = sqrtRaw(pool.sqrtPriceX96)
  const L = liquidityFor(sp, lower, upper, Number(amount0), Number(amount1))
  const exp = amountsFor(sp, lower, upper, L)
  const min0 = BigInt(Math.floor(exp.amount0 * (1 - SLIPPAGE))), min1 = BigInt(Math.floor(exp.amount1 * (1 - SLIPPAGE)))
  const native0 = isWeth(pool.token0), native1 = isWeth(pool.token1)
  if (!native0 && amount0 > 0n) await approveIfNeeded(ctx, pool.token0.address, amount0)
  if (!native1 && amount1 > 0n) await approveIfNeeded(ctx, pool.token1.address, amount1)
  const mint = encodeFunctionData({ abi: positionManagerAbi, functionName: 'mint', args: [{ token0: pool.token0.address, token1: pool.token1.address, fee: pool.fee, tickLower: lower, tickUpper: upper, amount0Desired: amount0, amount1Desired: amount1, amount0Min: min0, amount1Min: min1, recipient: ctx.account.address, deadline: deadline() }] })
  const value = native0 ? amount0 : native1 ? amount1 : 0n
  const data = value > 0n ? encodeFunctionData({ abi: positionManagerAbi, functionName: 'multicall', args: [[mint, encodeFunctionData({ abi: positionManagerAbi, functionName: 'refundETH' })]] }) : mint
  return send(ctx, data, value > 0n ? value : undefined)
}

// Removes part or all of a position and collects everything owed, WETH unwrapped to ETH. Removing
// all of it also burns the empty position.
export async function removeLiquidity(ctx: TxCtx, p: Position, pct: number) {
  await ensureChain(ctx)
  const share = Math.min(100, Math.max(0, pct))
  const liquidity = share >= 100 ? p.liquidity : (p.liquidity * BigInt(Math.round(share * 100))) / 10_000n
  const exp = amountsFor(sqrtRaw(p.pool.sqrtPriceX96), p.lower, p.upper, Number(liquidity))
  const calls: `0x${string}`[] = []
  if (liquidity > 0n) calls.push(encodeFunctionData({ abi: positionManagerAbi, functionName: 'decreaseLiquidity', args: [{ tokenId: p.tokenId, liquidity, amount0Min: BigInt(Math.floor(exp.amount0 * (1 - SLIPPAGE))), amount1Min: BigInt(Math.floor(exp.amount1 * (1 - SLIPPAGE))), deadline: deadline() }] }))
  calls.push(...collectCalls(ctx, p))
  if (share >= 100) calls.push(encodeFunctionData({ abi: positionManagerAbi, functionName: 'burn', args: [p.tokenId] }))
  return send(ctx, encodeFunctionData({ abi: positionManagerAbi, functionName: 'multicall', args: [calls] }))
}
export async function collectFees(ctx: TxCtx, p: Position) {
  await ensureChain(ctx)
  return send(ctx, encodeFunctionData({ abi: positionManagerAbi, functionName: 'multicall', args: [collectCalls(ctx, p)] }))
}
function collectCalls(ctx: TxCtx, p: Position): `0x${string}`[] {
  const max = 2n ** 128n - 1n
  const weth = isWeth(p.pool.token0) || isWeth(p.pool.token1)
  if (!weth) return [encodeFunctionData({ abi: positionManagerAbi, functionName: 'collect', args: [{ tokenId: p.tokenId, recipient: ctx.account.address, amount0Max: max, amount1Max: max }] })]
  const stock = isWeth(p.pool.token0) ? p.pool.token1 : p.pool.token0
  return [
    encodeFunctionData({ abi: positionManagerAbi, functionName: 'collect', args: [{ tokenId: p.tokenId, recipient: '0x0000000000000000000000000000000000000000', amount0Max: max, amount1Max: max }] }),
    encodeFunctionData({ abi: positionManagerAbi, functionName: 'unwrapWETH9', args: [0n, ctx.account.address] }),
    encodeFunctionData({ abi: positionManagerAbi, functionName: 'sweepToken', args: [stock.address, 0n, ctx.account.address] }),
  ]
}

export async function readBalances(owner: Address, pool: Pool): Promise<[bigint, bigint]> {
  const c = client()
  const one = (t: PoolToken) => (isWeth(t) ? c.getBalance({ address: owner }) : c.readContract({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }))
  return Promise.all([one(pool.token0), one(pool.token1)])
}
export const fmtFee = (fee: number) => `${(fee / 10_000).toString()}%`
export const fmtPrice = (n: number) => (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n >= 1 ? n.toFixed(2) : n >= 0.01 ? n.toFixed(4) : n.toExponential(2))
export const fmtQty = (n: number, d = 4) => (n === 0 ? '0' : n < 0.000001 ? '<0.000001' : n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n >= 1 ? n.toFixed(Math.min(d, 4)) : n.toFixed(6))
export { formatUnits }
