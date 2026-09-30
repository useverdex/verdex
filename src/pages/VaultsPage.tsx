import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { formatUnits, type Address } from 'viem'
import { useLocation } from 'react-router-dom'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { CHAIN_NAME_LOGOS, chainLogo, fmtUsd, useAssets, useChains, type Asset } from '../lib/api'
import { explorerTx, describeError, type ChainX } from '../lib/lifi'
import { VERDEX_FEE, askNotifications, isHolder } from '../lib/autoInvest'
import { DEFAULT_CHAIN, MAX_ASSETS, PHASE_LABEL, RULES, TEMPLATES, THRESHOLDS, addVault, chainsWithQuote, defaultQuote, executeRebalance, hasDate, isDue, nextRunAfter, nextScheduled, normalise, planRebalance, readVault, removeVault, templateAssets, toVaultAsset, updateVault, useVaults, type PlannedTrade, type Progress, type Rule, type Template, type Vault, type VaultAsset, type VaultState } from '../lib/vaults'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { CheckIcon, ExternalIcon, LockIcon, PieIcon, RefreshIcon, RouteIcon, SearchIcon, VaultIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel } from './common'
import { AllocBar, PALETTE, fmtPctPlain } from '../components/alloc'
import { adoptUpdate, pendingUpdate, unfollow, useStrategies, versionOf, current as currentChange, type Strategy } from '../lib/strategies'

const DRAFT_KEY = 'verdex-vaults-draft'
type Draft = { name: string; template?: string; chainId: number; weights: [string, number][]; rule: Rule; threshold: number }
const DEFAULT: Draft = { name: 'Magnificent 7', template: 'mag7', chainId: DEFAULT_CHAIN, weights: TEMPLATES[0].weights, rule: TEMPLATES[0].rule, threshold: TEMPLATES[0].threshold }

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
const fmtDrift = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`

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

function TemplateCard({ tpl, on, count, onClick }: { tpl: Template; on: boolean; count: number; onClick: () => void }) {
  const ws = normalise(tpl.weights.map(([ticker, weight]) => ({ ticker, weight }) as VaultAsset))
  return (
    <Box component="button" type="button" onClick={onClick} aria-pressed={on} sx={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', display: 'block', width: '100%', p: 2.5, borderRadius: t.radius.card, background: t.color.panel, border: `1px solid ${on ? 'rgba(194,234,138,.45)' : t.color.border}`, transition: `border-color ${t.motion.base}, background ${t.motion.base}`, '&:hover': { background: t.color.panelHover } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.02em' }}>{tpl.name}</Typography>
        <Box sx={{ ...Vg, ml: 0, ...(on && { background: 'rgba(194,234,138,.16)', color: t.color.mark }) }}>{count} assets</Box>
      </Box>
      <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>{tpl.tagline}</Typography>
      <Box sx={{ mt: 2 }}>
        <AllocBar assets={ws} height={8} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', mt: 1.25 }}>
        {ws.map((w, i) => (
          <Typography key={w.ticker} sx={{ fontSize: 12, color: t.color.textMuted, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', background: PALETTE[i % PALETTE.length], display: 'inline-block' }} /> {w.ticker} {fmtPctPlain(w.weight)}
          </Typography>
        ))}
      </Box>
      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>
        {tpl.rule === 'drift' ? `Only when it drifts past ${tpl.threshold}%` : `${RULES.find((r) => r.key === tpl.rule)?.label}, or past ${tpl.threshold}% drift`}
      </Typography>
    </Box>
  )
}

// One saved vault: live weights against target, the drift, and the buttons to rebalance, fund, pause or remove it.
function VaultCard({ vault, chain, chains, holder, prices, busy, onBusy, strategies, assets }: { vault: Vault; chain: ChainX | undefined; chains: ChainX[] | undefined; holder: boolean; prices: Map<string, number>; busy: boolean; onBusy: (id: string | null) => void; strategies?: Strategy[]; assets: Asset[] }) {
  const { account, openWalletMenu, switchChain, walletClient } = useWallet()
  const [state, setState] = useState<VaultState | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [plan, setPlan] = useState<{ trades: PlannedTrade[]; deposit: number } | null>(null)
  const [deposit, setDeposit] = useState('')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!chain) return
    try {
      const s = await readVault(vault, chain, prices)
      setState(s)
      setReadError(null)
    } catch (e) {
      setReadError(describeError(e))
    }
  }, [vault, chain, prices])
  useEffect(() => {
    let alive = true
    const tick = () => {
      if (alive) refresh()
    }
    tick()
    const id = window.setInterval(tick, 90_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [refresh])

  const due = isDue(vault, state ?? undefined)
  const update = pendingUpdate(vault, strategies)
  const adopt = () => {
    if (!update) return
    try {
      adoptUpdate(vault, update, assets)
      setPlan(null)
      setProgress(null)
    } catch (e) {
      setProgress({ phase: 'failed', step: 0, steps: 0, error: describeError(e) })
    }
  }
  const rule = RULES.find((r) => r.key === vault.rule)
  const running = progress && !['idle', 'done', 'failed'].includes(progress.phase)
  const empty = !state || state.total <= 0

  const preview = async (depositUsd: number) => {
    if (!account) return openWalletMenu()
    if (!chain) return
    const s = state ?? (await readVault(vault, chain, prices).catch(() => null))
    if (!s) return setReadError('Could not read the wallet right now.')
    if (depositUsd > s.quoteUsd + 0.01) return setProgress({ phase: 'failed', step: 0, steps: 0, error: `This wallet holds ${fmtUsd(s.quoteUsd)} of ${vault.quote.symbol} on ${chain.name}; it needs ${fmtUsd(depositUsd)} to add that much.` })
    const trades = planRebalance(s, depositUsd)
    setProgress(null)
    if (!trades.length) return setProgress({ phase: 'done', step: 0, steps: 0 })
    setPlan({ trades, deposit: depositUsd })
  }
  const confirm = async () => {
    if (!account || !walletClient || !chain || !plan) return openWalletMenu()
    onBusy(vault.id)
    setProgress({ phase: 'pricing', step: 1, steps: plan.trades.length })
    try {
      await executeRebalance(vault, plan.trades, { walletClient, account, chain, switchChain, holder, driftBefore: state?.maxDrift ?? 0, onProgress: setProgress })
      setPlan(null)
      setDeposit('')
      await refresh()
    } catch (e) {
      setProgress({ phase: 'failed', step: 0, steps: 0, error: describeError(e) })
      await refresh()
    } finally {
      onBusy(null)
    }
  }

  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, borderColor: due ? 'rgba(194,234,138,.35)' : 'transparent' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark, flexShrink: 0 }}>
          <VaultIcon size={20} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 500, lineHeight: 1.2 }}>{vault.name}</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Avatar src={chainLogo(chain)} alt="" sx={{ width: 14, height: 14, background: 'transparent' }} /> {chain?.name ?? vault.chainId} · {vault.assets.length} assets · {rule?.label.toLowerCase()}{vault.rule !== 'drift' ? ` or ${vault.threshold}% drift` : `, ${vault.threshold}%`}
          </Typography>
          {(vault.follow || vault.sharedBy) && <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 0.25 }}>{vault.follow ? `Follows ${vault.follow.name} by ${vault.follow.manager} · v${vault.follow.version}` : `Shared by ${vault.sharedBy}`}</Typography>}
        </Box>
        <Box sx={{ ...Vg, ml: 0, ...(due && { background: 'rgba(194,234,138,.16)', color: t.color.mark }) }}>{vault.status === 'paused' ? 'Paused' : due ? 'Rebalance due' : hasDate(vault) ? `Next ${fmtDate(vault.nextRunAt)}` : 'On target'}</Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mt: 2.5, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>Vault value</Typography>
          <Typography sx={{ ...t.type.h4, color: t.color.text }}>{state ? fmtUsd(state.total) : readError ? '-' : '…'}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>Max drift</Typography>
          <Typography sx={{ ...t.type.h4, color: state && state.maxDrift > vault.threshold ? t.color.mark : t.color.text }}>{state && !empty ? `${state.maxDrift.toFixed(1)}%` : '-'}</Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
        {(state?.holdings ?? vault.assets.map((a) => ({ ...a, units: 0, price: prices.get(a.ticker) ?? 0, usd: 0, actual: 0, drift: -a.weight }))).map((h, i) => (
          <Box key={h.ticker} sx={{ display: 'grid', gridTemplateColumns: '24px 56px 1fr 96px', alignItems: 'center', gap: 1.25 }}>
            <Avatar src={resolveImg(h.logo)} alt="" sx={{ width: 24, height: 24, background: z.surface2, fontSize: 10 }}>
              {h.ticker[0]}
            </Avatar>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{h.ticker}</Typography>
            <Box sx={{ position: 'relative', height: 8, borderRadius: 4, background: t.color.tile, overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, h.weight)}%`, background: 'rgba(255,255,255,.12)' }} />
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, empty ? 0 : h.actual)}%`, background: PALETTE[i % PALETTE.length], transition: 'width .4s ease' }} />
            </Box>
            <Typography sx={{ fontSize: 12, color: t.color.textMuted, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {empty ? '0' : h.actual.toFixed(1)}% <Box component="span" sx={{ color: t.color.textFaint }}>/ {fmtPctPlain(h.weight)}</Box>{' '}
              {!empty && <Box component="span" sx={{ color: Math.abs(h.drift) > vault.threshold ? t.color.mark : t.color.textFaint }}>{fmtDrift(h.drift)}</Box>}
            </Typography>
          </Box>
        ))}
      </Box>
      {update && (
        <Box sx={{ mt: 2.5, p: 2, borderRadius: t.radius.panel, background: 'rgba(194,234,138,.08)', border: '1px solid rgba(194,234,138,.25)' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
            {update.manager.name} updated {update.name} to v{versionOf(update)}
          </Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>{currentChange(update).note}</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
            <Button onClick={adopt} disabled={!!running || busy} sx={{ ...Bt, height: 36, px: '14px', fontSize: 13 }}>
              Adopt the new weights
            </Button>
            <Button onClick={() => unfollow(vault)} disabled={!!running} sx={{ ...Lt, height: 36, px: '14px', fontSize: 13, backdropFilter: 'none', background: 'transparent', color: t.color.textMuted }}>
              Stop following
            </Button>
          </Box>
          <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1 }}>Adopting only changes the targets on this device. The trades to get there are a normal rebalance, each confirmed in your wallet.</Typography>
        </Box>
      )}
      {readError && <Typography sx={{ fontSize: 12, color: t.color.textMuted, mt: 1.5 }}>Balances could not be read: {readError}</Typography>}
      {state && empty && !plan && <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 2 }}>Empty so far. Add {vault.quote.symbol} on {chain?.name} to buy the first allocation; this wallet holds {fmtUsd(state.quoteUsd)} of it.</Typography>}

      {plan && (
        <Box sx={{ mt: 2.5, p: 2, borderRadius: t.radius.panel, background: t.color.tile }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
            {plan.trades.length} trade{plan.trades.length > 1 ? 's' : ''} to reach target{plan.deposit ? ` with ${fmtUsd(plan.deposit, 0)} added` : ''}
          </Typography>
          <Box sx={{ mt: 1, display: 'grid', gap: 0.5 }}>
            {plan.trades.map((tr, i) => (
              <Box key={`${tr.side}-${tr.asset.ticker}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: progress && progress.step === i + 1 && running ? t.color.text : t.color.textMuted }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: progress && progress.step > i + 1 ? t.color.mark : t.color.borderStrong, flexShrink: 0 }} />
                <span style={{ width: 34, color: tr.side === 'sell' ? t.color.red : t.color.mark, fontWeight: 500 }}>{tr.side === 'sell' ? 'Sell' : 'Buy'}</span>
                <span>{fmtUsd(tr.usd)} of {tr.asset.ticker}</span>
                <Box component="span" sx={{ ml: 'auto', color: t.color.textFaint }}>{tr.side === 'sell' ? `→ ${vault.quote.symbol}` : `← ${vault.quote.symbol}`}</Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
            <Button onClick={confirm} disabled={!!running || busy} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14, gap: 1 }}>
              <LockIcon size={14} /> {running ? `${PHASE_LABEL[progress!.phase]} ${progress!.step}/${progress!.steps}` : `Confirm ${plan.trades.length > 1 ? `${plan.trades.length} trades` : 'trade'}`}
            </Button>
            <Button onClick={() => { setPlan(null); setProgress(null) }} disabled={!!running} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none' }}>
              Cancel
            </Button>
          </Box>
          {running && progress?.trade && <Typography sx={{ fontSize: 12, color: t.color.textMuted, mt: 1 }}>{progress.trade.side === 'sell' ? 'Selling' : 'Buying'} {fmtUsd(progress.trade.usd)} of {progress.trade.asset.ticker}. Each trade is one confirmation in your wallet.</Typography>}
        </Box>
      )}

      {!plan && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5, alignItems: 'center' }}>
          <Button onClick={() => preview(0)} disabled={!!running || busy || vault.status === 'paused' || !state} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14, gap: 1 }}>
            <RefreshIcon size={14} /> {due ? 'Rebalance' : 'Rebalance now'}
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', height: 40, borderRadius: t.radius.input, background: t.color.tile, pl: 1.5, overflow: 'hidden' }}>
            <Typography sx={{ fontSize: 14, color: t.color.textLabel }}>$</Typography>
            <InputBase type="number" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="Add" inputProps={{ 'aria-label': 'Amount to add' }} sx={{ width: 72, fontSize: 14, fontWeight: 500, color: t.color.text, px: 0.75, '& input::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
            <Button onClick={() => preview(Math.max(0, Number(deposit) || 0))} disabled={!!running || busy || vault.status === 'paused' || !(Number(deposit) > 0)} sx={{ ...Lt, height: 40, px: '14px', fontSize: 14, backdropFilter: 'none', borderRadius: 0, background: 'rgba(255,255,255,.06)' }}>
              Add {vault.quote.symbol}
            </Button>
          </Box>
          <Button onClick={() => updateVault(vault.id, { status: vault.status === 'paused' ? 'active' : 'paused', ...(vault.status === 'paused' && hasDate(vault) && vault.nextRunAt < Date.now() ? { nextRunAt: nextRunAfter(Date.now(), vault.rule) } : {}) })} disabled={!!running} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none' }}>
            {vault.status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          <Button onClick={() => removeVault(vault.id)} disabled={!!running} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none', background: 'transparent', color: t.color.textMuted }}>
            Remove
          </Button>
        </Box>
      )}
      {progress?.phase === 'failed' && progress.error && <Typography sx={{ fontSize: 13, color: t.color.red, mt: 1.5 }}>{progress.error}</Typography>}
      {progress?.phase === 'done' && <Typography sx={{ fontSize: 13, color: t.color.mark, mt: 1.5 }}>{progress.steps ? `Rebalanced in ${progress.steps} trade${progress.steps > 1 ? 's' : ''}. The tokens are in your wallet.` : 'Already on target. Nothing to trade.'}</Typography>}
      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>{holder ? `No ${BRAND.name} fee: this wallet holds VERDEX.` : `${BRAND.name} fee ${(VERDEX_FEE * 100).toFixed(2)}% per trade. Hold VERDEX and it is zero.`}</Typography>

      {vault.history.length > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${t.color.border}` }}>
          <Box component="button" type="button" onClick={() => setOpen((o) => !o)} sx={{ all: 'unset', cursor: 'pointer', fontSize: 13, color: t.color.textMuted, '&:hover': { color: t.color.text } }}>
            {vault.history.length} rebalance{vault.history.length > 1 ? 's' : ''} · {open ? 'Hide' : 'Show'}
          </Box>
          {open && (
            <Box sx={{ mt: 1.25, display: 'grid', gap: 1 }}>
              {vault.history.slice(0, 8).map((rb) => (
                <Box key={rb.at}>
                  <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                    {fmtDate(rb.at)} · {rb.trades.length} trade{rb.trades.length > 1 ? 's' : ''} · drift was {rb.driftBefore.toFixed(1)}%
                  </Typography>
                  {rb.trades.map((tr) => {
                    const link = explorerTx(chains?.find((c) => c.id === tr.chainId), tr.chainId, tr.txHash)
                    const fromDec = tr.side === 'sell' ? vault.assets.find((a) => a.ticker === tr.ticker)?.token.decimals ?? 18 : vault.quote.decimals
                    return (
                      <Box key={tr.txHash} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: t.color.textMuted, mt: 0.5, pl: 1.5 }}>
                        <span style={{ color: tr.side === 'sell' ? t.color.red : t.color.mark, fontWeight: 500 }}>{tr.side === 'sell' ? 'Sold' : 'Bought'}</span>
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {Number(formatUnits(BigInt(tr.fromAmount), fromDec)).toFixed(fromDec === 6 ? 2 : 4)} {tr.fromSymbol} → {tr.toSymbol}
                        </span>
                        {link && (
                          <Box component="a" href={link} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: t.color.textMuted, textDecoration: 'none', '&:hover': { color: t.color.text } }}>
                            Tx <ExternalIcon size={11} />
                          </Box>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Panel>
  )
}

export default function VaultsPage() {
  const { data } = useAssets()
  const { data: chainList } = useChains()
  const chains = chainList as ChainX[] | undefined
  const { account, openWalletMenu } = useWallet()
  const vaults = useVaults()
  const { data: registry } = useStrategies()
  const { hash } = useLocation()
  const [draft, setDraftState] = useState<Draft>(loadDraft)
  const setDraft = (patch: Partial<Draft>) => setDraftState((d) => { const n = { ...d, ...patch }; saveDraft(n); return n })
  const [q, setQ] = useState('')
  const [holderFor, setHolderFor] = useState<{ address: string; holder: boolean } | null>(null)
  const holder = !!account && holderFor?.address === account.address.toLowerCase() && holderFor.holder
  const [busyId, setBusyId] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const assets = useMemo(() => data?.assets ?? [], [data])
  const quotes = useMemo(() => chainsWithQuote(chains), [chains])
  const chain = chains?.find((c) => c.id === draft.chainId)
  const quote = defaultQuote(draft.chainId)
  const onChain = useMemo(() => assets.filter((a) => a.tokens.some((tk) => tk.chainId === draft.chainId)), [assets, draft.chainId])
  const prices = useMemo(() => new Map(assets.map((a) => [a.ticker, a.tokens.find((tk) => tk.chainId === draft.chainId)?.price ?? a.price])), [assets, draft.chainId])
  const rows = useMemo(() => draft.weights.map(([ticker, weight]) => ({ ticker, weight, asset: onChain.find((a) => a.ticker === ticker) })), [draft.weights, onChain])
  const usable = rows.filter((r) => r.asset)
  const missing = rows.filter((r) => !r.asset && assets.some((a) => a.ticker === r.ticker))
  const preview = useMemo(() => normalise(usable.map((r) => ({ ticker: r.ticker, weight: r.weight }) as VaultAsset)), [usable])
  const totalWeight = draft.weights.reduce((s, [, w]) => s + Math.max(0, w), 0)
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const have = new Set(draft.weights.map(([tk]) => tk))
    return onChain.filter((a) => !have.has(a.ticker) && (a.ticker.toLowerCase().includes(s) || a.name.toLowerCase().includes(s))).slice(0, 6)
  }, [onChain, q, draft.weights])
  const rule = RULES.find((r) => r.key === draft.rule) ?? RULES[1]
  const nextDate = useMemo(() => nextScheduled(rule.key), [rule])
  const mine = useMemo(() => vaults.filter((v) => account && v.owner.toLowerCase() === account.address.toLowerCase()), [vaults, account])
  const tpl = TEMPLATES.find((x) => x.id === draft.template)

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
    if (hash === '#vaults') setTimeout(() => document.getElementById('vaults')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }, [hash, mine.length])

  const applyTemplate = (x: Template) => setDraft({ template: x.id, name: x.name, weights: x.weights, rule: x.rule, threshold: x.threshold })
  const setWeight = (ticker: string, weight: number) => setDraft({ template: undefined, weights: draft.weights.map(([tk, w]) => (tk === ticker ? [tk, weight] : [tk, w])) })
  const remove = (ticker: string) => setDraft({ template: undefined, weights: draft.weights.filter(([tk]) => tk !== ticker) })
  const addAsset = (a: Asset) => {
    if (draft.weights.length >= MAX_ASSETS) return
    const w = draft.weights.length ? Math.round(totalWeight / draft.weights.length) : 100
    setDraft({ template: undefined, weights: [...draft.weights, [a.ticker, w]] })
    setQ('')
  }
  const equalise = () => setDraft({ template: undefined, weights: draft.weights.map(([tk]) => [tk, Math.round(1000 / draft.weights.length) / 10]) })

  const create = () => {
    if (!account) return openWalletMenu()
    const built = tpl ? templateAssets(tpl, assets, draft.chainId) : normalise(usable.map((r) => toVaultAsset(r.asset!, draft.chainId, r.weight)!))
    if (built.length < 2) return setCreateError('A vault needs at least two assets that exist on the chosen chain.')
    if (!draft.name.trim()) return setCreateError('Give the vault a name.')
    setCreateError(null)
    askNotifications()
    const v = addVault({ owner: account.address as Address, name: draft.name.trim(), template: tpl?.id, chainId: draft.chainId, quote: { chainId: quote.chainId, address: quote.address, symbol: quote.symbol, decimals: quote.decimals }, assets: built, rule: draft.rule, threshold: draft.threshold, nextRunAt: nextRunAfter(Date.now(), draft.rule) })
    setTimeout(() => document.getElementById(`vault-${v.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  return (
    <Page>
      <PageHero
        label="Vaults"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>New</Box>}
        title={
          <>
            Your allocation.
            <br />
            Kept on target.
          </>
        }
        lead="Pick a strategy or set your own weights across tokenized stocks, ETFs and commodities. The vault lives in your wallet. When it drifts or its date comes, Verdex plans the trades to bring it back and you confirm them in one sitting."
      />

      <Box>
        <Label>Strategies</Label>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))' }, gap: 2 }}>
          {TEMPLATES.map((x) => (
            <TemplateCard key={x.id} tpl={x} on={draft.template === x.id} count={templateAssets(x, assets, draft.chainId).length || x.weights.length} onClick={() => applyTemplate(x)} />
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr' }, gap: 2.5, alignItems: 'start', mt: 2.5 }}>
        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Label>Vault</Label>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, height: 56, borderRadius: t.radius.input, background: t.color.tile }}>
            <Box sx={{ display: 'flex', color: t.color.mark }}>
              <VaultIcon size={18} />
            </Box>
            <InputBase value={draft.name} onChange={(e) => setDraft({ name: e.target.value.slice(0, 40) })} placeholder="Name the vault" inputProps={{ 'aria-label': 'Vault name' }} sx={{ flex: 1, fontSize: 15, fontWeight: 500, color: t.color.text, '& input::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
            {tpl && <Box sx={{ ...Vg, ml: 0 }}>{tpl.name}</Box>}
          </Box>

          <Box sx={{ mt: 3 }}>
            <Label>Chain</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(quotes.length ? quotes : [quote]).map((qt) => (
                <Choice key={qt.chainId} on={draft.chainId === qt.chainId} onClick={() => setDraft({ chainId: qt.chainId })}>
                  <Avatar src={CHAIN_NAME_LOGOS[qt.chain]} alt="" sx={{ width: 16, height: 16, background: 'transparent' }} />
                  {qt.chain} · {qt.symbol}
                </Choice>
              ))}
            </Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
              <Label>Assets and weights</Label>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                <Typography sx={{ fontSize: 12, color: Math.abs(totalWeight - 100) < 0.05 ? t.color.textLabel : t.color.textMuted, mb: 1.25 }}>{totalWeight.toFixed(0)}% set{Math.abs(totalWeight - 100) >= 0.05 ? ', scaled to 100%' : ''}</Typography>
                <Box component="button" type="button" onClick={equalise} sx={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: t.color.textMuted, mb: 1.25, '&:hover': { color: t.color.text } }}>
                  Equal weights
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {rows.map((r, i) => (
                <Box key={r.ticker} sx={{ display: 'grid', gridTemplateColumns: '28px 1fr 84px 28px', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, borderRadius: t.radius.panel, background: t.color.tile, opacity: r.asset ? 1 : 0.55 }}>
                  <Avatar src={resolveImg(r.asset?.logo)} alt="" sx={{ width: 28, height: 28, background: z.surface2, fontSize: 11, border: `2px solid ${PALETTE[i % PALETTE.length]}` }}>
                    {r.ticker[0]}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2 }}>{r.ticker}</Typography>
                    <Typography sx={{ fontSize: 12, color: t.color.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.asset ? `${r.asset.name} · ${fmtUsd(prices.get(r.ticker))}` : `Not issued on ${chain?.name ?? 'this chain'}, skipped`}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', height: 32, px: 1, borderRadius: t.radius.input, background: t.color.chip, gap: 0.25 }}>
                    <InputBase type="number" inputMode="decimal" value={r.weight} onChange={(e) => setWeight(r.ticker, Math.max(0, Math.min(100, Number(e.target.value) || 0)))} aria-label={`${r.ticker} weight`} sx={{ width: 44, fontSize: 13, fontWeight: 500, color: t.color.text, '& input': { textAlign: 'right', p: 0 } }} />
                    <Typography sx={{ fontSize: 13, color: t.color.textLabel }}>%</Typography>
                  </Box>
                  <Box component="button" type="button" onClick={() => remove(r.ticker)} aria-label={`Remove ${r.ticker}`} sx={{ all: 'unset', cursor: 'pointer', width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: '8px', color: t.color.textLabel, '&:hover': { color: t.color.text, background: t.color.hover } }}>
                    ×
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ position: 'relative', mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, height: 46, borderRadius: t.radius.input, background: t.color.tile, opacity: draft.weights.length >= MAX_ASSETS ? 0.5 : 1 }}>
                <Box sx={{ display: 'flex', color: t.color.textLabel }}>
                  <SearchIcon size={16} />
                </Box>
                <InputBase value={q} onChange={(e) => setQ(e.target.value)} disabled={draft.weights.length >= MAX_ASSETS} placeholder={draft.weights.length >= MAX_ASSETS ? `Up to ${MAX_ASSETS} assets` : `Add a stock, ETF or commodity on ${chain?.name ?? 'this chain'}`} inputProps={{ 'aria-label': 'Add an asset' }} sx={{ flex: 1, fontSize: 14, color: t.color.text, '& input::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
              </Box>
              {results.length > 0 && (
                <Box sx={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', zIndex: 5, background: t.color.menu, border: `1px solid ${t.color.border}`, borderRadius: t.radius.card, boxShadow: '0 12px 40px rgba(0,0,0,.55)', p: 0.75 }}>
                  {results.map((a) => (
                    <Box key={a.ticker} component="button" type="button" onClick={() => addAsset(a)} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', boxSizing: 'border-box', px: 1.5, py: 1, borderRadius: t.radius.panel, '&:hover': { background: t.color.hover } }}>
                      <Avatar src={resolveImg(a.logo)} alt="" sx={{ width: 26, height: 26, background: z.surface2, fontSize: 10 }}>
                        {a.ticker[0]}
                      </Avatar>
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{a.ticker}</Typography>
                      <Typography sx={{ fontSize: 13, color: t.color.textMuted, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</Typography>
                      <Typography sx={{ fontSize: 13, color: t.color.textSoft }}>{fmtUsd(prices.get(a.ticker))}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            {missing.length > 0 && <Typography sx={{ fontSize: 12, color: t.color.textMuted, mt: 1 }}>{missing.map((m) => m.ticker).join(', ')} {missing.length > 1 ? 'are' : 'is'} not issued on {chain?.name ?? 'this chain'} and will be left out.</Typography>}
          </Box>

          <Box sx={{ mt: 3 }}>
            <Label>Rebalance</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {RULES.map((r) => (
                <Choice key={r.key} on={draft.rule === r.key} onClick={() => setDraft({ rule: r.key })}>
                  {r.label}
                </Choice>
              ))}
            </Box>
            <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1 }}>{rule.note}{rule.key !== 'drift' ? ' Also when an asset drifts past the threshold.' : ''}</Typography>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Label>Drift threshold</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {THRESHOLDS.map((th) => (
                <Choice key={th} on={draft.threshold === th} onClick={() => setDraft({ threshold: th })}>
                  {th}% off target
                </Choice>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 4 }}>
            <Button onClick={create} disabled={!!account && usable.length < 2} sx={{ ...Bt, gap: 1 }}>
              <LockIcon size={15} /> {!account ? 'Connect wallet' : 'Create vault'}
            </Button>
          </Box>
          {createError && <Typography sx={{ fontSize: 13, color: t.color.red, mt: 1.5 }}>{createError}</Typography>}
          <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>The vault is saved on this device for your wallet. Its holdings are the tokens in that wallet, read live. Rebalances are prepared while {BRAND.name} is open and every trade is a confirmation in your wallet.</Typography>
        </Panel>

        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Label>Allocation</Label>
          <Typography sx={{ ...t.type.h4, color: t.color.text }}>{draft.name.trim() || 'Untitled vault'}</Typography>
          <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 0.75 }}>
            {preview.length} assets on {chain?.name ?? '…'}, funded with {quote.symbol}. {rule.label}{rule.key !== 'drift' ? `, or when any asset drifts ${draft.threshold}% off target` : ` past ${draft.threshold}%`}.
          </Typography>
          <Box sx={{ mt: 2.5 }}>
            <AllocBar assets={preview} height={14} />
          </Box>
          <Box sx={{ mt: 2, display: 'grid', gap: 0.5 }}>
            {preview.map((a, i) => {
              const asset = onChain.find((x) => x.ticker === a.ticker)
              return (
                <Box key={a.ticker} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: t.radius.panel, background: i === 0 ? t.color.tile : 'transparent' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                  <Avatar src={resolveImg(asset?.logo)} alt="" sx={{ width: 22, height: 22, background: z.surface2, fontSize: 9 }}>
                    {a.ticker[0]}
                  </Avatar>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, width: 64 }}>{a.ticker}</Typography>
                  <Typography sx={{ fontSize: 13, color: t.color.textMuted, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: { xs: 'none', sm: 'block' } }}>{asset?.category}</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, ml: 'auto' }}>{fmtPctPlain(a.weight)}</Typography>
                  <Typography sx={{ fontSize: 13, color: t.color.textMuted, width: 72, textAlign: 'right' }}>{fmtUsd((a.weight / 100) * 1000, 0)}</Typography>
                </Box>
              )
            })}
            {preview.length === 0 && <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>Add at least two assets that exist on {chain?.name ?? 'this chain'}.</Typography>}
          </Box>
          <Box sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${t.color.border}`, display: 'grid', gap: 1 }}>
            {[
              ['Per $1,000 vault', `${preview.length} buys`],
              ['Next scheduled rebalance', rule.key === 'drift' ? 'Only on drift' : fmtDate(nextDate)],
              ['Trades per rebalance', 'Only the assets off target'],
            ].map(([k, v]) => (
              <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 14 }}>
                <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{k}</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{v}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
              <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{BRAND.name} fee per trade</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {holder ? (
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: t.color.mark }}>0% · you hold VERDEX</Typography>
                ) : (
                  <>
                    <Typography sx={{ fontSize: 13, color: t.color.textFaint, textDecoration: 'line-through' }}>{(VERDEX_FEE * 100).toFixed(2)}%</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: t.color.mark }}>0% with VERDEX</Typography>
                  </>
                )}
              </Box>
            </Box>
            <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>Plus each route's own gas and DEX fees, shown in your wallet before you confirm.</Typography>
          </Box>
        </Panel>
      </Box>

      <Box id="vaults" sx={{ mt: { xs: 8, md: 12 }, scrollMarginTop: 100 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Your vaults</Typography>
          {account && mine.length > 0 && <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{mine.length} on this wallet</Typography>}
        </Box>
        {!account ? (
          <Panel sx={{ p: 3, mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>Connect a wallet to see and rebalance its vaults.</Typography>
            <Button onClick={openWalletMenu} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14 }}>
              Connect
            </Button>
          </Panel>
        ) : mine.length === 0 ? (
          <Panel sx={{ p: 3, mt: 3 }}>
            <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>No vaults yet for this wallet. Pick a strategy above and press Create.</Typography>
          </Panel>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' }, gap: 2.5, mt: 3 }}>
            {mine.map((v) => (
              <Box key={v.id} id={`vault-${v.id}`} sx={{ scrollMarginTop: 100 }}>
                <VaultCard vault={v} chain={chains?.find((c) => c.id === v.chainId)} chains={chains} holder={holder} prices={prices} busy={!!busyId && busyId !== v.id} onBusy={setBusyId} strategies={registry?.strategies} assets={assets} />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<PieIcon size={20} />} title="Set the targets" text="A curated strategy or your own weights across any tokenized stocks, ETFs and commodities on the chain you choose. Up to twelve assets." />
          <Step n={2} icon={<RefreshIcon size={20} />} title="Verdex watches the drift" text="Balances and prices are read live from the chain. When an asset moves past your threshold, or the schedule comes round, the vault is marked due and you are reminded." />
          <Step n={3} icon={<RouteIcon size={20} />} title="Rebalance in one sitting" text="Sells of the overweight assets, then buys of the underweight ones, each priced through the best route and confirmed in your wallet. Tokens never leave it." />
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
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Holders pay no {BRAND.name} fee on rebalances.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>Any amount of VERDEX on Robinhood Chain in the wallet that owns the vault removes the {(VERDEX_FEE * 100).toFixed(2)}% {BRAND.name} fee from every rebalance trade. Only the route's own gas and DEX fees apply.</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {[
            ['Zero fee', `${(VERDEX_FEE * 100).toFixed(2)}% becomes 0% on every rebalance trade for holders. Checked onchain each time.`],
            ['Your keys, your vault', 'The holdings are plain tokens in your wallet. Send them, sell them or lend them any time; the vault just reads what is there.'],
            ['Pause or remove any time', 'A paused vault never asks for anything. Removing it deletes it from this device and leaves the tokens where they are.'],
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
          ['Is it custodial?', `No. A vault is a set of targets saved on this device. The holdings are the tokens in your wallet, and every rebalance trade is a swap that wallet confirms. ${BRAND.name} never holds funds or keys.`],
          ['How do I fund it?', `Hold the quote token (${quote.symbol} on ${quote.chain}, or the equivalent on the chain you chose) in the wallet and press Add. The vault buys each asset at its target weight. You can also send the tokens in directly; the vault reads whatever is there.`],
          ['How many signatures?', 'One per trade, plus one approval the first time each token is sold or the quote token is spent. A rebalance touches only the assets that are off target, so most are two or three confirmations.'],
          ['What counts as drift?', 'The gap between an asset\'s share of the vault today and its target weight, in percentage points. A 25% target at 31% is 6 points of drift. The vault is due when any asset passes your threshold.'],
          ['Does it run while the app is closed?', `Not yet. Drift is checked and rebalances are prepared while ${BRAND.name} is open, including the home-screen app. A vault that becomes due while the app was closed waits as due until you open it. Session permissions (ERC-7715) are next and will let a vault rebalance without you present.`],
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
