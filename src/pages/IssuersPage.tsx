import { Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { t } from '../theme/tokens'
import { Bt, Lt } from '../theme/styles'
import { CHAIN_NAME_LOGOS, ISSUER_INFO, ISSUER_LOGOS, fmtCompact, useAssets } from '../lib/api'
import { ExternalIcon } from '../components/icons'
import { Page, PageHero, Panel } from './common'

export default function IssuersPage() {
  const { data } = useAssets()
  const issuers = data?.issuers ?? []
  const assets = data?.assets ?? []
  return (
    <Page>
      <PageHero
        label="Issuers"
        center
        title="Every Issuer. One Aggregator."
        lead={
          <>
            The names bringing Wall Street onchain. <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>{issuers.length} issuers</Box>, <Box component="span" sx={{ color: t.color.text, fontWeight: 500 }}>{assets.length} assets</Box>, one order.
          </>
        }
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' }, gap: 2.5 }}>
        {issuers.map((i) => {
          const info = ISSUER_INFO[i.name]
          return (
            <Panel key={i.name} sx={{ p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box component="img" src={ISSUER_LOGOS[i.name]} alt="" sx={{ width: 40, height: 40, borderRadius: '10px', background: t.color.chip, objectFit: 'cover' }} />
                <Box>
                  <Typography sx={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em' }}>{i.name}</Typography>
                  <Typography sx={{ fontSize: 13, color: t.color.textMuted }}>{info?.by ?? i.name}</Typography>
                </Box>
              </Box>
              <Typography sx={{ ...t.type.small, color: t.color.textMuted }}>{info?.about}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 2, borderTop: `1px solid ${t.color.border}`, pt: 2.5 }}>
                {[
                  ['Stocks', i.assets.toLocaleString('en-US')],
                  ['Tokens', i.tokens.toLocaleString('en-US')],
                  ['Onchain market cap', fmtCompact(i.marketCap)],
                  ['24h volume', fmtCompact(i.volume24h)],
                ].map(([k, v]) => (
                  <Box key={k}>
                    <Typography sx={{ ...t.type.caption, color: t.color.textLabel }}>{k}</Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 500, mt: 0.5 }}>{v}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: t.color.textMuted }}>
                {i.chains.length === 1 ? (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                    <Box component="img" src={CHAIN_NAME_LOGOS[i.chains[0]]} sx={{ width: 16, height: 16, borderRadius: '50%' }} />
                    {i.chains[0]}
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: 'inline-flex' }}>
                      {i.chains.map((c, k) => (
                        <Box key={c} component="img" src={CHAIN_NAME_LOGOS[c]} title={c} sx={{ width: 18, height: 18, borderRadius: '50%', ml: k ? '-6px' : 0, border: `1.5px solid ${t.color.page}`, background: t.color.menu }} />
                      ))}
                    </Box>
                    {i.chains.length} chains
                  </>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 'auto' }}>
                <Button component={Link} to={`/assets?issuer=${encodeURIComponent(i.name)}`} sx={Bt}>
                  View Assets
                </Button>
                {info?.url && (
                  <Button component="a" href={info.url} target="_blank" rel="noopener noreferrer" sx={{ ...Lt, height: 38 }}>
                    Website <ExternalIcon size={13} className="btn-arrow" />
                  </Button>
                )}
              </Box>
            </Panel>
          )
        })}
      </Box>
      <Typography sx={{ ...t.type.caption, color: t.color.textLabel, mt: 3, maxWidth: 820 }}>Issuers decide who may hold their tokens; tokenized stocks are generally not available to residents of the United States.</Typography>
    </Page>
  )
}
