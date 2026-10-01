import { useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { CHAIN_NAME_LOGOS, ROBINHOOD, fmtCompact, fmtUsd, useAssets, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, POSITION_MANAGER, collectFees, fmtFee, fmtPrice, fmtQty, removeLiquidity, tickBand, toRaw, usePools, usePositions, type Phase, type Position } from '../lib/pools'
import { BANDS, SPARK_URL, SPARK_USDG, WORK_LABEL, bandAverage, depositSavings, putToWork, sellBand, useIdle, useSavings, withdrawSavings, workState, type Idle, type Savings } from '../lib/yield'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { CheckIcon, CoinIcon, ExternalIcon, PercentIcon, ShieldIcon, TrendIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Cell, Page, PageHero, Panel, Row, Stats, TableHead } from './common'

const SHARES = [25, 50, 75, 100]
type Sel = { kind: 'stock'; address: string } | { kind: 'cash'; mode: 'deposit' | 'withdraw' }
type Ctx = ReturnType<typeof useWallet>

function Label({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1.25 }}>{children}</Typography>
}
function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Box component="button" type="button" onClick={onClick} aria-pressed={on} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', height: 34, px: '12px', borderRadius: t.radius.input, fontSize: 13, fontWeight: 500, background: on ? t.color.text : t.color.chip, color: on ? t.color.page : t.color.text, '&:hover': { background: on ? t.color.text : t.color.hover } }}>
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
function Mark({ logo, letter, size = 44, cash }: { logo?: string; letter: string; size?: number; cash?: boolean }) {
  return (
    <Box sx={{ position: 'relative', width: size, height: size, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', flexShrink: 0, color: t.color.mark }}>
      {cash ? <CoinIcon size={size * 0.5} /> : <Avatar src={resolveImg(logo)} sx={{ width: size * 0.64, height: size * 0.64, background: z.surface2, fontSize: 10 }}>{letter}</Avatar>}
      <Avatar src={CHAIN_NAME_LOGOS['Robinhood Chain']} sx={{ width: 14, height: 14, position: 'absolute', right: 6, bottom: 6, border: `1.5px solid ${t.color.page}` }} />
    </Box>
  )
}
const StateDot = ({ state }: { state: 'earning' | 'waiting' | 'sold' }) => (
  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: state === 'earning' ? t.color.green : t.color.textMuted, fontWeight: 400 }}>
    <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: state === 'earning' ? t.color.green : state === 'waiting' ? t.color.mark : t.color.textLabel }} /> {WORK_LABEL[state]}
  </Box>
)
const quoteName = (p: Position['pool']) => (p.quote.symbol === 'WETH' ? 'ETH' : p.quote.symbol)
const trim = (n: number) => (n >= 1 ? n.toFixed(4).replace(/\.?0+$/, '') : n.toPrecision(6).replace(/\.?0+$/, ''))
const busyPhase = (p: Phase) => p === 'switching' || p === 'approving' || p === 'confirming' || p === 'pending'

function TxNote({ chain, tx, error, text }: { chain: ChainX | undefined; tx: string | null; error: string | null; text: string }) {
  return (
    <>
      {error && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5, lineHeight: 1.4 }}>{error}</Typography>}
      {tx && (
        <Typography sx={{ fontSize: 12, color: t.color.green, mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          {text}
          <Box component="a" href={explorerTx(chain, ROBINHOOD, tx)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text, display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}>
            View <ExternalIcon size={12} />
          </Box>
        </Typography>
      )}
    </>
  )
}
function AmountBox({ label, value, onChange, balance, symbol, short }: { label: string; value: string; onChange: (v: string) => void; balance: number | null; symbol: string; short: boolean }) {
  return (
    <Box sx={{ p: 2, borderRadius: t.radius.panel, background: t.color.raised }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.color.textMuted }}>
        <span>{label}</span>
        {balance != null && (
          <Box component="button" type="button" onClick={() => onChange(trim(balance))} sx={{ all: 'unset', cursor: 'pointer', color: short ? t.color.red : t.color.textMuted, '&:hover': { color: t.color.text } }}>
            Balance {fmtQty(balance)} · Max
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
        <InputBase value={value} inputMode="decimal" placeholder="0" onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && onChange(e.target.value)} inputProps={{ 'aria-label': label }} sx={{ flex: 1, minWidth: 0, fontSize: 26, fontWeight: 500, color: t.color.text, '& input': { p: 0, minWidth: 0, width: '100%' }, '& input::placeholder': { color: t.color.text, opacity: 0.4 } }} />
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: t.color.textMuted }}>{symbol}</Typography>
      </Box>
    </Box>
  )
}
function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <Box sx={{ mt: 2.5, p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 0.75, fontSize: 13 }}>
      {rows.map(([k, v]) => (
        <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, flexShrink: 0 }}>{k}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{v}</Typography>
        </Box>
      ))}
    </Box>
  )
}
function PanelHead({ mark, title, sub, onClose }: { mark: React.ReactNode; title: React.ReactNode; sub: string; onClose: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {mark}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>{title}</Typography>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{sub}</Typography>
      </Box>
      <Box component="button" type="button" aria-label="Close" onClick={onClose} sx={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: t.color.textLabel, '&:hover': { color: t.color.text } }}>
        Close
      </Box>
    </Box>
  )
}

// Composer for a stock: a band above the price and an amount, then one transaction.
function StockPanel({ idle, wallet, chain, onDone, onClose }: { idle: Idle; wallet: Ctx; chain: ChainX | undefined; onDone: () => void; onClose: () => void }) {
  const { account, walletClient, switchChain, openWalletMenu } = wallet
  const [band, setBand] = useState(1)
  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [tx, setTx] = useState<string | null>(null)
  const pool = idle.pool
  const ticks = useMemo(() => (pool ? sellBand(pool, BANDS[band].pct) : null), [pool, band])
  const edges = useMemo(() => (pool && ticks ? tickBand(pool, ticks[0], ticks[1]) : null), [pool, ticks])
  const avg = pool && ticks ? bandAverage(pool, ticks[0], ticks[1]) : 0
  const raw = toRaw(Number(amount) || 0, idle.stock.decimals)
  const short = raw > idle.balance
  const qty = Number(amount) || 0
  const busy = busyPhase(phase)
  const q = pool ? quoteName(pool) : 'USDG'

  const submit = async () => {
    if (!account || !walletClient) return openWalletMenu()
    if (!pool || !ticks) return
    setError(null)
    setTx(null)
    try {
      const hash = await putToWork({ walletClient, account, chain, switchChain, onPhase: setPhase }, pool, ticks[0], ticks[1], raw)
      setTx(hash)
      setAmount('')
      onDone()
    } catch (e) {
      setPhase('failed')
      setError(describeError(e))
    }
  }

  if (!pool || !ticks || !edges) {
    return (
      <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
        <PanelHead mark={<Mark logo={idle.stock.logo} letter={idle.stock.ticker[0]} size={40} />} title={`${idle.stock.ticker} has no pool yet`} sub={`${idle.stock.name} · ${fmtQty(idle.qty)} in your wallet`} onClose={onClose} />
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 2.5 }}>No Uniswap v3 pool on Robinhood Chain pairs this token with USDG or ETH yet, so there is nowhere for it to earn. It stays in your wallet.</Typography>
      </Panel>
    )
  }
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, position: { md: 'sticky' }, top: { md: 92 }, minWidth: 0, overflow: 'hidden' }}>
      <PanelHead
        mark={<Mark logo={idle.stock.logo} letter={idle.stock.ticker[0]} size={40} />}
        title={
          <>
            Put {idle.stock.ticker} to work <Box component="span" sx={{ ...Vg, ml: 0, fontSize: 11 }}>{fmtFee(pool.fee)} pool</Box>
          </>
        }
        sub={`${idle.stock.name} · ${fmtUsd(pool.priceUsd)} now · ${q} pool`}
        onClose={onClose}
      />
      <Box sx={{ mt: 3 }}>
        <Label>Sell band above the price</Label>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {BANDS.map((b, i) => (
            <Choice key={b.label} on={band === i} onClick={() => setBand(i)}>
              {b.label}
            </Choice>
          ))}
        </Box>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 1.5, lineHeight: 1.5 }}>
          From {fmtPrice(edges[0])} to {fmtPrice(edges[1])} {q} per {idle.stock.ticker}. Below the band your shares wait and stay yours. Inside it they earn {fmtFee(pool.fee)} of every trade. If the price climbs through the top, they have been sold at about {fmtPrice(avg)} {q} each.
        </Typography>
      </Box>
      <Box sx={{ mt: 3, display: 'grid', gap: 1.25 }}>
        <Label>Amount</Label>
        <AmountBox label={idle.stock.ticker} value={amount} onChange={setAmount} balance={idle.qty} symbol={idle.stock.ticker} short={short} />
      </Box>
      <Summary
        rows={[
          ['Deposit', qty ? `${fmtQty(qty)} ${idle.stock.ticker} · ${fmtUsd(qty * pool.priceUsd)}` : '-'],
          ['Band', `${fmtPrice(edges[0])} to ${fmtPrice(edges[1])} ${q}`],
          ['Fee APR now', pool.feeApr ? `${Math.round(pool.feeApr)}% while inside the band` : '-'],
          ['If sold through', qty ? `about ${fmtQty(qty * avg, 2)} ${q}` : `${fmtPrice(avg)} ${q} per share`],
          ['Slippage', '0.5%'],
        ]}
      />
      <TxNote chain={chain} tx={tx} error={error} text="Working. It shows below as it earns." />
      <Button fullWidth onClick={submit} disabled={!!account && (!(raw > 0n) || short || busy)} sx={{ ...Bt, height: 48, mt: 2 }}>
        {!account ? 'Connect wallet' : busy ? PHASE_LABEL[phase] : short ? 'Insufficient balance' : `Put ${idle.stock.ticker} to work`}
      </Button>
      <Typography sx={{ fontSize: 11, color: t.color.textLabel, textAlign: 'center', mt: 1.5, lineHeight: 1.4 }}>One approval the first time, then one transaction to the Uniswap v3 position manager on Robinhood Chain. Stop from this page whenever you like.</Typography>
    </Panel>
  )
}

// Composer for cash: deposit USDG into Spark Savings, or redeem a share of what is there.
function CashPanel({ savings, mode, wallet, chain, onDone, onClose }: { savings: Savings; mode: 'deposit' | 'withdraw'; wallet: Ctx; chain: ChainX | undefined; onDone: () => void; onClose: () => void }) {
  const { account, walletClient, switchChain, openWalletMenu } = wallet
  const [tab, setTab] = useState(mode)
  const [amount, setAmount] = useState('')
  const [share, setShare] = useState(100)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [tx, setTx] = useState<string | null>(null)
  const raw = toRaw(Number(amount) || 0, 6)
  const short = raw > savings.wallet
  const busy = busyPhase(phase)
  const perYear = (Number(amount) || 0) * (savings.apy / 100)

  const submit = async () => {
    if (!account || !walletClient) return openWalletMenu()
    setError(null)
    setTx(null)
    try {
      const ctx = { walletClient, account, chain, switchChain, onPhase: setPhase }
      const hash = tab === 'deposit' ? await depositSavings(ctx, raw) : await withdrawSavings(ctx, savings.shares, share)
      setTx(hash)
      setAmount('')
      onDone()
    } catch (e) {
      setPhase('failed')
      setError(describeError(e))
    }
  }

  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, position: { md: 'sticky' }, top: { md: 92 }, minWidth: 0, overflow: 'hidden' }}>
      <PanelHead mark={<Mark cash letter="$" size={40} />} title="Cash to Spark Savings" sub={`USDG · ${savings.apy.toFixed(2)}% APY now · accrues every second`} onClose={onClose} />
      <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
        <Choice on={tab === 'deposit'} onClick={() => setTab('deposit')}>
          Deposit
        </Choice>
        <Choice on={tab === 'withdraw'} onClick={() => setTab('withdraw')}>
          Withdraw
        </Choice>
      </Box>
      {tab === 'deposit' ? (
        <>
          <Box sx={{ mt: 3, display: 'grid', gap: 1.25 }}>
            <Label>Amount</Label>
            <AmountBox label="USDG" value={amount} onChange={setAmount} balance={savings.walletUsdg} symbol="USDG" short={short} />
          </Box>
          <Summary rows={[['Rate', `${savings.apy.toFixed(2)}% APY, set by Spark`], ['Over a year', perYear ? `about ${fmtUsd(perYear)} at today's rate` : '-'], ['You receive', 'spUSDG, worth more USDG every second'], ['Withdraw', 'Any time, no lock, no exit fee']]} />
          <TxNote chain={chain} tx={tx} error={error} text="Deposited. It shows below as it earns." />
          <Button fullWidth onClick={submit} disabled={!!account && (!(raw > 0n) || short || busy)} sx={{ ...Bt, height: 48, mt: 2 }}>
            {!account ? 'Connect wallet' : busy ? PHASE_LABEL[phase] : short ? 'Insufficient balance' : 'Deposit USDG'}
          </Button>
        </>
      ) : (
        <>
          <Box sx={{ mt: 3 }}>
            <Label>Withdraw</Label>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {SHARES.map((s) => (
                <Choice key={s} on={share === s} onClick={() => setShare(s)}>
                  {s}%
                </Choice>
              ))}
            </Box>
          </Box>
          <Summary rows={[['In Spark Savings', `${fmtUsd(savings.balance)} USDG`], ['You withdraw', fmtUsd((savings.balance * share) / 100)], ['Arrives as', 'USDG in the same wallet'], ['Exit fee', 'None']]} />
          <TxNote chain={chain} tx={tx} error={error} text="Withdrawn." />
          <Button fullWidth onClick={submit} disabled={!!account && (savings.shares === 0n || busy)} sx={{ ...Bt, height: 48, mt: 2 }}>
            {!account ? 'Connect wallet' : busy ? PHASE_LABEL[phase] : savings.shares === 0n ? 'Nothing deposited' : `Withdraw ${share}%`}
          </Button>
        </>
      )}
      <Typography sx={{ fontSize: 11, color: t.color.textLabel, textAlign: 'center', mt: 1.5, lineHeight: 1.4 }}>
        Spark Savings USDG is an ERC-4626 vault at {SPARK_USDG.address.slice(0, 6)}…{SPARK_USDG.address.slice(-4)}. {BRAND.name} adds no contract and takes no fee.
      </Typography>
    </Panel>
  )
}

// A position doing its job, with the exit.
function WorkCard({ p, wallet, chain, onChanged }: { p: Position; wallet: Ctx; chain: ChainX | undefined; onChanged: () => void }) {
  const { account, walletClient, switchChain } = wallet
  const [phase, setPhase] = useState<Phase>('idle')
  const [what, setWhat] = useState<'collect' | 'stop' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tx, setTx] = useState<string | null>(null)
  const busy = busyPhase(phase)
  const state = workState(p)
  const q = quoteName(p.pool)
  const stock = p.pool.stockIsToken0 ? p.amount0 : p.amount1
  const quote = p.pool.stockIsToken0 ? p.amount1 : p.amount0
  const run = async (kind: 'collect' | 'stop') => {
    if (!account || !walletClient) return
    setError(null)
    setTx(null)
    setWhat(kind)
    try {
      const ctx = { walletClient, account, chain, switchChain, onPhase: setPhase }
      setTx(kind === 'collect' ? await collectFees(ctx, p) : await removeLiquidity(ctx, p, 100))
      onChanged()
    } catch (e) {
      setPhase('failed')
      setError(describeError(e))
    }
  }
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Mark logo={p.pool.logo} letter={p.pool.ticker[0]} size={40} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {p.pool.ticker} <Box component="span" sx={{ ...Vg, ml: 0, fontSize: 11 }}>{fmtFee(p.pool.fee)} pool</Box> <StateDot state={state} />
          </Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>
            Band {fmtPrice(p.band[0])} to {fmtPrice(p.band[1])} {q} · now {fmtPrice(p.pool.price)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 18, fontWeight: 500 }}>{fmtUsd(p.valueUsd)}</Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>
            {fmtQty(stock)} {p.pool.ticker}
            {quote > 0 ? ` + ${fmtQty(quote)} ${q}` : ''}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2, pt: 2, borderTop: `1px solid ${t.color.border}`, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, flex: 1, minWidth: 180 }}>
          Fees earned, uncollected: <Box component="span" sx={{ color: t.color.mark, fontWeight: 500 }}>{fmtUsd(p.feesUsd, p.feesUsd < 1 ? 4 : 2)}</Box>
        </Typography>
        <Button onClick={() => run('collect')} disabled={busy || p.feesUsd <= 0} sx={{ ...Lt, backdropFilter: 'none', height: 36, px: 2 }}>
          {busy && what === 'collect' ? PHASE_LABEL[phase] : 'Collect fees'}
        </Button>
        <Button onClick={() => run('stop')} disabled={busy} sx={{ ...Lt, backdropFilter: 'none', height: 36, px: 2 }}>
          {busy && what === 'stop' ? PHASE_LABEL[phase] : state === 'sold' ? 'Take the proceeds' : 'Stop'}
        </Button>
      </Box>
      <TxNote chain={chain} tx={tx} error={error} text={what === 'collect' ? 'Fees collected.' : 'Back in your wallet, with the fees.'} />
    </Panel>
  )
}

export default function AssetYieldPage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: assets } = useAssets()
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ROBINHOOD) as ChainX | undefined
  const pools = usePools(assets?.assets)
  const savings = useSavings(account?.address)
  const idle = useIdle(account?.address, assets?.assets, pools.data)
  const positions = usePositions(account?.address, pools.data)
  const qc = useQueryClient()
  const [sel, setSel] = useState<Sel | null>(null)
  const best = useMemo(() => {
    const d = (pools.data ?? []).filter((p) => p.liquidityUsd >= 10_000)
    return { n: d.length, apr: d.reduce((m, p) => Math.max(m, p.feeApr), 0) }
  }, [pools.data])
  const working = useMemo(() => (positions.data ?? []).filter((p) => p.liquidity > 0n || p.feesUsd > 0), [positions.data])
  const refresh = () => {
    for (const k of ['verdex-positions', 'idle', 'savings']) qc.invalidateQueries({ queryKey: [k] })
  }
  const pick = (s: Sel) => {
    setSel(s)
    if (window.innerWidth < 900) document.getElementById('yield-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const selected = sel?.kind === 'stock' ? (idle.data?.find((i) => i.stock.address.toLowerCase() === sel.address.toLowerCase()) ?? null) : null
  const s = savings.data
  const idleUsd = (idle.data ?? []).reduce((a, i) => a + i.valueUsd, 0) + (s?.walletUsdg ?? 0)

  return (
    <Page>
      <PageHero
        label="Asset Yield"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Live</Box>}
        title={
          <>
            Idle stocks earn
            <br />
            while you hold them.
          </>
        }
        lead="Everything that sits still in your wallet on Robinhood Chain can work. A stock goes into a one-sided band just above its price: it earns the pool fee on every trade that reaches the band, stays yours below it, and is sold only if the price climbs through. Cash goes into Spark Savings USDG at the rate Spark pays. Out whenever you want, signed in your own wallet."
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => (account ? pick({ kind: 'cash', mode: 'deposit' }) : openWalletMenu())} sx={{ ...Bt, gap: 1 }}>
              <PercentIcon size={15} /> {account ? 'Earn on cash' : 'Connect wallet'}
            </Button>
            {!account && (
              <Button onClick={openWalletMenu} sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
                <WalletIcon size={14} /> See what is idle
              </Button>
            )}
          </Box>
        }
      />

      <Stats items={[{ label: 'Savings rate', value: s ? `${s.apy.toFixed(2)}%` : '…' }, { label: 'In Spark Savings', value: s ? fmtCompact(s.totalUsd) : '…' }, { label: 'Stock pools', value: pools.data ? best.n : '…' }, { label: 'Best stock fee APR', value: pools.data ? `${Math.round(best.apr)}%` : '…' }]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>The savings rate is read from the Spark vault and compounded per second. Stock pools are the Uniswap v3 pools on Robinhood Chain with at least $10k of liquidity; fee APR is one day of the pool fee at today's volume, times 365, over the liquidity.</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: sel ? 'minmax(0,1fr) 400px' : 'minmax(0,1fr)' }, gap: 2.5, mt: { xs: 5, md: 7 }, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>In your wallet</Typography>
            {account && <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{idle.data && s ? `${fmtUsd(idleUsd)} idle on Robinhood Chain` : 'Reading your wallet…'}</Typography>}
          </Box>
          {!account ? (
            <Panel sx={{ p: { xs: 3, md: 4 }, display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Connect to see what is idle.</Typography>
                <Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 0.75 }}>Every tokenized stock and the USDG your address holds on Robinhood Chain, each with the place it can earn and the rate there today.</Typography>
              </Box>
              <Button onClick={openWalletMenu} sx={{ ...Bt, gap: 1 }}>
                <WalletIcon size={14} /> Connect wallet
              </Button>
            </Panel>
          ) : (
            <Panel sx={{ overflow: 'hidden' }}>
              <TableHead cols={[{ label: 'Asset', grow: true }, { label: 'Value', align: 'right', hide: 'xs' }, { label: 'Earns', align: 'right' }, { label: '', align: 'right', hide: 'xs' }]} />
              {(idle.isLoading || savings.isLoading) && <Typography sx={{ p: 3, fontSize: 14, color: t.color.textMuted }}>Reading balances…</Typography>}
              {(idle.isError || savings.isError) && <Typography sx={{ p: 3, fontSize: 14, color: t.color.red }}>The chain did not answer. Try again in a moment.</Typography>}
              {s && (
                <Row onClick={() => pick({ kind: 'cash', mode: 'deposit' })}>
                  <Cell grow>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                      <Mark cash letter="$" />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>USDG</Typography>
                        <Typography noWrap sx={{ fontSize: 12, color: t.color.textMuted }}>{fmtQty(s.walletUsdg)} in your wallet · Spark Savings</Typography>
                      </Box>
                    </Box>
                  </Cell>
                  <Cell align="right" hide="xs" sx={{ fontWeight: 500 }}>{fmtUsd(s.walletUsdg)}</Cell>
                  <Cell align="right" sx={{ color: t.color.green, fontWeight: 500 }}>{s.apy.toFixed(2)}% APY</Cell>
                  <Cell align="right" hide="xs">
                    <Box component="span" sx={{ ...Vg, ml: 0, background: sel?.kind === 'cash' ? t.color.text : undefined, color: sel?.kind === 'cash' ? t.color.page : undefined }}>Earn</Box>
                  </Cell>
                </Row>
              )}
              {idle.data?.map((i) => (
                <Row key={i.stock.address} onClick={() => pick({ kind: 'stock', address: i.stock.address })}>
                  <Cell grow>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                      <Mark logo={i.stock.logo} letter={i.stock.ticker[0]} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>{i.stock.ticker}</Typography>
                        <Typography noWrap sx={{ fontSize: 12, color: t.color.textMuted }}>
                          {fmtQty(i.qty)} {i.stock.ticker} · {i.pool ? `${fmtFee(i.pool.fee)} ${quoteName(i.pool)} pool` : 'no pool yet'}
                        </Typography>
                      </Box>
                    </Box>
                  </Cell>
                  <Cell align="right" hide="xs" sx={{ fontWeight: 500 }}>{i.valueUsd ? fmtUsd(i.valueUsd) : '-'}</Cell>
                  <Cell align="right" sx={{ color: i.pool?.feeApr ? t.color.green : t.color.textMuted, fontWeight: 500 }}>{i.pool?.feeApr ? `${Math.round(i.pool.feeApr)}% fee APR` : i.pool ? 'pool, no volume' : '-'}</Cell>
                  <Cell align="right" hide="xs">
                    <Box component="span" sx={{ ...Vg, ml: 0, background: sel?.kind === 'stock' && sel.address === i.stock.address ? t.color.text : undefined, color: sel?.kind === 'stock' && sel.address === i.stock.address ? t.color.page : undefined }}>Put to work</Box>
                  </Cell>
                </Row>
              ))}
              {idle.data && idle.data.length === 0 && s && s.walletUsdg === 0 && <Typography sx={{ p: 3, fontSize: 14, color: t.color.textMuted }}>Nothing idle on Robinhood Chain. Bridge USDG or buy a tokenized stock and it will show here.</Typography>}
            </Panel>
          )}

          {account && (
            <Box sx={{ mt: { xs: 5, md: 7 } }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Working now</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{positions.data && s ? `${fmtUsd(working.reduce((a, p) => a + p.valueUsd, 0) + s.balance)} at work · fees ${fmtUsd(working.reduce((a, p) => a + p.feesUsd, 0))}` : positions.isLoading ? 'Reading the position manager…' : ''}</Typography>
              </Box>
              <Box sx={{ display: 'grid', gap: 2 }}>
                {s && s.shares > 0n && (
                  <Panel sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Mark cash letter="$" size={40} />
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                        Spark Savings USDG <StateDot state="earning" />
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>
                        {s.apy.toFixed(2)}% APY, accruing every second · {fmtQty(Number(s.shares) / 1e6)} spUSDG
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 18, fontWeight: 500 }}>{fmtUsd(s.balance)}</Typography>
                    <Button onClick={() => pick({ kind: 'cash', mode: 'withdraw' })} sx={{ ...Lt, backdropFilter: 'none', height: 36, px: 2 }}>
                      Withdraw
                    </Button>
                  </Panel>
                )}
                {working.map((p) => (
                  <WorkCard key={String(p.tokenId)} p={p} wallet={wallet} chain={chain} onChanged={refresh} />
                ))}
                {positions.data && working.length === 0 && s && s.shares === 0n && (
                  <Panel sx={{ p: 3 }}>
                    <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>Nothing at work yet. Pick a row above.</Typography>
                  </Panel>
                )}
              </Box>
            </Box>
          )}
        </Box>
        <Box id="yield-panel" sx={{ minWidth: 0 }}>
          {sel?.kind === 'stock' && selected && <StockPanel key={selected.stock.address} idle={selected} wallet={wallet} chain={chain} onDone={refresh} onClose={() => setSel(null)} />}
          {sel?.kind === 'cash' && s && <CashPanel key={sel.mode} savings={s} mode={sel.mode} wallet={wallet} chain={chain} onDone={refresh} onClose={() => setSel(null)} />}
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<WalletIcon size={20} />} title="See what is idle" text="Connect and the page reads every tokenized stock and the USDG your address holds on Robinhood Chain, with the pool or vault each one can earn in and the rate there today." />
          <Step n={2} icon={<TrendIcon size={20} />} title="Stocks: a band above the price" text="Pick +2%, +5% or +10%. Your shares go into a Uniswap v3 position that holds only the stock and sits just above the price. Nothing happens to them until the price rises into the band; inside it they earn the pool fee on every trade, and through it they are sold, at an average you see before you sign." />
          <Step n={3} icon={<PercentIcon size={20} />} title="Cash: Spark Savings" text="USDG goes into Spark Savings USDG, an ERC-4626 vault. You hold spUSDG, which is worth more USDG every second at the rate Spark sets. Withdraw any share of it whenever you like, with no lock and no exit fee." />
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
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Public contracts. Your wallet. Nothing in between.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            {BRAND.name} adds no contract and takes no fee here. Stocks go to the Uniswap v3 position manager at {POSITION_MANAGER.slice(0, 6)}…{POSITION_MANAGER.slice(-4)}, the same one the Uniswap app uses, and cash to the Spark Savings USDG vault at {SPARK_USDG.address.slice(0, 6)}…{SPARK_USDG.address.slice(-4)}. Both show up in those apps too, and either can be closed from here or there.
          </Typography>
          <Box component="a" href={SPARK_URL} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 2, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>
            Spark Savings <ExternalIcon size={12} />
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[
            [<TrendIcon size={18} />, 'A band is a sale you agreed to', 'If the stock climbs through the top of your band, you no longer hold it: you hold the quote, at the average price the band showed. Fees are earned on the way. If you would rather keep the shares at any price, keep them in the wallet.'],
            [<ShieldIcon size={18} />, 'Spark is a contract, not a bank', 'The vault is run by Spark and audited by them. Its rate moves when Spark moves it, and a deposit is exposed to that contract. There is no insurance.'],
            [<CheckIcon size={18} />, 'What you see is what you sign', 'Band edges, minimums, the deadline and the amounts are set here and shown in your wallet before you confirm. Fee APR is today at today\'s volume; the savings rate is the one the vault reports.'],
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
