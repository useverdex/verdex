import { useEffect, useState } from 'react'
import { Avatar, Box, Button, Typography } from '@mui/material'
import { formatUnits } from 'viem'
import { BRAND, fonts, t, z } from '../theme/tokens'
import { Bt } from '../theme/styles'
import { ARC, ROBINHOOD, chainLogo, useChains } from '../lib/api'
import { readBalance } from '../lib/lifi'
import { shortAddress, useWallet } from '../components/wallet/WalletProvider'
import { Page, PageHero, Panel } from './common'
import { pub } from '../lib/base'

const WATCH = [
  { chainId: ROBINHOOD, symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18, logo: '/img/tokens/eth.png' },
  { chainId: ROBINHOOD, symbol: 'USDG', address: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', decimals: 6, logo: '/img/tokens/usdg.png' },
  { chainId: ARC, symbol: 'USDC', address: '0x3600000000000000000000000000000000000000', decimals: 6, logo: '/img/tokens/usdc.png' },
]

export default function PortfolioPage() {
  const { account, openWalletMenu } = useWallet()
  const { data: chains } = useChains()
  const [balances, setBalances] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!account || !chains) return
    let alive = true
    Promise.all(
      WATCH.map(async (w) => {
        const chain = chains.find((c) => c.id === w.chainId)
        if (!chain) return [w.symbol + w.chainId, '-'] as const
        try {
          const b = await readBalance(chain, w.address, account.address)
          return [w.symbol + w.chainId, Number(formatUnits(b, w.decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 })] as const
        } catch {
          return [w.symbol + w.chainId, '-'] as const
        }
      }),
    ).then((r) => alive && setBalances(Object.fromEntries(r)))
    return () => {
      alive = false
    }
  }, [account, chains])
  return (
    <Page>
      <PageHero label="Portfolio" title={`Everything You Hold on ${BRAND.name}`} lead="Connect to see your baskets, lending positions and every swap, bridge and deposit in one place." />
      {!account ? (
        <Button onClick={openWalletMenu} sx={{ ...Bt, mt: -2 }}>
          Connect
        </Button>
      ) : (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) minmax(0,1fr)' } }}>
          <Panel sx={{ p: 3 }}>
            <Typography sx={{ ...t.type.label, color: t.color.textSoft }}>Connected address</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
              <Avatar src={account.connector.icon} sx={{ width: 36, height: 36, background: z.surface2 }} />
              <Box>
                <Typography sx={{ fontFamily: fonts.code, fontSize: 16 }}>{shortAddress(account.address)}</Typography>
                <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>
                  {account.connector.name} · {chains?.find((c) => c.id === account.chainId)?.name ?? `chain ${account.chainId}`}
                </Typography>
              </Box>
            </Box>
          </Panel>
          <Panel sx={{ p: 3 }}>
            <Typography sx={{ ...t.type.label, color: t.color.textSoft }}>Balances on live chains</Typography>
            <Box sx={{ display: 'grid', gap: 1.5, mt: 2 }}>
              {WATCH.map((w) => (
                <Box key={w.symbol + w.chainId} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar src={pub(w.logo)} sx={{ width: 28, height: 28, background: z.surface2 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{w.symbol}</Typography>
                    <Typography sx={{ fontSize: 12, color: t.color.textMuted, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Avatar src={chainLogo(chains?.find((c) => c.id === w.chainId))} sx={{ width: 12, height: 12 }} /> {chains?.find((c) => c.id === w.chainId)?.name}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{balances[w.symbol + w.chainId] ?? '…'}</Typography>
                </Box>
              ))}
            </Box>
          </Panel>
          <Panel sx={{ p: 3, gridColumn: { md: '1 / -1' } }}>
            <Typography sx={{ ...t.type.label, color: t.color.textSoft }}>Baskets, lending positions and transfers</Typography>
            <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 1 }}>Positions appear here as soon as a basket purchase, deposit or transfer is signed from this address.</Typography>
          </Panel>
        </Box>
      )}
    </Page>
  )
}
