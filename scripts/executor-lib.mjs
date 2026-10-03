// The Auto-Invest executor: one pass over every plan on the contract, running the ones that are due.
// Used by scripts/autoinvest-executor.mjs (one-off) and by server.mjs (every ten minutes).
import { createPublicClient, createWalletClient, http, formatUnits, parseAbi, encodeFunctionData, erc20Abi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export const DEFAULT_RPC = 'https://rpc.mainnet.chain.robinhood.com/'
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const abi = parseAbi([
  'function planCount() view returns (uint256)',
  'function isDue(uint256 id) view returns (bool)',
  'function floorOut(uint256 id) view returns (uint256)',
  'function execute(uint256 id,uint256 minOut) returns (uint256)',
])
const chain = (rpc) => ({ id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } })

/** Runs every due plan once. Returns { count, due, sent, skipped }. Never throws for a single plan's failure. */
export async function runOnce({ rpc = DEFAULT_RPC, address, key, log = console.log }) {
  const account = privateKeyToAccount(key)
  const pub = createPublicClient({ chain: chain(rpc), transport: http(rpc, { retryCount: 3, retryDelay: 1500, timeout: 30_000 }) })
  const wallet = createWalletClient({ account, chain: chain(rpc), transport: http(rpc) })
  const c = { address, abi }
  const count = Number(await pub.readContract({ ...c, functionName: 'planCount' }))
  if (!count) return { count, due: 0, sent: 0, skipped: 0 }
  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1))
  const due = await pub.multicall({ multicallAddress: MULTICALL3, contracts: ids.map((id) => ({ ...c, functionName: 'isDue', args: [id] })) })
  const todo = ids.filter((_, i) => due[i].status === 'success' && due[i].result === true)
  let sent = 0, skipped = 0
  for (const id of todo) {
    try {
      const floor = await pub.readContract({ ...c, functionName: 'floorOut', args: [id] })
      const sim = await pub.simulateContract({ ...c, functionName: 'execute', args: [id, floor], account })
      const hash = await wallet.writeContract(sim.request)
      const r = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 })
      log(`plan ${id}: ${r.status} ${hash} out ${formatUnits(sim.result, 18)} gas ${r.gasUsed}`)
      if (r.status === 'success') sent++
      else skipped++
    } catch (e) {
      // Balance or allowance short, or the pool moved past the floor: the plan waits for the next pass.
      skipped++
      log(`plan ${id}: skipped, ${(e.shortMessage ?? e.message ?? String(e)).split('\n')[0].slice(0, 140)}`)
    }
  }
  return { count, due: todo.length, sent, skipped }
}

export async function executorBalance({ rpc = DEFAULT_RPC, key }) {
  const account = privateKeyToAccount(key)
  const pub = createPublicClient({ chain: chain(rpc), transport: http(rpc) })
  return { address: account.address, eth: Number(formatUnits(await pub.getBalance({ address: account.address }), 18)) }
}

// ---- refuel: the tips arrive in USDG, the gas is paid in ETH. When the ETH runs low, the executor sells its
// USDG for ETH through LI.FI on Robinhood Chain, so one small top-up at the start is the only ETH it ever needs.
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'
const LIFI = 'https://li.quest/v1'
export const REFUEL_BELOW_ETH = 0.00015
export const REFUEL_MIN_USDG = 1

export async function refuelIfNeeded({ rpc = DEFAULT_RPC, key, log = console.log, force = false }) {
  const account = privateKeyToAccount(key)
  const pub = createPublicClient({ chain: chain(rpc), transport: http(rpc, { retryCount: 3, retryDelay: 1500, timeout: 30_000 }) })
  const wallet = createWalletClient({ account, chain: chain(rpc), transport: http(rpc) })
  const eth = Number(formatUnits(await pub.getBalance({ address: account.address }), 18))
  const usdgRaw = await pub.readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
  const usdg = Number(formatUnits(usdgRaw, 6))
  if (!force && (eth >= REFUEL_BELOW_ETH || usdg < REFUEL_MIN_USDG)) return { refueled: false, eth, usdg }
  if (usdg < REFUEL_MIN_USDG) return { refueled: false, eth, usdg, reason: 'not enough USDG' }
  const q = new URLSearchParams({ fromChain: '4663', toChain: '4663', fromToken: USDG, toToken: '0x0000000000000000000000000000000000000000', fromAmount: usdgRaw.toString(), fromAddress: account.address, integrator: 'verdex', slippage: '0.01' })
  const r = await fetch(`${LIFI}/quote?${q}`, { headers: process.env.LIFI_API_KEY ? { 'x-lifi-api-key': process.env.LIFI_API_KEY } : {} })
  if (!r.ok) throw new Error(`lifi quote ${r.status}`)
  const quote = await r.json()
  const spender = quote.estimate?.approvalAddress
  const tx = quote.transactionRequest
  if (!spender || !tx) throw new Error('lifi quote without a transaction')
  const allowance = await pub.readContract({ address: USDG, abi: erc20Abi, functionName: 'allowance', args: [account.address, spender] })
  if (allowance < usdgRaw) {
    const h = await wallet.sendTransaction({ to: USDG, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, usdgRaw] }) })
    await pub.waitForTransactionReceipt({ hash: h, timeout: 120_000 })
  }
  const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value ?? 0), gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined })
  const rc = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 })
  const after = Number(formatUnits(await pub.getBalance({ address: account.address }), 18))
  log(`refuel: ${rc.status} ${hash} sold ${usdg.toFixed(2)} USDG via ${quote.tool}, ETH ${eth.toFixed(6)} → ${after.toFixed(6)}`)
  return { refueled: rc.status === 'success', eth: after, usdg: 0, hash }
}

// ---- treasury: every protocol fee lands in the treasury contract; the executor sweeps balances into VERDEX
// through a LI.FI route the contract checks against its own floor, and once a week pays the kept half back
// to the wallets that paid the fees, pro rata to the fees in the period.
const TREASURY_ABI = parseAbi([
  'function sweep(address tokenIn,uint256 amountIn,address router,address spender,bytes data,uint256 minOut) returns (uint256)',
  'function distribute(address[] to,uint256[] amounts)',
  'function rewardsAvailable() view returns (uint256)',
  'function isRouter(address) view returns (bool)',
  'function floorOut(address tokenIn,uint256 amountIn) view returns (uint256)',
  'event Distributed(uint256 indexed epoch,uint256 total,uint256 recipients)',
])
const ROUTER_FEE_EVENTS = parseAbi([
  'event Bought(address indexed index,address indexed buyer,address indexed to,uint256 shares,uint256 usdgIn,uint256 fee)',
  'event Sold(address indexed index,address indexed seller,address indexed to,uint256 shares,uint256 usdgOut,uint256 fee)',
])
const VERDEX = '0x96f455a90a80dcf0c2df6703ea4ba3bedf286e43'
export const SWEEP_MIN_USDG = 5
export const SWEEP_MIN_ETH = 0.002
export const DISTRIBUTE_EVERY_S = 7 * 24 * 3600

async function lifiRoute(from, fromToken, amount) {
  const q = new URLSearchParams({ fromChain: '4663', toChain: '4663', fromToken, toToken: VERDEX, fromAmount: amount.toString(), fromAddress: from, toAddress: from, integrator: 'verdex', slippage: '0.01', fee: '0' })
  const r = await fetch(`${LIFI}/quote?${q}`, { headers: process.env.LIFI_API_KEY ? { 'x-lifi-api-key': process.env.LIFI_API_KEY } : {} })
  if (!r.ok) throw new Error(`lifi quote ${r.status}`)
  const quote = await r.json()
  if (!quote.transactionRequest) throw new Error('lifi quote without a transaction')
  return quote
}

// Sweeps the treasury's USDG and ETH into VERDEX when either is worth doing. Each sweep is one call the
// contract guards with its floor; minOut is LI.FI's own minimum, which is tighter.
export async function treasurySweep({ rpc = DEFAULT_RPC, key, treasury, log = console.log, minUsdg = SWEEP_MIN_USDG, minEth = SWEEP_MIN_ETH }) {
  const account = privateKeyToAccount(key)
  const pub = createPublicClient({ chain: chain(rpc), transport: http(rpc, { retryCount: 3, retryDelay: 1500, timeout: 30_000 }) })
  const wallet = createWalletClient({ account, chain: chain(rpc), transport: http(rpc) })
  const out = { swept: [] }
  const usdg = await pub.readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [treasury] })
  const eth = await pub.getBalance({ address: treasury })
  const legs = []
  if (Number(formatUnits(usdg, 6)) >= minUsdg) legs.push({ token: USDG, amount: usdg, label: `${formatUnits(usdg, 6)} USDG` })
  if (Number(formatUnits(eth, 18)) >= minEth) legs.push({ token: '0x0000000000000000000000000000000000000000', amount: eth, label: `${formatUnits(eth, 18)} ETH` })
  for (const leg of legs) {
    const quote = await lifiRoute(treasury, leg.token, leg.amount)
    const router = quote.transactionRequest.to
    if (!(await pub.readContract({ address: treasury, abi: TREASURY_ABI, functionName: 'isRouter', args: [router] }))) { log(`treasury: router ${router} not allowlisted, skipping ${leg.label}`); continue }
    const floor = await pub.readContract({ address: treasury, abi: TREASURY_ABI, functionName: 'floorOut', args: [leg.token, leg.amount] })
    const minOut = BigInt(quote.estimate.toAmountMin)
    if (minOut < floor) { log(`treasury: route for ${leg.label} returns ${formatUnits(minOut, 18)} VERDEX, under the floor ${formatUnits(floor, 18)}; waiting`); continue }
    const hash = await wallet.writeContract({ address: treasury, abi: TREASURY_ABI, functionName: 'sweep', args: [leg.token, leg.amount, router, quote.estimate.approvalAddress ?? router, quote.transactionRequest.data, minOut] })
    const rc = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 })
    log(`treasury: ${rc.status} ${hash} swept ${leg.label} via ${quote.tool}`)
    out.swept.push({ leg: leg.label, hash, status: rc.status })
  }
  return out
}

// Fee payers of the period: everyone who paid a fee through the Index router since the last payout.
export async function feePayersSince({ rpc = DEFAULT_RPC, routers = [], fromBlock, toBlock }) {
  const pub = createPublicClient({ chain: chain(rpc), transport: http(rpc, { retryCount: 3, retryDelay: 1500, timeout: 30_000 }) })
  const paid = new Map()
  for (const router of routers) {
    for (const ev of ROUTER_FEE_EVENTS) {
      const logs = await pub.getLogs({ address: router, event: ev, fromBlock, toBlock })
      for (const l of logs) { const who = (l.args.buyer ?? l.args.seller).toLowerCase(); const fee = l.args.fee ?? 0n; if (fee > 0n) paid.set(who, (paid.get(who) ?? 0n) + fee) }
    }
  }
  return paid
}

// Pays the kept VERDEX to the period's fee payers, pro rata to the USDG fees they paid. Runs when a week
// has passed since the last payout (or since the first fee, for the first one) and there is something to pay.
export async function treasuryDistribute({ rpc = DEFAULT_RPC, key, treasury, routers = [], fromBlockDefault, log = console.log, force = false }) {
  const account = privateKeyToAccount(key)
  const pub = createPublicClient({ chain: chain(rpc), transport: http(rpc, { retryCount: 3, retryDelay: 1500, timeout: 30_000 }) })
  const wallet = createWalletClient({ account, chain: chain(rpc), transport: http(rpc) })
  const available = await pub.readContract({ address: treasury, abi: TREASURY_ABI, functionName: 'rewardsAvailable' })
  if (available === 0n) return { paid: false, reason: 'nothing to pay' }
  const head = await pub.getBlockNumber()
  const since = head - 6_048_000n > 0n ? head - 6_048_000n : 0n // about a week of 0.1 s blocks
  const last = (await pub.getLogs({ address: treasury, event: TREASURY_ABI.find((x) => x.type === 'event' && x.name === 'Distributed'), fromBlock: since, toBlock: head })).at(-1)
  const lastBlock = last ? last.blockNumber : (fromBlockDefault ?? since)
  if (!force && last) {
    const at = Number((await pub.getBlock({ blockNumber: last.blockNumber })).timestamp)
    if (Date.now() / 1000 - at < DISTRIBUTE_EVERY_S) return { paid: false, reason: 'not a week yet' }
  }
  const payers = await feePayersSince({ rpc, routers, fromBlock: lastBlock + 1n, toBlock: head })
  const total = [...payers.values()].reduce((s, v) => s + v, 0n)
  if (total === 0n) return { paid: false, reason: 'no fee payers in the period' }
  const to = [...payers.keys()], amounts = to.map((a) => (available * payers.get(a)) / total)
  const hash = await wallet.writeContract({ address: treasury, abi: TREASURY_ABI, functionName: 'distribute', args: [to, amounts] })
  const rc = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 })
  log(`treasury: ${rc.status} ${hash} paid ${formatUnits(amounts.reduce((s, v) => s + v, 0n), 18)} VERDEX to ${to.length} wallets`)
  return { paid: rc.status === 'success', hash, recipients: to.length }
}
