import { useMemo, useState } from 'react'
import { Avatar, Box, Button, Typography } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import { t, z } from '../theme/tokens'
import { Bt } from '../theme/styles'
import { ASSET_CATEGORIES, CHAIN_NAME_LOGOS, ISSUER_LOGOS, fmtCompact, fmtUsd, useAssets, useKamino, type Asset } from '../lib/api'
import { resolveImg } from '../lib/img'
import { AvatarStack, Cell, Chips, Page, Pagination, Panel, Row, Search, TableHead } from './common'
import { Pill } from '../components/ui'
import { actions } from '../store'

const RANK_CARDS = [
  { title: 'Most Traded', sub: 'Highest onchain volume today.', tag: '24h', key: 'volume24h' as const },
  { title: 'Top Assets', sub: 'Largest by combined onchain market cap.', tag: 'Mkt cap', key: 'marketCap' as const },
  { title: 'Most Available', sub: 'On the most issuers and chains.', tag: 'Reach', key: 'reach' as const },
]

function reach(a: Asset) {
  return a.issuers.length * 10 + new Set(a.tokens.map((x) => x.chainId)).size
}

function AssetIdentity({ a }: { a: Asset }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <Avatar src={resolveImg(a.logo)} alt={a.ticker} sx={{ width: 36, height: 36, background: z.surface2, fontSize: 12 }}>
        {a.ticker[0]}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 500, color: t.color.text }}>
          {a.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: t.color.textMuted }}>
          {a.ticker}
          <AvatarStack srcs={[...new Set(a.tokens.map((x) => x.chain))].map((c) => CHAIN_NAME_LOGOS[c])} size={14} max={6} />
        </Box>
      </Box>
    </Box>
  )
}

export default function AssetsPage() {
  const { data } = useAssets()
  const { data: kamino } = useKamino()
  const [params, setParams] = useSearchParams()
  const category = (params.get('category') as (typeof ASSET_CATEGORIES)[number] | null) ?? 'All'
  const [issuer, setIssuer] = useState('All issuers')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: 'price' | 'marketCap' | 'volume24h'; dir: 1 | -1 }>({ key: 'volume24h', dir: -1 })
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(20)
  const assets = useMemo(() => data?.assets ?? [], [data])
  const issuers = useMemo(() => data?.issuers ?? [], [data])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return assets
      .filter((a) => category === 'All' || a.category === category)
      .filter((a) => issuer === 'All issuers' || a.issuers.includes(issuer))
      .filter((a) => !s || a.ticker.toLowerCase().includes(s) || a.name.toLowerCase().includes(s))
      .sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir)
  }, [assets, category, issuer, q, sort])
  const pages = Math.ceil(rows.length / perPage)
  const pageRows = rows.slice(page * perPage, (page + 1) * perPage)
  const counts = Object.fromEntries([['All', assets.length], ...ASSET_CATEGORIES.map((c) => [c, assets.filter((a) => a.category === c).length])]) as Record<string, number>
  const issuerOpts = ['All issuers', ...issuers.map((i) => i.name)]
  const ranked = (key: 'volume24h' | 'marketCap' | 'reach') => [...assets].sort((a, b) => (key === 'reach' ? reach(b) - reach(a) : b[key] - a[key])).slice(0, 5)
  const sortBtn = (key: typeof sort.key, label: string) => (
    <Box component="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : -1 }))} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', gap: 0.5, color: sort.key === key ? t.color.text : 'inherit' }}>
      {label} <span>{sort.key === key ? (sort.dir === -1 ? '▼' : '▲') : '↕'}</span>
    </Box>
  )

  return (
    <Page>
      <Box sx={{ textAlign: 'center', maxWidth: 900, mx: 'auto', pt: { xs: 4, md: 10 } }}>
        <Box sx={{ mb: 3 }}>
          <Pill>Assets</Pill>
        </Box>
        <Typography component="h1" sx={{ ...t.type.h2, color: t.color.text, m: 0 }}>
          Explore <Box component="span" sx={{ color: t.color.accent }}>Tokenized Real-World Assets</Box>
        </Typography>
        <Typography sx={{ ...t.type.lead, color: t.color.textMuted, mt: 3, maxWidth: 680, mx: 'auto' }}>
          <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>{assets.length} assets</Box> from <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>{issuers.length} issuers</Box>. Stocks, ETFs, commodities, private credit and treasuries. One place.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, mt: 4 }}>
          {issuers.map((i) => (
            <Box key={i.name} component="button" onClick={() => setIssuer(i.name)} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', height: 30, pl: '6px', pr: '10px', borderRadius: t.radius.input, border: `1px solid ${t.color.borderPanel}`, background: t.color.panel, fontSize: 12, fontWeight: 500, color: t.color.text, '&:hover': { borderColor: t.color.borderStrong } }}>
              <Box component="img" src={ISSUER_LOGOS[i.name]} alt="" sx={{ width: 16, height: 16, borderRadius: '50%', background: t.color.chip, objectFit: 'cover' }} />
              {i.name}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
          <Search value={q} onChange={(v) => { setQ(v); setPage(0) }} placeholder="Search AAPL, gold, SpaceX…" />
        </Box>
      </Box>

      {/* While searching, the results come first; the ranking cards return when the box is cleared. */}
      {!q && (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: { xs: 6, md: 8 } }}>
        {RANK_CARDS.map((c) => (
          <Panel key={c.title} sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{c.title}</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>{c.sub}</Typography>
              </Box>
              <Box sx={{ fontSize: 12, px: 1, py: 0.25, borderRadius: '6px', background: t.color.hover, color: t.color.textMuted }}>{c.tag}</Box>
            </Box>
            <Box sx={{ mt: 2, display: 'grid', gap: 1.5 }}>
              {ranked(c.key).map((a, i) => (
                <Box key={a.ticker} component={Link} to={`/assets/${a.ticker}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit' }}>
                  <Typography sx={{ fontSize: 12, color: t.color.textLabel, width: 12 }}>{i + 1}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <AssetIdentity a={a} />
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{fmtUsd(a.price)}</Typography>
                    <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{c.key === 'reach' ? `${a.issuers.length} issuers · ${new Set(a.tokens.map((x) => x.chainId)).size} chains` : fmtCompact(a[c.key])}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Panel>
        ))}
      </Box>
      )}

      <Box sx={{ mt: { xs: 6, md: 8 } }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 500 }}>
            All Assets <Box component="span" sx={{ color: t.color.textLabel, fontWeight: 400 }}>{rows.length}</Box>
          </Typography>
          <Box sx={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Chips options={issuerOpts} value={issuer} onChange={(v) => { setIssuer(v); setPage(0) }} />
          </Box>
        </Box>
        <Chips options={['All', ...ASSET_CATEGORIES]} value={category} onChange={(v) => { setParams(v === 'All' ? {} : { category: v }); setPage(0) }} counts={counts} />
        <Panel sx={{ mt: 2.5, overflow: 'hidden' }}>
          <TableHead cols={[{ label: 'Token', grow: true }, { label: 'Price', align: 'right' }, { label: 'Onchain Market Cap', align: 'right', hide: 'xs' }, { label: '24h Volume', align: 'right' }, { label: 'Issuers', hide: 'sm' }, { label: 'Chains', hide: 'sm' }]} />
          <Box sx={{ display: 'none' }}>{sortBtn('price', 'Price')}{sortBtn('marketCap', 'Onchain Market Cap')}{sortBtn('volume24h', '24h Volume')}</Box>
          {pageRows.map((a) => (
            <Row key={a.ticker}>
              <Cell grow>
                <Box component={Link} to={`/assets/${a.ticker}`} sx={{ textDecoration: 'none', color: 'inherit' }}>
                  <AssetIdentity a={a} />
                </Box>
              </Cell>
              <Cell align="right" sx={{ fontWeight: 500 }}>{fmtUsd(a.price)}</Cell>
              <Cell align="right" hide="xs">{fmtCompact(a.marketCap)}</Cell>
              <Cell align="right">{fmtCompact(a.volume24h)}</Cell>
              <Cell hide="sm">
                <AvatarStack srcs={a.issuers.map((i) => ISSUER_LOGOS[i])} size={18} max={4} />
              </Cell>
              <Cell hide="sm">
                <AvatarStack srcs={[...new Set(a.tokens.map((x) => x.chain))].map((c) => CHAIN_NAME_LOGOS[c])} size={18} max={4} />
              </Cell>
            </Row>
          ))}
          <Pagination page={page} pages={pages} onPage={setPage} perPage={perPage} onPerPage={(n) => { setPerPage(n); setPage(0) }} options={[10, 20, 50]} total={rows.length} />
        </Panel>
      </Box>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Box sx={{ mb: 2 }}>
          <Pill>Lend</Pill>
        </Box>
        <Typography component="h2" sx={{ ...t.type.pageTitle, color: t.color.text }}>Supply Them. Borrow Against Them.</Typography>
        <Typography sx={{ ...t.type.lead, color: t.color.textMuted, mt: 2 }}>
          <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>{kamino?.totals.assets ?? '-'} tokenized stocks</Box> are collateral on Kamino, across {kamino?.markets.length ?? '-'} markets.
        </Typography>
        <Panel sx={{ mt: 3, overflow: 'hidden' }}>
          <TableHead cols={[{ label: 'Asset', grow: true }, { label: 'Market', hide: 'xs' }, { label: 'Borrow APY', align: 'right' }, { label: 'Max LTV', align: 'right' }, { label: 'Supplied', align: 'right' }]} />
          {(kamino?.reserves ?? []).filter((r) => r.tokenized && r.status !== 'Hidden').map((r) => (
            <Row key={r.reserve}>
              <Cell grow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar src={resolveImg(r.logo)} sx={{ width: 28, height: 28, background: z.surface2, fontSize: 11 }}>{r.symbol[0]}</Avatar>
                  <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{r.symbol}</Typography>
                </Box>
              </Cell>
              <Cell hide="xs" sx={{ width: 180 }}>{r.marketName}</Cell>
              <Cell align="right">{r.borrowApy.toFixed(2)}%</Cell>
              <Cell align="right">{Math.round(r.maxLtv)}%</Cell>
              <Cell align="right" sx={{ fontWeight: 500 }}>{r.totalSupplyUsd < 1 ? `$${r.totalSupplyUsd.toFixed(1)}` : fmtCompact(r.totalSupplyUsd)}</Cell>
            </Row>
          ))}
        </Panel>
        <Button component={Link} to="/lend" sx={{ ...Bt, mt: 3 }} onClick={() => actions.closeAllMenus()}>
          Open Lend and Borrow
        </Button>
      </Box>
    </Page>
  )
}
