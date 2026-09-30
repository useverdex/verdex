// Wraps a route that is in its early-access window. Wallets at the VERDEX threshold pass straight
// through; everyone else sees when it opens and what would open it now. Routes not listed in
// EARLY_FEATURES render unchanged, so the gate costs nothing outside a launch.
import type { ReactNode } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { BRAND, t } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { EARLY_ACCESS_BPS, earlyFeature, fmtVerdex, useClock, useHolding } from '../lib/holding'
import { useWallet } from './wallet/WalletProvider'
import { BoltIcon, CoinIcon, WalletIcon } from './icons'
import { Page, Panel } from '../pages/common'

const fmtOpens = (ms: number) => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })

export function EarlyGate({ path, children }: { path: string; children: ReactNode }) {
  const feature = earlyFeature(path)
  const { account, openWalletMenu } = useWallet()
  const holding = useHolding(feature ? account?.address : undefined)
  const navigate = useNavigate()
  const now = useClock(!!feature)

  if (!feature) return <>{children}</>
  if (now === 0) return null
  if (now + 30_000 > feature.opensAtMs || holding.data?.early) return <>{children}</>
  if (account && holding.isLoading) {
    return (
      <Page>
        <Typography sx={{ fontSize: 14, color: t.color.textMuted, py: 8, textAlign: 'center' }}>Reading your wallet's VERDEX…</Typography>
      </Page>
    )
  }
  const h = holding.data
  return (
    <Page>
      <Panel sx={{ mt: { xs: 4, md: 8 }, p: { xs: 3, md: 5 }, maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
        <Box sx={{ width: 52, height: 52, borderRadius: '14px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark, mx: 'auto' }}>
          <BoltIcon size={24} />
        </Box>
        <Box sx={{ ...Vg, ml: 0, mt: 2.5, display: 'inline-flex' }}>Early access</Box>
        <Typography component="h1" sx={{ ...t.type.h3, color: t.color.text, mt: 2 }}>{feature.label} is open to holders first.</Typography>
        <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
          Wallets holding at least {EARLY_ACCESS_BPS / 100}% of the VERDEX supply{h ? ` (${fmtVerdex(h.earlyAt)} VERDEX)` : ''} can use it now. It opens to everyone on {fmtOpens(feature.opensAtMs)}.
        </Typography>
        {account && h && (
          <Typography sx={{ fontSize: 14, color: t.color.textLabel, mt: 1.5 }}>
            This wallet holds {fmtVerdex(h.verdex)} VERDEX, {h.sharePct.toFixed(3)}% of the supply. {h.toEarly > 0 ? `${fmtVerdex(h.toEarly)} more opens ${feature.label} now.` : ''}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mt: 3.5 }}>
          {account ? (
            <Button onClick={() => { navigate('/?buy=VERDEX'); window.scrollTo({ top: 0 }) }} sx={{ ...Bt, gap: 1 }}>
              <CoinIcon size={15} /> Get VERDEX
            </Button>
          ) : (
            <Button onClick={openWalletMenu} sx={{ ...Bt, gap: 1 }}>
              <WalletIcon size={15} /> Connect wallet
            </Button>
          )}
          <Button onClick={() => navigate('/verdex')} sx={{ ...Lt, backdropFilter: 'none' }}>
            About the token
          </Button>
        </Box>
        <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 3 }}>The balance is read from the token contract on Robinhood Chain in your browser. {BRAND.name} keeps no list.</Typography>
      </Panel>
    </Page>
  )
}
