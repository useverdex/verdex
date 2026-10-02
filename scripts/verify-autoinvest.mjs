// Verifies the deployed VerdexAutoInvest on Sourcify (which the Robinhood Chain explorer reads from),
// using the compiler metadata saved next to the artifact. Usage: node scripts/verify-autoinvest.mjs 0xADDRESS
import { readFileSync } from 'node:fs'
const address = process.argv[2]
if (!address) { console.error('usage: node scripts/verify-autoinvest.mjs 0xADDRESS'); process.exit(2) }
const metadata = readFileSync(new URL('../contracts/VerdexAutoInvest.metadata.json', import.meta.url), 'utf8')
const source = readFileSync(new URL('../contracts/VerdexAutoInvest.sol', import.meta.url), 'utf8')
const key = Object.keys(JSON.parse(metadata).sources)[0]
const body = { address, chain: '4663', files: { 'metadata.json': metadata, [key]: source } }
const r = await fetch('https://sourcify.dev/server/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const text = await r.text()
console.log(r.status, text.slice(0, 600))
if (r.ok) console.log(`\nsee https://repo.sourcify.dev/4663/${address} and https://robin.etherscan.io/address/${address}#code`)
