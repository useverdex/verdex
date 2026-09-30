import { Box, Typography } from '@mui/material'
import { BRAND, t } from '../theme/tokens'
import { Page } from './common'

const N = BRAND.name
const TERMS = {
  title: 'Terms of Service',
  intro: `Welcome to ${N}. By accessing our website and services, you agree to these Terms of Service. If you do not agree, please do not use our platform.`,
  sections: [
    { h: '1. Use of Services', items: [`You must be at least 18 years old to use ${N}.`, 'Our platform facilitates token swaps across blockchains but does not custody user funds.', 'You acknowledge that all blockchain transactions are irreversible.'] },
    { h: '2. No Financial Advice', p: `${N} provides information and technology for token swaps but does not offer financial, investment, or legal advice. Users are responsible for their own decisions.` },
    { h: '3. Risk Acknowledgment', items: ['Cryptocurrency markets are highly volatile. You assume all risks associated with using our platform.', 'Smart contract vulnerabilities, liquidity risks, and network failures may impact transactions.'] },
    { h: '4. Limitation of Liability', p: `${N} is not responsible for losses due to system downtime, transaction failures, third-party integrations, or user errors.` },
    { h: '5. Prohibited Activities', p: 'You agree not to use our services for illegal activities, including money laundering, fraud, or sanction violations.' },
    { h: '6. Modifications to the Terms', p: 'We may update these Terms at any time. Continued use of our services indicates acceptance of the new Terms.' },
  ],
}
const PRIVACY = {
  title: 'Privacy Policy',
  intro: `${N} is a website that runs in your browser and talks to public blockchains and a few named services from there. It has no user accounts, no server that stores your data, and no analytics. This policy says exactly what leaves your browser, and to whom.`,
  sections: [
    { h: '1. What we collect', items: [`Nothing on our side. ${N} has no backend: the site is static files, and there is no database of users, wallets or activity.`, 'We do not run analytics, tracking pixels or advertising scripts, and we set no cookies.', 'If you write to us by email, we keep that email to answer it.'] },
    { h: '2. What stays on your device', items: ['Your Auto-Invest plans, orders, vaults and drafts are stored in your browser (localStorage) for the wallet that made them. They never leave the device unless you export or share them yourself.', 'If you use the Agent with your own model key, the key is stored in localStorage on that device and can be removed at any time with Forget key.', 'The installable app caches the site shell and artwork on your device so it opens offline. It never caches prices, quotes or wallet traffic.'] },
    { h: '3. What leaves your browser, and to whom', items: ['Quotes and routing: to price a swap, bridge, buy, fill or rebalance, the site sends the token pair, the amount, your wallet address and, for private swaps, the receiving address to the LI.FI aggregator API (li.quest). LI.FI\'s own privacy policy applies to that request.', 'Blockchain reads: balances, allowances, holder checks and transaction receipts are read from public RPC endpoints of the chain in question, which see your IP address and the addresses queried.', 'Transactions: every swap, approval and fill is signed in your own wallet and broadcast by it. Onchain data is public by nature.', `Agent: only if you add a key, your messages, the tool results (prices, the balances you asked about, your plans, orders and vaults) and the key itself go from your browser to the provider you chose, Anthropic or OpenAI, over HTTPS. ${N} is not in that path and never sees the conversation. Without a key, nothing is sent anywhere.`, 'Notifications: reminders for due buys, triggered orders and rebalances are shown by your browser or the installed app on the device. No push server is involved.'] },
    { h: '4. Security', p: `${N} never holds funds, keys or allowances. Every transfer is a transaction you sign in your own wallet. The code is open source at github.com/useverdex/verdex, so anything described here can be checked against what the site actually does.` },
    { h: '5. Your rights', items: ['Everything the site stores is on your device: clear the site data in your browser and it is gone.', 'You may ask us to delete any email correspondence at the address below.'] },
    { h: '6. Changes to this policy', p: 'When this policy changes, the date below is updated and the change is visible in the public repository.' },
  ],
}

export default function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const d = kind === 'terms' ? TERMS : PRIVACY
  return (
    <Page maxWidth={820}>
      <Typography component="h1" sx={{ ...t.type.pageTitle, color: t.color.text }}>
        {d.title}
      </Typography>
      <Typography sx={{ ...t.type.caption, color: t.color.textLabel, mt: 1.5 }}>Last updated: 30 September 2026</Typography>
      <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 3 }}>{d.intro}</Typography>
      {d.sections.map((s) => (
        <Box key={s.h} sx={{ mt: 4 }}>
          <Typography component="h2" sx={{ ...t.type.h3, color: t.color.text }}>
            {s.h}
          </Typography>
          {'p' in s && s.p && <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 1 }}>{s.p}</Typography>}
          {'items' in s && s.items && (
            <Box component="ul" sx={{ ...t.type.body, color: t.color.textMuted, mt: 1, pl: 2.5 }}>
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </Box>
          )}
        </Box>
      ))}
      <Typography sx={{ ...t.type.body, color: t.color.textMuted, mt: 4 }}>
        For questions, write to feedback@{BRAND.domain}.
      </Typography>
    </Page>
  )
}
