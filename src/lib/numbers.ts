// Verdex in numbers: what the contracts hold and have done, read from the chain by the browser, each number
// with the transactions behind it. Index TVL comes from the index contracts valued at the pools, the volume
// from the aggregator's record of swaps and bridges made through Verdex and from the Index router's events,
// the fees from the treasury contract, and the plans, fills, runs and trades from the four contracts that work
// without you. Nothing here is typed in by hand.
import { useQuery } from '@tanstack/react-query'
import { formatUnits, parseAbiItem, type Address } from 'viem'
import { ROBINHOOD } from './api'
import { BASE_INDEX, ROBINHOOD_INDEX, type IndexChain } from './indexChains'
import { CONTRACT as AUTOINVEST, DEPLOYED as AUTOINVEST_DEPLOYED } from './autopilot'
import { CONTRACT as ORDERS, DEPLOYED as ORDERS_DEPLOYED } from './ordersOnchain'
import { CONTRACT as VAULTS, DEPLOYED as VAULTS_DEPLOYED } from './vaultsOnchain'
import { CONTRACT as AGENT, DEPLOYED as AGENT_DEPLOYED } from './agentOnchain'
import { TREASURY, DEPLOYED as TREASURY_DEPLOYED, chunked, readTreasury, type Treasury } from './treasury'
import { MULTICALL3, client, clientFor } from './pools'

const LIFI = 'https://li.quest/v1'
const LOOKBACK = 4n * 6_048_000n // about four weeks of 0.1 s blocks on Robinhood Chain
const BASE_LOOKBACK = 200_000n // about four and a half days of 2 s blocks on Base: its public RPCs take 10k-block windows at most
const BASE_WINDOW = 10_000n
// Logs over many small windows, a few at a time, for an RPC that caps the range; a failed window is skipped.
async function windowed<T>(from: bigint, to: bigint, window: bigint, fn: (a: bigint, b: bigint) => Promise<T[]>, concurrency = 8): Promise<T[]> {
  const spans: [bigint, bigint][] = []
  for (let a = from; a <= to; a += window) spans.push([a, a + window - 1n > to ? to : a + window - 1n])
  let out: T[] = []
  for (let i = 0; i < spans.length; i += concurrency) out = out.concat((await Promise.all(spans.slice(i, i + concurrency).map(([a, b]) => fn(a, b).catch(() => [] as T[])))).flat())
  return out
}
export const EXPLORERS: Record<number, string> = { [ROBINHOOD]: 'https://robin.etherscan.io', 8453: 'https://basescan.org', 56: 'https://bscscan.com', 42161: 'https://arbiscan.io', 1: 'https://etherscan.io', 10: 'https://optimistic.etherscan.io', 137: 'https://polygonscan.com' }
export const txLink = (chainId: number, hash: string) => `${EXPLORERS[chainId] ?? 'https://robin.etherscan.io'}/tx/${hash}`
export const addressLink = (chainId: number, a: string) => `${EXPLORERS[chainId] ?? 'https://robin.etherscan.io'}/address/${a}`

export type Tx = { chainId: number; hash: `0x${string}`; block: number; label: string; usd?: number }
export type Volume = { usd: number; count: number; byChain: { chainId: number; usd: number; count: number }[]; recent: { link: string; usd: number; at: number; tool: string; chainId: number }[]; since: number }
export type IndexTrades = { buys: number; sells: number; usdg: number; feesUsdg: number; recent: Tx[] }
export type WithoutYou = { plans: number; buys: number; buysUsdg: number; orders: number; fills: number; vaults: number; runs: number; mandates: number; trades: number; recent: Tx[] }
export type Numbers = { volume: Volume; indexTrades: IndexTrades; treasury: Treasury | null; withoutYou: WithoutYou }

const EXECUTED = parseAbiItem('event Executed(uint256 indexed id,address indexed executor,uint256 amountIn,uint256 amountOut,uint256 tip,uint40 nextAt)')
const FILLED = parseAbiItem('event Filled(uint256 indexed id,address indexed executor,uint256 amountIn,uint256 amountOut,uint256 tip)')
const REBALANCED = parseAbiItem('event Rebalanced(uint256 indexed id,address indexed executor,uint256 totalUsdg,uint256 soldUsdg,uint256 boughtUsdg,uint256 tip)')
const TRADED = parseAbiItem('event Traded(uint256 indexed id,address indexed executor,address indexed token,bool sell,uint256 amountIn,uint256 amountOut,uint256 tip)')
const BOUGHT = parseAbiItem('event Bought(address indexed index,address indexed buyer,address indexed to,uint256 shares,uint256 usdgIn,uint256 fee)')
const SOLD = parseAbiItem('event Sold(address indexed index,address indexed seller,address indexed to,uint256 shares,uint256 usdgOut,uint256 fee)')
const COUNT_ABI = [
  { type: 'function', name: 'planCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'orderCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'vaultCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'mandateCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const
const usdg = (v: bigint) => Number(formatUnits(v, 6))

// Swaps and bridges made through Verdex, from the aggregator's public record for the integrator name. The
// endpoint answers at most 90 days without a wallet filter, so this is "the last 89 days".
export async function readVolume(): Promise<Volume> {
  const since = Math.floor(Date.now() / 1000) - 89 * 86_400
  const r = await fetch(`${LIFI}/analytics/transfers?integrator=verdex&fromTimestamp=${since}`)
  if (!r.ok) throw new Error(`analytics ${r.status}`)
  const j = (await r.json()) as { transfers?: { status: string; tool: string; sending: { chainId: number; amountUSD?: string; timestamp?: number; txLink?: string; txHash?: string }; lifiExplorerLink?: string }[] }
  const done = (j.transfers ?? []).filter((x) => x.status === 'DONE')
  const byChain = new Map<number, { usd: number; count: number }>()
  for (const x of done) { const c = byChain.get(x.sending.chainId) ?? { usd: 0, count: 0 }; c.usd += Number(x.sending.amountUSD ?? 0); c.count++; byChain.set(x.sending.chainId, c) }
  const recent = done.map((x) => ({ link: x.sending.txLink ?? (x.sending.txHash ? txLink(x.sending.chainId, x.sending.txHash) : x.lifiExplorerLink ?? ''), usd: Number(x.sending.amountUSD ?? 0), at: (x.sending.timestamp ?? 0) * 1000, tool: x.tool, chainId: x.sending.chainId })).filter((x) => x.link).sort((a, b) => b.at - a.at)
  return { usd: done.reduce((s, x) => s + Number(x.sending.amountUSD ?? 0), 0), count: done.length, byChain: [...byChain.entries()].map(([chainId, v]) => ({ chainId, ...v })).sort((a, b) => b.usd - a.usd), recent, since: since * 1000 }
}

// Buys and sells through the Index routers, on Robinhood Chain and on Base.
export async function readIndexTrades(): Promise<IndexTrades> {
  const out: IndexTrades = { buys: 0, sells: 0, usdg: 0, feesUsdg: 0, recent: [] }
  for (const ic of [ROBINHOOD_INDEX, BASE_INDEX] as IndexChain[]) {
    if (!ic.deployed) continue
    const c = clientFor(ic)
    const head = await c.getBlockNumber().catch(() => 0n)
    if (!head) continue
    const back = ic.id === ROBINHOOD ? LOOKBACK : BASE_LOOKBACK
    const from = head > back ? head - back : 0n
    const logs = ic.id === ROBINHOOD ? chunked : <T,>(a: bigint, z: bigint, fn: (x: bigint, y: bigint) => Promise<T[]>) => windowed(a, z, BASE_WINDOW, fn)
    const [b, s] = await Promise.all([
      logs(from, head, (x, y) => c.getLogs({ address: ic.router, event: BOUGHT, fromBlock: x, toBlock: y })),
      logs(from, head, (x, y) => c.getLogs({ address: ic.router, event: SOLD, fromBlock: x, toBlock: y })),
    ])
    out.buys += b.length
    out.sells += s.length
    for (const l of b) { out.usdg += usdg(l.args.usdgIn ?? 0n); out.feesUsdg += usdg(l.args.fee ?? 0n); out.recent.push({ chainId: ic.id, hash: l.transactionHash, block: Number(l.blockNumber), label: `Index buy, ${ic.name}`, usd: usdg(l.args.usdgIn ?? 0n) }) }
    for (const l of s) { out.usdg += usdg(l.args.usdgOut ?? 0n); out.feesUsdg += usdg(l.args.fee ?? 0n); out.recent.push({ chainId: ic.id, hash: l.transactionHash, block: Number(l.blockNumber), label: `Index sell, ${ic.name}`, usd: usdg(l.args.usdgOut ?? 0n) }) }
  }
  out.recent.sort((a, b) => b.block - a.block)
  return out
}

// The four contracts that work without you: how many plans, orders, vaults and mandates exist, and every
// execution the executor (or an owner) has made, from the contracts' events.
export async function readWithoutYou(): Promise<WithoutYou> {
  const c = client()
  const out: WithoutYou = { plans: 0, buys: 0, buysUsdg: 0, orders: 0, fills: 0, vaults: 0, runs: 0, mandates: 0, trades: 0, recent: [] }
  const counts = await c.multicall({ multicallAddress: MULTICALL3, contracts: [
    { address: AUTOINVEST, abi: COUNT_ABI, functionName: 'planCount' },
    { address: ORDERS, abi: COUNT_ABI, functionName: 'orderCount' },
    { address: VAULTS, abi: COUNT_ABI, functionName: 'vaultCount' },
    { address: AGENT, abi: COUNT_ABI, functionName: 'mandateCount' },
  ] })
  const n = (k: number) => (counts[k].status === 'success' ? Number(counts[k].result) : 0)
  out.plans = AUTOINVEST_DEPLOYED ? n(0) : 0
  out.orders = ORDERS_DEPLOYED ? n(1) : 0
  out.vaults = VAULTS_DEPLOYED ? n(2) : 0
  out.mandates = AGENT_DEPLOYED ? n(3) : 0
  const head = await c.getBlockNumber()
  const from = head > LOOKBACK ? head - LOOKBACK : 0n
  const [ex, fi, re, tr] = await Promise.all([
    AUTOINVEST_DEPLOYED ? chunked(from, head, (x, y) => c.getLogs({ address: AUTOINVEST, event: EXECUTED, fromBlock: x, toBlock: y })) : Promise.resolve([]),
    ORDERS_DEPLOYED ? chunked(from, head, (x, y) => c.getLogs({ address: ORDERS, event: FILLED, fromBlock: x, toBlock: y })) : Promise.resolve([]),
    VAULTS_DEPLOYED ? chunked(from, head, (x, y) => c.getLogs({ address: VAULTS, event: REBALANCED, fromBlock: x, toBlock: y })) : Promise.resolve([]),
    AGENT_DEPLOYED ? chunked(from, head, (x, y) => c.getLogs({ address: AGENT, event: TRADED, fromBlock: x, toBlock: y })) : Promise.resolve([]),
  ])
  out.buys = ex.length
  out.buysUsdg = ex.reduce((s, l) => s + usdg(l.args.amountIn ?? 0n), 0)
  out.fills = fi.length
  out.runs = re.length
  out.trades = tr.length
  for (const l of ex) out.recent.push({ chainId: ROBINHOOD, hash: l.transactionHash, block: Number(l.blockNumber), label: `Auto-Invest buy, plan #${l.args.id}`, usd: usdg(l.args.amountIn ?? 0n) })
  for (const l of fi) out.recent.push({ chainId: ROBINHOOD, hash: l.transactionHash, block: Number(l.blockNumber), label: `Order filled, #${l.args.id}` })
  for (const l of re) out.recent.push({ chainId: ROBINHOOD, hash: l.transactionHash, block: Number(l.blockNumber), label: `Vault rebalanced, #${l.args.id}`, usd: usdg(l.args.totalUsdg ?? 0n) })
  for (const l of tr) out.recent.push({ chainId: ROBINHOOD, hash: l.transactionHash, block: Number(l.blockNumber), label: `Agent ${l.args.sell ? 'sale' : 'buy'}, mandate #${l.args.id}` })
  out.recent.sort((a, b) => b.block - a.block)
  return out
}

export async function readNumbers(): Promise<Numbers> {
  const [volume, indexTrades, treasury, withoutYou] = await Promise.all([
    readVolume().catch(() => ({ usd: 0, count: 0, byChain: [], recent: [], since: 0 }) as Volume),
    readIndexTrades().catch(() => ({ buys: 0, sells: 0, usdg: 0, feesUsdg: 0, recent: [] }) as IndexTrades),
    TREASURY_DEPLOYED ? readTreasury().catch(() => null) : Promise.resolve(null),
    readWithoutYou().catch(() => ({ plans: 0, buys: 0, buysUsdg: 0, orders: 0, fills: 0, vaults: 0, runs: 0, mandates: 0, trades: 0, recent: [] }) as WithoutYou),
  ])
  return { volume, indexTrades, treasury, withoutYou }
}
export function useNumbers() {
  return useQuery({ queryKey: ['verdex-numbers'], queryFn: readNumbers, staleTime: 60_000, refetchInterval: 120_000, retry: 1 })
}
// The contracts, for the list at the bottom: every one is on Robinhood Chain unless it says otherwise.
export const CONTRACTS: { name: string; address: Address | undefined; chainId: number; source: string; page: string }[] = [
  { name: 'Index factory', address: ROBINHOOD_INDEX.deployed ? ROBINHOOD_INDEX.factory : undefined, chainId: ROBINHOOD, source: 'VerdexIndex.sol', page: '/index' },
  { name: 'Index router', address: ROBINHOOD_INDEX.deployed ? ROBINHOOD_INDEX.router : undefined, chainId: ROBINHOOD, source: 'VerdexIndexRouter.sol', page: '/index' },
  { name: 'Index factory, Base', address: BASE_INDEX.deployed ? BASE_INDEX.factory : undefined, chainId: 8453, source: 'VerdexIndex.sol', page: '/index?chain=base' },
  { name: 'Index router, Base', address: BASE_INDEX.deployed ? BASE_INDEX.router : undefined, chainId: 8453, source: 'VerdexIndexRouterCL.sol', page: '/index?chain=base' },
  { name: 'Treasury', address: TREASURY_DEPLOYED ? TREASURY : undefined, chainId: ROBINHOOD, source: 'VerdexTreasury.sol', page: '/treasury' },
  { name: 'Auto-Invest without you', address: AUTOINVEST_DEPLOYED ? AUTOINVEST : undefined, chainId: ROBINHOOD, source: 'VerdexAutoInvest.sol', page: '/auto-invest/without-you' },
  { name: 'Orders without you', address: ORDERS_DEPLOYED ? ORDERS : undefined, chainId: ROBINHOOD, source: 'VerdexOrders.sol', page: '/orders/without-you' },
  { name: 'Vaults without you', address: VAULTS_DEPLOYED ? VAULTS : undefined, chainId: ROBINHOOD, source: 'VerdexVaults.sol', page: '/vaults/without-you' },
  { name: 'Agent without you', address: AGENT_DEPLOYED ? AGENT : undefined, chainId: ROBINHOOD, source: 'VerdexAgent.sol', page: '/agent/without-you' },
]
