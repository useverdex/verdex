import { pub } from './base'
import { fileUrl, mirroredLogo } from './logos'

// Resolves logo URLs from the data snapshots. The upstream data used an image proxy with
// base64url-encoded source URLs; we decode them and prefer a locally bundled copy when we have one.
export const TOKEN_LOGOS = {
  ETH: '/img/tokens/eth.png',
  USDC: '/img/tokens/usdc.png',
  USDG: '/img/tokens/usdg.png',
  BNB: '/img/tokens/bnb.png',
} as const

const localByOrigin: Record<string, string> = {
  'https://cdn.kamino.finance/kamino.svg': '/img/cdn_kamino_finance__kamino.svg',
  'https://s2.coinmarketcap.com/static/img/coins/64x64/33793.png': TOKEN_LOGOS.USDG,
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png': TOKEN_LOGOS.USDC,
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png': TOKEN_LOGOS.ETH,
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png': TOKEN_LOGOS.ETH,
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png': TOKEN_LOGOS.BNB,
}

function decodeB64Url(s: string): string | null {
  try {
    const pad = s + '='.repeat((4 - (s.length % 4)) % 4)
    return atob(pad.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return null
  }
}

export function resolveImg(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('data:')) return url
  if (url.startsWith('logo:')) return fileUrl(url.slice('logo:'.length))
  let u = url
  if (u.startsWith('/api/img/')) {
    const orig = decodeB64Url(u.slice('/api/img/'.length))
    if (!orig) return undefined
    u = orig
  }
  if (u.startsWith('ttps://')) u = 'h' + u
  if (u.startsWith('ipfs://')) u = `https://ipfs.io/ipfs/${u.slice('ipfs://'.length)}`
  if (!/^https?:/.test(u)) return pub(u)
  if (u.endsWith('/tokens/unknown.svg')) return undefined
  const local = mirroredLogo(u)
  if (local) return local
  if (localByOrigin[u]) return pub(localByOrigin[u])
  try {
    const parsed = new URL(u)
    const known = mirrored[`${parsed.hostname.replace(/\./g, '_')}__${parsed.pathname.split('/').pop() ?? ''}`]
    if (known) return pub(known)
  } catch {
    /* ignore */
  }
  return u
}

// Mirrored token artwork (host__filename). Anything missing here falls back to the source URL.
const mirrored: Record<string, string> = Object.fromEntries(
  [
    'cdn_ondo_finance__tslaon_160x160.png', 'cdn_ondo_finance__aaplon_160x160.png', 'cdn_ondo_finance__crclon_160x160.png',
    'cdn_ondo_finance__fxion_160x160.png', 'cdn_ondo_finance__googlon_160x160.png', 'cdn_ondo_finance__gldon_160x160.png',
    'cdn_ondo_finance__iauon_160x160.png', 'cdn_ondo_finance__metaon_160x160.png', 'cdn_ondo_finance__mstron_160x160.png',
    'cdn_ondo_finance__muon_160x160.png', 'cdn_ondo_finance__nvdaon_160x160.png', 'cdn_ondo_finance__qqqon_160x160.png',
    'cdn_ondo_finance__soxlon_160x160.png', 'cdn_ondo_finance__sndkon_160x160.png', 'cdn_ondo_finance__spcxon_160x160.png',
    'cdn_ondo_finance__spyon_160x160.png',
    'cdn_robinhood_com__0x117cc2133c37b721f49de2a7a74833232b3b4c0c.png', 'cdn_robinhood_com__0x322f0929c4625ed5bad873c95208d54e1c003b2d.png',
    'cdn_robinhood_com__0xaf3d76f1834a1d425780943c99ea8a608f8a93f9.png', 'cdn_robinhood_com__0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec.png',
    'static_debank_com__c67db744859c16615fa81fcb3a71b3ae.png', 'static_debank_com__a100487c27e4e6e5557ef770230c7f8b.png',
    'static_debank_com__790d0c3a6da87111b66255c0d57108fa.png',
  ].map((f) => [f, `/img/${f}`]),
)

// Reserve basket icons are keyed by their folio hash filename.
export function reserveIcon(name: string) {
  return pub(`/img/folio-assets_reserve_org__${name}`)
}
