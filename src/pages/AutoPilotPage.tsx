import { useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { fmtCompact, useAssets, useChains } from '../lib/api'
import { useClock } from '../lib/holding'
import { describeError, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, stockTokensOn, usePoolsOn, type Phase, type Pool, type StockToken } from '../lib/pools'
import { CADENCES, DEFAULT_SLIPPAGE_BPS, DEFAULT_TIP, PLAN_CHAINS, STATE_LABEL, UNLIMITED, budgetFor, cadenceFor, cancelPlan, createPlan, deepEnough, fmtStock, fmtUsdg, fmtWhen, planChain, poolFor, runNow, setAllowance, setPaused, useAllowance, usePlans, useTotals, type OnchainPlan, type PlanChain } from '../lib/autopilot'
import { EarlyGate } from '../components/EarlyGate'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { CalendarIcon, CheckIcon, ExternalIcon, LockIcon, PauseIcon, RefreshIcon, ShieldIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel, Stats } from './common'

const AMOUNTS = [25, 50, 100, 250]
const BUYS = [4, 12, 26, 52]
const FEATURED = ['NVDA', 'TSLA', 'SPY', 'AAPL', 'GOOGL', 'META', 'MSFT', 'AMZN', 'QQQ', 'SPCX']
type Ctx = ReturnType<typeof useWallet>

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
function Mark({ logo, letter, size = 44 }: { logo?: string; letter: string; size?: number }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Avatar src={resolveImg(logo)} sx={{ width: size * 0.64, height: size * 0.64, background: z.surface2, fontSize: 11, color: t.color.text }}>{letter}</Avatar>
    </Box>
  )
}
function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 13 }}>
      <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{k}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: strong ? 500 : 400, textAlign: 'right' }}>{v}</Typography>
    </Box>
  )
}

type Tx = { phase: Phase; error?: string; hash?: string }
const txCtx = (w: Ctx, chain: ChainX | undefined, onPhase: (p: Phase) => void) => ({ walletClient: w.walletClient!, account: w.account!, chain, switchChain: w.switchChain, onPhase })

function Composer({ pc, stocks, pools, loading, wallet, chain, onDone }: { pc: PlanChain; stocks: StockToken[]; pools: Pool[]; loading: boolean; wallet: Ctx; chain: ChainX | undefined; onDone: () => void }) {
  const [ticker, setTicker] = useState('NVDA')
  const [amount, setAmount] = useState('100')
  const [cadence, setCadence] = useState(CADENCES[1])
  const [buys, setBuys] = useState<number>(12)
  const [start, setStart] = useState<'now' | 'next'>('now')
  const [more, setMore] = useState(false)
  const [tx, setTx] = useState<Tx>({ phase: 'idle' })
  const stock = stocks.find((s) => s.ticker === ticker) ?? stocks[0]
  const pool = stock ? poolFor(stock, pools) : undefined
  const amt = Number(amount) > 0 ? parseUnits(Number(amount).toFixed(6), pc.quote.decimals) : 0n
  const budget = amt > 0n ? budgetFor(amt, DEFAULT_TIP, buys, 12, cadence.seconds) : 0n
  const allowance = useAllowance(pc, wallet.account?.address)
  const perMonth = Number(amount) * (buys === UNLIMITED ? cadence.perMonth : Math.min(cadence.perMonth, buys))
  const shares = pool && amt > 0n ? Number(amount) / pool.priceUsd : 0
  const list = useMemo(() => {
    const byTicker = new Map(stocks.map((s) => [s.ticker, s]))
    const featured = FEATURED.map((k) => byTicker.get(k)).filter((s): s is StockToken => !!s)
    const rest = stocks.filter((s) => !FEATURED.includes(s.ticker)).sort((a, b) => a.ticker.localeCompare(b.ticker))
    return more ? [...featured, ...rest] : featured
  }, [stocks, more])
  const busy = tx.phase !== 'idle' && tx.phase !== 'done' && tx.phase !== 'failed'
  const ready = !!wallet.account && !!stock && deepEnough(pool) && amt > 0n && !busy
  const go = async () => {
    if (!wallet.walletClient || !wallet.account || !stock || !pool) return
    setTx({ phase: 'switching' })
    try {
      const firstAt = start === 'now' ? 0 : Math.floor(Date.now() / 1000) + cadence.seconds
      const hash = await createPlan(txCtx(wallet, chain, (p) => setTx((x) => ({ ...x, phase: p }))), pc, { stock, pool, amount: amt, tip: DEFAULT_TIP, interval: cadence.seconds, firstAt, buys, slippageBps: DEFAULT_SLIPPAGE_BPS, budget })
      setTx({ phase: 'done', hash })
      onDone()
    } catch (e) {
      setTx({ phase: 'failed', error: describeError(e) })
    }
  }
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
      <Label>Buy</Label>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {list.map((s) => (
          <Choice key={s.address} on={s.ticker === stock?.ticker} onClick={() => setTicker(s.ticker)}>
            <Avatar src={resolveImg(s.logo)} sx={{ width: 16, height: 16, background: z.surface2, fontSize: 8 }}>{s.ticker[0]}</Avatar>
            {s.ticker}
          </Choice>
        ))}
        {stocks.length > 0 && <Choice on={false} onClick={() => setMore((m) => !m)}>{more ? 'Fewer' : `All ${stocks.length}`}</Choice>}
      </Box>
      {loading && stocks.length === 0 && <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.25 }}>Reading the stock pools on {pc.ic.name}…</Typography>}
      {stock && !deepEnough(pool) && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.25 }}>The {pc.quote.symbol} pool for {stock.ticker} is too thin to buy from on a schedule{pool ? ` (${fmtCompact(pool.liquidityUsd)} of liquidity)` : ''}. Pick another stock.</Typography>}
      {pool && deepEnough(pool) && <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.25 }}>{stock?.ticker} at {fmtUsdg(parseUnits(pool.priceUsd.toFixed(6), 6))} in the {pool.fee / 10_000}% {pc.quote.symbol} pool, {fmtCompact(pool.liquidityUsd)} of liquidity.</Typography>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, mt: 3 }}>
        <Box>
          <Label>Each buy, in {pc.quote.symbol}</Label>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>{AMOUNTS.map((a) => <Choice key={a} on={Number(amount) === a} onClick={() => setAmount(String(a))}>${a}</Choice>)}</Box>
          <InputBase value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Amount" inputProps={{ 'aria-label': 'Amount per buy', inputMode: 'decimal' }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 14 }} />
        </Box>
        <Box>
          <Label>How often</Label>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{CADENCES.map((c) => <Choice key={c.key} on={c.key === cadence.key} onClick={() => setCadence(c)}>{c.label}</Choice>)}</Box>
          <Label>
            <Box component="span" sx={{ display: 'block', mt: 2 }}>How many buys</Box>
          </Label>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {BUYS.map((b) => <Choice key={b} on={buys === b} onClick={() => setBuys(b)}>{b}</Choice>)}
            <Choice on={buys === UNLIMITED} onClick={() => setBuys(UNLIMITED)}>Until I stop it</Choice>
          </Box>
        </Box>
      </Box>
      <Box sx={{ mt: 2.5 }}>
        <Label>First buy</Label>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Choice on={start === 'now'} onClick={() => setStart('now')}>As soon as it is created</Choice>
          <Choice on={start === 'next'} onClick={() => setStart('next')}>{cadence.label.replace('Every ', 'In one ').replace('day', 'day').replace('two weeks', 'fortnight')}</Choice>
        </Box>
      </Box>

      <Box sx={{ mt: 3, p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 1 }}>
        <Row k="Each buy" v={amt > 0n && stock ? `${fmtUsdg(amt)} → about ${shares.toFixed(4)} ${stock.ticker}` : '…'} />
        <Row k="Per month" v={perMonth > 0 ? fmtUsdg(parseUnits(perMonth.toFixed(2), 6)) : '…'} />
        <Row k="Tip to whoever runs it" v={`${fmtUsdg(DEFAULT_TIP)} per buy, in ${pc.quote.symbol}`} />
        <Row k="Price floor" v={`${DEFAULT_SLIPPAGE_BPS / 100}% below the pool's spot price`} />
        <Row k="Allowance to approve" v={budget > 0n ? `${fmtUsdg(budget)}${buys === UNLIMITED ? ', one year of buys' : ''}` : '…'} strong />
        <Row k="Already approved" v={allowance.data ? fmtUsdg(allowance.data.allowance) : '…'} />
        <Row k={`${BRAND.name} fee`} v="None" />
      </Box>
      {allowance.data && amt > 0n && allowance.data.balance < amt + DEFAULT_TIP && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5 }}>Your wallet holds {fmtUsdg(allowance.data.balance)} {pc.quote.symbol}. A buy only runs while the balance covers it.</Typography>}
      <Button onClick={() => (wallet.account ? void go() : wallet.openWalletMenu())} disabled={!!wallet.account && !ready} sx={{ ...Bt, width: '100%', mt: 2.5, height: 44 }}>
        {!wallet.account ? 'Connect wallet' : busy ? PHASE_LABEL[tx.phase] : allowance.data && allowance.data.allowance >= budget ? 'Create the plan' : `Approve ${pc.quote.symbol} and create the plan`}
      </Button>
      {tx.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5 }}>{tx.error}</Typography>}
      {tx.phase === 'done' && tx.hash && chain && (
        <Box sx={{ mt: 2, p: 2, borderRadius: t.radius.panel, background: 'rgba(194,234,138,.10)', border: '1px solid rgba(194,234,138,.3)' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}><CheckIcon size={16} /> The plan is on the chain.</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>It runs from the allowance you approved, {start === 'now' ? 'starting within the next ten minutes' : `starting ${cadence.label.toLowerCase().replace('every', 'in one')}`}. Close the tab; it does not need you.</Typography>
          <Box component="a" href={`${pc.ic.explorer}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Transaction <ExternalIcon size={12} /></Box>
        </Box>
      )}
    </Panel>
  )
}

function PlanCard({ pc, p, wallet, chain, onChanged }: { pc: PlanChain; p: OnchainPlan; wallet: Ctx; chain: ChainX | undefined; onChanged: () => void }) {
  const [tx, setTx] = useState<Tx>({ phase: 'idle' })
  const now = useClock(p.state === 'active')
  const busy = tx.phase !== 'idle' && tx.phase !== 'done' && tx.phase !== 'failed'
  const act = async (fn: (ctx: ReturnType<typeof txCtx>) => Promise<string>) => {
    if (!wallet.walletClient || !wallet.account) return
    setTx({ phase: 'switching' })
    try {
      const hash = await fn(txCtx(wallet, chain, (ph) => setTx((x) => ({ ...x, phase: ph }))))
      setTx({ phase: 'done', hash })
      onChanged()
    } catch (e) {
      setTx({ phase: 'failed', error: describeError(e) })
    }
  }
  const due = p.state === 'active' && now > 0 && p.nextAt * 1000 <= now
  const dot = p.state === 'active' ? t.color.mark : p.state === 'paused' ? '#FFE866' : t.color.textFaint
  return (
    <Panel sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Mark logo={p.stock?.logo} letter={(p.stock?.ticker ?? '?')[0]} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
            {fmtUsdg(p.amountIn)} of {p.stock?.ticker ?? 'stock'} {cadenceFor(p.interval).toLowerCase()}
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
            <Box component="span" sx={{ fontSize: 12, color: t.color.textMuted, fontWeight: 400 }}>{STATE_LABEL[p.state]}</Box>
          </Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>
            {p.state === 'active' ? (due ? 'Due now, runs within ten minutes' : `Next ${fmtWhen(p.nextAt)}`) : p.state === 'paused' ? 'Nothing runs until you resume it' : 'No more buys'} · {p.buysDone} done{p.buysLeft === UNLIMITED ? '' : `, ${p.buysLeft} left`} · plan #{String(p.id)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 2 }}>
        {[['Spent', fmtUsdg(p.spent)], ['Received', `${fmtStock(p.received, p.stock?.decimals ?? 18)} ${p.stock?.ticker ?? ''}`], ['Next buy would get', `${fmtStock(p.quoteOut, p.stock?.decimals ?? 18)} ${p.stock?.ticker ?? ''}`]].map(([k, v]) => (
          <Box key={k} sx={{ p: 1.25, borderRadius: t.radius.input, background: t.color.raised, minWidth: 0 }}>
            <Typography sx={{ ...t.type.overline, color: t.color.textLabel }}>{k}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 500, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</Typography>
          </Box>
        ))}
      </Box>
      {(p.state === 'active' || p.state === 'paused') && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {p.state === 'active' && due && <Button disabled={busy} onClick={() => void act((c) => runNow(c, pc, p.id))} sx={{ ...Bt, height: 34, px: 1.75, gap: 0.75 }}><RefreshIcon size={13} /> Run now</Button>}
          <Button disabled={busy} onClick={() => void act((c) => setPaused(c, pc, p.id, p.state === 'active'))} sx={{ ...Lt, backdropFilter: 'none', height: 34, px: 1.75, gap: 0.75 }}>{p.state === 'active' ? <><PauseIcon size={13} /> Pause</> : <><RefreshIcon size={13} /> Resume</>}</Button>
          <Button disabled={busy} onClick={() => void act((c) => cancelPlan(c, pc, p.id))} sx={{ ...Lt, backdropFilter: 'none', height: 34, px: 1.75, color: t.color.red }}>Cancel</Button>
          {busy && <Typography sx={{ fontSize: 12, color: t.color.textMuted, alignSelf: 'center' }}>{PHASE_LABEL[tx.phase]}</Typography>}
        </Box>
      )}
      {tx.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1 }}>{tx.error}</Typography>}
    </Panel>
  )
}

export default function AutoPilotPage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: chains } = useChains()
  const [params, setParams] = useSearchParams()
  const pc = planChain(params.get('chain'))
  const DEPLOYED = pc.deployed
  const chain = chains?.find((c) => c.id === pc.ic.id) as ChainX | undefined
  const assets = useAssets()
  const pools = usePoolsOn(pc.ic, assets.data?.assets)
  const stocks = useMemo(() => (assets.data ? stockTokensOn(assets.data.assets, pc.ic.id).filter((s) => deepEnough(poolFor(s, pools.data ?? []))) : []), [assets.data, pools.data, pc.ic.id])
  const plans = usePlans(pc, account?.address, assets.data?.assets)
  const totals = useTotals(pc)
  const allowance = useAllowance(pc, account?.address)
  const qc = useQueryClient()
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['autopilot'] }); void qc.invalidateQueries({ queryKey: ['autopilot-allowance'] }); void qc.invalidateQueries({ queryKey: ['autopilot-totals'] }) }
  const [revoking, setRevoking] = useState<Tx>({ phase: 'idle' })
  const revoke = async () => {
    if (!wallet.walletClient || !account) return
    setRevoking({ phase: 'switching' })
    try { await setAllowance(txCtx(wallet, chain, (ph) => setRevoking((x) => ({ ...x, phase: ph }))), pc, 0n); setRevoking({ phase: 'done' }); refresh() } catch (e) { setRevoking({ phase: 'failed', error: describeError(e) }) }
  }
  const live = plans.data?.filter((p) => p.state === 'active' || p.state === 'paused') ?? []
  const past = plans.data?.filter((p) => p.state === 'finished' || p.state === 'cancelled') ?? []

  const page = (
    <Page>
      <PageHero
        label="Auto-Invest without you"
        badges={<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>{PLAN_CHAINS.map((c) => <Box key={c.key} component="button" type="button" onClick={() => setParams(c.key === 'robinhood' ? {} : { chain: c.key })} aria-pressed={c.key === pc.key} sx={{ all: 'unset', cursor: 'pointer', ...Vg, ml: 0, ...(c.key === pc.key && { background: t.color.text, color: t.color.page }) }}>{c.ic.name}</Box>)}<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>{DEPLOYED ? 'Live' : 'Contract not deployed'}</Box></Box>}
        title={<>It buys.<br />You do nothing.</>}
        lead={`A recurring buy of a tokenized stock on ${pc.ic.name} that runs while your wallet is closed. You approve a ${pc.quote.symbol} allowance once and set the plan. When a buy is due, a contract pulls one buy's worth, swaps it in the stock's ${pc.ic.dexName} pool, sends the stock to your wallet and pays a few cents to whoever ran it. It holds nothing between buys. Pause, resume, cancel or revoke the allowance at any time. No ${BRAND.name} fee.`}
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => (account ? document.getElementById('autopilot-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : openWalletMenu())} sx={{ ...Bt, gap: 1 }}>
              <CalendarIcon size={15} /> {account ? 'Set up a plan' : 'Connect wallet'}
            </Button>
            <Button component={Link} to="/auto-invest" sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
              <WalletIcon size={14} /> Auto-Invest on this device
            </Button>
          </Box>
        }
      />

      <Stats items={[{ label: 'Plans', value: totals.data ? totals.data.plans : DEPLOYED ? '…' : '0' }, { label: 'Running', value: totals.data ? totals.data.running : DEPLOYED ? '…' : '0' }, { label: 'Buys made', value: totals.data ? totals.data.buys : DEPLOYED ? '…' : '0' }, { label: `${pc.quote.symbol} invested`, value: totals.data ? fmtCompact(totals.data.spent) : DEPLOYED ? '…' : '$0' }]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>
        Read from the {BRAND.name} Auto-Invest contract on {pc.ic.name}{DEPLOYED ? <>, <Box component="a" href={`${pc.ic.explorer}/address/${pc.contract}`} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>{pc.contract.slice(0, 6)}…{pc.contract.slice(-4)}</Box></> : ''}. Buys run from the plan's own allowance; the contract never holds a balance.
      </Typography>

      {!DEPLOYED && (
        <Panel sx={{ mt: 5, p: { xs: 3, md: 4 } }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>The contract is not on the chain yet.</Typography>
          <Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 0.75 }}>The code is in the repository. Plans open here on {pc.ic.name} the moment it is deployed.</Typography>
        </Panel>
      )}

      <Box id="autopilot" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 440px' }, gap: 2.5, mt: { xs: 5, md: 7 }, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Your plans</Typography>
            {account && allowance.data && <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>Allowance {fmtUsdg(allowance.data.allowance)} · wallet {fmtUsdg(allowance.data.balance)} {pc.quote.symbol}</Typography>}
          </Box>
          {!account ? (
            <Panel sx={{ p: { xs: 3, md: 4 }, display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Connect to see your plans.</Typography>
                <Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 0.75 }}>Plans live in the contract, under your address. Any device, any wallet app, the same plans.</Typography>
              </Box>
              <Button onClick={openWalletMenu} sx={{ ...Bt, gap: 1 }}><WalletIcon size={14} /> Connect</Button>
            </Panel>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {live.map((p) => <PlanCard key={String(p.id)} pc={pc} p={p} wallet={wallet} chain={chain} onChanged={refresh} />)}
              {plans.data && live.length === 0 && (
                <Panel sx={{ p: 3 }}><Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{DEPLOYED ? 'No plan running. Set one up on the right.' : 'Plans open once the contract is deployed.'}</Typography></Panel>
              )}
              {past.length > 0 && <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mt: 1 }}>Finished</Typography>}
              {past.map((p) => <PlanCard key={String(p.id)} pc={pc} p={p} wallet={wallet} chain={chain} onChanged={refresh} />)}
              {allowance.data && allowance.data.allowance > 0n && (
                <Panel sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 220 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 500 }}>The contract may pull up to {fmtUsdg(allowance.data.allowance)} {pc.quote.symbol}.</Typography>
                    <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>That is the allowance you approved, and the most it can ever take. Revoking it stops every plan at once.</Typography>
                  </Box>
                  <Button disabled={revoking.phase !== 'idle' && revoking.phase !== 'done' && revoking.phase !== 'failed'} onClick={() => void revoke()} sx={{ ...Lt, backdropFilter: 'none', height: 36, px: 2 }}>Revoke allowance</Button>
                  {revoking.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red, width: '100%' }}>{revoking.error}</Typography>}
                </Panel>
              )}
            </Box>
          )}
        </Box>
        <Box id="autopilot-composer" sx={{ minWidth: 0, scrollMarginTop: 96 }}>
          {DEPLOYED ? <Composer pc={pc} stocks={stocks} pools={pools.data ?? []} loading={pools.isLoading || assets.isLoading} wallet={wallet} chain={chain} onDone={refresh} /> : null}
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<LockIcon size={20} />} title="Approve a budget" text={`You approve the contract to spend an exact amount of ${pc.quote.symbol}: the buys you asked for, plus the tips. Never unlimited. The allowance is the most it can ever pull, and you can cut it to zero at any time from here or from any wallet.`} />
          <Step n={2} icon={<CalendarIcon size={20} />} title="A buy comes due" text={`${BRAND.name}'s executor, which runs every ten minutes from the server that serves this site, or you, calls the contract. It pulls one buy's worth, swaps it in the stock's ${pc.quote.symbol} pool on ${pc.ic.dexName}, sends the stock to your wallet and the tip to the executor. If the pool's price is more than your floor away from spot, the buy waits.`} />
          <Step n={3} icon={<ShieldIcon size={20} />} title="Nothing sits in the contract" text="Tokens pass through inside one transaction. Between buys the contract holds nothing of yours, and no admin can move a plan, change it or touch your allowance. The code is open and verified on the explorer." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}><MarkIcon size={22} /></Box>
            <Box sx={{ ...Vg, ml: 0 }}>The first {BRAND.name} contract</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Small on purpose.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            Every other {BRAND.name} feature calls contracts other people wrote. This one could not: a buy that runs while you are away needs someone to run it, and a contract to make sure that someone can only do what you set. It is two hundred lines, holds no balance, takes no fee, and the only thing its admin can do is keep the list of who may run plans. Anyone on that list runs your plan exactly as you wrote it or not at all.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            {DEPLOYED && <Box component="a" href={`${pc.ic.explorer}/address/${pc.contract}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Contract on the explorer <ExternalIcon size={12} /></Box>}
            <Box component="a" href="https://github.com/useverdex/verdex/blob/main/contracts/VerdexAutoInvest.sol" target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Source <ExternalIcon size={12} /></Box>
            <Box component={Link} to="/docs#auto-invest-without-you" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Docs</Box>
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[
            [<LockIcon size={18} />, 'The allowance is the limit', 'The contract can pull what you approved and not a cent more. Revoke it and every plan stops, whatever anyone does.'],
            [<ShieldIcon size={18} />, 'A price floor on every buy', 'Each buy must return at least spot less your slippage, read from the pool in the same transaction. A manipulated pool makes the buy wait, not fill badly.'],
            [<CheckIcon size={18} />, 'Unaudited, and small', 'No third party has audited this contract. It is short enough to read in ten minutes, tested on a fork of the chain, and the source is in the repository with the compiled bytecode.'],
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
  return pc.key === 'base' ? <EarlyGate path="/auto-invest/without-you/base">{page}</EarlyGate> : page
}
