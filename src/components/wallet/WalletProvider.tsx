import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createWalletClient, custom, type EIP1193Provider, type WalletClient } from 'viem'

export type DetectedWallet = { uuid: string; name: string; icon?: string; provider: EIP1193Provider }
export type Account = { address: `0x${string}`; chainId: number; connector: DetectedWallet }

type Ctx = {
  wallets: DetectedWallet[]
  account: Account | null
  connecting: boolean
  menuOpen: boolean
  openWalletMenu: () => void
  closeWalletMenu: () => void
  connect: (w: DetectedWallet) => Promise<void>
  disconnect: () => void
  switchChain: (chainId: number, meta?: { name: string; rpcUrls: string[]; nativeCurrency: { name: string; symbol: string; decimals: number }; blockExplorerUrls?: string[] }) => Promise<void>
  walletClient: WalletClient | null
}

const WalletContext = createContext<Ctx | null>(null)

type EIP6963Detail = { info: { uuid: string; name: string; icon: string; rdns: string }; provider: EIP1193Provider }

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<DetectedWallet[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const listeners = useRef<{ provider: EIP1193Provider; off: () => void } | null>(null)

  // Discover wallets via EIP-6963 with a window.ethereum fallback.
  useEffect(() => {
    const found = new Map<string, DetectedWallet>()
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<EIP6963Detail>).detail
      if (!d?.info?.uuid) return
      found.set(d.info.uuid, { uuid: d.info.uuid, name: d.info.name, icon: d.info.icon, provider: d.provider })
      setWallets([...found.values()])
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    const eth = (window as unknown as { ethereum?: EIP1193Provider & { isMetaMask?: boolean } }).ethereum
    const timer = window.setTimeout(() => {
      if (found.size === 0 && eth) {
        found.set('injected', { uuid: 'injected', name: eth.isMetaMask ? 'MetaMask' : 'Browser wallet', provider: eth })
        setWallets([...found.values()])
      }
    }, 300)
    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      window.clearTimeout(timer)
    }
  }, [])

  const bind = useCallback((w: DetectedWallet) => {
    listeners.current?.off()
    const p = w.provider as EIP1193Provider & { on?: (ev: string, fn: (...a: unknown[]) => void) => void; removeListener?: (ev: string, fn: (...a: unknown[]) => void) => void }
    const onAccounts = (...args: unknown[]) => {
      const accs = args[0] as string[]
      if (!accs?.length) setAccount(null)
      else setAccount((a) => (a ? { ...a, address: accs[0] as `0x${string}` } : a))
    }
    const onChain = (...args: unknown[]) => {
      const id = parseInt(String(args[0]), 16)
      setAccount((a) => (a ? { ...a, chainId: id } : a))
    }
    p.on?.('accountsChanged', onAccounts)
    p.on?.('chainChanged', onChain)
    listeners.current = {
      provider: w.provider,
      off: () => {
        p.removeListener?.('accountsChanged', onAccounts)
        p.removeListener?.('chainChanged', onChain)
      },
    }
  }, [])

  const connect = useCallback(
    async (w: DetectedWallet) => {
      setConnecting(true)
      try {
        const accounts = (await w.provider.request({ method: 'eth_requestAccounts' })) as string[]
        const chainHex = (await w.provider.request({ method: 'eth_chainId' })) as string
        if (!accounts?.length) throw new Error('No accounts')
        setAccount({ address: accounts[0] as `0x${string}`, chainId: parseInt(chainHex, 16), connector: w })
        bind(w)
        try {
          localStorage.setItem('verdex.wallet', w.uuid)
        } catch {
          /* ignore */
        }
        setMenuOpen(false)
      } finally {
        setConnecting(false)
      }
    },
    [bind],
  )

  // Reconnect silently on reload when the wallet already authorised us.
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem('verdex.wallet')
    } catch {
      /* ignore */
    }
    if (!saved || account) return
    const w = wallets.find((x) => x.uuid === saved)
    if (!w) return
    w.provider
      .request({ method: 'eth_accounts' })
      .then(async (accs) => {
        const list = accs as string[]
        if (!list?.length) return
        const chainHex = (await w.provider.request({ method: 'eth_chainId' })) as string
        setAccount({ address: list[0] as `0x${string}`, chainId: parseInt(chainHex, 16), connector: w })
        bind(w)
      })
      .catch(() => {})
  }, [wallets, account, bind])

  const disconnect = useCallback(() => {
    listeners.current?.off()
    listeners.current = null
    setAccount(null)
    try {
      localStorage.removeItem('verdex.wallet')
    } catch {
      /* ignore */
    }
  }, [])

  const switchChain = useCallback<Ctx['switchChain']>(
    async (chainId, meta) => {
      if (!account) throw new Error('Not connected')
      const hex = `0x${chainId.toString(16)}`
      try {
        await account.connector.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] })
      } catch (err) {
        const code = (err as { code?: number }).code
        if (code === 4902 && meta) {
          await account.connector.provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: meta.name, rpcUrls: meta.rpcUrls, nativeCurrency: meta.nativeCurrency, blockExplorerUrls: meta.blockExplorerUrls }] })
        } else throw err
      }
      setAccount((a) => (a ? { ...a, chainId } : a))
    },
    [account],
  )

  const walletClient = useMemo(() => (account ? createWalletClient({ account: account.address, transport: custom(account.connector.provider) }) : null), [account])

  const value = useMemo<Ctx>(
    () => ({ wallets, account, connecting, menuOpen, openWalletMenu: () => setMenuOpen(true), closeWalletMenu: () => setMenuOpen(false), connect, disconnect, switchChain, walletClient }),
    [wallets, account, connecting, menuOpen, connect, disconnect, switchChain, walletClient],
  )
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet outside WalletProvider')
  return ctx
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
