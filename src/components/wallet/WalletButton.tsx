import { useState } from 'react'
import { Avatar, Box, Button, Dialog, Divider, Menu, MenuItem, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { fonts, t, z } from '../../theme/tokens'
import { Ct, Lt, tn } from '../../theme/styles'
import { ChevronDownIcon, CheckIcon, CloseIcon, CopyIcon, WalletIcon } from '../icons'
import { shortAddress, useWallet } from './WalletProvider'
import { useChains, chainLogo } from '../../lib/api'

function CopyButton({ address }: { address: string }) {
  const [done, setDone] = useState(false)
  return (
    <Box
      component="button"
      type="button"
      aria-label="Copy address"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(address).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }}
      sx={{ all: 'unset', cursor: 'pointer', display: 'flex', p: 0.5, borderRadius: '6px', color: z.textMuted, '&:hover': { color: z.text, background: 'rgba(255,255,255,.06)' } }}
    >
      {done ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
    </Box>
  )
}

export function WalletDialog() {
  const { wallets, menuOpen, closeWalletMenu, connect, connecting } = useWallet()
  return (
    <Dialog open={menuOpen} onClose={closeWalletMenu} slotProps={{ paper: { sx: { ...Ct, width: 360, maxWidth: 'calc(100vw - 32px)', p: 2 } } }} sx={{ zIndex: 1500 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Connect a wallet</Typography>
        <Box component="button" aria-label="Close" onClick={closeWalletMenu} sx={{ all: 'unset', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '50%', color: t.color.textLabel, '&:hover': { color: t.color.text, background: t.color.hover } }}>
          <CloseIcon size={14} />
        </Box>
      </Box>
      {wallets.length === 0 ? (
        <Box sx={{ ...t.type.small, color: t.color.textMuted, py: 2 }}>
          No browser wallet was found. Install MetaMask, Rabby or another EIP‑6963 wallet and reload the page.
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {wallets.map((w) => (
            <Box
              key={w.uuid}
              component="button"
              disabled={connecting}
              onClick={() => connect(w).catch(() => {})}
              sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: '12px', background: t.color.tile, '&:hover': { background: t.color.chip }, '&:disabled': { opacity: 0.6, cursor: 'default' } }}
            >
              <Avatar src={w.icon} sx={{ width: 32, height: 32, background: z.surface2, borderRadius: '8px' }}>
                <WalletIcon size={16} />
              </Avatar>
              <Box sx={{ fontSize: 14, fontWeight: 500 }}>{w.name}</Box>
              <Box sx={{ ml: 'auto', fontSize: 12, color: z.textMuted }}>{connecting ? 'Connecting…' : 'Detected'}</Box>
            </Box>
          ))}
        </Box>
      )}
      <Typography sx={{ ...t.type.caption, color: t.color.textLabel, mt: 2 }}>Non-custodial. Your keys never leave your wallet.</Typography>
    </Dialog>
  )
}

export function WalletButton({ full }: { full?: boolean } = {}) {
  const { account, openWalletMenu, disconnect } = useWallet()
  const navigate = useNavigate()
  const { data: chains } = useChains()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  if (!account) {
    return (
      <Button
        id="connect-wallet-button"
        onClick={(e) => {
          e.stopPropagation()
          openWalletMenu()
        }}
        sx={{ ...tn, ...(full && { width: '100%', height: 44, fontSize: 16 }) }}
      >
        Connect wallet
      </Button>
    )
  }
  const chain = chains?.find((c) => c.id === account.chainId)
  const chainName = chain?.name ?? 'EVM'
  const close = () => setAnchor(null)
  return (
    <>
      <Button id="wallet-account-button" aria-haspopup="menu" aria-expanded={!!anchor} onClick={(e) => setAnchor(e.currentTarget)} sx={{ ...Lt, height: 37, px: '12px', gap: 1, fontSize: 14, backdropFilter: 'none', background: t.color.chip, '&:hover': { background: '#2A2A2A' }, ...(full && { width: '100%', justifyContent: 'center' }) }}>
        <Avatar src={account.connector.icon} alt="" sx={{ width: 18, height: 18, background: z.surface2, fontSize: 10 }}>
          {account.connector.name[0]}
        </Avatar>
        {shortAddress(account.address)}
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', gap: '6px', pl: 1, borderLeft: `1px solid ${t.color.border}`, color: t.color.textMuted }}>
          <Avatar src={chainLogo(chain)} alt="" sx={{ width: 16, height: 16, background: 'transparent', fontSize: 9 }}>
            {chainName[0]}
          </Avatar>
          {chainName}
        </Box>
        <ChevronDownIcon size={12} />
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { mt: 1, minWidth: 260, ...Ct } } }} sx={{ zIndex: 1400 }}>
        <Box sx={{ px: 2, pt: 1, pb: 1.25 }}>
          <Typography sx={{ fontSize: 12, color: z.textMuted, mb: 1 }}>Connected addresses</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75 }}>
            <Avatar src={account.connector.icon} sx={{ width: 24, height: 24, background: z.surface2 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: fonts.code, fontSize: 14, color: z.text }}>{shortAddress(account.address)}</Typography>
              <Typography sx={{ fontSize: 12, color: z.textMuted }}>
                {account.connector.name} · EVM
              </Typography>
            </Box>
            <CopyButton address={account.address} />
          </Box>
        </Box>
        <Divider sx={{ borderColor: z.borderSoft }} />
        <MenuItem
          onClick={() => {
            close()
            navigate('/portfolio')
          }}
          sx={{ fontSize: 14, py: 1.25 }}
        >
          Portfolio
        </MenuItem>
        <MenuItem
          onClick={() => {
            close()
            openWalletMenu()
          }}
          sx={{ fontSize: 14, py: 1.25 }}
        >
          Connect another
        </MenuItem>
        <Divider sx={{ borderColor: z.borderSoft }} />
        <MenuItem
          onClick={() => {
            close()
            disconnect()
          }}
          sx={{ fontSize: 14, py: 1.25, color: z.error }}
        >
          Disconnect
        </MenuItem>
      </Menu>
    </>
  )
}
