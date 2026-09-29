import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../theme/tokens'
import { tn } from '../theme/styles'
import { fmtUsd } from '../lib/api'
import { isDue, nowMs, usePlans } from '../lib/autoInvest'
import { isDateDue, useVaults } from '../lib/vaults'
import { useWallet } from '../components/wallet/WalletProvider'
import { MarkIcon } from './Logo'

type Due = { key: string; title: string; sub: string; path: string }

// Reminder for scheduled buys and vault rebalances that are due for the connected wallet. Shows a card in
// the corner and, when allowed, a system notification the moment something becomes due while the app is open.
export function DueBuys() {
  const plans = usePlans()
  const vaults = useVaults()
  const { account } = useWallet()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [now, setNow] = useState(nowMs)
  const notified = useRef(new Set<string>())
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const due = useMemo<Due[]>(() => {
    if (!account) return []
    const owner = account.address.toLowerCase()
    const buys = plans.filter((p) => p.owner.toLowerCase() === owner && isDue(p, now)).map((p) => ({ key: `plan:${p.id}:${p.nextRunAt}`, title: `${fmtUsd(p.amountUsd, 0)} of ${p.ticker} is due`, sub: 'Auto-Invest · one tap to confirm', path: '/auto-invest#plans' }))
    const rebalances = vaults.filter((v) => v.owner.toLowerCase() === owner && isDateDue(v, now)).map((v) => ({ key: `vault:${v.id}:${v.nextRunAt}`, title: `${v.name} is due for a rebalance`, sub: 'Vaults · review the trades, then confirm', path: '/vaults#vaults' }))
    return [...buys, ...rebalances]
  }, [plans, vaults, account, now])
  useEffect(() => {
    for (const d of due) {
      if (notified.current.has(d.key)) continue
      notified.current.add(d.key)
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(`Verdex: ${d.title}`, { body: 'Open Verdex to confirm it.', tag: d.key })
      } catch {
        /* not supported */
      }
    }
  }, [due])
  const onOwnPage = due.length > 0 && due[0].path.startsWith(pathname) && pathname !== '/'
  if (!due.length || onOwnPage) return null
  const first = due[0]
  return (
    <Box role="status" sx={{ position: 'fixed', right: 16, bottom: 'calc(16px + var(--tabbar))', zIndex: 1240, maxWidth: 'calc(100vw - 32px)', width: 360, p: 2, borderRadius: t.radius.card, background: t.color.menu, border: `1px solid ${t.color.border}`, boxShadow: '0 20px 60px rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}>
        <MarkIcon size={20} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>
          {first.title}
          {due.length > 1 ? `, and ${due.length - 1} more` : ''}
        </Typography>
        <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{first.sub}</Typography>
      </Box>
      <Button onClick={() => { navigate(first.path) }} sx={{ ...tn, flexShrink: 0 }}>
        Confirm
      </Button>
    </Box>
  )
}
