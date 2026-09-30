import { useEffect, useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { formatUnits, type Address } from 'viem'
import { useLocation } from 'react-router-dom'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { CHAIN_NAME_LOGOS, ISSUER_LOGOS, chainLogo, fmtUsd, useAssets, useChains, type Asset, type AssetToken } from '../lib/api'
import { explorerTx, describeError, type ChainX } from '../lib/lifi'
import { VERDEX_FEE, askNotifications, isHolder, type PlanToken } from '../lib/autoInvest'
import { defaultQuote } from '../lib/vaults'
import { EXPIRIES, PHASE_LABEL, QUOTE_TOKENS, addOrder, describe, distance, explain, fillOrder, heldUnits, isLive, nowMs, removeOrder, updateOrder, useOrders, watch, type Order, type Phase, type Side, type Trigger } from '../lib/orders'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { CheckIcon, ExternalIcon, LockIcon, RouteIcon, SearchIcon, TargetIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel } from './common'

const AMOUNTS = [50, 100, 250, 500, 1000]
const OFFSETS = [-10, -5, -2, 2, 5, 10]
const DRAFT_KEY = 'verdex-orders-draft'
type Draft = { ticker: string; version?: string; side: Side; trigger: Trigger; price: string; amount: number; units: string; expiry: string; quote: string }
const DEFAULT: Draft = { ticker: 'NVDA', side: 'buy', trigger: 'below', price: '', amount: 250, units: '', expiry: 'gtc', quote: '4663' }

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
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtUnits = (u: number) => (u >= 100 ? u.toFixed(0) : u >= 1 ? u.toFixed(2) : u.toFixed(4))
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
const STATUS: Record<Order['status'], string> = { open: 'Open', triggered: 'Triggered', filled: 'Filled', cancelled: 'Cancelled', expired: 'Expired' }

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

// The distance between the live price and the trigger, as a rail with both marked.
function Rail({ price, trigger, side }: { price: number; trigger: number; side: Side }) {
  const lo = Math.min(price, trigger), hi = Math.max(price, trigger)
  const span = Math.max(hi - lo, price * 0.02)
  const left = lo - span * 0.35, width = span * 1.7
  const x = (v: number) => `${Math.max(2, Math.min(98, ((v - left) / width) * 100)).toFixed(1)}%`
  return (
    <Box sx={{ position: 'relative', height: 28, mt: 1.5 }}>
      <Box sx={{ position: 'absolute', left: 0, right: 0, top: 13, height: 2, background: t.color.borderStrong }} />
      <Box sx={{ position: 'absolute', top: 8, width: 12, height: 12, borderRadius: '50%', background: t.color.text, left: x(price), transform: 'translateX(-50%)' }} />
      <Box sx={{ position: 'absolute', top: 4, width: 2, height: 20, background: side === 'buy' ? t.color.mark : t.color.red, left: x(trigger), transform: 'translateX(-50%)' }} />
    </Box>
  )
}

// One order: what it does, where the price is against it, and the buttons to fill, cancel or remove it.
function OrderCard({ order, chains, holder, onFill, running }: { order: Order; chains: ChainX[] | undefined; holder: boolean; onFill: (o: Order) => Promise<void>; running: { id: string; phase: Phase; error?: string } | null }) {
  const busy = running?.id === order.id && !['idle', 'done', 'failed'].includes(running.phase)
  const live = isLive(order)
  const price = order.lastPrice
  const dist = price ? distance(order, price) : undefined
  const chain = chains?.find((c) => c.id === order.asset.chainId)
  const link = order.fill ? explorerTx(chains?.find((c) => c.id === order.fill!.chainId), order.fill.chainId, order.fill.txHash) : undefined
  const size = order.side === 'buy' ? fmtUsd(order.amountUsd ?? 0, 0) : `${fmtUnits(order.units ?? 0)} ${order.ticker}`
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, borderColor: order.status === 'triggered' ? 'rgba(194,234,138,.35)' : 'transparent', opacity: live ? 1 : 0.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Avatar src={resolveImg(order.logo)} alt="" sx={{ width: 40, height: 40, background: z.surface2, fontSize: 13 }}>
          {order.ticker[0]}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 500, lineHeight: 1.2 }}>
            {describe(order.side, order.trigger)} · {size} {order.trigger} {fmtUsd(order.price)}
          </Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Avatar src={chainLogo(chain)} alt="" sx={{ width: 14, height: 14, background: 'transparent' }} /> {order.asset.symbol} on {chain?.name ?? order.asset.chainId} · {order.side === 'buy' ? `paid in ${order.quote.symbol}` : `into ${order.quote.symbol}`} · {order.expiresAt ? `until ${fmtDate(order.expiresAt)}` : 'until cancelled'}
          </Typography>
        </Box>
        <Box sx={{ ...Vg, ml: 0, ...(order.status === 'triggered' && { background: 'rgba(194,234,138,.16)', color: t.color.mark }), ...(order.status === 'filled' && { background: 'rgba(194,234,138,.1)', color: t.color.green }) }}>{STATUS[order.status]}</Box>
      </Box>
      {live && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 2, gap: 2 }}>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>
              Now {price ? fmtUsd(price) : '…'}
              {dist != null && <Box component="span" sx={{ color: order.status === 'triggered' ? t.color.mark : t.color.textLabel }}> · your level is {fmtPct(dist)} from here</Box>}
            </Typography>
            <Typography sx={{ fontSize: 13, color: t.color.textLabel }}>Level {fmtUsd(order.price)}</Typography>
          </Box>
          {price && <Rail price={price} trigger={order.price} side={order.side} />}
        </>
      )}
      {order.status === 'filled' && order.fill && (
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          Filled {fmtDate(order.fill.at)}: {Number(formatUnits(BigInt(order.fill.fromAmount), order.side === 'buy' ? order.quote.decimals : order.asset.decimals)).toFixed(order.side === 'buy' ? 2 : 4)} {order.fill.fromSymbol} → {order.fill.toAmount ? fmtUnits(Number(formatUnits(BigInt(order.fill.toAmount), order.side === 'buy' ? order.asset.decimals : order.quote.decimals))) : '?'} {order.fill.toSymbol}
          {link && (
            <Box component="a" href={link} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: t.color.textMuted, textDecoration: 'none', '&:hover': { color: t.color.text } }}>
              Tx <ExternalIcon size={11} />
            </Box>
          )}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
        {live && (
          <Button onClick={() => onFill(order)} disabled={busy} sx={{ ...(order.status === 'triggered' ? Bt : Lt), height: 40, px: '16px', fontSize: 14, gap: 1, backdropFilter: 'none' }}>
            {busy ? PHASE_LABEL[running!.phase] : order.status === 'triggered' ? 'Confirm fill' : 'Fill now at market'}
          </Button>
        )}
        {live ? (
          <Button onClick={() => updateOrder(order.id, { status: 'cancelled' })} disabled={busy} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none', background: 'transparent', color: t.color.textMuted }}>
            Cancel
          </Button>
        ) : (
          <Button onClick={() => removeOrder(order.id)} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none', background: 'transparent', color: t.color.textMuted }}>
            Remove
          </Button>
        )}
      </Box>
      {running?.id === order.id && running.error && <Typography sx={{ fontSize: 13, color: t.color.red, mt: 1.5 }}>{running.error}</Typography>}
      {running?.id === order.id && running.phase === 'done' && <Typography sx={{ fontSize: 13, color: t.color.mark, mt: 1.5 }}>Filled. The tokens are in your wallet.</Typography>}
      {live && <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>{holder ? `No ${BRAND.name} fee: this wallet holds VERDEX.` : `${BRAND.name} fee ${(VERDEX_FEE * 100).toFixed(2)}% on the fill. Hold VERDEX and it is zero.`}</Typography>}
    </Panel>
  )
}

export default function OrdersPage() {
  const { data } = useAssets()
  const { data: chainList } = useChains()
  const chains = chainList as ChainX[] | undefined
  const { account, openWalletMenu, switchChain, walletClient } = useWallet()
  const orders = useOrders()
  const { hash } = useLocation()
  const [draft, setDraftState] = useState<Draft>(loadDraft)
  const setDraft = (patch: Partial<Draft>) => setDraftState((d) => { const n = { ...d, ...patch }; saveDraft(n); return n })
  const [q, setQ] = useState('')
  const [holderFor, setHolderFor] = useState<{ address: string; holder: boolean } | null>(null)
  const holder = !!account && holderFor?.address === account.address.toLowerCase() && holderFor.holder
  const [running, setRunning] = useState<{ id: string; phase: Phase; error?: string } | null>(null)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [held, setHeld] = useState<{ key: string; units: number } | null>(null)

  const assets = useMemo(() => data?.assets ?? [], [data])
  const fallback = useMemo(() => new Map(assets.map((a) => [a.ticker, a.price])), [assets])
  const evmIds = useMemo(() => new Set((chains ?? []).filter((c) => c.chainType === 'EVM').map((c) => c.id)), [chains])
  const asset: Asset | undefined = assets.find((a) => a.ticker === draft.ticker) ?? assets[0]
  const versions = useMemo(() => (asset?.tokens ?? []).filter((v) => evmIds.has(v.chainId)), [asset, evmIds])
  const version: AssetToken | undefined = versions.find((v) => `${v.chainId}:${v.address}` === draft.version) ?? versions.find((v) => v.chainId === 4663) ?? versions[0]
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return assets.filter((a) => a.ticker.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)).slice(0, 6)
  }, [assets, q])
  const current = version?.price ?? asset?.price ?? 0
  const level = Number(draft.price) || 0
  const pay = QUOTE_TOKENS.find((p) => `${p.chainId}` === draft.quote) ?? QUOTE_TOKENS[2]
  const receive = version ? defaultQuote(version.chainId) : QUOTE_TOKENS[2]
  const expiry = EXPIRIES.find((e) => e.key === draft.expiry) ?? EXPIRIES[0]
  const mine = useMemo(() => orders.filter((o) => account && o.owner.toLowerCase() === account.address.toLowerCase()), [orders, account])
  const liveMine = mine.filter(isLive)
  const sensible = draft.side === 'buy' ? (draft.trigger === 'below' ? level < current : level > current) : draft.trigger === 'above' ? level > current : level < current
  const heldKey = account && version ? `${account.address.toLowerCase()}:${version.chainId}:${version.address.toLowerCase()}` : ''
  const heldUnitsNow = held?.key === heldKey ? held.units : undefined

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
    if (!account || !version || !chains) return
    const chain = chains.find((c) => c.id === version.chainId)
    if (!chain) return
    let alive = true
    const key = heldKey
    heldUnits(chain, { chainId: version.chainId, address: version.address, symbol: version.symbol, decimals: version.decimals }, account.address).then((u) => alive && setHeld({ key, units: u }))
    return () => {
      alive = false
    }
  }, [account, version, chains, heldKey])
  useEffect(() => {
    if (!account) return
    let alive = true
    const owner = account.address.toLowerCase()
    const tick = () => {
      if (alive) watch(orders.filter((o) => o.owner.toLowerCase() === owner), fallback).catch(() => undefined)
    }
    const first = window.setTimeout(tick, 300)
    const id = window.setInterval(tick, 30_000)
    return () => {
      alive = false
      window.clearTimeout(first)
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, fallback, liveMine.map((o) => o.id).join(',')])
  useEffect(() => {
    if (hash === '#orders') setTimeout(() => document.getElementById('orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }, [hash, mine.length])

  const pickAsset = (a: Asset) => {
    setDraft({ ticker: a.ticker, version: undefined, price: '' })
    setQ('')
  }
  const setSide = (side: Side) => setDraft({ side, trigger: side === 'buy' ? 'below' : 'above', price: '' })
  const setOffset = (pct: number) => setDraft({ price: (current * (1 + pct / 100)).toFixed(current >= 100 ? 0 : 2) })
  const priceShown = draft.price || (current ? (current * (draft.side === 'buy' ? (draft.trigger === 'below' ? 0.95 : 1.05) : draft.trigger === 'above' ? 1.05 : 0.95)).toFixed(current >= 100 ? 0 : 2) : '')
  const levelShown = Number(priceShown) || 0
  const units = draft.side === 'buy' ? (levelShown ? draft.amount / levelShown : 0) : Number(draft.units) || 0

  const fill = async (o: Order) => {
    if (!account || !walletClient || !chainList) return openWalletMenu()
    setRunning({ id: o.id, phase: 'pricing' })
    try {
      await fillOrder(o, { walletClient, account, chains: chainList, switchChain, holder, onPhase: (phase) => setRunning({ id: o.id, phase }) })
    } catch (e) {
      setRunning({ id: o.id, phase: 'failed', error: describeError(e) })
    }
  }
  const place = () => {
    if (!account) return openWalletMenu()
    if (!asset || !version) return setPlaceError('Pick an asset with a version on an EVM chain.')
    const lvl = Number(priceShown)
    if (!(lvl > 0)) return setPlaceError('Set a price level.')
    if (draft.side === 'sell' && !(Number(draft.units) > 0)) return setPlaceError('Set how many units to sell.')
    setPlaceError(null)
    askNotifications()
    const assetTok: PlanToken = { chainId: version.chainId, address: version.address, symbol: version.symbol, decimals: version.decimals, issuer: version.issuer }
    const quoteTok: PlanToken = draft.side === 'buy' ? { chainId: pay.chainId, address: pay.address, symbol: pay.symbol, decimals: pay.decimals } : { chainId: receive.chainId, address: receive.address, symbol: receive.symbol, decimals: receive.decimals }
    addOrder({ owner: account.address as Address, ticker: asset.ticker, name: asset.name, logo: asset.logo, asset: assetTok, quote: quoteTok, side: draft.side, trigger: draft.trigger, price: lvl, amountUsd: draft.side === 'buy' ? draft.amount : undefined, units: draft.side === 'sell' ? Number(draft.units) : undefined, expiresAt: expiry.ms ? nowMs() + expiry.ms : 0, lastPrice: current || undefined })
    setTimeout(() => document.getElementById('orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  return (
    <Page>
      <PageHero
        label="Orders"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>New</Box>}
        title={
          <>
            Name your price.
            <br />
            Keep your keys.
          </>
        }
        lead="Limit and stop orders on any tokenized stock, ETF or commodity. Set the level; Verdex watches the price and, when it crosses, prepares the swap through the best route and asks your wallet to confirm it. Nothing moves before that tap."
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
            {(['buy', 'sell'] as Side[]).map((s) => (
              <Choice key={s} on={draft.side === s} onClick={() => setSide(s)}>
                {s === 'buy' ? 'Buy' : 'Sell'}
              </Choice>
            ))}
          </Box>
          <Label>{draft.side === 'buy' ? 'Buy' : 'Sell'}</Label>
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
                      {asset.name} · {fmtUsd(current)} now
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box sx={{ display: 'flex', color: t.color.textLabel }}>
                  <SearchIcon size={16} />
                </Box>
              )}
              <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={asset && !q ? 'Change' : 'Search a stock, ETF or commodity'} inputProps={{ 'aria-label': 'Search an asset' }} sx={{ flex: asset && !q ? 'none' : 1, width: asset && !q ? 110 : 'auto', fontSize: 14, color: t.color.text, '& input': { textAlign: asset && !q ? 'right' : 'left' }, '& input::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
            </Box>
            {results.length > 0 && (
              <Box sx={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', zIndex: 5, background: t.color.menu, border: `1px solid ${t.color.border}`, borderRadius: t.radius.card, boxShadow: '0 12px 40px rgba(0,0,0,.55)', p: 0.75 }}>
                {results.map((a) => (
                  <Box key={a.ticker} component="button" type="button" onClick={() => pickAsset(a)} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', boxSizing: 'border-box', px: 1.5, py: 1, borderRadius: t.radius.panel, '&:hover': { background: t.color.hover } }}>
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
                  <Choice key={`${v.chainId}:${v.address}`} on={version === v} onClick={() => setDraft({ version: `${v.chainId}:${v.address}`, price: '' })}>
                    <Avatar src={ISSUER_LOGOS[v.issuer]} alt="" sx={{ width: 16, height: 16, background: 'transparent' }} />
                    {v.symbol} · {v.chain}
                  </Choice>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ mt: 3 }}>
            <Label>When the price is</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              {(['below', 'above'] as Trigger[]).map((tr) => (
                <Choice key={tr} on={draft.trigger === tr} onClick={() => setDraft({ trigger: tr, price: '' })}>
                  {tr === 'below' ? 'Below' : 'Above'}
                </Choice>
              ))}
              <Box sx={{ display: 'flex', alignItems: 'center', height: 34, px: 1.5, borderRadius: t.radius.input, background: t.color.tile, gap: 0.5 }}>
                <Typography sx={{ fontSize: 14, color: t.color.textLabel }}>$</Typography>
                <InputBase type="number" inputMode="decimal" value={priceShown} onChange={(e) => setDraft({ price: e.target.value })} inputProps={{ 'aria-label': 'Price level' }} sx={{ width: 84, fontSize: 14, fontWeight: 500, color: t.color.text }} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {OFFSETS.map((o) => (
                <Choice key={o} on={false} onClick={() => setOffset(o)}>
                  {o > 0 ? '+' : ''}{o}%
                </Choice>
              ))}
            </Box>
            <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1 }}>{explain(draft.side, draft.trigger)}</Typography>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Label>{draft.side === 'buy' ? 'Amount' : 'Units to sell'}</Label>
            {draft.side === 'buy' ? (
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
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', height: 34, px: 1.5, borderRadius: t.radius.input, background: t.color.tile, gap: 0.5 }}>
                  <InputBase type="number" inputMode="decimal" value={draft.units} onChange={(e) => setDraft({ units: e.target.value })} placeholder="0.00" inputProps={{ 'aria-label': 'Units to sell' }} sx={{ width: 84, fontSize: 14, fontWeight: 500, color: t.color.text, '& input::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
                  <Typography sx={{ fontSize: 13, color: t.color.textLabel }}>{asset?.ticker}</Typography>
                </Box>
                {[25, 50, 100].map((pc) => (
                  <Choice key={pc} on={false} disabled={!heldUnitsNow} onClick={() => setDraft({ units: ((heldUnitsNow ?? 0) * (pc / 100)).toFixed(4) })}>
                    {pc === 100 ? 'All' : `${pc}%`}
                  </Choice>
                ))}
                <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>{account ? (heldUnitsNow != null ? `You hold ${fmtUnits(heldUnitsNow)} ${version?.symbol ?? ''}` : 'Reading balance…') : 'Connect to read your balance'}</Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ mt: 3 }}>
            <Label>{draft.side === 'buy' ? 'Pay with' : 'Receive'}</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {draft.side === 'buy' ? (
                QUOTE_TOKENS.map((p) => (
                  <Choice key={p.chainId} on={pay.chainId === p.chainId} onClick={() => setDraft({ quote: `${p.chainId}` })}>
                    <Avatar src={CHAIN_NAME_LOGOS[p.chain]} alt="" sx={{ width: 16, height: 16, background: 'transparent' }} />
                    {p.symbol} on {p.chain}
                  </Choice>
                ))
              ) : (
                <Choice on onClick={() => undefined}>
                  <Avatar src={CHAIN_NAME_LOGOS[receive.chain]} alt="" sx={{ width: 16, height: 16, background: 'transparent' }} />
                  {receive.symbol} on {receive.chain}
                </Choice>
              )}
            </Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Label>Good for</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {EXPIRIES.map((e) => (
                <Choice key={e.key} on={draft.expiry === e.key} onClick={() => setDraft({ expiry: e.key })}>
                  {e.label}
                </Choice>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 4, alignItems: 'center' }}>
            <Button onClick={place} disabled={!!account && !version} sx={{ ...Bt, gap: 1 }}>
              <LockIcon size={15} /> {!account ? 'Connect wallet' : 'Place order'}
            </Button>
            {account && level > 0 && !sensible && <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>This level is already crossed: the order will trigger on the first check.</Typography>}
          </Box>
          {placeError && <Typography sx={{ fontSize: 13, color: t.color.red, mt: 1.5 }}>{placeError}</Typography>}
          <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>The order is saved on this device for your wallet and watched while {BRAND.name} is open, including the home-screen app. A level crossed while the app was closed triggers on the next open, at that moment's price.</Typography>
        </Panel>

        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Label>Order</Label>
          <Typography sx={{ ...t.type.h4, color: t.color.text }}>
            {describe(draft.side, draft.trigger)}: {draft.side === 'buy' ? fmtUsd(draft.amount, 0) : `${fmtUnits(units)} ${asset?.ticker ?? ''}`} {draft.trigger} {fmtUsd(levelShown)}.
          </Typography>
          <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 0.75 }}>
            {asset?.ticker} trades at {fmtUsd(current)} now{levelShown ? `, ${fmtPct(((levelShown - current) / current) * 100)} from your level` : ''}. {draft.side === 'buy' ? `About ${fmtUnits(units)} ${asset?.ticker} at that price, paid in ${pay.symbol} on ${pay.chain}.` : `Into ${receive.symbol} on ${receive.chain}.`}
          </Typography>
          {current > 0 && levelShown > 0 && <Rail price={current} trigger={levelShown} side={draft.side} />}
          <Box sx={{ mt: 2.5, display: 'grid', gap: 0.5 }}>
            {[
              ['Verdex watches the price', `Every 30 seconds while the app is open, through the same feed that prices the swap.`],
              ['It crosses your level', `The order turns Triggered and you get a reminder, here and as a notification.`],
              ['One tap fills it', `The swap is priced through the best route at that moment and confirmed in your wallet.`],
            ].map(([k, v], i) => (
              <Box key={k} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 1.5, py: 1.25, borderRadius: t.radius.panel, background: i === 0 ? t.color.tile : 'transparent' }}>
                <Box sx={{ mt: '6px', width: 8, height: 8, borderRadius: '50%', background: i === 0 ? t.color.mark : t.color.borderStrong, flexShrink: 0 }} />
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{k}</Typography>
                  <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{v}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${t.color.border}`, display: 'grid', gap: 1 }}>
            {[
              ['Good for', expiry.label],
              ['Fills at', 'Market price at the moment you confirm, best route'],
            ].map(([k, v]) => (
              <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 14 }}>
                <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{k}</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 500, textAlign: 'right' }}>{v}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
              <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{BRAND.name} fee on the fill</Typography>
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
            <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>Plus the route's own gas and DEX fees, shown in your wallet before you confirm.</Typography>
          </Box>
        </Panel>
      </Box>

      <Box id="orders" sx={{ mt: { xs: 8, md: 12 }, scrollMarginTop: 100 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Your orders</Typography>
          {account && mine.length > 0 && <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{mine.filter((o) => o.status === 'triggered').length ? `${mine.filter((o) => o.status === 'triggered').length} triggered` : `${liveMine.length} open`}</Typography>}
        </Box>
        {!account ? (
          <Panel sx={{ p: 3, mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>Connect a wallet to see and fill its orders.</Typography>
            <Button onClick={openWalletMenu} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14 }}>
              Connect
            </Button>
          </Panel>
        ) : mine.length === 0 ? (
          <Panel sx={{ p: 3, mt: 3 }}>
            <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>No orders yet for this wallet. Set one up above and press Place order.</Typography>
          </Panel>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' }, gap: 2.5, mt: 3 }}>
            {[...mine].sort((a, b) => (a.status === 'triggered' ? -1 : b.status === 'triggered' ? 1 : 0)).map((o) => (
              <OrderCard key={o.id} order={o} chains={chains} holder={holder} onFill={fill} running={running} />
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<TargetIcon size={20} />} title="Set the level" text="Buy below, buy above, sell above, sell below. Any tokenized stock, ETF or commodity Verdex lists on an EVM chain, with a dollar amount or a number of units." />
          <Step n={2} icon={<LockIcon size={20} />} title="Verdex watches, you hold" text="The price is checked every 30 seconds while the app is open. Your tokens and your stable stay in your wallet the whole time; no deposit, no allowance until the fill." />
          <Step n={3} icon={<RouteIcon size={20} />} title="One tap to fill" text="When the level is crossed the order is triggered and you are reminded. Confirm and the swap runs through the best route at that moment, settling in your wallet." />
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
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Holders pay no {BRAND.name} fee on fills.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>Any amount of VERDEX on Robinhood Chain in the wallet that placed the order removes the {(VERDEX_FEE * 100).toFixed(2)}% {BRAND.name} fee from every fill, checked onchain each time. Only the route's own gas and DEX fees apply.</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {[
            ['Zero fee', `${(VERDEX_FEE * 100).toFixed(2)}% becomes 0% on every fill for holders.`],
            ['Four order types', 'Limit buy, stop buy, limit sell and stop sell, on every listed asset, with an expiry or good until cancelled.'],
            ['Cancel any time', 'An open order is a note on this device. Cancel it and nothing has happened.'],
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
          ['Is the fill guaranteed at my level?', 'No. The level is the trigger. The fill is a market swap at the moment you confirm, through the best route, so it lands at or near the level depending on how fast you tap and how the market moves. A limit that requires the exact price would need an onchain order book, which is next.'],
          ['Does it watch while the app is closed?', `Not yet. The price is checked while ${BRAND.name} is open, including the home-screen app. A level crossed while it was closed triggers on the next open at that moment's price. Session permissions (ERC-7715) will let orders fill without you present.`],
          ['Is it custodial?', `No. An open order is a note on this device. The fill is a swap your wallet confirms, and the tokens land in that wallet. ${BRAND.name} never holds funds, keys or allowances.`],
          ['Where does the price come from?', 'The same aggregator feed that prices every swap on Verdex, with the bundled market snapshot as fallback. It reflects the onchain price of the token, not the exchange print of the underlying stock.'],
          ['Can I sell tokens I hold from anywhere?', 'Yes. A sell order reads your balance of the token in the connected wallet, however it got there. Sells settle into the stable of the same chain.'],
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
