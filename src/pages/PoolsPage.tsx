import { useMemo, useState } from 'react'
import { Avatar, Box, Typography } from '@mui/material'
import { t, z } from '../theme/tokens'
import { CHAIN_NAME_LOGOS, ISSUER_LOGOS, fmtCompact, useRwaPools } from '../lib/api'
import { resolveImg } from '../lib/img'
import { Cell, Chips, Page, PageHero, Pagination, Panel, Row, Search, Stats, TableHead } from './common'

const dexName = (d: string) => d.replace(/uniswap v(\d)/i, 'Uniswap V$1').replace(/^\w/, (c) => c.toUpperCase())

export default function PoolsPage() {
  const { data } = useRwaPools()
  const pools = useMemo(() => data?.pools ?? [], [data])
  const [q, setQ] = useState('')
  const [chain, setChain] = useState('All chains')
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(25)
  const chains = ['All chains', ...new Set(pools.map((p) => p.chain))]
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return pools.filter((p) => chain === 'All chains' || p.chain === chain).filter((p) => !s || p.name.toLowerCase().includes(s) || p.dex.toLowerCase().includes(s) || p.chain.toLowerCase().includes(s)).sort((a, b) => b.liquidityUsd - a.liquidityUsd)
  }, [pools, q, chain])
  const pages = Math.ceil(rows.length / perPage)
  const issuerOf = (p: (typeof pools)[number]) => (p.chain === 'Robinhood Chain' ? 'Robinhood' : p.chain === 'Base' ? 'Coinbase' : 'Ondo')
  return (
    <Page>
      <PageHero
        label="Tokenized Pools"
        title="Every Pool. Every Chain."
        lead={
          <>
            <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>{pools.length} pools</Box> where tokenized stocks trade. Deposits take one transaction.
          </>
        }
      />
      <Stats items={[{ label: 'Pools', value: pools.length }, { label: 'Liquidity', value: fmtCompact(pools.reduce((s, p) => s + p.liquidityUsd, 0)) }, { label: '24h volume', value: fmtCompact(pools.reduce((s, p) => s + p.volume24hUsd, 0)) }]} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 3, mb: 2.5 }}>
        <Search value={q} onChange={(v) => { setQ(v); setPage(0) }} placeholder="Search by stock, DEX or chain" />
        <Chips options={chains} value={chain} onChange={(v) => { setChain(v); setPage(0) }} logos={Object.fromEntries(chains.map((c) => [c, CHAIN_NAME_LOGOS[c]]))} />
      </Box>
      <Panel sx={{ overflow: 'hidden' }}>
        <TableHead cols={[{ label: 'Pool', grow: true }, { label: 'DEX', hide: 'xs' }, { label: 'Liquidity', align: 'right' }, { label: '24h volume', align: 'right', hide: 'xs' }, { label: 'Fee', align: 'right', hide: 'sm' }, { label: 'Fee APR', align: 'right' }]} />
        {rows.slice(page * perPage, (page + 1) * perPage).map((p) => (
          <Row key={p.address + p.name}>
            <Cell grow>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <Box sx={{ position: 'relative', width: 44, height: 44, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Avatar src={resolveImg(p.stockLogo)} sx={{ width: 28, height: 28, background: z.surface2, fontSize: 10 }}>{p.stockSymbol[0]}</Avatar>
                  <Avatar src={CHAIN_NAME_LOGOS[p.chain]} sx={{ width: 14, height: 14, position: 'absolute', right: 6, bottom: 6, border: `1.5px solid ${t.color.page}` }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
                    {p.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: t.color.textMuted }}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <Avatar src={CHAIN_NAME_LOGOS[p.chain]} sx={{ width: 12, height: 12 }} /> {p.chain}
                    </Box>
                    ·
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <Avatar src={ISSUER_LOGOS[issuerOf(p)]} sx={{ width: 12, height: 12, background: t.color.chip }} /> {issuerOf(p)}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Cell>
            <Cell hide="xs">{dexName(p.dex)}</Cell>
            <Cell align="right" sx={{ fontWeight: 500 }}>{fmtCompact(p.liquidityUsd)}</Cell>
            <Cell align="right" hide="xs" sx={{ fontWeight: 500 }}>{p.volume24hUsd ? fmtCompact(p.volume24hUsd) : '-'}</Cell>
            <Cell align="right" hide="sm">{p.feePercent ? `${p.feePercent}%` : '-'}</Cell>
            <Cell align="right" sx={{ color: p.feeApr ? t.color.green : t.color.textMuted, fontWeight: 500 }}>{p.feeApr ? `${Math.round(p.feeApr)}%` : '-'}</Cell>
          </Row>
        ))}
        <Pagination page={page} pages={pages} onPage={setPage} perPage={perPage} onPerPage={(n) => { setPerPage(n); setPage(0) }} options={[25, 50, 100]} total={rows.length} />
      </Panel>
    </Page>
  )
}
