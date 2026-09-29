import { Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { t } from '../theme/tokens'
import { Bt } from '../theme/styles'
import { Page } from './common'
import { Pill } from '../components/ui'

export default function NotFoundPage() {
  return (
    <Page>
      <Box sx={{ mb: 3 }}>
          <Pill>404</Pill>
        </Box>
      <Typography component="h1" sx={{ ...t.type.pageTitle, color: t.color.text }}>
        This page does not exist.
      </Typography>
      <Typography sx={{ ...t.type.lead, color: t.color.textMuted, mt: 2 }}>The address may have changed. Everything tokenized is one click away.</Typography>
      <Button component={Link} to="/" sx={{ ...Bt, mt: 4 }}>
        Back to home
      </Button>
    </Page>
  )
}
