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
