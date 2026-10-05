// Solana wallets in the browser: the injected providers (Phantom, Solflare, Backpack and anything on
// window.solana) plus wallets that register through the Wallet Standard. A tiny store the page subscribes to.
import { useSyncExternalStore } from 'react'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'

type Injected = { isPhantom?: boolean; publicKey?: { toBase58(): string } | null; isConnected?: boolean; connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: { toBase58(): string } } | void>; disconnect?(): Promise<void>; signAllTransactions(txs: VersionedTransaction[]): Promise<VersionedTransaction[]>; signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>; on?(ev: string, fn: (...a: unknown[]) => void): void }
type StdAccount = { address: string; publicKey: Uint8Array; chains: readonly string[]; features: readonly string[] }
type StdWallet = { name: string; icon: string; chains: readonly string[]; accounts: readonly StdAccount[]; features: Record<string, unknown> }
type StdConnect = { connect(): Promise<{ accounts: readonly StdAccount[] }> }
type StdSignTx = { signTransaction(...inputs: { account: StdAccount; transaction: Uint8Array; chain?: string }[]): Promise<{ signedTransaction: Uint8Array }[]> }

export type SolWallet = { id: string; name: string; icon?: string; kind: 'injected' | 'standard' }
export type SolState = { wallets: SolWallet[]; connected?: { wallet: SolWallet; publicKey: PublicKey }; connecting: boolean; error?: string }

const W = () => window as unknown as Record<string, Injected | undefined> & { phantom?: { solana?: Injected }; solflare?: Injected; backpack?: Injected; solana?: Injected }
const injectedList = (): { w: SolWallet; p: Injected }[] => {
  const out: { w: SolWallet; p: Injected }[] = []
  const win = W()
  const ph = win.phantom?.solana ?? (win.solana?.isPhantom ? win.solana : undefined)
  if (ph) out.push({ w: { id: 'phantom', name: 'Phantom', kind: 'injected', icon: ICONS.phantom }, p: ph })
  if (win.solflare) out.push({ w: { id: 'solflare', name: 'Solflare', kind: 'injected', icon: ICONS.solflare }, p: win.solflare })
  if (win.backpack) out.push({ w: { id: 'backpack', name: 'Backpack', kind: 'injected', icon: ICONS.backpack }, p: win.backpack })
  if (win.solana && !ph && win.solana !== win.solflare && win.solana !== win.backpack) out.push({ w: { id: 'solana', name: 'Solana wallet', kind: 'injected' }, p: win.solana })
  return out
}
const ICONS: Record<string, string> = {
  phantom: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#AB9FF2"/><path d="M6 13.5c0-3.6 2.7-6.5 6-6.5s6 2.9 6 6.5v1.3c0 .5-.4.9-.9.9h-.6c-.5 0-.9-.4-.9-.9v-.7c0-.4-.3-.7-.7-.7s-.7.3-.7.7v.9c0 .6-.5 1.1-1.1 1.1s-1.1-.5-1.1-1.1v-.9c0-.4-.3-.7-.7-.7s-.7.3-.7.7v1.1c0 .5-.4.9-.9.9H6.9c-.5 0-.9-.4-.9-.9v-1.7z" fill="#fff"/></svg>'),
  solflare: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#FC7227"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>'),
  backpack: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#E33E3F"/><rect x="7" y="8" width="10" height="10" rx="3" fill="#fff"/></svg>'),
}
const standard = new Map<string, StdWallet>()
let state: SolState = { wallets: [], connecting: false }
const subs = new Set<() => void>()
const set = (patch: Partial<SolState>) => { state = { ...state, ...patch }; subs.forEach((f) => f()) }
const refresh = () => {
  const list: SolWallet[] = injectedList().map((x) => x.w)
  for (const [id, w] of standard) if (w.chains.some((c) => c.startsWith('solana:')) && !list.some((x) => x.name.toLowerCase() === w.name.toLowerCase())) list.push({ id, name: w.name, icon: w.icon, kind: 'standard' })
  set({ wallets: list })
}
let started = false
function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const onRegister = (w: StdWallet) => { standard.set('std:' + w.name, w); refresh() }
  try {
    window.addEventListener('wallet-standard:register-wallet', ((e: CustomEvent<(api: { register: (...w: StdWallet[]) => () => void }) => void>) => e.detail({ register: (...ws) => { ws.forEach(onRegister); return () => undefined } })) as EventListener)
    window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: { register: (...ws: StdWallet[]) => { ws.forEach(onRegister); return () => undefined } } }))
  } catch { /* no wallet standard */ }
  refresh()
  setTimeout(refresh, 300); setTimeout(refresh, 1500)
}
export function useSolWallet() {
  start()
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state, () => state)
}
export async function connectSol(id: string) {
  set({ connecting: true, error: undefined })
  try {
    const inj = injectedList().find((x) => x.w.id === id)
    if (inj) {
      const r = await inj.p.connect()
      const pk = (r && 'publicKey' in r && r.publicKey) || inj.p.publicKey
      if (!pk) throw new Error('The wallet did not return an address.')
      inj.p.on?.('disconnect', () => set({ connected: undefined }))
      inj.p.on?.('accountChanged', (a: unknown) => { const k = (a as { toBase58?: () => string } | null)?.toBase58?.(); set({ connected: k ? { wallet: inj.w, publicKey: new PublicKey(k) } : undefined }) })
      set({ connected: { wallet: inj.w, publicKey: new PublicKey(pk.toBase58()) }, connecting: false })
      return
    }
    const w = standard.get(id)
    if (!w) throw new Error('Wallet not found.')
    const c = w.features['standard:connect'] as StdConnect | undefined
    if (!c) throw new Error('This wallet cannot connect through the Wallet Standard.')
    const { accounts } = await c.connect()
    const a = accounts.find((x) => x.chains.some((ch) => ch.startsWith('solana:'))) ?? accounts[0]
    if (!a) throw new Error('No Solana account in that wallet.')
    set({ connected: { wallet: { id, name: w.name, icon: w.icon, kind: 'standard' }, publicKey: new PublicKey(a.publicKey) }, connecting: false })
  } catch (e) {
    set({ connecting: false, error: (e as Error).message })
    throw e
  }
}
export function disconnectSol() {
  const c = state.connected
  if (c?.wallet.kind === 'injected') void injectedList().find((x) => x.w.id === c.wallet.id)?.p.disconnect?.().catch(() => undefined)
  set({ connected: undefined })
}
// Sign every transaction in one prompt where the wallet allows it, one by one where it does not.
export async function signAll(txs: VersionedTransaction[]): Promise<VersionedTransaction[]> {
  const c = state.connected
  if (!c) throw new Error('Connect a Solana wallet first.')
  if (c.wallet.kind === 'injected') {
    const p = injectedList().find((x) => x.w.id === c.wallet.id)?.p
    if (!p) throw new Error('The wallet is gone.')
    if (typeof p.signAllTransactions === 'function') return p.signAllTransactions(txs)
    const out: VersionedTransaction[] = []
    for (const tx of txs) out.push(await p.signTransaction(tx))
    return out
  }
  const w = standard.get(c.wallet.id)
  const f = w?.features['solana:signTransaction'] as StdSignTx | undefined
  if (!w || !f) throw new Error('This wallet cannot sign through the Wallet Standard.')
  const account = w.accounts.find((a) => a.address === c.publicKey.toBase58()) ?? w.accounts[0]
  const res = await f.signTransaction(...txs.map((tx) => ({ account, transaction: tx.serialize(), chain: 'solana:mainnet' })))
  return res.map((r) => VersionedTransaction.deserialize(r.signedTransaction))
}
