// Vaults without you: target weights over tokenized stocks kept by a contract on Robinhood Chain while the
// owner is away. The contract (contracts/VerdexVaults.sol) values the owner's holdings at the pools' spot
// prices; when any weight has drifted past the threshold and the interval has passed, the executor sells the
// overweight stocks for USDG, buys the underweight ones with the proceeds and sends everything to the owner,
// all inside one transaction with a floor on every leg. This module reads vaults and builds the transactions.
import { useQuery } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi, formatUnits, isAddress, parseAbi, parseUnits, type Address } from 'viem'
import artifact from '../../contracts/VerdexVaults.json'
import { VAULTS_ADDRESS as BUILT_IN } from '../../scripts/vaults-address.mjs'
import type { Asset } from './api'
import { ROBINHOOD } from './api'
import { waitForTx } from './lifi'
import { deepEnough, poolFor } from './autopilot'
import { MULTICALL3, USDG, client, ensureChain, sendTx, stockTokens, type Pool, type StockToken, type TxCtx } from './pools'

export const VAULTS_ADDRESS = (String(import.meta.env.VITE_VAULTS_ADDRESS ?? '').trim() || BUILT_IN).trim()
export const DEPLOYED = isAddress(VAULTS_ADDRESS)
export const CONTRACT = (DEPLOYED ? VAULTS_ADDRESS : '0x0000000000000000000000000000000000000000') as Address
export const abi = parseAbi([
  'constructor(address factory_, address usdg_, address executor_)',
  'function create(address[] tokens,uint24[] fees,uint16[] targets,uint16 thresholdBps,uint32 interval,uint16 maxSlippageBps,uint96 tip) returns (uint256)',
  'function setPaused(uint256 id,bool paused)',
  'function vaultsOf(address owner) view returns (uint256[])',
  'function legs(uint256 id) view returns ((address token,uint24 fee,uint16 targetBps)[])',
  'function vaults(uint256) view returns (address owner,uint16 thresholdBps,uint16 maxSlippageBps,uint32 interval,uint40 lastRun,uint32 runs,bool paused,uint96 tip)',
  'function vaultCount() view returns (uint256)',
  'function value(uint256 id) view returns (uint256[] balances,uint256[] values,uint256 total)',
  'function drift(uint256 id) view returns (uint16)',
  'function isDue(uint256 id) view returns (bool)',
  'function execute(uint256 id) returns (uint256 soldUsdg,uint256 boughtUsdg)',
  'function admin() view returns (address)',
  'function isExecutor(address) view returns (bool)',
  'function setExecutor(address executor,bool allowed)',
  'event VaultCreated(uint256 indexed id,address indexed owner,address[] tokens,uint16[] targets,uint16 thresholdBps,uint32 interval)',
  'event Rebalanced(uint256 indexed id,address indexed executor,uint256 totalUsdg,uint256 soldUsdg,uint256 boughtUsdg,uint256 tip)',
])
export const BYTECODE = artifact.bytecode as `0x${string}`
export const EXPLORER = 'https://robin.etherscan.io'
export const DEFAULT_TIP = parseUnits('0.10', 6)
export const DEFAULT_SLIPPAGE_BPS = 100
export const THRESHOLDS = [200, 500, 1000] // bps
export const INTERVALS: { key: string; label: string; seconds: number }[] = [{ key: 'day', label: 'Daily at most', seconds: 86_400 }, { key: 'week', label: 'Weekly at most', seconds: 604_800 }, { key: 'month', label: 'Monthly at most', seconds: 2_592_000 }]
export const intervalLabel = (s: number) => INTERVALS.find((x) => x.seconds === s)?.label ?? `Every ${Math.round(s / 3600)} hours at most`

export type Preset = { id: string; name: string; blurb: string; weights: [string, number][] }
export const PRESETS: Preset[] = [
  { id: 'mag7', name: 'Magnificent 7', blurb: 'The seven, one seventh each. Winners get trimmed into the laggards.', weights: [['AAPL', 1], ['MSFT', 1], ['GOOGL', 1], ['AMZN', 1], ['NVDA', 1], ['META', 1], ['TSLA', 1]] },
  { id: 'semis', name: 'Semis', blurb: 'The chip stack, equal weight.', weights: [['NVDA', 1], ['MU', 1], ['AMD', 1], ['TSM', 1], ['INTC', 1]] },
  { id: 'ai', name: 'AI Infrastructure', blurb: 'The chips and the clouds that rent them.', weights: [['NVDA', 2], ['MSFT', 1], ['GOOGL', 1], ['AMZN', 1], ['AMD', 1], ['TSM', 1]] },
  { id: 'frontier', name: 'Frontier', blurb: 'SpaceX, Circle, Strategy, Palantir, Reddit.', weights: [['SPCX', 1], ['CRCL', 1], ['MSTR', 1], ['PLTR', 1], ['RDDT', 1]] },
  { id: 'core', name: 'Core Index', blurb: 'S&P 500 and Nasdaq 100, 60/40.', weights: [['SPY', 3], ['QQQ', 2]] },
]

export type Target = { stock: StockToken; pool: Pool; weight: number }
// A preset over the stocks that have a deep USDG pool today, weights normalised to sum to one.
export function presetTargets(p: Preset, stocks: StockToken[], pools: Pool[]): Target[] {
  const out: Target[] = []
  for (const [ticker, w] of p.weights) {
    const stock = stocks.find((s) => s.ticker === ticker)
    const pool = stock ? poolFor(stock, pools) : undefined
    if (stock && pool && deepEnough(pool)) out.push({ stock, pool, weight: w })
  }
  return normalise(out)
}
export function normalise(ts: Target[]): Target[] {
  const sum = ts.reduce((s, x) => s + x.weight, 0)
  return sum > 0 ? ts.map((x) => ({ ...x, weight: x.weight / sum })) : ts
}
// Weights in bps that sum to exactly 10_000 (the last leg takes the rounding).
export function toBps(ts: Target[]): number[] {
  const bps = ts.map((x) => Math.round(x.weight * 10_000))
  const diff = 10_000 - bps.reduce((s, b) => s + b, 0)
  if (bps.length) bps[bps.length - 1] += diff
  return bps
}

export type OnchainLeg = { token: Address; fee: number; targetBps: number; stock?: StockToken; balance: bigint; valueUsdg: bigint; weightBps: number; allowance: bigint }
export type OnchainVault = {
  id: bigint
  owner: Address
  thresholdBps: number
  maxSlippageBps: number
  interval: number
  lastRun: number
  runs: number
  paused: boolean
  tip: bigint
  legs: OnchainLeg[]
  totalUsdg: bigint
  driftBps: number
  due: boolean
  state: 'active' | 'paused'
}
type RawVault = readonly [Address, number, number, number, number, number, boolean, bigint]
type RawLeg = { token: Address; fee: number; targetBps: number }
const lc = (a: string) => a.toLowerCase()

export async function readVaults(owner: Address, assets: Asset[]): Promise<OnchainVault[]> {
  if (!DEPLOYED) return []
  const c = client()
  const ids = [...(await c.readContract({ address: CONTRACT, abi, functionName: 'vaultsOf', args: [owner] }))]
  if (!ids.length) return []
  const raw = await c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts: ids.flatMap((id) => [
    { address: CONTRACT, abi, functionName: 'vaults', args: [id] } as const,
    { address: CONTRACT, abi, functionName: 'legs', args: [id] } as const,
    { address: CONTRACT, abi, functionName: 'value', args: [id] } as const,
    { address: CONTRACT, abi, functionName: 'drift', args: [id] } as const,
    { address: CONTRACT, abi, functionName: 'isDue', args: [id] } as const,
  ]) })
  const stocks = stockTokens(assets)
  const out: OnchainVault[] = []
  for (let i = 0; i < ids.length; i++) {
    const v = raw[i * 5].result as RawVault
    const legs = (raw[i * 5 + 1].result ?? []) as readonly RawLeg[]
    const val = raw[i * 5 + 2].status === 'success' ? (raw[i * 5 + 2].result as readonly [readonly bigint[], readonly bigint[], bigint]) : ([[], [], 0n] as const)
    const driftBps = raw[i * 5 + 3].status === 'success' ? Number(raw[i * 5 + 3].result) : 0
    const due = raw[i * 5 + 4].status === 'success' && (raw[i * 5 + 4].result as boolean)
    const allow = await c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts: legs.map((l) => ({ address: l.token, abi: erc20Abi, functionName: 'allowance', args: [owner, CONTRACT] } as const)) })
    const total = val[2]
    out.push({
      id: ids[i], owner: v[0], thresholdBps: v[1], maxSlippageBps: v[2], interval: v[3], lastRun: v[4], runs: v[5], paused: v[6], tip: v[7],
      legs: legs.map((l, k) => ({ token: l.token, fee: l.fee, targetBps: l.targetBps, stock: stocks.find((s) => lc(s.address) === lc(l.token)), balance: val[0][k] ?? 0n, valueUsdg: val[1][k] ?? 0n, weightBps: total > 0n ? Number(((val[1][k] ?? 0n) * 10_000n) / total) : 0, allowance: allow[k]?.status === 'success' ? (allow[k].result as bigint) : 0n })),
      totalUsdg: total, driftBps, due, state: v[6] ? 'paused' : 'active',
    })
  }
  return out.reverse()
}
export function useOnchainVaults(owner: Address | undefined, assets: Asset[] | undefined) {
  return useQuery({ queryKey: ['vaults-onchain', owner?.toLowerCase()], queryFn: () => readVaults(owner!, assets!), enabled: DEPLOYED && !!owner && !!assets, staleTime: 15_000, refetchInterval: 30_000, retry: 1 })
}
export type Totals = { vaults: number; runs: number; active: number }
export async function readTotals(): Promise<Totals> {
  if (!DEPLOYED) return { vaults: 0, runs: 0, active: 0 }
  const c = client()
  const n = Number(await c.readContract({ address: CONTRACT, abi, functionName: 'vaultCount' }))
  const ids = Array.from({ length: Math.min(n, 400) }, (_, i) => BigInt(n - i))
  const raw = ids.length ? await c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts: ids.map((id) => ({ address: CONTRACT, abi, functionName: 'vaults', args: [id] } as const)) }) : []
  let runs = 0, active = 0
  for (const r of raw) { if (r.status !== 'success') continue; const v = r.result as RawVault; runs += v[5]; if (!v[6]) active++ }
  return { vaults: n, runs, active }
}
export function useVaultTotals() {
  return useQuery({ queryKey: ['vaults-onchain-totals'], queryFn: readTotals, enabled: DEPLOYED, staleTime: 60_000, refetchInterval: 120_000, retry: 1 })
}

export type NewVault = { targets: Target[]; thresholdBps: number; interval: number; slippageBps: number; tip: bigint }
export async function createVault(ctx: TxCtx, v: NewVault) {
  await ensureChain(ctx)
  const data = encodeFunctionData({ abi, functionName: 'create', args: [v.targets.map((t) => t.stock.address), v.targets.map((t) => t.pool.fee), toBps(v.targets), v.thresholdBps, v.interval, v.slippageBps, v.tip] })
  return sendTx(ctx, CONTRACT, data)
}
// Approve each stock for exactly what the wallet holds today: the most a rebalance can ever sell of it.
export async function approveHoldings(ctx: TxCtx, tokens: Address[], onToken?: (i: number) => void) {
  await ensureChain(ctx)
  const c = client()
  for (let i = 0; i < tokens.length; i++) {
    onToken?.(i)
    const bal = await c.readContract({ address: tokens[i], abi: erc20Abi, functionName: 'balanceOf', args: [ctx.account.address] })
    const allowance = await c.readContract({ address: tokens[i], abi: erc20Abi, functionName: 'allowance', args: [ctx.account.address, CONTRACT] })
    if (allowance >= bal) continue
    ctx.onPhase('approving')
    const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, to: tokens[i], data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [CONTRACT, bal] }) })
    await waitForTx(ctx.chain ?? ({ id: ROBINHOOD } as never), hash)
  }
  ctx.onPhase('done')
}
export async function revokeHoldings(ctx: TxCtx, tokens: Address[]) {
  await ensureChain(ctx)
  for (const token of tokens) {
    ctx.onPhase('approving')
    const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [CONTRACT, 0n] }) })
    await waitForTx(ctx.chain ?? ({ id: ROBINHOOD } as never), hash)
  }
  ctx.onPhase('done')
}
export async function setPaused(ctx: TxCtx, id: bigint, paused: boolean) {
  await ensureChain(ctx)
  return sendTx(ctx, CONTRACT, encodeFunctionData({ abi, functionName: 'setPaused', args: [id, paused] }))
}
export async function runNow(ctx: TxCtx, id: bigint) {
  await ensureChain(ctx)
  return sendTx(ctx, CONTRACT, encodeFunctionData({ abi, functionName: 'execute', args: [id] }))
}
export const fmtUsdg = (v: bigint, d = 2) => `$${Number(formatUnits(v, USDG.decimals)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
export const fmtWhen = (sec: number) => new Date(sec * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
export const explorerAddress = (a: string) => `${EXPLORER}/address/${a}`
export { deepEnough, poolFor }
