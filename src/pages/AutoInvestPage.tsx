import { useEffect, useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { formatUnits, type Address } from 'viem'
import { useLocation } from 'react-router-dom'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { CHAIN_NAME_LOGOS, ISSUER_LOGOS, chainLogo, fmtUsd, useAssets, useChains, type Asset, type AssetToken } from '../lib/api'
import { explorerTx, describeError, type ChainX } from '../lib/lifi'
import { CADENCES, PAY_TOKENS, PHASE_LABEL, VERDEX_FEE, addPlan, askNotifications, executePlan, firstRunAt, isDue, isHolder, nextRunAfter, removePlan, schedulePreview, updatePlan, usePlans, type Cadence, type Phase, type Plan, type PlanToken } from '../lib/autoInvest'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { CalendarIcon, CheckIcon, ExternalIcon, LockIcon, RouteIcon, SearchIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel } from './common'

const AMOUNTS = [25, 50, 100, 250, 500]
const DRAFT_KEY = 'verdex-auto-invest-draft'
type Draft = { ticker: string; version?: string; amount: number; cadence: Cadence; pay: string }
const DEFAULT: Draft = { ticker: 'NVDA', amount: 100, cadence: 'week', pay: '8453' }
const payKey = (p: PlanToken) => `${p.chainId}`

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch {
    return DEFAULT
  }
}
function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    /* storage unavailable */
  }
}
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const fmtUnits = (u: number) => (u >= 100 ? u.toFixed(0) : u >= 1 ? u.toFixed(2) : u.toFixed(4))

function Label({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1.25 }}>{children}</Typography>
}

function Choice({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Box component="button" type="button" onClick={onClick} disabled={disabled} aria-pressed={on} sx={{ all: 'unset', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px', height: 34, px: '12px', borderRadius: t.radius.input, fontSize: 13, fontWeight: 500, letterSpacing: '-0.02em', color: on ? t.color.onAccent : t.color.textSecondary, background: on ? t.color.accent : t.color.chip, transition: `background ${t.motion.base}, color ${t.motion.base}`, '&:hover': { background: on ? t.color.cream : '#2A2A2A' } }}>
      {children}
    </Box>
  )
}

function Step({ n, icon, title, text }: { n: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Panel sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}>{icon}</Box>
        <Typography sx={{ ...t.type.caption, color: t.color.textFaint }}>0{n}</Typography>
      </Box>
      <Typography sx={{ ...t.type.cardTitle, color: t.color.text, mt: 2.5 }}>{title}</Typography>
      <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 1 }}>{text}</Typography>
    </Panel>
  )
}

// One saved plan: what it buys, when the next buy is, its history, and the buttons to run, pause or remove it.
function PlanCard({ plan, chains, holder, onRun, running }: { plan: Plan; chains: ChainX[] | undefined; holder: boolean; onRun: (plan: Plan) => Promise<void>; running: { id: string; phase: Phase; error?: string } | null }) {
  const due = isDue(plan)
  const cadence = CADENCES.find((c) => c.key === plan.cadence)
  const busy = running?.id === plan.id && !['idle', 'done', 'failed'].includes(running.phase)
  const payChain = chains?.find((c) => c.id === plan.pay.chainId)
  const targetChain = chains?.find((c) => c.id === plan.target.chainId)
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, borderColor: due ? 'rgba(194,234,138,.35)' : 'transparent' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Avatar src={resolveImg(plan.logo)} alt="" sx={{ width: 40, height: 40, background: z.surface2, fontSize: 13 }}>
          {plan.ticker[0]}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 500, lineHeight: 1.2 }}>
            {fmtUsd(plan.amountUsd, 0)} of {plan.ticker} {cadence?.label.toLowerCase()}
          </Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Avatar src={chainLogo(payChain)} alt="" sx={{ width: 14, height: 14, background: 'transparent' }} /> {plan.pay.symbol} on {payChain?.name ?? plan.pay.chainId}
            <span>→</span>
            <Avatar src={chainLogo(targetChain)} alt="" sx={{ width: 14, height: 14, background: 'transparent' }} /> {plan.target.symbol} on {targetChain?.name ?? plan.target.chainId}
          </Typography>
        </Box>
        <Box sx={{ ...Vg, ml: 0, ...(due && { background: 'rgba(194,234,138,.16)', color: t.color.mark }) }}>{plan.status === 'paused' ? 'Paused' : due ? 'Due now' : `Next ${fmtDate(plan.nextRunAt)}`}</Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
        <Button onClick={() => onRun(plan)} disabled={busy || plan.status === 'paused'} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14, gap: 1 }}>
          {busy ? PHASE_LABEL[running!.phase] : due ? 'Confirm buy' : 'Buy now'}
        </Button>
        <Button onClick={() => updatePlan(plan.id, { status: plan.status === 'paused' ? 'active' : 'paused', ...(plan.status === 'paused' && plan.nextRunAt < Date.now() ? { nextRunAt: nextRunAfter(Date.now(), plan.cadence) } : {}) })} disabled={busy} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none' }}>
          {plan.status === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        <Button onClick={() => removePlan(plan.id)} disabled={busy} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none', background: 'transparent', color: t.color.textMuted }}>
          Remove
        </Button>
      </Box>
      {running?.id === plan.id && running.error && <Typography sx={{ fontSize: 13, color: t.color.red, mt: 1.5 }}>{running.error}</Typography>}
      {running?.id === plan.id && running.phase === 'done' && <Typography sx={{ fontSize: 13, color: t.color.mark, mt: 1.5 }}>Bought. The tokens are in your wallet, and the next buy is {fmtDate(plan.nextRunAt)}.</Typography>}
      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>{holder ? `No ${BRAND.name} fee: this wallet holds VERDEX.` : `${BRAND.name} fee ${(VERDEX_FEE * 100).toFixed(2)}% per buy. Hold VERDEX and it is zero.`}</Typography>
      {plan.history.length > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${t.color.border}`, display: 'grid', gap: 0.75 }}>
          {plan.history.slice(0, 6).map((r) => {
            const link = explorerTx(chains?.find((c) => c.id === r.chainId), r.chainId, r.txHash)
            return (
              <Box key={r.txHash} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 13 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: t.color.mark, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 500, width: 108, whiteSpace: 'nowrap' }}>{fmtDate(r.at)}</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {Number(formatUnits(BigInt(r.fromAmount), plan.pay.decimals)).toFixed(2)} {r.fromSymbol} → {r.toAmount ? fmtUnits(Number(formatUnits(BigInt(r.toAmount), plan.target.decimals))) : '?'} {r.toSymbol}
                </Typography>
                {link && (
                  <Box component="a" href={link} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: t.color.textMuted, textDecoration: 'none', '&:hover': { color: t.color.text } }}>
                    Tx <ExternalIcon size={11} />
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </Panel>
  )
}

export default function AutoInvestPage() {
  const { data } = useAssets()
  const { data: chainList } = useChains()
  const chains = chainList as ChainX[] | undefined
  const { account, openWalletMenu, switchChain, walletClient } = useWallet()
  const plans = usePlans()
  const { hash } = useLocation()
  const [draft, setDraftState] = useState<Draft>(loadDraft)
  const setDraft = (patch: Partial<Draft>) => setDraftState((d) => { const n = { ...d, ...patch }; saveDraft(n); return n })
  const [q, setQ] = useState('')
  const [holderFor, setHolderFor] = useState<{ address: string; holder: boolean } | null>(null)
  const holder = !!account && holderFor?.address === account.address.toLowerCase() && holderFor.holder
  const [running, setRunning] = useState<{ id: string; phase: Phase; error?: string } | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  const assets = useMemo(() => data?.assets ?? [], [data])
  const evmIds = useMemo(() => new Set((chains ?? []).filter((c) => c.chainType === 'EVM').map((c) => c.id)), [chains])
  const asset: Asset | undefined = assets.find((a) => a.ticker === draft.ticker) ?? assets[0]
  const versions = useMemo(() => (asset?.tokens ?? []).filter((v) => evmIds.has(v.chainId)), [asset, evmIds])
  const pay = PAY_TOKENS.find((p) => payKey(p) === draft.pay) ?? PAY_TOKENS[0]
  const version: AssetToken | undefined = versions.find((v) => `${v.chainId}:${v.address}` === draft.version) ?? versions.find((v) => v.chainId === pay.chainId) ?? versions[0]
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return assets.filter((a) => a.ticker.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)).slice(0, 6)
  }, [assets, q])
  const cadence = CADENCES.find((c) => c.key === draft.cadence) ?? CADENCES[1]
  const dates = useMemo(() => schedulePreview(cadence.key, 6), [cadence])
  const price = version?.price ?? asset?.price ?? 0
  const units = price ? draft.amount / price : 0
  const perMonth = draft.amount * cadence.perMonth
  const perYear = perMonth * 12
  const fee = draft.amount * VERDEX_FEE
  const mine = useMemo(() => plans.filter((p) => account && p.owner.toLowerCase() === account.address.toLowerCase()), [plans, account])

  useEffect(() => {
    if (!account) return
    let alive = true
    const address = account.address.toLowerCase()
    isHolder(chainList, account.address).then((v) => alive && setHolderFor({ address, holder: v }))
    return () => {
      alive = false
    }
  }, [account, chainList])

  useEffect(() => {
    if (hash === '#plans') setTimeout(() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }, [hash, mine.length])

  const run = async (plan: Plan) => {
    if (!account || !walletClient || !chainList) return openWalletMenu()
    setRunning({ id: plan.id, phase: 'pricing' })
    try {
      await executePlan(plan, { walletClient, account, chains: chainList, switchChain, holder, onPhase: (phase) => setRunning({ id: plan.id, phase }) })
    } catch (e) {
      setRunning({ id: plan.id, phase: 'failed', error: describeError(e) })
    }
  }

  const start = async (buyNow: boolean) => {
    if (!account) return openWalletMenu()
    if (!asset || !version) return setStartError('Pick an asset with a version on an EVM chain.')
    setStartError(null)
    askNotifications()
    const target: PlanToken = { chainId: version.chainId, address: version.address, symbol: version.symbol, decimals: version.decimals, issuer: version.issuer }
    const first = firstRunAt(buyNow, cadence.key)
    const plan = addPlan({ owner: account.address as Address, ticker: asset.ticker, name: asset.name, logo: asset.logo, target, pay: { chainId: pay.chainId, address: pay.address, symbol: pay.symbol, decimals: pay.decimals }, amountUsd: draft.amount, cadence: cadence.key, nextRunAt: first })
    setTimeout(() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    if (buyNow) await run(plan)
  }

  const starting = running && !['idle', 'done', 'failed'].includes(running.phase)

  return (
    <Page>
      <PageHero
        label="Auto-Invest"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>New</Box>}
        title={
          <>
            Buy the market.
            <br />
            On schedule.
          </>
        }
        lead="A recurring buy of any tokenized stock, ETF or basket. The first buy approves the pay token once; every buy after that is one tap in your wallet on its day, priced through the best route at that moment. Funds stay in your wallet until then."
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Label>Buy</Label>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, height: 56, borderRadius: t.radius.input, background: t.color.tile }}>
              {asset && !q ? (
                <>
                  <Avatar src={resolveImg(asset.logo)} alt="" sx={{ width: 30, height: 30, background: z.surface2, fontSize: 11 }}>
                    {asset.ticker[0]}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 500, lineHeight: 1.2 }}>{asset.ticker}</Typography>
                    <Typography sx={{ fontSize: 12, color: t.color.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {asset.name} · {fmtUsd(price)}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box sx={{ display: 'flex', color: t.color.textLabel }}>
                  <SearchIcon size={16} />
                </Box>
              )}
              <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={asset && !q ? 'Change' : 'Search a stock, ETF or basket'} inputProps={{ 'aria-label': 'Search an asset' }} sx={{ flex: asset && !q ? 'none' : 1, width: asset && !q ? 110 : 'auto', fontSize: 14, color: t.color.text, '& input': { textAlign: asset && !q ? 'right' : 'left' }, '& input::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
            </Box>
            {results.length > 0 && (
              <Box sx={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', zIndex: 5, background: t.color.menu, border: `1px solid ${t.color.border}`, borderRadius: t.radius.card, boxShadow: '0 12px 40px rgba(0,0,0,.55)', p: 0.75 }}>
                {results.map((a) => (
                  <Box key={a.ticker} component="button" type="button" onClick={() => { setDraft({ ticker: a.ticker, version: undefined }); setQ('') }} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', boxSizing: 'border-box', px: 1.5, py: 1, borderRadius: t.radius.panel, '&:hover': { background: t.color.hover } }}>
                    <Avatar src={resolveImg(a.logo)} alt="" sx={{ width: 26, height: 26, background: z.surface2, fontSize: 10 }}>
                      {a.ticker[0]}
                    </Avatar>
                    <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{a.ticker}</Typography>
                    <Typography sx={{ fontSize: 13, color: t.color.textMuted, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</Typography>
                    <Typography sx={{ fontSize: 13, color: t.color.textSoft }}>{fmtUsd(a.price)}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {versions.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Label>Version</Label>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {versions.map((v) => (
                  <Choice key={`${v.chainId}:${v.address}`} on={version === v} onClick={() => setDraft({ version: `${v.chainId}:${v.address}` })}>
                    <Avatar src={ISSUER_LOGOS[v.issuer]} alt="" sx={{ width: 16, height: 16, background: 'transparent' }} />
                    {v.symbol} · {v.chain}
                  </Choice>
                ))}
              </Box>
            </Box>
          )}
          {asset && versions.length === 0 && <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 2 }}>{asset.ticker} is only issued on chains this wallet cannot reach. Pick another asset.</Typography>}

          <Box sx={{ mt: 3 }}>
            <Label>Amount</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: 34, px: 1.5, borderRadius: t.radius.input, background: t.color.tile, gap: 0.5 }}>
                <Typography sx={{ fontSize: 14, color: t.color.textLabel }}>$</Typography>
                <InputBase type="number" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ amount: Math.max(1, Math.min(100000, Number(e.target.value) || 0)) })} inputProps={{ 'aria-label': 'Amount in dollars' }} sx={{ width: 72, fontSize: 14, fontWeight: 500, color: t.color.text }} />
              </Box>
              {AMOUNTS.map((a) => (
                <Choice key={a} on={draft.amount === a} onClick={() => setDraft({ amount: a })}>
                  ${a}
                </Choice>
              ))}
            </Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Label>How often</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {CADENCES.map((c) => (
                <Choice key={c.key} on={draft.cadence === c.key} onClick={() => setDraft({ cadence: c.key })}>
                  {c.label}
                </Choice>
              ))}
            </Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Label>Pay with</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {PAY_TOKENS.map((p) => (
                <Choice key={payKey(p)} on={payKey(pay) === payKey(p)} onClick={() => setDraft({ pay: payKey(p) })}>
                  <Avatar src={CHAIN_NAME_LOGOS[p.chain]} alt="" sx={{ width: 16, height: 16, background: 'transparent' }} />
                  {p.symbol} on {p.chain}
                </Choice>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 4 }}>
            <Button onClick={() => start(true)} disabled={!!starting || (!!account && !version)} sx={{ ...Bt, gap: 1 }}>
              <LockIcon size={15} /> {!account ? 'Connect wallet' : starting ? PHASE_LABEL[running!.phase] : 'Start plan, buy now'}
            </Button>
            <Button onClick={() => start(false)} disabled={!!starting || (!!account && !version)} sx={{ ...Lt, backdropFilter: 'none' }}>
              {account ? `Start on ${fmtDate(dates[0])}` : 'Schedule'}
            </Button>
          </Box>
          {startError && <Typography sx={{ fontSize: 13, color: t.color.red, mt: 1.5 }}>{startError}</Typography>}
          <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>The plan is saved on this device for your wallet. Buys are prepared while {BRAND.name} is open, including the home-screen app; a buy that falls on a day the app was closed waits as due until you open it.</Typography>
        </Panel>

        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Label>Schedule</Label>
          <Typography sx={{ ...t.type.h4, color: t.color.text }}>
            {fmtUsd(draft.amount, 0)} of {asset?.ticker ?? '...'} {cadence.label.toLowerCase()}.
          </Typography>
          <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 0.75 }}>
            Paid in {pay.symbol} on {pay.chain}{version ? `, buying ${version.symbol} on ${version.chain}` : ''}. About {fmtUnits(units)} {asset?.ticker} per buy at today's price.
          </Typography>
          <Box sx={{ mt: 2.5, display: 'grid', gap: 0.5 }}>
            {dates.map((d, i) => (
              <Box key={d} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: t.radius.panel, background: i === 0 ? t.color.tile : 'transparent' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? t.color.mark : t.color.borderStrong, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 14, fontWeight: 500, width: { xs: 104, sm: 120 }, whiteSpace: 'nowrap' }}>{fmtDate(d)}</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted, flex: 1, display: { xs: 'none', sm: 'block' } }}>{i === 0 ? 'First scheduled buy' : 'Best route that day'}</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 500, ml: { xs: 'auto', sm: 0 } }}>{fmtUsd(draft.amount, 0)}</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted, width: { xs: 'auto', sm: 96 }, textAlign: 'right', whiteSpace: 'nowrap' }}>≈ {fmtUnits(units)}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${t.color.border}`, display: 'grid', gap: 1 }}>
            {[
              ['Per month', fmtUsd(perMonth, 0)],
              ['Per year', fmtUsd(perYear, 0)],
              [`${asset?.ticker ?? ''} per year at today's price`, fmtUnits(price ? perYear / price : 0)],
            ].map(([k, v]) => (
              <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 14 }}>
                <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{k}</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{v}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
              <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{BRAND.name} fee per buy</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {holder ? (
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: t.color.mark }}>$0.00 · you hold VERDEX</Typography>
                ) : (
                  <>
                    <Typography sx={{ fontSize: 13, color: t.color.textFaint, textDecoration: 'line-through' }}>{fmtUsd(fee)}</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: t.color.mark }}>$0.00 with VERDEX</Typography>
                  </>
                )}
              </Box>
            </Box>
            <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>Plus the route's own gas and DEX fees, shown in your wallet before you confirm.</Typography>
          </Box>
        </Panel>
      </Box>

      <Box id="plans" sx={{ mt: { xs: 8, md: 12 }, scrollMarginTop: 100 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Your plans</Typography>
          {account && mine.length > 0 && <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{mine.filter(isDue).length ? `${mine.filter(isDue).length} due now` : `${mine.length} active`}</Typography>}
        </Box>
        {!account ? (
          <Panel sx={{ p: 3, mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>Connect a wallet to see and run its plans.</Typography>
            <Button onClick={openWalletMenu} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14 }}>
              Connect
            </Button>
          </Panel>
        ) : mine.length === 0 ? (
          <Panel sx={{ p: 3, mt: 3 }}>
            <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>No plans yet for this wallet. Set one up above and press Start.</Typography>
          </Panel>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' }, gap: 2.5, mt: 3 }}>
            {mine.map((p) => (
              <PlanCard key={p.id} plan={p} chains={chains} holder={holder} onRun={run} running={running} />
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<CalendarIcon size={20} />} title="Choose the plan" text="The asset and its version, the amount, how often, and what you pay with. Any tokenized stock, ETF, commodity or basket Verdex lists on an EVM chain." />
          <Step n={2} icon={<LockIcon size={20} />} title="Approve once, then one tap" text="The first buy approves the pay token for the router once. Every buy after that is a single confirmation in your wallet when it is due." />
          <Step n={3} icon={<RouteIcon size={20} />} title="Every buy, best route" text="On each date the order is priced live across every DEX and bridge Verdex reaches, and the tokens settle in your wallet. No custody at any point." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}>
              <MarkIcon size={22} />
            </Box>
            <Box sx={{ ...Vg, ml: 0 }}>{holder ? 'You hold VERDEX' : 'Hold VERDEX'}</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Holders pay no {BRAND.name} fee on scheduled buys.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>Any amount of VERDEX on Robinhood Chain in the wallet that runs the plan removes the {(VERDEX_FEE * 100).toFixed(2)}% {BRAND.name} fee from every scheduled buy. Only the route's own gas and DEX fees apply.</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {[
            ['Zero fee', `${(VERDEX_FEE * 100).toFixed(2)}% becomes 0% on every scheduled buy for holders. Checked onchain each time.`],
            ['Every chain', 'Plans on Base, Arbitrum, Ethereum and Robinhood Chain, buying the version of the stock on any chain Verdex lists.'],
            ['Pause or remove any time', 'A paused plan never asks for anything. Removing it deletes it from this device.'],
          ].map(([k, v]) => (
            <Box key={k} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 2, borderRadius: t.radius.panel, background: t.color.tile }}>
              <Box sx={{ mt: '3px', color: t.color.mark, display: 'flex' }}>
                <CheckIcon size={16} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{k}</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>{v}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>

      <Box sx={{ mt: { xs: 8, md: 12 }, maxWidth: 760 }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Questions</Typography>
        {[
          ['Is it custodial?', `No. Each buy is a swap your wallet confirms, and the tokens land in that wallet. ${BRAND.name} never holds funds or keys.`],
          ['How many signatures?', 'The first buy of an ERC-20 pay token asks for one approval, then the swap. Every buy after that is one confirmation. Native gas tokens skip the approval.'],
          ['Does it run while the app is closed?', `Not yet. Buys are prepared while ${BRAND.name} is open, including the home-screen app, and ${BRAND.name} reminds you when one is due. If the app was closed on the day, the buy waits as due until you open it. Session permissions (ERC-7715) are next, and will let a plan run without you present.`],
          ['What if the price moves?', 'Each buy is a market order for the fixed dollar amount, so you get more units when the price is lower and fewer when it is higher. That is the point of buying on schedule.'],
          ['Where is the plan stored?', 'On this device, in the browser, tied to the wallet address that created it. Clearing site data removes it; nothing about it is sent anywhere.'],
        ].map(([qq, a]) => (
          <Box key={qq} sx={{ py: 2.5, borderTop: `1px solid ${t.color.border}` }}>
            <Typography sx={{ ...t.type.body, color: t.color.text }}>{qq}</Typography>
            <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 0.75 }}>{a}</Typography>
          </Box>
        ))}
      </Box>
    </Page>
  )
}
