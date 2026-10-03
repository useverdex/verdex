// Verifies a deployed Verdex contract on Sourcify (which the Robinhood Chain explorer reads from), using the
// compiler metadata saved next to the artifact. Usage: node scripts/verify-contract.mjs <Name> 0xADDRESS [0xCREATION_TX]
// Names: VerdexAutoInvest, VerdexIndexFactory, VerdexIndex, VerdexIndexRouter.
import { readFileSync } from 'node:fs'
const [name, address, creationTransactionHash] = process.argv.slice(2)
if (!name || !address) { console.error('usage: node scripts/verify-contract.mjs <Name> 0xADDRESS [0xCREATION_TX]'); process.exit(2) }
const metadata = JSON.parse(readFileSync(new URL(`../contracts/${name}.metadata.json`, import.meta.url), 'utf8'))
const sources = {}
for (const key of Object.keys(metadata.sources)) sources[key] = readFileSync(new URL(`../contracts/${key.replace(/^src\//, '')}`, import.meta.url), 'utf8')
const body = { metadata, sources, ...(creationTransactionHash ? { creationTransactionHash } : {}) }
const base = 'https://sourcify.dev/server/v2'
const r = await fetch(`${base}/verify/metadata/4663/${address}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const text = await r.text()
console.log(r.status, text.slice(0, 600))
if (!r.ok) process.exit(1)
const { verificationId } = JSON.parse(text)
for (let i = 0; i < 30; i++) {
  await new Promise((res) => setTimeout(res, 3000))
  const j = await (await fetch(`${base}/verify/${verificationId}`)).json()
  if (j.isJobCompleted) {
    console.log(JSON.stringify({ match: j.contract?.match, etherscan: j.externalVerifications?.etherscan?.explorerUrl ?? j.externalVerifications?.etherscan?.error?.slice(0, 120) }, null, 2))
    if (j.contract?.match) console.log(`\nverified (${j.contract.match}) — see https://repo.sourcify.dev/4663/${address} and https://robin.etherscan.io/address/${address}#code`)
    process.exit(j.contract?.match ? 0 : 1)
  }
  process.stdout.write('.')
}
console.log('\njob still running; check later:', `${base}/verify/${verificationId}`)
