// One pass of the Agent without you executor, for a cron or a shell. The server runs the same code every ten
// minutes next to the Auto-Invest, Orders and Vaults passes.
//   EXECUTOR_KEY   private key of an allowed executor (or ./executor.key next to package.json)
//   AGENT_ADDRESS  the VerdexAgent contract (or the address built into the site)
//   RPC            optional, defaults to the Robinhood Chain RPC
import { readFileSync, existsSync } from 'node:fs'
import { runAgentOnce, executorBalance } from './executor-lib.mjs'
import { AGENT_ADDRESS as BUILT_IN } from './agent-address.mjs'

const key = process.env.EXECUTOR_KEY ?? (existsSync('executor.key') ? readFileSync('executor.key', 'utf8').trim() : '')
const address = process.env.AGENT_ADDRESS || BUILT_IN
if (!key || !address) { console.error('no executor key or contract address'); process.exit(2) }
const bal = await executorBalance({ rpc: process.env.RPC, key })
console.log(`executor ${bal.address} · ${bal.eth.toFixed(6)} ETH · contract ${address} · ${new Date().toISOString()}`)
const r = await runAgentOnce({ rpc: process.env.RPC, address, key })
console.log(`mandates ${r.count} · open ${r.open} · candidates ${r.candidates} · sent ${r.sent} · skipped ${r.skipped}`)
