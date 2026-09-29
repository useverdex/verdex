import { useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { t } from '../theme/tokens'
import { CHAIN_NAME_LOGOS, autoCategory, fmtCompact, fmtUsd, useAssets, useAutomatedBaskets, useDiscoverBaskets } from '../lib/api'
import { resolveImg } from '../lib/img'
import { AvatarStack, BasketIcon, Cell, Chips, Page, PageHero, Panel, Pct, Row, TableHead } from './common'

type RowT = { key: string; name: string; symbol?: string; icon?: string; chain: string; tags: string; holdings: (string | undefined)[]; count: number; cap: number; price?: number; change?: number; kind: 'Index' | 'Automated' }

export default function DiscoverPage() {
  const { data: d } = useDiscoverBaskets()
  const { data: a } = useAutomatedBaskets()
  const { data: assetsFile } = useAssets()
  const [chain, setChain] = useState('All chains')
  const [kind, setKind] = useState<'All' | 'Index' | 'Automated'>('All')
  const rows = useMemo<RowT[]>(() => {
    const logos = new Map((assetsFile?.assets ?? []).map((x) => [x.ticker, resolveImg(x.logo)]))
    const idx: RowT[] = (d?.baskets ?? []).map((x) => ({ key: x.address, name: x.name, symbol: x.symbol, icon: resolveImg(x.icon), chain: x.chain, tags: [x.chain, ...x.tags].join(' · '), holdings: x.holdings.map((h) => resolveImg(h.logo)), count: x.holdingsCount, cap: x.marketCap, price: x.price, change: x.change1m, kind: 'Index' as const })).sort((p, q) => q.cap - p.cap)
    const auto: RowT[] = (a?.baskets ?? []).map((x) => ({ key: x.id, name: x.name, chain: x.chains[0], tags: `Automated · ${autoCategory(x)}`, holdings: x.holdings.map((h) => logos.get(h.symbol) ?? resolveImg(h.logo)), count: x.holdings.length, cap: x.tvlUsd, change: x.returns['1m'], kind: 'Automated' as const })).sort((p, q) => q.cap - p.cap)
    return [...idx, ...auto].filter((r) => chain === 'All chains' || r.chain === chain).filter((r) => kind === 'All' || r.kind === kind)
  }, [d, a, assetsFile, chain, kind])
  const chains = ['All chains', ...new Set([...(d?.baskets ?? []).map((x) => x.chain), ...(a?.baskets ?? []).flatMap((x) => x.chains)])]
  return (
    <Page>
      <PageHero label="Tokenized Baskets" center title="Discover Baskets" lead={`${d?.baskets.length ?? 0} index baskets · ${a?.baskets.length ?? 0} automated baskets.`} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
        <Chips options={chains} value={chain} onChange={setChain} logos={Object.fromEntries(chains.map((c) => [c, CHAIN_NAME_LOGOS[c]]))} />
        <Chips options={['All', 'Index', 'Automated']} value={kind} onChange={setKind} />
      </Box>
      <Panel sx={{ overflow: 'hidden' }}>
        <TableHead cols={[{ label: 'Name', grow: true }, { label: 'Basket', hide: 'sm' }, { label: 'Market cap · Invested', align: 'right' }, { label: 'Price', align: 'right', hide: 'xs' }, { label: 'Last 30 days', align: 'right' }]} />
        {rows.map((r) => (
          <Row key={r.key}>
            <Cell grow>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <BasketIcon src={r.icon} name={r.name} holdings={r.holdings} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
                    {r.name} {r.symbol && <Box component="span" sx={{ color: t.color.textMuted, fontWeight: 400 }}>${r.symbol}</Box>}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 12, color: t.color.textMuted }}>
                    {r.tags}
                  </Typography>
                </Box>
              </Box>
            </Cell>
            <Cell hide="sm">
              <AvatarStack srcs={r.holdings} total={Math.max(r.count, r.holdings.length)} size={18} max={5} />
            </Cell>
            <Cell align="right" sx={{ fontWeight: 500 }}>{fmtCompact(r.cap)}</Cell>
            <Cell align="right" hide="xs">{r.price != null ? fmtUsd(r.price, r.price < 1 ? 5 : 2) : '-'}</Cell>
            <Cell align="right">
              <Pct v={r.change} />
            </Cell>
          </Row>
        ))}
        <Box sx={{ px: 2.5, py: 2, ...t.type.caption, color: t.color.textLabel }}>
          {rows.length} of {rows.length} baskets
        </Box>
      </Panel>
    </Page>
  )
}
