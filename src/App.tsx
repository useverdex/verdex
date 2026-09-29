import { lazy, Suspense, useEffect } from 'react'
import { Box } from '@mui/material'
import { Route, Routes, useLocation } from 'react-router-dom'
import { t } from './theme/tokens'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'
import { WalletDialog } from './components/wallet/WalletButton'
import { TabBar } from './components/TabBar'
import { InstallSheet } from './components/InstallSheet'
import { DueBuys } from './components/DueBuys'
import { Landing } from './landing/Landing'

const AssetsPage = lazy(() => import('./pages/AssetsPage'))
const IssuersPage = lazy(() => import('./pages/IssuersPage'))
const BasketsPage = lazy(() => import('./pages/BasketsPage'))
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'))
const PoolsPage = lazy(() => import('./pages/PoolsPage'))
const LendPage = lazy(() => import('./pages/LendPage'))
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'))
const AutoInvestPage = lazy(() => import('./pages/AutoInvestPage'))
const VaultsPage = lazy(() => import('./pages/VaultsPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function BgLayer() {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: t.color.page,
        transition: 'background .3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        '&::before': { content: '""', position: 'absolute', left: '50%', top: -320, width: 1100, height: 640, transform: 'translateX(-50%)', background: 'radial-gradient(50% 50%, rgba(143,166,97,.10) 0%, rgba(0,0,0,0) 100%)', opacity: 1, transition: 'opacity .3s cubic-bezier(0.25, 0.8, 0.25, 1)' },
      }}
    />
  )
}

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0 })
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <>
      <BgLayer />
      <ScrollToTop />
      <Nav />
      <Box component="main">
        <Suspense fallback={<Box sx={{ minHeight: '60dvh' }} />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:ticker" element={<AssetsPage />} />
            <Route path="/issuers" element={<IssuersPage />} />
            <Route path="/rwa-baskets" element={<BasketsPage />} />
            <Route path="/rwa-baskets/discover" element={<DiscoverPage />} />
            <Route path="/rwa-pools" element={<PoolsPage />} />
            <Route path="/lend" element={<LendPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/auto-invest" element={<AutoInvestPage />} />
            <Route path="/vaults" element={<VaultsPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Box>
      <Footer />
      <TabBar />
      <InstallSheet />
      <DueBuys />
      <WalletDialog />
    </>
  )
}
