// Deploys Lend v3 and Leverage v2 (the audited contracts) on Robinhood Chain from the executor wallet, recreates the
// live markets from scripts/lend-markets.json with the same parameters, copies the Leverage caps, and hands both
// contracts to OWNER. Usage: OWNER=0x… node scripts/deploy-lend-v3.mjs [--dry]   (RPC env to point at a fork)
import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, formatEther, parseAbi, getContractAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { TREASURY_ADDRESS } from './treasury-address.mjs'
const dry = process.argv.includes('--dry')
const OWNER = process.env.OWNER
if (!OWNER) { console.error('set OWNER (the wallet that ends up owning both contracts)'); process.exit(2) }
const key = (process.env.EXECUTOR_KEY || readFileSync(new URL('../executor.key', import.meta.url), 'utf8')).trim()
const account = privateKeyToAccount(key)
const LEND = JSON.parse(readFileSync(new URL('../contracts/VerdexLend.json', import.meta.url)))
const LEV = JSON.parse(readFileSync(new URL('../contracts/VerdexLeverage.json', import.meta.url)))
const MARKETS = JSON.parse(readFileSync(new URL('./lend-markets.json', import.meta.url)))
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', VERDEX = '0x96f455a90a80dcf0c2df6703ea4ba3bedf286e43', FEE_BPS = 25
const rh = { id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [process.env.RPC || 'https://rpc.mainnet.chain.robinhood.com/'] } } }
const pub = createPublicClient({ chain: rh, transport: http(undefined, { timeout: 120_000 }) })
const wal = createWalletClient({ account, chain: rh, transport: http(undefined, { timeout: 120_000 }) })
const lendAbi = parseAbi(['function createMarket(address collateral,address loan,address pool,uint16 ltvBps,uint16 liqThresholdBps,uint16 liqBonusBps,uint32 twapWindow,uint64 rateBaseBps,uint64 rateSlopeBps,uint256 supplyCap,uint256 borrowCap,uint256 collateralCap) returns (uint256)', 'function marketCount() view returns (uint256)', 'function transferOwnership(address to)', 'function owner() view returns (address)'])
const levAbi = parseAbi(['function setCaps(uint256[] ids,uint256[] maxes)', 'function transferOwnership(address to)', 'function owner() view returns (address)'])
const wait = (hash) => pub.waitForTransactionReceipt({ hash, timeout: 180_000 })
const nonce = await pub.getTransactionCount({ address: account.address })
console.log('deployer', account.address, 'ETH', formatEther(await pub.getBalance({ address: account.address })), 'nonce', nonce, 'lend at', getContractAddress({ from: account.address, nonce: BigInt(nonce) }), dry ? '(dry run)' : '')
console.log('markets to recreate', MARKETS.length, '· treasury', TREASURY_ADDRESS, '· fee', FEE_BPS, 'bps')
if (dry) process.exit(0)
const h = await wal.deployContract({ abi: LEND.abi, bytecode: LEND.bytecode, args: [TREASURY_ADDRESS] })
const r = await wait(h); console.log('lend v3', r.status, r.contractAddress, 'gas', r.gasUsed); if (r.status !== 'success') process.exit(1)
const lend = r.contractAddress
for (const m of MARKETS) {
  const hm = await wal.writeContract({ address: lend, abi: lendAbi, functionName: 'createMarket', args: [m.collateral, m.loan, m.pool, m.ltvBps, m.liqThresholdBps, m.liqBonusBps, m.twapWindow, BigInt(m.rateBaseBps), BigInt(m.rateSlopeBps), BigInt(m.supplyCap), BigInt(m.borrowCap), BigInt(m.collateralCap)] })
  const rm = await wait(hm); console.log(`market ${m.id}`, rm.status, 'gas', rm.gasUsed); if (rm.status !== 'success') process.exit(1)
}
console.log('marketCount', await pub.readContract({ address: lend, abi: lendAbi, functionName: 'marketCount' }))
const h2 = await wal.deployContract({ abi: LEV.abi, bytecode: LEV.bytecode, args: [lend, USDG, VERDEX, TREASURY_ADDRESS, FEE_BPS] })
const r2 = await wait(h2); console.log('leverage v2', r2.status, r2.contractAddress, 'gas', r2.gasUsed); if (r2.status !== 'success') process.exit(1)
const lev = r2.contractAddress
const hc = await wal.writeContract({ address: lev, abi: levAbi, functionName: 'setCaps', args: [MARKETS.map((m) => BigInt(m.id)), MARKETS.map((m) => BigInt(m.levCap))] })
console.log('caps', (await wait(hc)).status)
const ho = await wal.writeContract({ address: lend, abi: lendAbi, functionName: 'transferOwnership', args: [OWNER] }); console.log('lend owner -> OWNER', (await wait(ho)).status)
const ho2 = await wal.writeContract({ address: lev, abi: levAbi, functionName: 'transferOwnership', args: [OWNER] }); console.log('leverage owner -> OWNER', (await wait(ho2)).status)
console.log('\nLEND_ADDRESS =', lend, '\nLEVERAGE_ADDRESS =', lev, '\nETH left', formatEther(await pub.getBalance({ address: account.address })))
