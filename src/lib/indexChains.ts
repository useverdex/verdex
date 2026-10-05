// The chains Verdex Index runs on. Each entry names the DEX whose pools price and fill the stocks, the
// quote token the router takes, and the deployed factory and router. Robinhood Chain uses the Uniswap v3
// contracts there; Base uses Aerodrome Slipstream, whose pools are keyed by tick spacing instead of fee.
import { isAddress, type Address } from 'viem'
import { BASE_INDEX_FACTORY_ADDRESS, BASE_INDEX_ROUTER_ADDRESS, INDEX_FACTORY_ADDRESS as F0, INDEX_ROUTER_ADDRESS as R0 } from '../../scripts/index-addresses.mjs'
import { ROBINHOOD } from './api'
import { VERDEX_TOKEN } from './holding'

export const BASE = 8453
export type PoolToken = { address: Address; symbol: string; decimals: number }
export type IndexChainKey = 'robinhood' | 'base'
export type IndexChain = {
  key: IndexChainKey
  id: number
  name: string
  rpcUrls: string[]
  explorer: string
  dex: 'uniswap-v3' | 'slipstream'
  dexName: string
  dexFactory: Address
  tiers: number[] // fee tiers (pips) for Uniswap v3, tick spacings for Slipstream
  quote: PoolToken
  verdex: Address // zero where VERDEX does not exist, so no fee waiver
  dexscreener: string
  factory: Address
  router: Address
  deployed: boolean
  factoryAddress: string
  routerAddress: string
}

const env = (k: string) => String((import.meta.env as Record<string, string | undefined>)[k] ?? '').trim()
const ZERO = '0x0000000000000000000000000000000000000000' as Address
const addr = (s: string) => (isAddress(s) ? (s as Address) : ZERO)
const mk = (c: Omit<IndexChain, 'factory' | 'router' | 'deployed'>): IndexChain => ({ ...c, factory: addr(c.factoryAddress), router: addr(c.routerAddress), deployed: isAddress(c.factoryAddress) && isAddress(c.routerAddress) })

export const ROBINHOOD_INDEX = mk({
  key: 'robinhood',
  id: ROBINHOOD,
  name: 'Robinhood Chain',
  rpcUrls: ['https://rpc.mainnet.chain.robinhood.com/'],
  explorer: 'https://robin.etherscan.io',
  dex: 'uniswap-v3',
  dexName: 'Uniswap v3',
  dexFactory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
  tiers: [100, 500, 3000, 10000],
  quote: { address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', symbol: 'USDG', decimals: 6 },
  verdex: VERDEX_TOKEN.address as Address,
  dexscreener: 'robinhood',
  factoryAddress: (env('VITE_INDEX_FACTORY_ADDRESS') || F0).trim(),
  routerAddress: (env('VITE_INDEX_ROUTER_ADDRESS') || R0).trim(),
})
export const BASE_INDEX = mk({
  key: 'base',
  id: BASE,
  name: 'Base',
  rpcUrls: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://base.drpc.org'],
  explorer: 'https://basescan.org',
  dex: 'slipstream',
  dexName: 'Aerodrome',
  dexFactory: '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef',
  tiers: [1, 10, 50, 100, 200],
  quote: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  verdex: ZERO,
  dexscreener: 'base',
  factoryAddress: (env('VITE_BASE_INDEX_FACTORY_ADDRESS') || BASE_INDEX_FACTORY_ADDRESS).trim(),
  routerAddress: (env('VITE_BASE_INDEX_ROUTER_ADDRESS') || BASE_INDEX_ROUTER_ADDRESS).trim(),
})
export const INDEX_CHAINS: IndexChain[] = [ROBINHOOD_INDEX, BASE_INDEX]
export const indexChain = (key: string | undefined) => INDEX_CHAINS.find((c) => c.key === key) ?? ROBINHOOD_INDEX
// The fee tier the router expects per leg: the v3 fee, or the Slipstream tick spacing.
export const legTier = (ic: IndexChain, pool: { fee: number; spacing: number }) => (ic.dex === 'slipstream' ? pool.spacing : pool.fee)
