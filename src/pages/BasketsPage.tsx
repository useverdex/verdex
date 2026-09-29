import { useMemo, useState } from 'react'
import { Avatar, Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt } from '../theme/styles'
import { AUTO_CATEGORIES, CHAIN_NAME_LOGOS, ISSUER_LOGOS, autoCategory, autoReturn, fmtCompact, fmtUsd, useAssets, useAutomatedBaskets, useBaskets, useGliderBaskets, type AutoBasket, type Basket } from '../lib/api'
import { resolveImg } from '../lib/img'
import { pub } from '../lib/base'
import { ArrowRightIcon } from '../components/icons'
import { AvatarStack, Chips, Page, PageHero, Panel, Pct, Stats } from './common'
import { Pill } from '../components/ui'
import { MARK_SRC } from '../components/Logo'
import { scrollToId } from '../navData'


function IsoCard({ x, y, w, h, title, children, delay = 0 }: { x: number; y: number; w: number; h: number; title?: string; children?: React.ReactNode; delay?: number }) {
  return (
    <Box sx={{ position: 'absolute', left: x, top: y, width: w, height: h, transform: 'matrix(0.866025, 0.5, 0, 1, 0, 0)', transformOrigin: 'top left', borderRadius: '10px', background: t.color.page, border: `1px solid rgba(255,255,255,.4)`, boxShadow: '0 24px 60px rgba(0,0,0,.45)', p: 1.5, '@keyframes isoIn': { from: { opacity: 0, transform: 'matrix(0.866025, 0.5, 0, 1, 0, 24)' }, to: { opacity: 1 } }, animation: `isoIn .7s ease ${delay}s both` }}>
      {title && <Typography sx={{ fontSize: 15, fontWeight: 500, color: t.color.text }}>{title}</Typography>}
      {children}
    </Box>
  )
}

function Aggregator() {
  const { data: b } = useBaskets()
  const icons = (b?.baskets ?? []).slice(0, 12).map((x) => resolveImg(x.icon))
  const pill = (label: string, logo?: string) => (
    <Box key={label} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 26, px: 1, borderRadius: '6px', border: `1px solid ${t.color.borderPanel}`, background: t.color.panel, fontSize: 12, fontWeight: 500 }}>
      {logo && <Avatar src={logo} sx={{ width: 14, height: 14, background: t.color.chip }} />}
      {label}
    </Box>
  )
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 4, alignItems: 'center', pt: t.layout.sectionTop }}>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Pill>The Aggregator</Pill>
        </Box>
        <Typography component="h2" sx={{ ...t.type.h2, color: t.color.text }}>
          Every Issuer. Every Chain. One Order.
        </Typography>
        <Typography sx={{ ...t.type.lead, color: t.color.textMuted, mt: 3, maxWidth: 560 }}>{BRAND.name} unifies tokenized stock baskets across issuers and chains, so a diversified portfolio is a single decision.</Typography>
        <Box sx={{ display: 'grid', gap: 3, mt: 4 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Index Baskets</Typography>
            <Typography sx={{ ...t.type.small, color: t.color.textMuted }}>
              A whole portfolio in one token. <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>Fully backed. Redeemable any time. Zero {BRAND.name} fee.</Box>
            </Typography>
            <Box sx={{ mt: 1 }}>{pill('Reserve', ISSUER_LOGOS.Reserve)}</Box>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Strategy Baskets</Typography>
            <Typography sx={{ ...t.type.small, color: t.color.textMuted }}>
              Invest like the names you follow. <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>Target weights</Box>, <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>equal weight</Box>, or <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>your own</Box>.
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Issuers and Chains</Typography>
            <Typography sx={{ ...t.type.small, color: t.color.textMuted }}>Real stock exposure from every issuer, on the chains you already use.</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>{['Ondo', 'Coinbase', 'Robinhood'].map((n) => pill(n, ISSUER_LOGOS[n]))}</Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>{['BNB Chain', 'Base', 'Ethereum', 'Robinhood Chain'].map((n) => pill(n, CHAIN_NAME_LOGOS[n]))}</Box>
          </Box>
        </Box>
      </Box>
      <Box aria-hidden sx={{ position: 'relative', height: { xs: 420, md: 560 }, display: { xs: 'none', sm: 'block' }, overflow: 'visible', mx: 'auto', width: '100%', maxWidth: 620 }}>
        <IsoCard x={40} y={220} w={250} h={300} title="Chains & Assets" delay={0.1}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>{icons.map((s, i) => <Avatar key={i} src={s} sx={{ width: 26, height: 26, background: z.surface2 }} />)}</Box>
        </IsoCard>
        <IsoCard x={10} y={330} w={110} h={100} delay={0.35}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}><Avatar src={pub("/img/static_debank_com__790d0c3a6da87111b66255c0d57108fa.png")} sx={{ width: 26, height: 26, background: z.surface2 }} /><Typography sx={{ fontSize: 14, fontWeight: 500 }}>USDT</Typography></Box>
        </IsoCard>
        <IsoCard x={10} y={440} w={110} h={100} delay={0.45}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}><Avatar src={pub("/img/raw_githubusercontent_com__logo.png")} sx={{ width: 26, height: 26, background: z.surface2 }} /><Typography sx={{ fontSize: 14, fontWeight: 500 }}>USDC</Typography></Box>
        </IsoCard>
        <IsoCard x={140} y={400} w={110} h={100} delay={0.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}><Avatar src={pub("/img/s2_coinmarketcap_com__33793.png")} sx={{ width: 26, height: 26, background: z.surface2 }} /><Typography sx={{ fontSize: 14, fontWeight: 500 }}>USDG</Typography></Box>
        </IsoCard>
        <IsoCard x={150} y={510} w={110} h={100} delay={0.55}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}><Avatar src={pub("/logos/chains/1.svg")} sx={{ width: 26, height: 26, background: z.surface2 }} /><Typography sx={{ fontSize: 14, fontWeight: 500 }}>ETH</Typography></Box>
        </IsoCard>
        <IsoCard x={230} y={150} w={250} h={380} title={BRAND.name} delay={0.2}>
          <Box sx={{ display: 'grid', gap: 1, mt: 2, maxWidth: 130, ml: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: '8px', border: `1px solid ${t.color.borderStrong}`, fontSize: 12, fontWeight: 500 }}><Avatar src={ISSUER_LOGOS.Reserve} sx={{ width: 16, height: 16 }} />Index baskets</Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: '8px', border: `1px solid ${t.color.borderStrong}`, fontSize: 12, fontWeight: 500 }}><Avatar src={MARK_SRC} sx={{ width: 16, height: 16, background: 'transparent' }} />Strategies</Box>
          </Box>
        </IsoCard>
        <IsoCard x={400} y={60} w={200} h={340} title="Issuers" delay={0.3}>
          <Box sx={{ display: 'grid', gap: 1, mt: 8 }}>
            {['Ondo', 'xStocks', 'bStocks', 'Robinhood', 'Coinbase'].map((n) => (
              <Box key={n} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: '8px', border: `1px solid ${t.color.borderStrong}`, fontSize: 12, fontWeight: 500, width: 100 }}>
                <Avatar src={ISSUER_LOGOS[n]} sx={{ width: 16, height: 16, background: t.color.chip }} />
                {n}
              </Box>
            ))}
          </Box>
        </IsoCard>
      </Box>
    </Box>
  )
}

function IndexBasketCard({ b }: { b: Basket }) {
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Avatar src={resolveImg(b.icon)} alt={b.symbol} sx={{ width: 44, height: 44, background: z.surface2 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{b.name}</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>
            {fmtUsd(b.price)} · ${b.symbol}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 16 }}>
            <Pct v={b.changeYtd} />
          </Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>YTD</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {b.holdings.map((h) => (
          <Box key={h.symbol} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, pl: 0.5, pr: 1, py: 0.25, borderRadius: '6px', background: t.color.hover, fontSize: 12 }}>
            <Avatar src={resolveImg(h.logo)} sx={{ width: 16, height: 16, background: z.surface2, fontSize: 8 }}>{h.ticker[0]}</Avatar>
            <Box component="span" sx={{ fontWeight: 500 }}>{h.ticker}</Box>
            <Box component="span" sx={{ color: t.color.textMuted }}>{h.weight.toFixed(h.weight < 10 ? 2 : 1)}%</Box>
          </Box>
        ))}
      </Box>
      {b.mandate && <Typography sx={{ fontSize: 13, color: t.color.textMuted, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.mandate}</Typography>}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 'auto', pt: 1 }}>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Avatar src={CHAIN_NAME_LOGOS[b.chain]} sx={{ width: 14, height: 14 }} />
          {b.chain} · {b.holders.toLocaleString('en-US')} holders
        </Typography>
        <Button component={Link} to={`/?buy=${b.symbol}`} sx={{ ...Bt, height: 34, px: '14px' }}>
          Buy
        </Button>
      </Box>
    </Panel>
  )
}

function AutomatedCard({ b, logoFor }: { b: AutoBasket; logoFor: (h: { symbol: string; logo?: string }) => string | undefined }) {
  const cat = autoCategory(b)
  const isCrypto = cat === 'Crypto' || cat === 'Yield and gold'
  const ret = autoReturn(b)
  return (
    <Panel sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{b.name}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: t.color.textMuted }}>
        {b.holdings.length} {isCrypto ? 'assets' : 'stocks'}
        <AvatarStack srcs={b.holdings.map((h) => logoFor(h))} size={16} max={5} />
      </Box>
      <Box sx={{ mt: 'auto' }}>
        <Typography sx={{ fontSize: 20, fontWeight: 500 }}>
          <Pct v={ret.value} />
        </Typography>
        <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>{ret.label}</Typography>
      </Box>
    </Panel>
  )
}

export default function BasketsPage() {
  const { data: b } = useBaskets()
  const { data: g } = useGliderBaskets()
  const { data: a } = useAutomatedBaskets()
  const { data: assetsFile } = useAssets()
  const tickerLogos = useMemo(() => new Map((assetsFile?.assets ?? []).map((x) => [x.ticker, resolveImg(x.logo)])), [assetsFile])
  const logoFor = (h: { symbol: string; logo?: string }) => tickerLogos.get(h.symbol) ?? resolveImg(h.logo)
  const index = useMemo(() => b?.baskets ?? [], [b])
  const strategies = useMemo(() => g?.baskets ?? [], [g])
  const auto = useMemo(() => [...(a?.baskets ?? [])].sort((x, y) => y.tvlUsd - x.tvlUsd), [a])
  const [cat, setCat] = useState('All')
  const stockCount = useMemo(() => new Set(strategies.flatMap((x) => x.holdings.map((h) => h.ticker))).size, [strategies])
  const chains = new Set([...index.map((x) => x.chain), ...strategies.map((x) => x.chain), ...auto.flatMap((x) => x.chains)]).size
  const cats = ['All', ...Object.keys(AUTO_CATEGORIES)]
  const counts = Object.fromEntries(cats.map((c) => [c, c === 'All' ? auto.length : auto.filter((x) => autoCategory(x) === c).length]))
  const grouped = (cat === 'All' ? Object.keys(AUTO_CATEGORIES) : [cat]).map((c) => ({ c, items: auto.filter((x) => autoCategory(x) === c) })).filter((x) => x.items.length)
  const totals = b?.totals
  return (
    <Page>
      <PageHero
        label="Tokenized Baskets"
        center
        title={
          <>
            Invest in a Theme.
            <br />
            Not One Stock at a Time.
          </>
        }
        lead={`${index.length + strategies.length} baskets. ${stockCount} tokenized stocks. ${chains} chains. Every issuer, unified in one place.`}
      />
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Button onClick={() => scrollToId('baskets')} sx={Bt}>
          Explore Baskets <ArrowRightIcon size={14} />
        </Button>
        <Button component={Link} to="/docs#tokenized-baskets" sx={Lt}>
          How Baskets Work
        </Button>
      </Box>

      <Aggregator />

      <Box id="baskets" sx={{ pt: t.layout.sectionTop }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 3, pb: 4 }}>
          <Box sx={{ maxWidth: 630 }}>
            <Box sx={{ mb: 3 }}>
          <Pill>Index Baskets</Pill>
        </Box>
            <Typography component="h2" sx={{ ...t.type.h2, color: t.color.text }}>
              One Token. A Whole Portfolio.
            </Typography>
            <Typography sx={{ ...t.type.lead, color: t.color.textMuted, mt: 3, maxWidth: 560 }}>
              <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>{totals?.count ?? index.length} baskets.</Box> Fully backed at published weights. Redeemable any time.
            </Typography>
          </Box>
          <Button component={Link} to="/rwa-baskets/discover" sx={{ ...Lt, flexShrink: 0 }}>
            Discover All Index Baskets
          </Button>
        </Box>
        <Stats items={[{ label: 'Total value', value: fmtCompact(totals?.value ?? index.reduce((s, x) => s + x.marketCap, 0)) }, { label: 'Holders', value: (totals?.holders ?? index.reduce((s, x) => s + x.holders, 0)).toLocaleString('en-US') }, { label: '24h mint and redeem', value: fmtCompact(totals?.volume24h ?? index.reduce((s, x) => s + x.volume24h, 0)) }, { label: 'Baskets', value: totals?.count ?? index.length }]} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' }, gap: 2.5, mt: 2.5 }}>
          {index.slice(0, 6).map((x) => (
            <IndexBasketCard key={x.address} b={x} />
          ))}
        </Box>
      </Box>

      <Box id="automated" sx={{ pt: t.layout.sectionTop }}>
        <Box sx={{ maxWidth: 630, pb: 4 }}>
          <Box sx={{ mb: 3 }}>
          <Pill>Automated Baskets</Pill>
        </Box>
          <Typography component="h2" sx={{ ...t.type.h2, color: t.color.text }}>
            {auto.length} Portfolios. Rebalanced for You.
          </Typography>
          <Typography sx={{ ...t.type.lead, color: t.color.textMuted, mt: 3, maxWidth: 560 }}>Stocks, crypto, gold and yield. Held in your own account and rebalanced automatically to target weights.</Typography>
        </Box>
        <Chips options={cats} value={cat} onChange={setCat} counts={counts} />
        {grouped.map(({ c, items }) => (
          <Box key={c} sx={{ mt: 4 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 500, mb: 2 }}>
              {c} <Box component="span" sx={{ color: t.color.textLabel, fontWeight: 400 }}>{items.length}</Box>
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' }, gap: 2 }}>
              {items.map((x) => (
                <AutomatedCard key={x.id} b={x} logoFor={logoFor} />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Page>
  )
}
