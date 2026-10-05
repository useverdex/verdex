// Deploys Verdex Index on Base from the executor wallet (EXECUTOR_KEY env or executor.key): factory, the
// Slipstream router (treasury = TREASURY), the launch indexes planned from today's Aerodrome prices, then hands
// ownership of the router and every index to OWNER. Usage: OWNER=0x… TREASURY=0x… node scripts/deploy-base.mjs [--dry]
// Resume after a partial run with FACTORY=0x… ROUTER=0x… SKIP=VX7,… ; BASE_RPC picks the endpoint.
import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData, encodeDeployData, formatEther, parseUnits, getContractAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
const dry = process.argv.includes('--dry')
const key = (process.env.EXECUTOR_KEY || readFileSync(new URL('../executor.key', import.meta.url), 'utf8')).trim()
const account = privateKeyToAccount(key)
// OWNER: the wallet that ends up owning the router and every index. TREASURY: where the USDC fee goes on Base.
const OWNER = process.env.OWNER, TREASURY = process.env.TREASURY
if (!OWNER || !TREASURY) { console.error('set OWNER and TREASURY (addresses) in the environment'); process.exit(2) }
const CLF = '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef', USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', ZERO = '0x0000000000000000000000000000000000000000'
const FAC = JSON.parse(readFileSync(new URL('../contracts/VerdexIndexFactory.json', import.meta.url)))
const RTR = JSON.parse(readFileSync(new URL('../contracts/VerdexIndexRouterCL.json', import.meta.url)))
const IDX = JSON.parse(readFileSync(new URL('../contracts/VerdexIndex.json', import.meta.url)))
// One RPC for everything: a fallback list mixes nodes at different heights and the nonce and gas estimates drift.
const transport = http(process.env.BASE_RPC || 'https://mainnet.base.org', { retryCount: 3 })
const pub = createPublicClient({ chain: base, transport })
const wal = createWalletClient({ account, chain: base, transport })
const clf = parseAbi(['function getPool(address,address,int24) view returns (address)'])
const pool = parseAbi(['function slot0() view returns (uint160,int24,uint16,uint16,uint16,bool)', 'function token0() view returns (address)', 'function liquidity() view returns (uint128)'])
const TOKENS = { AAPL: '0xb200000000000000000000C2e324d24d7eEcd1fb', MSFT: '0xB200000000000000000000Ab99cFa739E253872B', GOOGL: '0xb2000000000000000000002D0BA3164cc74f58B7', AMZN: '0xb200000000000000000000d9192b6B456483C2E8', NVDA: '0xb20000000000000000000078ee7ce2fE4908108C', META: '0xb2000000000000000000008bC8786B856E61707C', TSLA: '0xb2000000000000000000001e800a7f5189430cD0', SPCX: '0xb2000000000000000000007b9fcbd005511aCBd5', MSTR: '0xb2000000000000000000004884b426556b92883d', PLTR: '0xb2000000000000000000007d16372840df4dabbe', SNDK: '0xb200000000000000000000397293Cb8cda9a10c5' }
const TEMPLATES = [
  ['Verdex Magnificent Seven', 'VX7', ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA']],
  ['Verdex Frontier', 'VXFRONT', ['SPCX', 'MSTR', 'PLTR', 'TSLA']],
  ['Verdex AI Infrastructure', 'VXAI', ['NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'SNDK']],
]
const CAP = parseUnits('25000', 18)
const bal = await pub.getBalance({ address: account.address })
console.log('deployer', account.address, 'ETH on Base', formatEther(bal), dry ? '(dry run)' : '')
// prices from the 10-spacing USDC pools
const price = {}
for (const [t, a] of Object.entries(TOKENS)) {
  const p = await pub.readContract({ address: CLF, abi: clf, functionName: 'getPool', args: [USDC, a, 10] })
  if (p === ZERO) { console.log(t, 'no pool'); continue }
  const [sqrt] = await pub.readContract({ address: p, abi: pool, functionName: 'slot0' })
  const t0 = await pub.readContract({ address: p, abi: pool, functionName: 'token0' })
  const raw = (Number(sqrt) / 2 ** 96) ** 2
  price[t] = (t0.toLowerCase() === USDC.toLowerCase() ? 1 / raw : raw) * 1e8 / 1e6
  console.log(t.padEnd(6), 'pool', p, 'price', price[t].toFixed(2))
}
const plans = TEMPLATES.map(([name, symbol, tickers]) => { const have = tickers.filter((t) => price[t]); return { name, symbol, tokens: have.map((t) => TOKENS[t]), units: have.map((t) => BigInt(Math.round((1 / have.length / price[t]) * 1e8))), missing: tickers.filter((t) => !price[t]) } })
for (const p of plans) console.log(p.symbol, 'units', p.units.map(String).join(' '), p.missing.length ? 'MISSING ' + p.missing.join(',') : '')
const nonce = await pub.getTransactionCount({ address: account.address })
const HAVE_F = process.env.FACTORY, HAVE_R = process.env.ROUTER // resume after the contracts exist
const F = HAVE_F ?? getContractAddress({ from: account.address, nonce: BigInt(nonce) }), R = HAVE_R ?? getContractAddress({ from: account.address, nonce: BigInt(nonce + 1) })
console.log('will deploy factory', F, 'router', R)
const gas = async (data, to) => pub.estimateGas({ account: account.address, to, data })
const facData = encodeDeployData({ abi: FAC.abi, bytecode: FAC.bytecode })
const rtrData = encodeDeployData({ abi: RTR.abi, bytecode: RTR.bytecode, args: [CLF, USDC, ZERO, TREASURY, 25] })
if (!HAVE_F) console.log('gas estimates: factory', await gas(facData), 'router', await gas(rtrData))
if (dry) process.exit(0)
if (bal < parseUnits('0.0003', 18)) { console.error('not enough ETH on Base; send 0.001 ETH to', account.address); process.exit(1) }
let next = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' })
const send = async (label, tx) => { const hash = await wal.sendTransaction({ ...tx, nonce: next++, gas: tx.gas ?? (tx.to ? 2_500_000n : 2_400_000n) }); const r = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 }); console.log(label, r.status, hash, r.contractAddress ?? ''); if (r.status !== 'success') process.exit(1); return r }
if (!HAVE_F) await send('factory', { data: facData })
if (!HAVE_R) await send('router', { data: rtrData })
const facAbi = parseAbi(['function create(string,string,address[],uint256[],uint256) returns (address)', 'function all() view returns (address[])'])
const SKIP = (process.env.SKIP ?? '').split(',').filter(Boolean) // baskets that already exist
for (const p of plans) if (p.tokens.length >= 2 && !SKIP.includes(p.symbol)) await send('create ' + p.symbol, { to: F, data: encodeFunctionData({ abi: facAbi, functionName: 'create', args: [p.name, p.symbol, p.tokens, p.units, CAP] }) })
const all = await pub.readContract({ address: F, abi: facAbi, functionName: 'all' })
console.log('indexes', all.join(' '))
const own = parseAbi(['function transferOwnership(address)'])
await send('router owner -> dev', { to: R, gas: 80_000n, data: encodeFunctionData({ abi: own, functionName: 'transferOwnership', args: [OWNER] }) })
for (const ix of all) await send(`index ${ix} owner -> dev`, { to: ix, gas: 80_000n, data: encodeFunctionData({ abi: own, functionName: 'transferOwnership', args: [OWNER] }) })
console.log('\nBASE_INDEX_FACTORY_ADDRESS =', F, '\nBASE_INDEX_ROUTER_ADDRESS =', R, '\nETH left', formatEther(await pub.getBalance({ address: account.address })))
