import { useQuery } from '@tanstack/react-query'
import { createPublicClient, erc20Abi, fallback, http, parseUnits, type Address } from 'viem'
import { LIFI, lifiInit, type Chain, type Token } from './api'
import { pub } from './base'

export type Quote = {
  id: string
  type: string
  tool: string
  toolDetails: { key: string; name: string; logoURI: string }
  action: { fromChainId: number; toChainId: number; fromToken: Token; toToken: Token; fromAmount: string; fromAddress: string; toAddress: string; slippage: number }
  estimate: { fromAmount: string; toAmount: string; toAmountMin: string; approvalAddress: string; executionDuration: number; fromAmountUSD?: string; toAmountUSD?: string; gasCosts?: { amountUSD: string }[]; feeCosts?: { name: string; amountUSD: string }[] }
  transactionRequest?: { to: Address; data: `0x${string}`; value?: string; gasLimit?: string; gasPrice?: string; chainId: number; from?: Address }
  includedSteps?: { tool: string; toolDetails: { name: string; logoURI: string }; type: string }[]
}

export const PLACEHOLDER_ADDRESS = '0x1111111111111111111111111111111111111111'
export const INTEGRATOR = 'verdex'

export function isNative(address: string) {
  return address === '0x0000000000000000000000000000000000000000' || address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
}

export async function fetchQuote(p: { fromChain: number; toChain: number; fromToken: string; toToken: string; fromAmount: string; fromAddress: string; toAddress?: string; slippage?: number; fee?: number; signal?: AbortSignal }): Promise<Quote> {
  const q = new URLSearchParams({
    fromChain: String(p.fromChain),
    toChain: String(p.toChain),
    fromToken: p.fromToken,
    toToken: p.toToken,
    fromAmount: p.fromAmount,
    fromAddress: p.fromAddress,
    integrator: INTEGRATOR,
    slippage: String(p.slippage ?? 0.005),
    order: 'RECOMMENDED',
  })
  if (p.toAddress) q.set('toAddress', p.toAddress)
  if (p.fee) q.set('fee', String(p.fee))
  const r = await fetch(`${LIFI}/quote?${q}`, { ...lifiInit(), signal: p.signal })
  if (!r.ok) {
    let msg = `Quote failed (${r.status})`
    try {
      const j = await r.json()
      msg = j.message ?? msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return (await r.json()) as Quote
}

export function useQuote(p: { fromChain?: number; toChain?: number; fromToken?: Token; toToken?: Token; amount: string; fromAddress?: string; toAddress?: string; slippage: number }) {
  const enabled = !!(p.fromChain && p.toChain && p.fromToken && p.toToken && Number(p.amount) > 0)
  let fromAmount = '0'
  try {
    fromAmount = enabled ? parseUnits(p.amount as `${number}`, p.fromToken!.decimals).toString() : '0'
  } catch {
    fromAmount = '0'
  }
  return useQuery({
    queryKey: ['quote', p.fromChain, p.toChain, p.fromToken?.address, p.toToken?.address, fromAmount, p.fromAddress, p.toAddress, p.slippage],
    queryFn: ({ signal }) => fetchQuote({ fromChain: p.fromChain!, toChain: p.toChain!, fromToken: p.fromToken!.address, toToken: p.toToken!.address, fromAmount, fromAddress: p.fromAddress ?? PLACEHOLDER_ADDRESS, toAddress: p.toAddress, slippage: p.slippage, signal }),
    enabled: enabled && fromAmount !== '0',
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  })
}

export function useChainTokens(chainId?: number) {
  return useQuery({
    queryKey: ['chain-tokens', chainId],
    queryFn: async () => {
      try {
        const r = await fetch(`${LIFI}/tokens?chains=${chainId}`, lifiInit())
        if (!r.ok) throw new Error('tokens')
        const j = (await r.json()) as { tokens: Record<string, Token[]> }
        return j.tokens[String(chainId)] ?? []
      } catch (e) {
        // Robinhood Chain and Arc ship with a token list snapshot for when LI.FI is unreachable or rate-limited.
        const r = await fetch(pub('/api/lifi-tokens-arc-robinhood.json'))
        const j = (await r.json()) as { tokens: Record<string, Token[]> }
        if (j.tokens[String(chainId)]) return j.tokens[String(chainId)]
        throw e
      }
    },
    enabled: !!chainId,
    staleTime: 10 * 60_000,
  })
}

// Public RPC clients retry rate-limited or flaky responses and fall back to the chain's other endpoints.
export function publicClientFor(chain: Chain & { metamask?: { rpcUrls?: string[] } }) {
  const urls = chain.metamask?.rpcUrls?.filter((u) => /^https?:/.test(u)) ?? []
  const transports = (urls.length ? urls : [undefined]).map((u) => http(u, { retryCount: 4, retryDelay: 500, timeout: 20_000 }))
  return createPublicClient({ transport: transports.length > 1 ? fallback(transports, { rank: false }) : transports[0] })
}

export async function readAllowance(chain: Chain & { metamask?: { rpcUrls?: string[] } }, token: Address, owner: Address, spender: Address) {
  const client = publicClientFor(chain)
  return client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [owner, spender] })
}

export async function readBalance(chain: Chain & { metamask?: { rpcUrls?: string[] } }, token: string, owner: Address) {
  const client = publicClientFor(chain)
  if (isNative(token)) return client.getBalance({ address: owner })
  return client.readContract({ address: token as Address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] })
}

export const fmtAmount = (raw: string | undefined, decimals: number) => {
  if (!raw) return '-'
  const n = Number(raw) / 10 ** decimals
  if (n === 0) return '0'
  if (n < 1e-4) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : n < 1000 ? 4 : 2 })
}
export const fmtDuration = (s: number) => (s < 60 ? `~${Math.max(1, Math.round(s))} sec` : s < 3600 ? `~${Math.round(s / 60)} min` : `~${Math.round(s / 3600)} hour`)

export type ChainX = Chain & { metamask?: { chainName?: string; rpcUrls?: string[]; nativeCurrency?: { name: string; symbol: string; decimals: number }; blockExplorerUrls?: string[] } }

// Parameters a wallet needs to add a chain it does not know yet.
export function chainMeta(c: ChainX) {
  return { name: c.metamask?.chainName ?? c.name, rpcUrls: c.metamask?.rpcUrls ?? [], nativeCurrency: c.metamask?.nativeCurrency ?? { name: c.nativeToken?.symbol ?? 'ETH', symbol: c.nativeToken?.symbol ?? 'ETH', decimals: c.nativeToken?.decimals ?? 18 }, blockExplorerUrls: c.metamask?.blockExplorerUrls }
}

export async function waitForTx(chain: ChainX, hash: `0x${string}`) {
  const client = publicClientFor(chain)
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 }).catch(() => undefined)
}

export function describeError(e: unknown) {
  const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? 'Something went wrong.'
  if (/rejected|denied/i.test(msg)) return 'The request was declined in your wallet. Nothing has moved.'
  if (/insufficient funds/i.test(msg)) return 'Your address needs more of the gas token to cover the network fee.'
  return msg.length > 220 ? msg.slice(0, 220) + '…' : msg
}

const EXPLORERS: Record<number, string> = { 1: 'https://etherscan.io', 8453: 'https://basescan.org', 42161: 'https://arbiscan.io', 4663: 'https://robin.etherscan.io', 10: 'https://optimistic.etherscan.io', 137: 'https://polygonscan.com', 56: 'https://bscscan.com' }
export function explorerTx(chain: ChainX | undefined, chainId: number, hash: string) {
  const base = chain?.metamask?.blockExplorerUrls?.[0]?.replace(/\/$/, '') ?? EXPLORERS[chainId]
  return base ? `${base}/tx/${hash}` : undefined
}
