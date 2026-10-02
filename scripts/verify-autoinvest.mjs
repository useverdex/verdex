// Verifies the deployed VerdexAutoInvest on Sourcify (which the Robinhood Chain explorer reads from),
// using the compiler metadata saved next to the artifact. Usage: node scripts/verify-autoinvest.mjs 0xADDRESS [0xCREATION_TX]
import { readFileSync } from 'node:fs'
const address = process.argv[2]
const creationTransactionHash = process.argv[3]
if (!address) { console.error('usage: node scripts/verify-autoinvest.mjs 0xADDRESS [0xCREATION_TX]'); process.exit(2) }
const metadata = JSON.parse(readFileSync(new URL('../contracts/VerdexAutoInvest.metadata.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('../contracts/VerdexAutoInvest.sol', import.meta.url), 'utf8')
const key = Object.keys(metadata.sources)[0]
const body = { metadata, sources: { [key]: source }, ...(creationTransactionHash ? { creationTransactionHash } : {}) }
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
    console.log(JSON.stringify(j, null, 2).slice(0, 1200))
    if (j.contract?.match) console.log(`\nverified (${j.contract.match}) — see https://repo.sourcify.dev/4663/${address} and https://robin.etherscan.io/address/${address}#code`)
    process.exit(j.contract?.match ? 0 : 1)
  }
  process.stdout.write('.')
}
console.log('\njob still running; check later:', `${base}/verify/${verificationId}`)
