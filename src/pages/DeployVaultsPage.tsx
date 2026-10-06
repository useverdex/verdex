// Deploys the Vaults without you contract from the connected wallet: one transaction, no key leaves the
// wallet. Not linked from the site. After it confirms, the address goes into scripts/vaults-address.mjs.
import { useState } from 'react'
import { Box, Button, InputBase, Typography } from '@mui/material'
import { encodeDeployData, isAddress, keccak256, type Address } from 'viem'
import { t } from '../theme/tokens'
import { Bt, Lt } from '../theme/styles'
import { ROBINHOOD, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { FACTORY, PHASE_LABEL, USDG, client, ensureChain, type Phase } from '../lib/pools'
import { BYTECODE, DEPLOYED, VAULTS_ADDRESS, abi, explorerAddress } from '../lib/vaultsOnchain'
import { useWallet } from '../components/wallet/WalletProvider'
import { Page, PageHero, Panel } from './common'

export default function DeployVaultsPage() {
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ROBINHOOD) as ChainX | undefined
  const [executor, setExecutor] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<{ hash: string; address: Address }>()
  const ok = executor.trim() === '' || isAddress(executor.trim())
  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'failed'
  const deploy = async () => {
    if (!wallet.walletClient || !account) return
    setError(undefined)
    setPhase('switching')
    try {
      await ensureChain({ walletClient: wallet.walletClient, account, chain, switchChain: wallet.switchChain, onPhase: setPhase })
      setPhase('confirming')
      const data = encodeDeployData({ abi, bytecode: BYTECODE, args: [FACTORY, USDG.address, (executor.trim() || '0x0000000000000000000000000000000000000000') as Address] })
      const hash = await wallet.walletClient.sendTransaction({ account: account.address, chain: null, data })
      setPhase('pending')
      const receipt = await client().waitForTransactionReceipt({ hash, timeout: 120_000 })
      const address = receipt.contractAddress
      if (!address) throw new Error('No contract address in the receipt')
      setResult({ hash, address })
      setPhase('done')
    } catch (e) {
      setError(describeError(e))
      setPhase('failed')
    }
  }
  return (
    <Page maxWidth={820}>
      <PageHero label="Deploy" title="Vaults without you contract" lead="One transaction from the connected wallet. The wallet that sends it becomes the admin, which only means it keeps the executor list. Set the executor to the same wallet that runs Auto-Invest, so the server rebalances vaults on the same ten-minute pass." />
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 4, display: 'grid', gap: 2 }}>
        <Box sx={{ fontSize: 13, color: t.color.textMuted, display: 'grid', gap: 0.5 }}>
          <span>Bytecode: {(BYTECODE.length - 2) / 2} bytes, keccak {keccak256(BYTECODE).slice(0, 18)}…</span>
          <span>Constructor: Uniswap v3 factory {FACTORY}, USDG {USDG.address}, executor below</span>
          <span>Currently configured: {DEPLOYED ? VAULTS_ADDRESS : 'none'}</span>
        </Box>
        <Box>
          <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1 }}>Executor address</Typography>
          <InputBase value={executor} onChange={(e) => setExecutor(e.target.value)} placeholder="0x… the wallet that runs vaults (the Auto-Invest executor)" inputProps={{ 'aria-label': 'Executor address', spellCheck: false }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace' }} />
          {!ok && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 0.5 }}>Not an address.</Typography>}
        </Box>
        <Button onClick={() => (account ? void deploy() : openWalletMenu())} disabled={!!account && (!ok || busy)} sx={{ ...Bt, height: 44 }}>
          {!account ? 'Connect the deploying wallet' : busy ? PHASE_LABEL[phase] : `Deploy from ${account.address.slice(0, 6)}…${account.address.slice(-4)}`}
        </Button>
        {error && <Typography sx={{ fontSize: 12, color: t.color.red }}>{error}</Typography>}
        {result && (
          <Box sx={{ p: 2, borderRadius: t.radius.panel, background: 'rgba(194,234,138,.10)', border: '1px solid rgba(194,234,138,.3)', display: 'grid', gap: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Deployed.</Typography>
            <Typography sx={{ fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all' }}>{result.address}</Typography>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>Put this address in scripts/vaults-address.mjs (or VITE_VAULTS_ADDRESS and VAULTS_ADDRESS in Railway) and redeploy the site; the executor picks it up on the next pass.</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {chain && <Button component="a" href={explorerTx(chain, ROBINHOOD, result.hash)} target="_blank" rel="noopener noreferrer" sx={{ ...Lt, backdropFilter: 'none', height: 34, px: 1.75 }}>Transaction</Button>}
              <Button component="a" href={explorerAddress(result.address)} target="_blank" rel="noopener noreferrer" sx={{ ...Lt, backdropFilter: 'none', height: 34, px: 1.75 }}>Contract</Button>
            </Box>
          </Box>
        )}
      </Panel>
    </Page>
  )
}
