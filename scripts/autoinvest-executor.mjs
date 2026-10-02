// Runs the due Auto-Invest plans. Reads every plan from the contract, simulates `execute` for the ones
// that are due with the contract's own price floor, and sends the ones that pass. Anyone allowed by the
// contract can run this; Verdex runs it from a GitHub Actions cron with a wallet that holds a little ETH.
//   EXECUTOR_KEY       private key of an allowed executor
//   AUTOINVEST_ADDRESS the VerdexAutoInvest contract
//   RPC                optional, defaults to the Robinhood Chain RPC
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'

const RPC = process.env.RPC ?? 'https://rpc.mainnet.chain.robinhood.com/'
const ADDRESS = process.env.AUTOINVEST_ADDRESS
const KEY = process.env.EXECUTOR_KEY
if (!ADDRESS || !KEY) { console.error('AUTOINVEST_ADDRESS and EXECUTOR_KEY are required'); process.exit(2) }
const abi = JSON.parse(readFileSync(new URL('../contracts/VerdexAutoInvest.json', import.meta.url), 'utf8')).abi
const chain = { id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } }
const account = privateKeyToAccount(KEY)
const pub = createPublicClient({ chain, transport: http(RPC, { retryCount: 3, retryDelay: 1500 }) })
const wallet = createWalletClient({ account, chain, transport: http(RPC) })
const c = { address: ADDRESS, abi }
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'

const count = Number(await pub.readContract({ ...c, functionName: 'planCount' }))
console.log(`executor ${account.address} · ${count} plans · ${new Date().toISOString()}`)
if (!count) process.exit(0)
const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1))
const due = await pub.multicall({ multicallAddress: MULTICALL3, contracts: ids.map((id) => ({ ...c, functionName: 'isDue', args: [id] })) })
const todo = ids.filter((_, i) => due[i].status === 'success' && due[i].result === true)
console.log(`${todo.length} due: ${todo.join(', ') || '-'}`)
let sent = 0, skipped = 0
for (const id of todo) {
  try {
    const floor = await pub.readContract({ ...c, functionName: 'floorOut', args: [id] })
    const sim = await pub.simulateContract({ ...c, functionName: 'execute', args: [id, floor], account })
    const hash = await wallet.writeContract(sim.request)
    const r = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 })
    console.log(`plan ${id}: ${r.status} ${hash} out ${formatUnits(sim.result, 18)} gas ${r.gasUsed}`)
    if (r.status === 'success') sent++
  } catch (e) {
    // A plan whose owner ran out of balance or allowance, or whose pool moved past the floor, just waits.
    skipped++
    console.log(`plan ${id}: skipped, ${(e.shortMessage ?? e.message ?? String(e)).split('\n')[0].slice(0, 140)}`)
  }
}
console.log(`done: ${sent} sent, ${skipped} skipped`)
