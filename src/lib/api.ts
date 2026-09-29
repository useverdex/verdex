import { useCallback, useMemo } from 'react'
import { resolveImg } from './img'
import { tickerLogo, tickerLogoRef, tokenLogoOverride, tokenLogoRef } from './logos'
import { useQuery } from '@tanstack/react-query'
import { pub } from './base'

export const ARC = 5042
export const ROBINHOOD = 4663
export const LIVE_CHAINS = [ROBINHOOD, ARC]
export const LIFI = 'https://li.quest/v1'
// Optional LI.FI API key (VITE_LIFI_API_KEY) lifts the public per-IP rate limit on quotes and token lists.
export const lifiInit = (): RequestInit => (import.meta.env.VITE_LIFI_API_KEY ? { headers: { 'x-lifi-api-key': String(import.meta.env.VITE_LIFI_API_KEY) } } : {})

export type Chain = { id: number; key: string; name: string; chainType: 'EVM' | 'SVM' | 'UTXO' | 'MVM' | 'TVM' | 'STL'; logoURI: string; mainnet: boolean; nativeToken?: { symbol: string; decimals: number; address: string } }
export type Tool = { key: string; name: string; logoURI: string }
export type Token = { address: string; chainId: number; symbol: string; name: string; decimals: number; priceUSD?: string; logoURI?: string }
export type AssetToken = { issuer: string; chainId: number; chain: string; address: string; symbol: string; decimals: number; price: number }
export type Asset = { ticker: string; name: string; category: string; logo?: string; price: number; marketCap: number; volume24h: number; issuers: string[]; tokens: AssetToken[] }
export type Issuer = { name: string; tokens: number; assets: number; chains: string[]; marketCap: number; volume24h: number }
export type AssetsFile = { updatedAt: number; assets: Asset[]; issuers: Issuer[] }
export type BasketHolding = { symbol: string; ticker: string; name: string; weight: number; logo?: string }
export type Basket = { chainId: number; chain: string; address: string; symbol: string; name: string; icon?: string; price: number; marketCap: number; totalSupply: number; holders: number; volume24h: number; change1m?: number; changeYtd?: number; createdAt: number; mandate?: string; tvlFeePct?: number; holdings: BasketHolding[] }
export type BasketsFile = { updatedAt: number; baskets: Basket[]; totals?: Record<string, number> }
export type Pool = { address: string; chain: string; name: string; stockSymbol: string; quoteSymbol: string; stockLogo?: string; dex: string; feePercent: number; liquidityUsd: number; volume24hUsd: number; feeApr: number }
export type PoolsFile = { snapshotDate: string; source: string; pools: Pool[] }
export type GliderHolding = { address: string; chainId: number; symbol: string; ticker: string; name: string; decimals: number; weight: number }
export type GliderBasket = { id: string; slug: string; name: string; description: string; chainId: number; chain: string; oneYearReturn?: number; investors?: number; rebalanceHours?: number; holdings: GliderHolding[] }
export type GliderFile = { snapshotDate: string; baskets: GliderBasket[] }

// Local logo overrides for chains and tools shipped with the app.
const localChainLogos = new Set([1, 10, 25, 56, 100, 8453, 122, 137, 143, 146, 324, 999, 1088, 1135, 1329, 4663, 5000, 5042, 9745, 34443, 42161, 42220, 43114, 57073, 59144, 81457, 534352, 1151111081099710, 20000000000001, 9270000000000000])
const localToolLogos = new Set(['across', '1inch', 'relaydepository', 'kyberswap', 'stargateV2', 'jupiter', 'mayan', 'okx', 'celercircle', 'sushiswap', 'near', 'bebop', 'chainflip', 'paraswap'])

export function chainLogo(chain: Pick<Chain, 'id' | 'logoURI'> | undefined) {
  if (!chain) return undefined
  return localChainLogos.has(chain.id) ? pub(`/logos/chains/${chain.id}.svg`) : resolveImg(chain.logoURI)
}
export function toolLogo(tool: Pick<Tool, 'key' | 'logoURI'> | undefined) {
  if (!tool) return undefined
  return localToolLogos.has(tool.key) ? pub(`/logos/tools/${tool.key}.svg`) : resolveImg(tool.logoURI)
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url.startsWith(LIFI) ? url : pub(url), url.startsWith(LIFI) ? { ...lifiInit(), ...init } : init)
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return (await r.json()) as T
}

// Live LI.FI data with a bundled snapshot as fallback so the site always renders.
async function withFallback<T>(live: () => Promise<T>, snapshot: string): Promise<T> {
  try {
    return await live()
  } catch {
    return getJson<T>(snapshot)
  }
}

export function useChains() {
  return useQuery({
    queryKey: ['chains'],
    queryFn: async () => {
      const data = await withFallback(() => getJson<{ chains: Chain[] }>(`${LIFI}/chains?chainTypes=EVM,SVM,UTXO,MVM,TVM,STL`), '/api/lifi-chains.json')
      return data.chains
    },
    staleTime: Infinity,
  })
}

export function useTools() {
  return useQuery({
    queryKey: ['tools'],
    queryFn: () => withFallback(() => getJson<{ bridges: Tool[]; exchanges: Tool[] }>(`${LIFI}/tools`), '/api/lifi-tools.json'),
    staleTime: Infinity,
  })
}

export function useTokens(chains: number[]) {
  return useQuery({
    queryKey: ['tokens', chains.join(',')],
    queryFn: () => withFallback(() => getJson<{ tokens: Record<string, Token[]> }>(`${LIFI}/tokens?chains=${chains.join(',')}`), '/api/lifi-tokens-arc-robinhood.json'),
    staleTime: 5 * 60_000,
  })
}

// Fill logos the snapshots leave empty with the mirrored company or token logo (see src/lib/logos.ts).
const withAssetLogos = (f: AssetsFile): AssetsFile => ({ ...f, assets: f.assets.map((a) => (a.logo ? a : { ...a, logo: tickerLogoRef(a.ticker) })) })
const withHoldingLogos = <T extends { baskets: { holdings: { symbol: string; logo?: string | null }[] }[] }>(f: T): T => ({
  ...f,
  baskets: f.baskets.map((b) => ({ ...b, holdings: b.holdings.map((h) => (h.logo ? h : { ...h, logo: tickerLogoRef(h.symbol) })) })),
})
const withAutoLogos = (f: { baskets: AutoBasket[]; updatedAt: string }) => ({
  ...f,
  baskets: f.baskets.map((b) => ({ ...b, holdings: b.holdings.map((h) => ({ ...h, logo: tokenLogoRef(h.chainId, h.address) ?? tickerLogoRef(h.symbol) })) })),
})

export function useAssets() {
  return useQuery({ queryKey: ['assets'], queryFn: () => getJson<AssetsFile>('/api/assets.json'), staleTime: 5 * 60_000, select: withAssetLogos })
}
// Robinhood's token list gives every stock token the same generic Robinhood icon. Swap it for the
// company's own logo from the asset snapshot, matched by ticker.
const GENERIC_LOGO = /cdn\.robinhood\.com\/ncw_assets\/logos\/|cdn_robinhood_com__/
export function useTokenLogo() {
  const { data } = useAssets()
  const byTicker = useMemo(() => new Map((data?.assets ?? []).filter((a) => a.logo).map((a) => [a.ticker.toUpperCase(), resolveImg(a.logo)])), [data])
  return useCallback(
    (tk?: { symbol?: string; logoURI?: string; chainId?: number; address?: string }) => {
      if (!tk) return undefined
      const override = tokenLogoOverride(tk.chainId, tk.address)
      if (override) return override
      const own = resolveImg(tk.logoURI)
      if (tk.logoURI && GENERIC_LOGO.test(tk.logoURI) && tk.symbol) return byTicker.get(tk.symbol.toUpperCase()) ?? tickerLogo(tk.symbol) ?? own
      return own
    },
    [byTicker],
  )
}

export function useBaskets() {
  return useQuery({ queryKey: ['baskets'], queryFn: () => getJson<BasketsFile>('/api/baskets-list.json'), staleTime: 5 * 60_000, select: withHoldingLogos })
}
export function useRwaPools() {
  return useQuery({ queryKey: ['rwa-pools'], queryFn: () => getJson<PoolsFile>('/data/rwa-pools.json'), staleTime: Infinity })
}
export function useGliderBaskets() {
  return useQuery({ queryKey: ['glider-baskets'], queryFn: () => getJson<GliderFile>('/data/glider-baskets.json'), staleTime: Infinity })
}

export const ASSET_CATEGORIES = ['Stocks', 'ETFs and Index Funds', 'Commodities', 'Private Credit', 'Treasuries'] as const

export const ISSUER_INFO: Record<string, { by: string; about: string; url: string }> = {
  Ondo: { by: 'Ondo Finance', about: 'Stock and ETF tokens with the suffix “on” (NVDAon), on Ethereum, BNB Chain, Solana and HyperEVM. USDY, a note secured by short-term US Treasuries, on Mantle.', url: 'https://ondo.finance/global-markets' },
  xStocks: { by: 'Backed', about: 'Stock and ETF tokens with the suffix “x” (NVDAx), on Solana and many EVM chains.', url: 'https://xstocks.fi' },
  bStocks: { by: 'A Binance affiliate', about: 'Stock tokens with the suffix “B” (NVDAB), on BNB Chain.', url: 'https://www.bstocks.finance/en' },
  Robinhood: { by: 'Robinhood', about: 'Stock tokens under the plain ticker (NVDA), on Robinhood Chain.', url: 'https://robinhood.com' },
  Coinbase: { by: 'Coinbase', about: 'Stock tokens with the suffix “c” (NVDAc), on Base.', url: 'https://www.coinbase.com' },
  Tether: { by: 'Tether', about: 'Tether Gold (XAUT): a token backed by physical gold, on Ethereum, BNB Chain, Arbitrum, Polygon and Monad.', url: 'https://gold.tether.to' },
  Paxos: { by: 'Paxos Trust Company', about: 'Pax Gold (PAXG): ownership of LBMA-accredited gold bars, on Ethereum.', url: 'https://paxos.com/pax-gold' },
  Maple: { by: 'Maple Finance', about: 'syrupUSDC and syrupUSDT: yield from overcollateralized loans to institutions, on Ethereum, Base, BNB Chain, Mantle, Plasma and Monad.', url: 'https://maple.finance' },
  'USD.AI': { by: 'USD.AI', about: 'sUSDai: yield from loans backed by GPUs, plus Treasury bills, on Arbitrum, Ethereum and Plasma.', url: 'https://usd.ai' },
  Ethena: { by: 'Ethena', about: 'USDtb: a dollar token backed by tokenized US Treasury fund products, on Ethereum.', url: 'https://usdtb.money' },
  Theo: { by: 'Theo', about: 'thBILL: short-term US Treasury rates in one token, on Arbitrum.', url: 'https://theo.xyz' },
  Backed: { by: 'Backed Assets', about: 'bCSPX: tracks the iShares Core S&P 500 ETF, on Gnosis.', url: 'https://backed.fi' },
}

const issuerLogoFiles: Record<string, string> = {
  Ondo: '/logos/issuers/ondo.png',
  Coinbase: '/logos/issuers/coinbase.png',
  Robinhood: '/logos/issuers/robinhood.svg',
  xStocks: '/logos/issuers/xstocks.png',
  bStocks: '/logos/issuers/bstocks.svg',
  Reserve: '/logos/issuers/reserve.png',
  Tether: '/logos/issuers/tether.png',
  Paxos: '/logos/issuers/paxos.png',
  Maple: '/logos/issuers/maple.png',
  'USD.AI': '/logos/issuers/usdai.png',
  Ethena: '/logos/issuers/ethena.png',
  Theo: '/logos/issuers/theo.png',
  Backed: '/logos/issuers/backed.png',
  Kamino: '/img/cdn_kamino_finance__kamino.svg',
  Verdex: '/favicon-verdex.svg',
}
export const ISSUER_LOGOS: Record<string, string> = Object.fromEntries(Object.entries(issuerLogoFiles).map(([k, v]) => [k, pub(v)]))

const chainNameLogoFiles: Record<string, string> = {
  'BNB Chain': '/logos/chains/56.svg',
  Base: '/logos/chains/8453.svg',
  Ethereum: '/logos/chains/1.svg',
  'Robinhood Chain': '/logos/chains/4663.svg',
  Solana: '/logos/chains/1151111081099710.svg',
  HyperEVM: '/logos/chains/999.svg',
  Arbitrum: '/logos/chains/42161.svg',
  Mantle: '/logos/chains/5000.svg',
  Ink: '/logos/chains/57073.svg',
  Optimism: '/logos/chains/10.svg',
  Polygon: '/logos/chains/137.svg',
  Monad: '/logos/chains/143.svg',
  Plasma: '/logos/chains/9745.svg',
  Gnosis: '/logos/chains/100.svg',
  Arc: '/logos/chains/5042.svg',
}
export const CHAIN_NAME_LOGOS: Record<string, string> = Object.fromEntries(Object.entries(chainNameLogoFiles).map(([k, v]) => [k, pub(v)]))

export const fmtUsd = (n: number | undefined, digits = 2) => (n == null || !isFinite(n) ? '-' : `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`)
export const fmtCompact = (n: number | undefined) => {
  if (n == null || !isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}
export const fmtPct = (n: number | undefined, digits = 1) => (n == null || !isFinite(n) ? '-' : `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`)

// ---- Automated baskets, discover list and Kamino lending markets ----
export type AutoHolding = { assetId: string; chainId: number; address: string; symbol: string; name: string; weight: number; logo?: string; sector?: string; theme?: string; cryptoCategory?: string; assetClass?: string }
export type AutoBasket = { id: string; slug: string; name: string; description: string; chainIds: number[]; chains: string[]; maxApy?: number; tvlUsd: number; portfolios: number; returns: Partial<Record<'1d' | '1w' | '1m' | '3m' | '6m' | '12m' | 'all', number>>; collections: string[]; createdAt: string; holdings: AutoHolding[] }
export type DiscoverBasket = { chainId: number; chain: string; address: string; symbol: string; name: string; icon?: string; tags: string[]; isStockBasket: boolean; price: number; marketCap: number; change1m?: number; holdingsCount: number; holdings: { symbol: string; weight: number; logo?: string }[] }
export type KaminoMarket = { market: string; name: string; logo?: string; collateralLogos: string[]; debtLogos: string[]; description?: string; tokenizedReserves: number; collateral: string[]; debt: string[]; suppliedUsd: number; borrowedUsd: number; borrowApyLow?: number }
export type KaminoReserve = { market: string; marketName: string; reserve: string; symbol: string; ticker: string; mint: string; tokenized: boolean; price: number; supplyApy: number; borrowApy: number; maxLtv: number; liqLtv: number; totalSupplyUsd: number; totalBorrowUsd: number; liquidityAvailableUsd: number; utilisation: number; status: string; borrowable: boolean; logo?: string }
export type KaminoMultiply = { market: string; marketName: string; collateral: string; collateralTicker: string; debt: string; kind: string; collateralLogo?: string; debtLogo?: string; depositedUsd: number; borrowedUsd: number; avgLeverage: number; positions: number; maxLeverage: number; collateralApy: number; debtApy: number; liquidityAvailableUsd: number }
export type KaminoFile = { readAt: number; markets: KaminoMarket[]; reserves: KaminoReserve[]; multiply: KaminoMultiply[]; totals: { suppliedUsd: number; borrowedUsd: number; leveredUsd: number; assets: number } }

export function useAutomatedBaskets() {
  return useQuery({ queryKey: ['automated-baskets'], queryFn: () => getJson<{ baskets: AutoBasket[]; updatedAt: string }>('/api/automated-baskets.json'), staleTime: Infinity, select: withAutoLogos })
}
export function useDiscoverBaskets() {
  return useQuery({ queryKey: ['baskets-discover'], queryFn: () => getJson<{ updatedAt: number; baskets: DiscoverBasket[] }>('/api/baskets-discover.json'), staleTime: Infinity, select: withHoldingLogos })
}
export function useKamino() {
  return useQuery({ queryKey: ['kamino'], queryFn: () => getJson<KaminoFile>('/api/kamino.json'), staleTime: Infinity })
}

export const AUTO_CATEGORIES: Record<string, string[]> = {
  'Investor trackers': ['nancy-pelosi-tracker', 'leopold-aschenbrenner-tracker', 'cathie-wood-tracker', 'warren-buffett-tracker'],
  'AI and chips': ['pure-silicon', 'pure-silicon-robinhood-chain', 'quantum', 'the-compute-grab', 'ai-full-stack', 'digital-fortress'],
  'Energy and resources': ['mine-the-future', 'energy-infrastructure', 'going-nuclear', 'hard-money', 'black-gold'],
  Sectors: ['bitwise-mag7x', 'the-magnificent-seven-portfolio', 'the-healthcare-trade', 'the-arsenal', 'neo-finance', 'road-warriors', 'consumer-brands', 'escape-velocity'],
  Crypto: ['base-ecosystem-etf', '50-50-btc-and-eth', 'the-base-app-boosted-blue-chips', 'the-big-five', 'arbitrum-defi', 'clash-of-coins'],
  'Yield and gold': ['stablecoin-yield', 'gold', 'diversified-liquid-staking-eth'],
}
export function autoCategory(b: AutoBasket) {
  for (const [c, slugs] of Object.entries(AUTO_CATEGORIES)) if (slugs.includes(b.slug)) return c
  if (b.slug.endsWith('-tracker')) return 'Investor trackers'
  return b.holdings.some((h) => h.assetClass === 'crypto') ? 'Crypto' : 'Sectors'
}
// Return figure shown on a card: the trailing year when we have it, otherwise since launch.
export function autoReturn(b: AutoBasket): { value?: number; label: string } {
  if (b.returns['12m'] != null) return { value: b.returns['12m'], label: '1-year return' }
  return { value: b.returns.all, label: 'Return since launch' }
}
