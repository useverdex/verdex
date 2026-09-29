import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { BRAND, t } from '../theme/tokens'
import { CheckIcon, CopyIcon } from './icons'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

// The token's contract address as a copyable pill. `full` shows the whole address (footer); otherwise it is shortened.
export function ContractAddress({ full = false, label = 'CA' }: { full?: boolean; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BRAND.contract)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked: the address is still selectable */
    }
  }
  return (
    <Box
      component="button"
      type="button"
      onClick={copy}
      aria-label={`Copy contract address ${BRAND.contract}`}
      sx={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 1, maxWidth: '100%', px: '12px', py: '8px', borderRadius: t.radius.chip, background: t.color.chip, color: t.color.textSoft, transition: `background ${t.motion.base}, color ${t.motion.base}`, '&:hover': { background: '#2A2A2A', color: t.color.text } }}
    >
      <Box component="span" sx={{ ...t.type.caption, color: t.color.green, fontWeight: 600, letterSpacing: '0.04em', flexShrink: 0 }}>
        {label}
      </Box>
      <Typography component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'all' }}>
        {full ? BRAND.contract : short(BRAND.contract)}
      </Typography>
      <Box component="span" sx={{ display: 'flex', color: copied ? t.color.green : 'inherit', flexShrink: 0 }}>
        {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      </Box>
    </Box>
  )
}
