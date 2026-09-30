import { useRef, useState, type ReactNode } from 'react'
import { Avatar, Box, Button, Collapse, Typography } from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import { BRAND, ease, fonts, nt, t, z } from '../theme/tokens'
import { Bt, In, Lt, Vg, fH, tn } from '../theme/styles'
import { Reveal, Stagger, StaggerItem } from '../components/motion'
import { ArrowRightIcon, ArrowUpRightIcon, BarsIcon, BuildingIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, LayersIcon, LockIcon, MinusIcon, PlusIcon, SwapIcon, UsersIcon } from '../components/icons'
import { Chip, Container, CountUp, Pill, RoundButton, SectionHead, Tag } from '../components/ui'
import { Wordmark } from '../components/Logo'
import { useTokenLogo, ARC, ISSUER_INFO, ISSUER_LOGOS, ROBINHOOD, chainLogo, fmtCompact, toolLogo, useAssets, useBaskets, useChains, useTokens, useTools, type Token } from '../lib/api'
import { resolveImg } from '../lib/img'
import { pub } from '../lib/base'
import { DOC_SECTIONS } from '../data/docs'
import { actions } from '../store'

const USDG = '0x5fc5360d0400a0fd4f2af552add042d716f1d168'
const line = `1px solid ${t.color.borderPanel}`

function goSwap(tab: 'swap' | 'private' = 'swap') {
  actions.setWelcomeScreenClosed(true)
  actions.setSwapTab(tab)
  window.scrollTo({ top: 0 })
}

// ---------- live widgets (data from the bundled API snapshots and LI.FI) ----------

function WChip({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: '8px', fontFamily: fonts.mono, fontSize: 12, letterSpacing: '-0.02em', color: active ? z.primaryText : z.textSecondary, background: active ? z.primaryBg : nt[60], whiteSpace: 'nowrap' }}>
      {children}
    </Box>
  )
}

function TokenChip({ logo, label }: { logo?: string; label: string }) {
  return (
    <StaggerItem y={8}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, pl: 0.5, pr: 1.25, py: 0.5, borderRadius: '8px', background: nt[60], fontSize: 14, fontWeight: 500, letterSpacing: '-0.03em' }}>
        <Avatar src={logo} alt="" sx={{ width: 22, height: 22, background: z.surface2, fontSize: 12 }}>
          {label[0]}
        </Avatar>
        {label}
      </Box>
    </StaggerItem>
  )
}

const rowStyle = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } as const

function TradableNow() {
  const { data } = useTokens([ARC, ROBINHOOD])
  const logoOf = useTokenLogo()
  const pick = (chain: number, symbols: string[]) => symbols.map((s) => data?.tokens[chain]?.find((tk) => (s === 'USDG' ? tk.address.toLowerCase() === USDG : tk.symbol === s))).filter(Boolean) as Token[]
  const stables = [...pick(ARC, ['USDC', 'EURC']), ...pick(ROBINHOOD, ['USDG'])]
  const rwas = pick(ROBINHOOD, ['NVDA', 'AAPL', 'TSLA', 'SPY'])
  const arcCount = data?.tokens[ARC]?.length
  const rhCount = data?.tokens[ROBINHOOD]?.filter((tk) => (resolveImg(tk.logoURI) ?? '').includes('robinhood')).length
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography sx={{ ...t.type.body, color: t.color.text }}>Tradable right now</Typography>
        <Typography sx={{ ...t.type.small, color: t.color.textMuted }}>Live token lists for Arc and Robinhood Chain</Typography>
      </Box>
      <Stagger stagger={0.06} style={rowStyle}>
        <WChip active>Stablecoins</WChip>
        {stables.map((tk) => (
          <TokenChip key={`${tk.chainId}-${tk.address}`} logo={logoOf(tk)} label={tk.symbol} />
        ))}
      </Stagger>
      <Stagger stagger={0.06} delayChildren={0.25} style={rowStyle}>
        <WChip active>RWAs</WChip>
        {rwas.map((tk) => (
          <TokenChip key={`${tk.chainId}-${tk.address}`} logo={logoOf(tk)} label={tk.symbol} />
        ))}
      </Stagger>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 2, borderTop: line }}>
        <WChip>{arcCount ?? '-'} tokens on Arc</WChip>
        <WChip>{rhCount ?? '-'} stock tokens on Robinhood</WChip>
      </Box>
    </Box>
  )
}

function RouteCompare() {
  const { data } = useTools()
  const all = [...(data?.bridges ?? []), ...(data?.exchanges ?? [])]
  const find = (key: string, name: string) => all.find((x) => x.key === key) ?? { key, name, logoURI: undefined }
  const rows = [
    { tool: find('across', 'Across'), sub: 'Bridge', highlight: false },
    { tool: find('relaydepository', 'Relay'), sub: 'Intent solver', highlight: true },
    { tool: find('kyberswap', 'KyberSwap'), sub: 'DEX aggregator', highlight: false },
  ]
  return (
    <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' }, alignItems: 'center', gap: { xs: 1.5, sm: 3 } }}>
      <Stagger style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(({ tool, sub, highlight }) => (
          <StaggerItem key={tool.key} x={-20} y={0}>
            <Box sx={{ ...fH, ml: highlight ? { sm: 3 } : 0, background: highlight ? z.primaryBg : nt[35], transition: `transform .25s ${ease}`, '&:hover': { transform: 'translateX(4px)' } }}>
              <Avatar src={toolLogo(tool as { key: string; logoURI: string })} alt="" sx={{ width: 36, height: 36, borderRadius: '10px', background: highlight ? 'rgba(0,0,0,.08)' : z.surface2, color: z.text }}>
                {tool.name[0]}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 14, fontWeight: 500, color: highlight ? z.primaryText : z.text }}>
                  {tool.name}
                </Typography>
                <Typography noWrap sx={{ fontSize: 14, color: highlight ? 'rgba(0,0,0,.6)' : z.textMuted }}>
                  {sub}
                </Typography>
              </Box>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal delay={0.35} y={12}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <WChip>Compared live</WChip>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, borderRadius: '8px', background: z.accent, color: z.primaryText, fontSize: 14, fontWeight: 500 }}>
            <CheckIcon size={14} /> Best Return
          </Box>
          <WChip>Fastest</WChip>
        </Box>
      </Reveal>
    </Box>
  )
}

const GRID_CHAINS = [ARC, ROBINHOOD, 1, 8453, 42161, 1151111081099710, 20000000000001, 9270000000000000, 56, 999, 10, 137]

function ChainGrid() {
  const { data } = useChains()
  const mainnet = (data ?? []).filter((c) => c.mainnet)
  const count = (type: string) => mainnet.filter((c) => c.chainType === type).length
  const shown = GRID_CHAINS.map((id) => mainnet.find((c) => c.id === id)).filter(Boolean)
  return (
    <Box sx={{ width: '100%' }}>
      <Stagger stagger={0.04}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(6, 1fr)' }, gap: 1.25 }}>
          {shown.map((c) => (
            <StaggerItem key={c!.id} y={12}>
              <Box title={c!.name} sx={{ aspectRatio: '1', display: 'grid', placeItems: 'center', borderRadius: '12px', border: `1px solid ${c!.id === ARC || c!.id === ROBINHOOD ? 'rgba(143,166,97,.5)' : 'transparent'}`, background: nt[35], transition: `transform .25s ${ease}, background .25s ${ease}`, '&:hover': { transform: 'translateY(-2px)', background: nt[60] } }}>
                <Avatar src={chainLogo(c!)} alt={c!.name} sx={{ width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 }, background: 'transparent' }} />
              </Box>
            </StaggerItem>
          ))}
        </Box>
      </Stagger>
      <Typography sx={{ mt: 2.5, ...t.type.caption, color: z.textMuted }}>Routing across {mainnet.length || '-'} chains</Typography>
      <Box sx={{ mt: 1.25, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <WChip>{count('EVM')} EVM</WChip>
        <WChip>{count('SVM')} Solana</WChip>
        <WChip>{count('UTXO')} Bitcoin</WChip>
        <WChip>{count('MVM')} Sui</WChip>
      </Box>
    </Box>
  )
}

function StepRow({ label, sub, icon, highlight, muted }: { label: string; sub?: string; icon: ReactNode; highlight?: boolean; muted?: boolean }) {
  return (
    <Box sx={{ ...fH, py: 1.25, opacity: muted ? 0.7 : 1 }}>
      <Box sx={{ width: 28, height: 28, flexShrink: 0, borderRadius: '8px', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 500, background: highlight ? z.accent : nt[60], color: highlight ? z.primaryText : z.text }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
          {label}
        </Typography>
        {sub && (
          <Typography noWrap sx={{ fontSize: 12, color: z.textMuted }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

const TRACKED = [
  { label: 'Token approval', sub: 'Only when the token needs it' },
  { label: 'Send on source chain', sub: 'One signature from your own address' },
  { label: 'Bridge and swap', sub: 'Status tracked until settled' },
  { label: 'Received on destination', sub: 'Refund status shown if a route fails' },
]

function TrackedSteps() {
  return (
    <Box sx={{ width: '100%' }}>
      <Stagger stagger={0.12} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TRACKED.map((s, i) => (
          <StaggerItem key={s.label} x={-16} y={0}>
            <StepRow label={s.label} sub={s.sub} icon={<CheckIcon size={15} />} highlight={i === TRACKED.length - 1} />
          </StaggerItem>
        ))}
      </Stagger>
    </Box>
  )
}

// ---------- sections ----------

const cover = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' } as const

// Sentira "About" block: image card with the headline number, text card with three live stats.
function MarketsSection() {
  const navigate = useNavigate()
  const { data: assets } = useAssets()
  const { data: chains } = useChains()
  const { data: tools } = useTools()
  const assetCount = assets?.assets.length ?? 0
  const mainnet = (chains ?? []).filter((c) => c.mainnet).length
  const routes = (tools?.bridges.length ?? 0) + (tools?.exchanges.length ?? 0)
  const issuers = Object.keys(ISSUER_INFO).length
  const rows = [
    { label: 'Chains routed', value: mainnet ? `${mainnet}` : '-' },
    { label: 'Bridges and DEXs', value: routes ? `${routes}` : '-' },
    { label: 'Issuers side by side', value: `${issuers}` },
  ]
  return (
    <Container>
      <SectionHead
        id="markets"
        label="Markets"
        title={
          <>
            Every issuer. Every chain.
            <br />
            Best price.
          </>
        }
        action={
          <Button onClick={() => navigate('/assets')} sx={Bt}>
            Explore Assets
          </Button>
        }
      />
      <Box sx={{ display: 'grid', gap: '16px', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '2fr 1fr' } }}>
        <Reveal y={20}>
          <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: t.radius.card, minHeight: { xs: 340, md: 400 }, p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <Box component="img" src={pub('/wallstreet.webp')} alt="" loading="lazy" sx={{ ...cover, filter: 'grayscale(1) contrast(1.05)' }} />
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: t.color.green, mixBlendMode: 'color', opacity: 0.85 }} />
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,6,6,.1) 0%, rgba(6,6,6,.35) 50%, rgba(6,6,6,.92) 100%)' }} />
            <Box sx={{ position: 'relative' }}>
              <Typography sx={{ ...t.type.stat, color: t.color.text }}>{assetCount ? <CountUp value={`${assetCount}+`} /> : '-'}</Typography>
              <Typography sx={{ ...t.type.body, color: t.color.text, mt: 1.5 }}>Tokenized assets</Typography>
              <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 0.5, maxWidth: 520 }}>Stocks, ETFs, commodities, private credit and treasuries from every issuer, on every chain.</Typography>
            </Box>
          </Box>
        </Reveal>
        <Reveal delay={0.1} y={20} style={{ height: '100%' }}>
          <Box sx={{ background: t.color.raised, borderRadius: t.radius.card, p: { xs: 3, md: 3.25 }, minHeight: { md: 400 }, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4 }}>
            <Typography sx={{ ...t.type.body, color: t.color.textSoft }}>Tokenized stocks, stablecoins and any other token, priced across every DEX, bridge and solver, and the best return comes first.</Typography>
            <Box>
              {rows.map((r) => (
                <Box key={r.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 2, borderTop: line }}>
                  <Typography sx={{ ...t.type.lead, color: t.color.text }}>{r.label}</Typography>
                  <Typography sx={{ ...t.type.lead, color: t.color.textLabel, whiteSpace: 'nowrap' }}>{r.value === '-' ? '-' : <CountUp value={r.value} />}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Reveal>
      </Box>
    </Container>
  )
}

const SERVICES = [
  { n: '01', title: 'Trade', icon: BarsIcon, tags: ['Stocks', 'ETFs', 'Commodities', 'Stablecoins'], body: 'Tokenized stocks like NVDA and TSLA from every issuer, next to stablecoins and thousands of other tokens.', cta: 'Explore Assets', to: '/assets', widget: <TradableNow /> },
  { n: '02', title: 'Route', icon: SwapIcon, tags: ['DEXs', 'Bridges', 'Solvers'], body: 'Every trade is priced across DEXs, bridges and solvers, and the best return comes first.', cta: 'Swap and Bridge', widget: <RouteCompare /> },
  { n: '03', title: 'Bridge', icon: LayersIcon, tags: ['EVM', 'Solana', 'Bitcoin', 'Sui'], body: 'Ethereum, Base, Solana, BNB Chain, Robinhood Chain, Bitcoin, Sui and many more, without learning a new bridge.', cta: 'Swap and Bridge', widget: <ChainGrid /> },
  { n: '04', title: 'Track', icon: CheckIcon, tags: ['Approval', 'Send', 'Settle', 'Refunds'], body: `${BRAND.name} follows every transfer from approval to arrival and shows you if anything needs attention.`, cta: 'Swap and Bridge', widget: <TrackedSteps /> },
]

// Sentira "Services" accordion, each row opening onto a live widget.
function ServicesSection() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(0)
  return (
    <Box>
      <Container>
        <SectionHead id="trade" center label="Trade" title="Every stock, every chain, best price on every trade." />
      </Container>
      <Box sx={{ borderBottom: line }}>
        {SERVICES.map((s, i) => {
          const on = open === i
          const Icon = s.icon
          return (
            <Box key={s.n} sx={{ borderTop: line, background: on ? 'rgba(255,255,255,.015)' : 'transparent', transition: `background ${t.motion.base}` }}>
              <Container>
                <Box component="button" type="button" aria-expanded={on} onClick={() => setOpen(on ? -1 : i)} sx={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, pt: { xs: 3, md: 4 }, pb: on ? 3 : { xs: 3, md: 4 } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box sx={{ display: 'flex', color: t.color.text, mt: { xs: 0.5, md: 1 } }}>
                        <Icon size={34} strokeWidth={1.6} />
                      </Box>
                      <Typography component="h3" sx={{ ...t.type.h3, color: t.color.text }}>
                        {s.title}
                      </Typography>
                      <Typography component="span" sx={{ ...t.type.body, color: t.color.textLabel, mt: 0.5 }}>
                        {s.n}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
                      {s.tags.map((tag) => (
                        <Chip key={tag}>{tag}</Chip>
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: t.color.chip, color: t.color.text, transition: `transform ${t.motion.base}, background ${t.motion.base}`, transform: on ? 'rotate(45deg)' : 'none' }}>
                    <PlusIcon size={20} />
                  </Box>
                </Box>
                <Collapse in={on} timeout={360} unmountOnExit>
                  <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.9fr) minmax(0, 1fr)' }, alignItems: 'end', pb: { xs: 4, md: 5 } }}>
                    <Box sx={{ ...In, p: { xs: 2.5, sm: 3.5 }, minHeight: { md: 350 }, display: 'flex', alignItems: 'center' }}>{s.widget}</Box>
                    <Box sx={{ maxWidth: 380 }}>
                      <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>{s.body}</Typography>
                      <Button fullWidth onClick={() => (s.to ? navigate(s.to) : goSwap())} sx={{ ...tn, mt: 3 }}>
                        {s.cta}
                      </Button>
                    </Box>
                  </Box>
                </Collapse>
              </Container>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

const STEPS = [
  { n: '01', title: 'Connect and pick', tag: 'Any wallet', body: 'Connect a wallet and pick any tokenized stock, ETF, commodity or token, on any chain.', image: '/design/step-1.webp' },
  { n: '02', title: 'Compare and swap', tag: 'One signature', body: 'Every route is priced live across DEXs, bridges and solvers. The best return comes first.', image: '/design/step-2.webp' },
  { n: '03', title: 'Track and hold', tag: 'Non-custodial', body: 'Tracked until it lands. Then lend, borrow or add it to a basket, from your own address.', image: '/design/step-3.webp' },
]

function ProcessSection() {
  return (
    <Container>
      <SectionHead id="how-it-works" center label="How it works" title="Getting the best price without the guesswork." />
      <Box sx={{ display: 'grid', gap: '16px', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' } }}>
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08} y={20}>
            <Box sx={{ ...In, height: 250, display: 'grid', placeItems: 'center' }}>
              <Box sx={{ position: 'relative', width: 140, height: 140, borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                <Box component="img" src={pub(s.image)} alt="" loading="lazy" sx={{ ...cover, filter: `hue-rotate(${i * 40}deg)` }} />
                <Typography sx={{ ...t.type.h1, position: 'relative', color: 'rgba(255,255,255,.85)', lineHeight: 1 }}>{s.n}</Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'center', mt: 3, px: 2 }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}>
                <Typography component="h3" sx={{ ...t.type.cardTitle, color: t.color.text }}>
                  {s.title}
                </Typography>
                <Tag>{s.tag}</Tag>
              </Box>
              <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 1, maxWidth: 320, mx: 'auto' }}>{s.body}</Typography>
            </Box>
          </Reveal>
        ))}
      </Box>
    </Container>
  )
}

function pct(v?: number) {
  if (v == null || !isFinite(v)) return '-'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

// Sentira "Case studies": sticky, stacking full-width cards, one per basket.
function BasketsSection() {
  const { data } = useBaskets()
  const baskets = (data?.baskets ?? []).slice(0, 4)
  const total = data?.baskets.length ?? 0
  return (
    <Container>
      <SectionHead id="baskets" label="Tokenized Baskets" title="Invest in a theme. Not one stock at a time." action={<Button component={Link} to="/rwa-baskets" sx={Bt}>Explore Baskets</Button>} />
      <Box sx={{ position: 'relative' }}>
        {baskets.map((b, i) => (
          <Box key={b.address} component={Link} to="/rwa-baskets" sx={{ position: 'sticky', top: { xs: 88, md: 100 }, display: 'block', mb: { xs: 2, md: 3 }, height: { xs: 560, md: 'min(720px, calc(100vh - 140px))' }, borderRadius: t.radius.card, overflow: 'hidden', textDecoration: 'none', color: 'inherit', boxShadow: '0 -10px 40px rgba(0,0,0,.5)' }}>
            <Box component="img" src={pub('/design/gradient.webp')} alt="" loading="lazy" sx={{ ...cover, filter: `hue-rotate(${i * 55}deg) saturate(1.1)`, transform: 'scale(1.02)' }} />
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 60% at 50% 40%, rgba(6,6,6,0) 0%, rgba(6,6,6,.55) 100%)' }} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 }, gap: { xs: 1.5, md: 2.5 } }}>
              <Typography sx={{ ...t.type.h1, color: t.color.text }}>{String(i + 1).padStart(2, '0')}</Typography>
              <Box sx={{ width: '100%', maxWidth: 800, flex: 1, minHeight: 0, maxHeight: 520, borderRadius: '6px', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', p: { xs: 2.5, md: 4 }, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 3 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Avatar src={resolveImg(b.icon)} alt="" sx={{ width: 32, height: 32, background: z.surface2, fontSize: 12 }}>
                      {b.symbol[0]}
                    </Avatar>
                    <Chip>{b.symbol}</Chip>
                    <Chip>{b.chain}</Chip>
                  </Box>
                  <Typography component="h3" sx={{ ...t.type.h2, color: t.color.text }}>
                    {b.name}
                  </Typography>
                  <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 1.5, maxWidth: 560, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.mandate}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip>{fmtCompact(b.marketCap)} market cap</Chip>
                    <Chip>{b.holders.toLocaleString('en-US')} holders</Chip>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ ...t.type.h3, color: t.color.text }}>{pct(b.changeYtd)}</Typography>
                    <Typography sx={{ ...t.type.body, color: t.color.textMuted }}>Year to date</Typography>
                  </Box>
                </Box>
              </Box>
              <Typography sx={{ ...t.type.h1, color: 'rgba(255,255,255,.6)' }}>{String(total).padStart(2, '0')}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Container>
  )
}

const WITH = [
  { icon: <SwapIcon size={18} />, text: 'Best price across every DEX and bridge' },
  { icon: <BuildingIcon size={18} />, text: 'Every issuer side by side' },
  { icon: <LayersIcon size={18} />, text: '50+ chains in one place' },
  { icon: <CheckIcon size={18} />, text: 'Tracked until it lands' },
  { icon: <LockIcon size={18} />, text: 'Non-custodial: your keys, your assets' },
]
const WITHOUT = ['One DEX, one price', 'One issuer at a time', 'A new bridge for every chain', 'Transfers you have to babysit', 'Custody risk on every trade']

function WhySection() {
  return (
    <Container>
      <SectionHead id="why" center label={`Why ${BRAND.name}`} title="This is what makes it actually different." />
      <Reveal y={20}>
        <Box sx={{ position: 'relative', maxWidth: 910, mx: 'auto', background: t.color.chip, borderRadius: '18px', p: '5px', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: '5px' }}>
          <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: t.radius.card, p: { xs: 3, md: 3.5 }, minHeight: { md: 370 }, display: 'flex', flexDirection: 'column', gap: { xs: 4, md: 9 } }}>
            <Box component="img" src={pub('/design/gradient.webp')} alt="" loading="lazy" sx={{ ...cover, opacity: 0.85 }} />
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'rgba(6,6,6,.35)' }} />
            <Typography sx={{ ...t.type.h4, color: t.color.text, position: 'relative' }}>With {BRAND.name}</Typography>
            <Stagger stagger={0.08} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {WITH.map((w) => (
                <StaggerItem key={w.text} x={-12} y={0}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: t.color.text }}>
                    <Box sx={{ display: 'flex', flexShrink: 0 }}>{w.icon}</Box>
                    <Typography sx={{ ...t.type.lead, color: t.color.text }}>{w.text}</Typography>
                  </Box>
                </StaggerItem>
              ))}
            </Stagger>
          </Box>
          <Box sx={{ p: { xs: 3, md: 3.5 }, display: 'flex', flexDirection: 'column', gap: { xs: 4, md: 9 } }}>
            <Typography sx={{ ...t.type.h4, color: t.color.text }}>Without {BRAND.name}</Typography>
            <Stagger stagger={0.08} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {WITHOUT.map((w) => (
                <StaggerItem key={w} x={12} y={0}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: t.color.textMuted }}>
                    <Box sx={{ display: 'flex', flexShrink: 0 }}>
                      <CloseIcon size={18} />
                    </Box>
                    <Typography sx={{ ...t.type.lead, color: t.color.textMuted }}>{w}</Typography>
                  </Box>
                </StaggerItem>
              ))}
            </Stagger>
          </Box>
          <Box aria-hidden sx={{ position: 'absolute', left: '50%', top: { xs: '50%', md: 'calc(50% - 12px)' }, transform: 'translate(-50%, -50%)', px: '14px', pt: '5px', pb: '4px', borderRadius: '11px', background: t.color.accent, color: t.color.onAccent, ...t.type.lead, fontSize: 18 }}>
            VS
          </Box>
        </Box>
      </Reveal>
    </Container>
  )
}

// Sentira "Team" carousel, one card per issuer.
function IssuersSection() {
  const { data: assets } = useAssets()
  const scroller = useRef<HTMLDivElement | null>(null)
  const names = Object.keys(ISSUER_INFO)
  const count = (name: string) => (assets?.assets ?? []).filter((a) => a.issuers?.includes(name)).length
  const scroll = (d: number) => scroller.current?.scrollBy({ left: d * 316, behavior: 'smooth' })
  return (
    <Box>
      <Container>
        <SectionHead
          id="issuers"
          label="Issuers"
          title="The issuers behind every asset."
          action={
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <RoundButton aria-label="Scroll left" onClick={() => scroll(-1)}>
                <ChevronLeftIcon size={16} />
              </RoundButton>
              <RoundButton light aria-label="Scroll right" onClick={() => scroll(1)}>
                <ChevronRightIcon size={16} />
              </RoundButton>
            </Box>
          }
        />
      </Container>
      <Box ref={scroller} sx={{ display: 'flex', gap: '16px', overflowX: 'auto', scrollSnapType: 'x mandatory', px: { xs: t.layout.gutter.xs, sm: t.layout.gutter.sm, lg: `max(${t.layout.gutter.lg}, calc((100vw - ${t.layout.maxWidth}px) / 2))` }, pb: 2, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {names.map((name, i) => {
          const info = ISSUER_INFO[name]
          const n = count(name)
          return (
            <Box key={name} sx={{ ...In, background: t.color.raised, borderRadius: '12px', width: 300, flexShrink: 0, scrollSnapAlign: 'start', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ position: 'relative', height: 220, display: 'grid', placeItems: 'center' }}>
                <Box component="img" src={pub('/design/gradient.webp')} alt="" loading="lazy" sx={{ ...cover, opacity: 0.55, filter: `hue-rotate(${i * 30}deg)` }} />
                <Typography sx={{ ...t.type.overline, position: 'absolute', left: 18, top: 16, color: t.color.text }}>
                  {String(i + 1).padStart(2, '0')} / {String(names.length).padStart(2, '0')}
                </Typography>
                <Avatar src={ISSUER_LOGOS[name]} alt={name} sx={{ position: 'relative', width: 88, height: 88, borderRadius: '22px', background: t.color.page, fontSize: 28, boxShadow: '0 12px 30px rgba(0,0,0,.4)' }}>
                  {name[0]}
                </Avatar>
              </Box>
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                <Typography sx={{ ...t.type.overline, color: t.color.textMuted }}>{info.by}</Typography>
                <Typography component="h3" sx={{ ...t.type.cardTitle, color: t.color.text }}>
                  {name}
                </Typography>
                <Typography sx={{ ...t.type.small, color: t.color.textMuted, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{info.about}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 'auto', pt: 1.5 }}>
                  <Box component="a" href={info.url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ...t.type.caption, fontSize: 13, color: t.color.text, textDecoration: 'none', '&:hover': { color: t.color.green } }}>
                    <ArrowUpRightIcon size={13} /> Website
                  </Box>
                  <Box component={Link} to="/issuers" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ...t.type.caption, fontSize: 13, color: t.color.text, textDecoration: 'none', '&:hover': { color: t.color.green } }}>
                    <UsersIcon size={13} /> {n ? `${n} assets` : 'Assets'}
                  </Box>
                </Box>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

const FAQ_ITEMS = (() => {
  const section = DOC_SECTIONS.find((s) => s.id === 'faq')
  const block = section?.blocks.find((b) => b.kind === 'faq')
  return block && block.kind === 'faq' ? block.items : []
})()

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <Box sx={{ background: t.color.chip, borderRadius: t.radius.panel, px: 3, py: 2.75 }}>
      <Box component="button" type="button" aria-expanded={open} onClick={onToggle} sx={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, color: t.color.text, '&:focus-visible': { outline: `1px solid ${t.color.borderButtonHover}`, outlineOffset: 6, borderRadius: '4px' } }}>
        <Typography component="span" sx={{ ...t.type.lead, color: t.color.text }}>
          {q}
        </Typography>
        <Box sx={{ display: 'flex', flexShrink: 0, color: t.color.text }}>{open ? <MinusIcon size={20} /> : <PlusIcon size={20} />}</Box>
      </Box>
      <Collapse in={open} timeout={260}>
        <Typography sx={{ ...t.type.body, color: t.color.textMuted, pt: 2, maxWidth: 560 }}>{a}</Typography>
      </Collapse>
    </Box>
  )
}

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <Container>
      <SectionHead id="faq" center label="FAQ" title="Answers to what you're wondering about." />
      <Box sx={{ maxWidth: 700, mx: 'auto', display: 'grid', gap: 2 }}>
        {FAQ_ITEMS.map((f, i) => (
          <Reveal key={f.q} delay={Math.min(i, 5) * 0.04} y={14}>
            <FaqItem q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          </Reveal>
        ))}
        <Reveal y={16}>
          <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: t.radius.panel, px: 3.25, py: 4 }}>
            <Box component="img" src={pub('/design/gradient.webp')} alt="" loading="lazy" sx={{ ...cover }} />
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(6,6,6,.55), rgba(6,6,6,.15))' }} />
            <Box sx={{ position: 'relative' }}>
              <Typography component="h3" sx={{ ...t.type.h4, fontSize: 26, color: t.color.text }}>
                Still have a question?
              </Typography>
              <Typography sx={{ ...t.type.small, color: t.color.textSoft, mt: 1, maxWidth: 300 }}>The docs cover routing, fees, baskets, pools and safety in detail.</Typography>
              <Button component={Link} to="/docs" fullWidth sx={{ ...tn, mt: 4 }}>
                Read the docs
              </Button>
            </Box>
          </Box>
        </Reveal>
      </Box>
    </Container>
  )
}

function NextSection() {
  const navigate = useNavigate()
  const go = (path: string) => { navigate(path); window.scrollTo({ top: 0 }) }
  return (
    <Container sx={{ pt: t.layout.sectionTop }}>
      <Reveal y={16}>
        <Box sx={{ ...In, position: 'relative', overflow: 'hidden', p: { xs: 3, md: 6 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: { xs: 4, md: 6 }, alignItems: 'center' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Pill>Agent</Pill>
              <Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>New</Box>
            </Box>
            <Typography component="h2" sx={{ ...t.type.h2, color: t.color.text, mt: 3 }}>
              Say it. Approve it.
            </Typography>
            <Typography sx={{ ...t.type.lead, color: t.color.textMuted, mt: 2, maxWidth: 520 }}>
              Ask for a limit order, a weekly buy or a whole vault in plain words. The agent reads the market and your wallet and drafts the action as a card. Nothing happens until you approve it and your wallet confirms. Bring your own Anthropic or OpenAI key; it stays in your browser.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 4 }}>
              <Button onClick={() => go('/agent')} sx={{ ...Bt }}>
                Open the agent
              </Button>
              <Button onClick={() => go('/vaults')} sx={{ ...Lt, backdropFilter: 'none' }}>
                Vaults
              </Button>
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            <Box sx={{ justifySelf: 'end', maxWidth: '85%', px: 2, py: 1.25, borderRadius: '16px 16px 4px 16px', background: t.color.accent, color: t.color.onAccent, fontSize: 14, fontWeight: 500 }}>Buy $250 of NVDA if it drops 5%</Box>
            {['Pricing NVDA', 'Drafting buy order on NVDA'].map((l) => (
              <Typography key={l} sx={{ fontSize: 12, color: t.color.textLabel, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', background: t.color.mark }} /> {l}
              </Typography>
            ))}
            <Box sx={{ p: 2, borderRadius: t.radius.card, background: t.color.tile, border: '1px solid rgba(194,234,138,.35)' }}>
              <Typography sx={{ fontSize: 11, color: t.color.textLabel, letterSpacing: '.04em', textTransform: 'uppercase' }}>Order · needs your approval</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 500, mt: 0.5 }}>Limit buy: $250 below $217</Typography>
              <Typography sx={{ fontSize: 12, color: t.color.textMuted, mt: 0.5 }}>NVDA on Robinhood Chain · paid in USDG · until cancelled · now $228.92</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
                <Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Approved</Box>
                <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>Saved to Orders. The fill is confirmed in your wallet.</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5, pt: 0.5, fontSize: 13, color: t.color.textMuted }}>
              <span>Proposes. Never places. {BRAND.name} fee with the token</span>
              <Box component="span" sx={{ color: t.color.mark, fontWeight: 500 }}>$0.00</Box>
            </Box>
          </Box>
        </Box>
      </Reveal>
    </Container>
  )
}

function CtaSection() {
  const navigate = useNavigate()
  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', pt: t.layout.sectionTop, mt: { xs: 4, md: 6 } }}>
      <Container sx={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Reveal y={16}>
          <Wordmark size={22} />
        </Reveal>
        <Reveal delay={0.06} y={20}>
          <Typography component="h2" sx={{ ...t.type.h2, color: t.color.text, mt: 3, maxWidth: 640 }}>
            Every asset. Every chain. One order.
          </Typography>
        </Reveal>
        <Reveal delay={0.12} y={12}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center', mt: 4 }}>
            <Button onClick={() => navigate('/assets')} sx={Bt}>
              Explore Assets
            </Button>
            <Button onClick={() => goSwap()} sx={Lt}>
              Swap and Bridge
              <Box component="span" className="btn-arrow" sx={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: '50%', background: t.color.text, color: t.color.page }}>
                <ArrowRightIcon size={11} strokeWidth={2.5} />
              </Box>
            </Button>
          </Box>
        </Reveal>
      </Container>
      <Box aria-hidden sx={{ position: 'relative', mt: { xs: 4, md: 6 }, height: { xs: 240, md: 420 } }}>
        <Box component="img" src={pub('/design/particles.webp')} alt="" loading="lazy" sx={{ ...cover, objectPosition: 'center top' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,6,6,1) 0%, rgba(6,6,6,0) 45%, rgba(6,6,6,0) 70%, rgba(6,6,6,1) 100%)' }} />
      </Box>
    </Box>
  )
}

export function Features() {
  return (
    <Box component="section">
      <MarketsSection />
      <ServicesSection />
      <ProcessSection />
      <BasketsSection />
      <WhySection />
      <IssuersSection />
      <FaqSection />
      <NextSection />
      <CtaSection />
    </Box>
  )
}

export { Pill }
