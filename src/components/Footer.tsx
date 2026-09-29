import { Box, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { BRAND, t } from '../theme/tokens'
import { Zg } from '../theme/styles'
import { NAV_GROUPS, type NavItem } from '../navData'
import { XLogoIcon } from './icons'
import { ContractAddress } from './ContractAddress'
import { useNavSelect } from './Nav'
import { isStandalone, openInstallSheet } from '../lib/pwa'
import { Wordmark } from './Logo'

function group(label: string) {
  return NAV_GROUPS.find((g) => g.label === label)?.items.filter((i) => !i.soon) ?? []
}

const columns: { title: string; items: NavItem[] }[] = [
  { title: 'Markets', items: group('Markets') },
  { title: 'Baskets', items: [...group('Baskets'), ...group('Earn')] },
  { title: 'Lend and Trade', items: [...group('Lend and Borrow'), ...group('Trade')] },
  { title: 'Docs', items: group('Docs') },
]

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="nav" aria-label={title}>
      <Typography component="h4" sx={{ ...t.type.body, color: t.color.text, m: 0 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'grid', gap: '10px', mt: 2.5, justifyItems: 'start' }}>{children}</Box>
    </Box>
  )
}

export function Footer() {
  const navigate = useNavigate()
  const select = useNavSelect()
  const go = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    navigate(path)
    window.scrollTo({ top: 0 })
  }
  return (
    <Box component="footer" sx={{ mt: { xs: 12, md: 20 }, pb: { xs: 4, md: 6 } }}>
      <Box sx={{ maxWidth: 960, mx: 'auto', px: t.layout.gutter }}>
        <Box sx={{ display: 'grid', gap: { xs: 4, md: 5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: '1.4fr repeat(4, minmax(0, 1fr))' } }}>
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Wordmark size={22} />
            <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 2, maxWidth: 220 }}>Unified marketplace for everything tokenized, across 50+ chains.</Typography>
            <Box sx={{ mt: 2.5, maxWidth: '100%' }}>
              <ContractAddress full />
            </Box>
            <Box component="a" href={BRAND.xUrl} target="_blank" rel="noopener noreferrer" aria-label={`${BRAND.name} on X`} sx={{ mt: 2, display: 'inline-flex', alignItems: 'center', gap: 1, ...t.type.small, color: t.color.textMuted, textDecoration: 'none', '&:hover': { color: t.color.text } }}>
              <XLogoIcon size={13} /> {BRAND.xHandle}
            </Box>
          </Box>
          {columns.map((c) => (
            <Column key={c.title} title={c.title}>
              {c.items.map((item) => (
                <Box
                  key={item.label}
                  component="a"
                  href={item.path}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault()
                    select(item)
                  }}
                  sx={Zg}
                >
                  {item.label}
                </Box>
              ))}
            </Column>
          ))}
        </Box>
        <Box sx={{ mt: { xs: 5, md: 7 }, pt: 3, borderTop: `1px solid ${t.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', ...t.type.small, color: t.color.textMuted }}>
          <span>
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </span>
          <span>Non-custodial. Your keys, your assets.</span>
          {!isStandalone() && (
            <Box component="button" type="button" onClick={openInstallSheet} sx={{ all: 'unset', cursor: 'pointer', display: { xs: 'inline', md: 'none' }, ...Zg, color: t.color.textMuted }}>
              Add to home screen
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 2.5 }}>
            <Box component="a" href="/terms" onClick={go('/terms')} sx={{ ...Zg, color: t.color.textMuted }}>
              Terms
            </Box>
            <Box component="a" href="/privacy" onClick={go('/privacy')} sx={{ ...Zg, color: t.color.textMuted }}>
              Privacy
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
