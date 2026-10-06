// One pass of the Orders without you executor, for a cron or a shell. The server runs the same code every
// ten minutes next to the Auto-Invest pass.
//   EXECUTOR_KEY    private key of an allowed executor (or ./executor.key next to package.json)
//   ORDERS_ADDRESS  the VerdexOrders contract (or the address built into the site)
//   RPC             optional, defaults to the Robinhood Chain RPC
import { readFileSync, existsSync } from 'node:fs'
import { runOrdersOnce, executorBalance } from './executor-lib.mjs'
import { ORDERS_ADDRESS as BUILT_IN } from './orders-address.mjs'

const key = process.env.EXECUTOR_KEY ?? (existsSync('executor.key') ? readFileSync('executor.key', 'utf8').trim() : '')
const address = process.env.ORDERS_ADDRESS || BUILT_IN
if (!key || !address) { console.error('no executor key or contract address'); process.exit(2) }
const bal = await executorBalance({ rpc: process.env.RPC, key })
console.log(`executor ${bal.address} · ${bal.eth.toFixed(6)} ETH · contract ${address} · ${new Date().toISOString()}`)
const r = await runOrdersOnce({ rpc: process.env.RPC, address, key })
console.log(`orders ${r.count} · due ${r.due} · sent ${r.sent} · skipped ${r.skipped}`)
