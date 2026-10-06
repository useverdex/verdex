// One pass of the Vaults without you executor, for a cron or a shell. The server runs the same code every
// ten minutes next to the Auto-Invest and Orders passes.
//   EXECUTOR_KEY    private key of an allowed executor (or ./executor.key next to package.json)
//   VAULTS_ADDRESS  the VerdexVaults contract (or the address built into the site)
//   RPC             optional, defaults to the Robinhood Chain RPC
import { readFileSync, existsSync } from 'node:fs'
import { runVaultsOnce, executorBalance } from './executor-lib.mjs'
import { VAULTS_ADDRESS as BUILT_IN } from './vaults-address.mjs'

const key = process.env.EXECUTOR_KEY ?? (existsSync('executor.key') ? readFileSync('executor.key', 'utf8').trim() : '')
const address = process.env.VAULTS_ADDRESS || BUILT_IN
if (!key || !address) { console.error('no executor key or contract address'); process.exit(2) }
const bal = await executorBalance({ rpc: process.env.RPC, key })
console.log(`executor ${bal.address} · ${bal.eth.toFixed(6)} ETH · contract ${address} · ${new Date().toISOString()}`)
const r = await runVaultsOnce({ rpc: process.env.RPC, address, key })
console.log(`vaults ${r.count} · due ${r.due} · sent ${r.sent} · skipped ${r.skipped}`)
