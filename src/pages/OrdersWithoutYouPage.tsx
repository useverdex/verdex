// Orders without you: limit and stop orders that live in a contract on Robinhood Chain and fill while the
// owner is away. The page places orders, lists them with their live trigger state, and cancels them.
import { useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { fmtCompact, fmtUsd, useAssets, useChains } from '../lib/api'
import { describeError, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, stockTokensOn, usePoolsOn, type Phase, type Pool, type StockToken } from '../lib/pools'
import { DEFAULT_SLIPPAGE_BPS, DEFAULT_TIP, KINDS, ORDERS_CHAINS, STATUS_LABEL, cancelOrder, deepEnough, fillNow, fmtStock, fmtUsdg, fmtWhen, ordersChain, placeOrder, poolFor, useOrders, useOrdersWallet, useTotals, type Kind, type OnchainOrder, type OrdersChain } from '../lib/ordersOnchain'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { EarlyGate } from '../components/EarlyGate'
import { CheckIcon, ExternalIcon, LockIcon, ShieldIcon, TargetIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel, Stats } from './common'

const AMOUNTS = [25, 50, 100, 250]
const FEATURED = ['NVDA', 'TSLA', 'SPY', 'AAPL', 'GOOGL', 'META', 'MSFT', 'AMZN', 'QQQ', 'SPCX']
const EXPIRIES: { key: string; label: string; seconds: number }[] = [{ key: 'none', label: 'Until I cancel', seconds: 0 }, { key: 'day', label: 'One day', seconds: 86_400 }, { key: 'week', label: 'One week', seconds: 604_800 }, { key: 'month', label: 'One month', seconds: 2_592_000 }]
type Ctx = ReturnType<typeof useWallet>
type Tx = { phase: Phase; error?: string; hash?: string }
const txCtx = (w: Ctx, chain: ChainX | undefined, onPhase: (p: Phase) => void) => ({ walletClient: w.walletClient!, account: w.account!, chain, switchChain: w.switchChain, onPhase })

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
const kindOf = (k: Kind) => KINDS.find((x) => x.key === k)!

function Composer({ oc, stocks, pools, loading, wallet, chain, onDone }: { oc: OrdersChain; stocks: StockToken[]; pools: Pool[]; loading: boolean; wallet: Ctx; chain: ChainX | undefined; onDone: () => void }) {
  const [ticker, setTicker] = useState('NVDA')
  const [kind, setKind] = useState<Kind>('limit-buy')
  const [amount, setAmount] = useState('100')
  const [level, setLevel] = useState('')
  const [expiry, setExpiry] = useState(EXPIRIES[0])
  const [more, setMore] = useState(false)
  const [tx, setTx] = useState<Tx>({ phase: 'idle' })
  const stock = stocks.find((s) => s.ticker === ticker) ?? stocks[0]
  const pool = stock ? poolFor(stock, pools) : undefined
  const k = kindOf(kind)
  const w = useOrdersWallet(oc, wallet.account?.address, stock ? [stock] : [])
  const list = useMemo(() => {
    const byTicker = new Map(stocks.map((s) => [s.ticker, s]))
    const featured = FEATURED.map((x) => byTicker.get(x)).filter((s): s is StockToken => !!s)
    const rest = stocks.filter((s) => !FEATURED.includes(s.ticker)).sort((a, b) => a.ticker.localeCompare(b.ticker))
    return more ? [...featured, ...rest] : featured
  }, [stocks, more])
  const price = pool?.priceUsd ?? 0
  const lvl = Number(level) > 0 ? Number(level) : 0
  // Presets around the current price: 5% and 10% either side, in the direction the order kind needs.
  const presets = price > 0 ? (k.below ? [0.98, 0.95, 0.9, 0.8] : [1.02, 1.05, 1.1, 1.2]).map((m) => Math.round(price * m * 100) / 100) : []
  const amt = Number(amount) > 0 ? (k.side === 'buy' ? parseUnits(Number(amount).toFixed(6), oc.quote.decimals) : parseUnits(Number(amount).toFixed(stock?.decimals ?? 18), stock?.decimals ?? 18)) : 0n
  const wrongSide = price > 0 && lvl > 0 && (k.below ? lvl >= price : lvl <= price)
  const bal = stock && w.data ? (k.side === 'buy' ? w.data.usdg : (w.data.tokens[stock.address.toLowerCase()]?.balance ?? 0n)) : undefined
  const need = k.side === 'buy' ? amt + DEFAULT_TIP : amt
  const short = bal !== undefined && amt > 0n && bal < need
  const busy = tx.phase !== 'idle' && tx.phase !== 'done' && tx.phase !== 'failed'
  const ready = !!wallet.account && !!stock && !!pool && deepEnough(pool) && amt > 0n && lvl > 0 && !wrongSide && !busy
  const units = k.side === 'buy' && lvl > 0 ? Number(amount) / lvl : 0
  const go = async () => {
    if (!wallet.walletClient || !wallet.account || !stock || !pool) return
    setTx({ phase: 'switching' })
    try {
      const expiresAt = expiry.seconds ? Math.floor(Date.now() / 1000) + expiry.seconds : 0
      const hash = await placeOrder(txCtx(wallet, chain, (p) => setTx((x) => ({ ...x, phase: p }))), oc, { stock, pool, kind, levelUsd: lvl, amountIn: amt, tip: DEFAULT_TIP, slippageBps: DEFAULT_SLIPPAGE_BPS, expiresAt })
      setTx({ phase: 'done', hash })
      onDone()
    } catch (e) {
      setTx({ phase: 'failed', error: describeError(e) })
    }
  }
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
      <Label>Order</Label>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {KINDS.map((x) => <Choice key={x.key} on={x.key === kind} onClick={() => { setKind(x.key); setLevel(''); setTx({ phase: 'idle' }) }}>{x.label}</Choice>)}
      </Box>
      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.25 }}>{k.blurb}</Typography>
      <Box sx={{ mt: 2.5 }}>
        <Label>Stock</Label>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {list.map((s) => (
            <Choice key={s.address} on={s.ticker === stock?.ticker} onClick={() => { setTicker(s.ticker); setLevel('') }}>
              <Avatar src={resolveImg(s.logo)} sx={{ width: 16, height: 16, background: z.surface2, fontSize: 8 }}>{s.ticker[0]}</Avatar>
              {s.ticker}
            </Choice>
          ))}
          {stocks.length > 0 && <Choice on={false} onClick={() => setMore((m) => !m)}>{more ? 'Fewer' : `All ${stocks.length}`}</Choice>}
        </Box>
        {loading && stocks.length === 0 && <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.25 }}>Reading the stock pools on {oc.ic.name}…</Typography>}
        {stock && !deepEnough(pool) && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.25 }}>The {oc.quote.symbol} pool for {stock.ticker} is too thin to fill from{pool ? ` (${fmtCompact(pool.liquidityUsd)} of liquidity)` : ''}. Pick another stock.</Typography>}
        {pool && deepEnough(pool) && <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.25 }}>{stock?.ticker} at {fmtUsd(price)} now, in the {pool.fee / 10_000}% {oc.quote.symbol} pool, {fmtCompact(pool.liquidityUsd)} of liquidity.</Typography>}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, mt: 3 }}>
        <Box>
          <Label>{k.side === 'buy' ? `Spend, in ${oc.quote.symbol}` : `Sell, in ${stock?.ticker ?? 'shares'}`}</Label>
          {k.side === 'buy' && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>{AMOUNTS.map((a) => <Choice key={a} on={Number(amount) === a} onClick={() => setAmount(String(a))}>${a}</Choice>)}</Box>}
          {k.side === 'sell' && bal !== undefined && stock && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>{[25, 50, 100].map((p) => <Choice key={p} on={false} onClick={() => setAmount(((Number(bal) / 10 ** stock.decimals) * p / 100).toFixed(6).replace(/\.?0+$/, ''))}>{p}%</Choice>)}</Box>}
          <InputBase value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Amount" inputProps={{ 'aria-label': 'Amount', inputMode: 'decimal' }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 14 }} />
        </Box>
        <Box>
          <Label>{k.below ? 'When the price is at or below' : 'When the price is at or above'}</Label>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>{presets.map((p) => <Choice key={p} on={Number(level) === p} onClick={() => setLevel(String(p))}>${p.toLocaleString('en-US')}</Choice>)}</Box>
          <InputBase value={level} onChange={(e) => setLevel(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={price > 0 ? `$ price, now ${fmtUsd(price)}` : '$ price'} inputProps={{ 'aria-label': 'Price level', inputMode: 'decimal' }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 14 }} />
          {wrongSide && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 0.75 }}>{k.below ? 'That is above the price now; the order would fill at once. Use "' + (k.side === 'buy' ? 'Buy above' : 'Sell above') + '" or a lower level.' : 'That is below the price now; the order would fill at once. Use "' + (k.side === 'buy' ? 'Buy below' : 'Stop, sell below') + '" or a higher level.'}</Typography>}
        </Box>
      </Box>
      <Box sx={{ mt: 2.5 }}>
        <Label>Good for</Label>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{EXPIRIES.map((x) => <Choice key={x.key} on={x.key === expiry.key} onClick={() => setExpiry(x)}>{x.label}</Choice>)}</Box>
      </Box>
      <Box sx={{ mt: 3, p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 1 }}>
        <Row k="The order" v={stock && amt > 0n && lvl > 0 ? (k.side === 'buy' ? `${fmtUsdg(amt)} of ${stock.ticker} at ${fmtUsd(lvl)} or ${k.below ? 'lower' : 'higher'}` : `${amount} ${stock.ticker} at ${fmtUsd(lvl)} or ${k.below ? 'lower' : 'higher'}`) : '…'} strong />
        {k.side === 'buy' && <Row k="About" v={units > 0 && stock ? `${units.toFixed(4)} ${stock.ticker} at that price` : '…'} />}
        <Row k="Fill price floor" v={`${DEFAULT_SLIPPAGE_BPS / 100}% below the pool's spot, read at fill time`} />
        <Row k="Tip to whoever fills it" v={`${fmtUsdg(DEFAULT_TIP)} in ${oc.quote.symbol}${k.side === 'sell' ? ', from the proceeds' : ''}`} />
        <Row k="Allowance to approve" v={stock && amt > 0n ? (k.side === 'buy' ? `${fmtUsdg(need)}, exact` : `${amount} ${stock.ticker}, exact`) : '…'} />
        <Row k={`${BRAND.name} fee`} v="None" />
      </Box>
      {short && stock && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5 }}>Your wallet holds {k.side === 'buy' ? fmtUsdg(bal!) + ' ' + oc.quote.symbol : fmtStock(bal!, stock.decimals) + ' ' + stock.ticker}. The order only fills while the balance covers it.</Typography>}
      <Button onClick={() => (wallet.account ? void go() : wallet.openWalletMenu())} disabled={!!wallet.account && !ready} sx={{ ...Bt, width: '100%', mt: 2.5, height: 44 }}>
        {!wallet.account ? 'Connect wallet' : busy ? PHASE_LABEL[tx.phase] : `Approve and place the ${k.side === 'buy' ? 'buy' : 'sell'}`}
      </Button>
      {tx.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5 }}>{tx.error}</Typography>}
      {tx.phase === 'done' && tx.hash && (
        <Box sx={{ mt: 2, p: 2, borderRadius: t.radius.panel, background: 'rgba(194,234,138,.10)', border: '1px solid rgba(194,234,138,.3)' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}><CheckIcon size={16} /> The order is on the chain.</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>It fills from the allowance you approved, within ten minutes of the pool crossing your level. Close the tab; it does not need you.</Typography>
          <Box component="a" href={`${oc.ic.explorer}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Transaction <ExternalIcon size={12} /></Box>
        </Box>
      )}
    </Panel>
  )
}

function OrderCard({ oc, o, wallet, chain, onChanged }: { oc: OrdersChain; o: OnchainOrder; wallet: Ctx; chain: ChainX | undefined; onChanged: () => void }) {
  const [tx, setTx] = useState<Tx>({ phase: 'idle' })
  const busy = tx.phase !== 'idle' && tx.phase !== 'done' && tx.phase !== 'failed'
  const act = async (fn: (ctx: ReturnType<typeof txCtx>) => Promise<string>) => {
    if (!wallet.walletClient || !wallet.account) return
    setTx({ phase: 'switching' })
    try { const hash = await fn(txCtx(wallet, chain, (ph) => setTx((x) => ({ ...x, phase: ph })))); setTx({ phase: 'done', hash }); onChanged() } catch (e) { setTx({ phase: 'failed', error: describeError(e) }) }
  }
  const k = kindOf(o.kind)
  const dec = o.stock?.decimals ?? 18
  const dot = o.status === 'open' ? (o.triggered ? '#FFE866' : t.color.mark) : o.status === 'filled' ? t.color.mark : t.color.textFaint
  const title = o.side === 'buy' ? `${fmtUsdg(o.amountIn)} of ${o.stock?.ticker ?? 'stock'} at ${fmtUsd(o.levelUsd)} or ${k.below ? 'lower' : 'higher'}` : `Sell ${fmtStock(o.amountIn, dec)} ${o.stock?.ticker ?? 'stock'} at ${fmtUsd(o.levelUsd)} or ${k.below ? 'lower' : 'higher'}`
  const sub = o.status === 'open' ? (o.triggered ? 'At the level now, fills within ten minutes' : `Waiting · ${o.stock?.ticker ?? ''} at ${o.pool ? fmtUsd(o.pool.priceUsd) : '…'} now`) : o.status === 'filled' ? `Filled ${fmtWhen(o.filledAt)}` : STATUS_LABEL[o.status]
  return (
    <Panel sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Mark logo={o.stock?.logo} letter={(o.stock?.ticker ?? '?')[0]} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {title}
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
            <Box component="span" sx={{ fontSize: 12, color: t.color.textMuted, fontWeight: 400 }}>{k.label} · {STATUS_LABEL[o.status]}</Box>
          </Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{sub}{o.expiresAt ? ` · good until ${fmtWhen(o.expiresAt)}` : ''} · order #{String(o.id)}</Typography>
        </Box>
      </Box>
      {o.status === 'filled' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mt: 2 }}>
          {[[o.side === 'buy' ? 'Spent' : 'Sold', o.side === 'buy' ? fmtUsdg(o.amountIn) : `${fmtStock(o.amountIn, dec)} ${o.stock?.ticker ?? ''}`], ['Received', o.side === 'buy' ? `${fmtStock(o.received, dec)} ${o.stock?.ticker ?? ''}` : fmtUsdg(o.received)]].map(([kk, v]) => (
            <Box key={kk} sx={{ p: 1.25, borderRadius: t.radius.input, background: t.color.raised, minWidth: 0 }}>
              <Typography sx={{ ...t.type.overline, color: t.color.textLabel }}>{kk}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 500, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</Typography>
            </Box>
          ))}
        </Box>
      )}
      {o.status === 'open' && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {o.triggered && <Button disabled={busy} onClick={() => void act((c) => fillNow(c, oc, o.id))} sx={{ ...Bt, height: 34, px: 1.75, gap: 0.75 }}><TargetIcon size={13} /> Fill now</Button>}
          <Button disabled={busy} onClick={() => void act((c) => cancelOrder(c, oc, o.id))} sx={{ ...Lt, backdropFilter: 'none', height: 34, px: 1.75, color: t.color.red }}>Cancel</Button>
          {busy && <Typography sx={{ fontSize: 12, color: t.color.textMuted, alignSelf: 'center' }}>{PHASE_LABEL[tx.phase]}</Typography>}
        </Box>
      )}
      {tx.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1 }}>{tx.error}</Typography>}
    </Panel>
  )
}

export default function OrdersWithoutYouPage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: chains } = useChains()
  const [params, setParams] = useSearchParams()
  const oc = ordersChain(params.get('chain'))
  const chain = chains?.find((c) => c.id === oc.ic.id) as ChainX | undefined
  const assets = useAssets()
  const pools = usePoolsOn(oc.ic, assets.data?.assets)
  const stocks = useMemo(() => (assets.data ? stockTokensOn(assets.data.assets, oc.ic.id).filter((s) => deepEnough(poolFor(s, pools.data ?? []))) : []), [assets.data, pools.data, oc.ic.id])
  const orders = useOrders(oc, account?.address, assets.data?.assets, pools.data)
  const totals = useTotals(oc)
  const DEPLOYED = oc.deployed
  const qc = useQueryClient()
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['orders-onchain'] }); void qc.invalidateQueries({ queryKey: ['orders-onchain-wallet'] }); void qc.invalidateQueries({ queryKey: ['orders-onchain-totals'] }) }
  const open = orders.data?.filter((o) => o.status === 'open') ?? []
  const past = orders.data?.filter((o) => o.status !== 'open') ?? []
  // The Base contract opens on its own date; holders see it first, like every box.
  const page = (
    <Page>
      <PageHero
        label="Orders without you"
        badges={<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>{ORDERS_CHAINS.map((c) => <Box key={c.key} component="button" type="button" onClick={() => setParams(c.key === 'robinhood' ? {} : { chain: c.key })} aria-pressed={c.key === oc.key} sx={{ all: 'unset', cursor: 'pointer', ...Vg, ml: 0, ...(c.key === oc.key && { background: t.color.text, color: t.color.page }) }}>{c.ic.name}</Box>)}<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>{DEPLOYED ? 'Live' : 'Contract not deployed'}</Box></Box>}
        title={<>Set the level.<br />Close the tab.</>}
        lead={`A limit or a stop on a tokenized stock that lives in a contract on ${oc.ic.name} and fills while your wallet is closed. You approve an exact allowance and name a price. When the stock's pool crosses it, the contract pulls the amount, swaps it in that pool, sends the proceeds to your wallet and pays a few cents to whoever filled it. A price floor read from the pool in the same transaction; nothing held between orders; no fee.`}
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => (account ? document.getElementById('orders-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : openWalletMenu())} sx={{ ...Bt, gap: 1 }}>
              <TargetIcon size={15} /> {account ? 'Place an order' : 'Connect wallet'}
            </Button>
            <Button component={Link} to="/orders" sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
              <WalletIcon size={14} /> Orders on this device
            </Button>
          </Box>
        }
      />

      <Stats items={[{ label: 'Orders placed', value: totals.data ? totals.data.orders : DEPLOYED ? '…' : '0' }, { label: 'Open', value: totals.data ? totals.data.open : DEPLOYED ? '…' : '0' }, { label: 'Filled', value: totals.data ? totals.data.filled : DEPLOYED ? '…' : '0' }, { label: `${BRAND.name} fee`, value: '0%' }]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>
        Read from the {BRAND.name} Orders contract on {oc.ic.name}{DEPLOYED ? <>, <Box component="a" href={`${oc.ic.explorer}/address/${oc.contract}`} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>{oc.contract.slice(0, 6)}…{oc.contract.slice(-4)}</Box></> : ''}. Levels are kept as the pool's own price; the executor checks every order every ten minutes.
      </Typography>

      {!DEPLOYED && (
        <Panel sx={{ mt: 5, p: { xs: 3, md: 4 } }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>The contract is not on the chain yet.</Typography>
          <Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 0.75 }}>The code is in the repository. Orders open here on {oc.ic.name} the moment it is deployed.</Typography><Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 0.75 }}></Typography>
        </Panel>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 440px' }, gap: 2.5, mt: { xs: 5, md: 7 }, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mb: 2 }}>Your orders</Typography>
          {!account ? (
            <Panel sx={{ p: { xs: 3, md: 4 }, display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Connect to see your orders.</Typography>
                <Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 0.75 }}>Orders live in the contract, under your address. Any device, any wallet app, the same orders.</Typography>
              </Box>
              <Button onClick={openWalletMenu} sx={{ ...Bt, gap: 1 }}><WalletIcon size={14} /> Connect</Button>
            </Panel>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {open.map((o) => <OrderCard key={String(o.id)} oc={oc} o={o} wallet={wallet} chain={chain} onChanged={refresh} />)}
              {orders.data && open.length === 0 && <Panel sx={{ p: 3 }}><Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{DEPLOYED ? 'No open order. Place one on the right.' : 'Orders open once the contract is deployed.'}</Typography></Panel>}
              {past.length > 0 && <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mt: 1 }}>Filled, cancelled, expired</Typography>}
              {past.map((o) => <OrderCard key={String(o.id)} oc={oc} o={o} wallet={wallet} chain={chain} onChanged={refresh} />)}
            </Box>
          )}
        </Box>
        <Box id="orders-composer" sx={{ minWidth: 0, scrollMarginTop: 96 }}>
          {DEPLOYED ? <Composer oc={oc} stocks={stocks} pools={pools.data ?? []} loading={pools.isLoading || assets.isLoading} wallet={wallet} chain={chain} onDone={refresh} /> : null}
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<LockIcon size={20} />} title="An exact allowance" text={`You approve the contract for exactly what the order may pull: the ${oc.quote.symbol} of a buy plus the tip, or the shares of a sell. Never unlimited. Revoke it and every order stops, whatever anyone does.`} />
          <Step n={2} icon={<TargetIcon size={20} />} title="The pool crosses your level" text={`${BRAND.name}'s executor checks every order every ten minutes against the stock's own ${oc.ic.dexName} pool. At or past your level, it fills the order: one swap in that pool, proceeds to your wallet, a few cents of ${oc.quote.symbol} to the executor. You can fill a triggered order yourself too.`} />
          <Step n={3} icon={<ShieldIcon size={20} />} title="A floor, read at fill time" text="Every fill must return at least the pool's spot price less 1%, read in the same transaction. A manipulated pool makes the fill wait, not fill badly. The contract holds nothing between orders and no admin can touch one." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}><MarkIcon size={22} /></Box>
            <Box sx={{ ...Vg, ml: 0 }}>Phase 2, box 7</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>The Auto-Invest pattern, applied to orders.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            Orders on this device needed your tab open to notice the price and your tap to fill. These do not: the level lives in the contract as the pool's own price, the executor that already runs Auto-Invest checks it, and the fill is one swap with a floor. The contract is two hundred lines, holds no balance, takes no fee, and its admin can only keep the executor list. Unaudited; read it before you trust it with more than you would lose.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            {DEPLOYED && <Box component="a" href={`${oc.ic.explorer}/address/${oc.contract}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Contract on the explorer <ExternalIcon size={12} /></Box>}
            <Box component="a" href={`https://github.com/useverdex/verdex/blob/main/contracts/${oc.source}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Source <ExternalIcon size={12} /></Box>
            <Box component={Link} to="/docs#orders-without-you" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Docs</Box>
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[
            [<LockIcon key="a" size={18} />, 'The allowance is the limit', 'The contract can pull what you approved for that order and not a cent more.'],
            [<ShieldIcon key="b" size={18} />, 'Two prices, one transaction', 'Your level decides when; the pool\'s spot less 1% decides the least you accept. Both are read from the pool at fill time.'],
            [<CheckIcon key="c" size={18} />, 'Unaudited, and small', 'No third party has audited this contract. It is short enough to read, tested on a fork of the chain, and the source is in the repository with the compiled bytecode.'],
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
  return oc.key === 'base' ? <EarlyGate path="/orders/without-you/base">{page}</EarlyGate> : page
}
