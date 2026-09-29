import { useEffect, useRef, useState } from 'react'
import { Box, Button, Drawer, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { BRAND, t } from '../theme/tokens'
import { Bt, Lt } from '../theme/styles'
import { MarkIcon } from './Logo'
import { INSTALL_EVENT, canPromptInstall, isIOS, isStandalone, onInstallPromptChange, promptInstall } from '../lib/pwa'

const KEY = 'verdex-install-seen'
const AUTO_DELAY = 12000

function ShareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

function PlusSquareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

// Bottom sheet inviting phone visitors to keep Verdex on their home screen. Opens once by itself,
// and whenever a "Get the app" link fires the install event.
export function InstallSheet() {
  const theme = useTheme()
  const narrow = useMediaQuery(theme.breakpoints.down('md'))
  const [open, setOpen] = useState(false)
  const [, bump] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(INSTALL_EVENT, show)
    const off = onInstallPromptChange(() => bump((n) => n + 1))
    let seen = false
    try {
      seen = localStorage.getItem(KEY) === '1'
    } catch {
      /* storage unavailable */
    }
    if (narrow && !seen && !isStandalone()) timer.current = window.setTimeout(show, AUTO_DELAY)
    return () => {
      window.removeEventListener(INSTALL_EVENT, show)
      off()
      window.clearTimeout(timer.current)
    }
  }, [narrow])
  const close = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
  }
  const install = async () => {
    const outcome = await promptInstall()
    if (outcome !== 'dismissed') close()
  }
  const ios = isIOS()
  const prompt = canPromptInstall()
  const steps: [React.ReactNode, string][] = ios
    ? [
        [<ShareIcon key="s" size={16} />, 'Tap Share in the browser bar'],
        [<PlusSquareIcon key="p" size={16} />, 'Choose Add to Home Screen'],
      ]
    : [
        [<Box key="m" component="span" sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1 }}>⋮</Box>, 'Open the browser menu'],
        [<PlusSquareIcon key="p" size={16} />, 'Choose Add to Home screen'],
      ]
  return (
    <Drawer
      anchor="bottom"
      open={open && narrow}
      onClose={close}
      transitionDuration={{ enter: 340, exit: 220 }}
      sx={{ zIndex: 1450 }}
      slotProps={{ paper: { sx: { background: t.color.menu, backgroundImage: 'none', borderRadius: '22px 22px 0 0', border: `1px solid ${t.color.border}`, borderBottom: 0, px: 2.5, pt: 1.5, pb: 'calc(20px + var(--sab))' } } }}
    >
      <Box sx={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.18)', mx: 'auto', mb: 2.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 58, height: 58, flexShrink: 0, borderRadius: '14px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}>
          <MarkIcon size={34} />
        </Box>
        <Box>
          <Typography component="h3" sx={{ ...t.type.h4, fontSize: 24, color: t.color.text, m: 0 }}>
            {BRAND.name} on your phone
          </Typography>
          <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 0.5 }}>Full screen, one tap from your home screen. Same wallet, same markets.</Typography>
        </Box>
      </Box>
      {prompt ? (
        <Button onClick={install} sx={{ ...Bt, mt: 3, width: '100%', height: 48 }}>
          Install app
        </Button>
      ) : (
        <Box sx={{ mt: 3, display: 'grid', gap: 1 }}>
          {steps.map(([icon, text], i) => (
            <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: t.radius.panel, background: t.color.tile }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, color: t.color.textSoft, flexShrink: 0 }}>{i + 1}</Box>
              <Box sx={{ display: 'flex', color: t.color.mark }}>{icon}</Box>
              <Typography sx={{ ...t.type.small, color: t.color.text }}>{text}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Button onClick={close} sx={{ ...Lt, mt: 1.25, width: '100%', height: 44, backdropFilter: 'none' }}>
        {prompt ? 'Not now' : 'Got it'}
      </Button>
    </Drawer>
  )
}
