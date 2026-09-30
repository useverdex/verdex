import { Box, Typography } from '@mui/material'
import { t } from '../theme/tokens'

// Colours for allocation segments, in the order the assets are listed.
export const PALETTE = ['#C2EA8A', '#8FA661', '#F6F0E9', '#6F8549', '#DDE9C6', '#4E6032', '#B9B2A8', '#9DC77A', '#7A7F73', '#E4D8C8', '#5B6B45', '#2E3A1E']
export const fmtPctPlain = (n: number) => `${n.toFixed(n >= 10 ? 0 : 1)}%`

// A stacked allocation bar: one segment per asset, sized by target weight.
export function AllocBar({ assets, height = 10 }: { assets: { ticker: string; weight: number }[]; height?: number }) {
  return (
    <Box sx={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', background: t.color.tile, gap: '2px' }}>
      {assets.map((a, i) => (
        <Box key={a.ticker} title={`${a.ticker} ${fmtPctPlain(a.weight)}`} sx={{ width: `${a.weight}%`, background: PALETTE[i % PALETTE.length], transition: 'width .3s ease' }} />
      ))}
    </Box>
  )
}

// The legend under a bar: a dot, the ticker and the weight for each asset, with the tail folded into "+n".
export function AllocLegend({ assets, max = 8 }: { assets: { ticker: string; weight: number }[]; max?: number }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
      {assets.slice(0, max).map((w, i) => (
        <Typography key={w.ticker} sx={{ fontSize: 12, color: t.color.textMuted, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', background: PALETTE[i % PALETTE.length], display: 'inline-block' }} /> {w.ticker} {fmtPctPlain(w.weight)}
        </Typography>
      ))}
      {assets.length > max && <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>+{assets.length - max}</Typography>}
    </Box>
  )
}
