// Copy a wallet: paste any address on Robinhood Chain, see the tokenized stocks it holds at their weights (read
// from the chain, valued at the pools), and hand those weights to a Vault on this device or a Vault without you.
import { useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isAddress } from 'viem'
import { BRAND, t, z } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { ROBINHOOD, fmtUsd, useAssets } from '../lib/api'
import { usePools } from '../lib/pools'
import { addVault, defaultQuote, toVaultAsset } from '../lib/vaults'
import { ROBINHOOD_INDEX } from '../lib/indexChains'
import { useIndexes } from '../lib/indexes'
import { MAX_LEGS, short, targetsQuery, topLegs, useWalletStocks } from '../lib/copy'
import { resolveImg } from '../lib/img'
import { useWallet } from '../components/wallet/WalletProvider'
import { CheckIcon, CopyIcon, ExternalIcon, LockIcon, RefreshIcon, SearchIcon, ShieldIcon, VaultIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel } from './common'

function Step({ n, icon, title, text }: { n: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Panel sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}>{icon}</Box>
        <Typography sx={{ ...t.type.caption, color: t.color.textFaint }}>0{n}</Typography>
      </Box>
      <Typography sx={{ ...t.type.cardTitle, color: t.color.text, mt: 2.5 }}>{title}</Typography>
      <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 1 }}>{text}</Typography>
    </Panel>
  )
}

// Addresses worth a look: public, and holding several tokenized stocks when this was written.
const EXAMPLES: { label: string; address: string }[] = [
  { label: 'A wallet with 68 stocks', address: '0x9f736f87e6293ac1bd9142e257dbfac8b7acf1ae' },
  { label: 'A wallet with 46 stocks', address: '0x1a18a8b96eac3f980133a18402d04194f1faa4e7' },
]

export default function CopyPage() {
  const { account, openWalletMenu } = useWallet()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [input, setInput] = useState(params.get('address') ?? '')
  const address = input.trim()
  const assets = useAssets()
  const pools = usePools(assets.data?.assets)
  const w = useWalletStocks(address, assets.data?.assets, pools.data)
  const [done, setDone] = useState<string>()
  const indexes = useIndexes(ROBINHOOD_INDEX, assets.data?.assets, pools.data)
  // The index contracts hold real baskets: handy addresses to try.
  const examples = [...EXAMPLES, ...(indexes.data ?? []).filter((x) => x.totalSupply > 0n).slice(0, 2).map((x) => ({ label: `${x.symbol}, the ${x.name.replace(/^Verdex /, '')} index`, address: x.address }))]
  const look = (a: string) => { setInput(a); setDone(undefined); setParams(a ? { address: a } : {}) }
  const copyIt = () => {
    if (!account) return openWalletMenu()
    if (!w.data || !assets.data) return
    const quote = defaultQuote(ROBINHOOD)
    const vaultAssets = topLegs(w.data.copyable).map((h) => { const a = assets.data!.assets.find((x) => x.ticker === h.stock.ticker); return a ? toVaultAsset(a, ROBINHOOD, h.weight) : undefined }).filter((x): x is NonNullable<typeof x> => !!x)
    if (vaultAssets.length < 1) return
    addVault({ owner: account.address, name: `Copy of ${short(w.data.address)}`, chainId: ROBINHOOD, quote: { chainId: quote.chainId, address: quote.address, symbol: quote.symbol, decimals: quote.decimals }, assets: vaultAssets, rule: 'drift', threshold: 5, nextRunAt: Date.now() + 30 * 86_400_000 })
    setDone('vault')
    navigate('/vaults#vaults')
    window.scrollTo({ top: 0 })
  }
  const keepIt = () => { if (!w.data) return; navigate(`/vaults/without-you?tokens=${encodeURIComponent(targetsQuery(w.data.copyable))}#vaults-composer`); window.scrollTo({ top: 0 }) }
  const d = w.data

  return (
    <Page>
      <PageHero
        label="Copy a wallet"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Live</Box>}
        title={<>Their allocation.<br />Your keys.</>}
        lead={`Paste any address on Robinhood Chain. The page reads the tokenized stocks it holds, values them at the pools and turns them into weights, all from the chain. Copy it buys the same mix into your own wallet, leg by leg with a floor on each; Keep it hands the weights to a Vault without you, so the executor keeps you at them. ${BRAND.name} reads, it never ranks, lists or stores anyone.`}
      />

      <Panel sx={{ mt: { xs: 4, md: 6 }, p: { xs: 2.5, md: 3 } }}>
        <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1.25 }}>An address on Robinhood Chain</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <InputBase value={input} onChange={(e) => look(e.target.value)} placeholder="0x…" inputProps={{ 'aria-label': 'Address to copy', spellCheck: false }} sx={{ flex: 1, minWidth: 260, height: 44, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 14, fontFamily: 'ui-monospace, Menlo, monospace' }} />
          {account && <Button onClick={() => look(account.address)} sx={{ ...Lt, backdropFilter: 'none', height: 44, px: 2, gap: 0.75 }}><WalletIcon size={14} /> My other wallet</Button>}
          {examples.map((e) => <Button key={e.address} onClick={() => look(e.address)} sx={{ ...Lt, backdropFilter: 'none', height: 44, px: 2 }}>{e.label}</Button>)}
        </Box>
        {address && !isAddress(address) && <Typography sx={{ fontSize: 12, color: t.color.red, mt: 1 }}>Not an address.</Typography>}
        {isAddress(address) && w.isLoading && <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 2 }}>Reading {short(address)} on Robinhood Chain…</Typography>}
        {w.isError && <Typography sx={{ fontSize: 13, color: t.color.red, mt: 2 }}>Could not read that address right now. Try again in a moment.</Typography>}
        {d && (
          <Box sx={{ mt: 2.5 }}>
            {d.holdings.length === 0 ? (
              <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{short(d.address)} holds no tokenized stock {BRAND.name} lists on Robinhood Chain.</Typography>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 500 }}>{fmtUsd(d.totalUsd)}</Typography>
                  <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>in {d.holdings.length} tokenized stock{d.holdings.length === 1 ? '' : 's'} at the pools' spot prices · {d.copyable.length} with a deep USDG pool, {fmtUsd(d.copyableUsd)}, can be copied{d.copyable.length > MAX_LEGS ? `; the ${MAX_LEGS} largest make the vault` : ''}</Typography>
                  <Box component="a" href={`${ROBINHOOD_INDEX.explorer}/address/${d.address}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none', ml: 'auto' }}>Explorer <ExternalIcon size={12} /></Box>
                </Box>
                <Box sx={{ display: 'grid', gap: 0.5, mt: 2 }}>
                  {d.holdings.map((h) => (
                    <Box key={h.stock.address} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 13, py: 0.75, borderBottom: `1px solid ${t.color.border}`, opacity: h.copyable ? 1 : 0.55 }}>
                      <Avatar src={resolveImg(h.stock.logo)} sx={{ width: 22, height: 22, background: z.surface2, fontSize: 9 }}>{h.stock.ticker[0]}</Avatar>
                      <Typography sx={{ fontSize: 13, fontWeight: 500, width: 64 }}>{h.stock.ticker}</Typography>
                      <Typography sx={{ fontSize: 12, color: t.color.textMuted, width: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>{h.stock.name}</Typography>
                      <Box sx={{ flex: 1, height: 6, borderRadius: 3, background: t.color.hover, overflow: 'hidden' }}><Box sx={{ width: `${Math.min(100, h.weight)}%`, height: '100%', background: t.color.mark, borderRadius: 3 }} /></Box>
                      <Typography sx={{ fontSize: 12, color: t.color.textMuted, width: 190, textAlign: 'right' }}>{h.units.toLocaleString('en-US', { maximumFractionDigits: h.units >= 100 ? 0 : 3 })} · {fmtUsd(h.usd)}{h.copyable ? ` · ${h.weight.toFixed(1)}%` : h.pool ? ' · pool too thin' : ' · no pool'}</Typography>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5, alignItems: 'center' }}>
                  <Button onClick={copyIt} disabled={d.copyable.length === 0} sx={{ ...Bt, gap: 1 }}><CopyIcon size={14} /> {account ? 'Copy it into my wallet' : 'Connect to copy it'}</Button>
                  <Button onClick={keepIt} disabled={d.copyable.length < 2} sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}><VaultIcon size={14} /> Keep it, without you</Button>
                  <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>Copy creates a vault on this device at these weights; you fund it with USDG on the Vaults page and each leg buys from the pool with a floor. Keep it opens Vaults without you with the weights filled in.</Typography>
                </Box>
                {done === 'vault' && <Typography sx={{ fontSize: 13, mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}><CheckIcon size={15} /> Saved as a vault on this device. Fund it on the Vaults page.</Typography>}
              </>
            )}
          </Box>
        )}
      </Panel>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<SearchIcon size={20} />} title="Read, from the chain" text={`The page asks the ${BRAND.name} stock list which tokens exist on Robinhood Chain, reads the address's balance of each in one call, and values them at their USDG pools' spot prices. Stocks with no pool or a thin one are shown and skipped.`} />
          <Step n={2} icon={<CopyIcon size={20} />} title="Copy: buy the mix" text="A vault on this device at those weights. On the Vaults page you add USDG; the page splits it by the weights and buys each stock from its pool, one swap your wallet confirms, each with a floor. Rebalance when it drifts, or not." />
          <Step n={3} icon={<RefreshIcon size={20} />} title="Keep: without you" text="Vaults without you with the same weights, if you already hold the stocks or once you do. The contract sells the overweight and buys the underweight when they drift, inside one transaction, while your wallet is closed." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}><MarkIcon size={22} /></Box>
            <Box sx={{ ...Vg, ml: 0 }}>Phase 3, box 1</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Their stocks were always public.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>
            Every balance on the chain is readable by anyone; this page only reads. It does not know who an address is, keeps no list, ranks nobody. Paste a wallet you admire, a fund's, or your own other one. There is no contract to trust and no fee: the buying goes through the same pools and the same floors as everything else here.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <Box component={Link} to="/vaults" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Vaults on this device</Box>
            <Box component={Link} to="/vaults/without-you" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Vaults without you</Box>
            <Box component={Link} to="/docs#copy-a-wallet" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, color: t.color.text, textDecoration: 'none' }}>Docs</Box>
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {[
            [<ShieldIcon key="a" size={18} />, 'Weights, not trades', 'You copy an allocation at today’s prices, not their entry prices or their timing. What they do next, you will not see here.'],
            [<LockIcon key="b" size={18} />, 'Nothing pooled', 'Your USDG buys your stocks into your wallet. Nobody’s funds touch anyone else’s, and the address you copy never knows.'],
            [<CheckIcon key="c" size={18} />, 'Thin pools are skipped', 'A stock without a deep USDG pool cannot be bought well, so it is shown but left out of the weights.'],
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
