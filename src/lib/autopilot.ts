// Auto-Invest without you: recurring buys that run from a contract on Robinhood Chain while the owner
// is away. The contract (contracts/VerdexAutoInvest.sol) pulls one buy's worth from the owner's USDG
// allowance when a buy is due, swaps it in the Uniswap v3 pool the plan names, sends the stock to the
// owner and a small tip to whoever ran it. It holds nothing between buys. This module reads plans, builds
// the transactions and chooses the pool; the page shows them.
import { useQuery } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi, formatUnits, isAddress, parseAbi, parseUnits, type Address } from 'viem'
import artifact from '../../contracts/VerdexAutoInvest.json'
import { ROBINHOOD } from './api'
import type { Asset } from './api'
import { waitForTx } from './lifi'
import { DEEP_POOL_USD } from './yield'
import { MULTICALL3, USDG, client, ensureChain, sendTx, stockTokens, type Pool, type StockToken, type TxCtx } from './pools'

export const AUTOINVEST_ADDRESS = String(import.meta.env.VITE_AUTOINVEST_ADDRESS ?? '').trim()
export const DEPLOYED = isAddress(AUTOINVEST_ADDRESS)
export const CONTRACT = (DEPLOYED ? AUTOINVEST_ADDRESS : '0x0000000000000000000000000000000000000000') as Address
export const abi = parseAbi([
  'constructor(address factory_, address executor_)',
  'function createPlan(address tokenIn,address tokenOut,uint24 fee,uint96 amountIn,uint96 tip,uint32 interval,uint40 firstAt,uint32 buys,uint16 maxSlippageBps) returns (uint256)',
  'function setPaused(uint256 id,bool paused)',
  'function cancel(uint256 id)',
  'function plansOf(address owner) view returns (uint256[])',
  'function isDue(uint256 id) view returns (bool)',
  'function quoteSpot(uint256 id) view returns (uint256)',
  'function floorOut(uint256 id) view returns (uint256)',
  'function execute(uint256 id,uint256 minOut) returns (uint256)',
  'function planCount() view returns (uint256)',
  'function plans(uint256) view returns (address owner,address tokenIn,address tokenOut,uint24 fee,uint32 interval,uint40 nextAt,uint32 buysLeft,uint32 buysDone,uint16 maxSlippageBps,bool paused,uint96 amountIn,uint96 tip,uint128 spent,uint128 received)',
  'function admin() view returns (address)',
  'function isExecutor(address) view returns (bool)',
  'function setExecutor(address executor,bool allowed)',
  'function factory() view returns (address)',
  'event PlanCreated(uint256 indexed id,address indexed owner,address tokenIn,address tokenOut,uint24 fee,uint96 amountIn,uint32 interval,uint40 firstAt,uint32 buys)',
  'event Executed(uint256 indexed id,address indexed executor,uint256 amountIn,uint256 amountOut,uint256 tip,uint40 nextAt)',
])
export const BYTECODE = artifact.bytecode as `0x${string}`
export const EXPLORER = 'https://robin.etherscan.io'
export const UNLIMITED = 4294967295
export const MIN_INTERVAL = 3600
export const DEFAULT_TIP = parseUnits('0.05', 6)
export const DEFAULT_SLIPPAGE_BPS = 100

export type Cadence = { key: string; label: string; seconds: number; perMonth: number }
export const CADENCES: Cadence[] = [
  { key: 'day', label: 'Every day', seconds: 86_400, perMonth: 30 },
  { key: 'week', label: 'Every week', seconds: 604_800, perMonth: 52 / 12 },
  { key: 'two', label: 'Every two weeks', seconds: 1_209_600, perMonth: 26 / 12 },
  { key: 'month', label: 'Every month', seconds: 2_592_000, perMonth: 1 },
]
export const cadenceFor = (seconds: number) => CADENCES.find((c) => c.seconds === seconds)?.label ?? (seconds % 86_400 === 0 ? `Every ${seconds / 86_400} days` : `Every ${Math.round(seconds / 3600)} hours`)

export type OnchainPlan = {
  id: bigint
  owner: Address
  tokenIn: Address
  tokenOut: Address
  fee: number
  interval: number
  nextAt: number
  buysLeft: number
  buysDone: number
  maxSlippageBps: number
  paused: boolean
  amountIn: bigint
  tip: bigint
  spent: bigint
  received: bigint
  quoteOut: bigint
  stock?: StockToken
  state: 'active' | 'paused' | 'finished' | 'cancelled'
}
export const STATE_LABEL: Record<OnchainPlan['state'], string> = { active: 'Running', paused: 'Paused', finished: 'Finished', cancelled: 'Cancelled' }

type RawPlan = readonly [Address, Address, Address, number, number, number, number, number, number, boolean, bigint, bigint, bigint, bigint]
function fromRaw(id: bigint, r: RawPlan, quoteOut: bigint, stocks: StockToken[]): OnchainPlan {
  const [owner, tokenIn, tokenOut, fee, interval, nextAt, buysLeft, buysDone, maxSlippageBps, paused] = r
  const cancelled = paused && buysLeft === 0
  const state: OnchainPlan['state'] = cancelled ? 'cancelled' : buysLeft === 0 ? 'finished' : paused ? 'paused' : 'active'
  return { id, owner, tokenIn, tokenOut, fee, interval, nextAt, buysLeft, buysDone, maxSlippageBps, paused, amountIn: r[10], tip: r[11], spent: r[12], received: r[13], quoteOut, stock: stocks.find((s) => s.address.toLowerCase() === tokenOut.toLowerCase()), state }
}

export async function readPlans(owner: Address, assets: Asset[]): Promise<OnchainPlan[]> {
  if (!DEPLOYED) return []
  const c = client()
  const ids = [...(await c.readContract({ address: CONTRACT, abi, functionName: 'plansOf', args: [owner] }))]
  if (!ids.length) return []
  const raw = await c.multicall({ multicallAddress: MULTICALL3, contracts: ids.flatMap((id) => [{ address: CONTRACT, abi, functionName: 'plans', args: [id] } as const, { address: CONTRACT, abi, functionName: 'quoteSpot', args: [id] } as const]) })
  const stocks = stockTokens(assets)
  return ids.map((id, i) => fromRaw(id, raw[i * 2].result as RawPlan, (raw[i * 2 + 1].status === 'success' ? (raw[i * 2 + 1].result as bigint) : 0n), stocks)).reverse()
}
export function usePlans(owner: Address | undefined, assets: Asset[] | undefined) {
  return useQuery({ queryKey: ['autopilot', owner?.toLowerCase()], queryFn: () => readPlans(owner!, assets!), enabled: DEPLOYED && !!owner && !!assets, staleTime: 15_000, refetchInterval: 30_000, retry: 1 })
}

export type Totals = { plans: number; buys: number; spent: number; running: number }
export async function readTotals(): Promise<Totals> {
  if (!DEPLOYED) return { plans: 0, buys: 0, spent: 0, running: 0 }
  const c = client()
  const n = Number(await c.readContract({ address: CONTRACT, abi, functionName: 'planCount' }))
  const ids = Array.from({ length: Math.min(n, 400) }, (_, i) => BigInt(n - i))
  const raw = ids.length ? await c.multicall({ multicallAddress: MULTICALL3, contracts: ids.map((id) => ({ address: CONTRACT, abi, functionName: 'plans', args: [id] } as const)) }) : []
  let buys = 0, spent = 0, running = 0
  for (const r of raw) {
    if (r.status !== 'success') continue
    const p = r.result as RawPlan
    buys += p[7]
    spent += Number(formatUnits(p[12], USDG.decimals))
    if (!p[9] && p[6] !== 0) running++
  }
  return { plans: n, buys, spent, running }
}
export function useTotals() {
  return useQuery({ queryKey: ['autopilot-totals'], queryFn: readTotals, enabled: DEPLOYED, staleTime: 60_000, refetchInterval: 120_000, retry: 1 })
}

export async function readAllowance(owner: Address): Promise<{ allowance: bigint; balance: bigint }> {
  const c = client()
  const [allowance, balance] = await Promise.all([
    c.readContract({ address: USDG.address, abi: erc20Abi, functionName: 'allowance', args: [owner, CONTRACT] }),
    c.readContract({ address: USDG.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
  ])
  return { allowance, balance }
}
export function useAllowance(owner: Address | undefined) {
  return useQuery({ queryKey: ['autopilot-allowance', owner?.toLowerCase()], queryFn: () => readAllowance(owner!), enabled: DEPLOYED && !!owner, staleTime: 10_000, retry: 1 })
}

// The pool a plan trades in: the deepest USDG pool for the stock, if it is deep enough to buy from.
export function poolFor(stock: StockToken, pools: Pool[]): Pool | undefined {
  const mine = pools.filter((p) => p.quote.address.toLowerCase() === USDG.address.toLowerCase() && (p.token0.address.toLowerCase() === stock.address.toLowerCase() || p.token1.address.toLowerCase() === stock.address.toLowerCase()))
  return mine.sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0]
}
export const deepEnough = (pool: Pool | undefined) => !!pool && pool.liquidityUsd >= DEEP_POOL_USD

export type NewPlan = { stock: StockToken; pool: Pool; amount: bigint; tip: bigint; interval: number; firstAt: number; buys: number; slippageBps: number; budget: bigint }

// The allowance is the plan's budget: exact, never unlimited, so the owner always knows the most the
// contract can ever pull. Revoking it ends every plan at once.
async function approveExact(ctx: TxCtx, amount: bigint) {
  ctx.onPhase('approving')
  const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, to: USDG.address, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [CONTRACT, amount] }) })
  await waitForTx(ctx.chain ?? ({ id: ROBINHOOD } as never), hash)
}
export async function setAllowance(ctx: TxCtx, amount: bigint) {
  await ensureChain(ctx)
  await approveExact(ctx, amount)
  ctx.onPhase('done')
}
export async function createPlan(ctx: TxCtx, p: NewPlan) {
  await ensureChain(ctx)
  const { allowance } = await readAllowance(ctx.account.address)
  if (allowance < p.budget) await approveExact(ctx, p.budget)
  const data = encodeFunctionData({ abi, functionName: 'createPlan', args: [USDG.address, p.stock.address, p.pool.fee, p.amount, p.tip, p.interval, p.firstAt, p.buys, p.slippageBps] })
  return sendTx(ctx, CONTRACT, data)
}
export async function setPaused(ctx: TxCtx, id: bigint, paused: boolean) {
  await ensureChain(ctx)
  return sendTx(ctx, CONTRACT, encodeFunctionData({ abi, functionName: 'setPaused', args: [id, paused] }))
}
export async function cancelPlan(ctx: TxCtx, id: bigint) {
  await ensureChain(ctx)
  return sendTx(ctx, CONTRACT, encodeFunctionData({ abi, functionName: 'cancel', args: [id] }))
}
// The owner may run a due plan themselves, with the same price floor the executor gets.
export async function runNow(ctx: TxCtx, id: bigint) {
  await ensureChain(ctx)
  const floor = await client().readContract({ address: CONTRACT, abi, functionName: 'floorOut', args: [id] })
  return sendTx(ctx, CONTRACT, encodeFunctionData({ abi, functionName: 'execute', args: [id, floor] }))
}

export const budgetFor = (amount: bigint, tip: bigint, buys: number, months = 12, interval = 2_592_000) => (buys === UNLIMITED ? (amount + tip) * BigInt(Math.max(1, Math.ceil((months * 2_592_000) / interval))) : (amount + tip) * BigInt(buys))
export const fmtUsdg = (v: bigint, d = 2) => `$${Number(formatUnits(v, USDG.decimals)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
export const fmtStock = (v: bigint, decimals = 18) => { const n = Number(formatUnits(v, decimals)); return n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toFixed(6) }
export const fmtWhen = (sec: number) => new Date(sec * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
export const explorerAddress = (a: string) => `${EXPLORER}/address/${a}`
