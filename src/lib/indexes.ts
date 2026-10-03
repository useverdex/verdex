// Verdex Index: baskets of tokenized stocks as one ERC-20 each. An index holds a fixed number of units of
// every component per share (contracts/VerdexIndex.sol); the router (contracts/VerdexIndexRouter.sol) buys
// those units with USDG in the stocks' Uniswap v3 pools and issues the shares in one transaction, or
// redeems and sells them back. This module reads the indexes, prices them from the pools, builds the
// transactions and holds the templates the deploy page creates from.
import { useQuery } from '@tanstack/react-query'
import { encodeDeployData, encodeFunctionData, erc20Abi, formatUnits, isAddress, parseAbi, type Address, type ContractFunctionParameters } from 'viem'
import factoryArtifact from '../../contracts/VerdexIndexFactory.json'
import routerArtifact from '../../contracts/VerdexIndexRouter.json'
import { INDEX_FACTORY_ADDRESS as F0, INDEX_ROUTER_ADDRESS as R0 } from '../../scripts/index-addresses.mjs'
import type { Asset } from './api'
import { ROBINHOOD } from './api'
import { VERDEX_TOKEN } from './holding'
import { waitForTx } from './lifi'
import { deepEnough, poolFor } from './autopilot'
import { FACTORY as V3_FACTORY, MULTICALL3, USDG, client, ensureChain, sendTx, stockTokens, type Pool, type StockToken, type TxCtx } from './pools'

const env = (k: string) => String((import.meta.env as Record<string, string | undefined>)[k] ?? '').trim()
export const FACTORY_ADDRESS = (env('VITE_INDEX_FACTORY_ADDRESS') || F0).trim()
export const ROUTER_ADDRESS = (env('VITE_INDEX_ROUTER_ADDRESS') || R0).trim()
export const DEPLOYED = isAddress(FACTORY_ADDRESS) && isAddress(ROUTER_ADDRESS)
const ZERO = '0x0000000000000000000000000000000000000000' as Address
export const FACTORY = (isAddress(FACTORY_ADDRESS) ? FACTORY_ADDRESS : ZERO) as Address
export const ROUTER = (isAddress(ROUTER_ADDRESS) ? ROUTER_ADDRESS : ZERO) as Address
export const DEAD = '0x000000000000000000000000000000000000dEaD' as Address

export const factoryAbi = parseAbi([
  'function create(string name,string symbol,address[] tokens,uint256[] units,uint256 maxSupply) returns (address)',
  'function all() view returns (address[])',
  'function count() view returns (uint256)',
  'function isIndex(address) view returns (bool)',
  'event IndexCreated(address indexed index,address indexed creator,string name,string symbol,address[] tokens,uint256[] units,uint256 maxSupply)',
])
export const indexAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function components() view returns (address[] tokens,uint256[] units)',
  'function amountsIn(uint256 shares) view returns (uint256[])',
  'function amountsOut(uint256 shares) view returns (uint256[])',
  'function issue(uint256 shares,address to)',
  'function redeem(uint256 shares,address to)',
  'function approve(address spender,uint256 value) returns (bool)',
  'function setMaxSupply(uint256 maxSupply_)',
])
export const routerAbi = parseAbi([
  'constructor(address factory_,address usdg_,address verdex_,address treasury_,uint16 feeBps_)',
  'function spotIn(address index,uint256 shares,uint24[] fees) view returns (uint256 total,uint256[] perLeg)',
  'function spotOut(address index,uint256 shares,uint24[] fees) view returns (uint256 total,uint256[] perLeg)',
  'function buy(address index,uint256 shares,uint256 maxIn,uint24[] fees,uint256[] maxInPerLeg,address to) returns (uint256)',
  'function sell(address index,uint256 shares,uint256 minOut,uint24[] fees,uint256[] minOutPerLeg,address to) returns (uint256)',
  'function feeBps() view returns (uint16)',
  'function treasury() view returns (address)',
  'function owner() view returns (address)',
  'event Bought(address indexed index,address indexed buyer,address indexed to,uint256 shares,uint256 usdgIn,uint256 fee)',
  'event Sold(address indexed index,address indexed seller,address indexed to,uint256 shares,uint256 usdgOut,uint256 fee)',
])
export const FACTORY_BYTECODE = factoryArtifact.bytecode as `0x${string}`
export const ROUTER_BYTECODE = routerArtifact.bytecode as `0x${string}`
export const DEFAULT_FEE_BPS = 25
export const DEFAULT_SLIPPAGE_BPS = 100
export const DEFAULT_CAP = 25_000n * 10n ** 18n
const ONE = 10n ** 18n

// The indexes Verdex creates at launch: equal value per component, one share worth one USDG at creation.
export const TEMPLATES: { name: string; symbol: string; tickers: string[]; blurb: string }[] = [
  { name: 'Verdex Magnificent Seven', symbol: 'VX7', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'], blurb: 'The seven, equal weight at creation.' },
  { name: 'Verdex AI Infrastructure', symbol: 'VXAI', tickers: ['NVDA', 'MU', 'AMD', 'TSM', 'INTC', 'MSFT', 'GOOGL', 'AMZN'], blurb: 'The chips, the memory, the foundry and the clouds that rent them.' },
  { name: 'Verdex Semis', symbol: 'VXSEMI', tickers: ['NVDA', 'MU', 'AMD', 'TSM', 'INTC'], blurb: 'The chip stack and nothing else.' },
  { name: 'Verdex Frontier', symbol: 'VXFRONT', tickers: ['SPCX', 'CRCL', 'MSTR', 'PLTR', 'RDDT'], blurb: 'SpaceX, Circle, Strategy, Palantir, Reddit.' },
]

export type IndexComponent = { token: Address; units: bigint; stock?: StockToken; pool?: Pool; priceUsd: number; valueUsd: number; weight: number }
export type IndexInfo = {
  address: Address
  name: string
  symbol: string
  totalSupply: bigint
  maxSupply: bigint
  owner: Address
  components: IndexComponent[]
  navUsd: number // one share, from the pools' spot prices
  tvlUsd: number
  fees: number[] // the fee tier of the deepest USDG pool per component
  tradable: boolean // every component has a deep enough USDG pool
}

const lc = (a: string) => a.toLowerCase()

export async function readIndexes(assets: Asset[], pools: Pool[]): Promise<IndexInfo[]> {
  if (!DEPLOYED) return []
  const c = client()
  const list = await c.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'all' })
  if (list.length === 0) return []
  const stocks = stockTokens(assets)
  const byAddr = new Map(stocks.map((s) => [lc(s.address), s]))
  const res = await c.multicall({
    multicallAddress: MULTICALL3,
    batchSize: 4096,
    contracts: list.flatMap((address) => [
      { address, abi: indexAbi, functionName: 'name' as const },
      { address, abi: indexAbi, functionName: 'symbol' as const },
      { address, abi: indexAbi, functionName: 'totalSupply' as const },
      { address, abi: indexAbi, functionName: 'maxSupply' as const },
      { address, abi: indexAbi, functionName: 'owner' as const },
      { address, abi: indexAbi, functionName: 'components' as const },
    ]),
  })
  return list.map((address, i) => {
    const at = <T,>(k: number, fallback: T): T => (res[i * 6 + k].status === 'success' ? (res[i * 6 + k].result as T) : fallback)
    const [tokens, units] = at<readonly [readonly Address[], readonly bigint[]]>(5, [[], []])
    const components: IndexComponent[] = tokens.map((token, k) => {
      const stock = byAddr.get(lc(token))
      const pool = stock ? poolFor(stock, pools) : undefined
      const priceUsd = pool?.priceUsd ?? 0
      const valueUsd = (Number(formatUnits(units[k], stock?.decimals ?? 18)) * priceUsd)
      return { token, units: units[k], stock, pool, priceUsd, valueUsd, weight: 0 }
    })
    const navUsd = components.reduce((s, x) => s + x.valueUsd, 0)
    for (const x of components) x.weight = navUsd > 0 ? x.valueUsd / navUsd : 0
    const totalSupply = at<bigint>(2, 0n)
    return {
      address,
      name: at<string>(0, 'Index'),
      symbol: at<string>(1, '?'),
      totalSupply,
      maxSupply: at<bigint>(3, 0n),
      owner: at<Address>(4, ZERO),
      components,
      navUsd,
      tvlUsd: navUsd * Number(formatUnits(totalSupply, 18)),
      fees: components.map((x) => x.pool?.fee ?? 0),
      tradable: components.length > 0 && components.every((x) => deepEnough(x.pool)),
    }
  })
}
export function useIndexes(assets: Asset[] | undefined, pools: Pool[] | undefined) {
  return useQuery({ queryKey: ['indexes', pools?.length ?? 0], queryFn: () => readIndexes(assets!, pools!), enabled: DEPLOYED && !!assets && !!pools, staleTime: 30_000, refetchInterval: 60_000, retry: 1 })
}

export type IndexWallet = { shares: Record<string, bigint>; usdg: bigint; usdgAllowance: bigint; verdex: bigint; feeBps: number }
export async function readWallet(owner: Address, indexes: Address[]): Promise<IndexWallet> {
  const c = client()
  const contracts: ContractFunctionParameters[] = [
    { address: USDG.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
    { address: USDG.address, abi: erc20Abi, functionName: 'allowance', args: [owner, ROUTER] },
    { address: VERDEX_TOKEN.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
    { address: ROUTER, abi: routerAbi, functionName: 'feeBps' },
    ...indexes.map((address): ContractFunctionParameters => ({ address, abi: indexAbi, functionName: 'balanceOf', args: [owner] })),
  ]
  const res = await c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts })
  const v = (k: number) => (res[k].status === 'success' ? (res[k].result as bigint) : 0n)
  const shares: Record<string, bigint> = {}
  indexes.forEach((a, i) => (shares[lc(a)] = v(4 + i)))
  return { shares, usdg: v(0), usdgAllowance: v(1), verdex: v(2), feeBps: Number(v(3)) }
}
export function useIndexWallet(owner: Address | undefined, indexes: Address[] | undefined) {
  return useQuery({ queryKey: ['index-wallet', owner?.toLowerCase(), indexes?.length ?? 0], queryFn: () => readWallet(owner!, indexes!), enabled: DEPLOYED && !!owner && !!indexes, staleTime: 10_000, retry: 1 })
}

// Spot quotes from the router: what the pools would charge or pay with no price impact.
export async function quoteBuy(index: IndexInfo, shares: bigint) {
  const [total, perLeg] = await client().readContract({ address: ROUTER, abi: routerAbi, functionName: 'spotIn', args: [index.address, shares, index.fees] })
  return { total, perLeg: [...perLeg] }
}
export async function quoteSell(index: IndexInfo, shares: bigint) {
  const [total, perLeg] = await client().readContract({ address: ROUTER, abi: routerAbi, functionName: 'spotOut', args: [index.address, shares, index.fees] })
  return { total, perLeg: [...perLeg] }
}
export function useQuote(index: IndexInfo | undefined, shares: bigint, side: 'buy' | 'sell') {
  return useQuery({
    queryKey: ['index-quote', index?.address, side, shares.toString(), index?.fees.join(',')],
    queryFn: () => (side === 'buy' ? quoteBuy(index!, shares) : quoteSell(index!, shares)),
    enabled: DEPLOYED && !!index && index.tradable && shares > 0n,
    staleTime: 15_000,
    retry: 1,
  })
}

// Shares a USDG amount buys at the index's spot NAV, rounded to the share's 18 decimals.
export function sharesFor(index: IndexInfo, usdg: bigint): bigint {
  if (index.navUsd <= 0) return 0n
  const usd = Number(formatUnits(usdg, USDG.decimals))
  return BigInt(Math.floor((usd / index.navUsd) * 1e6)) * 10n ** 12n
}

async function approveExact(ctx: TxCtx, token: Address, spender: Address, amount: bigint) {
  ctx.onPhase('approving')
  const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] }) })
  await waitForTx(ctx.chain ?? ({ id: ROBINHOOD } as never), hash)
}

// Buy: approve exactly what the router may pull (spot plus slippage plus the fee), then one transaction.
export async function buyIndex(ctx: TxCtx, index: IndexInfo, shares: bigint, quote: { total: bigint; perLeg: bigint[] }, slippageBps: number, feeBps: number) {
  await ensureChain(ctx)
  const maxLeg = quote.perLeg.map((v) => (v * BigInt(10_000 + slippageBps)) / 10_000n)
  const maxIn = (quote.total * BigInt(10_000 + slippageBps + feeBps)) / 10_000n + 1n
  const allowance = await client().readContract({ address: USDG.address, abi: erc20Abi, functionName: 'allowance', args: [ctx.account.address, ROUTER] })
  if (allowance < maxIn) await approveExact(ctx, USDG.address, ROUTER, maxIn)
  const data = encodeFunctionData({ abi: routerAbi, functionName: 'buy', args: [index.address, shares, maxIn, index.fees, maxLeg, ctx.account.address] })
  return sendTx(ctx, ROUTER, data)
}
// Sell: approve exactly the shares, then one transaction that redeems and sells every leg.
export async function sellIndex(ctx: TxCtx, index: IndexInfo, shares: bigint, quote: { total: bigint; perLeg: bigint[] }, slippageBps: number, feeBps: number) {
  await ensureChain(ctx)
  const minLeg = quote.perLeg.map((v) => (v * BigInt(10_000 - slippageBps)) / 10_000n)
  const minOut = (quote.total * BigInt(10_000 - slippageBps - feeBps)) / 10_000n
  const allowance = await client().readContract({ address: index.address, abi: indexAbi, functionName: 'allowance', args: [ctx.account.address, ROUTER] })
  if (allowance < shares) await approveExact(ctx, index.address, ROUTER, shares)
  const data = encodeFunctionData({ abi: routerAbi, functionName: 'sell', args: [index.address, shares, minOut, index.fees, minLeg, ctx.account.address] })
  return sendTx(ctx, ROUTER, data)
}
// Redeem in kind: the stocks themselves, straight from the index, no pool and no fee.
export async function redeemIndex(ctx: TxCtx, index: IndexInfo, shares: bigint) {
  await ensureChain(ctx)
  return sendTx(ctx, index.address, encodeFunctionData({ abi: indexAbi, functionName: 'redeem', args: [shares, ctx.account.address] }))
}

// ----- Deploy page -----

export type TemplatePlan = { name: string; symbol: string; tokens: Address[]; units: bigint[]; legs: { ticker: string; priceUsd: number; units: bigint; fee: number; liquidityUsd: number }[]; missing: string[] }
// Units per share for an equal-value basket worth one USDG per share at today's pool prices.
export function planTemplate(tpl: (typeof TEMPLATES)[number], stocks: StockToken[], pools: Pool[]): TemplatePlan {
  const n = tpl.tickers.length
  const legs: TemplatePlan['legs'] = []
  const missing: string[] = []
  for (const ticker of tpl.tickers) {
    const stock = stocks.find((s) => s.ticker === ticker)
    const pool = stock ? poolFor(stock, pools) : undefined
    if (!stock || !deepEnough(pool) || !pool) { missing.push(ticker); continue }
    const units = BigInt(Math.round(((1 / n) / pool.priceUsd) * 10 ** stock.decimals))
    legs.push({ ticker, priceUsd: pool.priceUsd, units, fee: pool.fee, liquidityUsd: pool.liquidityUsd })
  }
  return { name: tpl.name, symbol: tpl.symbol, tokens: legs.map((l) => stocks.find((s) => s.ticker === l.ticker)!.address), units: legs.map((l) => l.units), legs, missing }
}
export async function deployFactory(ctx: TxCtx) {
  await ensureChain(ctx)
  ctx.onPhase('confirming')
  const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, data: encodeDeployData({ abi: factoryAbi, bytecode: FACTORY_BYTECODE }) })
  ctx.onPhase('pending')
  const receipt = await client().waitForTransactionReceipt({ hash, timeout: 120_000 })
  ctx.onPhase('done')
  return { hash, address: receipt.contractAddress as Address }
}
export async function deployRouter(ctx: TxCtx, treasury: Address, feeBps: number) {
  await ensureChain(ctx)
  ctx.onPhase('confirming')
  const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, data: encodeDeployData({ abi: routerAbi, bytecode: ROUTER_BYTECODE, args: [V3_FACTORY, USDG.address, VERDEX_TOKEN.address, treasury, feeBps] }) })
  ctx.onPhase('pending')
  const receipt = await client().waitForTransactionReceipt({ hash, timeout: 120_000 })
  ctx.onPhase('done')
  return { hash, address: receipt.contractAddress as Address }
}
export async function createIndex(ctx: TxCtx, factory: Address, plan: TemplatePlan, cap: bigint) {
  await ensureChain(ctx)
  return sendTx(ctx, factory, encodeFunctionData({ abi: factoryAbi, functionName: 'create', args: [plan.name, plan.symbol, plan.tokens, plan.units, cap] }))
}

export const fmtShares = (v: bigint, d = 2) => Number(formatUnits(v, 18)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtUsdg = (v: bigint, d = 2) => `$${Number(formatUnits(v, USDG.decimals)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
export const ONE_SHARE = ONE
