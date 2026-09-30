import { useEffect, useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { type Address } from 'viem'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { CHAIN_NAME_LOGOS, ROBINHOOD, fmtCompact, fmtUsd, useAssets, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, POSITION_MANAGER, addLiquidity, collectFees, fmtFee, fmtPrice, fmtQty, fromRaw, fullRange, pairAmount, rangeTicks, readBalances, removeLiquidity, tickBand, toRaw, usePools, usePositions, type Phase, type Pool, type Position } from '../lib/pools'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { BoltIcon, CheckIcon, DropIcon, ExternalIcon, PercentIcon, SearchIcon, ShieldIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Cell, Page, PageHero, Panel, Row, Stats, TableHead } from './common'

const PRESETS: { label: string; pct: number | null }[] = [
  { label: '±2%', pct: 0.02 },
  { label: '±5%', pct: 0.05 },
  { label: '±10%', pct: 0.1 },
  { label: '±25%', pct: 0.25 },
  { label: 'Full range', pct: null },
]
const SHARES = [25, 50, 75, 100]

function Label({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1.25 }}>{children}</Typography>
}
function Choice({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Box component="button" type="button" onClick={onClick} disabled={disabled} aria-pressed={on} sx={{ all: 'unset', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px', height: 34, px: '12px', borderRadius: t.radius.input, fontSize: 13, fontWeight: 500, background: on ? t.color.text : t.color.chip, color: on ? t.color.page : t.color.text, '&:hover': { background: on ? t.color.text : t.color.hover } }}>
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
function PoolMark({ pool, size = 44 }: { pool: Pool; size?: number }) {
  return (
    <Box sx={{ position: 'relative', width: size, height: size, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Avatar src={resolveImg(pool.logo)} sx={{ width: size * 0.64, height: size * 0.64, background: z.surface2, fontSize: 10 }}>{pool.ticker[0]}</Avatar>
      <Avatar src={CHAIN_NAME_LOGOS['Robinhood Chain']} sx={{ width: 14, height: 14, position: 'absolute', right: 6, bottom: 6, border: `1.5px solid ${t.color.page}` }} />
    </Box>
  )
}
const Fee = ({ fee }: { fee: number }) => <Box component="span" sx={{ ...Vg, ml: 0, fontSize: 11 }}>{fmtFee(fee)}</Box>
const quoteName = (p: Pool) => (p.quote.symbol === 'WETH' ? 'ETH' : p.quote.symbol)
const stockAmt = (p: Position) => (p.pool.stockIsToken0 ? p.amount0 : p.amount1)
const quoteAmt = (p: Position) => (p.pool.stockIsToken0 ? p.amount1 : p.amount0)

// Composer: a range and two amounts for one pool, then the transaction.
function AddPanel({ pool, chain, onDone, onClose }: { pool: Pool; chain: ChainX | undefined; onDone: () => void; onClose: () => void }) {
  const { account, walletClient, switchChain, openWalletMenu } = useWallet()
  const [preset, setPreset] = useState(1)
  const [lo, setLo] = useState('')
  const [hi, setHi] = useState('')
  const [stock, setStock] = useState('')
  const [quote, setQuote] = useState('')
  const [last, setLast] = useState<'stock' | 'quote'>('stock')
  const [bal, setBal] = useState<[bigint, bigint] | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [tx, setTx] = useState<string | null>(null)

  const stockTok = pool.stockIsToken0 ? pool.token0 : pool.token1
  const quoteTok = pool.stockIsToken0 ? pool.token1 : pool.token0
  const [lower, upper] = useMemo(() => {
    const p = PRESETS[preset]
    if (preset === PRESETS.length) {
      const a = Number(lo), b = Number(hi)
      return a > 0 && b > a ? rangeTicks(pool, a, b) : fullRange(pool.spacing)
    }
    return p.pct == null ? fullRange(pool.spacing) : rangeTicks(pool, pool.price * (1 - p.pct), pool.price * (1 + p.pct))
  }, [pool, preset, lo, hi])
  const band = useMemo(() => tickBand(pool, lower, upper), [pool, lower, upper])
  const below = pool.tick < lower, above = pool.tick >= upper

  // The side the user typed last drives the other one.
  useEffect(() => {
    const src = last === 'stock' ? stock : quote
    const n = Number(src)
    if (!(n > 0)) return
    const side = (last === 'stock') === pool.stockIsToken0 ? 0 : 1
    const tok = last === 'stock' ? stockTok : quoteTok
    const a = pairAmount(pool, lower, upper, side, Number(toRaw(n, tok.decimals)))
    const otherRaw = side === 0 ? a.amount1 : a.amount0
    const otherTok = last === 'stock' ? quoteTok : stockTok
    const v = fromRaw(otherRaw, otherTok.decimals)
    const s = v === 0 ? '0' : v >= 1 ? v.toFixed(4).replace(/\.?0+$/, '') : v.toPrecision(6).replace(/\.?0+$/, '')
    if (last === 'stock') setQuote(s)
    else setStock(s)
  }, [stock, quote, last, lower, upper, pool, stockTok, quoteTok])

  useEffect(() => {
    let alive = true
    setBal(null)
    if (!account) return
    readBalances(account.address, pool).then((b) => alive && setBal(b)).catch(() => {})
    return () => {
      alive = false
    }
  }, [account, pool, tx])

  const raw0 = toRaw(Number(pool.stockIsToken0 ? stock : quote) || 0, pool.token0.decimals)
  const raw1 = toRaw(Number(pool.stockIsToken0 ? quote : stock) || 0, pool.token1.decimals)
  const need0 = !above, need1 = !below
  const short0 = bal != null && need0 && raw0 > bal[0], short1 = bal != null && need1 && raw1 > bal[1]
  const ready = (need0 ? raw0 > 0n : true) && (need1 ? raw1 > 0n : true) && (raw0 > 0n || raw1 > 0n) && !short0 && !short1
  const busy = phase === 'switching' || phase === 'approving' || phase === 'confirming' || phase === 'pending'
  const stockBal = bal ? fromRaw(pool.stockIsToken0 ? bal[0] : bal[1], stockTok.decimals) : null
  const quoteBal = bal ? fromRaw(pool.stockIsToken0 ? bal[1] : bal[0], quoteTok.decimals) : null
  const valueUsd = (Number(stock) || 0) * pool.priceUsd + (Number(quote) || 0) * pool.quoteUsd

  const submit = async () => {
    if (!account || !walletClient) return openWalletMenu()
    setError(null)
    setTx(null)
    try {
      const hash = await addLiquidity({ walletClient, account, chain, switchChain, onPhase: setPhase }, pool, lower, upper, need0 ? raw0 : 0n, need1 ? raw1 : 0n)
      setTx(hash)
      setStock('')
      setQuote('')
      onDone()
    } catch (e) {
      setPhase('failed')
      setError(describeError(e))
    }
  }

  const amountBox = (label: string, value: string, onChange: (v: string) => void, balance: number | null, symbol: string, disabled: boolean, short: boolean) => (
    <Box sx={{ p: 2, borderRadius: t.radius.panel, background: t.color.raised, opacity: disabled ? 0.5 : 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.color.textMuted }}>
        <span>{label}</span>
        {balance != null && (
          <Box component="button" type="button" disabled={disabled} onClick={() => onChange(balance >= 1 ? balance.toFixed(4).replace(/\.?0+$/, '') : balance.toPrecision(6).replace(/\.?0+$/, ''))} sx={{ all: 'unset', cursor: 'pointer', color: short ? t.color.red : t.color.textMuted, '&:hover': { color: t.color.text } }}>
            Balance {fmtQty(balance)} · Max
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
        <InputBase value={disabled ? '0' : value} disabled={disabled} inputMode="decimal" placeholder="0" onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && onChange(e.target.value)} inputProps={{ 'aria-label': label }} sx={{ flex: 1, minWidth: 0, fontSize: 26, fontWeight: 500, color: t.color.text, '& input': { p: 0, minWidth: 0, width: '100%' }, '& input::placeholder': { color: t.color.text, opacity: 0.4 } }} />
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: t.color.textMuted }}>{symbol}</Typography>
      </Box>
    </Box>
  )

  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, position: { md: 'sticky' }, top: { md: 92 }, minWidth: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <PoolMark pool={pool} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
            Add to {pool.ticker}/{quoteName(pool)} <Fee fee={pool.fee} />
          </Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>
            1 {pool.ticker} = {fmtPrice(pool.price)} {quoteName(pool)} · {fmtUsd(pool.priceUsd)}
          </Typography>
        </Box>
        <Box component="button" type="button" aria-label="Close" onClick={onClose} sx={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: t.color.textLabel, '&:hover': { color: t.color.text } }}>
          Close
        </Box>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Label>Price range</Label>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {PRESETS.map((p, i) => (
            <Choice key={p.label} on={preset === i} onClick={() => setPreset(i)}>
              {p.label}
            </Choice>
          ))}
          <Choice on={preset === PRESETS.length} onClick={() => { setPreset(PRESETS.length); if (!lo) { setLo(fmtPrice(pool.price * 0.9).replace(/,/g, '')); setHi(fmtPrice(pool.price * 1.1).replace(/,/g, '')) } }}>
            Custom
          </Choice>
        </Box>
        {preset === PRESETS.length && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1.5 }}>
            {[['Min price', lo, setLo], ['Max price', hi, setHi]].map(([l, v, set]) => (
              <Box key={l as string} sx={{ p: 1.5, borderRadius: t.radius.panel, background: t.color.raised }}>
                <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{l as string}</Typography>
                <InputBase value={v as string} inputMode="decimal" onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && (set as (v: string) => void)(e.target.value)} inputProps={{ 'aria-label': l as string }} sx={{ fontSize: 18, fontWeight: 500, color: t.color.text, width: '100%', minWidth: 0, '& input': { p: 0, minWidth: 0, width: '100%' } }} />
              </Box>
            ))}
          </Box>
        )}
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 1.5 }}>
          {preset === 4 || (preset === PRESETS.length && !(Number(lo) > 0 && Number(hi) > Number(lo))) ? `Earns at every price. Your tokens are never all in one side, and the fee share is the smallest.` : `From ${fmtPrice(band[0])} to ${fmtPrice(band[1])} ${quoteName(pool)} per ${pool.ticker}. Fees accrue while the price is inside; outside it, the position holds one token and waits.`}
        </Typography>
        {below && <Typography sx={{ fontSize: 13, color: t.color.mark, mt: 1 }}>The price is below this range, so only {pool.stockIsToken0 ? pool.ticker : quoteName(pool)} is deposited.</Typography>}
        {above && <Typography sx={{ fontSize: 13, color: t.color.mark, mt: 1 }}>The price is above this range, so only {pool.stockIsToken0 ? quoteName(pool) : pool.ticker} is deposited.</Typography>}
      </Box>

      <Box sx={{ mt: 3, display: 'grid', gap: 1.25 }}>
        <Label>Amounts</Label>
        {amountBox(pool.ticker, stock, (v) => { setLast('stock'); setStock(v) }, stockBal, pool.ticker, pool.stockIsToken0 ? above : below, pool.stockIsToken0 ? short0 : short1)}
        {amountBox(quoteName(pool), quote, (v) => { setLast('quote'); setQuote(v) }, quoteBal, quoteName(pool), pool.stockIsToken0 ? below : above, pool.stockIsToken0 ? short1 : short0)}
      </Box>

      <Box sx={{ mt: 2.5, p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 0.75, fontSize: 13 }}>
        {[
          ['Deposit', valueUsd ? fmtUsd(valueUsd) : '-'],
          ['Pool fee', `${fmtFee(pool.fee)} of every swap, to liquidity in range`],
          ['Fee APR now', pool.feeApr ? `${Math.round(pool.feeApr)}% at today's volume` : '-'],
          ['Slippage', '0.5%'],
        ].map(([k, v]) => (
          <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{k}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{v}</Typography>
          </Box>
        ))}
      </Box>

      {error && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5, lineHeight: 1.4 }}>{error}</Typography>}
      {tx && (
        <Typography sx={{ fontSize: 12, color: t.color.green, mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          Position added.
          <Box component="a" href={explorerTx(chain, ROBINHOOD, tx)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text, display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}>
            View <ExternalIcon size={12} />
          </Box>
        </Typography>
      )}
      <Button fullWidth onClick={submit} disabled={!!account && (!ready || busy)} sx={{ ...Bt, height: 48, mt: 2 }}>
        {!account ? 'Connect wallet' : busy ? PHASE_LABEL[phase] : short0 || short1 ? 'Insufficient balance' : 'Add liquidity'}
      </Button>
      <Typography sx={{ fontSize: 11, color: t.color.textLabel, textAlign: 'center', mt: 1.5, lineHeight: 1.4 }}>One approval per token, then one transaction to the Uniswap v3 position manager on Robinhood Chain. The position is an NFT in your wallet.</Typography>
    </Panel>
  )
}

function PositionCard({ p, chain, onChanged }: { p: Position; chain: ChainX | undefined; onChanged: () => void }) {
  const { account, walletClient, switchChain } = useWallet()
  const [share, setShare] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [what, setWhat] = useState<'collect' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tx, setTx] = useState<string | null>(null)
  const busy = phase === 'switching' || phase === 'approving' || phase === 'confirming' || phase === 'pending'
  const run = async (kind: 'collect' | 'remove') => {
    if (!account || !walletClient) return
    setError(null)
    setTx(null)
    setWhat(kind)
    try {
      const ctx = { walletClient, account, chain, switchChain, onPhase: setPhase }
      const hash = kind === 'collect' ? await collectFees(ctx, p) : await removeLiquidity(ctx, p, share ?? 100)
      setTx(hash)
      setShare(null)
      onChanged()
    } catch (e) {
      setPhase('failed')
      setError(describeError(e))
    }
  }
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <PoolMark pool={p.pool} size={40} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
            {p.pool.ticker}/{quoteName(p.pool)} <Fee fee={p.pool.fee} />
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: p.inRange ? t.color.green : t.color.textMuted, fontWeight: 400 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: p.inRange ? t.color.green : t.color.textLabel }} /> {p.inRange ? 'In range' : 'Out of range'}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>
            {fmtPrice(p.band[0])} to {fmtPrice(p.band[1])} {quoteName(p.pool)} per {p.pool.ticker} · now {fmtPrice(p.pool.price)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 18, fontWeight: 500 }}>{fmtUsd(p.valueUsd)}</Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>
            {fmtQty(stockAmt(p))} {p.pool.ticker} + {fmtQty(quoteAmt(p))} {quoteName(p.pool)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2, pt: 2, borderTop: `1px solid ${t.color.border}`, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, flex: 1, minWidth: 180 }}>
          Fees earned, uncollected: <Box component="span" sx={{ color: t.color.mark, fontWeight: 500 }}>{fmtUsd(p.feesUsd, p.feesUsd < 1 ? 4 : 2)}</Box> · {fmtQty(p.pool.stockIsToken0 ? p.fees0 : p.fees1)} {p.pool.ticker} + {fmtQty(p.pool.stockIsToken0 ? p.fees1 : p.fees0)} {quoteName(p.pool)}
        </Typography>
        <Button onClick={() => run('collect')} disabled={busy || p.feesUsd <= 0} sx={{ ...Lt, backdropFilter: 'none', height: 36, px: 2 }}>
          {busy && what === 'collect' ? PHASE_LABEL[phase] : 'Collect fees'}
        </Button>
        <Button onClick={() => setShare(share == null ? 100 : null)} disabled={busy} sx={{ ...Lt, backdropFilter: 'none', height: 36, px: 2 }}>
          {share == null ? 'Remove' : 'Cancel'}
        </Button>
      </Box>
      {share != null && (
        <Box sx={{ mt: 2, p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {SHARES.map((s) => (
              <Choice key={s} on={share === s} onClick={() => setShare(s)}>
                {s}%
              </Choice>
            ))}
          </Box>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, flex: 1, minWidth: 160 }}>
            Withdraws {fmtQty((stockAmt(p) * share) / 100)} {p.pool.ticker} + {fmtQty((quoteAmt(p) * share) / 100)} {quoteName(p.pool)} plus all fees{share === 100 ? ', and closes the position' : ''}.
          </Typography>
          <Button onClick={() => run('remove')} disabled={busy} sx={{ ...Bt, height: 36, px: 2.5 }}>
            {busy && what === 'remove' ? PHASE_LABEL[phase] : `Remove ${share}%`}
          </Button>
        </Box>
      )}
      {error && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5 }}>{error}</Typography>}
      {tx && (
        <Typography sx={{ fontSize: 12, color: t.color.green, mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          {what === 'collect' ? 'Fees collected.' : 'Liquidity removed.'}
          <Box component="a" href={explorerTx(chain, ROBINHOOD, tx)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text, display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}>
            View <ExternalIcon size={12} />
          </Box>
        </Typography>
      )}
    </Panel>
  )
}

export default function VerdexPoolsPage() {
  const { account, openWalletMenu } = useWallet()
  const { data: assets } = useAssets()
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ROBINHOOD) as ChainX | undefined
  const pools = usePools(assets?.assets)
  const positions = usePositions(account?.address, pools.data)
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Address | null>(null)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (pools.data ?? []).filter((p) => !s || p.ticker.toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || p.quote.symbol.toLowerCase().includes(s))
  }, [pools.data, q])
  const selected = pools.data?.find((p) => p.address === sel) ?? null
  const totals = useMemo(() => {
    const d = pools.data ?? []
    const liq = d.reduce((s, p) => s + p.liquidityUsd, 0), vol = d.reduce((s, p) => s + p.volume24hUsd, 0), fees = d.reduce((s, p) => s + p.volume24hUsd * (p.fee / 1_000_000), 0)
    return { n: d.length, liq, vol, fees }
  }, [pools.data])
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['verdex-positions'] })
    qc.invalidateQueries({ queryKey: ['verdex-pools'] })
  }
  const pick = (p: Pool) => {
    setSel(p.address)
    if (window.innerWidth < 900) document.getElementById('add-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Page>
      <PageHero
        label="Verdex Pools"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Live</Box>}
        title={
          <>
            Liquidity for tokenized stocks.
            <br />
            From your own wallet.
          </>
        }
        lead={`Every Uniswap v3 pool of a tokenized stock on Robinhood Chain, read from the chain as you look. Pick a pool and a price range, deposit both sides, and earn the pool's fee on every swap that crosses your range. Your positions, their fees and the exit are on this page too.`}
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => (pools.data?.[0] ? pick(pools.data[0]) : undefined)} sx={{ ...Bt, gap: 1 }}>
              <DropIcon size={15} /> Add liquidity
            </Button>
            {!account && (
              <Button onClick={openWalletMenu} sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
                <WalletIcon size={14} /> See my positions
              </Button>
            )}
          </Box>
        }
      />

      <Stats items={[{ label: 'Pools', value: pools.data ? totals.n : '…' }, { label: 'Liquidity', value: pools.data ? fmtCompact(totals.liq) : '…' }, { label: '24h volume', value: pools.data ? fmtCompact(totals.vol) : '…' }, { label: '24h fees to LPs', value: pools.data ? fmtCompact(totals.fees) : '…' }]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>Pools from the Uniswap v3 factory on Robinhood Chain for every stock {BRAND.name} lists, against USDG and ETH. Volume and liquidity in dollars from DexScreener, price and tick from each pool, refreshed every minute.</Typography>

      {account && (
        <Box sx={{ mt: { xs: 5, md: 7 } }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2 }}>
            <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Your positions</Typography>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{positions.data ? `${positions.data.length} in these pools · ${fmtUsd(positions.data.reduce((s, p) => s + p.valueUsd, 0))} · fees ${fmtUsd(positions.data.reduce((s, p) => s + p.feesUsd, 0))}` : positions.isLoading ? 'Reading the position manager…' : ''}</Typography>
          </Box>
          {positions.data && positions.data.length === 0 && (
            <Panel sx={{ p: 3 }}>
              <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>No positions in these pools yet. Pick a pool below to add one.</Typography>
            </Panel>
          )}
          <Box sx={{ display: 'grid', gap: 2 }}>{positions.data?.map((p) => <PositionCard key={String(p.tokenId)} p={p} chain={chain} onChanged={refresh} />)}</Box>
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: selected ? 'minmax(0,1fr) 400px' : 'minmax(0,1fr)' }, gap: 2.5, mt: { xs: 5, md: 7 }, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, flex: 1 }}>Pools</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 38, px: 1.5, borderRadius: t.radius.input, background: t.color.chip, width: 260 }}>
              <SearchIcon size={14} />
              <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search NVDA, SPY, ETH…" inputProps={{ 'aria-label': 'Search pools' }} sx={{ flex: 1, fontSize: 14, color: t.color.text, '& input::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
            </Box>
          </Box>
          <Panel sx={{ overflow: 'hidden' }}>
            <TableHead cols={selected ? [{ label: 'Pool', grow: true }, { label: 'Liquidity', align: 'right', hide: 'xs' }, { label: 'Fee APR', align: 'right' }, { label: '', align: 'right', hide: 'xs' }] : [{ label: 'Pool', grow: true }, { label: 'Price', align: 'right', hide: 'sm' }, { label: 'Liquidity', align: 'right', hide: 'xs' }, { label: '24h volume', align: 'right', hide: 'sm' }, { label: 'Fee APR', align: 'right' }, { label: '', align: 'right', hide: 'xs' }]} />
            {pools.isLoading && <Typography sx={{ p: 3, fontSize: 14, color: t.color.textMuted }}>Reading the factory…</Typography>}
            {pools.isError && <Typography sx={{ p: 3, fontSize: 14, color: t.color.red }}>The chain did not answer. Try again in a moment.</Typography>}
            {list.map((p) => (
              <Row key={p.address} onClick={() => pick(p)}>
                <Cell grow>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <PoolMark pool={p} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {p.ticker}/{quoteName(p)} <Fee fee={p.fee} />
                      </Typography>
                      <Typography noWrap sx={{ fontSize: 12, color: t.color.textMuted }}>
                        {p.name} · Uniswap v3 · {p.txns24h.toLocaleString('en-US')} swaps today
                      </Typography>
                    </Box>
                  </Box>
                </Cell>
                {!selected && <Cell align="right" hide="sm" sx={{ fontWeight: 500 }}>{fmtUsd(p.priceUsd)}</Cell>}
                <Cell align="right" hide="xs" sx={{ fontWeight: 500 }}>{p.liquidityUsd ? fmtUsd(p.liquidityUsd, 0) : '-'}</Cell>
                {!selected && <Cell align="right" hide="sm" sx={{ fontWeight: 500 }}>{p.volume24hUsd ? fmtUsd(p.volume24hUsd, 0) : '-'}</Cell>}
                <Cell align="right" sx={{ color: p.feeApr ? t.color.green : t.color.textMuted, fontWeight: 500 }}>{p.feeApr ? `${Math.round(p.feeApr)}%` : '-'}</Cell>
                <Cell align="right" hide="xs">
                  <Box component="span" sx={{ ...Vg, ml: 0, background: sel === p.address ? t.color.text : undefined, color: sel === p.address ? t.color.page : undefined }}>Add</Box>
                </Cell>
              </Row>
            ))}
            {pools.data && list.length === 0 && <Typography sx={{ p: 3, fontSize: 14, color: t.color.textMuted }}>No pool matches.</Typography>}
          </Panel>
        </Box>
        <Box id="add-panel" sx={{ minWidth: 0 }}>{selected && <AddPanel key={selected.address} pool={selected} chain={chain} onDone={refresh} onClose={() => setSel(null)} />}</Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<PercentIcon size={20} />} title="Pick a pool and a range" text="Each pool pairs a tokenized stock with USDG or ETH at a fixed fee tier. Your liquidity works between the two prices you set; a tighter range earns a larger share of the fees and leaves the range sooner." />
          <Step n={2} icon={<DropIcon size={20} />} title="Deposit both sides" text="Enter one amount and the other follows from the range and the current price. One approval per token, then one transaction mints the position as an NFT in your wallet, held by the Uniswap v3 position manager." />
          <Step n={3} icon={<BoltIcon size={20} />} title="Collect, or leave" text="Fees accrue in both tokens while the price is inside your range. Collect them whenever you like, remove part or all of the position in one transaction, and ETH comes back as ETH." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}>
              <MarkIcon size={22} />
            </Box>
            <Box sx={{ ...Vg, ml: 0 }}>Non-custodial</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>The pools are Uniswap's. The position is yours.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>{BRAND.name} adds no contract and takes no fee here. The page talks to the Uniswap v3 factory and position manager on Robinhood Chain, the same contracts the Uniswap app uses, so a position opened here shows up there and the other way round.</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[
            [<ShieldIcon size={18} />, 'Impermanent loss is real', 'A position is a bet the price stays inside the range. If the stock runs, you end up holding more of the quote; if it drops, more of the stock. Fees are the compensation, not a guarantee.'],
            [<CheckIcon size={18} />, 'What is verified', `The position manager address is ${POSITION_MANAGER.slice(0, 6)}…${POSITION_MANAGER.slice(-4)} and the factory is read for every pool. Amounts, minimums and the deadline are set here and shown in your wallet before you sign.`],
            [<BoltIcon size={18} />, 'Fee APR is today, not tomorrow', 'One day of the pool fee at the current volume, times 365, divided by the liquidity. It moves with volume and with how much liquidity is in range.'],
          ].map(([icon, title, text]) => (
            <Box key={title as string} sx={{ display: 'flex', gap: 1.5, p: 2, borderRadius: t.radius.panel, background: t.color.raised }}>
              <Box sx={{ color: t.color.mark, mt: 0.25, flexShrink: 0 }}>{icon}</Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{title}</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>{text}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>
    </Page>
  )
}
