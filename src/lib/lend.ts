// Verdex Lend: isolated money markets for tokenized stocks on Robinhood Chain. One contract, one market per
// stock against USDG. Everything here is read from the chain in the browser; writes go through the wallet.
import { useQuery } from '@tanstack/react-query'
import { encodeDeployData, erc20Abi, formatUnits, isAddress, parseAbi, type Address, type ContractFunctionParameters } from 'viem'
import artifact from '../../contracts/VerdexLend.json'
import { LEND_ADDRESS as BUILT_IN } from '../../scripts/lend-address.mjs'
import { TREASURY_ADDRESS } from '../../scripts/treasury-address.mjs'
import { deepEnough, poolFor } from './autopilot'
import { MULTICALL3, USDG, client, ensureChain, stockTokens, type Pool, type StockToken, type TxCtx } from './pools'
import type { Asset } from './api'

export const LEND_ADDRESS = (String(import.meta.env.VITE_LEND_ADDRESS ?? '').trim() || BUILT_IN).trim()
export const DEPLOYED = isAddress(LEND_ADDRESS)
export const LEND = (DEPLOYED ? LEND_ADDRESS : '0x0000000000000000000000000000000000000000') as Address
export const BYTECODE = artifact.bytecode as `0x${string}`
export const TREASURY = TREASURY_ADDRESS as Address
export const MAX = 2n ** 256n - 1n

export const abi = parseAbi([
  'constructor(address usdg_,address treasury_)',
  'function marketCount() view returns (uint256)',
  'function market(uint256 id) view returns ((address collateral,address pool,bool collateralIsToken0,bool enabled,uint16 ltvBps,uint16 liqThresholdBps,uint16 liqBonusBps,uint32 twapWindow,uint64 rateBaseBps,uint64 rateSlopeBps,uint64 lastAccrual,uint256 supplyCap,uint256 borrowCap,uint256 collateralCap,uint256 totalSupplyAssets,uint256 totalSupplyShares,uint256 totalBorrowAssets,uint256 totalBorrowShares,uint256 totalCollateral,uint256 reserves))',
  'function collateralValue(uint256 id,uint256 amount,bool forBorrow) view returns (uint256)',
  'function debtOf(uint256 id,address who) view returns (uint256)',
  'function suppliedOf(uint256 id,address who) view returns (uint256)',
  'function rates(uint256 id) view returns (uint256 borrowAprBps,uint256 supplyAprBps,uint256 utilisationBps)',
  'function borrowable(uint256 id,address who) view returns (uint256)',
  'function health(uint256 id,address who) view returns (uint256)',
  'function supplyShares(uint256,address) view returns (uint256)',
  'function borrowShares(uint256,address) view returns (uint256)',
  'function collateralOf(uint256,address) view returns (uint256)',
  'function owner() view returns (address)',
  'function treasury() view returns (address)',
  'function reserveBps() view returns (uint16)',
  'function supply(uint256 id,uint256 assets,address to) returns (uint256)',
  'function withdraw(uint256 id,uint256 shares,address to) returns (uint256)',
  'function addCollateral(uint256 id,uint256 amount,address to)',
  'function removeCollateral(uint256 id,uint256 amount,address to)',
  'function borrow(uint256 id,uint256 assets,address to) returns (uint256)',
  'function repay(uint256 id,uint256 assets,address onBehalf) returns (uint256,uint256)',
  'function liquidate(uint256 id,address borrower,uint256 assets) returns (uint256,uint256)',
  'function skim(uint256 id) returns (uint256)',
  'function createMarket(address collateral,address pool,uint16 ltvBps,uint16 liqThresholdBps,uint16 liqBonusBps,uint32 twapWindow,uint64 rateBaseBps,uint64 rateSlopeBps,uint256 supplyCap,uint256 borrowCap,uint256 collateralCap) returns (uint256)',
  'function setCaps(uint256 id,uint256 supplyCap,uint256 borrowCap,uint256 collateralCap)',
  'event MarketCreated(uint256 indexed id,address indexed collateral,address indexed pool)',
])

// Launch parameters: conservative, capped, raised as the market proves itself.
export const LAUNCH = { ltvBps: 5000, liqThresholdBps: 6500, liqBonusBps: 500, twapWindow: 1800, rateBaseBps: 200n, rateSlopeBps: 2000n, supplyCap: 25_000n * 10n ** 6n, borrowCap: 20_000n * 10n ** 6n, collateralUsd: 50_000 }
export const LAUNCH_TICKERS = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META']

export type Market = {
  id: bigint
  stock?: StockToken
  pool?: Pool
  collateral: Address
  poolAddress: Address
  enabled: boolean
  ltvBps: number
  liqThresholdBps: number
  liqBonusBps: number
  twapWindow: number
  supplyCap: bigint
  borrowCap: bigint
  collateralCap: bigint
  totalSupplyAssets: bigint
  totalSupplyShares: bigint
  totalBorrowAssets: bigint
  totalBorrowShares: bigint
  totalCollateral: bigint
  reserves: bigint
  borrowApr: number // percent
  supplyApr: number
  utilisation: number
  priceUsd: number // collateral unit in USDG, at the borrow price
  available: bigint // USDG that can still be borrowed or withdrawn
}

export type Position = { supplied: bigint; supplyShares: bigint; collateral: bigint; debt: bigint; borrowable: bigint; health: bigint }
export type Wallet = { usdg: bigint; usdgAllowance: bigint; positions: Record<string, Position>; stocks: Record<string, { balance: bigint; allowance: bigint }> }

export async function readMarkets(assets: Asset[], pools: Pool[]): Promise<Market[]> {
  if (!DEPLOYED) return []
  const c = client()
  const n = await c.readContract({ address: LEND, abi, functionName: 'marketCount' })
  if (n === 0n) return []
  const ids = Array.from({ length: Number(n) }, (_, i) => BigInt(i))
  const calls: ContractFunctionParameters[] = ids.flatMap((id) => [
    { address: LEND, abi, functionName: 'market', args: [id] },
    { address: LEND, abi, functionName: 'rates', args: [id] },
    { address: LEND, abi, functionName: 'collateralValue', args: [id, 10n ** 18n, true] },
  ])
  const r = await c.multicall({ multicallAddress: MULTICALL3, contracts: calls, allowFailure: true })
  const stocks = stockTokens(assets)
  return ids.map((id, i) => {
    const m = r[i * 3].result as { collateral: Address; pool: Address; collateralIsToken0: boolean; enabled: boolean; ltvBps: number; liqThresholdBps: number; liqBonusBps: number; twapWindow: number; supplyCap: bigint; borrowCap: bigint; collateralCap: bigint; totalSupplyAssets: bigint; totalSupplyShares: bigint; totalBorrowAssets: bigint; totalBorrowShares: bigint; totalCollateral: bigint; reserves: bigint }
    const rates = (r[i * 3 + 1].result as [bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n]
    const unit = (r[i * 3 + 2].result as bigint | undefined) ?? 0n
    const stock = stocks.find((s) => s.address.toLowerCase() === m.collateral.toLowerCase())
    const pool = pools.find((p) => p.address.toLowerCase() === m.pool.toLowerCase()) ?? (stock ? poolFor(stock, pools) : undefined)
    const available = m.totalSupplyAssets > m.totalBorrowAssets ? m.totalSupplyAssets - m.totalBorrowAssets : 0n
    return { id, stock, pool, collateral: m.collateral, poolAddress: m.pool, enabled: m.enabled, ltvBps: m.ltvBps, liqThresholdBps: m.liqThresholdBps, liqBonusBps: m.liqBonusBps, twapWindow: m.twapWindow, supplyCap: m.supplyCap, borrowCap: m.borrowCap, collateralCap: m.collateralCap, totalSupplyAssets: m.totalSupplyAssets, totalSupplyShares: m.totalSupplyShares, totalBorrowAssets: m.totalBorrowAssets, totalBorrowShares: m.totalBorrowShares, totalCollateral: m.totalCollateral, reserves: m.reserves, borrowApr: Number(rates[0]) / 100, supplyApr: Number(rates[1]) / 100, utilisation: Number(rates[2]) / 100, priceUsd: Number(formatUnits(unit, 6)), available }
  })
}

export function useMarkets(assets: Asset[] | undefined, pools: Pool[] | undefined) {
  return useQuery({ queryKey: ['lend-markets', LEND, assets?.length ?? 0, pools?.length ?? 0], queryFn: () => readMarkets(assets ?? [], pools ?? []), enabled: DEPLOYED && !!assets && !!pools, refetchInterval: 30_000, staleTime: 15_000 })
}

export async function readWallet(owner: Address, markets: Market[]): Promise<Wallet> {
  const c = client()
  const calls: ContractFunctionParameters[] = [
    { address: USDG.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
    { address: USDG.address, abi: erc20Abi, functionName: 'allowance', args: [owner, LEND] },
    ...markets.flatMap((m) => [
      { address: LEND, abi, functionName: 'suppliedOf', args: [m.id, owner] },
      { address: LEND, abi, functionName: 'supplyShares', args: [m.id, owner] },
      { address: LEND, abi, functionName: 'collateralOf', args: [m.id, owner] },
      { address: LEND, abi, functionName: 'debtOf', args: [m.id, owner] },
      { address: LEND, abi, functionName: 'borrowable', args: [m.id, owner] },
      { address: LEND, abi, functionName: 'health', args: [m.id, owner] },
      { address: m.collateral, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
      { address: m.collateral, abi: erc20Abi, functionName: 'allowance', args: [owner, LEND] },
    ]),
  ]
  const r = await c.multicall({ multicallAddress: MULTICALL3, contracts: calls, allowFailure: true })
  const v = (i: number) => (r[i].result as bigint | undefined) ?? 0n
  const positions: Record<string, Position> = {}
  const stocks: Record<string, { balance: bigint; allowance: bigint }> = {}
  markets.forEach((m, i) => {
    const b = 2 + i * 8
    positions[m.id.toString()] = { supplied: v(b), supplyShares: v(b + 1), collateral: v(b + 2), debt: v(b + 3), borrowable: v(b + 4), health: v(b + 5) }
    stocks[m.collateral.toLowerCase()] = { balance: v(b + 6), allowance: v(b + 7) }
  })
  return { usdg: v(0), usdgAllowance: v(1), positions, stocks }
}

export function useLendWallet(owner: Address | undefined, markets: Market[] | undefined) {
  return useQuery({ queryKey: ['lend-wallet', LEND, owner?.toLowerCase(), markets?.length ?? 0], queryFn: () => readWallet(owner as Address, markets ?? []), enabled: DEPLOYED && !!owner && !!markets, refetchInterval: 20_000 })
}

async function approveExact(ctx: TxCtx, token: Address, amount: bigint, current: bigint) {
  if (current >= amount) return
  ctx.onPhase('approving')
  const hash = await ctx.walletClient.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [LEND, amount], account: ctx.account.address, chain: null })
  await client().waitForTransactionReceipt({ hash, timeout: 120_000 })
}

async function send(ctx: TxCtx, fn: 'supply' | 'withdraw' | 'addCollateral' | 'removeCollateral' | 'borrow' | 'repay' | 'skim', args: readonly unknown[]) {
  ctx.onPhase('confirming')
  const hash = await ctx.walletClient.writeContract({ address: LEND, abi, functionName: fn, args: args as never, account: ctx.account.address, chain: null })
  ctx.onPhase('pending')
  const receipt = await client().waitForTransactionReceipt({ hash, timeout: 120_000 })
  if (receipt.status !== 'success') throw new Error('The transaction reverted.')
  ctx.onPhase('done')
  return hash
}

export async function supplyUsdg(ctx: TxCtx, m: Market, assets: bigint, allowance: bigint) {
  await ensureChain(ctx); await approveExact(ctx, USDG.address, assets, allowance)
  return send(ctx, 'supply', [m.id, assets, ctx.account.address])
}
export async function withdrawUsdg(ctx: TxCtx, m: Market, shares: bigint) {
  await ensureChain(ctx)
  return send(ctx, 'withdraw', [m.id, shares, ctx.account.address])
}
export async function addCollateral(ctx: TxCtx, m: Market, amount: bigint, allowance: bigint) {
  await ensureChain(ctx); await approveExact(ctx, m.collateral, amount, allowance)
  return send(ctx, 'addCollateral', [m.id, amount, ctx.account.address])
}
export async function removeCollateral(ctx: TxCtx, m: Market, amount: bigint) {
  await ensureChain(ctx)
  return send(ctx, 'removeCollateral', [m.id, amount, ctx.account.address])
}
export async function borrowUsdg(ctx: TxCtx, m: Market, assets: bigint) {
  await ensureChain(ctx)
  return send(ctx, 'borrow', [m.id, assets, ctx.account.address])
}
// Repay: approve a hair more than the debt so interest accrued between the quote and the block is covered; the contract pulls only what is owed.
export async function repayUsdg(ctx: TxCtx, m: Market, assets: bigint, all: boolean, allowance: bigint) {
  await ensureChain(ctx)
  const cover = all ? assets + assets / 1000n + 1n : assets
  await approveExact(ctx, USDG.address, cover, allowance)
  return send(ctx, 'repay', [m.id, all ? MAX : assets, ctx.account.address])
}

// Deploy: one transaction, then one createMarket per launch stock from the deploy page.
export async function deployLend(ctx: TxCtx) {
  await ensureChain(ctx)
  ctx.onPhase('confirming')
  const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, data: encodeDeployData({ abi, bytecode: BYTECODE, args: [USDG.address, TREASURY] }) })
  ctx.onPhase('pending')
  const receipt = await client().waitForTransactionReceipt({ hash, timeout: 120_000 })
  ctx.onPhase('done')
  return { hash, address: receipt.contractAddress as Address }
}

export type MarketPlan = { stock: StockToken; pool: Pool; collateralCap: bigint }
export function planMarkets(assets: Asset[], pools: Pool[]): { plans: MarketPlan[]; missing: string[] } {
  const stocks = stockTokens(assets)
  const plans: MarketPlan[] = [], missing: string[] = []
  for (const ticker of LAUNCH_TICKERS) {
    const stock = stocks.find((s) => s.ticker === ticker)
    const pool = stock ? poolFor(stock, pools) : undefined
    if (!stock || !pool || !deepEnough(pool) || pool.quote.address.toLowerCase() !== USDG.address.toLowerCase() || pool.priceUsd <= 0) { missing.push(ticker); continue }
    const units = LAUNCH.collateralUsd / pool.priceUsd
    plans.push({ stock, pool, collateralCap: BigInt(Math.floor(units * 1e6)) * 10n ** BigInt(stock.decimals - 6) })
  }
  return { plans, missing }
}

export async function createMarket(ctx: TxCtx, lend: Address, p: MarketPlan) {
  await ensureChain(ctx)
  ctx.onPhase('confirming')
  const hash = await ctx.walletClient.writeContract({ address: lend, abi, functionName: 'createMarket', args: [p.stock.address, p.pool.address, LAUNCH.ltvBps, LAUNCH.liqThresholdBps, LAUNCH.liqBonusBps, LAUNCH.twapWindow, LAUNCH.rateBaseBps, LAUNCH.rateSlopeBps, LAUNCH.supplyCap, LAUNCH.borrowCap, p.collateralCap], account: ctx.account.address, chain: null })
  ctx.onPhase('pending')
  await client().waitForTransactionReceipt({ hash, timeout: 120_000 })
  ctx.onPhase('done')
  return hash
}

export const fmtUsdg = (v: bigint, d = 2) => `$${Number(formatUnits(v, 6)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
export const fmtUnits = (v: bigint, decimals: number, d = 4) => Number(formatUnits(v, decimals)).toLocaleString('en-US', { maximumFractionDigits: d })
export const fmtHealth = (h: bigint) => (h === MAX ? '∞' : (Number(h) / 10_000).toFixed(2))
