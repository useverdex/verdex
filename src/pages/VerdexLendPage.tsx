// Verdex Lend: isolated money markets for tokenized stocks. Supply USDG and earn what borrowers pay;
// lock a stock and borrow USDG against it without selling. One market per stock, its own caps.
import { useEffect, useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { formatUnits, parseUnits } from 'viem'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { ROBINHOOD, fmtCompact, fmtUsd, useAssets, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, usePools, type Phase } from '../lib/pools'
import { explorerAddress } from '../lib/autopilot'
import { DEPLOYED, LEND, MAX, addCollateral, borrowLoan, fmtAmt, fmtHealth, removeCollateral, repayLoan, supplyLoan, tokenState, useLendWallet, useMarkets, withdrawLoan, type Market, type Position, type TokenState } from '../lib/lend'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { CheckIcon, ExternalIcon, HandCoinIcon, LayersIcon, LockIcon, ShieldIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel, Stats } from './common'

type Mode = 'supply' | 'withdraw' | 'collateral' | 'borrow' | 'repay' | 'remove'
const MODES: { key: Mode; label: string; group: 'lend' | 'borrow' }[] = [
  { key: 'supply', label: 'Supply', group: 'lend' },
  { key: 'withdraw', label: 'Withdraw', group: 'lend' },
  { key: 'collateral', label: 'Add collateral', group: 'borrow' },
  { key: 'borrow', label: 'Borrow', group: 'borrow' },
  { key: 'repay', label: 'Repay', group: 'borrow' },
  { key: 'remove', label: 'Take collateral out', group: 'borrow' },
]
const USD_AMOUNTS = [25, 100, 250, 1000]
type Ctx = ReturnType<typeof useWallet>
type Tx = { phase: Phase; error?: string; hash?: string }
const txCtx = (w: Ctx, chain: ChainX | undefined, onPhase: (p: Phase) => void) => ({ walletClient: w.walletClient!, account: w.account!, chain, switchChain: w.switchChain, onPhase })
const EMPTY: Position = { supplied: 0n, supplyShares: 0n, collateral: 0n, debt: 0n, borrowable: 0n, health: MAX }
const pct = (n: number) => `${n.toFixed(2)}%`

function Label({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1.25 }}>{children}</Typography>
}
function Choice({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Box component="button" type="button" onClick={onClick} disabled={disabled} aria-pressed={on} sx={{ all: 'unset', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px', height: 34, px: '12px', borderRadius: t.radius.input, fontSize: 13, fontWeight: 500, background: on ? t.color.text : t.color.chip, color: on ? t.color.page : t.color.text, '&:hover': { background: on ? t.color.text : t.color.hover } }}>
      {children}
    </Box>
  )
}
function Row({ k, v, strong, accent }: { k: string; v: React.ReactNode; strong?: boolean; accent?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 13 }}>
      <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{k}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: strong ? 500 : 400, textAlign: 'right', color: accent ? t.color.mark : t.color.text, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
    </Box>
  )
}
function Step({ n, icon, title, text }: { n: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Panel sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: t.radius.input, background: t.color.chip, display: 'grid', placeItems: 'center', color: t.color.mark }}>{icon}</Box>
        <Typography sx={{ ...t.type.overline, color: t.color.textLabel }}>Step {n}</Typography>
      </Box>
      <Typography sx={{ fontSize: 16, fontWeight: 500, mb: 0.75 }}>{title}</Typography>
      <Typography sx={{ fontSize: 14, color: t.color.textMuted, lineHeight: 1.6 }}>{text}</Typography>
    </Panel>
  )
}

function MarketCard({ m, pos, selected, onPick }: { m: Market; pos: Position; selected: boolean; onPick: (mode: Mode) => void }) {
  const cd = m.collateralDecimals, ld = m.loanDecimals
  const supplyUse = m.supplyCap > 0n ? Number((m.totalSupplyAssets * 10_000n) / m.supplyCap) / 100 : 0
  const collUse = m.collateralCap > 0n ? Number((m.totalCollateral * 10_000n) / m.collateralCap) / 100 : 0
  const usd = (v: bigint, dec: number, sym: string) => (sym === 'USDG' ? Number(formatUnits(v, 6)) : (Number(formatUnits(v, dec)) * m.priceUsd))
  const L = (v: bigint, d?: number) => fmtAmt(v, ld, m.loanSymbol, d)
  const C = (v: bigint, d?: number) => fmtAmt(v, cd, m.collateralSymbol, d)
  return (
    <Panel sx={{ p: 2.5, borderColor: selected ? 'rgba(194,234,138,.45)' : undefined }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar src={resolveImg(m.stock?.logo)} sx={{ width: 36, height: 36, background: z.surface2, fontSize: 12 }}>{(m.stock?.ticker ?? '?')[0]}</Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>{m.kind === 'long' ? `Borrow USDG against ${m.stock?.ticker ?? 'the stock'}` : `Borrow ${m.stock?.ticker ?? 'the stock'} against USDG`}</Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{m.stock?.ticker ?? 'Stock'} {fmtUsd(m.priceUsd)} · loan-to-value {m.ltvBps / 100}% · liquidation at {m.liqThresholdBps / 100}%{!m.enabled ? ' · paused' : ''}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 18, fontWeight: 500, color: t.color.mark, fontVariantNumeric: 'tabular-nums' }}>{pct(m.supplyApr)}</Typography>
          <Typography sx={{ fontSize: 11, color: t.color.textMuted }}>supply APR, in {m.loanSymbol}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 2, fontSize: 13 }}>
        <Box>
          <Row k={`${m.loanSymbol} supplied`} v={`${L(m.totalSupplyAssets, m.loanSymbol === 'USDG' ? 0 : 2)} of ${L(m.supplyCap, 0)}`} />
          <Box sx={{ height: 4, borderRadius: 2, background: t.color.chip, mt: 0.75, overflow: 'hidden' }}><Box sx={{ width: `${Math.min(100, supplyUse)}%`, height: '100%', background: t.color.mark }} /></Box>
        </Box>
        <Box>
          <Row k={`${m.collateralSymbol} locked`} v={`${C(m.totalCollateral, m.collateralSymbol === 'USDG' ? 0 : 2)} of ${C(m.collateralCap, 0)}`} />
          <Box sx={{ height: 4, borderRadius: 2, background: t.color.chip, mt: 0.75, overflow: 'hidden' }}><Box sx={{ width: `${Math.min(100, collUse)}%`, height: '100%', background: t.color.mark }} /></Box>
        </Box>
        <Row k="Borrowed" v={L(m.totalBorrowAssets, m.loanSymbol === 'USDG' ? 0 : 3)} />
        <Row k="Borrow APR" v={pct(m.borrowApr)} />
        <Row k="In use" v={pct(m.utilisation)} />
        <Row k="Available" v={L(m.available, m.loanSymbol === 'USDG' ? 0 : 3)} />
      </Box>
      {(pos.supplied > 0n || pos.collateral > 0n || pos.debt > 0n) && (
        <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${t.color.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Row k="You supplied" v={`${L(pos.supplied)} (${fmtUsd(usd(pos.supplied, ld, m.loanSymbol), 0)})`} accent={pos.supplied > 0n} />
          <Row k="Your collateral" v={`${C(pos.collateral)} (${fmtUsd(usd(pos.collateral, cd, m.collateralSymbol), 0)})`} accent={pos.collateral > 0n} />
          <Row k="Your debt" v={`${L(pos.debt)} (${fmtUsd(usd(pos.debt, ld, m.loanSymbol), 0)})`} strong={pos.debt > 0n} />
          <Row k="Health" v={fmtHealth(pos.health)} accent={pos.debt > 0n && Number(pos.health) >= 12_000} />
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <Button onClick={() => onPick('supply')} sx={{ ...Bt, height: 34, fontSize: 13, px: 1.75 }}>Supply {m.loanSymbol}</Button>
        <Button onClick={() => onPick(pos.collateral > 0n ? 'borrow' : 'collateral')} sx={{ ...Lt, backdropFilter: 'none', height: 34, fontSize: 13, px: 1.75 }}>Borrow {m.loanSymbol}</Button>
        {pos.debt > 0n && <Button onClick={() => onPick('repay')} sx={{ ...Lt, backdropFilter: 'none', height: 34, fontSize: 13, px: 1.75 }}>Repay</Button>}
        {pos.supplied > 0n && <Button onClick={() => onPick('withdraw')} sx={{ ...Lt, backdropFilter: 'none', height: 34, fontSize: 13, px: 1.75 }}>Withdraw</Button>}
      </Box>
    </Panel>
  )
}

function Composer({ markets, market, mode, setMarket, setMode, wallet, chain, loanTk, collTk, pos, onDone }: { markets: Market[]; market: Market | undefined; mode: Mode; setMarket: (m: Market) => void; setMode: (m: Mode) => void; wallet: Ctx; chain: ChainX | undefined; loanTk: TokenState; collTk: TokenState; pos: Position; onDone: () => void }) {
  const [amount, setAmount] = useState('100')
  const [tx, setTx] = useState<Tx>({ phase: 'idle' })
  const ld = market?.loanDecimals ?? 6, cd = market?.collateralDecimals ?? 18
  const isLoan = mode === 'supply' || mode === 'withdraw' || mode === 'borrow' || mode === 'repay'
  const dec = isLoan ? ld : cd
  const sym = isLoan ? market?.loanSymbol ?? 'USDG' : market?.collateralSymbol ?? 'stock'
  const n = Number(amount) > 0 ? Number(amount) : 0
  const raw = useMemo(() => { try { return parseUnits(n.toFixed(Math.min(dec, 8)), dec) } catch { return 0n } }, [n, dec])
  const busy = tx.phase !== 'idle' && tx.phase !== 'done' && tx.phase !== 'failed'
  const repayAll = mode === 'repay' && raw >= pos.debt
  const withdrawShares = market && pos.supplied > 0n ? (raw >= pos.supplied ? pos.supplyShares : (raw * pos.supplyShares) / pos.supplied) : 0n
  const limit: bigint = mode === 'supply' ? loanTk.balance : mode === 'withdraw' ? pos.supplied : mode === 'collateral' ? collTk.balance : mode === 'borrow' ? pos.borrowable : mode === 'repay' ? (pos.debt < loanTk.balance ? pos.debt : loanTk.balance) : pos.collateral
  const over = raw > limit
  const capRoom = market ? (mode === 'supply' ? market.supplyCap - market.totalSupplyAssets : mode === 'collateral' ? market.collateralCap - market.totalCollateral : mode === 'borrow' ? market.borrowCap - market.totalBorrowAssets : MAX) : 0n
  const overCap = capRoom !== MAX && raw > capRoom
  const ready = !!wallet.account && !!market && market.enabled && raw > 0n && !over && !overCap && !busy
  const after = useMemo(() => {
    if (!market) return undefined
    const px = market.priceUsd
    const toUsd = (v: bigint, d: number, s: string) => (s === 'USDG' ? Number(formatUnits(v, 6)) : Number(formatUnits(v, d)) * px)
    const coll = mode === 'collateral' ? pos.collateral + raw : mode === 'remove' ? pos.collateral - raw : pos.collateral
    const debt = mode === 'borrow' ? pos.debt + raw : mode === 'repay' ? (repayAll ? 0n : pos.debt - raw) : pos.debt
    const collUsd = toUsd(coll, cd, market.collateralSymbol), debtUsd = toUsd(debt, ld, market.loanSymbol)
    const health = debtUsd > 0 ? (collUsd * market.liqThresholdBps) / 10_000 / debtUsd : Infinity
    // the stock price at which the position reaches the line
    let liqPrice = 0
    if (debtUsd > 0 && coll > 0n) liqPrice = market.kind === 'long' ? debtUsd / (Number(formatUnits(coll, cd)) * (market.liqThresholdBps / 10_000)) : (collUsd * (market.liqThresholdBps / 10_000)) / Number(formatUnits(debt, ld))
    return { collUsd, debtUsd, health, liqPrice }
  }, [market, mode, pos, raw, repayAll, cd, ld])
  const setMax = () => setAmount(formatUnits(limit, dec))
  const go = async () => {
    if (!wallet.walletClient || !wallet.account || !market) return
    setTx({ phase: 'switching' })
    try {
      const ctx = txCtx(wallet, chain, (p) => setTx((x) => ({ ...x, phase: p })))
      const hash = mode === 'supply' ? await supplyLoan(ctx, market, raw, loanTk.allowance)
        : mode === 'withdraw' ? await withdrawLoan(ctx, market, withdrawShares)
        : mode === 'collateral' ? await addCollateral(ctx, market, raw, collTk.allowance)
        : mode === 'borrow' ? await borrowLoan(ctx, market, raw)
        : mode === 'repay' ? await repayLoan(ctx, market, raw, repayAll, loanTk.allowance)
        : await removeCollateral(ctx, market, raw)
      setTx({ phase: 'done', hash })
      onDone()
    } catch (e) {
      setTx({ phase: 'failed', error: describeError(e) })
    }
  }
  const verb = `${MODES.find((x) => x.key === mode)?.label ?? 'Go'} ${sym}`
  const fmtLim = (v: bigint) => fmtAmt(v, dec, sym)
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
      <Label>Market</Label>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
        {markets.map((x) => <Choice key={x.id.toString()} on={x.id === market?.id} onClick={() => { setMarket(x); setTx({ phase: 'idle' }) }} disabled={!x.enabled}>{x.kind === 'long' ? `${x.stock?.ticker ?? `#${x.id}`} → USDG` : `USDG → ${x.stock?.ticker ?? `#${x.id}`}`}</Choice>)}
      </Box>
      <Label>Lend {market?.loanSymbol ?? ''}</Label>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {MODES.filter((x) => x.group === 'lend').map((x) => <Choice key={x.key} on={mode === x.key} onClick={() => { setMode(x.key); setTx({ phase: 'idle' }) }}>{x.label}</Choice>)}
      </Box>
      <Label>Borrow {market?.loanSymbol ?? ''} against {market?.collateralSymbol ?? ''}</Label>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
        {MODES.filter((x) => x.group === 'borrow').map((x) => <Choice key={x.key} on={mode === x.key} onClick={() => { setMode(x.key); setTx({ phase: 'idle' }) }}>{x.label}</Choice>)}
      </Box>
      <Label>Amount, in {sym}</Label>
      {sym === 'USDG' && mode !== 'withdraw' && mode !== 'repay' && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>{USD_AMOUNTS.map((a) => <Choice key={a} on={Number(amount) === a} onClick={() => setAmount(String(a))}>${a}</Choice>)}</Box>}
      {(sym !== 'USDG' || mode === 'withdraw' || mode === 'repay') && limit > 0n && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>{[25, 50, 100].map((p) => <Choice key={p} on={false} onClick={() => setAmount(formatUnits((limit * BigInt(p)) / 100n, dec))}>{p}%</Choice>)}</Box>}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 44, px: 1.5, borderRadius: t.radius.input, background: t.color.hover }}>
        {sym === 'USDG' && <Typography sx={{ fontSize: 15, color: t.color.textMuted }}>$</Typography>}
        <InputBase value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputProps={{ inputMode: 'decimal', 'aria-label': 'Amount' }} sx={{ flex: 1, fontSize: 15, fontWeight: 500 }} />
        <Box component="button" type="button" onClick={setMax} sx={{ all: 'unset', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: t.color.mark }}>Max</Box>
      </Box>
      <Typography sx={{ fontSize: 12, color: over || overCap ? t.color.red : t.color.textMuted, mt: 0.75 }}>
        {mode === 'supply' && `Wallet: ${fmtLim(loanTk.balance)}${overCap ? ' · over the market cap' : ''}`}
        {mode === 'withdraw' && `Supplied: ${fmtLim(pos.supplied)}${market && pos.supplied > market.available ? ` · ${fmtLim(market.available)} not lent out` : ''}`}
        {mode === 'collateral' && `Wallet: ${fmtLim(collTk.balance)}${overCap ? ' · over the collateral cap' : ''}`}
        {mode === 'borrow' && `You can borrow up to ${fmtLim(pos.borrowable)}${overCap ? ' · over the borrow cap' : ''}`}
        {mode === 'repay' && `Debt: ${fmtLim(pos.debt)} · wallet ${fmtLim(loanTk.balance)}`}
        {mode === 'remove' && `Locked: ${fmtLim(pos.collateral)}`}
      </Typography>
      {market && (
        <Box sx={{ mt: 2, p: 1.75, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 0.75 }}>
          {(mode === 'supply' || mode === 'withdraw') && <>
            <Row k="Supply APR now" v={pct(market.supplyApr)} accent />
            <Row k="Borrowers pay" v={pct(market.borrowApr)} />
            <Row k="In use" v={pct(market.utilisation)} />
            <Row k={`${BRAND.name} share of interest`} v="10%, to the treasury" />
          </>}
          {(mode === 'collateral' || mode === 'borrow' || mode === 'repay' || mode === 'remove') && after && <>
            <Row k="Collateral after" v={fmtUsd(after.collUsd, 0)} />
            <Row k="Debt after" v={fmtUsd(after.debtUsd)} strong />
            <Row k="Health after" v={after.health === Infinity ? '∞' : after.health.toFixed(2)} accent={after.health >= 1.2} />
            {after.liqPrice > 0 && <Row k={`Liquidation if ${market.stock?.ticker ?? 'the stock'} is ${market.kind === 'long' ? 'below' : 'above'}`} v={fmtUsd(after.liqPrice)} />}
            <Row k="Borrow APR" v={pct(market.borrowApr)} />
          </>}
        </Box>
      )}
      <Button onClick={() => (wallet.account ? void go() : wallet.openWalletMenu())} disabled={!!wallet.account && !ready} sx={{ ...Bt, width: '100%', height: 48, mt: 2 }}>
        {!wallet.account ? 'Connect wallet' : busy ? PHASE_LABEL[tx.phase] : !market ? 'No market' : over ? 'More than you have' : overCap ? 'Over the cap' : verb}
      </Button>
      {tx.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1 }}>{tx.error}</Typography>}
      {tx.phase === 'done' && tx.hash && chain && <Typography sx={{ fontSize: 12, color: t.color.mark, mt: 1 }}>Done. <Box component="a" href={explorerTx(chain, ROBINHOOD, tx.hash)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>Transaction</Box></Typography>}
      <Typography sx={{ fontSize: 11, color: t.color.textLabel, mt: 1.5, lineHeight: 1.5 }}>Unaudited. Prices are read from the stock's Uniswap v3 USDG pool, the lower collateral value of spot and a 30-minute average to borrow, the higher to liquidate. A loan under its threshold can be liquidated by anyone, with a {market ? market.liqBonusBps / 100 : 5}% bonus taken from your collateral.</Typography>
    </Panel>
  )
}

export default function VerdexLendPage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ROBINHOOD) as ChainX | undefined
  const assets = useAssets()
  const pools = usePools(assets.data?.assets)
  const markets = useMarkets(assets.data?.assets, pools.data)
  const w = useLendWallet(account?.address, markets.data)
  const qc = useQueryClient()
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['lend-markets'] }); void qc.invalidateQueries({ queryKey: ['lend-wallet'] }) }
  const [mode, setMode] = useState<Mode>('supply')
  const [picked, setPicked] = useState<string>()
  const market = markets.data?.find((x) => x.id.toString() === picked) ?? markets.data?.find((x) => x.enabled) ?? markets.data?.[0]
  useEffect(() => { if (!picked && market) setPicked(market.id.toString()) }, [picked, market])
  const list = markets.data ?? []
  const usdOf = (m: Market, v: bigint, dec: number, sym: string) => (sym === 'USDG' ? Number(formatUnits(v, 6)) : Number(formatUnits(v, dec)) * m.priceUsd)
  const supplied = list.reduce((s, x) => s + usdOf(x, x.totalSupplyAssets, x.loanDecimals, x.loanSymbol), 0)
  const borrowed = list.reduce((s, x) => s + usdOf(x, x.totalBorrowAssets, x.loanDecimals, x.loanSymbol), 0)
  const collateralUsd = list.reduce((s, x) => s + usdOf(x, x.totalCollateral, x.collateralDecimals, x.collateralSymbol), 0)
  const posOf = (m: Market) => w.data?.positions[m.id.toString()] ?? EMPTY
  const mine = list.reduce((s, x) => { const p = posOf(x); return s + usdOf(x, p.supplied, x.loanDecimals, x.loanSymbol) + usdOf(x, p.collateral, x.collateralDecimals, x.collateralSymbol) - usdOf(x, p.debt, x.loanDecimals, x.loanSymbol) }, 0)
  const pick = (m: Market, md: Mode) => { setPicked(m.id.toString()); setMode(md); document.getElementById('lend-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const longs = list.filter((x) => x.kind === 'long'), shorts = list.filter((x) => x.kind === 'short')

  return (
    <Page>
      <PageHero
        label="Verdex Lend"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>{DEPLOYED ? 'Live' : 'Contract not deployed'}</Box>}
        title={<>Borrow against<br />your stocks.</>}
        lead={`The first money market for tokenized stocks on Robinhood Chain. Supply USDG and earn what borrowers pay, or lock NVDA, TSLA or any listed stock and borrow USDG against it without selling. Or lend the stock itself and earn what the shorts pay to borrow it. One market per pair, isolated: its own loan-to-value, its own caps, nothing spills over. The contract holds the stocks and the USDG and can send them to nobody but the people they belong to.`}
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => (account ? document.getElementById('lend-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : openWalletMenu())} sx={{ ...Bt, gap: 1 }}>
              <HandCoinIcon size={15} /> {account ? 'Supply or borrow' : 'Connect wallet'}
            </Button>
            <Button component={Link} to="/lend" sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
              <LayersIcon size={14} /> Other lending markets
            </Button>
          </Box>
        }
      />

      <Stats items={[{ label: 'Markets', value: markets.data ? list.length : DEPLOYED ? '…' : '0' }, { label: 'Supplied', value: markets.data ? fmtCompact(supplied) : DEPLOYED ? '…' : '$0' }, { label: 'Borrowed', value: markets.data ? fmtCompact(borrowed) : DEPLOYED ? '…' : '$0' }, { label: 'Yours', value: account ? (w.data ? fmtUsd(mine, 0) : '…') : '-' }]} />
      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>
        Read from the Verdex Lend contract on Robinhood Chain{DEPLOYED && <>, <Box component="a" href={explorerAddress(LEND)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.textMuted }}>{LEND.slice(0, 6)}…{LEND.slice(-4)}</Box></>}. Collateral locked: {fmtCompact(collateralUsd)}. Prices come from each stock's deepest USDG pool on Uniswap v3.
      </Typography>

      {!DEPLOYED && (
        <Panel sx={{ mt: 5, p: { xs: 3, md: 4 } }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500, mb: 1 }}>Contract not deployed</Typography>
          <Typography sx={{ fontSize: 14, color: t.color.textMuted, lineHeight: 1.6 }}>The source is in the repository under contracts/VerdexLend.sol. When the deployment lands, this page reads it.</Typography>
        </Panel>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' }, gap: 3, mt: 5, alignItems: 'start' }}>
        <Box>
          <Typography sx={{ ...t.type.h3, mb: 2 }}>The markets</Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            {longs.length > 0 && <Typography sx={{ ...t.type.overline, color: t.color.textLabel }}>Borrow USDG against a stock</Typography>}
            {longs.map((m) => <MarketCard key={m.id.toString()} m={m} pos={posOf(m)} selected={m.id === market?.id} onPick={(md) => pick(m, md)} />)}
            {shorts.length > 0 && <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mt: 2 }}>Lend a stock, or borrow it against USDG</Typography>}
            {shorts.map((m) => <MarketCard key={m.id.toString()} m={m} pos={posOf(m)} selected={m.id === market?.id} onPick={(md) => pick(m, md)} />)}
            {DEPLOYED && markets.data && list.length === 0 && <Panel sx={{ p: 3 }}><Typography sx={{ fontSize: 14, color: t.color.textMuted }}>No market yet.</Typography></Panel>}
            {DEPLOYED && !markets.data && !markets.isError && <Panel sx={{ p: 3 }}><Typography sx={{ fontSize: 14, color: t.color.textMuted }}>Reading the markets and the pools behind them…</Typography></Panel>}
            {markets.isError && <Panel sx={{ p: 3 }}><Typography sx={{ fontSize: 14, color: t.color.textMuted }}>The chain is rate-limiting reads right now. Reload in a minute.</Typography></Panel>}
          </Box>
        </Box>
        <Box id="lend-composer" sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
          <Composer markets={list} market={market} mode={mode} setMarket={(m) => setPicked(m.id.toString())} setMode={setMode} wallet={wallet} chain={chain} loanTk={market ? tokenState(w.data, market.loan) : { balance: 0n, allowance: 0n }} collTk={market ? tokenState(w.data, market.collateral) : { balance: 0n, allowance: 0n }} pos={market ? posOf(market) : EMPTY} onDone={refresh} />
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography sx={{ ...t.type.h3, mb: 3 }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          <Step n={1} icon={<WalletIcon size={16} />} title="Supply USDG, or a stock" text="What you supply joins the market's pool and earns the interest borrowers pay, minus a 10% share kept for the treasury, where it buys VERDEX. Withdraw whenever it is not lent out. Stock markets are what the shorts borrow from." />
          <Step n={2} icon={<LockIcon size={16} />} title="Lock a stock" text="Add NVDA or any listed stock as collateral. It stays yours, in the contract, and comes back when you take it out. Nothing is sold." />
          <Step n={3} icon={<HandCoinIcon size={16} />} title="Borrow USDG" text="Up to the loan-to-value of your collateral at the pool price, the lower of spot and a 30-minute average. Interest accrues by the second; repay any part, any time." />
          <Step n={4} icon={<ShieldIcon size={16} />} title="Stay above the line" text="If debt crosses the liquidation threshold of the collateral value, anyone can repay part of it and take collateral worth that plus a 5% bonus. Keep the health above 1." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: t.color.mark }}><MarkIcon size={18} /><Typography sx={{ ...t.type.overline, color: t.color.textLabel }}>Capped while it is new</Typography></Box>
          <Typography sx={{ ...t.type.h3, mb: 1.5 }}>Small limits first.</Typography>
          <Typography sx={{ fontSize: 14, color: t.color.textMuted, lineHeight: 1.7 }}>Every market opens with hard caps on what can be supplied, borrowed and locked, and raises them as it proves itself. Isolated pairs mean a problem in one stock stays in that stock. The owner keeps caps and parameters and nothing else: there is no function that moves funds to the owner. Open source, verified, unaudited, tested on a fork of Robinhood Chain. Read it before you trust it with more than you would lose.</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {[['Send your stock anywhere but back to you', 'or to a liquidator, against your debt, when you are under the line'], ['Lend more than the cap', 'or let one market touch another'], ['Move funds to the owner', 'there is no such function'], ['Use a single block\'s price', 'spot and a 30-minute average, the one that protects the lender']].map(([a, b]) => (
            <Box key={a} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ color: t.color.mark, mt: '2px', flexShrink: 0 }}><CheckIcon size={14} /></Box>
              <Box><Typography sx={{ fontSize: 14, fontWeight: 500 }}>{a}</Typography><Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{b}</Typography></Box>
            </Box>
          ))}
          {DEPLOYED && <Box component="a" href={explorerAddress(LEND)} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 13, color: t.color.textMuted, mt: 1, textDecoration: 'none' }}>The contract on the explorer <ExternalIcon size={12} /></Box>}
        </Box>
      </Panel>
    </Page>
  )
}
