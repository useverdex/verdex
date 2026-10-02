// Private markets: pre-IPO exposure tokens issued by PreStocks on Solana, read where they trade.
// Jupiter's token API gives price, liquidity, volume and holders for every current mint in one
// request; the Solana RPC gives what the mint itself says (transfer fee, pause switch, supply).
// Nothing here is a Verdex contract: the page lists and links, the trade happens on Jupiter.
import { useQuery } from '@tanstack/react-query'
import { pub } from './base'

export const SOLANA_RPC = 'https://solana-rpc.publicnode.com'
const JUP = 'https://lite-api.jup.ag'
export const ISSUER = { name: 'PreStocks', url: 'https://prestocks.com', terms: 'https://url.prestocks.com/terms-of-service' }

export type Status = 'private' | 'listed' | 'closed'
export type Company = {
  slug: string
  name: string
  symbol: string
  mint: string
  about: string
  status: Status
  // For a company that left the private market: where it went.
  note?: string
  ticker?: string
}

// The issuer's current mints. Every earlier mint for the same company is in RETIRED below.
export const COMPANIES: Company[] = [
  { slug: 'anthropic', name: 'Anthropic', symbol: 'ANTHROPIC', mint: 'Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw', about: 'AI research company behind the Claude models.', status: 'private' },
  { slug: 'openai', name: 'OpenAI', symbol: 'OPENAI', mint: 'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF', about: 'AI research company behind ChatGPT.', status: 'private' },
  { slug: 'anduril', name: 'Anduril', symbol: 'ANDURIL', mint: 'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB', about: 'Defence technology: autonomous systems and software.', status: 'private' },
  { slug: 'neuralink', name: 'Neuralink', symbol: 'NEURALINK', mint: 'PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S', about: 'Brain-computer interfaces.', status: 'private' },
  { slug: 'kalshi', name: 'Kalshi', symbol: 'KALSHI', mint: 'PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua', about: 'Regulated exchange for event contracts in the United States.', status: 'private' },
  { slug: 'polymarket', name: 'Polymarket', symbol: 'POLYMARKET', mint: 'Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP', about: 'Prediction market on Polygon.', status: 'private' },
  { slug: 'figureai', name: 'Figure AI', symbol: 'FIGUREAI', mint: 'PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd', about: 'Humanoid robots for industry and homes.', status: 'private' },
  { slug: 'spacex', name: 'SpaceX', symbol: 'SPACEX', mint: 'PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh', about: 'Rockets and Starlink.', status: 'listed', ticker: 'SPCX', note: 'Listed in June 2026. The public stock trades tokenized as SPCX, in Markets. What is left of the pre-IPO token is a conversion pool, not a market.' },
  { slug: 'xai', name: 'xAI', symbol: 'XAI', mint: 'PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx', about: 'AI company behind Grok.', status: 'closed', note: 'The issuer closed the conversion window for this token on 12 September 2026. The pool that remains has almost no liquidity.' },
]

// Mints the issuer replaced or refunded. They still exist onchain, still carry the PreStocks
// name and still get pasted into swap boxes, which is the whole reason this list is here.
export const RETIRED: Record<string, { company: string; reason: 'outdated' | 'refunded' }> = {
  Prep57BLk9uKWRzKigtQBbrYFxcDXtHuCjxFRM5UXAS: { company: 'Anduril', reason: 'outdated' },
  PreYKD2kJ5xGgoZ644VPfbEN7sW8bWCUREHr5S3ebV9: { company: 'OpenAI', reason: 'outdated' },
  Preb5VKsmKgMGhMKUhDpe7A2AhMDmrZtMMZmvFEhLbU: { company: 'SpaceX', reason: 'outdated' },
  PreGERrFuZAJqTxJ5oC3DeQmfdrniNzJgqKGFb2ZLE6: { company: 'Anthropic', reason: 'outdated' },
  PreYPq1LdVBhKsYC3nRmZW5Y9yJXwSuDYmUSikFCwGS: { company: 'xAI', reason: 'outdated' },
  PreAYsissANcRXg5uTniKqdCrrUSGdvtrKDVPHS1ib6: { company: 'Figure AI', reason: 'refunded' },
  PreG98Hxr4GNswTNTQfBVqRQe6DNCjJ9Rg5jqFzmiXA: { company: 'Perplexity', reason: 'refunded' },
  Pre5X98d9ZvgGirEcWqeCVDK6wQ52stKkmU3HsH6bfE: { company: 'Neuralink', reason: 'refunded' },
  Pres43hQWdY6HaHWckmgzqyQgVwYCXen3VPrXMoKWeY: { company: 'Kraken', reason: 'refunded' },
  Pre2Y4gaf97C4T8ckygDpYbja3w6mH6zmCEs3SA8ALH: { company: 'Safe Superintelligence', reason: 'refunded' },
  Pre8wtN7sLADKn8qekjQipcSiYTGg5tafWqeH49s1wQ: { company: 'Groq', reason: 'refunded' },
  PrekBgzytydXoDTrH5NW9ABP68c96twxML8oV1NnV8d: { company: 'Discord', reason: 'refunded' },
  PreGJxNkwFp8KmtA5rnvgv2z3zAa8c2UQMfN4FjPh4Z: { company: 'Epic Games', reason: 'refunded' },
  PrejfFQH6y6aQBfR43zuBqnPXvQrDU5EugwVEBQZVK3: { company: 'CHAOS Industries', reason: 'refunded' },
  PreDmU41w1LZaDqiEQdd75ffWaDndMMN8bJPfNno4AM: { company: 'Addepar', reason: 'refunded' },
  PreQhJLE9YMSVtJpVLJ3bAWE2BQ5AqBniG7aA2bGRRz: { company: 'Impossible Foods', reason: 'refunded' },
  PrevLYRs2HreKvo2bEQsAo839m38ws5TH2WHYFzqsWt: { company: 'Harvey', reason: 'refunded' },
  PregdTtARmfoDGB7XsbyyZc4RmKbKdmiPFXvinBpjTa: { company: 'Databricks', reason: 'refunded' },
  PreZsfo4N5J16vpJWvaTubLpNHrBe1fNgvoFuqZ21xK: { company: 'Apptronik', reason: 'refunded' },
  PreZdBV5d4XDUa7diCGZmyZXQSpbAdrTEzmgvUWY5Dd: { company: 'Glean', reason: 'refunded' },
  PreQ1REpwo4v5d8QMF58h3jpqKww9k5NMbvBXMVo7A5: { company: 'BlaBlaCar', reason: 'refunded' },
  PreJuqZjkL2QFkx78MkEGv8P6Zk8qqpTx9GSjLtfvXW: { company: 'Saronic', reason: 'refunded' },
}

// The issuer's logos, shipped with the site so a row never waits on prestocks.com.
export const logoOf = (c: Pick<Company, 'slug'>) => pub(`/logos/private/${c.slug}.png`)
export const jupiterUrl = (mint: string) => `https://jup.ag/swap/USDC-${mint}`
export const solscanUrl = (mint: string) => `https://solscan.io/token/${mint}`
export const dexscreenerUrl = (mint: string) => `https://dexscreener.com/solana/${mint}`
export const issuerUrl = (c: Pick<Company, 'slug'>) => `${ISSUER.url}/${c.slug}`
export const shortMint = (m: string) => `${m.slice(0, 4)}…${m.slice(-4)}`

export type Market = {
  price?: number
  change24h?: number
  liquidity?: number
  volume24h?: number
  buys24h?: number
  sells24h?: number
  traders24h?: number
  holders?: number
  marketCap?: number
  supply?: number
  firstPool?: number
  verified?: boolean
}
export type Mint = {
  // Transfer fee in basis points, the one in force this epoch, and the one scheduled if it differs.
  feeBps?: number
  nextFeeBps?: number
  nextFeeEpoch?: number
  paused?: boolean
  supply?: number
  decimals?: number
  multiplier?: number
}
export type Token = Company & { market: Market; chain: Mint; logo: string }
export type PrivateMarkets = { tokens: Token[]; epoch?: number; readAt: number; sources: { jupiter: boolean; solana: boolean } }

type JupToken = {
  id: string
  name: string
  symbol: string
  icon?: string
  decimals: number
  circSupply?: number
  totalSupply?: number
  holderCount?: number
  mcap?: number
  fdv?: number
  usdPrice?: number
  liquidity?: number
  isVerified?: boolean
  tags?: string[]
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number; numBuys?: number; numSells?: number; numTraders?: number }
  firstPool?: { id?: string; createdAt?: string }
}

async function jupSearch(mints: string[]): Promise<JupToken[]> {
  const r = await fetch(`${JUP}/tokens/v2/search?query=${mints.join(',')}`)
  if (!r.ok) throw new Error(`jupiter → ${r.status}`)
  return (await r.json()) as JupToken[]
}

function marketOf(j: JupToken | undefined): Market {
  if (!j) return {}
  const s = j.stats24h
  return {
    price: j.usdPrice,
    change24h: s?.priceChange,
    liquidity: j.liquidity,
    volume24h: s && (s.buyVolume != null || s.sellVolume != null) ? (s.buyVolume ?? 0) + (s.sellVolume ?? 0) : undefined,
    buys24h: s?.numBuys,
    sells24h: s?.numSells,
    traders24h: s?.numTraders,
    holders: j.holderCount,
    marketCap: j.mcap ?? j.fdv,
    supply: j.circSupply ?? j.totalSupply,
    firstPool: j.firstPool?.createdAt ? Date.parse(j.firstPool.createdAt) : undefined,
    verified: j.isVerified,
  }
}

// DexScreener as the fallback price source if Jupiter is down: the deepest pair per mint.
type DexPair = { baseToken: { address: string }; priceUsd?: string; liquidity?: { usd?: number }; volume?: { h24?: number }; priceChange?: { h24?: number }; marketCap?: number; fdv?: number; txns?: { h24?: { buys?: number; sells?: number } }; pairCreatedAt?: number }
async function dexFallback(mints: string[]): Promise<Record<string, Market>> {
  const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mints.join(',')}`)
  if (!r.ok) throw new Error(`dexscreener → ${r.status}`)
  const pairs = (await r.json()) as DexPair[]
  const out: Record<string, Market> = {}
  for (const p of pairs) {
    const m = p.baseToken.address
    const liq = p.liquidity?.usd ?? 0
    if (out[m] && (out[m].liquidity ?? 0) >= liq) continue
    out[m] = { price: p.priceUsd ? Number(p.priceUsd) : undefined, change24h: p.priceChange?.h24, liquidity: liq, volume24h: p.volume?.h24, buys24h: p.txns?.h24?.buys, sells24h: p.txns?.h24?.sells, marketCap: p.marketCap ?? p.fdv, firstPool: p.pairCreatedAt }
  }
  return out
}

type RpcExt = { extension: string; state: Record<string, unknown> }
type RpcMint = { data?: { parsed?: { info?: { supply?: string; decimals?: number; extensions?: RpcExt[] } } } }
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(SOLANA_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  if (!r.ok) throw new Error(`solana → ${r.status}`)
  const j = (await r.json()) as { result?: T; error?: { message: string } }
  if (j.error || j.result === undefined) throw new Error(j.error?.message ?? 'solana: empty')
  return j.result
}

function mintOf(v: RpcMint | null | undefined, epoch: number | undefined): Mint {
  const info = v?.data?.parsed?.info
  if (!info) return {}
  const ex = Object.fromEntries((info.extensions ?? []).map((e) => [e.extension, e.state]))
  const tf = ex.transferFeeConfig as { newerTransferFee?: { epoch: number; transferFeeBasisPoints: number }; olderTransferFee?: { epoch: number; transferFeeBasisPoints: number } } | undefined
  const newer = tf?.newerTransferFee
  const older = tf?.olderTransferFee
  const live = epoch == null || !newer ? (newer ?? older) : epoch >= newer.epoch ? newer : (older ?? newer)
  const next = newer && epoch != null && epoch < newer.epoch && newer.transferFeeBasisPoints !== live?.transferFeeBasisPoints ? newer : undefined
  const pause = ex.pausableConfig as { paused?: boolean } | undefined
  const scaled = ex.scaledUiAmountConfig as { multiplier?: string } | undefined
  const decimals = info.decimals ?? 9
  return {
    feeBps: live?.transferFeeBasisPoints,
    nextFeeBps: next?.transferFeeBasisPoints,
    nextFeeEpoch: next?.epoch,
    paused: pause?.paused,
    supply: info.supply ? Number(info.supply) / 10 ** decimals : undefined,
    decimals,
    multiplier: scaled?.multiplier ? Number(scaled.multiplier) : undefined,
  }
}

export async function readPrivateMarkets(): Promise<PrivateMarkets> {
  const mints = COMPANIES.map((c) => c.mint)
  const [jup, chain] = await Promise.all([
    jupSearch(mints).then((l) => ({ ok: true as const, by: Object.fromEntries(l.map((t) => [t.id, marketOf(t)])) })).catch(() => dexFallback(mints).then((by) => ({ ok: false as const, by })).catch(() => ({ ok: false as const, by: {} as Record<string, Market> }))),
    Promise.all([rpc<{ epoch: number }>('getEpochInfo', []), rpc<{ value: (RpcMint | null)[] }>('getMultipleAccounts', [mints, { encoding: 'jsonParsed' }])])
      .then(([e, a]) => ({ ok: true as const, epoch: e.epoch, by: Object.fromEntries(mints.map((m, i) => [m, mintOf(a.value[i], e.epoch)])) }))
      .catch(() => ({ ok: false as const, epoch: undefined, by: {} as Record<string, Mint> })),
  ])
  const tokens = COMPANIES.map((c) => ({ ...c, logo: logoOf(c), market: jup.by[c.mint] ?? {}, chain: chain.by[c.mint] ?? {} }))
  return { tokens, epoch: chain.epoch, readAt: Date.now(), sources: { jupiter: jup.ok, solana: chain.ok } }
}

export function usePrivateMarkets() {
  return useQuery({ queryKey: ['private-markets'], queryFn: readPrivateMarkets, staleTime: 30_000, refetchInterval: 60_000, retry: 2 })
}

// What a pasted mint is, by the lists above first and by Jupiter's name for anything else:
// the issuer renames a mint it has replaced ("OUTDATED-…") or refunded ("REFUNDED-…").
export type MintCheck =
  | { kind: 'current'; company: Company }
  | { kind: 'retired'; company: string; reason: 'outdated' | 'refunded' }
  | { kind: 'issuer-other'; name: string; symbol: string }
  | { kind: 'not-issuer'; name?: string; symbol?: string }
  | { kind: 'unknown' }
  | { kind: 'invalid' }

export const isMintLike = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)

export async function checkMint(input: string): Promise<MintCheck> {
  const m = input.trim()
  if (!isMintLike(m)) return { kind: 'invalid' }
  const current = COMPANIES.find((c) => c.mint === m)
  if (current) return { kind: 'current', company: current }
  const retired = RETIRED[m]
  if (retired) return { kind: 'retired', ...retired }
  const found = (await jupSearch([m]).catch(() => [] as JupToken[])).find((t) => t.id === m)
  if (!found) return { kind: 'unknown' }
  const name = found.name ?? ''
  if (/^OUTDATED-/i.test(name)) return { kind: 'retired', company: name.replace(/^OUTDATED-/i, ''), reason: 'outdated' }
  if (/^REFUNDED-/i.test(name)) return { kind: 'retired', company: name.replace(/^REFUNDED-/i, ''), reason: 'refunded' }
  if (found.tags?.includes('prestocks') && found.isVerified) return { kind: 'issuer-other', name, symbol: found.symbol }
  return { kind: 'not-issuer', name, symbol: found.symbol }
}

export const fmtFee = (bps?: number) => (bps == null ? '…' : `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`)
export const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '…')
