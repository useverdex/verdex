// Deploys VerdexAutoInvestCL (Auto-Invest without you on Base) from the executor wallet (EXECUTOR_KEY env or executor.key), with that
// wallet as the first executor, then hands the admin role to OWNER. One RPC, explicit gas and nonces (public Base nodes
// estimate on lagging state). Usage: OWNER=0x… node scripts/deploy-autoinvest-base.mjs [--dry]   (BASE_RPC picks the endpoint)
import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, formatEther, encodeFunctionData, encodeDeployData, parseAbi, getContractAddress, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
const dry = process.argv.includes('--dry')
const OWNER = process.env.OWNER
if (!OWNER) { console.error('set OWNER (the wallet that ends up as admin)'); process.exit(2) }
const key = (process.env.EXECUTOR_KEY || readFileSync(new URL('../executor.key', import.meta.url), 'utf8')).trim()
const account = privateKeyToAccount(key)
const ART = JSON.parse(readFileSync(new URL('../contracts/VerdexAutoInvestCL.json', import.meta.url)))
const CLF = '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef', USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const transport = http(process.env.BASE_RPC || 'https://mainnet.base.org', { retryCount: 3, timeout: 60_000 })
const pub = createPublicClient({ chain: base, transport })
const wal = createWalletClient({ account, chain: base, transport })
const bal = await pub.getBalance({ address: account.address })
const nonce = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' })
const data = encodeDeployData({ abi: ART.abi, bytecode: ART.bytecode, args: [CLF, account.address] })
console.log('deployer', account.address, 'ETH on Base', formatEther(bal), 'nonce', nonce, 'will deploy at', getContractAddress({ from: account.address, nonce: BigInt(nonce) }), dry ? '(dry run)' : '')
const est = await pub.estimateGas({ account: account.address, data }).catch((e) => { console.log('gas estimate failed: ' + (e.shortMessage ?? e.message).slice(0, 80)); return 2_500_000n })
console.log('gas estimate', est)
if (dry) process.exit(0)
if (bal < parseUnits('0.0002', 18)) { console.error('not enough ETH on Base'); process.exit(1) }
let next = nonce
const send = async (label, tx) => { const hash = await wal.sendTransaction({ ...tx, nonce: next++, gas: tx.gas ?? 2_000_000n }); const r = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 }); console.log(label, r.status, hash, r.contractAddress ?? '', 'gas', r.gasUsed); if (r.status !== 'success') process.exit(1); return r }
const r = await send('deploy', { data, gas: (est * 12n) / 10n })
await send('admin -> owner', { to: r.contractAddress, data: encodeFunctionData({ abi: parseAbi(['function transferAdmin(address)']), functionName: 'transferAdmin', args: [OWNER] }), gas: 100_000n })
console.log('\nBASE_AUTOINVEST_ADDRESS =', r.contractAddress, '\nETH left on Base', formatEther(await pub.getBalance({ address: account.address })))
