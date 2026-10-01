import { useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { erc20Abi, formatUnits, type Address } from 'viem'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { CHAIN_NAME_LOGOS, ROBINHOOD, fmtUsd, useAssets, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, client, fmtQty, toRaw, type Phase } from '../lib/pools'
import { PONS, ZERO, explorerAddress, explorerToken, fmtAge, launchToken, launchedTokenOf, shortAddr, useLaunchpad, useMyLaunches, useRecentLaunches, type Launch, type Launchpad, type Quote } from '../lib/launch'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { CheckIcon, ExternalIcon, RocketIcon, ShieldIcon, SparkIcon, TrendIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Cell, Page, PageHero, Panel, Row, Stats, TableHead } from './common'

type Ctx = ReturnType<typeof useWallet>
const TAXES = [100, 200, 500]
const ETH_LOGO = `${import.meta.env.BASE_URL}img/tokens/eth.png`.replace('//', '/')
const USDG_LOGO = `${import.meta.env.BASE_URL}img/tokens/usdg.png`.replace('//', '/')

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
const quoteLogo = (q: Quote) => (q.address === ZERO ? ETH_LOGO : q.symbol === 'USDG' ? USDG_LOGO : resolveImg(q.logo))
function Mark({ src, letter, size = 44 }: { src?: string; letter: string; size?: number }) {
  return (
    <Box sx={{ position: 'relative', width: size, height: size, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Avatar src={src} sx={{ width: size * 0.64, height: size * 0.64, background: z.surface2, fontSize: 11 }}>{letter}</Avatar>
      <Avatar src={CHAIN_NAME_LOGOS['Robinhood Chain']} sx={{ width: 14, height: 14, position: 'absolute', right: 6, bottom: 6, border: `1.5px solid ${t.color.page}` }} />
    </Box>
  )
}
const QuoteChip = ({ q, on, onClick }: { q: Quote; on: boolean; onClick: () => void }) => (
  <Choice on={on} onClick={onClick}>
    <Avatar src={quoteLogo(q)} sx={{ width: 18, height: 18, fontSize: 9 }}>{q.symbol[0]}</Avatar>
    {q.symbol}
  </Choice>
)
const Field = ({ label, value, onChange, placeholder, multiline, maxLength, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean; maxLength?: number; hint?: string }) => (
  <Box sx={{ p: 1.5, borderRadius: t.radius.panel, background: t.color.raised }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.color.textMuted }}>
      <span>{label}</span>
      {hint && <span>{hint}</span>}
    </Box>
    <InputBase value={value} onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)} placeholder={placeholder} multiline={multiline} minRows={multiline ? 2 : undefined} inputProps={{ 'aria-label': label }} sx={{ width: '100%', minWidth: 0, fontSize: multiline ? 14 : 16, fontWeight: 500, color: t.color.text, mt: 0.5, '& input, & textarea': { p: 0, minWidth: 0, width: '100%' }, '& input::placeholder, & textarea::placeholder': { color: t.color.textLabel, opacity: 1 } }} />
  </Box>
)
const busyPhase = (p: Phase) => p === 'switching' || p === 'approving' || p === 'confirming' || p === 'pending'
const isUrl = (s: string) => s === '' || /^(https?:\/\/|ipfs:\/\/)\S+$/i.test(s)
// Logos are stored as the creator typed them; ipfs:// ones are shown through a public gateway.
const logoUrl = (s: string) => (/^ipfs:\/\//i.test(s) ? `https://ipfs.io/ipfs/${s.slice(7)}` : /^https?:\/\//i.test(s) ? s : undefined)
const FEATURED = ['ETH', 'USDG', 'NVDA', 'TSLA', 'SPY', 'AAPL', 'GOOGL', 'META', 'MSFT', 'AMZN']

function useQuoteBalance(owner: Address | undefined, q: Quote) {
  return useQuery({
    queryKey: ['launch-balance', owner?.toLowerCase(), q.address],
    queryFn: async () => {
      const c = client()
      const raw = q.address === ZERO ? await c.getBalance({ address: owner! }) : await c.readContract({ address: q.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner!] })
      return { raw, human: Number(formatUnits(raw, q.decimals)) }
    },
    enabled: !!owner,
    staleTime: 20_000,
  })
}

// The composer: the token, the quote it is priced in, the creator fee and the first buy, then one transaction.
function Composer({ lp, wallet, chain, onLaunched }: { lp: Launchpad; wallet: Ctx; chain: ChainX | undefined; onLaunched: () => void }) {
  const { account, walletClient, switchChain, openWalletMenu } = wallet
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [logo, setLogo] = useState('')
  const [description, setDescription] = useState('')
  const [twitter, setTwitter] = useState('')
  const [website, setWebsite] = useState('')
  const [qi, setQi] = useState(0)
  const [allQuotes, setAllQuotes] = useState(false)
  const [tax, setTax] = useState(200)
  const [custom, setCustom] = useState('')
  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ tx: string; token: Address | null } | null>(null)
  const quote = lp.quotes[Math.min(qi, lp.quotes.length - 1)]
  const bal = useQuoteBalance(account?.address, quote)
  const taxBps = tax < 0 ? Math.round((Number(custom) || 0) * 100) : tax
  const raw = toRaw(Number(amount) || 0, quote.decimals)
  const feeRaw = quote.address === ZERO ? lp.launchFee : 0n
  const short = bal.data != null && raw + feeRaw > bal.data.raw
  const busy = busyPhase(phase)
  const problems = useMemo(() => {
    const p: string[] = []
    if (name.trim().length < 2) p.push('a name')
    if (!/^[A-Za-z0-9]{2,10}$/.test(symbol.trim())) p.push('a symbol of 2 to 10 letters or digits')
    if (!isUrl(logo)) p.push('a logo link starting with https://')
    if (!isUrl(twitter) || !isUrl(website)) p.push('links starting with https://')
    if (taxBps < 0 || taxBps > lp.maxCreatorTaxBps) p.push(`a creator fee up to ${lp.maxCreatorTaxBps / 100}%`)
    if (!(raw > 0n)) p.push('a first buy above 0')
    return p
  }, [name, symbol, logo, twitter, website, taxBps, lp.maxCreatorTaxBps, raw])
  const usdOf = (n: number) => (quote.usd ? fmtUsd(n * quote.usd) : '')

  const submit = async () => {
    if (!account || !walletClient) return openWalletMenu()
    setError(null)
    setDone(null)
    try {
      const hash = await launchToken({ walletClient, account, chain, switchChain, onPhase: setPhase }, { name, symbol, logo, description, twitter, website, quote, creatorTaxBps: taxBps, quoteIn: raw })
      const token = await launchedTokenOf(hash as `0x${string}`).catch(() => null)
      setDone({ tx: hash, token })
      onLaunched()
    } catch (e) {
      setPhase('failed')
      setError(describeError(e))
    }
  }
  const share = done?.token ? `https://x.com/intent/post?text=${encodeURIComponent(`Just launched $${symbol.trim().toUpperCase()} on Robinhood Chain, priced in ${quote.symbol}, from @useverdex.\n\n${explorerToken(done.token)}`)}` : null

  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, position: { md: 'sticky' }, top: { md: 92 }, minWidth: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Mark src={logoUrl(logo)} letter={(symbol.trim()[0] ?? '?').toUpperCase()} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Launch a token</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>Robinhood Chain · fixed supply of {lp.supply.toLocaleString('en-US')} · Pons V2 contracts</Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 3, display: 'grid', gap: 1.25 }}>
        <Label>The token</Label>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', gap: 1.25 }}>
          <Field label="Name" value={name} onChange={setName} placeholder="Nvidia Maxi" maxLength={40} />
          <Field label="Symbol" value={symbol} onChange={(v) => setSymbol(v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} placeholder="NVMAX" maxLength={10} />
        </Box>
        <Field label="Description" value={description} onChange={setDescription} placeholder="What it is, in a sentence or two." multiline maxLength={280} hint={`${description.length}/280`} />
        <Field label="Logo link" value={logo} onChange={setLogo} placeholder="https://… or ipfs://… (optional)" />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
          <Field label="X link" value={twitter} onChange={setTwitter} placeholder="https://x.com/… (optional)" />
          <Field label="Website" value={website} onChange={setWebsite} placeholder="https://… (optional)" />
        </Box>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Label>Priced in</Label>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {lp.quotes.map((q, i) => (allQuotes || FEATURED.includes(q.symbol) || i === qi ? <QuoteChip key={q.address} q={q} on={i === qi} onClick={() => { setQi(i); setAmount('') }} /> : null))}
          {lp.quotes.length > FEATURED.length && (
            <Choice on={false} onClick={() => setAllQuotes((v) => !v)}>
              {allQuotes ? 'Fewer' : `All ${lp.quotes.length}`}
            </Choice>
          )}
        </Box>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 1.5, lineHeight: 1.5 }}>
          Buyers pay in {quote.symbol} and the curve holds {quote.symbol}. It graduates to a Uniswap v4 pool with locked liquidity once it has raised {fmtQty(quote.threshold)} {quote.symbol}{quote.usd ? ` (about ${fmtUsd(quote.threshold * quote.usd, 0)})` : ''}.
        </Typography>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Label>Creator fee, on every trade, forever</Label>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {TAXES.filter((x) => x <= lp.maxCreatorTaxBps).map((x) => (
            <Choice key={x} on={tax === x} onClick={() => setTax(x)}>
              {x / 100}%
            </Choice>
          ))}
          <Choice on={tax < 0} onClick={() => setTax(-1)}>
            Custom
          </Choice>
          {tax < 0 && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 34, px: 1.5, borderRadius: t.radius.input, background: t.color.raised }}>
              <InputBase value={custom} inputMode="decimal" placeholder="0" onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setCustom(e.target.value)} inputProps={{ 'aria-label': 'Custom creator fee' }} sx={{ width: 48, fontSize: 14, fontWeight: 500, color: t.color.text, '& input': { p: 0, textAlign: 'right' } }} />
              <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>% of {lp.maxCreatorTaxBps / 100} max</Typography>
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 1.5 }}>Paid to your wallet in {quote.symbol} by the Pons hook, on the curve and in the pool after graduation. VERDEX runs at 2%.</Typography>
      </Box>

      <Box sx={{ mt: 3, display: 'grid', gap: 1.25 }}>
        <Label>Your first buy</Label>
        <Box sx={{ p: 2, borderRadius: t.radius.panel, background: t.color.raised }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.color.textMuted }}>
            <span>{quote.symbol}</span>
            {bal.data && (
              <Box component="button" type="button" onClick={() => setAmount(String(Math.max(0, bal.data!.human - (quote.address === ZERO ? lp.launchFeeEth + 0.0005 : 0)).toFixed(6)).replace(/\.?0+$/, ''))} sx={{ all: 'unset', cursor: 'pointer', color: short ? t.color.red : t.color.textMuted, '&:hover': { color: t.color.text } }}>
                Balance {fmtQty(bal.data.human)} · Max
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
            <InputBase value={amount} inputMode="decimal" placeholder="0" onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAmount(e.target.value)} inputProps={{ 'aria-label': 'First buy' }} sx={{ flex: 1, minWidth: 0, fontSize: 26, fontWeight: 500, color: t.color.text, '& input': { p: 0, minWidth: 0, width: '100%' }, '& input::placeholder': { color: t.color.text, opacity: 0.4 } }} />
            <Typography sx={{ fontSize: 14, fontWeight: 500, color: t.color.textMuted }}>{quote.symbol}</Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 12, color: t.color.textLabel, lineHeight: 1.4 }}>Lands in the same transaction as the launch, before anyone else can buy, and is exempt from the snipe tax that hits bots in the first {lp.snipeSeconds} seconds.</Typography>
      </Box>

      <Box sx={{ mt: 2.5, p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 0.75, fontSize: 13 }}>
        {[
          ['Launch fee', `${lp.launchFeeEth} ETH, to Pons`],
          ['First buy', raw > 0n ? `${amount} ${quote.symbol}${usdOf(Number(amount)) ? ` · ${usdOf(Number(amount))}` : ''}` : '-'],
          ['Curve fee', `${lp.curveFeeBps / 100}% of every curve trade, to Pons`],
          ['Creator fee', `${(taxBps / 100).toFixed(taxBps % 100 ? 2 : 0)}% of every trade, to you`],
          ['Graduates at', `${fmtQty(quote.threshold)} ${quote.symbol}${quote.usd ? ` · ${fmtUsd(quote.threshold * quote.usd, 0)}` : ''}`],
          ['Verdex fee', 'None'],
        ].map(([k, v]) => (
          <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted, flexShrink: 0 }}>{k}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{v}</Typography>
          </Box>
        ))}
      </Box>

      {error && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1.5, lineHeight: 1.4 }}>{error}</Typography>}
      {done && (
        <Box sx={{ mt: 1.5, p: 2, borderRadius: t.radius.panel, background: 'rgba(194,234,138,.1)', display: 'grid', gap: 0.75 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: t.color.green }}>Launched. The curve is open.</Typography>
          {done.token && (
            <Typography sx={{ fontSize: 12, color: t.color.textMuted, wordBreak: 'break-all' }}>
              {symbol.toUpperCase()} · {done.token}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {done.token && (
              <Box component="a" href={explorerToken(done.token)} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 12, color: t.color.text, display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}>
                Token on the explorer <ExternalIcon size={12} />
              </Box>
            )}
            <Box component="a" href={explorerTx(chain, ROBINHOOD, done.tx)} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 12, color: t.color.text, display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}>
              Transaction <ExternalIcon size={12} />
            </Box>
            {share && (
              <Box component="a" href={share} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 12, color: t.color.mark, display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}>
                Post it <ExternalIcon size={12} />
              </Box>
            )}
          </Box>
        </Box>
      )}
      <Button fullWidth onClick={submit} disabled={!!account && (problems.length > 0 || short || busy || !lp.enabled)} sx={{ ...Bt, height: 48, mt: 2 }}>
        {!account ? 'Connect wallet' : busy ? PHASE_LABEL[phase] : !lp.enabled ? 'Launches are paused by Pons' : short ? 'Insufficient balance' : problems.length ? `Needs ${problems[0]}` : `Launch ${symbol.trim().toUpperCase() || 'it'}`}
      </Button>
      <Typography sx={{ fontSize: 11, color: t.color.textLabel, textAlign: 'center', mt: 1.5, lineHeight: 1.4 }}>
        One transaction to the Pons launch router{quote.address === ZERO ? '' : ', after one approval of ' + quote.symbol}. The token, its curve and your first buy land together. {BRAND.name} adds no contract and takes no fee.
      </Typography>
    </Panel>
  )
}

function LaunchRow({ l }: { l: Launch }) {
  return (
    <Row>
      <Cell grow>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Mark src={logoUrl(l.logo)} letter={l.symbol[0] ?? '?'} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              {l.symbol}
              <Box component="span" sx={{ ...Vg, ml: 0, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                {l.quote && <Avatar src={quoteLogo(l.quote)} sx={{ width: 12, height: 12, fontSize: 7 }}>{l.quote.symbol[0]}</Avatar>}
                {l.quote?.symbol ?? shortAddr(l.pairToken)}
              </Box>
              {l.graduated && <Box component="span" sx={{ ...Vg, ml: 0, fontSize: 11, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Graduated</Box>}
            </Typography>
            <Typography noWrap sx={{ fontSize: 12, color: t.color.textMuted }}>
              {l.name} · {fmtAge(l.ageSec)} ago · by{' '}
              <Box component="a" href={explorerAddress(l.deployer)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.textMuted }}>
                {shortAddr(l.deployer)}
              </Box>
            </Typography>
          </Box>
        </Box>
      </Cell>
      <Cell align="right" hide="xs" sx={{ minWidth: 150 }}>
        <Box sx={{ display: 'grid', gap: 0.5, justifyItems: 'end' }}>
          <Typography sx={{ fontSize: 12, color: l.graduated ? t.color.green : t.color.textMuted }}>{l.graduated ? 'In the pool' : `${fmtQty(l.raised, 2)} / ${fmtQty(l.threshold, 2)} ${l.quote?.symbol ?? ''}`}</Typography>
          <Box sx={{ width: 120, height: 6, borderRadius: 3, background: t.color.hover, overflow: 'hidden' }}>
            <Box sx={{ width: `${Math.round(l.progress * 100)}%`, height: '100%', background: l.graduated ? t.color.green : t.color.mark }} />
          </Box>
        </Box>
      </Cell>
      <Cell align="right" sx={{ fontWeight: 500, color: t.color.textMuted, fontSize: 13 }}>{l.creatorTaxBps / 100}% fee</Cell>
      <Cell align="right" hide="xs">
        <Box component="a" href={explorerToken(l.token)} target="_blank" rel="noopener noreferrer" sx={{ ...Vg, ml: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          Open <ExternalIcon size={11} />
        </Box>
      </Cell>
    </Row>
  )
}

export default function LaunchPage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: assets } = useAssets()
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ROBINHOOD) as ChainX | undefined
  const lp = useLaunchpad(assets?.assets)
  const feed = useRecentLaunches(lp.data?.quotes)
  const mine = useMyLaunches(account?.address, lp.data?.quotes)
  const qc = useQueryClient()
  const refresh = () => {
    for (const k of ['launch-feed', 'my-launches', 'launchpad', 'launch-balance']) qc.invalidateQueries({ queryKey: [k] })
  }
  const d = lp.data

  return (
    <Page>
      <PageHero
        label="Launchpad"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Live</Box>}
        title={
          <>
            Launch a token.
            <br />
            Priced in a stock.
          </>
        }
        lead="Anyone can launch a token on Robinhood Chain from here, quoted in ETH, USDG or a tokenized stock like NVDA, TSLA or SPY. Fixed supply, a bonding curve from the first block, and a Uniswap v4 pool with locked liquidity once the curve fills. You name the creator fee and the Pons hook pays it to you on every trade, forever. The same verified contracts that created VERDEX."
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => (account ? document.getElementById('launch-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : openWalletMenu())} sx={{ ...Bt, gap: 1 }}>
              <RocketIcon size={15} /> {account ? 'Launch one' : 'Connect wallet'}
            </Button>
            {!account && (
              <Button onClick={openWalletMenu} sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
                <WalletIcon size={14} /> See my launches
              </Button>
            )}
          </Box>
        }
      />

      <Stats items={[{ label: 'Launches, 24h', value: d ? d.launches24h.toLocaleString('en-US') : '…' }, { label: 'Graduated, 24h', value: d ? d.graduated24h.toLocaleString('en-US') : '…' }, { label: 'Launch fee', value: d ? `${d.launchFeeEth} ETH` : '…' }, { label: 'Quote assets', value: d ? d.quotes.length : '…' }]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>Counts from the factory's own events over the last 24 hours. The launch fee, the supply, the thresholds and the accepted quote assets are read from the Pons factory as you look.</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 420px' }, gap: 2.5, mt: { xs: 5, md: 7 }, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          {account && (
            <Box sx={{ mb: { xs: 5, md: 6 } }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Your launches</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{mine.data ? `${mine.data.length} from this wallet` : mine.isLoading ? 'Reading the factory…' : ''}</Typography>
              </Box>
              <Panel sx={{ overflow: 'hidden' }}>
                {mine.data && mine.data.length === 0 && <Typography sx={{ p: 3, fontSize: 14, color: t.color.textMuted }}>Nothing launched from this wallet yet. The composer is on the right.</Typography>}
                {mine.data?.map((l) => <LaunchRow key={l.token} l={l} />)}
              </Panel>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Live launches</Typography>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{feed.data ? `the newest ${feed.data.length} on the chain, refreshed every minute` : feed.isLoading ? 'Reading the factory…' : ''}</Typography>
          </Box>
          <Panel sx={{ overflow: 'hidden' }}>
            <TableHead cols={[{ label: 'Token', grow: true }, { label: 'Curve', align: 'right', hide: 'xs' }, { label: 'Creator', align: 'right' }, { label: '', align: 'right', hide: 'xs' }]} />
            {feed.isLoading && <Typography sx={{ p: 3, fontSize: 14, color: t.color.textMuted }}>Reading the newest launches…</Typography>}
            {feed.isError && <Typography sx={{ p: 3, fontSize: 14, color: t.color.red }}>The chain did not answer. Try again in a moment.</Typography>}
            {feed.data?.map((l) => <LaunchRow key={l.token} l={l} />)}
            {feed.data && feed.data.length === 0 && <Typography sx={{ p: 3, fontSize: 14, color: t.color.textMuted }}>No launch in the last hour. Yours would be the first.</Typography>}
          </Panel>
          <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5, lineHeight: 1.5 }}>Every launch on the factory, whoever made it and wherever they made it. Most are memecoins and most will not graduate. Verdex lists them as they are and vouches for none.</Typography>
        </Box>
        <Box id="launch-panel" sx={{ minWidth: 0 }}>
          {d ? (
            <Composer lp={d} wallet={wallet} chain={chain} onLaunched={refresh} />
          ) : (
            <Panel sx={{ p: 3 }}>
              <Typography sx={{ fontSize: 14, color: lp.isError ? t.color.red : t.color.textMuted }}>{lp.isError ? 'The factory did not answer. Try again in a moment.' : 'Reading the launchpad…'}</Typography>
            </Panel>
          )}
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<RocketIcon size={20} />} title="Name it, price it, launch it" text="A name, a symbol, a logo link, the asset it is priced in and your creator fee. One transaction mints the fixed supply, opens the bonding curve and makes your first buy before anyone else can, exempt from the snipe tax." />
          <Step n={2} icon={<TrendIcon size={20} />} title="The curve, then the pool" text="Buyers pay in the quote asset along a bonding curve. When it has raised the threshold, the launch graduates by itself into a Uniswap v4 pool whose liquidity is locked by the Pons locker. Nobody can pull it, you included." />
          <Step n={3} icon={<SparkIcon size={20} />} title="Fees, forever" text="The Pons hook charges your creator fee on every trade, on the curve and in the pool, and pays it to your wallet in the quote asset. VERDEX runs on exactly this: 2% on every swap, swept hourly, listed on its page." />
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
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Pons's contracts. Your token. Our front door.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            {BRAND.name} adds no contract and takes no fee here. The page talks to the Pons V2 launch factory at {shortAddr(PONS.factory)} and its router at {shortAddr(PONS.router)}, both verified on the explorer and both the contracts that created VERDEX on 28 September. A token launched here shows up on Pons, and the other way round.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[
            [<ShieldIcon size={18} />, 'A curve is a market from second one', `Anyone can buy and sell on it the moment it exists. The first ${d?.snipeSeconds ?? 15} seconds carry a snipe tax that starts at ${((d?.snipeStartBps ?? 9900) / 100).toFixed(0)}% so bots cannot front-run you; your own first buy is exempt.`],
            [<TrendIcon size={18} />, 'Most launches go nowhere', 'The factory sees thousands of launches a day and a few dozen graduations. A token is worth what its buyers pay for it, and nothing here changes that. Launch something you would defend.'],
            [<CheckIcon size={18} />, 'What you see is what you sign', 'The launch fee, the threshold and the fee terms are read from the factory and pinned into the transaction, so a change by Pons between your look and your signature makes it revert rather than reprice.'],
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
