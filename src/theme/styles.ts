import type { SxProps, Theme } from '@mui/material/styles'
import { fonts, nt, t, z } from './tokens'

// Primary button: white, 12px radius ("White Large").
export const Bt: SxProps<Theme> = {
  border: 0,
  px: '19px',
  py: '9px',
  minWidth: 0,
  height: 42,
  gap: '8px',
  borderRadius: t.radius.button,
  background: t.color.accent,
  color: t.color.onAccent,
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.5,
  letterSpacing: '-0.04em',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  transition: `background ${t.motion.base}, transform ${t.motion.base}, opacity ${t.motion.base}`,
  '&:hover': { background: t.color.cream, transform: 'translateY(-1px)' },
  '&.Mui-disabled': { background: t.color.tile, color: t.color.textFaint },
}

// Secondary button: translucent, blurred ("Transparent").
export const Lt: SxProps<Theme> = {
  px: '20px',
  py: '10px',
  minWidth: 0,
  height: 44,
  gap: '8px',
  borderRadius: t.radius.button,
  background: 'rgba(255,255,255,.1)',
  backdropFilter: 'blur(15px)',
  WebkitBackdropFilter: 'blur(15px)',
  border: 0,
  color: t.color.text,
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.5,
  letterSpacing: '-0.04em',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  transition: `background ${t.motion.base}, transform ${t.motion.base}`,
  '& .btn-arrow': { transition: `transform ${t.motion.base}` },
  '&:hover': { background: 'rgba(255,255,255,.16)', transform: 'translateY(-1px)' },
  '&:hover .btn-arrow': { transform: 'translateX(3px)' },
}

// Small primary button ("White Small"): Connect wallet, inline actions.
export const tn: SxProps<Theme> = {
  ...Bt,
  height: 37,
  px: '16px',
  py: '8px',
  fontSize: 14,
}

// Card surface.
export const In = {
  backgroundColor: t.color.panel,
  border: `1px solid transparent`,
  borderRadius: t.radius.card,
} as const

// Dropdown / popover paper.
export const Ct: SxProps<Theme> = {
  background: t.color.menu,
  backgroundImage: 'none',
  border: `1px solid ${t.color.border}`,
  borderRadius: t.radius.card,
  boxShadow: '0 12px 40px rgba(0,0,0,.55)',
}

// Feature row inside a card.
export const fH = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 2,
  py: 1.5,
  borderRadius: t.radius.panel,
  border: `1px solid transparent`,
  background: nt[35],
} as const

// Small "Soon" badge.
export const Vg = {
  ml: 0.75,
  px: '8px',
  py: '2px',
  borderRadius: '4px',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: '-0.04em',
  color: t.color.textSoft,
  background: 'rgba(255,255,255,.1)',
} as const

// "Beta" tag on the logo.
export const pte = {
  position: 'absolute',
  top: -4,
  right: -2,
  px: '5px',
  borderRadius: '4px',
  fontSize: 9,
  fontWeight: 600,
  lineHeight: '14px',
  letterSpacing: '0.04em',
  color: '#000',
  background: t.color.green,
  pointerEvents: 'none',
} as const

// Footer link.
export const Zg = {
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 500,
  letterSpacing: '-0.04em',
  color: t.color.text,
  textDecoration: 'none',
  transition: `color ${t.motion.base}`,
  '&:hover': { color: t.color.green },
} as const

export const monoChip = {
  fontFamily: fonts.mono,
  fontSize: 12,
  letterSpacing: '-0.04em',
  textTransform: 'none',
} as const

// Section label pill with the lime mark: "About us", "Markets".
export const pill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  px: '12px',
  py: '5px',
  borderRadius: t.radius.pill,
  background: t.color.chip,
  color: t.color.text,
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 500,
  letterSpacing: '-0.04em',
  whiteSpace: 'nowrap',
} as const

// Tag chip: "Workflow Audit".
export const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  px: '14px',
  py: '5px',
  borderRadius: t.radius.chip,
  background: t.color.chip,
  color: t.color.textSecondary,
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 500,
  letterSpacing: '-0.04em',
  whiteSpace: 'nowrap',
} as const

// Tiny chip: "Week 1".
export const tag = {
  display: 'inline-flex',
  alignItems: 'center',
  px: '10px',
  py: '5px',
  borderRadius: '4px',
  background: 'rgba(255,255,255,.1)',
  color: t.color.textSoft,
  fontSize: 12,
  lineHeight: 1.2,
  fontWeight: 500,
  letterSpacing: '-0.04em',
  whiteSpace: 'nowrap',
} as const

// Round icon button (nav "+", carousel arrows, accordion toggles).
export const roundBtn = {
  all: 'unset',
  boxSizing: 'border-box',
  cursor: 'pointer',
  width: 38,
  height: 38,
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  background: t.color.chip,
  color: t.color.text,
  transition: `background ${t.motion.base}, color ${t.motion.base}, transform ${t.motion.base}`,
  '&:hover': { background: '#2A2A2A' },
  '&:focus-visible': { outline: `1px solid ${t.color.borderButtonHover}`, outlineOffset: 2 },
} as const

export const roundBtnLight = {
  ...roundBtn,
  background: t.color.accent,
  color: t.color.onAccent,
  '&:hover': { background: t.color.cream },
} as const

export { z }
