// Deploys Verdex Lend from the connected wallet, then creates the launch markets: for each stock a long
// market (borrow USDG against the stock) and a short market (borrow the stock against USDG), with caps
// from today's pool prices. Not linked from the site. The address goes into scripts/lend-address.mjs.
import { useMemo, useState } from 'react'
import { Box, Button, InputBase, Typography } from '@mui/material'
import { isAddress, keccak256, type Address } from 'viem'
import { t } from '../theme/tokens'
import { Bt, Lt } from '../theme/styles'
import { ROBINHOOD, fmtCompact, fmtUsd, useAssets, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, usePools, type Phase } from '../lib/pools'
import { BYTECODE, LAUNCH, LAUNCH_SHORT, LEND_ADDRESS, TREASURY, createMarket, deployLend, planMarkets } from '../lib/lend'
import { useWallet } from '../components/wallet/WalletProvider'
import { Page, PageHero, Panel } from './common'

type Tx = { phase: Phase; error?: string; hash?: string; address?: Address }

export default function DeployLendPage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ROBINHOOD) as ChainX | undefined
  const assets = useAssets()
  const pools = usePools(assets.data?.assets)
  const [lend, setLend] = useState(LEND_ADDRESS)
  const [dx, setDx] = useState<Tx>({ phase: 'idle' })
  const [cx, setCx] = useState<Record<string, Tx>>({})
  const ctx = (set: (f: (x: Tx) => Tx) => void) => ({ walletClient: wallet.walletClient!, account: account!, chain, switchChain: wallet.switchChain, onPhase: (p: Phase) => set((x) => ({ ...x, phase: p })) })
  const busy = (x: Tx) => x.phase !== 'idle' && x.phase !== 'done' && x.phase !== 'failed'
  const plan = useMemo(() => planMarkets(assets.data?.assets ?? [], pools.data ?? []), [assets.data, pools.data])

  const doDeploy = async () => {
    if (!wallet.walletClient || !account) return
    setDx({ phase: 'switching' })
    try { const r = await deployLend(ctx(setDx)); setDx({ phase: 'done', ...r }); setLend(r.address) } catch (e) { setDx({ phase: 'failed', error: describeError(e) }) }
  }
  const doCreate = async (i: number) => {
    if (!wallet.walletClient || !account || !isAddress(lend)) return
    const p = plan.plans[i]
    const key = `${p.kind}-${p.stock.ticker}`
    const set = (f: (x: Tx) => Tx) => setCx((m) => ({ ...m, [key]: f(m[key] ?? { phase: 'idle' }) }))
    set(() => ({ phase: 'switching' }))
    try { const hash = await createMarket(ctx(set), lend as Address, p); set(() => ({ phase: 'done', hash })) } catch (e) { set(() => ({ phase: 'failed', error: describeError(e) })) }
  }
  const TxLine = ({ x }: { x: Tx }) => (
    <>
      {x.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red }}>{x.error}</Typography>}
      {x.phase === 'done' && x.hash && chain && <Typography sx={{ fontSize: 12, color: t.color.mark }}>{x.address ? `Deployed at ${x.address}. ` : 'Done. '}<Box component="a" href={explorerTx(chain, ROBINHOOD, x.hash)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>Transaction</Box></Typography>}
    </>
  )
  const fmtUnits = (v: bigint, d: number) => (Number(v) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return (
    <Page maxWidth={860}>
      <PageHero label="Deploy" title="Verdex Lend contract" lead="Two steps from the connected wallet: the contract, then the launch markets, two per stock. A long market lends USDG against the stock; a short market lends the stock against USDG, which is what Leverage borrows for a short. The wallet that deploys becomes the owner, which only means it keeps caps and parameters. There is no function that moves funds to the owner. The reserve share of interest goes to the treasury, where it buys VERDEX." />
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 4, display: 'grid', gap: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>1. The contract</Typography>
        <Box sx={{ fontSize: 13, color: t.color.textMuted, display: 'grid', gap: 0.5 }}>
          <span>Bytecode: {(BYTECODE.length - 2) / 2} bytes, keccak {keccak256(BYTECODE).slice(0, 18)}…</span>
          <span>Constructor: treasury {TREASURY}</span>
          <span>Currently configured: {LEND_ADDRESS || 'none'}</span>
        </Box>
        <Button onClick={() => (account ? void doDeploy() : openWalletMenu())} disabled={!!account && busy(dx)} sx={{ ...Bt, height: 44, width: 'fit-content' }}>{!account ? 'Connect wallet' : busy(dx) ? PHASE_LABEL[dx.phase] : 'Deploy Verdex Lend'}</Button>
        <TxLine x={dx} />
      </Panel>
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 2.5, display: 'grid', gap: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>2. The launch markets</Typography>
        <Box>
          <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1 }}>Lend address</Typography>
          <InputBase value={lend} onChange={(e) => setLend(e.target.value.trim())} placeholder="0x… from step 1" inputProps={{ 'aria-label': 'Lend address', spellCheck: false }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace' }} />
        </Box>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>Long markets: loan-to-value {LAUNCH.ltvBps / 100}%, liquidation at {LAUNCH.liqThresholdBps / 100}% with a {LAUNCH.liqBonusBps / 100}% bonus, caps {fmtUsd(Number(LAUNCH.supplyCap) / 1e6, 0)} supplied, {fmtUsd(Number(LAUNCH.borrowCap) / 1e6, 0)} borrowed, about {fmtUsd(LAUNCH.collateralUsd, 0)} of stock locked. Short markets: loan-to-value {LAUNCH_SHORT.ltvBps / 100}%, liquidation at {LAUNCH_SHORT.liqThresholdBps / 100}% with a {LAUNCH_SHORT.liqBonusBps / 100}% bonus, caps about {fmtUsd(LAUNCH_SHORT.supplyUsd, 0)} of stock supplied, {fmtUsd(LAUNCH_SHORT.borrowUsd, 0)} borrowed, {fmtUsd(Number(LAUNCH_SHORT.collateralCap) / 1e6, 0)} USDG locked. Both: a {LAUNCH.twapWindow / 60}-minute time-weighted price next to spot, {Number(LAUNCH.rateBaseBps) / 100}% base rate plus {Number(LAUNCH.rateSlopeBps) / 100}% at full use. Create the long markets first (ids 0 to 6), then the short ones (7 to 13); Leverage pairs them by position.</Typography>
        {plan.missing.length > 0 && <Typography sx={{ fontSize: 12, color: t.color.red }}>Left out (no deep USDG pool): {plan.missing.join(', ')}</Typography>}
        {plan.plans.map((p, i) => {
          const key = `${p.kind}-${p.stock.ticker}`
          const x = cx[key] ?? { phase: 'idle' as Phase }
          return (
            <Box key={key} sx={{ p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{i}. {p.kind === 'long' ? `Borrow USDG against ${p.stock.ticker}` : `Borrow ${p.stock.ticker} against USDG`} <Box component="span" sx={{ color: t.color.textMuted, fontWeight: 400 }}>{p.kind}</Box></Typography>
              <Box component="span" sx={{ fontSize: 12, color: t.color.textMuted, fontFamily: 'ui-monospace, Menlo, monospace' }}>{p.stock.ticker} {fmtUsd(p.pool.priceUsd)} · {p.pool.fee / 10_000}% pool, {fmtCompact(p.pool.liquidityUsd)} · caps {p.kind === 'long' ? `${fmtUsd(Number(p.supplyCap) / 1e6, 0)} / ${fmtUsd(Number(p.borrowCap) / 1e6, 0)} / ${fmtUnits(p.collateralCap, p.stock.decimals)} ${p.stock.ticker}` : `${fmtUnits(p.supplyCap, p.stock.decimals)} / ${fmtUnits(p.borrowCap, p.stock.decimals)} ${p.stock.ticker} / ${fmtUsd(Number(p.collateralCap) / 1e6, 0)}`}</Box>
              <Button onClick={() => void doCreate(i)} disabled={!account || !isAddress(lend) || busy(x)} sx={{ ...Lt, backdropFilter: 'none', height: 36, width: 'fit-content', px: 2 }}>{busy(x) ? PHASE_LABEL[x.phase] : `Create ${i}: ${p.stock.ticker} ${p.kind}`}</Button>
              <TxLine x={x} />
            </Box>
          )
        })}
      </Panel>
    </Page>
  )
}
