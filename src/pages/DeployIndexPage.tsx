// Deploys the Index factory and router from the connected wallet, then creates the launch indexes with
// units computed from today's pool prices. One page per chain: /deploy/index (Robinhood Chain) and
// /deploy/index/base. Not linked from the site. The addresses go into scripts/index-addresses.mjs afterwards.
import { useMemo, useState } from 'react'
import { Box, Button, InputBase, Typography } from '@mui/material'
import { Link, useParams } from 'react-router-dom'
import { isAddress, keccak256, type Address } from 'viem'
import { t } from '../theme/tokens'
import { Bt, Lt } from '../theme/styles'
import { fmtCompact, fmtUsd, useAssets, useChains } from '../lib/api'
import { describeError, explorerTx, type ChainX } from '../lib/lifi'
import { PHASE_LABEL, stockTokensOn, usePoolsOn, type Phase } from '../lib/pools'
import { INDEX_CHAINS, indexChain } from '../lib/indexChains'
import { DEFAULT_CAP, DEFAULT_FEE_BPS, FACTORY_BYTECODE, createIndex, deployFactory, deployRouter, planTemplate, routerBytecodeFor, templatesFor } from '../lib/indexes'
import { useWallet } from '../components/wallet/WalletProvider'
import { Page, PageHero, Panel } from './common'

type Tx = { phase: Phase; error?: string; hash?: string; address?: Address }

export default function DeployIndexPage() {
  const { chainKey } = useParams()
  const ic = indexChain(chainKey)
  const wallet = useWallet()
  const { account, openWalletMenu } = wallet
  const { data: chains } = useChains()
  const chain = chains?.find((c) => c.id === ic.id) as ChainX | undefined
  const assets = useAssets()
  const pools = usePoolsOn(ic, assets.data?.assets)
  const stocks = useMemo(() => (assets.data ? stockTokensOn(assets.data.assets, ic.id) : []), [assets.data, ic.id])
  const [factory, setFactory] = useState(ic.factoryAddress)
  const [treasury, setTreasury] = useState('')
  const [fx, setFx] = useState<Tx>({ phase: 'idle' })
  const [rx, setRx] = useState<Tx>({ phase: 'idle' })
  const [cx, setCx] = useState<Record<string, Tx>>({})
  const ctx = (set: (f: (x: Tx) => Tx) => void) => ({ walletClient: wallet.walletClient!, account: account!, chain, switchChain: wallet.switchChain, onPhase: (p: Phase) => set((x) => ({ ...x, phase: p })) })
  const busy = (x: Tx) => x.phase !== 'idle' && x.phase !== 'done' && x.phase !== 'failed'
  const plans = useMemo(() => templatesFor(ic).map((tpl) => planTemplate(ic, tpl, stocks, pools.data ?? [])), [ic, stocks, pools.data])
  const routerBytecode = routerBytecodeFor(ic)
  const q = ic.quote.symbol

  const doFactory = async () => {
    if (!wallet.walletClient || !account) return
    setFx({ phase: 'switching' })
    try { const r = await deployFactory(ctx(setFx), ic); setFx({ phase: 'done', ...r }); setFactory(r.address) } catch (e) { setFx({ phase: 'failed', error: describeError(e) }) }
  }
  const doRouter = async () => {
    if (!wallet.walletClient || !account || !isAddress(treasury)) return
    setRx({ phase: 'switching' })
    try { const r = await deployRouter(ctx(setRx), ic, treasury as Address, DEFAULT_FEE_BPS); setRx({ phase: 'done', ...r }) } catch (e) { setRx({ phase: 'failed', error: describeError(e) }) }
  }
  const doCreate = async (i: number) => {
    if (!wallet.walletClient || !account || !isAddress(factory)) return
    const key = plans[i].symbol
    const set = (f: (x: Tx) => Tx) => setCx((m) => ({ ...m, [key]: f(m[key] ?? { phase: 'idle' }) }))
    set(() => ({ phase: 'switching' }))
    try { const hash = await createIndex(ctx(set), ic, factory as Address, plans[i], DEFAULT_CAP); set(() => ({ phase: 'done', hash })) } catch (e) { set(() => ({ phase: 'failed', error: describeError(e) })) }
  }
  const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
    <Box>
      <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1 }}>{label}</Typography>
      <InputBase value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={placeholder} inputProps={{ 'aria-label': label, spellCheck: false }} sx={{ width: '100%', height: 40, px: 1.5, borderRadius: t.radius.input, background: t.color.hover, fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace' }} />
    </Box>
  )
  const TxLine = ({ x }: { x: Tx }) => (
    <>
      {x.phase === 'failed' && <Typography sx={{ fontSize: 12, color: t.color.red }}>{x.error}</Typography>}
      {x.phase === 'done' && x.hash && <Typography sx={{ fontSize: 12, color: t.color.mark }}>{x.address ? `Deployed at ${x.address}. ` : 'Done. '}<Box component="a" href={explorerTx(chain, ic.id, x.hash)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.text }}>Transaction</Box></Typography>}
    </>
  )
  return (
    <Page maxWidth={860}>
      <PageHero label={`Deploy on ${ic.name}`} title="Verdex Index contracts" lead={`Three steps from the connected wallet on ${ic.name}: the factory, the router against ${ic.dexName}'s pools in ${q}, and the launch indexes with units from today's pool prices. The wallet that deploys becomes the owner of the router (fee and treasury) and of each index it creates (the supply cap).`} />
      <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
        {INDEX_CHAINS.map((c) => <Button key={c.key} component={Link} to={c.key === 'robinhood' ? '/deploy/index' : `/deploy/index/${c.key}`} sx={{ ...(c.key === ic.key ? Bt : Lt), backdropFilter: 'none', height: 34, px: 1.75 }}>{c.name}</Button>)}
      </Box>
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 3, display: 'grid', gap: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>1. Factory</Typography>
        <Box sx={{ fontSize: 13, color: t.color.textMuted, display: 'grid', gap: 0.5 }}>
          <span>Bytecode: {(FACTORY_BYTECODE.length - 2) / 2} bytes, keccak {keccak256(FACTORY_BYTECODE).slice(0, 18)}…</span>
          <span>Currently configured: {ic.factoryAddress || 'none'}</span>
        </Box>
        <Button onClick={() => (account ? void doFactory() : openWalletMenu())} disabled={!!account && busy(fx)} sx={{ ...Bt, height: 44, width: 'fit-content' }}>{!account ? 'Connect wallet' : busy(fx) ? PHASE_LABEL[fx.phase] : 'Deploy the factory'}</Button>
        <TxLine x={fx} />
      </Panel>
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 2.5, display: 'grid', gap: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>2. Router</Typography>
        <Box sx={{ fontSize: 13, color: t.color.textMuted, display: 'grid', gap: 0.5 }}>
          <span>Bytecode: {(routerBytecode.length - 2) / 2} bytes, keccak {keccak256(routerBytecode).slice(0, 18)}… ({ic.dex === 'slipstream' ? 'VerdexIndexRouterCL, Aerodrome Slipstream pools keyed by tick spacing' : 'VerdexIndexRouter, Uniswap v3 pools'})</span>
          <span>Constructor: {ic.dexName} factory {ic.dexFactory}, {q} {ic.quote.address}, {ic.verdex === '0x0000000000000000000000000000000000000000' ? 'no VERDEX on this chain (fee never waived)' : 'VERDEX (fee waived for holders)'}, the treasury below, fee {DEFAULT_FEE_BPS} bps</span>
          <span>Currently configured: {ic.routerAddress || 'none'}</span>
        </Box>
        <Field label={ic.key === 'base' ? 'Treasury address (receives the fee in USDC; an EOA is fine until a treasury exists on Base)' : 'Treasury address (receives the fee)'} value={treasury} onChange={setTreasury} placeholder="0x…" />
        {treasury && !isAddress(treasury) && <Typography sx={{ fontSize: 12, color: t.color.red }}>Not an address.</Typography>}
        <Button onClick={() => (account ? void doRouter() : openWalletMenu())} disabled={!!account && (!isAddress(treasury) || busy(rx))} sx={{ ...Bt, height: 44, width: 'fit-content' }}>{!account ? 'Connect wallet' : busy(rx) ? PHASE_LABEL[rx.phase] : 'Deploy the router'}</Button>
        <TxLine x={rx} />
      </Panel>
      <Panel sx={{ p: { xs: 3, md: 4 }, mt: 2.5, display: 'grid', gap: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500 }}>3. The launch indexes</Typography>
        <Field label="Factory address" value={factory} onChange={setFactory} placeholder="0x… from step 1" />
        <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>Equal value per component, one share worth one {q} at today's prices, cap {Number(DEFAULT_CAP / 10n ** 18n).toLocaleString('en-US')} shares each. Units are read from each stock's deepest {q} pool as you look; a stock without a deep pool is left out and shown here.</Typography>
        {pools.isError && <Typography sx={{ fontSize: 12, color: t.color.red }}>Could not read the pools on {ic.name}. Reload in a moment.</Typography>}
        {plans.map((p, i) => {
          const x = cx[p.symbol] ?? { phase: 'idle' as Phase }
          return (
            <Box key={p.symbol} sx={{ p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'grid', gap: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{p.name} <Box component="span" sx={{ color: t.color.textMuted, fontWeight: 400 }}>{p.symbol}</Box></Typography>
              <Box sx={{ display: 'grid', gap: 0.25, fontSize: 12, color: t.color.textMuted, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {p.legs.map((l) => <span key={l.ticker}>{l.ticker.padEnd(6)} {fmtUsd(l.priceUsd)} · {Number(l.units) / 10 ** (stocks.find((s) => s.ticker === l.ticker)?.decimals ?? 18)} per share · {l.fee / 10_000}% pool, {fmtCompact(l.liquidityUsd)}</span>)}
                {p.missing.length > 0 && <Box component="span" sx={{ color: t.color.red }}>Left out (no deep {q} pool): {p.missing.join(', ')}</Box>}
              </Box>
              <Button onClick={() => void doCreate(i)} disabled={!account || !isAddress(factory) || p.legs.length < 2 || busy(x)} sx={{ ...Lt, backdropFilter: 'none', height: 36, width: 'fit-content', px: 2 }}>{busy(x) ? PHASE_LABEL[x.phase] : `Create ${p.symbol}`}</Button>
              <TxLine x={x} />
            </Box>
          )
        })}
      </Panel>
    </Page>
  )
}
