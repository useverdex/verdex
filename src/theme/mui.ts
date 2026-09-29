import { createTheme } from '@mui/material/styles'
import { fonts, t } from './tokens'

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: t.color.accent, contrastText: t.color.onAccent },
        secondary: { main: t.color.green },
        error: { main: t.color.red },
        background: { default: t.color.page, paper: t.color.menu },
        text: { primary: t.color.text, secondary: t.color.textSecondary },
        divider: t.color.border,
      },
    },
  },
  defaultColorScheme: 'dark',
  spacing: 8,
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: fonts.sans,
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: '-0.04em' },
  },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      defaultProps: { disableRipple: true, disableElevation: true },
      styleOverrides: { root: { boxShadow: 'none', minWidth: 0, '&:active': { transform: 'scale(0.98)' } } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTypography: { defaultProps: { variantMapping: { body1: 'p' } } },
  },
})
