// $VERDEX, live: everything the token page shows is read in the browser, from Robinhood Chain and the
// DEX aggregator's public API. The creator wallet is read from the launch record on the Pons hook, the
// fees from the escrow's credit events and the hook's pending views, the dev holding from the token
// itself, and the market figures from DexScreener. Nothing is cached on a Verdex server, because there
// is none.
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, encodeFunctionData, formatEther, formatUnits, http, parseAbi, parseAbiItem, type Address } from 'viem'
import { ROBINHOOD } from './api'
import { VERDEX_TOKEN } from './autoInvest'

export const TOKEN = VERDEX_TOKEN
export const SUPPLY = 1_000_000_000
export const CONTRACTS = {
  token: VERDEX_TOKEN.address as Address,
  hook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044' as Address,
  escrow: '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e' as Address,
  poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951' as Address,
  poolId: '0xfd3020c84a9ab445186b3c7f4b30afdf7cb6d0ab2c720972511f8607d6e646d3' as `0x${string}`,
}
export const RPC = 'https://rpc.mainnet.chain.robinhood.com/'
export const EXPLORER = 'https://robin.etherscan.io'
export const DEXSCREENER = `https://dexscreener.com/robinhood/${CONTRACTS.poolId}`
// The pool's fee policy, from hook.launches(poolId): a creator tax and a hook fee, both on every swap.
export const FEE = { totalPct: 3, creatorTaxPct: 2, hookFeePct: 1, creatorSharePct: 90, protocolSharePct: 10 }
// The buyback policy. Off until announced; the page hides the panel while it is off.
export const BUYBACK = { live: false, sharePct: 50, cadence: 'every day' }
// The bug bounty, paid in ETH from creator fees. Details in SECURITY.md.
export const BOUNTY: { tier: string; eth: number; what: string }[] = [
  { tier: 'Critical', eth: 0.5, what: 'A way to make the site request a signature or send a transaction the user did not ask for, or to change what is sent.' },
  { tier: 'High', eth: 0.2, what: 'A wrong route, amount, address or fee shown at confirmation time; a way to read another user\'s stored plans, orders, vaults or key.' },
  { tier: 'Medium', eth: 0.05, what: 'A data leak, a broken safety check, or a reminder or automation that acts on the wrong data.' },
  { tier: 'Low', eth: 0, what: 'Anything else that misleads a user. Credited in the fix, paid at our discretion.' },
]
const LAUNCH_BLOCK = 74_800_000n
const WINDOW = 9_000_000n

const client = () => createPublicClient({ transport: http(RPC, { retryCount: 3, retryDelay: 1500, timeout: 25_000 }) })
const abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function pendingCreatorTax(bytes32,address) view returns (uint256)', 'function launches(bytes32)'])
const CREDITED = parseAbiItem('event Credited(address indexed account, address indexed token, uint256 amount)')
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const ZERO = '0x0000000000000000000000000000000000000000' as Address
export const DEAD = '0x000000000000000000000000000000000000dEaD' as Address

export type Market = { price: number; marketCap: number; liquidity: number; volume24h: number; buys24h: number; sells24h: number; change: { h1: number; h6: number; h24: number }; at: number }
export async function readMarket(): Promise<Market> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/robinhood/${CONTRACTS.poolId}`)
  if (!r.ok) throw new Error('Market data unavailable right now.')
  const j = (await r.json()) as { pairs?: DexPair[]; pair?: DexPair }
  const p = j.pairs?.[0] ?? j.pair
  if (!p) throw new Error('No pair data.')
  return { price: Number(p.priceUsd ?? 0), marketCap: Number(p.marketCap ?? p.fdv ?? 0), liquidity: Number(p.liquidity?.usd ?? 0), volume24h: Number(p.volume?.h24 ?? 0), buys24h: Number(p.txns?.h24?.buys ?? 0), sells24h: Number(p.txns?.h24?.sells ?? 0), change: { h1: Number(p.priceChange?.h1 ?? 0), h6: Number(p.priceChange?.h6 ?? 0), h24: Number(p.priceChange?.h24 ?? 0) }, at: Date.now() }
}
type DexPair = { priceUsd?: string; marketCap?: number; fdv?: number; liquidity?: { usd?: number }; volume?: { h24?: number }; txns?: { h24?: { buys?: number; sells?: number } }; priceChange?: { h1?: number; h6?: number; h24?: number } }

// ETH in USD, from the same aggregator feed the swap uses.
export async function readEthUsd() {
  const r = await fetch(`https://li.quest/v1/token?chain=1&token=${ZERO}`)
  const j = (await r.json()) as { priceUSD?: string }
  return Number(j.priceUSD ?? 0)
}

// The creator wallet, from the launch record: word 4 of hook.launches(poolId).
export async function readCreator(): Promise<Address> {
  const data = encodeFunctionData({ abi, functionName: 'launches', args: [CONTRACTS.poolId] })
  const r = await client().call({ to: CONTRACTS.hook, data })
  const words = (r.data ?? '').slice(2).match(/.{64}/g) ?? []
  const w = words[4]
  if (!w) throw new Error('Launch record unavailable.')
  return (`0x${w.slice(24)}`) as Address
}

export type Sweep = { block: number; eth: number; tx: `0x${string}`; at?: number }
export type Move = { block: number; verdex: number; tx: `0x${string}`; at?: number; to?: Address }
export type Treasury = { creator: Address; sweeps: Sweep[]; totalEth: number; pendingEth: number; pendingVerdex: number; holdingVerdex: number; buys: Move[]; burns: Move[]; outs: Move[]; burnedByDev: number; soldVerdex: number; burnedTotal: number }
async function chunkedLogs<T>(fn: (from: bigint, to: bigint) => Promise<T[]>, latest: bigint) {
  let out: T[] = []
  for (let from = LAUNCH_BLOCK; from <= latest; from += WINDOW) {
    const to = from + WINDOW - 1n > latest ? latest : from + WINDOW - 1n
    out = out.concat(await fn(from, to))
  }
  return out
}
export async function readTreasury(): Promise<Treasury> {
  const c = client()
  const creator = await readCreator()
  const latest = await c.getBlockNumber()
  const [credits, transfers, fromDev, pendingEth, pendingVerdex, holding, dead] = await Promise.all([
    chunkedLogs((fromBlock, toBlock) => c.getLogs({ address: CONTRACTS.escrow, event: CREDITED, args: { account: creator }, fromBlock, toBlock }), latest),
    chunkedLogs((fromBlock, toBlock) => c.getLogs({ address: CONTRACTS.token, event: TRANSFER, args: { to: creator }, fromBlock, toBlock }), latest),
    chunkedLogs((fromBlock, toBlock) => c.getLogs({ address: CONTRACTS.token, event: TRANSFER, args: { from: creator }, fromBlock, toBlock }), latest),
    c.readContract({ address: CONTRACTS.hook, abi, functionName: 'pendingCreatorTax', args: [CONTRACTS.poolId, ZERO] }).catch(() => 0n),
    c.readContract({ address: CONTRACTS.hook, abi, functionName: 'pendingCreatorTax', args: [CONTRACTS.poolId, CONTRACTS.token] }).catch(() => 0n),
    c.readContract({ address: CONTRACTS.token, abi, functionName: 'balanceOf', args: [creator] }),
    c.readContract({ address: CONTRACTS.token, abi, functionName: 'balanceOf', args: [DEAD] }).catch(() => 0n),
  ])
  const sweeps: Sweep[] = credits.map((l) => ({ block: Number(l.blockNumber), eth: Number(formatEther(l.args.amount!)), tx: l.transactionHash }))
  const toMove = (l: { blockNumber: bigint; args: { value?: bigint }; transactionHash: `0x${string}` }): Move => ({ block: Number(l.blockNumber), verdex: Number(formatUnits(l.args.value ?? 0n, 18)), tx: l.transactionHash })
  const buys = transfers.map(toMove)
  // Everything that left the wallet: to the burn address, or anywhere else (a sale, listed as plainly as a burn).
  const burns = fromDev.filter((l) => (l.args.to ?? '').toLowerCase() === DEAD.toLowerCase()).map(toMove)
  const outs = fromDev.filter((l) => (l.args.to ?? '').toLowerCase() !== DEAD.toLowerCase()).map((l) => ({ ...toMove(l), to: l.args.to as Address }))
  // Timestamps for the most recent rows only; the rest are shown by block.
  const want: { block: number; at?: number }[] = [...sweeps.slice(-6), ...buys.slice(-6), ...burns.slice(-6), ...outs.slice(-6)]
  const blocks = new Map<number, number>()
  for (const row of want) {
    if (blocks.has(row.block)) continue
    const b = await c.getBlock({ blockNumber: BigInt(row.block) }).catch(() => null)
    if (b) blocks.set(row.block, Number(b.timestamp) * 1000)
  }
  for (const row of want) row.at = blocks.get(row.block)
  return { creator, sweeps, totalEth: sweeps.reduce((s, x) => s + x.eth, 0), pendingEth: Number(formatEther(pendingEth)), pendingVerdex: Number(formatUnits(pendingVerdex, 18)), holdingVerdex: Number(formatUnits(holding, 18)), buys, burns, outs, burnedByDev: burns.reduce((s, x) => s + x.verdex, 0), soldVerdex: outs.reduce((s, x) => s + x.verdex, 0), burnedTotal: Number(formatUnits(dead, 18)) }
}

export function useMarket() {
  return useQuery({ queryKey: ['verdex-market'], queryFn: readMarket, staleTime: 30_000, refetchInterval: 60_000 })
}
export function useEthUsd() {
  return useQuery({ queryKey: ['eth-usd'], queryFn: readEthUsd, staleTime: 60_000 })
}
export function useTreasury() {
  return useQuery({ queryKey: ['verdex-treasury'], queryFn: readTreasury, staleTime: 60_000, refetchInterval: 120_000, retry: 2 })
}
export const explorerTx = (tx: string) => `${EXPLORER}/tx/${tx}`
export const explorerAddress = (a: string) => `${EXPLORER}/address/${a}`
export const chainId = ROBINHOOD
