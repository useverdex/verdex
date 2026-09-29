import { useMemo, useState } from 'react'
import { Avatar, Box, Dialog, InputBase, Typography } from '@mui/material'
import { t, z } from '../theme/tokens'
import { Ct } from '../theme/styles'
import { CloseIcon, SearchIcon } from '../components/icons'
import { chainLogo, useChains, useTokenLogo, type Chain, type Token } from '../lib/api'
import { useChainTokens } from '../lib/lifi'

const PINNED = [4663, 5042, 1, 8453, 42161, 56, 137, 10, 43114, 999, 1151111081099710]

export function TokenPicker({ open, onClose, chainId, onSelect }: { open: boolean; onClose: () => void; chainId?: number; onSelect: (chain: Chain, token: Token) => void }) {
  const { data: chains } = useChains()
  const logoOf = useTokenLogo()
  const [selChain, setSelChain] = useState<number | undefined>(chainId)
  const [q, setQ] = useState('')
  const active = selChain ?? chainId
  const { data: tokens, isLoading } = useChainTokens(open ? active : undefined)
  const evm = useMemo(() => (chains ?? []).filter((c) => c.mainnet && c.chainType === 'EVM'), [chains])
  const ordered = useMemo(() => [...evm].sort((a, b) => (PINNED.indexOf(a.id) === -1 ? 99 : PINNED.indexOf(a.id)) - (PINNED.indexOf(b.id) === -1 ? 99 : PINNED.indexOf(b.id)) || a.name.localeCompare(b.name)), [evm])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const all = tokens ?? []
    const filtered = s ? all.filter((tk) => tk.symbol.toLowerCase().includes(s) || tk.name.toLowerCase().includes(s) || tk.address.toLowerCase() === s) : all
    return filtered.slice(0, 120)
  }, [tokens, q])
  const chain = evm.find((c) => c.id === active)
  return (
    <Dialog open={open} onClose={onClose} slotProps={{ paper: { sx: { ...Ct, width: 440, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(680px, calc(100dvh - 48px))', display: 'flex', flexDirection: 'column' } } }} sx={{ zIndex: 1500 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 2, pb: 1 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Select token</Typography>
        <Box component="button" aria-label="Close" onClick={onClose} sx={{ all: 'unset', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '50%', color: t.color.textLabel, '&:hover': { color: t.color.text, background: t.color.hover } }}>
          <CloseIcon size={14} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, px: 2, pb: 1.5, overflowX: 'auto', flexShrink: 0, '&::-webkit-scrollbar': { display: 'none' } }}>
        {ordered.slice(0, 14).map((c) => (
          <Box key={c.id} component="button" title={c.name} onClick={() => setSelChain(c.id)} sx={{ all: 'unset', cursor: 'pointer', flexShrink: 0, width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', border: `1px solid ${c.id === active ? t.color.green : 'transparent'}`, background: c.id === active ? t.color.greenFill : 'rgba(255,255,255,.03)', '&:hover': { background: 'rgba(255,255,255,.06)' } }}>
            <Avatar src={chainLogo(c)} alt={c.name} sx={{ width: 22, height: 22, background: 'transparent' }} />
          </Box>
        ))}
      </Box>
      <Box sx={{ px: 2, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, height: 44, borderRadius: '12px', background: t.color.tile, color: t.color.textLabel }}>
          <SearchIcon size={16} />
          <InputBase autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${chain?.name ?? ''} tokens or paste address`} sx={{ flex: 1, fontSize: 14, color: t.color.text }} />
        </Box>
      </Box>
      <Box sx={{ overflowY: 'auto', px: 1, pb: 1, flex: 1 }}>
        {isLoading && <Typography sx={{ ...t.type.small, color: t.color.textMuted, px: 2, py: 3 }}>Loading tokens…</Typography>}
        {!isLoading && list.length === 0 && <Typography sx={{ ...t.type.small, color: t.color.textMuted, px: 2, py: 3 }}>No tokens found.</Typography>}
        {list.map((tk) => (
          <Box key={`${tk.chainId}-${tk.address}`} component="button" onClick={() => chain && onSelect(chain, tk)} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, width: 'calc(100% - 16px)', px: 1, py: 1, borderRadius: '10px', '&:hover': { background: t.color.hover } }}>
            <Avatar src={logoOf(tk)} alt="" sx={{ width: 32, height: 32, background: z.surface2, fontSize: 12 }}>
              {tk.symbol[0]}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
                {tk.symbol}
              </Typography>
              <Typography noWrap sx={{ fontSize: 12, color: z.textMuted }}>
                {tk.name}
              </Typography>
            </Box>
            {tk.priceUSD && <Typography sx={{ fontSize: 12, color: z.textMuted }}>${Number(tk.priceUSD).toLocaleString('en-US', { maximumFractionDigits: Number(tk.priceUSD) < 1 ? 4 : 2 })}</Typography>}
          </Box>
        ))}
      </Box>
    </Dialog>
  )
}
