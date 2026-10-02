// One pass of the Auto-Invest executor, for a cron or a shell. The server runs the same code on its own.
//   EXECUTOR_KEY        private key of an allowed executor (or ./executor.key next to package.json)
//   AUTOINVEST_ADDRESS  the VerdexAutoInvest contract (or the address built into the site)
//   RPC                 optional, defaults to the Robinhood Chain RPC
import { readFileSync, existsSync } from 'node:fs'
import { runOnce, executorBalance } from './executor-lib.mjs'
import { AUTOINVEST_ADDRESS as BUILT_IN } from './autoinvest-address.mjs'

const key = process.env.EXECUTOR_KEY ?? (existsSync('executor.key') ? readFileSync('executor.key', 'utf8').trim() : '')
const address = process.env.AUTOINVEST_ADDRESS || BUILT_IN
if (!key || !address) { console.error('no executor key or contract address'); process.exit(2) }
const bal = await executorBalance({ rpc: process.env.RPC, key })
console.log(`executor ${bal.address} · ${bal.eth.toFixed(6)} ETH · contract ${address} · ${new Date().toISOString()}`)
const r = await runOnce({ rpc: process.env.RPC, address, key })
console.log(`plans ${r.count} · due ${r.due} · sent ${r.sent} · skipped ${r.skipped}`)
