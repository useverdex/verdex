import { Avatar, Box, InputBase, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { t, z } from '../theme/tokens'
import { In } from '../theme/styles'
import { SearchIcon } from '../components/icons'
import { Pill } from '../components/ui'

export function Page({ children, maxWidth = t.layout.maxWidth }: { children: ReactNode; maxWidth?: number }) {
  return <Box sx={{ maxWidth, mx: 'auto', px: t.layout.gutter, boxSizing: 'content-box', pt: { xs: 5, md: 9 } }}>{children}</Box>
}

export function PageHero({ label, title, lead, center, action, badges }: { label: string; title: ReactNode; lead?: ReactNode; center?: boolean; action?: ReactNode; badges?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: center ? 'column' : 'row' }, justifyContent: 'space-between', alignItems: center ? 'center' : { xs: 'flex-start', md: 'flex-end' }, gap: 3, pb: { xs: 4, md: 6 }, textAlign: center ? 'center' : 'left' }}>
      <Box sx={{ maxWidth: center ? 760 : 640, mx: center ? 'auto' : 0, display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Pill>{label}</Pill>
          {badges}
        </Box>
        <Typography component="h1" sx={{ ...t.type.h1, color: t.color.text, m: 0 }}>
          {title}
        </Typography>
        {lead && <Typography sx={{ ...t.type.lead, color: t.color.textSoft, mt: 2.5, maxWidth: center ? 620 : 560, mx: center ? 'auto' : 0 }}>{lead}</Typography>}
      </Box>
      {action}
    </Box>
  )
}

export function Panel({ children, sx }: { children: ReactNode; sx?: Record<string, unknown> }) {
  return <Box sx={{ ...In, ...sx }}>{children}</Box>
}

export function Stats({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <Box sx={{ ...In, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: `repeat(${items.length}, minmax(0,1fr))` }, overflow: 'hidden' }}>
      {items.map((s, i) => (
        <Box key={s.label} sx={{ p: { xs: 2.5, md: 3 }, borderLeft: { md: i ? `1px solid ${t.color.border}` : 'none' }, borderTop: { xs: i >= 2 ? `1px solid ${t.color.border}` : 'none', md: 'none' } }}>
          <Typography sx={{ ...t.type.label, color: t.color.textMuted }}>{s.label}</Typography>
          <Typography sx={{ ...t.type.stat, fontSize: { xs: 34, md: 44 }, color: t.color.text, mt: 1.5 }}>{s.value}</Typography>
        </Box>
      ))}
    </Box>
  )
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, height: 48, borderRadius: t.radius.input, background: t.color.tile, color: t.color.textLabel, width: '100%', maxWidth: 520 }}>
      <SearchIcon size={16} />
      <InputBase value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} sx={{ flex: 1, fontSize: 14, color: t.color.text, '& input::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
    </Box>
  )
}

export function Chips<T extends string>({ options, value, onChange, counts, logos }: { options: T[]; value: T; onChange: (v: T) => void; counts?: Partial<Record<T, number>>; logos?: Partial<Record<T, string>> }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o === value
        return (
          <Box key={o} component="button" onClick={() => onChange(o)} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 34, px: 1.75, borderRadius: t.radius.chip, fontSize: 14, fontWeight: 500, letterSpacing: '-0.04em', color: on ? t.color.onAccent : t.color.textSecondary, background: on ? t.color.accent : t.color.chip, transition: `color ${t.motion.base}, background ${t.motion.base}`, '&:hover': { color: on ? t.color.onAccent : t.color.text, background: on ? t.color.cream : '#2A2A2A' } }}>
            {logos?.[o] && <Avatar src={logos[o]} sx={{ width: 16, height: 16, background: 'transparent' }} />}
            {o}
            {counts?.[o] != null && (
              <Box component="span" sx={{ color: on ? 'rgba(0,0,0,.5)' : t.color.textLabel, fontWeight: 500 }}>
                {counts[o]}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

export function TableHead({ cols }: { cols: { label: string; align?: 'left' | 'right'; grow?: boolean; hide?: 'xs' | 'sm' }[] }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5, borderBottom: `1px solid ${t.color.border}`, ...t.type.caption, color: t.color.textLabel }}>
      {cols.map((c) => (
        <Box key={c.label} sx={{ flex: c.grow ? '1 1 0' : '0 0 auto', width: c.grow ? 'auto' : 120, textAlign: c.align ?? 'left', display: c.hide ? { xs: 'none', [c.hide === 'xs' ? 'sm' : 'md']: 'block' } : 'block' }}>
          {c.label}
        </Box>
      ))}
    </Box>
  )
}

export function Row({ children, onClick, hoverable = true }: { children: ReactNode; onClick?: () => void; hoverable?: boolean }) {
  return (
    <Box onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2, borderBottom: `1px solid ${t.color.border}`, cursor: onClick ? 'pointer' : 'default', transition: `background ${t.motion.fast}`, '&:last-of-type': { borderBottom: 'none' }, ...(hoverable && { '&:hover': { background: t.color.panelHover } }) }}>
      {children}
    </Box>
  )
}

export function Cell({ children, align = 'left', grow, hide, sx }: { children: ReactNode; align?: 'left' | 'right'; grow?: boolean; hide?: 'xs' | 'sm'; sx?: Record<string, unknown> }) {
  return (
    <Box sx={{ flex: grow ? '1 1 0' : '0 0 auto', width: grow ? 'auto' : 120, minWidth: 0, textAlign: align, ...t.type.small, display: hide ? { xs: 'none', [hide === 'xs' ? 'sm' : 'md']: 'block' } : 'block', ...sx }}>{children}</Box>
  )
}

// Overlapping logos followed by "+N". Holdings without a logo are counted in N rather than drawn as blank circles.
export function AvatarStack({ srcs, size = 18, max = 5, total }: { srcs: (string | undefined)[]; size?: number; max?: number; total?: number }) {
  const shown = (srcs.filter(Boolean) as string[]).slice(0, max)
  const rest = Math.max(0, (total ?? srcs.length) - shown.length)
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((s, i) => (
        <Avatar key={i} src={s} sx={{ width: size, height: size, ml: i ? `-${Math.round(size / 3)}px` : 0, border: `1.5px solid ${t.color.panel}`, background: z.surface2, fontSize: 9 }} />
      ))}
      {rest > 0 && (
        <Box component="span" sx={{ ml: 0.75, fontSize: 12, color: t.color.textMuted }}>
          +{rest}
        </Box>
      )}
    </Box>
  )
}

export function Pagination({ page, pages, onPage, perPage, onPerPage, options, total, label }: { page: number; pages: number; onPage: (p: number) => void; perPage: number; onPerPage: (n: number) => void; options: number[]; total: number; label?: string }) {
  const start = total === 0 ? 0 : page * perPage + 1
  const end = Math.min(total, (page + 1) * perPage)
  const btn = { all: 'unset', cursor: 'pointer', height: 32, px: 1.5, borderRadius: t.radius.pill, fontSize: 13, fontWeight: 500, background: t.color.chip, color: t.color.text, '&:disabled': { opacity: 0.4, cursor: 'default' } } as const
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, px: 2.5, py: 2, ...t.type.caption, color: t.color.textLabel }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        Rows per page
        {options.map((o) => (
          <Box key={o} component="button" onClick={() => onPerPage(o)} sx={{ all: 'unset', cursor: 'pointer', px: 1, py: 0.25, borderRadius: '6px', color: o === perPage ? t.color.text : t.color.textLabel, background: o === perPage ? t.color.active : 'transparent' }}>
            {o}
          </Box>
        ))}
      </Box>
      <Box>
        {start}–{end} of {total} {label ?? ''}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box component="button" disabled={page === 0} onClick={() => onPage(page - 1)} sx={btn}>
          Prev
        </Box>
        <Box>
          {page + 1} / {Math.max(1, pages)}
        </Box>
        <Box component="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} sx={btn}>
          Next
        </Box>
      </Box>
    </Box>
  )
}

export const Pct = ({ v, digits = 2 }: { v?: number; digits?: number }) => (
  <Box component="span" sx={{ color: v == null ? t.color.textMuted : v >= 0 ? t.color.green : t.color.red, fontWeight: 500 }}>
    {v == null || !isFinite(v) ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`}
  </Box>
)

// Basket icon: the basket's own icon, otherwise a 2x2 of its top holdings.
export function BasketIcon({ src, name, holdings, size = 36 }: { src?: string; name: string; holdings: (string | undefined)[]; size?: number }) {
  const tiles = holdings.filter(Boolean).slice(0, 4) as string[]
  if (src || tiles.length < 2) {
    return (
      <Avatar src={src ?? tiles[0]} alt="" sx={{ width: size, height: size, background: z.surface2, fontSize: 12, flexShrink: 0 }}>
        {name[0]}
      </Avatar>
    )
  }
  return (
    <Box aria-hidden sx={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: t.color.tile }}>
      {Array.from({ length: 4 }, (_, i) => (tiles[i] ? <Box key={i} component="img" src={tiles[i]} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <Box key={i} sx={{ background: t.color.chip }} />))}
    </Box>
  )
}
