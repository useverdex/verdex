// Deploys Verdex Leverage from the connected wallet against the configured Lend, then sets the open-interest
// caps for every Lend market in one transaction. Not linked from the site. The address goes into
// scripts/leverage-address.mjs afterwards.
import { useState } from 'react'
import { Box, Button, InputBase, Typography } from '@mui/material'
import { isAddress, keccak256, type Address } from 'viem'
import { t } from '../theme/tokens'
import { Bt } from '../theme/styles'
import { ROBINHOOD, fmtUsd, useAssets, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, usePools, type Phase } from '../lib/pools'
import { LEND, LEND_ADDRESS, useMarkets } from '../lib/lend'
import { BYTECODE, DEFAULT_FEE_BPS, LAUNCH_CAP_USD, LEVERAGE_ADDRESS, TREASURY, deployLeverage, setCaps } from '../lib/leverage'
import { useWallet } from '../components/wallet/WalletProvider'
import { Page, PageHero, Panel } from './common'

type Tx = { phase: Phase; error?: string; hash?: string; address?: Address }

export default function DeployLeveragePage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ROBINHOOD) as ChainX | undefined
  const assets = useAssets()
  const pools = usePools(assets.data?.assets)
  const markets = useMarkets(assets.data?.assets, pools.data)
  const [lev, setLev] = useState(LEVERAGE_ADDRESS)
  const [dx, setDx] = useState<Tx>({ phase: 'idle' })
  const [cx, setCx] = useState<Tx>({ phase: 'idle' })
  const ctx = (set: (f: (x: Tx) => Tx) => void) => ({ walletClient: wallet.walletClient!, account: account!, chain, switchChain: wallet.switchChain, onPhase: (p: Phase) => set((x) => ({ ...x, phase: p })) })
  const busy = (x: Tx) => x.phase !== 'idle' && x.phase !== 'done' && x.phase !== 'failed'
  const ids = (markets.data ?? []).map((m) => m.id)
  const cap = BigInt(LAUNCH_CAP_USD) * 10n ** 6n

  const doDeploy = async () => {
    if (!wallet.walletClient || !account) return
    setDx({ phase: 'switching' })
    try { const r = await deployLeverage(ctx(setDx)); setDx({ phase: 'done', ...r }); setLev(r.address) } catch (e) { setDx({ phase: 'failed', error: describeError(e) }) }
  }
  const doCaps = async () => {
    if (!wallet.walletClient || !account || !isAddress(lev) || ids.length === 0) return
    setCx({ phase: 'switching' })
    try { const hash = await setCaps(ctx(setCx), lev as Address, ids, ids.map(() => cap)); setCx({ phase: 'done', hash }) } catch (e) { setCx({ phase: 'failed', error: describeError(e) }) }
  }
  const TxLine = ({ x }: { x: Tx }) => (
    <>
      {x.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red }}>{x.error}</Typography>}
      {x.phase === 'done' && x.hash && chain && <Typography sx={{ fontSize: 12, color: t.color.mark }}>{x.address ? `Deployed at ${x.address}. ` : 'Done. '}<Box component="a" href={explorerTx(chain, ROBINHOOD, x.hash)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>Transaction</Box></Typography>}
    </>
  )
  return (
    <Page maxWidth={860}>
      <PageHero label="Deploy" title="Verdex Leverage contract" lead="Two steps from the connected wallet: the contract, pointed at the configured Lend, then the open-interest caps for every Lend market in one transaction. The wallet that deploys becomes the owner, which only means it keeps the caps, the fee and the treasury address. The contract holds nothing; every position lives in Lend, in an account that belongs to its wallet." />
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 4, display: 'grid', gap: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>1. The contract</Typography>
        <Box sx={{ fontSize: 13, color: t.color.textMuted, display: 'grid', gap: 0.5 }}>
          <span>Bytecode: {(BYTECODE.length - 2) / 2} bytes, keccak {keccak256(BYTECODE).slice(0, 18)}…</span>
          <span>Constructor: Lend {LEND_ADDRESS || '(not configured, deploy Lend first)'}, USDG, VERDEX, treasury {TREASURY}, fee {DEFAULT_FEE_BPS} bps (waived for VERDEX holders)</span>
          <span>Currently configured: {LEVERAGE_ADDRESS || 'none'}</span>
        </Box>
        <Button onClick={() => (account ? void doDeploy() : openWalletMenu())} disabled={!!account && (busy(dx) || !isAddress(LEND) || LEND === '0x0000000000000000000000000000000000000000')} sx={{ ...Bt, height: 44, width: 'fit-content' }}>{!account ? 'Connect wallet' : busy(dx) ? PHASE_LABEL[dx.phase] : 'Deploy Verdex Leverage'}</Button>
        <TxLine x={dx} />
      </Panel>
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 2.5, display: 'grid', gap: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>2. The caps</Typography>
        <Box>
          <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1 }}>Leverage address</Typography>
          <InputBase value={lev} onChange={(e) => setLev(e.target.value.trim())} placeholder="0x… from step 1" inputProps={{ 'aria-label': 'Leverage address', spellCheck: false }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace' }} />
        </Box>
        <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{fmtUsd(LAUNCH_CAP_USD, 0)} of open interest per Lend market, {ids.length} markets read from Lend{ids.length ? ` (ids ${ids[0].toString()} to ${ids[ids.length - 1].toString()})` : ''}. One transaction.</Typography>
        <Button onClick={() => void doCaps()} disabled={!account || !isAddress(lev) || ids.length === 0 || busy(cx)} sx={{ ...Bt, height: 44, width: 'fit-content' }}>{busy(cx) ? PHASE_LABEL[cx.phase] : `Set ${ids.length} caps`}</Button>
        <TxLine x={cx} />
      </Panel>
    </Page>
  )
}
