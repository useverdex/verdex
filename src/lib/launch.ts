// Verdex Launchpad: launch a token on Robinhood Chain through the Pons V2 contracts, the same
// verified contracts that created VERDEX. A launch mints a fixed supply, opens a bonding curve quoted
// in ETH, USDG or a tokenized stock, and graduates into a Uniswap v4 pool with locked liquidity once
// the curve raises its threshold. The creator names a fee that the Pons hook charges on every trade,
// forever. Verdex adds no contract and takes no fee; the launch fee is Pons's own, read live.
import { useQuery } from '@tanstack/react-query'
import { decodeEventLog, encodeFunctionData, erc20Abi, formatUnits, parseAbi, parseAbiItem, toHex, type Address, type Hex, type PublicClient } from 'viem'
import type { Asset } from './api'
import { MULTICALL3, USDG, approveIfNeeded, client, ensureChain, sendTx, stockTokens, type StockToken, type TxCtx } from './pools'
import { readEthUsd } from './token'

export const PONS = {
  factory: '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e' as Address,
  router: '0xe33e9e479df8802cb0866d5d05258bec4cf62948' as Address,
  hook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044' as Address,
  locker: '0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952' as Address,
}
export const EXPLORER = 'https://robin.etherscan.io'
export const ZERO = '0x0000000000000000000000000000000000000000' as Address
export const LAUNCH_CONFIG = 0n
const BLOCKS_PER_DAY = 864_000n // 0.1 s blocks
const FEED_BLOCKS = 36_000n // the last hour or so

const factoryAbi = parseAbi([
  'function launchFee() view returns (uint256)',
  'function maxCreatorTaxBps() view returns (uint256)',
  'function launchEnabled() view returns (bool)',
  'function canLaunch(address) view returns (bool)',
  'function snipeTaxSeconds() view returns (uint256)',
  'function snipeTaxStartBps() view returns (uint256)',
  'function approvedPairTokens(address) view returns (bool)',
  'function pairTokenEconomics(address) view returns (uint256 phantomQuote, uint256 graduationThreshold, uint8 decimals)',
  'function getLaunchConfig(uint256) view returns ((uint256 supply,uint256 curveFeeBps,uint256 phantomQuote,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,bool enabled))',
  'function previewLaunchEconomics(uint256,address) view returns (bytes32)',
  'function getLaunchedToken(address) view returns ((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))',
  'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
  'event PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)',
])
const launchedEvent = parseAbiItem('event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)')
const graduatedEvent = parseAbiItem('event PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)')
const routerAbi = parseAbi([
  'function launchAndBuy((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken,uint256 quoteIn,uint256 minTokensOut,address recipient,address[] snipeTaxExemptions) payable returns (address token,address curve,uint256 tokensOut)',
])
const curveAbi = parseAbi(['function realQuoteReserve() view returns (uint256)', 'function readyToGraduate() view returns (bool)'])
const infoAbi = parseAbi(['function getTokenInfo() view returns (address tokenDeployer,string tokenLogo,string tokenDescription,(string twitter,string telegram,string discord,string website,string farcaster) tokenSocials)'])

export type Quote = { address: Address; symbol: string; name: string; decimals: number; logo?: string; phantom: number; threshold: number; usd: number }
export type Launchpad = {
  enabled: boolean
  launchFee: bigint
  launchFeeEth: number
  maxCreatorTaxBps: number
  curveFeeBps: number
  supply: number
  snipeSeconds: number
  snipeStartBps: number
  quotes: Quote[]
  launches24h: number
  graduated24h: number
  ethUsd: number
}
export type Launch = {
  token: Address
  curve: Address
  deployer: Address
  pairToken: Address
  quote: Quote | null
  name: string
  symbol: string
  logo: string
  description: string
  website: string
  twitter: string
  creatorTaxBps: number
  phase: number // 0 on the curve, 1 ready, 2 graduated
  graduated: boolean
  raised: number // quote on the curve, in the quote's units
  threshold: number
  progress: number // 0 to 1
  block: bigint
  ageSec: number
}

const lc = (a: string) => a.toLowerCase()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// getLogs with the RPC's limits: windows that return too many logs, or that the node refuses, are
// split in half; a rate limit waits and retries.
async function logsOf<T>(fetchLogs: (from: bigint, to: bigint) => Promise<T[]>, from: bigint, to: bigint): Promise<T[]> {
  try {
    return await fetchLogs(from, to)
  } catch (e) {
    const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? ''
    if (/429|Too Many|rate/i.test(m)) {
      await sleep(1500)
      return logsOf(fetchLogs, from, to)
    }
    if (to - from < 500n) throw e
    const mid = from + (to - from) / 2n
    const a = await logsOf(fetchLogs, from, mid)
    const b = await logsOf(fetchLogs, mid + 1n, to)
    return [...a, ...b]
  }
}
const launchedLogs = (c: PublicClient, from: bigint, to: bigint, deployer?: Address) => logsOf((f, t) => c.getLogs({ address: PONS.factory, event: launchedEvent, args: deployer ? { deployer } : undefined, fromBlock: f, toBlock: t }), from, to)
const graduatedLogs = (c: PublicClient, from: bigint, to: bigint) => logsOf((f, t) => c.getLogs({ address: PONS.factory, event: graduatedEvent, fromBlock: f, toBlock: t }), from, to)

// The launchpad's terms and every quote asset it accepts among the ones Verdex lists, read live.
export async function readLaunchpad(assets: Asset[]): Promise<Launchpad> {
  const c = client()
  const stocks = stockTokens(assets)
  const cands: { address: Address; symbol: string; name: string; decimals: number; logo?: string }[] = [{ ...USDG, name: 'USDG' }, ...stocks.map((s: StockToken) => ({ address: s.address, symbol: s.ticker, name: s.name, decimals: s.decimals, logo: s.logo }))]
  const [base, approved, ethUsd, head] = await Promise.all([
    c.multicall({
      multicallAddress: MULTICALL3,
      contracts: [
        { address: PONS.factory, abi: factoryAbi, functionName: 'launchEnabled' },
        { address: PONS.factory, abi: factoryAbi, functionName: 'launchFee' },
        { address: PONS.factory, abi: factoryAbi, functionName: 'maxCreatorTaxBps' },
        { address: PONS.factory, abi: factoryAbi, functionName: 'getLaunchConfig', args: [LAUNCH_CONFIG] },
        { address: PONS.factory, abi: factoryAbi, functionName: 'snipeTaxSeconds' },
        { address: PONS.factory, abi: factoryAbi, functionName: 'snipeTaxStartBps' },
      ],
    }),
    c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts: cands.flatMap((q) => [{ address: PONS.factory, abi: factoryAbi, functionName: 'approvedPairTokens' as const, args: [q.address] as const }, { address: PONS.factory, abi: factoryAbi, functionName: 'pairTokenEconomics' as const, args: [q.address] as const }]) }),
    readEthUsd().catch(() => 0),
    c.getBlockNumber(),
  ])
  const ok = <T,>(i: number, fallback: T): T => (base[i].status === 'success' ? (base[i].result as T) : fallback)
  const cfg = ok<{ supply: bigint; curveFeeBps: bigint; phantomQuote: bigint; graduationThreshold: bigint }>(3, { supply: 10n ** 27n, curveFeeBps: 100n, phantomQuote: 0n, graduationThreshold: 0n })
  const priceOf = new Map<string, number>()
  for (const a of assets) for (const tk of a.tokens) priceOf.set(lc(tk.address), tk.price || a.price)
  const quotes: Quote[] = [{ address: ZERO, symbol: 'ETH', name: 'Ether', decimals: 18, phantom: Number(formatUnits(cfg.phantomQuote, 18)), threshold: Number(formatUnits(cfg.graduationThreshold, 18)), usd: ethUsd }]
  cands.forEach((q, i) => {
    const ap = approved[i * 2], ec = approved[i * 2 + 1]
    if (ap.status !== 'success' || !ap.result || ec.status !== 'success') return
    const [phantom, threshold, dec] = ec.result as unknown as [bigint, bigint, number]
    const d = dec || q.decimals
    quotes.push({ ...q, phantom: Number(formatUnits(phantom, d)), threshold: Number(formatUnits(threshold, d)), usd: lc(q.address) === lc(USDG.address) ? 1 : (priceOf.get(lc(q.address)) ?? 0) })
  })
  let launches24h = 0, graduated24h = 0
  try {
    const [l, g] = await Promise.all([launchedLogs(c, head - BLOCKS_PER_DAY, head), graduatedLogs(c, head - BLOCKS_PER_DAY, head)])
    launches24h = l.length
    graduated24h = g.length
  } catch {
    /* the counters stay at 0 and the page says so */
  }
  const launchFee = ok<bigint>(1, 500_000_000_000_000n)
  return { enabled: ok<boolean>(0, true), launchFee, launchFeeEth: Number(formatUnits(launchFee, 18)), maxCreatorTaxBps: Number(ok<bigint>(2, 1000n)), curveFeeBps: Number(cfg.curveFeeBps), supply: Number(formatUnits(cfg.supply, 18)), snipeSeconds: Number(ok<bigint>(4, 15n)), snipeStartBps: Number(ok<bigint>(5, 9900n)), quotes, launches24h, graduated24h, ethUsd }
}
export function useLaunchpad(assets: Asset[] | undefined) {
  return useQuery({ queryKey: ['launchpad', assets?.length ?? 0], queryFn: () => readLaunchpad(assets!), enabled: !!assets, staleTime: 60_000, refetchInterval: 120_000, retry: 2 })
}

// Fills in each launched token: its record on the factory, name and symbol, the curve's progress
// and the metadata the token stores onchain.
async function hydrate(c: PublicClient, rows: { token: Address; curve: Address; deployer: Address; pairToken: Address; block: bigint }[], quotes: Quote[], head: bigint): Promise<Launch[]> {
  if (!rows.length) return []
  const r = await c.multicall({
    multicallAddress: MULTICALL3,
    batchSize: 4096,
    contracts: rows.flatMap((x) => [
      { address: PONS.factory, abi: factoryAbi, functionName: 'getLaunchedToken' as const, args: [x.token] as const },
      { address: x.token, abi: erc20Abi, functionName: 'name' as const },
      { address: x.token, abi: erc20Abi, functionName: 'symbol' as const },
      { address: x.curve, abi: curveAbi, functionName: 'realQuoteReserve' as const },
      { address: x.token, abi: infoAbi, functionName: 'getTokenInfo' as const },
    ]),
  })
  const byAddr = new Map(quotes.map((q) => [lc(q.address), q]))
  return rows.map((x, i) => {
    const rec = r[i * 5], nm = r[i * 5 + 1], sy = r[i * 5 + 2], rq = r[i * 5 + 3], inf = r[i * 5 + 4]
    const quote = byAddr.get(lc(x.pairToken)) ?? null
    const dec = quote?.decimals ?? 18
    const d = rec.status === 'success' ? (rec.result as { graduationThreshold: bigint; creatorTaxBps: number; phase: number }) : null
    const threshold = d ? Number(formatUnits(d.graduationThreshold, dec)) : quote?.threshold ?? 0
    const raised = rq.status === 'success' ? Number(formatUnits(rq.result as bigint, dec)) : 0
    const info = inf.status === 'success' ? (inf.result as unknown as [Address, string, string, { twitter: string; website: string }]) : null
    const phase = d?.phase ?? 0
    return {
      token: x.token,
      curve: x.curve,
      deployer: x.deployer,
      pairToken: x.pairToken,
      quote,
      name: nm.status === 'success' ? (nm.result as string) : 'Token',
      symbol: sy.status === 'success' ? (sy.result as string) : '?',
      logo: info?.[1] ?? '',
      description: info?.[2] ?? '',
      twitter: info?.[3]?.twitter ?? '',
      website: info?.[3]?.website ?? '',
      creatorTaxBps: d?.creatorTaxBps ?? 0,
      phase,
      graduated: phase >= 2,
      raised,
      threshold,
      progress: phase >= 2 ? 1 : threshold > 0 ? Math.min(1, raised / threshold) : 0,
      block: x.block,
      ageSec: Number(head - x.block) / 10,
    }
  })
}
const fromLog = (l: { args: { token?: Address; curve?: Address; deployer?: Address; pairToken?: Address }; blockNumber: bigint }) => ({ token: l.args.token!, curve: l.args.curve!, deployer: l.args.deployer!, pairToken: l.args.pairToken!, block: l.blockNumber })

// The newest launches on the chain, whoever made them.
export async function readRecentLaunches(quotes: Quote[], limit = 24): Promise<Launch[]> {
  const c = client()
  const head = await c.getBlockNumber()
  const logs = await launchedLogs(c, head - FEED_BLOCKS, head)
  const rows = logs.slice(-limit).reverse().map(fromLog)
  return hydrate(c, rows, quotes, head)
}
export function useRecentLaunches(quotes: Quote[] | undefined) {
  return useQuery({ queryKey: ['launch-feed', quotes?.length ?? 0], queryFn: () => readRecentLaunches(quotes!), enabled: !!quotes, staleTime: 30_000, refetchInterval: 60_000, retry: 1 })
}

// Every launch this wallet has made through the factory, newest first.
export async function readMyLaunches(owner: Address, quotes: Quote[]): Promise<Launch[]> {
  const c = client()
  const head = await c.getBlockNumber()
  const from = head > 74_800_000n ? 74_800_000n : 0n
  const logs = await launchedLogs(c, from, head, owner)
  return hydrate(c, logs.reverse().slice(0, 50).map(fromLog), quotes, head)
}
export function useMyLaunches(owner: Address | undefined, quotes: Quote[] | undefined) {
  return useQuery({ queryKey: ['my-launches', owner?.toLowerCase(), quotes?.length ?? 0], queryFn: () => readMyLaunches(owner!, quotes!), enabled: !!owner && !!quotes, staleTime: 30_000, retry: 1 })
}

export type LaunchForm = { name: string; symbol: string; logo: string; description: string; twitter: string; website: string; quote: Quote; creatorTaxBps: number; quoteIn: bigint }

const randomSalt = (): Hex => {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return toHex(b)
}

// One transaction to the Pons launch router: it creates the token and its curve, exempts the
// creator from the snipe tax, and makes the first buy with quoteIn. ETH launches send the launch
// fee plus the buy as value; other quotes send the launch fee as value and the buy as an approved
// ERC-20 transfer. The economics digest read just before pins the terms, so a change by Pons in
// between makes the launch revert rather than reprice.
export async function launchToken(ctx: TxCtx, form: LaunchForm) {
  await ensureChain(ctx)
  const c = client()
  const native = form.quote.address === ZERO
  const [fee, economics] = await Promise.all([
    c.readContract({ address: PONS.factory, abi: factoryAbi, functionName: 'launchFee' }),
    c.readContract({ address: PONS.factory, abi: factoryAbi, functionName: 'previewLaunchEconomics', args: [LAUNCH_CONFIG, form.quote.address] }),
  ])
  if (!native && form.quoteIn > 0n) await approveIfNeeded(ctx, form.quote.address, form.quoteIn, PONS.router)
  const params = {
    name: form.name.trim(),
    symbol: form.symbol.trim().toUpperCase(),
    logo: form.logo.trim(),
    description: form.description.trim(),
    socials: { twitter: form.twitter.trim(), telegram: '', discord: '', website: form.website.trim(), farcaster: '' },
    creatorFeeRecipient: ctx.account.address,
    creatorTaxBps: form.creatorTaxBps,
    buybackEnabled: false,
    expectedEconomics: economics,
    salt: randomSalt(),
  }
  const data = encodeFunctionData({ abi: routerAbi, functionName: 'launchAndBuy', args: [params, LAUNCH_CONFIG, form.quote.address, form.quoteIn, 0n, ctx.account.address, []] })
  return sendTx(ctx, PONS.router, data, native ? fee + form.quoteIn : fee)
}

// The token a launch transaction created, from its receipt.
export async function launchedTokenOf(hash: Hex): Promise<Address | null> {
  const rc = await client().getTransactionReceipt({ hash })
  for (const l of rc.logs) {
    if (lc(l.address) !== lc(PONS.factory)) continue
    try {
      const ev = decodeEventLog({ abi: factoryAbi, data: l.data, topics: l.topics })
      if (ev.eventName === 'TokenLaunched') return (ev.args as { token: Address }).token
    } catch {
      /* another factory event */
    }
  }
  return null
}

export const fmtAge = (s: number) => (s < 60 ? `${Math.max(1, Math.round(s))}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86_400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86_400)}d`)
export const explorerToken = (a: Address) => `${EXPLORER}/token/${a}`
export const explorerAddress = (a: Address) => `${EXPLORER}/address/${a}`
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
