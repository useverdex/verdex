import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Fade } from '@mui/material'
import { t } from '../theme/tokens'
import { useStore, actions } from '../store'
import { Hero } from './Hero'
import { Features } from './Features'
import { SwapIntro } from './SwapIntro'
import { SwapWidget } from '../swap/SwapWidget'

function SwapArea() {
  return (
    <Box sx={{ display: 'grid', columnGap: 3, rowGap: 3, boxSizing: 'border-box', alignItems: 'start', alignContent: 'start', maxWidth: '100%', px: { md: 1.5 }, width: { xs: '100%', md: 'fit-content' }, mx: { md: 'auto' }, gridTemplateColumns: 'minmax(0,1fr)', '@media (min-height: 700px)': { overflow: 'visible' } }}>
      <Box sx={{ minWidth: 0, zIndex: 10, width: '100%', justifySelf: { sm: 'center' }, position: { md: 'sticky' }, alignSelf: { md: 'start' }, top: { md: `calc(${t.layout.navHeight.md}px + 28px)` }, zoom: { lg: 1.1 }, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 3 }}>
        <SwapWidget />
      </Box>
    </Box>
  )
}

export function Landing() {
  const closed = useStore((s) => s.welcomeScreenClosed)
  const [params] = useSearchParams()
  const buy = params.get('buy')
  const swap = params.get('swap')
  useEffect(() => {
    if (window.self !== window.top || buy || swap) actions.setWelcomeScreenClosed(true)
  }, [buy, swap])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [closed])
  return (
    <Box sx={{ pb: { xs: 6, sm: 0 } }}>
      <Fade in={!closed} timeout={{ enter: 300, exit: 200 }} mountOnEnter unmountOnExit>
        <Box className="welcome-screen-container">
          <Hero />
          <Features />
        </Box>
      </Fade>
      <Box sx={{ display: closed ? 'flex' : 'none', justifyContent: 'center', alignItems: 'flex-start', pt: '28px', px: { xs: 1, sm: 3 }, minHeight: { xs: 'calc(100dvh - 100px)', sm: 'calc(100dvh - 108px)', md: 'calc(100dvh - 116px)' } }}>
        <Fade in={closed} timeout={300}>
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {closed && <SwapArea />}
            {closed && <SwapIntro />}
          </Box>
        </Fade>
      </Box>
    </Box>
  )
}
