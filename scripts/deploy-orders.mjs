// Deploys VerdexOrders on Robinhood Chain from the executor wallet (EXECUTOR_KEY env or executor.key), with
// that wallet as the first executor, then hands the admin role to OWNER. Usage: OWNER=0x… node scripts/deploy-orders.mjs [--dry]
import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, formatEther, encodeFunctionData, parseAbi, getContractAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
const dry = process.argv.includes('--dry')
const OWNER = process.env.OWNER
if (!OWNER) { console.error('set OWNER (the wallet that ends up as admin)'); process.exit(2) }
const key = (process.env.EXECUTOR_KEY || readFileSync(new URL('../executor.key', import.meta.url), 'utf8')).trim()
const account = privateKeyToAccount(key)
const ART = JSON.parse(readFileSync(new URL('../contracts/VerdexOrders.json', import.meta.url)))
const FACTORY = '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA', USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'
const rh = { id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com/'] } } }
const pub = createPublicClient({ chain: rh, transport: http() })
const wal = createWalletClient({ account, chain: rh, transport: http() })
const nonce = await pub.getTransactionCount({ address: account.address })
console.log('deployer', account.address, 'ETH', formatEther(await pub.getBalance({ address: account.address })), 'nonce', nonce, 'will deploy at', getContractAddress({ from: account.address, nonce: BigInt(nonce) }), dry ? '(dry run)' : '')
if (dry) process.exit(0)
const hash = await wal.deployContract({ abi: ART.abi, bytecode: ART.bytecode, args: [FACTORY, USDG, account.address] })
const r = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 })
console.log('deploy', r.status, hash, r.contractAddress, 'gas', r.gasUsed)
if (r.status !== 'success') process.exit(1)
const h2 = await wal.sendTransaction({ to: r.contractAddress, data: encodeFunctionData({ abi: parseAbi(['function transferAdmin(address)']), functionName: 'transferAdmin', args: [OWNER] }) })
const r2 = await pub.waitForTransactionReceipt({ hash: h2, timeout: 180_000 })
console.log('admin -> owner', r2.status, h2)
console.log('\nORDERS_ADDRESS =', r.contractAddress, '\nETH left', formatEther(await pub.getBalance({ address: account.address })))
