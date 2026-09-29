import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../theme/tokens'
import { BriefcaseIcon, GridIcon, HandCoinIcon, LayersIcon, SwapIcon } from './icons'
import { actions, useStore } from '../store'

type Tab = { label: string; icon: React.ComponentType<{ size?: number }>; path: string; match: (pathname: string, tradeActive: boolean) => boolean; trade?: boolean }

const TABS: Tab[] = [
  { label: 'Markets', icon: GridIcon, path: '/assets', match: (p) => p.startsWith('/assets') || p.startsWith('/issuers') },
  { label: 'Trade', icon: SwapIcon, path: '/', match: (_, trade) => trade, trade: true },
  { label: 'Baskets', icon: LayersIcon, path: '/rwa-baskets', match: (p) => p.startsWith('/rwa-baskets') || p.startsWith('/rwa-pools') },
  { label: 'Lend', icon: HandCoinIcon, path: '/lend', match: (p) => p.startsWith('/lend') },
  { label: 'Portfolio', icon: BriefcaseIcon, path: '/portfolio', match: (p) => p.startsWith('/portfolio') },
]

// Native-style bottom tabs for phones and the home-screen app. Hidden on wide screens, where the nav has menus.
export function TabBar() {
  const theme = useTheme()
  const narrow = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const welcomeClosed = useStore((s) => s.welcomeScreenClosed)
  if (!narrow) return null
  const tradeActive = pathname === '/' && welcomeClosed
  const go = (tab: Tab) => {
    actions.closeAllMenus()
    if (tab.trade) {
      actions.setWelcomeScreenClosed(true)
      actions.setSwapTab('swap')
    }
    navigate(tab.path)
    window.scrollTo({ top: 0 })
  }
  return (
    <Box
      component="nav"
      aria-label="App"
      id="app-tabbar"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1250,
        display: 'grid',
        gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`,
        height: 60,
        pb: 'var(--sab)',
        boxSizing: 'content-box',
        background: 'rgba(6,6,6,.88)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderTop: `1px solid ${t.color.border}`,
        userSelect: 'none',
      }}
    >
      {TABS.map((tab) => {
        const on = tab.match(pathname, tradeActive)
        const Icon = tab.icon
        return (
          <Box
            key={tab.label}
            component="button"
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => go(tab)}
            sx={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              height: 60,
              color: on ? t.color.text : t.color.textLabel,
              transition: `color ${t.motion.base}, transform ${t.motion.fast}`,
              '& .tab-icon': { display: 'flex', color: on ? t.color.mark : 'inherit', transition: `color ${t.motion.base}, transform ${t.motion.base}` },
              '&:active': { transform: 'scale(0.92)' },
              '&:focus-visible': { outline: `1px solid ${t.color.borderButtonHover}`, outlineOffset: -6, borderRadius: '12px' },
            }}
          >
            <Box component="span" className="tab-icon">
              <Icon size={22} />
            </Box>
            <Box component="span" sx={{ fontSize: 11, lineHeight: 1, fontWeight: 500, letterSpacing: '-0.02em' }}>
              {tab.label}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
