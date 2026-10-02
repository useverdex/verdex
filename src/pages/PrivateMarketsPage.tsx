import { useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { fmtCompact, fmtPct, fmtUsd } from '../lib/api'
import { pub } from '../lib/base'
import { ISSUER, RETIRED, checkMint, dexscreenerUrl, fmtDate, fmtFee, issuerUrl, jupiterUrl, shortMint, solscanUrl, usePrivateMarkets, type MintCheck, type Token } from '../lib/privateMarkets'
import { resolveImg } from '../lib/img'
import { CheckIcon, CloseIcon, CopyIcon, ExternalIcon, GlobeIcon, LockIcon, SearchIcon, ShieldIcon, TrendIcon, UsersIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Cell, Page, PageHero, Panel, Row, Stats, TableHead } from './common'

const SOL = pub('/logos/chains/1151111081099710.svg')
const RETIRED_COUNT = Object.keys(RETIRED).length

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
    <Box sx={{ position: 'relative', width: size, height: size, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Avatar src={resolveImg(logo)} sx={{ width: size * 0.64, height: size * 0.64, background: z.surface2, fontSize: 11, color: t.color.text }}>
        {letter}
      </Avatar>
      <Avatar src={SOL} sx={{ position: 'absolute', right: -3, bottom: -3, width: 14, height: 14, border: `2px solid ${t.color.panel}`, background: t.color.panel }} />
    </Box>
  )
}
function Change({ v, size = 13 }: { v?: number; size?: number }) {
  if (v == null || !isFinite(v)) return <Box component="span" sx={{ color: t.color.textLabel }}>…</Box>
  return <Box component="span" sx={{ color: v >= 0 ? t.color.green : t.color.red, fontSize: size, fontWeight: 500 }}>{fmtPct(v)}</Box>
}
function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.75, borderRadius: t.radius.panel, background: t.color.raised, minWidth: 0 }}>
      <Typography sx={{ ...t.type.overline, color: t.color.textLabel }}>{label}</Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 500, mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 12, color: t.color.textMuted, mt: 0.25 }}>{sub}</Typography>}
    </Box>
  )
}
function Ext({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Button component="a" href={href} target="_blank" rel="noopener noreferrer" sx={{ ...(primary ? Bt : Lt), backdropFilter: 'none', height: 38, px: 2, gap: 0.75, whiteSpace: 'nowrap' }}>
      {children} <ExternalIcon size={12} />
    </Button>
  )
}

function feeLine(x: Token) {
  const c = x.chain
  if (c.feeBps == null) return undefined
  return c.nextFeeBps != null ? `${fmtFee(c.nextFeeBps)} from epoch ${c.nextFeeEpoch}, set by the issuer` : 'on every transfer, including the buy'
}

function CompanyPanel({ x, onClose }: { x: Token; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const m = x.market
  const copy = () => navigator.clipboard?.writeText(x.mint).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  return (
    <Panel sx={{ p: 3, position: { md: 'sticky' }, top: { md: 96 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Mark logo={x.logo} letter={x.name[0]} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>{x.name}</Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{x.symbol} · {x.about}</Typography>
        </Box>
        <Box component="button" type="button" aria-label="Close" onClick={onClose} sx={{ all: 'unset', cursor: 'pointer', color: t.color.textMuted, display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '8px', '&:hover': { background: t.color.hover } }}>
          <CloseIcon size={16} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mt: 2.5 }}>
        <Typography sx={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>{m.price != null ? fmtUsd(m.price) : '…'}</Typography>
        <Change v={m.change24h} size={14} />
        <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>24h</Typography>
      </Box>
      {x.status !== 'private' && x.note && (
        <Box sx={{ mt: 2, p: 1.75, borderRadius: t.radius.panel, background: 'rgba(255,190,90,.10)', border: '1px solid rgba(255,190,90,.25)', fontSize: 13, color: t.color.text }}>
          {x.note}{' '}
          {x.ticker && (
            <Box component={Link} to={`/assets/${x.ticker}`} sx={{ color: t.color.mark, textDecoration: 'none', fontWeight: 500 }}>
              Open {x.ticker} →
            </Box>
          )}
        </Box>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mt: 2.5 }}>
        <Fact label="Market cap" value={m.marketCap != null ? fmtCompact(m.marketCap) : '…'} />
        <Fact label="Liquidity" value={m.liquidity != null ? fmtCompact(m.liquidity) : '…'} />
        <Fact label="24h volume" value={m.volume24h != null ? fmtCompact(m.volume24h) : '…'} sub={m.buys24h != null ? `${m.buys24h} buys · ${m.sells24h ?? 0} sells` : undefined} />
        <Fact label="Holders" value={m.holders != null ? m.holders.toLocaleString('en-US') : '…'} sub={m.traders24h != null ? `${m.traders24h.toLocaleString('en-US')} traded today` : undefined} />
        <Fact label="Transfer fee" value={fmtFee(x.chain.feeBps)} sub={feeLine(x)} />
        <Fact label="Transfers" value={x.chain.paused == null ? '…' : x.chain.paused ? 'Paused' : 'Open'} sub="the issuer holds the pause switch" />
        <Fact label="Supply" value={x.chain.supply != null ? x.chain.supply.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '…'} sub="tokens, on Solana" />
        <Fact label="First pool" value={fmtDate(m.firstPool)} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, p: 1.25, borderRadius: t.radius.input, background: t.color.hover }}>
        <Typography sx={{ ...t.type.overline, color: t.color.textLabel, flexShrink: 0 }}>Mint</Typography>
        <Typography sx={{ fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.mint}</Typography>
        <Box component="button" type="button" onClick={copy} aria-label="Copy mint" sx={{ all: 'unset', cursor: 'pointer', color: copied ? t.color.mark : t.color.textMuted, display: 'grid', placeItems: 'center' }}>
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2.5 }}>
        {x.status === 'private' && <Ext href={jupiterUrl(x.mint)} primary>Trade on Jupiter</Ext>}
        <Ext href={solscanUrl(x.mint)}>Solscan</Ext>
        <Ext href={dexscreenerUrl(x.mint)}>DexScreener</Ext>
        <Ext href={issuerUrl(x)}>Issuer page</Ext>
      </Box>
      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 2, lineHeight: 1.5 }}>
        Trading happens on Jupiter, in your own Solana wallet. The transfer fee comes off every transfer, the buy included. The token is the issuer's exposure to the company, not its shares, and the issuer's terms exclude U.S. persons. {BRAND.name} takes nothing.
      </Typography>
    </Panel>
  )
}

function MintCheckPanel() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<MintCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (!q.trim()) return
    setBusy(true)
    setRes(await checkMint(q).catch(() => ({ kind: 'unknown' as const })))
    setBusy(false)
  }
  const verdict = (r: MintCheck) => {
    switch (r.kind) {
      case 'current': return { ok: true, title: `Current ${r.company.name} mint`, text: `This is the mint the issuer trades today for ${r.company.name} (${r.company.symbol}).${r.company.status !== 'private' ? ` ${r.company.note}` : ''}` }
      case 'retired': return { ok: false, title: r.reason === 'outdated' ? `Replaced ${r.company} mint` : `Refunded ${r.company} mint`, text: r.reason === 'outdated' ? `The issuer replaced this mint with a newer one and renamed it OUTDATED. It is not the ${r.company} that trades today.` : `The issuer refunded this mint and renamed it REFUNDED. It no longer carries exposure to ${r.company}.` }
      case 'issuer-other': return { ok: true, title: `${r.name} (${r.symbol})`, text: 'A verified mint by the same issuer that is not in this list yet. Read the issuer page before trading it.' }
      case 'not-issuer': return { ok: false, title: `${r.name ?? 'Another token'}${r.symbol ? ` (${r.symbol})` : ''}`, text: 'Not a PreStocks mint. If it was sold to you as one, it is a lookalike.' }
      case 'unknown': return { ok: false, title: 'Not found', text: 'Jupiter does not know this mint. A pre-IPO token with no pool is not one you can trade, whatever its name says.' }
      default: return { ok: false, title: 'Not a Solana mint', text: 'A mint is a 32 to 44 character base58 address.' }
    }
  }
  const v = res ? verdict(res) : null
  return (
    <Panel sx={{ p: { xs: 3, md: 4 } }}>
      <Box id="mint-check" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}>
          <SearchIcon size={18} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Check a mint before you buy it</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>The issuer has replaced or refunded {RETIRED_COUNT} earlier mints. They keep the PreStocks name onchain and still get pasted into swap boxes.</Typography>
        </Box>
      </Box>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); void run() }} sx={{ display: 'flex', gap: 1, mt: 2.5, flexWrap: 'wrap' }}>
        <InputBase value={q} onChange={(e) => { setQ(e.target.value); setRes(null) }} placeholder="Paste a Solana mint address" inputProps={{ 'aria-label': 'Mint address', spellCheck: false }} sx={{ flex: 1, minWidth: 240, height: 42, px: 1.75, borderRadius: t.radius.input, background: t.color.hover, fontSize: 14, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: t.color.text }} />
        <Button type="submit" disabled={busy || !q.trim()} sx={{ ...Bt, height: 42, px: 2.5 }}>
          {busy ? 'Checking…' : 'Check'}
        </Button>
      </Box>
      {v && (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 2, p: 2, borderRadius: t.radius.panel, background: v.ok ? 'rgba(194,234,138,.10)' : 'rgba(255,120,120,.08)', border: `1px solid ${v.ok ? 'rgba(194,234,138,.3)' : 'rgba(255,120,120,.25)'}` }}>
          <Box sx={{ color: v.ok ? t.color.mark : t.color.red, mt: 0.25, flexShrink: 0 }}>{v.ok ? <CheckIcon size={18} /> : <CloseIcon size={18} />}</Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{v.title}</Typography>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>{v.text}</Typography>
          </Box>
        </Box>
      )}
    </Panel>
  )
}

export default function PrivateMarketsPage() {
  const pm = usePrivateMarkets()
  const [sel, setSel] = useState<string | null>(null)
  const tokens = useMemo(() => pm.data?.tokens ?? [], [pm.data])
  const live = useMemo(() => tokens.filter((x) => x.status === 'private').sort((a, b) => (b.market.marketCap ?? 0) - (a.market.marketCap ?? 0)), [tokens])
  const gone = useMemo(() => tokens.filter((x) => x.status !== 'private'), [tokens])
  const selected = tokens.find((x) => x.mint === sel)
  const compact = !!selected
  const sum = (k: 'liquidity' | 'volume24h' | 'holders') => live.reduce((a, x) => a + (x.market[k] ?? 0), 0)
  const pick = (mint: string) => {
    setSel(mint)
    if (window.innerWidth < 900) setTimeout(() => document.getElementById('private-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const ready = !!pm.data

  return (
    <Page>
      <PageHero
        label="Private Markets"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Live</Box>}
        title={
          <>
            Private companies.
            <br />
            Public prices.
          </>
        }
        lead={`Anthropic, OpenAI, Anduril, Neuralink and the rest of the private companies with a token: pre-IPO exposure issued by PreStocks on Solana, priced where it trades, read every minute. The fee, the pause switch and the supply come from the mint itself. ${BRAND.name} lists and links; the trade is yours, on Jupiter, in your own wallet.`}
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => live[0] && pick(live[0].mint)} disabled={!live.length} sx={{ ...Bt, gap: 1 }}>
              <TrendIcon size={15} /> Open the largest
            </Button>
            <Button component={Link} to="/docs#private-markets" sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
              <LockIcon size={14} /> How a pre-IPO token works
            </Button>
          </Box>
        }
      />

      <Stats items={[{ label: 'Private companies', value: ready ? live.length : '…' }, { label: 'Liquidity', value: ready ? fmtCompact(sum('liquidity')) : '…' }, { label: '24h volume', value: ready ? fmtCompact(sum('volume24h')) : '…' }, { label: 'Holders', value: ready ? sum('holders').toLocaleString('en-US') : '…' }]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>
        Prices, liquidity, volume and holders are read from Jupiter for the issuer's current mints; the transfer fee, the pause switch and the supply from each mint on Solana. Liquidity is the issuer's pools on Meteora and Raydium as Jupiter sees them. {pm.data && !pm.data.sources.jupiter ? 'Jupiter did not answer; prices are from DexScreener.' : ''} {pm.data && !pm.data.sources.solana ? 'The Solana RPC did not answer; the mint columns are blank.' : ''}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: selected ? 'minmax(0,1fr) 400px' : 'minmax(0,1fr)' }, gap: 2.5, mt: { xs: 5, md: 7 }, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography component="h2" className="still" sx={{ ...t.type.h3, color: t.color.text }}>Still private</Typography>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{ready ? `${live.length} companies · epoch ${pm.data?.epoch ?? '…'}` : 'Reading Jupiter and Solana…'}</Typography>
          </Box>
          <Panel sx={{ overflow: 'hidden' }}>
            <TableHead cols={compact ? [{ label: 'Company', grow: true }, { label: 'Price', align: 'right', w: 96 }, { label: '24h', align: 'right', w: 72 }, { label: 'Liquidity', align: 'right', hide: 'xs', w: 90 }, { label: 'Fee', align: 'right', hide: 'xs', w: 84 }] : [{ label: 'Company', grow: true }, { label: 'Price', align: 'right' }, { label: '24h', align: 'right', w: 90 }, { label: 'Liquidity', align: 'right', hide: 'xs' }, { label: '24h Volume', align: 'right', hide: 'sm' }, { label: 'Holders', align: 'right', hide: 'sm' }, { label: 'Fee', align: 'right', hide: 'xs' }]} />
            {!ready && <Typography sx={{ fontSize: 14, color: t.color.textMuted, p: 3 }}>{pm.isError ? 'Neither Jupiter nor DexScreener answered. Try again in a minute.' : 'Reading the issuer\'s mints…'}</Typography>}
            {live.map((x) => (
              <Row key={x.mint} onClick={() => pick(x.mint)}>
                <Cell grow>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <Mark logo={x.logo} letter={x.name[0]} size={36} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
                        {x.name}
                        {x.chain.paused && <Box component="span" sx={{ fontSize: 10, px: 0.75, py: 0.125, borderRadius: '5px', background: 'rgba(255,120,120,.14)', color: t.color.red }}>Paused</Box>}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: t.color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{compact ? x.symbol : `${x.symbol} · ${x.about}`}</Typography>
                    </Box>
                  </Box>
                </Cell>
                <Cell align="right" w={compact ? 96 : undefined} sx={{ fontWeight: 500 }}>{x.market.price != null ? fmtUsd(x.market.price) : '…'}</Cell>
                <Cell align="right" w={compact ? 72 : 90}><Change v={x.market.change24h} /></Cell>
                <Cell align="right" hide="xs" w={compact ? 90 : undefined}>{x.market.liquidity != null ? fmtCompact(x.market.liquidity) : '…'}</Cell>
                {!compact && <Cell align="right" hide="sm">{x.market.volume24h != null ? fmtCompact(x.market.volume24h) : '…'}</Cell>}
                {!compact && <Cell align="right" hide="sm">{x.market.holders != null ? x.market.holders.toLocaleString('en-US') : '…'}</Cell>}
                <Cell align="right" hide="xs" w={compact ? 84 : undefined} sx={{ color: x.chain.nextFeeBps != null ? t.color.text : undefined }}>{fmtFee(x.chain.feeBps)}{x.chain.nextFeeBps != null ? ` → ${fmtFee(x.chain.nextFeeBps)}` : ''}</Cell>
              </Row>
            ))}
          </Panel>
          <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.25 }}>Fee is the Token-2022 transfer fee the mint charges on every transfer, the buy included; an arrow means the issuer has scheduled a change for the next epoch. Open a row for the mint, the supply and the links.</Typography>

          {gone.length > 0 && (
            <Box sx={{ mt: { xs: 5, md: 7 } }}>
              <Typography component="h2" className="gone" sx={{ ...t.type.h3, color: t.color.text }}>No longer private</Typography>
              <Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 1 }}>Both ways a pre-IPO token ends, read from the same feeds.</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2.5 }}>
                {gone.map((x) => (
                  <Panel key={x.mint} sx={{ p: 2.5, cursor: 'pointer', '&:hover': { background: t.color.panelHover } }} >
                    <Box onClick={() => pick(x.mint)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && pick(x.mint)}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Mark logo={x.logo} letter={x.name[0]} size={36} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{x.name}</Typography>
                          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{x.symbol}</Typography>
                        </Box>
                        <Box sx={{ fontSize: 11, px: 1, py: 0.25, borderRadius: '6px', background: t.color.hover, color: t.color.textMuted, whiteSpace: 'nowrap' }}>{x.status === 'listed' ? 'Listed' : 'Conversion closed'}</Box>
                      </Box>
                      <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 1.5, lineHeight: 1.5 }}>{x.note}</Typography>
                      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.25 }}>
                        Left in the pool: {x.market.liquidity != null ? fmtCompact(x.market.liquidity) : '…'} · {x.market.holders != null ? `${x.market.holders.toLocaleString('en-US')} holders` : '…'} · fee {fmtFee(x.chain.feeBps)}
                      </Typography>
                    </Box>
                    {x.ticker && (
                      <Button component={Link} to={`/assets/${x.ticker}`} sx={{ ...Lt, backdropFilter: 'none', height: 34, px: 1.75, mt: 1.75, gap: 0.75 }}>
                        {x.ticker} in Markets
                      </Button>
                    )}
                  </Panel>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ mt: { xs: 5, md: 7 } }}>
            <MintCheckPanel />
          </Box>
        </Box>
        <Box id="private-panel" sx={{ minWidth: 0, scrollMarginTop: 96 }}>
          {selected && <CompanyPanel key={selected.mint} x={selected} onClose={() => setSel(null)} />}
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<LockIcon size={20} />} title="The issuer holds the exposure" text="PreStocks takes exposure to a private company's shares through vehicles that hold them, and issues one Token-2022 mint on Solana per company against it. The token is a claim on that exposure under the issuer's terms: no shares in your name, no vote, no dividend." />
          <Step n={2} icon={<TrendIcon size={20} />} title="The price is the pool" text="Each mint trades in pools on Meteora and Raydium, reached through Jupiter. The price here is the last trade in those pools, not the company's last funding round, and it moves with every buy and sell. Liquidity tells you how far a trade of yours would move it." />
          <Step n={3} icon={<UsersIcon size={20} />} title="The exit is the issuer's" text="When a company lists or is bought, the issuer converts, redeems or refunds the token under its terms. SpaceX listed and its public stock trades as SPCX; xAI's token had a conversion window, now closed. Both are shown above, with what is left in their pools." />
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
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>{BRAND.name} lists. It does not sell.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            There is no {BRAND.name} contract on this page and nothing to connect. Every number is read from Jupiter and from the mint on Solana as you look. Trade opens Jupiter with the current mint already selected; your Solana wallet signs there, and the token lands in it. PreStocks is the issuer and sets the terms; {BRAND.name} has no relationship with it and takes no fee.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <Box component="a" href={ISSUER.url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>
              PreStocks <ExternalIcon size={12} />
            </Box>
            <Box component="a" href={ISSUER.terms} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>
              Issuer terms <ExternalIcon size={12} />
            </Box>
            <Box component="a" href="https://jup.ag" target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>
              Jupiter <ExternalIcon size={12} />
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[
            [<GlobeIcon size={18} />, 'Exposure, not shares', 'A token is the issuer\'s promise about its exposure to the company, under terms you accept by holding it. The issuer\'s terms exclude U.S. persons. If the issuer fails, the token fails with it, whatever the company does.'],
            [<ShieldIcon size={18} />, 'The token has switches', 'Every mint carries a transfer fee, a pause switch and a permanent delegate held by the issuer. The fee is taken on every transfer, your buy included, and can be changed with an epoch\'s notice. All of it is read from the mint and shown in the row.'],
            [<CheckIcon size={18} />, 'Mints get replaced', `The issuer has retired ${RETIRED_COUNT} earlier mints, renamed OUTDATED or REFUNDED onchain but still carrying the PreStocks name. Only the mints in the list above trade today. Paste anything else into the check before you buy it.`],
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
      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 3 }}>Mints shown: {tokens.map((x) => `${x.symbol} ${shortMint(x.mint)}`).join(' · ')}</Typography>
    </Page>
  )
}
