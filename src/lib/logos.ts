// Local mirror of every remote logo the site renders (public/img/logos/<fnv>.webp, listed in src/data/logos.json).
// Keys are the FNV-1a hash of the normalised source URL, so any component can swap a remote URL for the local copy.
// The hosted preview can't hold hundreds of files, so its build packs them into one JSON of data URIs instead.
import manifest from '../data/logos.json'
import { pub } from './base'

type Manifest = { files: string[]; tokens: Record<string, string>; tickers: Record<string, string> }
const m = manifest as Manifest
const files = new Set(m.files)
let pack: Record<string, string> | null = null

export async function loadLogoPack() {
  try {
    const r = await fetch(pub('/img/logo-pack.json'))
    if (r.ok) pack = (await r.json()) as Record<string, string>
  } catch {
    /* fall back to the individual files */
  }
}

export const fileUrl = (f: string) => pack?.[f] ?? pub(`/img/logos/${f}.webp`)

export function fnv(str: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// Mirrored copy of a remote logo URL, if we have one.
export function mirroredLogo(url: string) {
  const f = fnv(url)
  return files.has(f) ? fileUrl(f) : undefined
}

// Real logo for a token whose list entry has none (looked up on GeckoTerminal by chain and address).
export function tokenLogoOverride(chainId?: number, address?: string) {
  if (!chainId || !address) return undefined
  const f = m.tokens[`${chainId}:${address.toLowerCase()}`]
  return f ? fileUrl(f) : undefined
}

// Company logo for a stock ticker the asset list does not cover.
export function tickerLogo(ticker?: string) {
  const f = ticker ? m.tickers[ticker.toUpperCase()] : undefined
  return f ? fileUrl(f) : undefined
}

// "logo:<hash>" references let data files point at a mirrored logo; resolveImg turns them into URLs.
export function tokenLogoRef(chainId?: number, address?: string) {
  const f = chainId && address ? m.tokens[`${chainId}:${address.toLowerCase()}`] : undefined
  return f ? `logo:${f}` : undefined
}
export function tickerLogoRef(ticker?: string) {
  const f = ticker ? m.tickers[ticker.toUpperCase()] : undefined
  return f ? `logo:${f}` : undefined
}
