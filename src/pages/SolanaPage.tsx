// Verdex on Solana: baskets of xStocks bought and sold through Jupiter, every leg signed in one prompt.
import { useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { CHAIN_NAME_LOGOS, fmtCompact, fmtUsd, useAssets } from '../lib/api'
import { resolveImg } from '../lib/img'
import { BASKETS, FEE_BPS, MAX_IMPACT_PCT, SLIPPAGE_BPS, TRADE_LABEL, baskets, buyBasket, feeFor, feeWallet, fmtQty8, fmtUsdc, sellBasket, solStocks, solscanToken, solscanTx, usePrices, useSolWalletState, type BasketInfo, type Progress } from '../lib/solana'
import { connectSol, disconnectSol, useSolWallet } from '../lib/sol/wallet'
import { CheckIcon, ExternalIcon, LayersIcon, LockIcon, PieIcon, ShieldIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel, Stats } from './common'

const AMOUNTS = [25, 100, 250, 1000]
const idle: Progress = { phase: 'idle', sent: 0, total: 0, sigs: [] }

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
function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 13 }}>
      <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{k}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: strong ? 500 : 400, textAlign: 'right' }}>{v}</Typography>
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
function Sigs({ p }: { p: Progress }) {
  if (!p.sigs.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
      {p.sigs.map((s, i) => <Box key={s} component="a" href={solscanTx(s)} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, color: t.color.text, textDecoration: 'none' }}>Leg {i + 1} <ExternalIcon size={11} /></Box>)}
    </Box>
  )
}

function BasketCard({ b, selected, onPick }: { b: BasketInfo; selected: boolean; onPick: (side: 'buy' | 'sell') => void }) {
  return (
    <Panel sx={{ p: 2.5, borderColor: selected ? 'rgba(194,234,138,.45)' : undefined }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark, flexShrink: 0 }}><PieIcon size={20} /></Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>{b.name}<Box component="span" sx={{ fontSize: 12, color: t.color.textMuted, fontWeight: 400 }}>{b.symbol}</Box></Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{b.blurb} {b.legs.length} stocks, equal weight, bought in {b.legs.length} legs.</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{b.heldUsd > 0 ? fmtUsd(b.heldUsd) : '0'}</Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>in your wallet</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
        {b.legs.map((l) => (
          <Box key={l.stock.mint} component="a" href={solscanToken(l.stock.mint)} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 28, px: 1.25, borderRadius: t.radius.input, background: t.color.hover, fontSize: 12, fontWeight: 500, color: t.color.text, textDecoration: 'none' }}>
            <Avatar src={resolveImg(l.stock.logo)} sx={{ width: 16, height: 16, background: z.surface2, fontSize: 8 }}>{l.stock.ticker[0]}</Avatar>
            {l.stock.symbol}
            <Box component="span" sx={{ color: t.color.textMuted, fontWeight: 400 }}>{fmtUsd(l.priceUsd, l.priceUsd >= 100 ? 0 : 2)}{l.held > 0n ? ` · ${fmtQty8(l.held, l.stock.decimals)}` : ''}</Box>
          </Box>
        ))}
        {b.missing.map((m) => <Box key={m} sx={{ display: 'inline-flex', alignItems: 'center', height: 28, px: 1.25, borderRadius: t.radius.input, background: t.color.hover, fontSize: 12, color: t.color.red }}>{m}: no price</Box>)}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, alignItems: 'center' }}>
        <Button disabled={!b.tradable} onClick={() => onPick('buy')} sx={{ ...Bt, height: 34, px: 1.75 }}>Buy</Button>
        <Button disabled={!b.tradable || b.heldUsd <= 0} onClick={() => onPick('sell')} sx={{ ...Lt, backdropFilter: 'none', height: 34, px: 1.75 }}>Sell</Button>
        <Typography sx={{ ml: 'auto', fontSize: 12, color: t.color.textMuted }}>thinnest pool {fmtCompact(Math.min(...b.legs.map((l) => l.liquidityUsd)))}</Typography>
      </Box>
      {!b.tradable && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1 }}>One of the stocks has no price or too thin a market on Solana right now.</Typography>}
    </Panel>
  )
}

function Composer({ list, b, side, setB, setSide, owner, usdc, onDone, connect }: { list: BasketInfo[]; b: BasketInfo | undefined; side: 'buy' | 'sell'; setB: (s: string) => void; setSide: (s: 'buy' | 'sell') => void; owner: ReturnType<typeof useSolWallet>['connected']; usdc: bigint; onDone: () => void; connect: () => void }) {
  const [amount, setAmount] = useState('100')
  const [pct, setPct] = useState(100)
  const [p, setP] = useState<Progress>(idle)
  const [err, setErr] = useState<string>()
  const amt = Number(amount) > 0 ? BigInt(Math.round(Number(amount) * 1e6)) : 0n
  const fee = feeFor(amt)
  const busy = p.phase !== 'idle' && p.phase !== 'done' && p.phase !== 'failed'
  const short = side === 'buy' && owner && amt > usdc
  const ready = !!owner && !!b && b.tradable && !busy && (side === 'buy' ? amt > 0n && !short : b.heldUsd > 0)
  const go = async () => {
    if (!owner || !b) return
    setErr(undefined); setP({ ...idle, phase: 'quoting' })
    try {
      if (side === 'buy') await buyBasket(owner.publicKey, b, amt, setP)
      else await sellBasket(owner.publicKey, b, pct, setP)
      onDone()
    } catch (e) {
      setErr((e as Error).message?.slice(0, 240) ?? 'Something went wrong.')
      setP((x) => ({ ...x, phase: 'failed' }))
      onDone()
    }
  }
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        <Choice on={side === 'buy'} onClick={() => { setSide('buy'); setP(idle); setErr(undefined) }}>Buy</Choice>
        <Choice on={side === 'sell'} onClick={() => { setSide('sell'); setP(idle); setErr(undefined) }}>Sell</Choice>
      </Box>
      <Label>Basket</Label>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {list.map((x) => <Choice key={x.symbol} on={x.symbol === b?.symbol} onClick={() => { setB(x.symbol); setP(idle); setErr(undefined) }} disabled={!x.tradable}>{x.symbol}</Choice>)}
      </Box>
      <Box sx={{ mt: 2.5 }}>
        <Label>{side === 'buy' ? 'Amount, in USDC' : `Share of your ${b?.symbol ?? 'basket'} to sell`}</Label>
        {side === 'buy' ? (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>{AMOUNTS.map((a) => <Choice key={a} on={Number(amount) === a} onClick={() => setAmount(String(a))}>${a}</Choice>)}</Box>
            <InputBase value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Amount" inputProps={{ 'aria-label': 'USDC to spend', inputMode: 'decimal' }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 14, fontWeight: 500 }} />
          </>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{[25, 50, 100].map((x) => <Choice key={x} on={pct === x} onClick={() => setPct(x)}>{x}%</Choice>)}</Box>
        )}
      </Box>
      <Box sx={{ mt: 3, p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 1 }}>
        {side === 'buy' ? (
          <>
            <Row k="You buy" v={b ? `${b.legs.length} stocks, ${fmtUsdc(b.legs.length ? (amt - fee) / BigInt(b.legs.length) : 0n)} each` : '…'} strong />
            <Row k="Transactions to sign" v={b ? `${b.legs.length}, in one prompt` : '…'} />
            <Row k="Price floor" v={`${SLIPPAGE_BPS / 100}% from Jupiter's quote, on every leg`} />
            <Row k={`${BRAND.name} fee`} v={feeWallet() ? `${(FEE_BPS / 100).toFixed(2)}% in USDC, ${fmtUsdc(fee)}` : 'None yet on Solana'} />
          </>
        ) : (
          <>
            <Row k="You sell" v={b ? `${pct}% of what you hold of ${b.legs.filter((l) => l.held > 0n).length} stocks` : '…'} strong />
            <Row k="About" v={b ? fmtUsd((b.heldUsd * pct) / 100) : '…'} />
            <Row k="Price floor" v={`${SLIPPAGE_BPS / 100}% from Jupiter's quote, on every leg`} />
            <Row k={`${BRAND.name} fee`} v={feeWallet() ? `${(FEE_BPS / 100).toFixed(2)}% of the USDC out` : 'None yet on Solana'} />
          </>
        )}
      </Box>
      {short && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5 }}>Your wallet holds {fmtUsdc(usdc)} USDC on Solana.</Typography>}
      <Button onClick={() => (owner ? void go() : connect())} disabled={!!owner && !ready} sx={{ ...Bt, width: '100%', mt: 2.5, height: 44 }}>
        {!owner ? 'Connect a Solana wallet' : busy ? `${TRADE_LABEL[p.phase]}${p.phase === 'sending' ? ` ${p.sent}/${p.total}` : ''}` : side === 'buy' ? `Buy ${b?.symbol ?? ''}, ${b?.legs.length ?? 0} legs` : `Sell ${pct}% of ${b?.symbol ?? ''}`}
      </Button>
      {err && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5 }}>{err}{p.sigs.length > 0 ? ` ${p.sigs.length} of ${p.total} legs had already landed; they are in your wallet.` : ''}</Typography>}
      {(p.phase === 'done' || (p.phase === 'failed' && p.sigs.length > 0)) && (
        <Box sx={{ mt: 2, p: 2, borderRadius: t.radius.panel, background: 'rgba(194,234,138,.10)', border: '1px solid rgba(194,234,138,.3)' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}><CheckIcon size={16} /> {p.phase === 'done' ? (side === 'buy' ? 'The stocks are in your wallet.' : 'Sold. The USDC is in your wallet.') : 'Partly done.'}</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>{p.sent} of {p.total} legs landed on Solana.</Typography>
          <Sigs p={p} />
        </Box>
      )}
    </Panel>
  )
}

export default function SolanaPage() {
  const sol = useSolWallet()
  const owner = sol.connected
  const assets = useAssets()
  const stocks = useMemo(() => (assets.data ? solStocks(assets.data.assets) : []), [assets.data])
  const need = useMemo(() => stocks.filter((s) => BASKETS.some((b) => b.tickers.includes(s.ticker))), [stocks])
  const prices = usePrices(need)
  const w = useSolWalletState(owner?.publicKey, need)
  const list = useMemo(() => baskets(need, prices.data, w.data), [need, prices.data, w.data])
  const qc = useQueryClient()
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['sol-wallet'] }) }
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [picked, setPicked] = useState<string>()
  const b = list.find((x) => x.symbol === picked) ?? list.find((x) => x.tradable) ?? list[0]
  const [showWallets, setShowWallets] = useState(false)
  const mine = list.reduce((s, x) => s + x.heldUsd, 0)
  const pick = (x: BasketInfo, s: 'buy' | 'sell') => { setPicked(x.symbol); setSide(s); document.getElementById('sol-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const connect = () => setShowWallets(true)

  return (
    <Page>
      <PageHero
        label="Verdex on Solana"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Live</Box>}
        title={<>The same baskets,<br />on Solana.</>}
        lead="Buy a basket of xStocks, Backed's tokenized shares on Solana, with USDC. The page asks Jupiter for the best route into every stock, builds one transaction per leg and your wallet signs them all in one prompt. The stocks land in your wallet as themselves; sell any share of them the same way. No Verdex program holds anything on Solana: there is nothing between you and the stocks."
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => (owner ? document.getElementById('sol-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : connect())} sx={{ ...Bt, gap: 1 }}><PieIcon size={15} /> {owner ? 'Buy a basket' : 'Connect a Solana wallet'}</Button>
            <Button component={Link} to="/index" sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}><LayersIcon size={14} /> Verdex Index, on Robinhood Chain and Base</Button>
          </Box>
        }
      />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 4, alignItems: 'center' }}>
        <Choice on={false} onClick={() => undefined}><Avatar src={CHAIN_NAME_LOGOS['Robinhood Chain']} sx={{ width: 16, height: 16, background: 'transparent' }} /><Link to="/index" style={{ color: 'inherit', textDecoration: 'none' }}>Robinhood Chain</Link></Choice>
        <Choice on={false} onClick={() => undefined}><Avatar src={CHAIN_NAME_LOGOS.Base} sx={{ width: 16, height: 16, background: 'transparent' }} /><Link to="/index?chain=base" style={{ color: 'inherit', textDecoration: 'none' }}>Base</Link></Choice>
        <Choice on onClick={() => undefined}><Avatar src={CHAIN_NAME_LOGOS.Solana} sx={{ width: 16, height: 16, background: 'transparent' }} />Solana</Choice>
        {owner ? (
          <Typography sx={{ ml: 'auto', fontSize: 13, color: t.color.textMuted, display: 'flex', alignItems: 'center', gap: 1 }}>
            {owner.wallet.icon && <Avatar src={owner.wallet.icon} sx={{ width: 18, height: 18 }} />}{owner.publicKey.toBase58().slice(0, 4)}…{owner.publicKey.toBase58().slice(-4)}
            <Box component="button" type="button" onClick={() => disconnectSol()} sx={{ all: 'unset', cursor: 'pointer', color: t.color.text, fontSize: 12 }}>Disconnect</Box>
          </Typography>
        ) : (
          <Button onClick={connect} sx={{ ...Lt, backdropFilter: 'none', ml: 'auto', height: 34, px: 1.75, gap: 1 }}><WalletIcon size={14} /> Solana wallet</Button>
        )}
      </Box>
      {showWallets && !owner && (
        <Panel sx={{ mt: 2, p: 2.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Pick a Solana wallet</Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted, mt: 0.5 }}>Phantom, Solflare, Backpack and any wallet that speaks the Wallet Standard. Your EVM wallet is a different one; Solana addresses are not 0x.</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            {sol.wallets.map((wl) => <Button key={wl.id} disabled={sol.connecting} onClick={() => void connectSol(wl.id).then(() => setShowWallets(false)).catch(() => undefined)} sx={{ ...Lt, backdropFilter: 'none', height: 36, px: 1.75, gap: 1 }}>{wl.icon && <Avatar src={wl.icon} sx={{ width: 18, height: 18 }} />}{wl.name}</Button>)}
            {sol.wallets.length === 0 && <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>No Solana wallet found in this browser. Install Phantom or Solflare and reload.</Typography>}
          </Box>
          {sol.error && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1 }}>{sol.error}</Typography>}
        </Panel>
      )}

      <Stats items={[{ label: 'Baskets', value: String(list.length) }, { label: 'Stocks priced', value: prices.data ? String(Object.keys(prices.data).length) : '…' }, { label: 'Yours', value: owner ? (w.data ? fmtUsd(mine, 0) : '…') : '-' }, { label: `${BRAND.name} fee`, value: feeWallet() ? `${(FEE_BPS / 100).toFixed(2)}%` : '0%' }]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>Prices and routes from Jupiter, as you look. Balances read from your token accounts on Solana. A leg that would move its pool more than {MAX_IMPACT_PCT}% is refused before you sign anything.</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 440px' }, gap: 2.5, mt: { xs: 5, md: 7 }, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>The baskets</Typography>
            {owner && w.data && <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>wallet {fmtUsdc(w.data.usdc)} USDC</Typography>}
          </Box>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {list.map((x) => <BasketCard key={x.symbol} b={x} selected={x.symbol === b?.symbol} onPick={(s) => pick(x, s)} />)}
            {prices.isError && <Panel sx={{ p: 3 }}><Typography sx={{ fontSize: 14, color: t.color.textMuted }}>Jupiter is not answering right now. Reload in a minute.</Typography></Panel>}
          </Box>
        </Box>
        <Box id="sol-composer" sx={{ minWidth: 0, scrollMarginTop: 96 }}>
          {list.length > 0 && <Composer list={list} b={b} side={side} setB={setPicked} setSide={setSide} owner={owner} usdc={w.data?.usdc ?? 0n} onDone={refresh} connect={connect} />}
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<PieIcon size={20} />} title="A basket, leg by leg" text="Equal USDC per stock. For every leg the page asks Jupiter for its best route across Solana's pools and gets back a ready transaction. Seven stocks, seven transactions, one signature prompt." />
          <Step n={2} icon={<LayersIcon size={20} />} title="The stocks, not a wrapper" text="On Solana the basket is the stocks themselves in your wallet: NVDAx, TSLAx and the rest, Backed's xStocks. No index token yet, nothing held by Verdex. Sell any share of them the same way, into USDC." />
          <Step n={3} icon={<LockIcon size={20} />} title="A floor on every leg" text="Each leg carries Jupiter's quote less one percent as its floor; a leg that would move its pool more than one percent is refused before you sign. If a later leg fails after the earlier ones landed, the page shows you exactly which did." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}><MarkIcon size={22} /></Box>
            <Box sx={{ ...Vg, ml: 0 }}>Phase 2, box 6</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Nothing to trust but the chain.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            Verdex deploys no program on Solana for this. Every transaction you sign is a Jupiter swap of USDC into a stock, or back, built in your browser from Jupiter's public route and sent from your wallet. Verdex sees your address and nothing else. The stocks are Backed's xStocks, which carry their own terms; read them. Jupiter and the pools behind it are not Verdex's. VERDEX stays on Robinhood Chain.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[[<ShieldIcon key="a" size={16} />, 'No Verdex program and no custody. The stocks go straight from the pool to your wallet.'], [<WalletIcon key="b" size={16} />, 'One prompt signs every leg. Each is its own transaction; the page shows which landed.'], [<CheckIcon key="c" size={16} />, feeWallet() ? 'A 0.25% fee in USDC rides on the first leg and buys VERDEX on Robinhood Chain.' : 'No Verdex fee on Solana for now.']].map(([icon, text], i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 2, borderRadius: t.radius.panel, background: t.color.raised }}>
              <Box sx={{ color: t.color.mark, mt: 0.25 }}>{icon}</Box>
              <Typography sx={{ fontSize: 14, color: t.color.textSoft }}>{text}</Typography>
            </Box>
          ))}
        </Box>
      </Panel>
    </Page>
  )
}
