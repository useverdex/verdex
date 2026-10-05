// Moves ETH from the executor wallet on Robinhood Chain to the same wallet on Base through LI.FI (gas for the
// Base deployment). Usage: node scripts/bridge-to-base.mjs 0.0009   (amount in ETH; EXECUTOR_KEY env or executor.key)
import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
const amount = parseEther(process.argv[2] ?? '0.0009')
const key = (process.env.EXECUTOR_KEY || readFileSync(new URL('../executor.key', import.meta.url), 'utf8')).trim()
const account = privateKeyToAccount(key)
const rh = { id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com/'] } } }
const pub = createPublicClient({ chain: rh, transport: http() })
const wal = createWalletClient({ account, chain: rh, transport: http() })
const baseClient = createPublicClient({ transport: http('https://mainnet.base.org') })
const ZERO = '0x0000000000000000000000000000000000000000'
console.log('executor', account.address, 'ETH on Robinhood Chain', formatEther(await pub.getBalance({ address: account.address })), '| on Base', formatEther(await baseClient.getBalance({ address: account.address })))
const q = await (await fetch(`https://li.quest/v1/quote?fromChain=4663&toChain=8453&fromToken=${ZERO}&toToken=${ZERO}&fromAmount=${amount}&fromAddress=${account.address}&toAddress=${account.address}&integrator=verdex&slippage=0.01`)).json()
if (q.message) { console.error('no route:', q.message); process.exit(1) }
console.log('route', q.tool, 'sends', formatEther(amount), 'ETH, arrives about', formatEther(BigInt(q.estimate.toAmount)), 'ETH on Base in ~', q.estimate.executionDuration, 's')
const tx = q.transactionRequest
const hash = await wal.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value), gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined })
console.log('sent on Robinhood Chain', hash)
const r = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 })
console.log('receipt', r.status)
for (let i = 0; i < 60; i++) {
  await new Promise((res) => setTimeout(res, 10_000))
  const s = await (await fetch(`https://li.quest/v1/status?txHash=${hash}&fromChain=4663&toChain=8453&bridge=${q.tool}`)).json()
  console.log('status', s.status, s.substatus ?? '')
  if (s.status === 'DONE') break
  if (s.status === 'FAILED') process.exit(1)
}
console.log('ETH on Base now', formatEther(await baseClient.getBalance({ address: account.address })))
