// Deploys VerdexVote (Holders vote) on Robinhood Chain from the executor wallet (EXECUTOR_KEY env or executor.key), opens
// round 1 from scripts/vote-round-1.json, then hands the admin role to OWNER. Usage: OWNER=0x… node scripts/deploy-vote.mjs [--dry]
import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, formatEther, encodeFunctionData, parseAbi, getContractAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
const dry = process.argv.includes('--dry')
const OWNER = process.env.OWNER
if (!OWNER) { console.error('set OWNER (the wallet that ends up as admin)'); process.exit(2) }
const key = (process.env.EXECUTOR_KEY || readFileSync(new URL('../executor.key', import.meta.url), 'utf8')).trim()
const account = privateKeyToAccount(key)
const ART = JSON.parse(readFileSync(new URL('../contracts/VerdexVote.json', import.meta.url)))
const ROUND = JSON.parse(readFileSync(new URL('./vote-round-1.json', import.meta.url)))
const VERDEX = '0x96f455a90a80dcf0c2df6703ea4ba3bedf286e43'
const rh = { id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [process.env.RPC || 'https://rpc.mainnet.chain.robinhood.com/'] } } }
const pub = createPublicClient({ chain: rh, transport: http() })
const wal = createWalletClient({ account, chain: rh, transport: http() })
const nonce = await pub.getTransactionCount({ address: account.address })
console.log('deployer', account.address, 'ETH', formatEther(await pub.getBalance({ address: account.address })), 'nonce', nonce, 'will deploy at', getContractAddress({ from: account.address, nonce: BigInt(nonce) }), dry ? '(dry run)' : '')
console.log('round 1:', ROUND.title, '·', ROUND.options.length, 'options · closes in', ROUND.closesInDays, 'days')
if (dry) process.exit(0)
const hash = await wal.deployContract({ abi: ART.abi, bytecode: ART.bytecode, args: [VERDEX] })
const r = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 })
console.log('deploy', r.status, hash, r.contractAddress, 'gas', r.gasUsed)
if (r.status !== 'success') process.exit(1)
const closesAt = Math.floor(Date.now() / 1000) + ROUND.closesInDays * 86400
const h1 = await wal.sendTransaction({ to: r.contractAddress, data: encodeFunctionData({ abi: parseAbi(['function openRound(string title,string[] options,uint40 closesAt) returns (uint256)']), functionName: 'openRound', args: [ROUND.title, ROUND.options, closesAt] }) })
const r1 = await pub.waitForTransactionReceipt({ hash: h1, timeout: 180_000 })
console.log('round 1 opened', r1.status, h1, 'closes', new Date(closesAt * 1000).toISOString())
const h2 = await wal.sendTransaction({ to: r.contractAddress, data: encodeFunctionData({ abi: parseAbi(['function transferAdmin(address)']), functionName: 'transferAdmin', args: [OWNER] }) })
const r2 = await pub.waitForTransactionReceipt({ hash: h2, timeout: 180_000 })
console.log('admin -> owner', r2.status, h2)
console.log('\nVOTE_ADDRESS =', r.contractAddress, '\nETH left', formatEther(await pub.getBalance({ address: account.address })))
