import { useMemo } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { BRAND, t } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { fmtUsd } from '../lib/api'
import { VERDEX_FEE } from '../lib/autoInvest'
import { EARLY_ACCESS_BPS, fmtVerdex, useHolding } from '../lib/holding'
import { useWallet } from '../components/wallet/WalletProvider'
import { BOUNTY, BUYBACK, CONTRACTS, DEXSCREENER, FEE, SUPPLY, explorerAddress, explorerTx, useEthUsd, useMarket, useTreasury, type Move, type Sweep } from '../lib/token'
import { BoltIcon, CheckIcon, CoinIcon, ExternalIcon, LockIcon, ReceiptIcon, RefreshIcon, ShieldIcon, WalletIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel, Stats } from './common'

const fmtM = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(0)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : n.toFixed(0))
const fmtEth = (n: number, d = 4) => `${n.toFixed(d)} ETH`
const fmtPct = (n: number, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`
const fmtWhen = (ms?: number, block?: number) => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : block ? `block ${block.toLocaleString('en-US')}` : '')
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

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
      <Box sx={{ display: 'flex', color: t.color.textLabel }}>
        <ExternalIcon size={12} />
      </Box>
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

function YourWallet({ price, onBuy }: { price: number; onBuy: () => void }) {
  const { account, openWalletMenu } = useWallet()
  const { data: h, isLoading, isError } = useHolding(account?.address)
  const usd = h && price ? h.verdex * price : 0
  const toEarlyUsd = h && price ? h.toEarly * price : 0
  const progress = h ? Math.min(1, h.earlyAt > 0 ? h.verdex / h.earlyAt : 0) : 0
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, mt: 4 }} data-testid="your-wallet">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '11px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}>
          <WalletIcon size={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Your wallet</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>
            {!account ? 'Connect to see your VERDEX, your share of the supply and what it unlocks.' : isLoading ? 'Reading the token contract…' : isError ? 'The chain did not answer. Try again in a moment.' : h ? `${h.verdex.toLocaleString('en-US', { maximumFractionDigits: 0 })} VERDEX · ${h.sharePct.toFixed(3)}% of the supply${usd ? ` · ${fmtUsd(usd, 0)}` : ''}` : ''}
          </Typography>
        </Box>
        {!account ? (
          <Button onClick={openWalletMenu} sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
            <WalletIcon size={14} /> Connect
          </Button>
        ) : (
          <Button onClick={onBuy} sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
            <CoinIcon size={14} /> {h?.early ? 'Buy more' : 'Buy VERDEX'}
          </Button>
        )}
      </Box>
      {account && h && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2.5 }}>
          <Box sx={{ p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ mt: 0.25, color: h.holder ? t.color.mark : t.color.textLabel, display: 'flex' }}>
              <CheckIcon size={18} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{h.holder ? `No ${BRAND.name} fee` : `${(VERDEX_FEE * 100).toFixed(2)}% ${BRAND.name} fee`}</Typography>
              <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>{h.holder ? 'Every swap, bridge, plan, order, rebalance and agent trade from this wallet carries no Verdex fee.' : 'Any amount of VERDEX in this wallet makes it zero.'}</Typography>
            </Box>
          </Box>
          <Box sx={{ p: 2, borderRadius: t.radius.panel, background: t.color.raised, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ mt: 0.25, color: h.early ? t.color.mark : t.color.textLabel, display: 'flex' }}>
              <BoltIcon size={18} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{h.early ? 'Early access' : `Early access at ${fmtVerdex(h.earlyAt)} VERDEX`}</Typography>
              <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>{h.early ? 'Every new feature opens for this wallet before its public date.' : `${fmtVerdex(h.toEarly)} more${toEarlyUsd ? ` (about ${fmtUsd(toEarlyUsd, 0)})` : ''} and every new feature opens for this wallet first.`}</Typography>
              <Box sx={{ mt: 1.25, height: 4, borderRadius: 2, background: t.color.hover, overflow: 'hidden' }}>
                <Box sx={{ width: `${Math.max(2, progress * 100)}%`, height: '100%', background: t.color.mark, borderRadius: 2 }} />
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Panel>
  )
}

export default function TokenPage() {
  const navigate = useNavigate()
  const { data: m, isError: mErr } = useMarket()
  const { data: eth } = useEthUsd()
  const { data: tr, isLoading: trLoading, isError: trErr } = useTreasury()
  const ethUsd = eth ?? 0
  const price = m?.price ?? 0
  const lastSweeps = useMemo(() => [...(tr?.sweeps ?? [])].reverse().slice(0, 6), [tr])
  const moves = useMemo(() => {
    const rows: { kind: 'buy' | 'burn' | 'out'; row: Move }[] = [...(tr?.buys ?? []).map((row) => ({ kind: 'buy' as const, row })), ...(tr?.burns ?? []).map((row) => ({ kind: 'burn' as const, row })), ...(tr?.outs ?? []).map((row) => ({ kind: 'out' as const, row }))]
    return rows.sort((a, b) => b.row.block - a.row.block).slice(0, 8)
  }, [tr])
  const holdingPct = tr ? (tr.holdingVerdex / SUPPLY) * 100 : 0
  const burnedPct = tr ? (tr.burnedTotal / SUPPLY) * 100 : 0
  const pendingUsd = tr ? tr.pendingEth * ethUsd + tr.pendingVerdex * price : 0
  const buy = () => { navigate('/?buy=VERDEX'); window.scrollTo({ top: 0 }) }

  return (
    <Page>
      <PageHero
        label="VERDEX"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Live</Box>}
        title={
          <>
            The token.
            <br />
            Read from the chain.
          </>
        }
        lead={`Every fee, every sweep, every dev buy and every burn, read from Robinhood Chain and the aggregator in your browser as you look at it. Nothing on this page is a screenshot, and every number links to its transaction.`}
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button onClick={buy} sx={{ ...Bt, gap: 1 }}>
              <CoinIcon size={15} /> Buy VERDEX
            </Button>
            <Button component="a" href={DEXSCREENER} target="_blank" rel="noopener noreferrer" sx={{ ...Lt, backdropFilter: 'none', gap: 1 }}>
              Chart <ExternalIcon size={13} />
            </Button>
          </Box>
        }
      />

      <Stats
        items={[
          { label: 'Price', value: m ? `$${price.toFixed(7)}` : mErr ? '–' : '…' },
          { label: 'Market cap', value: m ? fmtUsd(m.marketCap, 0) : '…' },
          { label: 'Liquidity', value: m ? fmtUsd(m.liquidity, 0) : '…' },
          { label: '24h volume', value: m ? fmtUsd(m.volume24h, 0) : '…' },
        ]}
      />
      {m && (
        <Typography sx={{ fontSize: 13, color: t.color.textLabel, mt: 1.5 }}>
          24h: {m.buys24h.toLocaleString('en-US')} buys, {m.sells24h.toLocaleString('en-US')} sells · {fmtPct(m.change.h1)} in 1h, {fmtPct(m.change.h6)} in 6h, {fmtPct(m.change.h24)} in 24h · from DexScreener, refreshed every minute
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mt: { xs: 6, md: 8 }, alignItems: 'start' }}>
        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '11px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}>
              <ReceiptIcon size={18} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Creator fees</Typography>
              <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>{FEE.totalPct}% on every swap: {FEE.creatorTaxPct}% creator tax and {FEE.hookFeePct}% pool fee. {FEE.creatorSharePct}% of it goes to the creator, {FEE.protocolSharePct}% to the launchpad.</Typography>
            </Box>
          </Box>
          {trErr ? (
            <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>The chain is rate-limiting reads right now. Reload in a minute.</Typography>
          ) : (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Big value={tr ? fmtEth(tr.totalEth, 2) : '…'} sub={tr ? `≈ ${fmtUsd(tr.totalEth * ethUsd, 0)} swept to the creator in ${tr.sweeps.length} sweeps` : 'reading the escrow…'} />
                <Big value={tr ? fmtUsd(pendingUsd, 0) : '…'} sub={tr ? `waiting for the next sweep: ${fmtEth(tr.pendingEth, 3)} + ${fmtM(tr.pendingVerdex)} VERDEX` : ''} />
              </Box>
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${t.color.border}` }}>
                <Label>Last sweeps</Label>
                {trLoading && <Typography sx={{ fontSize: 13, color: t.color.textLabel }}>Reading the escrow's credit events…</Typography>}
                {lastSweeps.map((s: Sweep) => (
                  <TxRow key={s.tx} when={fmtWhen(s.at, s.block)} what="Fees swept to the creator wallet" amount={fmtEth(s.eth)} tx={s.tx} />
                ))}
              </Box>
            </>
          )}
        </Panel>

        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '11px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}>
              <WalletIcon size={18} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Dev wallet</Typography>
              <Typography sx={{ fontSize: 12, color: t.color.textMuted }}>
                The creator wallet from the launch record{tr ? <>: <Box component="a" href={explorerAddress(tr.creator)} target="_blank" rel="noopener noreferrer" sx={{ color: t.color.textSoft }}>{short(tr.creator)}</Box></> : ''}. What it bought went to the burn address, is still here, or was sold{tr && tr.soldVerdex > 0 ? <>: {fmtM(tr.soldVerdex)} VERDEX moved out and sold on 30 September 2026</> : ''}. All of it is listed below with the transaction.
              </Typography>
            </Box>
          </Box>
          {trErr ? (
            <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>The chain is rate-limiting reads right now. Reload in a minute.</Typography>
          ) : (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Big value={tr ? `${fmtM(tr.holdingVerdex)}` : '…'} sub={tr ? `VERDEX held, ${holdingPct.toFixed(2)}% of supply ≈ ${fmtUsd(tr.holdingVerdex * price, 0)}` : 'reading the token…'} accent />
                <Big value={tr ? `${fmtM(tr.burnedTotal)}` : '…'} sub={tr ? `VERDEX burned, ${burnedPct.toFixed(2)}% of supply, ${fmtM(tr.burnedByDev)} of it by the dev` : ''} />
              </Box>
              <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${t.color.border}` }}>
                <Label>Dev buys, burns and sales</Label>
                {moves.map(({ kind, row }) => (
                  <TxRow key={row.tx} when={fmtWhen(row.at, row.block)} what={kind === 'buy' ? 'Bought from the pool' : kind === 'burn' ? 'Sent to the burn address' : 'Moved out and sold'} amount={`${kind === 'buy' ? '+' : '−'}${fmtM(row.verdex)}`} tx={row.tx} accent={kind === 'buy'} />
                ))}
              </Box>
            </>
          )}
        </Panel>
      </Box>

      {BUYBACK.live && (
        <Panel sx={{ mt: 2.5, p: { xs: 2.5, md: 3 }, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '11px', background: t.color.hover, display: 'grid', placeItems: 'center', color: t.color.mark }}>
            <RefreshIcon size={18} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 500 }}>Buyback: {BUYBACK.sharePct}% of creator fees buy VERDEX {BUYBACK.cadence}</Typography>
            <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>Executed from the dev wallet through {BRAND.name} itself, so every buy appears in the list above with its transaction. What is bought is held or burned, and listed either way.</Typography>
          </Box>
        </Panel>
      )}

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>What holding it does</Typography>
        <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2, maxWidth: 720 }}>Two things, both read from the wallet's balance on Robinhood Chain before each quote. No staking contract, no lock, no registration.</Typography>
        <YourWallet price={price} onBuy={buy} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, gap: 2.5, mt: 2.5 }}>
          <Step icon={<CheckIcon size={20} />} title="Any amount: zero Verdex fee" text={`Swaps, bridges, private swaps, Auto-Invest buys, order fills, vault rebalances and agent trades all carry a ${(VERDEX_FEE * 100).toFixed(2)}% ${BRAND.name} fee. Hold any VERDEX and it is 0, shown struck through on every quote.`} />
          <Step icon={<BoltIcon size={20} />} title={`${EARLY_ACCESS_BPS / 100}% of supply: early access`} text={`Every new feature opens first to wallets holding at least ${EARLY_ACCESS_BPS / 100}% of the supply, then to everyone at a stated time. The threshold follows the live supply, so burns lower it.`} />
          <Step icon={<LockIcon size={20} />} title="A fixed supply" text={`${fmtM(SUPPLY)} VERDEX, all minted at launch to a bonding curve that graduated into a permanently locked Uniswap v4 pool. No mint function, no team allocation, no unlocks.`} />
          <Step icon={<ShieldIcon size={20} />} title="A public ledger" text="The fees the token earns, the wallet that receives them and what that wallet does with them are all on this page, read live. If a number here ever disagrees with the chain, the chain is right and we want to know." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}>
              <MarkIcon size={22} />
            </Box>
            <Box sx={{ ...Vg, ml: 0 }}>Bug bounty</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Break it, get paid from the fees.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>{BRAND.name} is open source and audited by its own team. The next step is paying anyone who finds what we missed. Rewards are paid in ETH from creator fees, on Robinhood Chain, within a week of the fix. Report privately first; the how is in SECURITY.md in the repository.</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {BOUNTY.map((b) => (
            <Box key={b.tier} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 2, borderRadius: t.radius.panel, background: t.color.tile }}>
              <Box sx={{ minWidth: 92, fontSize: 15, fontWeight: 500, color: b.eth ? t.color.mark : t.color.textMuted }}>{b.eth ? `${b.eth} ETH` : 'Credit'}</Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{b.tier}</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>{b.what}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>

      <Box sx={{ mt: { xs: 8, md: 12 }, maxWidth: 760 }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Questions</Typography>
        {[
          ['Where does this data come from?', `Prices, market cap, liquidity and volume from DexScreener's public API. Fees from the credit events of the launchpad's fee escrow and the pending-fee views of its hook. The dev wallet from the launch record on that hook, and its balance, buys and burns from the token contract. All of it is read by your browser; there is no ${BRAND.name} server in between.`],
          ['What is the fee on a swap?', `${FEE.totalPct}% of the ETH side of every swap, set at launch and locked: a ${FEE.creatorTaxPct}% creator tax plus a ${FEE.hookFeePct}% pool fee. ${FEE.creatorSharePct}% of the total reaches the creator wallet, swept roughly every hour by the launchpad's operator; ${FEE.protocolSharePct}% goes to the launchpad. There is no separate ${BRAND.name} fee on VERDEX trades.`],
          ['What does the dev do with the fees?', 'Build. The site, the films and the agent are paid from them, and part of them has gone back into the token: every VERDEX the dev wallet bought is listed above, and so is every VERDEX it sent to the burn address. The wallet has sold once, 2.5M VERDEX on 30 September 2026, listed above with its transaction; any future sale will appear there the same way.'],
          ['Is there a team allocation or a lock?', 'No. The whole supply was minted to the bonding curve at launch; the creator bought on the curve like everyone else, and the pool that the curve graduated into has its liquidity locked permanently by the launchpad.'],
          ['Why does the Verdex fee disappear for holders?', `Because it is the one perk that needs no contract: the site reads the wallet's VERDEX balance onchain before each quote and drops its ${(VERDEX_FEE * 100).toFixed(2)}% fee when the balance is above zero. The fee is collected by the route on the token you send and appears as its own line in the quote; holders see it struck through.`],
          ['How does early access work?', `Each new feature ships with a public date. Until then its page reads the connected wallet's VERDEX balance and opens for wallets holding at least ${EARLY_ACCESS_BPS / 100}% of the live total supply, ${fmtM(SUPPLY * EARLY_ACCESS_BPS / 10_000)} VERDEX today. Everyone else sees the date and how much would open it now. Nothing is registered anywhere; selling below the line closes it again.`],
          ['Contracts', `Token ${CONTRACTS.token} · Hook ${CONTRACTS.hook} · Fee escrow ${CONTRACTS.escrow} · Pool manager ${CONTRACTS.poolManager} · Pool id ${CONTRACTS.poolId}`],
        ].map(([q, a]) => (
          <Box key={q} sx={{ py: 2.5, borderTop: `1px solid ${t.color.border}` }}>
            <Typography sx={{ ...t.type.body, color: t.color.text }}>{q}</Typography>
            <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 0.75, wordBreak: 'break-word' }}>{a}</Typography>
          </Box>
        ))}
      </Box>
    </Page>
  )
}
