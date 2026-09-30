import { lazy, Suspense, useEffect } from 'react'
import { Box } from '@mui/material'
import { Route, Routes, useLocation } from 'react-router-dom'
import { EarlyGate } from './components/EarlyGate'
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
const StrategiesPage = lazy(() => import('./pages/StrategiesPage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const AgentPage = lazy(() => import('./pages/AgentPage'))
const TokenPage = lazy(() => import('./pages/TokenPage'))
const VerdexPoolsPage = lazy(() => import('./pages/VerdexPoolsPage'))
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

// One title per route, for tabs, history, sharing and search results.
const TITLES: [string, string][] = [
  ['/assets', 'Markets'],
  ['/issuers', 'Issuers'],
  ['/rwa-baskets/discover', 'Discover Baskets'],
  ['/rwa-baskets', 'Baskets'],
  ['/rwa-pools', 'Tokenized Pools'],
  ['/pools', 'Verdex Pools'],
  ['/lend', 'Lend and Borrow'],
  ['/portfolio', 'Portfolio'],
  ['/auto-invest', 'Auto-Invest'],
  ['/vaults', 'Vaults'],
  ['/strategies', 'Strategies'],
  ['/orders', 'Orders'],
  ['/agent', 'Agent'],
  ['/verdex', 'VERDEX token'],
  ['/docs', 'Docs'],
  ['/terms', 'Terms of Service'],
  ['/privacy', 'Privacy Policy'],
]
const BASE_TITLE = 'Verdex: Unified Marketplace for Real-World Assets'
function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + '/'))
    document.title = hit ? `${hit[1]} · Verdex` : BASE_TITLE
  }, [pathname])
  return null
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
      <RouteTitle />
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
            <Route path="/pools" element={<EarlyGate path="/pools"><VerdexPoolsPage /></EarlyGate>} />
            <Route path="/lend" element={<LendPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/auto-invest" element={<EarlyGate path="/auto-invest"><AutoInvestPage /></EarlyGate>} />
            <Route path="/vaults" element={<EarlyGate path="/vaults"><VaultsPage /></EarlyGate>} />
            <Route path="/strategies" element={<EarlyGate path="/strategies"><StrategiesPage /></EarlyGate>} />
            <Route path="/orders" element={<EarlyGate path="/orders"><OrdersPage /></EarlyGate>} />
            <Route path="/agent" element={<EarlyGate path="/agent"><AgentPage /></EarlyGate>} />
            <Route path="/verdex" element={<EarlyGate path="/verdex"><TokenPage /></EarlyGate>} />
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
