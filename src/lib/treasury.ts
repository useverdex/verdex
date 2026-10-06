// Fees buy VERDEX: the treasury contract (contracts/VerdexTreasury.sol) is where every protocol fee lands.
// An executor sweeps its USDG and ETH into VERDEX through a route the contract checks against a floor it
// reads from the pools; half of every sweep goes to the burn address and half waits for the weekly payout
// to the wallets that paid the fees. This module reads the contract, its sweeps and payouts, and the fee
// payers of the current period, all from the chain.
import { useQuery } from '@tanstack/react-query'
import { encodeDeployData, erc20Abi, formatEther, formatUnits, isAddress, parseAbi, parseAbiItem, type Address } from 'viem'
import artifact from '../../contracts/VerdexTreasury.json'
import { TREASURY_ADDRESS as BUILT_IN } from '../../scripts/treasury-address.mjs'
import { VERDEX_TOKEN } from './holding'
import { ROUTER as INDEX_ROUTER, DEPLOYED as INDEX_DEPLOYED } from './indexes'
import { MULTICALL3, USDG, WETH, client, ensureChain, type TxCtx } from './pools'
import { CONTRACTS as TOKEN } from './token'

export const TREASURY_ADDRESS = (String(import.meta.env.VITE_TREASURY_ADDRESS ?? '').trim() || BUILT_IN).trim()
export const DEPLOYED = isAddress(TREASURY_ADDRESS)
export const TREASURY = (DEPLOYED ? TREASURY_ADDRESS : '0x0000000000000000000000000000000000000000') as Address
export const DEAD = '0x000000000000000000000000000000000000dEaD' as Address
export const USDG_ETH_POOL = '0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca' as Address // Uniswap v3 USDG/WETH 0.01%
export const LIFI_DIAMOND = '0xB477751B76CF82d00a686A1232f5fCD772414Af3' as Address
export const BYTECODE = artifact.bytecode as `0x${string}`
export const abi = parseAbi([
  'constructor(address verdex_,address usdg_,address weth_,address usdgEthPool_,address poolManager_,bytes32 verdexPoolId_,address executor_,address router_)',
  'function rewardsAvailable() view returns (uint256)',
  'function totalBought() view returns (uint256)',
  'function totalBurned() view returns (uint256)',
  'function totalPaidBack() view returns (uint256)',
  'function epoch() view returns (uint256)',
  'function burnBps() view returns (uint16)',
  'function maxSlippageBps() view returns (uint16)',
  'function owner() view returns (address)',
  'function isExecutor(address) view returns (bool)',
  'function isRouter(address) view returns (bool)',
  'function quoteVerdex(address tokenIn,uint256 amountIn) view returns (uint256)',
  'event Swept(address indexed executor,address indexed tokenIn,uint256 amountIn,uint256 verdexOut,uint256 burned,uint256 kept)',
  'event Distributed(uint256 indexed epoch,uint256 total,uint256 recipients)',
])
const SWEPT = parseAbiItem('event Swept(address indexed executor,address indexed tokenIn,uint256 amountIn,uint256 verdexOut,uint256 burned,uint256 kept)')
const DISTRIBUTED = parseAbiItem('event Distributed(uint256 indexed epoch,uint256 total,uint256 recipients)')
const BOUGHT = parseAbiItem('event Bought(address indexed index,address indexed buyer,address indexed to,uint256 shares,uint256 usdgIn,uint256 fee)')
const SOLD = parseAbiItem('event Sold(address indexed index,address indexed seller,address indexed to,uint256 shares,uint256 usdgOut,uint256 fee)')
const WEEK_BLOCKS = 6_048_000n // about a week of 0.1 s blocks
const LOOKBACK = 4n * WEEK_BLOCKS

export type Sweep = { block: number; at?: number; tx: `0x${string}`; tokenIn: Address; amountIn: bigint; verdexOut: bigint; burned: bigint; kept: bigint }
export type Payout = { block: number; at?: number; tx: `0x${string}`; epoch: bigint; total: bigint; recipients: bigint }
export type Treasury = {
  usdg: bigint
  eth: bigint
  verdex: bigint
  rewardsAvailable: bigint
  totalBought: bigint
  totalBurned: bigint
  totalPaidBack: bigint
  epoch: bigint
  burnBps: number
  maxSlippageBps: number
  owner: Address
  sweeps: Sweep[]
  payouts: Payout[]
  periodFees: { payer: Address; fee: bigint }[] // fees paid through the Index router since the last payout
  periodTotal: bigint
  spotUsdg: bigint // VERDEX one USDG buys at spot right now
}

// Logs in windows the public RPC accepts, skipping a window that fails rather than failing the page.
export async function chunked<T>(from: bigint, to: bigint, fn: (a: bigint, b: bigint) => Promise<T[]>): Promise<T[]> {
  const WINDOW = 9_000_000n
  let out: T[] = []
  for (let a = from; a <= to; a += WINDOW) {
    const b = a + WINDOW - 1n > to ? to : a + WINDOW - 1n
    out = out.concat(await fn(a, b).catch(() => [] as T[]))
  }
  return out
}

export async function withTimes<T extends { block: number; at?: number }>(rows: T[]) {
  const c = client()
  const want = rows.slice(-8)
  const blocks = new Map<number, number>()
  for (const r of want) { if (blocks.has(r.block)) continue; const b = await c.getBlock({ blockNumber: BigInt(r.block) }).catch(() => null); if (b) blocks.set(r.block, Number(b.timestamp) * 1000) }
  for (const r of want) r.at = blocks.get(r.block)
  return rows
}

export async function readTreasury(): Promise<Treasury> {
  const c = client()
  const head = await c.getBlockNumber()
  const from = head > LOOKBACK ? head - LOOKBACK : 0n
  const [res, eth, sweptLogs, paidLogs] = await Promise.all([
    c.multicall({
      multicallAddress: MULTICALL3,
      batchSize: 4096,
      contracts: [
        { address: USDG.address, abi: erc20Abi, functionName: 'balanceOf', args: [TREASURY] },
        { address: VERDEX_TOKEN.address, abi: erc20Abi, functionName: 'balanceOf', args: [TREASURY] },
        { address: TREASURY, abi, functionName: 'rewardsAvailable' },
        { address: TREASURY, abi, functionName: 'totalBought' },
        { address: TREASURY, abi, functionName: 'totalBurned' },
        { address: TREASURY, abi, functionName: 'totalPaidBack' },
        { address: TREASURY, abi, functionName: 'epoch' },
        { address: TREASURY, abi, functionName: 'burnBps' },
        { address: TREASURY, abi, functionName: 'maxSlippageBps' },
        { address: TREASURY, abi, functionName: 'owner' },
        { address: TREASURY, abi, functionName: 'quoteVerdex', args: [USDG.address, 1_000_000n] },
      ],
    }),
    c.getBalance({ address: TREASURY }),
    chunked(from, head, (a, b) => c.getLogs({ address: TREASURY, event: SWEPT, fromBlock: a, toBlock: b })),
    chunked(from, head, (a, b) => c.getLogs({ address: TREASURY, event: DISTRIBUTED, fromBlock: a, toBlock: b })),
  ])
  const v = <T,>(k: number, fallback: T): T => (res[k].status === 'success' ? (res[k].result as T) : fallback)
  const sweeps = await withTimes(sweptLogs.map((l) => ({ block: Number(l.blockNumber), tx: l.transactionHash, tokenIn: l.args.tokenIn!, amountIn: l.args.amountIn!, verdexOut: l.args.verdexOut!, burned: l.args.burned!, kept: l.args.kept! })))
  const payouts = await withTimes(paidLogs.map((l) => ({ block: Number(l.blockNumber), tx: l.transactionHash, epoch: l.args.epoch!, total: l.args.total!, recipients: l.args.recipients! })))
  // Fees paid through the Index router since the last payout: the next payout is split pro rata to these.
  const sinceBlock = payouts.length ? BigInt(payouts[payouts.length - 1].block) + 1n : from
  const paid = new Map<string, bigint>()
  if (INDEX_DEPLOYED) {
    const [b, s] = await Promise.all([chunked(sinceBlock, head, (x, y) => c.getLogs({ address: INDEX_ROUTER, event: BOUGHT, fromBlock: x, toBlock: y })), chunked(sinceBlock, head, (x, y) => c.getLogs({ address: INDEX_ROUTER, event: SOLD, fromBlock: x, toBlock: y }))])
    for (const l of b) if ((l.args.fee ?? 0n) > 0n) paid.set(l.args.buyer!.toLowerCase(), (paid.get(l.args.buyer!.toLowerCase()) ?? 0n) + l.args.fee!)
    for (const l of s) if ((l.args.fee ?? 0n) > 0n) paid.set(l.args.seller!.toLowerCase(), (paid.get(l.args.seller!.toLowerCase()) ?? 0n) + l.args.fee!)
  }
  const periodFees = [...paid.entries()].map(([payer, fee]) => ({ payer: payer as Address, fee })).sort((a, b) => (b.fee > a.fee ? 1 : -1))
  return {
    usdg: v<bigint>(0, 0n), verdex: v<bigint>(1, 0n), eth,
    rewardsAvailable: v<bigint>(2, 0n), totalBought: v<bigint>(3, 0n), totalBurned: v<bigint>(4, 0n), totalPaidBack: v<bigint>(5, 0n), epoch: v<bigint>(6, 0n),
    burnBps: Number(v<number>(7, 5000)), maxSlippageBps: Number(v<number>(8, 800)), owner: v<Address>(9, '0x0000000000000000000000000000000000000000'),
    sweeps, payouts, periodFees, periodTotal: periodFees.reduce((s, x) => s + x.fee, 0n), spotUsdg: v<bigint>(10, 0n),
  }
}
export function useTreasury() {
  return useQuery({ queryKey: ['treasury'], queryFn: readTreasury, enabled: DEPLOYED, staleTime: 30_000, refetchInterval: 60_000, retry: 1 })
}

export async function deployTreasury(ctx: TxCtx, executor: Address) {
  await ensureChain(ctx)
  ctx.onPhase('confirming')
  const data = encodeDeployData({ abi, bytecode: BYTECODE, args: [VERDEX_TOKEN.address, USDG.address, WETH.address, USDG_ETH_POOL, TOKEN.poolManager, TOKEN.poolId, executor, LIFI_DIAMOND] })
  const hash = await ctx.walletClient.sendTransaction({ account: ctx.account.address, chain: null, data })
  ctx.onPhase('pending')
  const receipt = await client().waitForTransactionReceipt({ hash, timeout: 120_000 })
  ctx.onPhase('done')
  return { hash, address: receipt.contractAddress as Address }
}

export const fmtVerdexAmt = (v: bigint, d = 0) => Number(formatUnits(v, 18)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtUsdg = (v: bigint, d = 2) => `$${Number(formatUnits(v, USDG.decimals)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
export const fmtEth = (v: bigint) => `${Number(formatEther(v)).toFixed(5)} ETH`
