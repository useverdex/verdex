// Fees buy VERDEX: the treasury contract, its balances, every sweep and payout, and the fee payers of the
// current period with their share of the next payout. Everything is read from the chain in the browser.
import { useMemo } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { BRAND, t } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { fmtCompact, fmtUsd } from '../lib/api'
import { explorerAddress, explorerTx, useEthUsd, useMarket } from '../lib/token'
import { USDG } from '../lib/pools'
import { DEAD, DEPLOYED, TREASURY, fmtEth, fmtUsdg, fmtVerdexAmt, useTreasury, type Treasury } from '../lib/treasury'
import { useWallet } from '../components/wallet/WalletProvider'
import { CoinIcon, ExternalIcon, PieIcon, ReceiptIcon, RefreshIcon, ShieldIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel, Stats } from './common'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const fmtWhen = (ms?: number, block?: number) => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : block ? `block ${block.toLocaleString('en-US')}` : '')

function Label({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1.25 }}>{children}</Typography>
}
function Big({ value, sub, accent }: { value: React.ReactNode; sub: React.ReactNode; accent?: boolean }) {
  return (
    <Box>
      <Typography sx={{ ...t.type.stat, fontSize: { xs: 30, md: 38 }, color: accent ? t.color.mark : t.color.text }}>{value}</Typography>
      <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>{sub}</Typography>
    </Box>
  )
}
function TxRow({ when, what, amount, tx, accent }: { when: string; what: string; amount: string; tx: string; accent?: boolean }) {
  return (
    <Box component="a" href={explorerTx(tx)} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: t.radius.panel, textDecoration: 'none', color: 'inherit', '&:hover': { background: t.color.hover } }}>
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, width: 118, flexShrink: 0 }}>{when}</Typography>
      <Typography sx={{ fontSize: 14, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{what}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 500, color: accent ? t.color.mark : t.color.text, fontVariantNumeric: 'tabular-nums' }}>{amount}</Typography>
      <Box sx={{ display: 'flex', color: t.color.textLabel }}><ExternalIcon size={12} /></Box>
    </Box>
  )
}
function Step({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Panel sx={{ p: 3 }}>
      <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}>{icon}</Box>
      <Typography sx={{ ...t.type.cardTitle, color: t.color.text, mt: 2.5 }}>{title}</Typography>
      <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 1 }}>{text}</Typography>
    </Panel>
  )
}

function Period({ tr, me }: { tr: Treasury; me?: string }) {
  const mine = me ? tr.periodFees.find((x) => x.payer.toLowerCase() === me.toLowerCase()) : undefined
  const share = mine && tr.periodTotal > 0n ? Number((mine.fee * 10_000n) / tr.periodTotal) / 100 : 0
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '11px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}><CoinIcon size={18} /></Box>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>The next payout</Typography>
          <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{fmtVerdexAmt(tr.rewardsAvailable)} VERDEX in the bucket, split pro rata to the fees paid since the last payout.</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Big value={fmtUsdg(tr.periodTotal)} sub={`fees paid this period by ${tr.periodFees.length} wallet${tr.periodFees.length === 1 ? '' : 's'}`} />
        <Big value={me ? (mine ? `${share.toFixed(1)}%` : '0%') : '-'} sub={me ? (mine ? `your share: ${fmtUsdg(mine.fee)} of fees ≈ ${fmtVerdexAmt((tr.rewardsAvailable * mine.fee) / (tr.periodTotal || 1n))} VERDEX` : 'you paid no fee this period') : 'connect to see your share'} accent={!!mine} />
      </Box>
      {tr.periodFees.length > 0 && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${t.color.border}` }}>
          <Label>Fee payers this period</Label>
          {tr.periodFees.slice(0, 8).map((x) => (
            <Box key={x.payer} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, px: 1.5, py: 0.75, fontSize: 13 }}>
              <Box component="a" href={explorerAddress(x.payer)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.textSoft, fontFamily: 'ui-monospace, Menlo, monospace', textDecoration: 'none' }}>{short(x.payer)}</Box>
              <Typography sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{fmtUsdg(x.fee)} · {tr.periodTotal > 0n ? (Number((x.fee * 10_000n) / tr.periodTotal) / 100).toFixed(1) : '0'}%</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Panel>
  )
}

export default function TreasuryPage() {
  const { account, openWalletMenu } = useWallet()
  const tr = useTreasury()
  const m = useMarket()
  const ethUsd = useEthUsd()
  const price = m.data?.price ?? 0
  const cmp = (n: number) => fmtCompact(n).replace(/^\$/, '')
  const d = tr.data
  const rows = useMemo(() => {
    const s = (d?.sweeps ?? []).map((x) => ({ kind: 'sweep' as const, block: x.block, at: x.at, tx: x.tx, what: `Swept ${x.tokenIn.toLowerCase() === USDG.address.toLowerCase() ? fmtUsdg(x.amountIn) : fmtEth(x.amountIn)} into VERDEX, ${fmtVerdexAmt(x.burned)} burned`, amount: `+${fmtVerdexAmt(x.verdexOut)}` }))
    const p = (d?.payouts ?? []).map((x) => ({ kind: 'pay' as const, block: x.block, at: x.at, tx: x.tx, what: `Payout ${String(x.epoch)} to ${String(x.recipients)} wallet${x.recipients === 1n ? '' : 's'}`, amount: `−${fmtVerdexAmt(x.total)}` }))
    return [...s, ...p].sort((a, b) => b.block - a.block).slice(0, 10)
  }, [d])
  const pending = d ? Number(d.usdg) / 1e6 + (Number(d.eth) / 1e18) * (ethUsd.data ?? 0) : 0

  return (
    <Page>
      <PageHero
        label="Fees buy VERDEX"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>{DEPLOYED ? 'Live' : 'Contract not deployed'}</Box>}
        title={<>Every protocol fee<br />buys VERDEX.</>}
        lead={`Every fee the ${BRAND.name} protocol earns lands in one public contract, and the only thing that contract can do with it is buy VERDEX. Half of every sweep goes to the burn address. The other half is paid back every week to the wallets that paid the fees, in proportion to what they paid. No function sends funds anywhere else: not to the owner, not to the executor.`}
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button component={Link} to="/index" sx={{ ...Bt, gap: 1 }}><PieIcon size={15} /> Pay a fee: buy an index</Button>
            <Button component={Link} to="/verdex" sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}><CoinIcon size={14} /> The token page</Button>
          </Box>
        }
      />

      <Stats items={[{ label: 'VERDEX bought', value: d ? cmp(Number(d.totalBought) / 1e18) : DEPLOYED ? '…' : '0' }, { label: 'Burned', value: d ? cmp(Number(d.totalBurned) / 1e18) : DEPLOYED ? '…' : '0' }, { label: 'Paid back', value: d ? cmp(Number(d.totalPaidBack) / 1e18) : DEPLOYED ? '…' : '0' }, { label: 'Waiting to sweep', value: d ? fmtUsd(pending, 2) : DEPLOYED ? '…' : '$0' }]} />
      <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>
        Read from the {BRAND.name} treasury on Robinhood Chain{DEPLOYED ? <>, <Box component="a" href={explorerAddress(TREASURY)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>{short(TREASURY)}</Box></> : ''}{d ? <>, holding {fmtUsdg(d.usdg)} USDG, {fmtEth(d.eth)} and {fmtVerdexAmt(d.verdex)} VERDEX right now{price ? `; the bought VERDEX is worth ${fmtUsd((Number(d.totalBought) / 1e18) * price, 0)} today` : ''}</> : ''}. Burns go to <Box component="a" href={explorerAddress(DEAD)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>{short(DEAD)}</Box>.
      </Typography>

      {!DEPLOYED && (
        <Panel sx={{ mt: 5, p: { xs: 3, md: 4 } }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>The contract is not on the chain yet.</Typography>
          <Typography sx={{ fontSize: 14, color: t.color.textMuted, mt: 0.75 }}>The code is in the repository and tested on a fork of Robinhood Chain. Sweeps and payouts start the moment it is deployed and the routers point their fee at it.</Typography>
        </Panel>
      )}
      {tr.isError && <Panel sx={{ mt: 5, p: 3 }}><Typography sx={{ fontSize: 14, color: t.color.textMuted }}>The chain is rate-limiting reads right now. Reload in a minute.</Typography></Panel>}

      {d && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mt: { xs: 5, md: 7 }, alignItems: 'start' }}>
          <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '11px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}><RefreshIcon size={18} /></Box>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Sweeps and payouts</Typography>
                <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>Every six hours the executor sweeps what is here into VERDEX; once a week it pays the kept half out. {d.burnBps / 100}% of each sweep is burned; a route must return at least spot less {d.maxSlippageBps / 100}%.</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Big value={`${fmtVerdexAmt(d.rewardsAvailable)}`} sub="VERDEX waiting for the next payout" accent />
              <Big value={d.spotUsdg > 0n ? fmtVerdexAmt(d.spotUsdg) : '…'} sub="VERDEX one USDG buys at spot right now" />
            </Box>
            <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${t.color.border}` }}>
              <Label>Latest</Label>
              {rows.length === 0 && <Typography sx={{ fontSize: 13, color: t.color.textMuted, px: 1.5 }}>No sweep yet. The first one runs once a few USDG of fees have arrived.</Typography>}
              {rows.map((r) => <TxRow key={r.tx + r.kind} when={fmtWhen(r.at, r.block)} what={r.what} amount={r.amount} tx={r.tx} accent={r.kind === 'sweep'} />)}
            </Box>
          </Panel>
          <Period tr={d} me={account?.address} />
        </Box>
      )}
      {DEPLOYED && !account && d && (
        <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 2 }}>
          <Box component="button" type="button" onClick={openWalletMenu} sx={{ all: 'unset', cursor: 'pointer', color: t.color.text, textDecoration: 'underline' }}>Connect</Box> to see your share of the next payout.
        </Typography>
      )}

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step icon={<ReceiptIcon size={20} />} title="Fees land here" text={`The ${BRAND.name} fee on Index buys and sells is paid to this contract by the router. Each new contract points its fee here as it ships. The aggregator's swap fee follows once its integrator wallet is moved.`} />
          <Step icon={<RefreshIcon size={20} />} title="A sweep buys VERDEX" text="The executor asks the aggregator for a route from the treasury to VERDEX and calls sweep. The contract swaps, measures what arrived, and reverts unless it is at least the pools' spot less the band. Half goes to the burn address in the same transaction." />
          <Step icon={<CoinIcon size={20} />} title="A payout gives it back" text="Once a week, the kept VERDEX goes to the wallets that paid fees since the last payout, pro rata to what they paid, read from the routers' fee events. The contract never pays more than the bucket holds." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}><MarkIcon size={22} /></Box>
            <Box sx={{ ...Vg, ml: 0 }}>Phase 2, box 2</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>One way out.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            The treasury has no withdraw. Balances leave it by two paths only: a sweep, which must end in VERDEX inside the contract, and a payout, which goes to the period's fee payers. The owner keeps the executor list, the router list, the burn share and the slippage band, each capped in the code, and nothing else. It is open source, verified on the explorer, tested on a fork, and unaudited.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[[<ShieldIcon key="a" size={16} />, 'No owner withdraw, no executor withdraw. A sweep that does not end in VERDEX reverts.'], [<RefreshIcon key="b" size={16} />, 'The floor is read from the pools in the same transaction, so a bad route cannot drain the balance.'], [<CoinIcon key="c" size={16} />, 'The creator fee of the VERDEX token itself is separate and stays what it is today.']].map(([icon, text], i) => (
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
