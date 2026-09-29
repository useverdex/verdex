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
  intro: `${N} ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy outlines how we collect, use, and protect your information when you use our website and services.`,
  sections: [
    { h: '1. Information We Collect', items: ['Personal Information: We may collect limited personal information such as your email address when you contact us or subscribe to updates.', 'Usage Data: We collect anonymized data regarding interactions with our platform, including IP addresses, device types, and browsing activity.', 'Blockchain Data: Transactions conducted on blockchain networks are public and immutable; we do not control such data.'] },
    { h: '2. How We Use Your Information', items: ['To provide and improve our services', 'To communicate updates, support, and security alerts', 'To analyze platform performance and enhance user experience', 'To comply with legal obligations'] },
    { h: '3. Information Sharing', items: ['We do not sell or share personal data with third parties, except when required by law or to protect our rights.', 'Third-party service providers may process anonymized data to improve platform functionality.'] },
    { h: '4. Security', p: 'We implement industry-standard security measures to protect user data, but we cannot guarantee absolute security due to the decentralized nature of blockchain technology.' },
    { h: '5. User Rights', items: ['You may request access or deletion of your personal data.', 'You can opt-out of communications at any time.'] },
    { h: '6. Changes to This Policy', p: 'We may update this policy periodically. Continued use of our services constitutes acceptance of the revised policy.' },
  ],
}

export default function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const d = kind === 'terms' ? TERMS : PRIVACY
  return (
    <Page maxWidth={820}>
      <Typography component="h1" sx={{ ...t.type.pageTitle, color: t.color.text }}>
        {d.title}
      </Typography>
      <Typography sx={{ ...t.type.caption, color: t.color.textLabel, mt: 1.5 }}>Last updated: 17 September 2026</Typography>
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
