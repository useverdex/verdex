import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { useInView, useReducedMotion } from 'motion/react'
import { t } from '../theme/tokens'
import { chip, pill, roundBtn, roundBtnLight, tag } from '../theme/styles'
import { MarkIcon } from './Logo'

type Sx = Record<string, unknown>

// Section label pill with the lime mark: "Markets", "Tokenized Baskets".
export function Pill({ children, icon = true, sx }: { children: ReactNode; icon?: boolean; sx?: Sx }) {
  return (
    <Box component="span" sx={{ ...pill, ...sx }}>
      {icon && (
        <Box component="span" sx={{ display: 'flex', color: t.color.green }}>
          <MarkIcon size={14} />
        </Box>
      )}
      {children}
    </Box>
  )
}

export function Chip({ children, active, sx }: { children: ReactNode; active?: boolean; sx?: Sx }) {
  return (
    <Box component="span" sx={{ ...chip, ...(active && { background: t.color.accent, color: t.color.onAccent }), ...sx }}>
      {children}
    </Box>
  )
}

export function Tag({ children, sx }: { children: ReactNode; sx?: Sx }) {
  return (
    <Box component="span" sx={{ ...tag, ...sx }}>
      {children}
    </Box>
  )
}

export function RoundButton({ children, light, sx, ...rest }: { children: ReactNode; light?: boolean; sx?: Sx } & Omit<React.ComponentProps<'button'>, 'ref' | 'color'>) {
  return (
    <Box component="button" type="button" sx={{ ...(light ? roundBtnLight : roundBtn), ...sx }} {...rest}>
      {children}
    </Box>
  )
}

// Section heading: pill label, serif title, optional lead and right-hand action.
export function SectionHead({ id, label, title, lead, action, center, sx, titleSx }: { id?: string; label?: ReactNode; title: ReactNode; lead?: ReactNode; action?: ReactNode; center?: boolean; sx?: Sx; titleSx?: Sx }) {
  return (
    <Box id={id} sx={{ scrollMarginTop: 100, display: 'flex', flexDirection: { xs: 'column', md: center ? 'column' : 'row' }, justifyContent: 'space-between', alignItems: center ? 'center' : { xs: 'flex-start', md: 'flex-end' }, gap: 3, pt: t.layout.sectionTop, pb: { xs: 4, md: 6 }, textAlign: center ? 'center' : 'left', ...sx }}>
      <Box sx={{ maxWidth: center ? 640 : 560, display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start' }}>
        {label && <Pill sx={{ mb: 3 }}>{label}</Pill>}
        <Typography component="h2" sx={{ ...t.type.h2, color: t.color.text, m: 0, ...titleSx }}>
          {title}
        </Typography>
        {lead && <Typography sx={{ ...t.type.lead, color: t.color.textSoft, mt: 2.5, maxWidth: 600 }}>{lead}</Typography>}
      </Box>
      {action && <Box sx={{ flexShrink: 0, mt: center ? 1 : 0 }}>{action}</Box>}
    </Box>
  )
}

function parseStat(value: string) {
  const m = /^([^\d]*)([\d,]+)(.*)$/.exec(value)
  if (!m) return null
  return { prefix: m[1], target: Number(m[2].replace(/,/g, '')), suffix: m[3], grouped: m[2].includes(',') }
}

// Counts a stat like "1,600+" or "42 days" up from zero when it scrolls into view.
export function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const reduced = useReducedMotion()
  const parsed = useMemo(() => parseStat(value), [value])
  const [n, setN] = useState(() => (reduced && parsed ? parsed.target : 0))
  useEffect(() => {
    if (!inView || !parsed || reduced) return
    const start = performance.now()
    const duration = 1400
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(parsed.target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, parsed, reduced])
  if (!parsed) return <span ref={ref}>{value}</span>
  const shown = reduced ? parsed.target : n
  return (
    <span ref={ref}>
      {parsed.prefix}
      {parsed.grouped ? shown.toLocaleString('en-US') : String(shown)}
      {parsed.suffix}
    </span>
  )
}

// Infinite horizontal ticker; pass the items once, they are repeated to fill the loop.
export function Marquee({ children, duration = 36, sx }: { children: ReactNode; duration?: number; sx?: Sx }) {
  const run = (k: number) => (
    <Box key={k} aria-hidden={k > 0} sx={{ display: 'flex', flexShrink: 0 }}>
      {children}
    </Box>
  )
  return (
    <Box sx={{ overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', ...sx }}>
      <Box sx={{ display: 'flex', width: 'max-content', '@keyframes tickerRtl': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } }, animation: `tickerRtl ${duration}s linear infinite`, '&:hover': { animationPlayState: 'paused' }, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
        {run(0)}
        {run(1)}
      </Box>
    </Box>
  )
}

// Section container: 1150px content width with page gutters.
export function Container({ children, sx, id }: { children: ReactNode; sx?: Sx; id?: string }) {
  return (
    <Box id={id} sx={{ maxWidth: t.layout.maxWidth, mx: 'auto', px: t.layout.gutter, boxSizing: 'content-box', ...sx }}>
      {children}
    </Box>
  )
}
