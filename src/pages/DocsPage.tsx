import { useEffect, useState } from 'react'
import { Avatar, Box, Typography } from '@mui/material'
import { useLocation } from 'react-router-dom'
import { BRAND, t, z } from '../theme/tokens'
import { In, Vg } from '../theme/styles'
import { BETA_NOTES, DOC_SECTIONS, type DocBlock } from '../data/docs'
import { ISSUER_INFO, ISSUER_LOGOS, chainLogo, useChains, useTools } from '../lib/api'
import { ChevronDownIcon } from '../components/icons'
import { Page, PageHero } from './common'
import { scrollToId } from '../navData'

function Block({ b }: { b: DocBlock }) {
  const { data: chains } = useChains()
  const { data: tools } = useTools()
  const [open, setOpen] = useState<string | null>(null)
  switch (b.kind) {
    case 'p':
      return <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>{b.text}</Typography>
    case 'defs':
      return (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {b.items.map((i) => (
            <Box key={i.term} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '200px minmax(0,1fr)' }, gap: { xs: 0.5, sm: 3 }, py: 1.5, borderTop: `1px solid ${t.color.border}` }}>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{i.term}</Typography>
              <Typography sx={{ ...t.type.small, color: t.color.textMuted }}>{i.text}</Typography>
            </Box>
          ))}
        </Box>
      )
    case 'fees':
      return (
        <Box sx={{ ...In, overflow: 'hidden' }}>
          {b.items.map((i) => (
            <Box key={i.term} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, px: 2.5, py: 1.5, borderTop: `1px solid ${t.color.border}`, '&:first-of-type': { borderTop: 'none' } }}>
              <Typography sx={{ fontSize: 14, fontWeight: 500, flexShrink: 0 }}>{i.term}</Typography>
              <Typography sx={{ ...t.type.small, color: t.color.textMuted, textAlign: 'right' }}>{i.text}</Typography>
            </Box>
          ))}
        </Box>
      )
    case 'steps':
      return (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {b.items.map((s, i) => (
            <Box key={s.title} sx={{ display: 'flex', gap: 2, p: 2, borderRadius: '12px', border: `1px solid ${z.borderSoft}`, background: 'rgba(255,255,255,.03)' }}>
              <Box sx={{ width: 28, height: 28, flexShrink: 0, borderRadius: '8px', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 500, background: i === b.items.length - 1 ? z.accent : 'rgba(255,255,255,.06)', color: i === b.items.length - 1 ? z.primaryText : z.text }}>{i + 1}</Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{s.title}</Typography>
                <Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 0.5, lineHeight: 1.5 }}>{s.text}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )
    case 'issuers':
      return (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[...Object.entries(ISSUER_INFO), ['Reserve', { by: 'Reserve', about: 'The protocol that index baskets are minted and redeemed through. It is not a stock issuer.', url: '' }] as const].map(([name, info]) => (
            <Box key={name} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '200px minmax(0,1fr)' }, gap: { xs: 0.5, sm: 3 }, py: 1.5, borderTop: `1px solid ${t.color.border}` }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 14, fontWeight: 500 }}>
                <Box component="img" src={ISSUER_LOGOS[name]} alt="" sx={{ width: 16, height: 16, borderRadius: '50%', background: t.color.chip, objectFit: 'cover' }} />
                {name}
              </Box>
              <Typography sx={{ ...t.type.small, color: t.color.textMuted }}>{info.about}</Typography>
            </Box>
          ))}
        </Box>
      )
    case 'chains': {
      const list = (chains ?? []).filter((c) => c.mainnet).sort((a, b) => (a.id === 5042 ? -1 : b.id === 5042 ? 1 : a.name.localeCompare(b.name)))
      const label: Record<string, string> = { EVM: 'EVM', SVM: 'Solana', UTXO: 'Bitcoin', MVM: 'Sui', TVM: 'Tron', STL: 'Stellar' }
      return (
        <Box>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mb: 2.5 }}>
            {BRAND.name} routes across {list.length || '-'} mainnet chains, using {tools?.bridges.length ?? '-'} bridges and {tools?.exchanges.length ?? '-'} exchanges. This list updates live, so new chains show up without a {BRAND.name} release.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' }, gap: 1 }}>
            {list.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: '10px', border: `1px solid ${z.borderSoft}`, background: 'rgba(255,255,255,.03)' }}>
                <Avatar src={chainLogo(c)} alt="" sx={{ width: 24, height: 24, background: 'transparent' }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>
                    {c.name}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 11, color: t.color.textLabel }}>
                    {label[c.chainType] ?? c.chainType} · {c.chainType === 'EVM' ? c.id : c.key}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )
    }
    case 'faq':
      return (
        <Box sx={{ ...In, overflow: 'hidden' }}>
          {b.items.map((i) => {
            const on = open === i.q
            return (
              <Box key={i.q} sx={{ borderTop: `1px solid ${t.color.border}`, '&:first-of-type': { borderTop: 'none' } }}>
                <Box component="button" onClick={() => setOpen(on ? null : i.q)} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: 'calc(100% - 40px)', px: 2.5, py: 2, fontSize: 15, fontWeight: 500, color: t.color.text, '&:hover': { background: t.color.panelHover } }}>
                  {i.q}
                  <Box sx={{ display: 'flex', color: t.color.textLabel, transform: on ? 'rotate(180deg)' : 'none', transition: `transform ${t.motion.base}` }}>
                    <ChevronDownIcon size={16} />
                  </Box>
                </Box>
                {on && <Typography sx={{ ...t.type.small, color: t.color.textMuted, px: 2.5, pb: 2.5 }}>{i.a}</Typography>}
              </Box>
            )
          })}
        </Box>
      )
  }
}

export default function DocsPage() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) scrollToId(hash.slice(1))
  }, [hash])
  return (
    <Page>
      <PageHero label="Docs" center title={`How ${BRAND.name} Works`} lead="The unified marketplace for real-world assets: every issuer, every chain, one order." />
      <Box sx={{ ...In, p: { xs: 2.5, md: 3 }, mb: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>{BRAND.name} is live</Typography>
          <Box component="span" sx={Vg}>Beta</Box>
        </Box>
        <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 1 }}>Every trade is real: you sign it from your own address and it settles onchain. Beta means the product is still growing.</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' }, gap: 2, mt: 2.5 }}>
          {BETA_NOTES.map((n) => (
            <Box key={n.title}>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{n.title}</Typography>
              <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5, lineHeight: 1.5 }}>{n.text}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(0,1fr)' }, gap: { xs: 4, md: 8 }, alignItems: 'start' }}>
        <Box component="nav" sx={{ position: { md: 'sticky' }, top: t.layout.navHeight.md + 24, display: 'grid', gap: 0.5 }}>
          {DOC_SECTIONS.map((s) => (
            <Box key={s.id} component="a" href={`#${s.id}`} onClick={(e: React.MouseEvent) => { e.preventDefault(); scrollToId(s.id) }} sx={{ fontSize: 14, lineHeight: '18.2px', py: 0.75, pl: s.sub ? 2 : 0, color: s.sub ? t.color.textLabel : t.color.textSoft, textDecoration: 'none', transition: `color ${t.motion.base}`, '&:hover': { color: t.color.text } }}>
              {s.title}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gap: 6, minWidth: 0 }}>
          {DOC_SECTIONS.map((s) => (
            <Box key={s.id} id={s.id} sx={{ scrollMarginTop: 96 }}>
              <Typography component={s.sub ? 'h3' : 'h2'} sx={{ ...(s.sub ? t.type.h3 : t.type.pageTitle), color: t.color.text, mb: 2.5 }}>
                {s.title}
              </Typography>
              <Box sx={{ display: 'grid', gap: 2.5 }}>
                {s.blocks.map((b, i) => (
                  <Block key={i} b={b} />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Page>
  )
}
