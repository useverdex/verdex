// Deploys the treasury from the connected wallet. Not linked from the site. The address goes into
// scripts/treasury-address.mjs afterwards, and the Index router's setTreasury points its fee here.
import { useState } from 'react'
import { Box, Button, InputBase, Typography } from '@mui/material'
import { isAddress, keccak256, type Address } from 'viem'
import { t } from '../theme/tokens'
import { Bt } from '../theme/styles'
import { ROBINHOOD, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, USDG, WETH, type Phase } from '../lib/pools'
import { CONTRACTS as TOKEN } from '../lib/token'
import { BYTECODE, LIFI_DIAMOND, TREASURY_ADDRESS, USDG_ETH_POOL, deployTreasury } from '../lib/treasury'
import { useWallet } from '../components/wallet/WalletProvider'
import { Page, PageHero, Panel } from './common'

export default function DeployTreasuryPage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ROBINHOOD) as ChainX | undefined
  const [executor, setExecutor] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<{ hash: string; address: Address }>()
  const ok = isAddress(executor.trim())
  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'failed'
  const deploy = async () => {
    if (!wallet.walletClient || !account || !ok) return
    setError(undefined)
    setPhase('switching')
    try {
      const r = await deployTreasury({ walletClient: wallet.walletClient, account, chain, switchChain: wallet.switchChain, onPhase: setPhase }, executor.trim() as Address)
      setResult(r)
      setPhase('done')
    } catch (e) {
      setError(describeError(e))
      setPhase('failed')
    }
  }
  return (
    <Page maxWidth={820}>
      <PageHero label="Deploy" title="Treasury contract" lead="One transaction from the connected wallet. The wallet that sends it becomes the owner, which only means it keeps the executor list, the router list, the burn share and the slippage band. The executor below is the server wallet that sweeps and pays out; the aggregator's router is allowlisted from the start." />
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 4, display: 'grid', gap: 2 }}>
        <Box sx={{ fontSize: 13, color: t.color.textMuted, display: 'grid', gap: 0.5 }}>
          <span>Bytecode: {(BYTECODE.length - 2) / 2} bytes, keccak {keccak256(BYTECODE).slice(0, 18)}…</span>
          <span>VERDEX {TOKEN.token} · USDG {USDG.address} · WETH {WETH.address}</span>
          <span>USDG/WETH pool {USDG_ETH_POOL} · PoolManager {TOKEN.poolManager} · pool id {TOKEN.poolId.slice(0, 18)}…</span>
          <span>Router allowlisted: {LIFI_DIAMOND} (the aggregator's diamond on Robinhood Chain)</span>
          <span>Currently configured: {TREASURY_ADDRESS || 'none'}</span>
        </Box>
        <Box>
          <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1 }}>Executor address</Typography>
          <InputBase value={executor} onChange={(e) => setExecutor(e.target.value)} placeholder="0x… the server wallet that runs sweeps and payouts" inputProps={{ 'aria-label': 'Executor address', spellCheck: false }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace' }} />
          {executor && !ok && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 0.5 }}>Not an address.</Typography>}
        </Box>
        <Button onClick={() => (account ? void deploy() : openWalletMenu())} disabled={!!account && (!ok || busy)} sx={{ ...Bt, height: 44 }}>{!account ? 'Connect wallet' : busy ? PHASE_LABEL[phase] : 'Deploy the treasury'}</Button>
        {error && <Typography sx={{ fontSize: 12, color: t.color.red }}>{error}</Typography>}
        {result && chain && (
          <Box sx={{ p: 2, borderRadius: t.radius.panel, background: 'rgba(194,234,138,.10)', border: '1px solid rgba(194,234,138,.3)', fontSize: 13 }}>
            Deployed at <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{result.address}</Box>. <Box component="a" href={explorerTx(chain, ROBINHOOD, result.hash)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>Transaction</Box>. Next: put it in scripts/treasury-address.mjs and call setTreasury on the Index router.
          </Box>
        )}
      </Panel>
    </Page>
  )
}
