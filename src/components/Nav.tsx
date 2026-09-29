import { useEffect, useRef, useState } from 'react'
import { AppBar, Box, Button, ClickAwayListener, Drawer, Fade, Grow, ListSubheader, MenuItem, MenuList, Paper, Popper, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useLocation, useNavigate } from 'react-router-dom'
import { BRAND, gutterPx, t } from '../theme/tokens'
import { Ct, Vg, roundBtn, tn } from '../theme/styles'
import { ChevronDownIcon, CloseIcon, PlusIcon } from './icons'
import { NAV_GROUPS, groupMatches, itemActive, scrollToId, type NavGroup, type NavItem } from '../navData'
import { actions, useStore } from '../store'
import { Wordmark } from './Logo'
import { WalletButton } from './wallet/WalletButton'

export function useNavSelect() {
  const navigate = useNavigate()
  return (item: NavItem) => {
    if (item.soon) return
    actions.closeAllMenus()
    if (item.action) {
      actions.setWelcomeScreenClosed(true)
      actions.setSwapTab(item.action === 'private' ? 'private' : 'swap')
      navigate('/')
      window.scrollTo({ top: 0 })
      return
    }
    navigate(item.path)
    const id = item.path.split('#')[1]
    if (id) scrollToId(id)
    else window.scrollTo({ top: 0 })
  }
}

const linkSx = {
  minWidth: 0,
  height: 36,
  px: 1.25,
  borderRadius: t.radius.pill,
  background: 'transparent',
  fontWeight: 500,
  fontSize: 14,
  letterSpacing: '-0.04em',
  whiteSpace: 'nowrap',
  transition: `color ${t.motion.base}`,
  '&:hover': { background: 'transparent', color: t.color.text },
} as const

function NavGroupButton({ group, active }: { group: NavGroup; active?: boolean }) {
  const { pathname, search, hash } = useLocation()
  const select = useNavSelect()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const isActive = active ?? groupMatches(group, pathname)
  const show = () => {
    window.clearTimeout(timer.current)
    setOpen(true)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(false), 120)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  if (group.link) {
    const link = group.link
    return (
      <Button
        component="a"
        href={link.path}
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          select(link)
        }}
        sx={{ ...linkSx, color: isActive ? t.color.text : t.color.textSoft }}
      >
        {group.label}
      </Button>
    )
  }

  return (
    <Box
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false)
          anchorEl?.focus()
        }
      }}
      sx={{ position: 'relative' }}
    >
      <Button
        ref={setAnchorEl}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => (e.detail === 0 ? setOpen((v) => !v) : show())}
        sx={{ ...linkSx, gap: 0.5, color: isActive || open ? t.color.text : t.color.textSoft, '& .nav-chevron': { transition: `transform ${t.motion.base}`, transform: open ? 'rotate(180deg)' : 'none' } }}
      >
        {group.label}
        <Box component="span" className="nav-chevron" sx={{ display: 'flex', opacity: 0.6 }}>
          <ChevronDownIcon size={t.icon.inline} />
        </Box>
      </Button>
      <Popper open={open} anchorEl={anchorEl} placement="bottom-start" disablePortal transition sx={{ zIndex: 1600 }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} timeout={220} style={{ transformOrigin: 'top left' }}>
            <Paper role="menu" aria-label={group.label} sx={{ ...Ct, minWidth: 250, p: 0.75, mt: 0.5 }}>
              {group.items.map((item, i) => {
                const on = itemActive(item, pathname, search, hash)
                const Icon = item.icon
                return (
                  <Box key={item.label + item.path} sx={{ animation: `navItemIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) ${40 + i * 25}ms both`, '@keyframes navItemIn': { from: { opacity: 0, transform: 'translateY(-4px)' }, to: { opacity: 1, transform: 'none' } } }}>
                    {item.divider && <Box sx={{ height: '1px', background: t.color.border, my: 0.75, mx: 0.75 }} />}
                    <Box
                      component={item.soon ? 'div' : 'a'}
                      role="menuitem"
                      aria-disabled={item.soon || undefined}
                      href={item.soon ? undefined : item.path}
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault()
                        if (!item.soon) {
                          setOpen(false)
                          select(item)
                        }
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 1.25,
                        py: 1,
                        borderRadius: t.radius.pill,
                        ...t.type.label,
                        color: item.soon ? t.color.textLabel : on ? t.color.text : t.color.textSoft,
                        background: on ? t.color.active : 'transparent',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        cursor: item.soon ? 'default' : 'pointer',
                        transition: `color ${t.motion.base}, background ${t.motion.base}`,
                        '& .nav-icon': { color: on ? t.color.green : t.color.textLabel, transition: `color ${t.motion.base}` },
                        ...(!item.soon && { '&:hover, &:focus-visible': { color: t.color.text, background: t.color.hover, outline: 'none', '& .nav-icon': { color: t.color.green } } }),
                      }}
                    >
                      <Box component="span" className="nav-icon" sx={{ display: 'flex', flexShrink: 0 }}>
                        <Icon size={t.icon.list} />
                      </Box>
                      {item.label}
                      {item.soon && (
                        <Box component="span" sx={{ ...Vg, ml: 'auto' }}>
                          Soon
                        </Box>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Paper>
          </Grow>
        )}
      </Popper>
    </Box>
  )
}

function MobileMenuList({ onSelect }: { onSelect: () => void }) {
  const select = useNavSelect()
  const { pathname, search, hash } = useLocation()
  const welcomeClosed = useStore((s) => s.welcomeScreenClosed)
  const go = (item: NavItem) => {
    onSelect()
    select(item)
  }
  return (
    <MenuList autoFocusItem={false} sx={{ py: 1 }}>
      {NAV_GROUPS.map((g) => [
        <ListSubheader key={g.label} disableSticky sx={{ background: 'transparent', px: 3, pt: 2.5, pb: 0.75, ...t.type.overline, color: t.color.textLabel }}>
          {g.link ? null : g.label}
        </ListSubheader>,
        ...(g.link ? [g.link] : g.items).map((item) => {
          const on = item.action === 'swap' ? pathname === '/' && welcomeClosed : itemActive(item, pathname, search, hash)
          const Icon = item.icon
          return (
            <MenuItem key={g.label + item.label} onClick={() => !item.soon && go(item)} aria-disabled={item.soon || undefined} sx={{ gap: 1.5, minHeight: 44, borderRadius: t.radius.panel, mx: 1.5, background: on ? t.color.active : 'transparent', cursor: item.soon ? 'default' : 'pointer', '&:hover': { background: item.soon ? 'transparent' : t.color.hover } }}>
              <Box sx={{ display: 'flex', color: on ? t.color.green : t.color.textLabel }}>
                <Icon size={t.icon.list} />
              </Box>
              <Box sx={{ ...t.type.body, color: item.soon ? t.color.textLabel : on ? t.color.text : t.color.textSecondary }}>{item.label}</Box>
              {item.soon && (
                <Box component="span" sx={Vg}>
                  Soon
                </Box>
              )}
            </MenuItem>
          )
        }),
      ])}
    </MenuList>
  )
}

// Round "+" button that opens the menu panel (Sentira style); turns into a cross while open.
function BurgerMenu() {
  const theme = useTheme()
  const md = useMediaQuery(theme.breakpoints.up('md'))
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const open = useStore((s) => s.mainMenuOpen)
  const close = () => actions.setMainMenuOpen(false)
  return (
    <>
      <Box
        component="button"
        type="button"
        id="main-burger-menu-button"
        ref={setAnchorEl}
        aria-label="Main Menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          actions.setMainMenuOpen(!open)
        }}
        sx={{ ...roundBtn, '& svg': { transition: `transform ${t.motion.base}`, transform: open ? 'rotate(45deg)' : 'none' } }}
      >
        <PlusIcon size={18} />
      </Box>
      {md ? (
        <Popper open={open} anchorEl={anchorEl} placement="bottom-end" transition sx={{ zIndex: 1600 }}>
          {({ TransitionProps }) => (
            <Fade {...TransitionProps}>
              <Paper sx={{ mt: 1.5, width: 300, ...Ct, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' }}>
                <ClickAwayListener
                  onClickAway={(e) => {
                    if (!anchorEl?.contains(e.target as Node)) setTimeout(close, 150)
                  }}
                >
                  <Box onKeyDown={(e) => (e.key === 'Escape' || e.key === 'Tab') && close()}>
                    <MobileMenuList onSelect={close} />
                  </Box>
                </ClickAwayListener>
              </Paper>
            </Fade>
          )}
        </Popper>
      ) : (
        <Drawer anchor="top" open={open} onClose={close} transitionDuration={300} slots={{ transition: Fade }} sx={{ zIndex: 1500 }} slotProps={{ paper: { square: true, sx: { maxHeight: '100dvh', width: '100%', background: t.color.page, backgroundImage: 'none', overflowY: 'auto', borderBottom: `1px solid ${t.color.border}` } } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: t.layout.gutter.xs, height: t.layout.navHeight.xs }}>
            <Wordmark size={24} />
            <Box component="button" type="button" aria-label="Close menu" onClick={close} sx={roundBtn}>
              <CloseIcon size={16} />
            </Box>
          </Box>
          <MobileMenuList onSelect={close} />
          <Box sx={{ px: 2.5, pb: 3, pt: 1 }}>
            <Box sx={{ display: 'flex', '& > *': { flex: 1 } }}>
              <WalletButton full />
            </Box>
          </Box>
        </Drawer>
      )}
    </>
  )
}

export function Nav() {
  const wide = useMediaQuery('(min-width:1240px)')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const welcomeClosed = useStore((s) => s.welcomeScreenClosed)
  const tradeActive = pathname === '/' && welcomeClosed
  const onLanding = pathname === '/' && !welcomeClosed
  return (
    <AppBar
      component="nav"
      color="transparent"
      elevation={0}
      sx={{
        position: 'sticky',
        top: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(6,6,6,.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: onLanding ? 'none' : `1px solid ${t.color.border}`,
        boxShadow: 'none',
        zIndex: 1300,
        height: { xs: `calc(${t.layout.navHeight.xs}px + var(--sat))`, md: `calc(${t.layout.navHeight.md}px + var(--sat))` },
        px: { xs: gutterPx.xs, sm: gutterPx.sm, lg: gutterPx.lg },
        py: 0,
        pt: 'var(--sat)',
      }}
    >
      <Box
        component="a"
        id="verdex-logo"
        href="/"
        aria-label={`${BRAND.name} home`}
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          actions.closeAllMenus()
          actions.setWelcomeScreenClosed(false)
          navigate('/')
        }}
        sx={{ position: 'relative', display: 'flex', alignItems: 'center', textDecoration: 'none', color: t.color.text }}
      >
        <Wordmark size={wide ? 26 : 24} />
      </Box>
      {wide && (
        <Box sx={{ display: 'flex', flex: 1, ml: 4, mr: 1, gap: 0.25 }}>
          {NAV_GROUPS.map((g) => (
            <NavGroupButton key={g.label} group={g} active={g.label === 'Trade' ? tradeActive : undefined} />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
        {onLanding ? (
          <Button
            onClick={() => {
              actions.closeAllMenus()
              navigate('/assets')
              window.scrollTo({ top: 0 })
            }}
            sx={{ ...tn }}
          >
            Trade Assets
          </Button>
        ) : (
          <WalletButton />
        )}
        {!wide && <BurgerMenu />}
      </Box>
    </AppBar>
  )
}
