// Design tokens for Verdex, following the Sentira design language: near-black surfaces,
// LT Remark serif display type, Geist UI type, white pill buttons and a lime accent.
export const t = {
  color: {
    page: '#060606',
    panel: '#0F0F0F',
    panelHover: '#121212',
    raised: '#121212',
    tile: '#171717',
    hover: 'rgba(255,255,255,.06)',
    active: 'rgba(255,255,255,.1)',
    menu: '#121212',
    chip: '#1E1E1E',
    border: 'rgba(255,255,255,.08)',
    borderPanel: 'rgba(255,255,255,.1)',
    borderStrong: 'rgba(255,255,255,.14)',
    borderButton: 'rgba(255,255,255,.14)',
    borderButtonHover: 'rgba(255,255,255,.35)',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,.8)',
    textSoft: 'rgba(255,255,255,.7)',
    textMuted: 'rgba(255,255,255,.6)',
    textLabel: 'rgba(255,255,255,.5)',
    textFaint: 'rgba(255,255,255,.3)',
    accent: '#FFFFFF',
    onAccent: '#000000',
    cream: '#F6F0E9',
    green: '#8FA661',
    mark: '#C2EA8A',
    markBg: '#01271C',
    green200: '#6F8549',
    green300: '#4E6032',
    green400: '#2E3A1E',
    greenFill: 'rgba(143,166,97,.2)',
    red: '#F87171',
  },
  type: {
    display: { fontFamily: '"LT Remark", Georgia, serif', fontSize: { xs: 90, sm: 130, md: 170 }, lineHeight: 0.95, fontWeight: 400, letterSpacing: '-0.015em' },
    h1: { fontFamily: '"LT Remark", Georgia, serif', fontSize: { xs: 44, sm: 54, md: 68 }, lineHeight: 1.1, fontWeight: 400, letterSpacing: '-0.015em' },
    h2: { fontFamily: '"LT Remark", Georgia, serif', fontSize: { xs: 40, sm: 46, md: 52 }, lineHeight: 1.225, fontWeight: 400, letterSpacing: 0 },
    pageTitle: { fontFamily: '"LT Remark", Georgia, serif', fontSize: { xs: 40, sm: 46, md: 52 }, lineHeight: 1.225, fontWeight: 400, letterSpacing: 0 },
    h3: { fontFamily: '"LT Remark", Georgia, serif', fontSize: { xs: 34, sm: 40, md: 46 }, lineHeight: 1.1, fontWeight: 400, letterSpacing: 0 },
    h4: { fontFamily: '"LT Remark", Georgia, serif', fontSize: { xs: 26, md: 28 }, lineHeight: 1.2, fontWeight: 400, letterSpacing: '-0.015em' },
    cardTitle: { fontSize: 22, lineHeight: 1.4, fontWeight: 500, letterSpacing: '-0.04em' },
    heroLead: { fontSize: { xs: 16, md: 18 }, lineHeight: 1.5, fontWeight: 500, letterSpacing: '-0.04em' },
    lead: { fontSize: { xs: 16, md: 18 }, lineHeight: 1.5, fontWeight: 500, letterSpacing: '-0.04em' },
    body: { fontSize: 16, lineHeight: 1.5, fontWeight: 500, letterSpacing: '-0.04em' },
    small: { fontSize: 14, lineHeight: 1.5, fontWeight: 500, letterSpacing: '-0.04em' },
    label: { fontSize: 14, lineHeight: 1.5, fontWeight: 500, letterSpacing: '-0.04em' },
    caption: { fontSize: 12, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.04em' },
    overline: { fontSize: 12, lineHeight: 1.2, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' },
    stat: { fontFamily: '"LT Remark", Georgia, serif', fontSize: { xs: 52, md: 70 }, lineHeight: 1, fontWeight: 400, letterSpacing: '-0.05em' },
  },
  radius: { button: '12px', input: '10px', chip: '6px', pill: '8px', panel: '10px', card: '14px' },
  icon: { inline: 14, list: 18, row: 20, tile: 48 },
  motion: { base: '0.3s cubic-bezier(0.4, 0, 0.2, 1)', fast: '0.15s ease', reveal: '0.35s ease' },
  layout: {
    maxWidth: 1150,
    gutter: { xs: '20px', sm: '40px', lg: '64px' },
    sectionTop: { xs: '100px', md: '160px' },
    sectionBottom: '80px',
    navHeight: { xs: 72, md: 85 },
  },
} as const

// Secondary surface palette used by the landing widgets and menus.
export const z = {
  bg: '#060606',
  surface1: '#0F0F0F',
  surface2: 'rgba(255,255,255,.06)',
  surface3: '#171717',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,.7)',
  textMuted: 'rgba(255,255,255,.5)',
  borderSoft: 'rgba(255,255,255,.08)',
  borderPill: 'rgba(255,255,255,.14)',
  accent: '#8FA661',
  primaryBg: '#FFFFFF',
  primaryText: '#000000',
  error: '#F87171',
} as const

// Translucent white surfaces keyed by alpha in thousandths (nt[35] => rgba(255,255,255,.04)).
export const nt = {
  35: 'rgba(255,255,255,.04)',
  60: 'rgba(255,255,255,.08)',
} as const

export const fonts = {
  sans: 'Geist, -apple-system, system-ui, "Segoe UI", sans-serif',
  serif: '"LT Remark", Georgia, "Times New Roman", serif',
  mono: 'Geist, -apple-system, system-ui, "Segoe UI", sans-serif',
  code: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const

export const ease = 'cubic-bezier(.2,.8,.2,1)'

// Padded gutter that centres content at the max width on large screens.
export const gutterPx = {
  xs: t.layout.gutter.xs,
  sm: t.layout.gutter.sm,
  lg: `max(${t.layout.gutter.lg}, calc((100vw - ${t.layout.maxWidth}px) / 2))`,
}

export const BRAND = {
  name: 'Verdex',
  wordmark: 'VERDEX',
  domain: 'verdex.app',
  contract: '0x96f455a90a80dcf0c2df6703ea4ba3bedf286e43',
  // X account; not linked from the site yet
  xHandle: '@useverdex',
  xUrl: 'https://x.com/useverdex',
} as const
