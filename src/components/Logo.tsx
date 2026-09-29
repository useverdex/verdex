import { Box } from '@mui/material'
import { BRAND, fonts, t } from '../theme/tokens'
import { pub } from '../lib/base'
import { MARK_PATH } from './logoPath'

export const WORDMARK_SRC = pub('/brand/verdex-wordmark.svg')
export const MARK_SRC = pub('/brand/verdex-mark.svg')

// The Verdex mark as an inline icon; it keeps its own lime unless a colour is passed.
export function MarkIcon({ size = 16, color = t.color.mark }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color} aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      <path d={MARK_PATH} />
    </svg>
  )
}

// Mark + serif wordmark, as in the Sentira nav.
export function Wordmark({ size = 26, color = t.color.text }: { size?: number; color?: string }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: `${Math.round(size * 0.35)}px`, color }}>
      <MarkIcon size={size} />
      <Box component="span" sx={{ fontFamily: fonts.serif, fontSize: size + 4, lineHeight: 1, letterSpacing: '-0.01em', color, whiteSpace: 'nowrap' }}>
        {BRAND.name}
      </Box>
    </Box>
  )
}
