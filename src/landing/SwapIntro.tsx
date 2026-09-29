import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { t } from '../theme/tokens'
import { Bt } from '../theme/styles'
import { Pill } from '../components/ui'
import { useChains, useTools } from '../lib/api'

const KEY = 'verdex-swap-intro-seen'

export function SwapIntro() {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const { data: chains } = useChains()
  const { data: tools } = useTools()
  if (seen) return null
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    setSeen(true)
  }
  const stats: [string, number | undefined][] = [
    ['Chains', chains?.filter((c) => c.mainnet).length],
    ['Bridges', tools?.bridges.length],
    ['DEXs', tools?.exchanges.length],
  ]
  return (
    <Box
      role="dialog"
      aria-label="Swap and Bridge"
      onClick={dismiss}
      sx={{
        position: 'fixed',
        inset: 0,
        top: { xs: 56, md: t.layout.navHeight.md },
        zIndex: 1200,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        textAlign: 'center',
        px: t.layout.gutter,
        pb: { xs: 'calc(40px + var(--tabbar))', md: '9vh' },
        background: `linear-gradient(to bottom, rgba(6,6,6,0) 0%, rgba(6,6,6,0) 30%, rgba(6,6,6,.7) 44%, ${t.color.page} 56%, ${t.color.page} 100%)`,
      }}
    >
      <Pill sx={{ mb: 3 }}>Multi-Chain Liquidity Aggregator</Pill>
      <Typography component="h2" sx={{ ...t.type.h2, color: t.color.text, maxWidth: 980 }}>
        Swap Any Asset Across{' '}
        <Box component="span" sx={{ color: t.color.green, whiteSpace: 'nowrap' }}>
          50+ Chains.
        </Box>
      </Typography>
      <Typography sx={{ ...t.type.lead, color: t.color.textMuted, mt: 3, maxWidth: 780 }}>
        <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>
          {stats.map(([k, v]) => `${v ?? '-'} ${k === 'DEXs' ? k : k.toLowerCase()}.`).join(' ')}
        </Box>{' '}
        Exchange and bridge any asset in one step.
      </Typography>
      <Button onClick={dismiss} sx={{ ...Bt, mt: { xs: 4, md: 5 }, minWidth: 200 }}>
        Get Started
      </Button>
    </Box>
  )
}
