// Verdex in numbers: what the contracts hold and have done, read from the chain by the browser, each number
// with a link to the transactions behind it. No analytics, nothing typed in.
import { useMemo } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { formatUnits } from 'viem'
import { BRAND, t } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { ROBINHOOD, fmtCompact, useAssets } from '../lib/api'
import { usePools, usePoolsOn } from '../lib/pools'
import { BASE_INDEX, ROBINHOOD_INDEX } from '../lib/indexChains'
import { useIndexes, type IndexInfo } from '../lib/indexes'
import { CONTRACTS, EXPLORERS, addressLink, txLink, useNumbers } from '../lib/numbers'
import { CheckIcon, ExternalIcon, ReceiptIcon, RefreshIcon, ShieldIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel, Stats } from './common'

const usd = (n: number, d = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
const verdex = (v: bigint) => `${fmtCompact(Number(formatUnits(v, 18)))} VERDEX`.replace('$', '')
const CHAIN_NAME: Record<number, string> = { [ROBINHOOD]: 'Robinhood Chain', 8453: 'Base', 56: 'BNB Chain', 42161: 'Arbitrum', 1: 'Ethereum', 10: 'OP Mainnet', 137: 'Polygon' }
const chainName = (id: number) => CHAIN_NAME[id] ?? `chain ${id}`

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <Box component="a" href={href} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: t.color.text, textDecoration: 'none', fontSize: 13, whiteSpace: 'nowrap' }}>{children} <ExternalIcon size={11} /></Box>
}
function Section({ title, sub, children }: { title: string; sub: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
      <Typography sx={{ fontSize: 16, fontWeight: 500 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>{sub}</Typography>
      <Box sx={{ mt: 2 }}>{children}</Box>
    </Panel>
  )
}
function Tile({ k, v, s }: { k: string; v: React.ReactNode; s?: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: t.radius.input, background: t.color.raised, minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: t.color.textLabel }}>{k}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 500, mt: 0.25 }}>{v}</Typography>
      {s && <Typography sx={{ fontSize: 12, color: t.color.textMuted, mt: 0.25 }}>{s}</Typography>}
    </Box>
  )
}
function TxRow({ label, usdValue, href }: { label: string; usdValue?: number; href: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 13, py: 0.5, borderBottom: `1px solid ${t.color.border}` }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {usdValue !== undefined && <span style={{ color: t.color.textMuted }}>{usd(usdValue, 2)}</span>}
      <A href={href}>tx</A>
    </Box>
  )
}

export default function NumbersPage() {
  const assets = useAssets()
  const pools = usePools(assets.data?.assets)
  const basePools = usePoolsOn(BASE_INDEX, assets.data?.assets)
  const rh = useIndexes(ROBINHOOD_INDEX, assets.data?.assets, pools.data)
  const base = useIndexes(BASE_INDEX, assets.data?.assets, basePools.data)
  const n = useNumbers()
  const indexes = useMemo<IndexInfo[]>(() => [...(rh.data ?? []), ...(base.data ?? [])], [rh.data, base.data])
  const tvl = indexes.reduce((s, x) => s + x.tvlUsd, 0)
  const indexesLoading = (ROBINHOOD_INDEX.deployed && !rh.data) || (BASE_INDEX.deployed && !base.data)
  const d = n.data
  const executions = d ? d.withoutYou.buys + d.withoutYou.fills + d.withoutYou.runs + d.withoutYou.trades : undefined
  const volume = d ? d.volume.usd + d.indexTrades.usdg : undefined
  const dash = '…'

  return (
    <Page>
      <PageHero
        label="Verdex in numbers"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Read from the chain</Box>}
        title={<>Small and growing,<br />with a link to every transaction.</>}
        lead={`What the ${BRAND.name} contracts hold and have done, read by your browser when you open this page: the index contracts valued at the pools, the aggregator's record of swaps and bridges made through ${BRAND.name}, the treasury contract, and the four contracts that work without you. Nothing typed in, no analytics, no screenshot. Every number here can be clicked through to the transactions behind it.`}
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={() => void n.refetch()} disabled={n.isFetching} sx={{ ...Bt, gap: 1 }}><RefreshIcon size={14} /> {n.isFetching ? 'Reading…' : 'Read again'}</Button>
            <Button component={Link} to="/docs#verdex-in-numbers" sx={{ ...Lt, backdropFilter: 'none' }}>How it is read</Button>
          </Box>
        }
      />

      <Stats items={[
        { label: 'Index TVL', value: indexesLoading ? dash : usd(tvl) },
        { label: 'Volume through Verdex', value: volume === undefined ? dash : usd(volume) },
        { label: 'VERDEX bought by fees', value: d?.treasury ? fmtCompact(Number(formatUnits(d.treasury.totalBought, 18))).replace('$', '') : d ? '0' : dash },
        { label: 'Executions without you', value: executions === undefined ? dash : executions },
      ]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>
        Index TVL at the pools' spot prices right now. Volume is the last 89 days of swaps and bridges through the aggregator plus every Index buy and sell on both chains. VERDEX bought in all by the treasury. Executions are every Auto-Invest buy, order fill, vault rebalance and agent trade in the last four weeks.
      </Typography>

      <Box sx={{ display: 'grid', gap: 2.5, mt: { xs: 5, md: 7 } }}>
        <Section title="Index TVL" sub="The stocks each index contract holds, valued at its pools. Read from the factories on Robinhood Chain and Base.">
          {indexes.length === 0 ? <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{indexesLoading ? 'Reading the index contracts…' : 'No index yet.'}</Typography> : (
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              {indexes.map((x) => (
                <Box key={`${x.chain.id}:${x.address}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 13, py: 0.5, borderBottom: `1px solid ${t.color.border}`, flexWrap: 'wrap' }}>
                  <Box sx={{ ...Vg, ml: 0, fontSize: 11 }}>{x.chain.name}</Box>
                  <b style={{ fontWeight: 500, width: 80 }}>{x.symbol}</b>
                  <span style={{ flex: 1, color: t.color.textMuted, minWidth: 120 }}>{x.name} · {x.components.length} stocks · {Number(formatUnits(x.totalSupply, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 })} shares</span>
                  <span>{usd(x.tvlUsd, 2)}</span>
                  <A href={addressLink(x.chain.id, x.address)}>contract</A>
                </Box>
              ))}
            </Box>
          )}
        </Section>

        <Section title="Volume" sub={`Swaps and bridges made through ${BRAND.name}, from the aggregator's public record for the integrator name (the last 89 days), and Index buys and sells from the routers' events.`}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0,1fr))' }, gap: 1 }}>
            <Tile k="Swaps and bridges" v={d ? usd(d.volume.usd) : dash} s={d ? `${d.volume.count} transactions${d.volume.byChain.length ? ` · ${d.volume.byChain.map((c) => `${chainName(c.chainId)} ${usd(c.usd)}`).join(' · ')}` : ''}` : undefined} />
            <Tile k="Index buys" v={d ? d.indexTrades.buys : dash} />
            <Tile k="Index sells" v={d ? d.indexTrades.sells : dash} />
            <Tile k="Index volume" v={d ? usd(d.indexTrades.usdg) : dash} s={d ? `${usd(d.indexTrades.feesUsdg, 2)} in fees, to the treasury` : undefined} />
          </Box>
          {d && (d.volume.recent.length > 0 || d.indexTrades.recent.length > 0) && (
            <Box sx={{ mt: 2 }}>
              {d.indexTrades.recent.slice(0, 8).map((x) => <TxRow key={x.hash + x.label} label={x.label} usdValue={x.usd} href={txLink(x.chainId, x.hash)} />)}
              {d.volume.recent.slice(0, 12).map((x) => <TxRow key={x.link} label={`${x.tool} on ${chainName(x.chainId)}${x.at ? `, ${new Date(x.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`} usdValue={x.usd} href={x.link} />)}
            </Box>
          )}
        </Section>

        <Section title="Fees buy VERDEX" sub="From the treasury contract: every fee is swept into VERDEX, half burned, half paid back weekly to the wallets that paid it.">
          {d?.treasury ? (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0,1fr))' }, gap: 1 }}>
                <Tile k="Bought" v={verdex(d.treasury.totalBought)} s={`${d.treasury.sweeps.length} sweeps`} />
                <Tile k="Burned" v={verdex(d.treasury.totalBurned)} />
                <Tile k="Paid back" v={verdex(d.treasury.totalPaidBack)} s={`${d.treasury.payouts.length} payouts`} />
                <Tile k="Waiting to be swept" v={`${usd(Number(formatUnits(d.treasury.usdg, 6)), 2)} + ${Number(formatUnits(d.treasury.eth, 18)).toFixed(4)} ETH`} />
              </Box>
              <Box sx={{ mt: 2 }}>
                {d.treasury.sweeps.slice(-6).reverse().map((s) => <TxRow key={s.tx} label={`Sweep: ${verdex(s.verdexOut)} bought, ${verdex(s.burned)} burned`} href={txLink(ROBINHOOD, s.tx)} />)}
                {d.treasury.payouts.slice(-4).reverse().map((p) => <TxRow key={p.tx} label={`Payout ${String(p.epoch)}: ${verdex(p.total)} to ${String(p.recipients)} wallets`} href={txLink(ROBINHOOD, p.tx)} />)}
                <Box sx={{ mt: 1.5 }}><Box component={Link} to="/treasury" sx={{ fontSize: 13, color: t.color.text }}>The Treasury page, sweep by sweep</Box></Box>
              </Box>
            </>
          ) : <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{d ? 'The treasury contract is not deployed.' : 'Reading the treasury…'}</Typography>}
        </Section>

        <Section title="Without you" sub="The four contracts that work while your wallet is closed: what exists, and every execution in the last four weeks, from their events.">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0,1fr))' }, gap: 1 }}>
            <Tile k="Auto-Invest plans" v={d ? d.withoutYou.plans : dash} s={d ? `${d.withoutYou.buys} buys · ${usd(d.withoutYou.buysUsdg)}` : undefined} />
            <Tile k="Orders" v={d ? d.withoutYou.orders : dash} s={d ? `${d.withoutYou.fills} filled` : undefined} />
            <Tile k="Vaults" v={d ? d.withoutYou.vaults : dash} s={d ? `${d.withoutYou.runs} rebalances` : undefined} />
            <Tile k="Agent mandates" v={d ? d.withoutYou.mandates : dash} s={d ? `${d.withoutYou.trades} trades` : undefined} />
          </Box>
          {d && d.withoutYou.recent.length > 0 && <Box sx={{ mt: 2 }}>{d.withoutYou.recent.slice(0, 15).map((x) => <TxRow key={x.hash + x.label} label={x.label} usdValue={x.usd} href={txLink(x.chainId, x.hash)} />)}</Box>}
        </Section>

        <Section title="The contracts" sub="Every one is open source, verified with an exact bytecode match, and unaudited by anyone but us.">
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            {CONTRACTS.map((c) => (
              <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 13, py: 0.5, borderBottom: `1px solid ${t.color.border}`, flexWrap: 'wrap' }}>
                <b style={{ fontWeight: 500, minWidth: 180 }}>{c.name}</b>
                <span style={{ flex: 1, color: t.color.textMuted, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}>{c.address ?? 'not deployed'}</span>
                {c.address && <A href={addressLink(c.chainId, c.address)}>{EXPLORERS[c.chainId] ? 'explorer' : 'address'}</A>}
                <A href={`https://github.com/useverdex/verdex/blob/main/contracts/${c.source}`}>source</A>
                <Box component={Link} to={c.page} sx={{ fontSize: 13, color: t.color.text }}>page</Box>
              </Box>
            ))}
          </Box>
        </Section>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}><MarkIcon size={22} /></Box>
            <Box sx={{ ...Vg, ml: 0 }}>Phase 2, box 10</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Small and growing beats big and unverifiable.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            The site keeps no analytics and {BRAND.name} publishes no screenshots. What is here is what a contract or a public record says when your browser asks it, with the link to check. The numbers are small today; they are also real, and every one of them grows only when someone uses the thing.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[
            [<ShieldIcon key="a" size={18} />, 'Read, not reported', 'Your browser calls the contracts and the aggregator directly. There is no server of ours in between that could round, filter or invent.'],
            [<ReceiptIcon key="b" size={18} />, 'A link behind every figure', 'Each number comes with the transactions or the contract it was read from. If it cannot be clicked through, it is not on this page.'],
            [<CheckIcon key="c" size={18} />, 'What is missing', 'Users, wallets, sessions, retention: the site does not count them. Price and market cap live on the token page, from the pool.'],
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
