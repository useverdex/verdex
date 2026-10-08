// Copy a wallet: read the tokenized stocks any address holds on Robinhood Chain, value them at the pools and
// turn them into weights. The page then hands those weights to the engines that already exist: a Vault on this
// device to buy the same mix (funded from the Vaults page), or a Vault without you to keep it at those weights.
import { useQuery } from '@tanstack/react-query'
import { erc20Abi, formatUnits, isAddress, type Address } from 'viem'
import type { Asset } from './api'
import { deepEnough, poolFor } from './autopilot'
import { MULTICALL3, client, stockTokens, type Pool, type StockToken } from './pools'

export type Holding = { stock: StockToken; pool?: Pool; units: number; usd: number; weight: number; copyable: boolean }
export type WalletCopy = { address: Address; holdings: Holding[]; totalUsd: number; copyableUsd: number; copyable: Holding[]; at: number }

export async function readWalletStocks(address: Address, assets: Asset[], pools: Pool[]): Promise<WalletCopy> {
  const stocks = stockTokens(assets)
  const c = client()
  const res = await c.multicall({ multicallAddress: MULTICALL3, batchSize: 4096, contracts: stocks.map((s) => ({ address: s.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] } as const)) })
  const holdings: Holding[] = []
  stocks.forEach((stock, i) => {
    const bal = res[i].status === 'success' ? (res[i].result as bigint) : 0n
    if (bal === 0n) return
    const pool = poolFor(stock, pools)
    const units = Number(formatUnits(bal, stock.decimals))
    const price = pool?.priceUsd ?? 0
    holdings.push({ stock, pool, units, usd: units * price, weight: 0, copyable: !!pool && deepEnough(pool) && units * price >= 0.5 })
  })
  const totalUsd = holdings.reduce((s, h) => s + h.usd, 0)
  const copyable = holdings.filter((h) => h.copyable)
  const copyableUsd = copyable.reduce((s, h) => s + h.usd, 0)
  for (const h of holdings) h.weight = copyableUsd > 0 && h.copyable ? (h.usd / copyableUsd) * 100 : 0
  holdings.sort((a, b) => b.usd - a.usd)
  return { address, holdings, totalUsd, copyableUsd, copyable: holdings.filter((h) => h.copyable), at: Date.now() }
}
export function useWalletStocks(address: string, assets: Asset[] | undefined, pools: Pool[] | undefined) {
  const ok = isAddress(address)
  return useQuery({ queryKey: ['copy-wallet', address.toLowerCase(), pools?.length ?? 0], queryFn: () => readWalletStocks(address as Address, assets!, pools!), enabled: ok && !!assets && !!pools, staleTime: 30_000, retry: 1 })
}
// A vault holds at most twelve legs: the twelve largest positions, renormalised, are what gets copied.
export const MAX_LEGS = 12
export function topLegs(copyable: Holding[]): Holding[] { const top = [...copyable].sort((a, b) => b.usd - a.usd).slice(0, MAX_LEGS); const sum = top.reduce((s, h) => s + h.usd, 0); return top.map((h) => ({ ...h, weight: sum > 0 ? (h.usd / sum) * 100 : 0 })) }
// The query string the Vaults without you composer reads: TICKER:WEIGHT pairs.
export const targetsQuery = (copyable: Holding[]) => topLegs(copyable).map((h) => `${h.stock.ticker}:${h.weight.toFixed(1)}`).join(',')
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
