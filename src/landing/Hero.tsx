import { Box, Button, Typography } from '@mui/material'
import { keyframes } from '@emotion/react'
import { useNavigate } from 'react-router-dom'
import { BRAND, t } from '../theme/tokens'
import { Bt, Lt } from '../theme/styles'
import { Reveal } from '../components/motion'
import { ArrowRightIcon } from '../components/icons'
import { Container, Marquee } from '../components/ui'
import { ContractAddress } from '../components/ContractAddress'
import { ISSUER_LOGOS } from '../lib/api'
import { pub } from '../lib/base'
import { actions } from '../store'

// A slow camera pan across the landscape: the image is wider than the section and slides
// sideways at a steady pace, with no scaling, so it stays sharp.
const pan = keyframes`
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-13.8%, 0, 0); }
`

const PARTNERS = ['Reserve', 'xStocks', 'bStocks', 'Ondo', 'Robinhood', 'Coinbase', 'Backed', 'Tether', 'Paxos', 'Maple', 'USD.AI', 'Ethena', 'Theo', 'Kamino'].map((n) => ({ name: n, logo: ISSUER_LOGOS[n] }))

export function Partners({ label = 'Integration partners:' }: { label?: string }) {
  return (
    <Box>
      <Typography sx={{ ...t.type.body, color: t.color.textSoft, textAlign: 'center' }}>{label}</Typography>
      <Marquee duration={40} sx={{ mt: 2.5 }}>
        {PARTNERS.map((p) => (
          <Box key={p.name} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, flexShrink: 0, px: { xs: 2.5, md: 3.5 } }}>
            <Box component="img" src={p.logo} alt="" sx={{ width: 26, height: 26, borderRadius: '7px', objectFit: 'cover', flexShrink: 0 }} />
            <Typography sx={{ fontSize: { xs: 17, md: 20 }, fontWeight: 600, letterSpacing: '-0.03em', color: t.color.text, whiteSpace: 'nowrap', opacity: 0.9 }}>{p.name}</Typography>
          </Box>
        ))}
      </Marquee>
    </Box>
  )
}

// Sentira-style hero: giant serif name, centred lead and buttons over the particle landscape.
export function Hero() {
  const navigate = useNavigate()
  return (
    <Box component="section" sx={{ position: 'relative', overflow: 'hidden', minHeight: { md: 'calc(100vh - 85px)' }, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pt: { xs: 8, md: 12 } }}>
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', '@keyframes heroIn': { from: { opacity: 0 } }, animation: 'heroIn 1.6s ease both', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
        <Box component="img" src={pub('/design/particles.webp')} alt="" sx={{ position: 'absolute', left: 0, bottom: 0, width: '116%', height: { xs: '58%', md: '100%' }, objectFit: 'cover', objectPosition: 'center bottom', display: 'block', willChange: 'transform', animation: `${pan} 50s ease-in-out infinite alternate`, '@media (prefers-reduced-motion: reduce)': { animation: 'none', left: '-8%' } }} />
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,6,6,1) 0%, rgba(6,6,6,.85) 30%, rgba(6,6,6,0) 60%, rgba(6,6,6,0) 88%, rgba(6,6,6,1) 100%)' }} />
      </Box>
      <Container sx={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: { xs: 2, md: 4 } }}>
        <Reveal onMount y={20}>
          <Typography component="h1" sx={{ ...t.type.display, color: t.color.text, m: 0, userSelect: 'none' }}>
            {BRAND.name}
          </Typography>
        </Reveal>
        <Reveal onMount delay={0.12} y={16}>
          <Typography sx={{ ...t.type.heroLead, color: t.color.textSoft, mt: { xs: 2.5, md: 3.5 }, maxWidth: 600, mx: 'auto' }}>Unified marketplace for everything tokenized. Buy, sell, lend, borrow and discover tokenized stocks, ETFs, commodities and any other token across 50+ chains.</Typography>
        </Reveal>
        <Reveal onMount delay={0.18} y={12}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center', mt: 4 }}>
            <Button onClick={() => navigate('/assets')} sx={Bt}>
              Explore Assets
            </Button>
            <Button onClick={() => actions.setWelcomeScreenClosed(true)} sx={Lt}>
              Swap and Bridge
              <Box component="span" className="btn-arrow" sx={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: '50%', background: t.color.text, color: t.color.page }}>
                <ArrowRightIcon size={11} strokeWidth={2.5} />
              </Box>
            </Button>
          </Box>
        </Reveal>
        <Reveal onMount delay={0.24} y={10}>
          <Box sx={{ mt: 2.5 }}>
            <ContractAddress />
          </Box>
        </Reveal>
      </Container>
      <Box sx={{ position: 'relative', zIndex: 1, mt: { xs: 6, md: 10 }, pb: { xs: 3, md: 4 }, maxWidth: 1200, mx: 'auto', width: '100%' }}>
        <Reveal onMount delay={0.3} y={10}>
          <Partners />
        </Reveal>
      </Box>
    </Box>
  )
}
