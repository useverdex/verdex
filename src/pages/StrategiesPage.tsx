import { useMemo, useState } from 'react'
import { Avatar, Box, Button, InputBase, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { BRAND, t } from '../theme/tokens'
import { Bt, Lt, Vg } from '../theme/styles'
import { chainLogo, useAssets, useChains, type Asset } from '../lib/api'
import { describeError, type ChainX } from '../lib/lifi'
import { askNotifications } from '../lib/autoInvest'
import { RULES, useVaults, type Vault } from '../lib/vaults'
import { REPO, current, decodeShare, encodeShare, followShare, followStrategy, pendingUpdate, shareUrl, useStrategies, versionOf, weightsToAssets, type Share, type Strategy } from '../lib/strategies'
import { useWallet } from '../components/wallet/WalletProvider'
import { AllocBar, AllocLegend } from '../components/alloc'
import { CheckIcon, CopyIcon, ExternalIcon, LockIcon, RefreshIcon, UsersIcon } from '../components/icons'
import { MarkIcon } from '../components/Logo'
import { Page, PageHero, Panel } from './common'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const ruleLabel = (s: Pick<Strategy, 'rule' | 'threshold'>) => { const r = RULES.find((x) => x.key === s.rule); return s.rule === 'drift' ? `Only when it drifts past ${s.threshold}%` : `${r?.label}, or past ${s.threshold}% drift` }

function Label({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ ...t.type.overline, color: t.color.textLabel, mb: 1.25 }}>{children}</Typography>
}

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

function ManagerRow({ name, handle }: { name: string; handle?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: 28, height: 28, borderRadius: '8px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <MarkIcon size={15} />
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{name}</Typography>
      {handle && <Typography sx={{ fontSize: 12, color: t.color.textLabel }}>@{handle}</Typography>}
    </Box>
  )
}

// One published strategy: who runs it, the current weights, the rule, and its change log.
function StrategyCard({ s, assets, chain, following, onFollow }: { s: Strategy; assets: Asset[]; chain: ChainX | undefined; following: Vault[]; onFollow: (s: Strategy) => void }) {
  const [open, setOpen] = useState(false)
  const now = current(s)
  const weights = useMemo(() => weightsToAssets(now.weights, assets, s.chainId), [now, assets, s.chainId])
  const missing = now.weights.length - weights.length
  const behind = following.filter((v) => (v.follow?.version ?? 0) < versionOf(s)).length
  return (
    <Panel sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <ManagerRow name={s.manager.name} handle={s.manager.handle} />
        <Box sx={{ ...Vg, ml: 0, ...(following.length && { background: 'rgba(194,234,138,.16)', color: t.color.mark }) }}>{following.length ? (behind ? 'Update available' : 'Following') : `v${versionOf(s)}`}</Box>
      </Box>
      <Typography sx={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.03em', mt: 2, lineHeight: 1.2 }}>{s.name}</Typography>
      <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>{s.tagline}</Typography>
      <Box sx={{ mt: 2 }}>
        <AllocBar assets={weights.length ? weights : now.weights.map(([ticker, weight]) => ({ ticker, weight }))} height={10} />
      </Box>
      <Box sx={{ mt: 1.25 }}>
        <AllocLegend assets={weights.length ? weights : now.weights.map(([ticker, weight]) => ({ ticker, weight }))} max={6} />
      </Box>
      <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <Avatar src={chainLogo(chain)} alt="" sx={{ width: 14, height: 14, background: 'transparent' }} /> {chain?.name ?? s.chainId} · {ruleLabel(s)} · updated {fmtDate(now.at)}
      </Typography>
      {missing > 0 && <Typography sx={{ fontSize: 12, color: t.color.textMuted, mt: 1 }}>{missing} of its assets {missing > 1 ? 'are' : 'is'} not issued on this chain yet and would be left out.</Typography>}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
        <Button onClick={() => onFollow(s)} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14, gap: 1 }}>
          <LockIcon size={14} /> Follow
        </Button>
        <Button onClick={() => setOpen((o) => !o)} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none' }}>
          {open ? 'Hide' : 'Change log'} · {s.history.length}
        </Button>
      </Box>
      {open && (
        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${t.color.border}`, display: 'grid', gap: 1.25 }}>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{s.about}</Typography>
          {[...s.history].reverse().map((c, i) => (
            <Box key={c.at + i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ mt: '6px', width: 6, height: 6, borderRadius: '50%', background: i === 0 ? t.color.mark : t.color.borderStrong, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                  v{s.history.length - i} · {fmtDate(c.at)}
                </Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{c.note}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Panel>
  )
}

export default function StrategiesPage() {
  const { data } = useAssets()
  const { data: registry } = useStrategies()
  const { data: chainList } = useChains()
  const chains = chainList as ChainX[] | undefined
  const { account, openWalletMenu } = useWallet()
  const vaults = useVaults()
  const navigate = useNavigate()
  const { search } = useLocation()
  const assets = useMemo(() => data?.assets ?? [], [data])
  const strategies = useMemo(() => registry?.strategies ?? [], [registry])
  const mine = useMemo(() => vaults.filter((v) => account && v.owner.toLowerCase() === account.address.toLowerCase()), [vaults, account])
  const code = new URLSearchParams(search).get('s')
  const shared: Share | null = useMemo(() => (code ? decodeShare(code) : null), [code])
  const sharedAssets = useMemo(() => (shared ? weightsToAssets(shared.w, assets, shared.c) : []), [shared, assets])
  const [error, setError] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const shareVault = mine.find((v) => v.id === shareId) ?? mine[0]
  const link = shareVault ? shareUrl(encodeShare(shareVault)) : ''
  const [copied, setCopied] = useState(false)
  const followed = mine.filter((v) => v.follow)

  const done = () => {
    askNotifications()
    navigate('/vaults#vaults')
  }
  const follow = (s: Strategy) => {
    if (!account) return openWalletMenu()
    try {
      followStrategy(s, assets, account.address)
      done()
    } catch (e) {
      setError(describeError(e))
    }
  }
  const followLink = () => {
    if (!account) return openWalletMenu()
    if (!shared) return
    try {
      followShare(shared, assets, account.address)
      done()
    } catch (e) {
      setError(describeError(e))
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable; the field is selectable */
    }
  }

  return (
    <Page>
      <PageHero
        label="Strategies"
        badges={<Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>New</Box>}
        title={
          <>
            Follow a manager.
            <br />
            Keep your keys.
          </>
        }
        lead="Published allocations with a change log, run by managers you choose. Follow one and it becomes a vault in your own wallet. When the manager changes the weights you get the note, adopt the new version with one tap, and confirm the trades yourself. Nothing ever leaves your wallet."
      />

      {shared && (
        <Panel sx={{ p: { xs: 2.5, md: 3 }, mb: 2.5, borderColor: 'rgba(194,234,138,.35)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ ...Vg, ml: 0, background: 'rgba(194,234,138,.16)', color: t.color.mark }}>Shared strategy</Box>
            {shared.m && <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>by {shared.m}</Typography>}
          </Box>
          <Typography sx={{ ...t.type.h4, color: t.color.text, mt: 1.5 }}>{shared.n}</Typography>
          <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.5 }}>
            {sharedAssets.length} assets on {chains?.find((c) => c.id === shared.c)?.name ?? shared.c} · {ruleLabel({ rule: shared.r, threshold: shared.t })}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <AllocBar assets={sharedAssets} height={12} />
          </Box>
          <Box sx={{ mt: 1.25 }}>
            <AllocLegend assets={sharedAssets} max={12} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
            <Button onClick={followLink} disabled={sharedAssets.length < 2} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14, gap: 1 }}>
              <LockIcon size={14} /> {account ? 'Follow into my wallet' : 'Connect wallet'}
            </Button>
            <Button onClick={() => navigate('/strategies')} sx={{ ...Lt, height: 40, px: '16px', fontSize: 14, backdropFilter: 'none' }}>
              Dismiss
            </Button>
          </Box>
          <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>The weights travel inside the link itself. Nothing about you or the sender is stored anywhere.</Typography>
        </Panel>
      )}

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Label>Published strategies</Label>
        {registry && <Typography sx={{ fontSize: 12, color: t.color.textLabel, mb: 1.25 }}>{strategies.length} strategies · registry updated {fmtDate(registry.updatedAt)}</Typography>}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))' }, gap: 2 }}>
        {strategies.map((s) => (
          <StrategyCard key={s.id} s={s} assets={assets} chain={chains?.find((c) => c.id === s.chainId)} following={mine.filter((v) => v.follow?.id === s.id)} onFollow={follow} />
        ))}
        {!strategies.length && <Panel sx={{ p: 3 }}><Typography sx={{ fontSize: 14, color: t.color.textMuted }}>Loading the registry…</Typography></Panel>}
      </Box>
      {error && <Typography sx={{ fontSize: 13, color: t.color.red, mt: 1.5 }}>{error}</Typography>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mt: 2.5, alignItems: 'start' }}>
        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Label>You follow</Label>
          {!account ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>Connect a wallet to see the strategies it follows.</Typography>
              <Button onClick={openWalletMenu} sx={{ ...Bt, height: 40, px: '16px', fontSize: 14 }}>
                Connect
              </Button>
            </Box>
          ) : followed.length === 0 ? (
            <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>Nothing yet. Press Follow on a strategy and it becomes a vault in this wallet.</Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {followed.map((v) => {
                const s = strategies.find((x) => x.id === v.follow!.id)
                const upd = pendingUpdate(v, strategies)
                return (
                  <Box key={v.id} component="button" type="button" onClick={() => navigate('/vaults#vaults')} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: t.radius.panel, background: t.color.tile, '&:hover': { background: t.color.hover } }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: upd ? t.color.mark : t.color.borderStrong, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.name} <Box component="span" sx={{ color: t.color.textMuted, fontWeight: 400 }}>by {v.follow!.manager}</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: upd ? t.color.mark : t.color.textLabel, whiteSpace: 'nowrap' }}>{upd ? `v${v.follow!.version} → v${versionOf(upd)}` : s ? `v${v.follow!.version}, current` : `v${v.follow!.version}`}</Typography>
                  </Box>
                )
              })}
              <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 0.5 }}>Updates are adopted from the vault card, then rebalanced with your confirmation.</Typography>
            </Box>
          )}
        </Panel>

        <Panel sx={{ p: { xs: 2.5, md: 3 } }}>
          <Label>Share a vault</Label>
          {!account || mine.length === 0 ? (
            <Typography sx={{ fontSize: 14, color: t.color.textMuted }}>{account ? 'Create a vault first; any vault can be shared as a link.' : 'Connect a wallet with a vault to share it as a link.'}</Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {mine.map((v) => (
                  <Box key={v.id} component="button" type="button" onClick={() => setShareId(v.id)} aria-pressed={shareVault?.id === v.id} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', height: 34, px: '12px', borderRadius: t.radius.input, fontSize: 13, fontWeight: 500, letterSpacing: '-0.02em', color: shareVault?.id === v.id ? t.color.onAccent : t.color.textSecondary, background: shareVault?.id === v.id ? t.color.accent : t.color.chip, '&:hover': { background: shareVault?.id === v.id ? t.color.cream : '#2A2A2A' } }}>
                    {v.name}
                  </Box>
                ))}
              </Box>
              {shareVault && (
                <>
                  <Box sx={{ mt: 2 }}>
                    <AllocBar assets={shareVault.assets} height={8} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, px: 1.5, height: 46, borderRadius: t.radius.input, background: t.color.tile }}>
                    <InputBase value={link} readOnly onFocus={(e) => e.target.select()} inputProps={{ 'aria-label': 'Share link' }} sx={{ flex: 1, fontSize: 13, color: t.color.textSoft, fontFamily: 'ui-monospace, Menlo, monospace' }} />
                    <Button onClick={copy} sx={{ ...Lt, height: 32, px: '12px', fontSize: 13, backdropFilter: 'none', gap: 0.75 }}>
                      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />} {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </Box>
                  <Typography sx={{ fontSize: 12, color: t.color.textLabel, mt: 1.5 }}>Anyone who opens it sees the weights and can follow them into their own wallet. The link carries the targets, not your balances or your address.</Typography>
                </>
              )}
            </>
          )}
        </Panel>
      </Box>

      <Panel sx={{ mt: 2.5, p: { xs: 2.5, md: 3 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 3, alignItems: 'center' }}>
        <Box>
          <Label>Publish a strategy</Label>
          <Typography sx={{ ...t.type.h4, color: t.color.text }}>Run money in the open.</Typography>
          <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 1 }}>
            Anyone can publish. Build the allocation in Vaults, share the link, and to appear on this page add it to the registry with a pull request: one entry in <Box component="code" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: t.color.textSoft }}>public/data/strategies.json</Box> with your name, the weights and a note. Every later change is another entry in its history, so followers always see why the weights moved.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Box component="a" href={REPO} target="_blank" rel="noopener noreferrer" sx={{ ...Bt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 1, textDecoration: 'none', height: 44, px: '18px', fontSize: 14 }}>
            Open the repository <ExternalIcon size={13} />
          </Box>
          <Typography sx={{ fontSize: 12, color: t.color.textLabel, textAlign: 'center' }}>Strategies never hold funds. A manager publishes weights; only the follower's wallet moves money.</Typography>
        </Box>
      </Panel>

      <Box sx={{ mt: { xs: 8, md: 12 } }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>How it works</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 2.5, mt: 4 }}>
          <Step n={1} icon={<UsersIcon size={20} />} title="Pick a manager" text="Every strategy shows who runs it, the weights, the rule and the full change log with the reason for every move. Follow it and it becomes a vault in your wallet." />
          <Step n={2} icon={<RefreshIcon size={20} />} title="Get the update, not the trade" text="When the manager changes the weights, your vault shows the new version and the note. Adopt it with one tap; the vault plans the trades back to the new targets." />
          <Step n={3} icon={<LockIcon size={20} />} title="Confirm it yourself" text="Each trade is a normal rebalance through the best route, confirmed in your wallet. The manager never touches your funds and cannot move them." />
        </Box>
      </Box>

      <Panel sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: '#000', border: `1px solid ${t.color.borderStrong}`, display: 'grid', placeItems: 'center' }}>
              <MarkIcon size={22} />
            </Box>
            <Box sx={{ ...Vg, ml: 0 }}>Hold VERDEX</Box>
          </Box>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text, mt: 2.5 }}>Holders pay no {BRAND.name} fee when they follow.</Typography>
          <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 2 }}>A followed strategy is a vault, so every trade it needs runs under the same rule: any amount of VERDEX in the wallet removes the {BRAND.name} fee from every rebalance trade, checked onchain each time.</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {[
            ['No management fee', 'Managers publish weights; there is no cut of your assets and no performance fee. Only the route\'s own gas and DEX fees apply to each trade.'],
            ['Leave any time', 'Stop following and the vault keeps the last weights as your own. Remove it and the tokens stay in your wallet.'],
            ['Open registry', 'The strategies live in the public repository. Anyone can read the history, and anyone can publish with a pull request.'],
          ].map(([k, v]) => (
            <Box key={k} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 2, borderRadius: t.radius.panel, background: t.color.tile }}>
              <Box sx={{ mt: '3px', color: t.color.mark, display: 'flex' }}>
                <CheckIcon size={16} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{k}</Typography>
                <Typography sx={{ fontSize: 13, color: t.color.textMuted, mt: 0.25 }}>{v}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>

      <Box sx={{ mt: { xs: 8, md: 12 }, maxWidth: 760 }}>
        <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>Questions</Typography>
        {[
          ['Can a manager move my money?', 'No. A manager publishes target weights and a note. Your vault reads them and shows the trades it would take to match; nothing happens until you press Adopt and confirm each trade in your wallet. There is no delegation, no allowance and no contract between you.'],
          ['What happens when a strategy changes?', 'Your vault card shows the new version and the manager\'s note, and Verdex reminds you. Adopt it and the vault has new targets; rebalance and the trades are planned like any other. Ignore it and nothing changes.'],
          ['Do I have to follow exactly?', 'No. After following, the weights are yours: edit them, change the rule, or stop following and keep the vault as your own. Strategies are a starting point, not a mandate.'],
          ['Who can publish?', `Anyone. Share a vault as a link and the weights travel inside it. To be listed here, add an entry to the registry in the public repository with a pull request; the history of every change stays in the open.`],
          ['Is anything uploaded?', `No. The registry is a file that ships with ${BRAND.name}; following and adopting happen on this device, and share links carry only the weights. ${BRAND.name} never sees your vaults or your address.`],
        ].map(([qq, a]) => (
          <Box key={qq} sx={{ py: 2.5, borderTop: `1px solid ${t.color.border}` }}>
            <Typography sx={{ ...t.type.body, color: t.color.text }}>{qq}</Typography>
            <Typography sx={{ ...t.type.small, color: t.color.textMuted, mt: 0.75 }}>{a}</Typography>
          </Box>
        ))}
      </Box>
    </Page>
  )
}
