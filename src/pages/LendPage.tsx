import { useMemo, useState } from 'react'
import { Avatar, Box, Button, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { fmtCompact, useKamino, type KaminoMarket, type KaminoMultiply, type KaminoReserve } from '../lib/api'
import { resolveImg } from '../lib/img'
import { pub } from '../lib/base'
import { ChevronDownIcon } from '../components/icons'
import { useWallet } from '../components/wallet/WalletProvider'
import { AvatarStack, Cell, Chips, Page, PageHero, Panel, Row, Search, Stats, TableHead } from './common'

const SOL = pub('/logos/chains/1151111081099710.svg')
const XSTOCKS = pub('/logos/issuers/xstocks.png')

function ActionButton({ label }: { label: string }) {
  const { account, openWalletMenu } = useWallet()
  return (
    <Button onClick={() => (account ? window.open('https://app.kamino.finance/', '_blank', 'noopener,noreferrer') : openWalletMenu())} sx={{ ...Lt, height: 32, px: '12px', fontSize: 13 }}>
      {label}
    </Button>
  )
}

function AssetCell({ symbol, logo, tokenized }: { symbol: string; logo?: string; tokenized?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Avatar src={resolveImg(logo)} sx={{ width: 28, height: 28, background: z.surface2, fontSize: 10 }}>{symbol[0]}</Avatar>
      </Box>
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{symbol}</Typography>
        {tokenized && (
          <Typography sx={{ fontSize: 12, color: t.color.textMuted, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Avatar src={XSTOCKS} sx={{ width: 12, height: 12, background: t.color.chip }} /> xStocks
          </Typography>
        )}
      </Box>
    </Box>
  )
}

function Market({ m, reserves, multiply, q, tab }: { m: KaminoMarket; reserves: KaminoReserve[]; multiply: KaminoMultiply[]; q: string; tab: 'lend' | 'multiply' }) {
  const [open, setOpen] = useState(true)
  const rows = reserves.filter((r) => !q || r.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
  const mrows = multiply.filter((r) => !q || r.collateral.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
  if ((tab === 'lend' && !rows.length) || (tab === 'multiply' && !mrows.length)) return null
  return (
    <Panel sx={{ overflow: 'hidden', mt: 2.5 }}>
      <Box onClick={() => setOpen((v) => !v)} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2, cursor: 'pointer', borderBottom: open ? `1px solid ${t.color.border}` : 'none' }}>
        <Box sx={{ color: t.color.textLabel, display: 'flex', transform: open ? 'none' : 'rotate(-90deg)', transition: `transform ${t.motion.base}` }}>
          <ChevronDownIcon size={14} />
        </Box>
        <Avatar src={m.logo ? resolveImg(m.logo) : XSTOCKS} sx={{ width: 32, height: 32, background: t.color.chip }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>{m.name}</Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Avatar src={SOL} sx={{ width: 12, height: 12 }} /> Solana
          </Typography>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4, ml: 'auto', fontSize: 12, color: t.color.textMuted }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            Collateral <AvatarStack srcs={m.collateralLogos.map((l) => resolveImg(l))} size={18} max={5} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            Debt <AvatarStack srcs={m.debtLogos.map((l) => resolveImg(l))} size={18} max={5} />
          </Box>
        </Box>
        <Box sx={{ ml: { xs: 'auto', md: 0 }, textAlign: 'right' }}>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>Borrow from</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{(m.borrowApyLow ?? Math.min(...reserves.filter((r) => r.borrowable).map((r) => r.borrowApy))).toFixed(2)}%</Typography>
        </Box>
        <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>Market size</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{fmtCompact(m.suppliedUsd)}</Typography>
        </Box>
      </Box>
      {open && tab === 'lend' && (
        <>
          <TableHead cols={[{ label: 'Asset', grow: true }, { label: 'Total supply', align: 'right' }, { label: 'Total borrow', align: 'right', hide: 'xs' }, { label: 'Liq LTV', align: 'right', hide: 'sm' }, { label: 'Supply APY', align: 'right' }, { label: 'Borrow APY', align: 'right' }]} />
          {rows.map((r) => (
            <Row key={r.reserve}>
              <Cell grow>
                <AssetCell symbol={r.symbol} logo={r.logo} tokenized={r.tokenized} />
              </Cell>
              <Cell align="right" sx={{ fontWeight: 500 }}>{r.totalSupplyUsd < 1 ? `$${r.totalSupplyUsd.toFixed(1)}` : fmtCompact(r.totalSupplyUsd)}</Cell>
              <Cell align="right" hide="xs">{fmtCompact(r.totalBorrowUsd)}</Cell>
              <Cell align="right" hide="sm">{Math.round(r.liqLtv)}%</Cell>
              <Cell align="right" sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, width: 170 }}>
                <Box component="span" sx={{ color: r.supplyApy > 0.005 ? t.color.green : t.color.textMuted, fontWeight: 500 }}>{r.supplyApy.toFixed(2)}%</Box>
                <ActionButton label="Supply" />
              </Cell>
              <Cell align="right" sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, width: 170 }}>
                {r.borrowable ? (
                  <>
                    <Box component="span" sx={{ fontWeight: 500 }}>{r.borrowApy.toFixed(2)}%</Box>
                    <ActionButton label="Borrow" />
                  </>
                ) : (
                  <Box component="span" sx={{ color: t.color.textMuted }}>-</Box>
                )}
              </Cell>
            </Row>
          ))}
        </>
      )}
      {open && tab === 'multiply' && (
        <>
          <TableHead cols={[{ label: 'Position', grow: true }, { label: 'Max leverage', align: 'right' }, { label: 'Avg leverage', align: 'right', hide: 'xs' }, { label: 'Deposited', align: 'right', hide: 'sm' }, { label: 'Debt APY', align: 'right' }, { label: '', align: 'right' }]} />
          {mrows.map((r) => (
            <Row key={r.collateral + r.debt}>
              <Cell grow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Avatar src={resolveImg(r.collateralLogo)} sx={{ width: 28, height: 28, background: z.surface2, fontSize: 10 }}>{r.collateral[0]}</Avatar>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                      {r.collateral} <Box component="span" sx={{ color: t.color.textMuted, fontWeight: 400 }}>/ {r.debt}</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{r.positions} positions · {r.kind}</Typography>
                  </Box>
                </Box>
              </Cell>
              <Cell align="right" sx={{ fontWeight: 500 }}>{r.maxLeverage.toFixed(1)}x</Cell>
              <Cell align="right" hide="xs">{r.avgLeverage ? `${r.avgLeverage.toFixed(2)}x` : '-'}</Cell>
              <Cell align="right" hide="sm">{fmtCompact(r.depositedUsd)}</Cell>
              <Cell align="right">{r.debtApy.toFixed(2)}%</Cell>
              <Cell align="right">
                <ActionButton label="Multiply" />
              </Cell>
            </Row>
          ))}
        </>
      )}
    </Panel>
  )
}

export default function LendPage() {
  const { data } = useKamino()
  const [params, setParams] = useSearchParams()
  const tab: 'lend' | 'multiply' = params.get('tab') === 'multiply' ? 'multiply' : 'lend'
  const [q, setQ] = useState('')
  const [market, setMarket] = useState('All markets')
  const markets = useMemo(() => (data?.markets ?? []).filter((m) => market === 'All markets' || m.name === market), [data, market])
  const totals = data?.totals
  return (
    <Page>
      <PageHero
        label="Lend and Borrow"
        badges={
          <>
            <Box component="span" sx={Vg}>Beta</Box>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: 24, px: 1, borderRadius: t.radius.input, border: `1px solid ${t.color.borderPanel}`, background: t.color.panel, fontSize: 12, color: t.color.text }}>
              <Avatar src={SOL} sx={{ width: 14, height: 14 }} /> Solana
            </Box>
          </>
        }
        title="Earn on Your Stocks. Or Borrow Against Them."
        lead="Supply a tokenized stock, borrow against it, or lever the position up."
      />
      <Stats items={[{ label: 'Assets', value: totals?.assets ?? '-' }, { label: 'Market size', value: fmtCompact(totals?.suppliedUsd) }, { label: 'Active borrows', value: fmtCompact(totals?.borrowedUsd) }, { label: 'In Multiply', value: fmtCompact(totals?.leveredUsd) }]} />
      <Box sx={{ mt: 3 }}>
        <Chips options={['Lend and Borrow', 'Multiply']} value={tab === 'multiply' ? 'Multiply' : 'Lend and Borrow'} onChange={(v) => setParams(v === 'Multiply' ? { tab: 'multiply' } : {})} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 2.5 }}>
        <Search value={q} onChange={setQ} placeholder="Search by stock or market" />
        <Chips options={['All markets', ...(data?.markets ?? []).map((m) => m.name)]} value={market} onChange={setMarket} logos={Object.fromEntries((data?.markets ?? []).map((m) => [m.name, m.logo ? resolveImg(m.logo)! : XSTOCKS]))} />
      </Box>
      {markets.map((m) => (
        <Market key={m.market} m={m} reserves={(data?.reserves ?? []).filter((r) => r.market === m.market)} multiply={(data?.multiply ?? []).filter((r) => r.market === m.market)} q={q.trim().toLowerCase()} tab={tab} />
      ))}
      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ ...t.type.caption, color: t.color.textLabel, flex: 1 }}>Markets are read from Kamino on Solana. Positions are opened from your own wallet and stay non-custodial.</Typography>
        <Button component="a" href="https://app.kamino.finance" target="_blank" rel="noopener noreferrer" sx={{ ...Bt, height: 34 }}>
          Open on Kamino
        </Button>
      </Box>
    </Page>
  )
}
