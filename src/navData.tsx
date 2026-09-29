import type { ComponentType } from 'react'
import { BankIcon, BarsIcon, BoltIcon, BookIcon, BriefcaseIcon, BuildingIcon, CalendarIcon, DocIcon, DropIcon, GemIcon, GridIcon, HandCoinIcon, HelpIcon, LayersIcon, LockIcon, PercentIcon, PieIcon, ReceiptIcon, RefreshIcon, RocketIcon, SearchIcon, ShieldIcon, SwapIcon, TrendIcon, VaultIcon } from './components/icons'

export type NavItem = { label: string; icon: ComponentType<{ size?: number }>; path: string; soon?: boolean; divider?: boolean; action?: 'swap' | 'private' }
export type NavGroup = { label: string; match: string[]; items: NavItem[]; link?: NavItem }

const soon = (label: string, icon: NavItem['icon'], divider = false): NavItem => ({ label, icon, path: '', soon: true, divider })
const doc = (label: string, id: string, icon: NavItem['icon']): NavItem => ({ label, icon, path: `/docs#${id}` })

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Markets',
    match: ['/assets', '/issuers'],
    items: [
      { label: 'All assets', icon: GridIcon, path: '/assets' },
      ...([
        ['Stocks', BarsIcon],
        ['ETFs and Index Funds', PieIcon],
        ['Commodities', GemIcon],
        ['Private Credit', DocIcon],
        ['Treasuries', BankIcon],
      ] as const).map(([label, icon]) => ({ label, icon, path: `/assets?category=${encodeURIComponent(label)}` })),
      { label: 'Issuers', icon: BuildingIcon, path: '/issuers', divider: true },
    ],
  },
  {
    label: 'Baskets',
    match: ['/rwa-baskets'],
    items: [
      { label: 'Automated Baskets', icon: RefreshIcon, path: '/rwa-baskets#automated' },
      { label: 'Index Baskets', icon: LayersIcon, path: '/rwa-baskets#baskets' },
      { label: 'Discover all Baskets', icon: SearchIcon, path: '/rwa-baskets/discover' },
      { label: 'Vaults', icon: VaultIcon, path: '/vaults', divider: true },
      soon('Asset Management', BriefcaseIcon),
      soon('Basket-Backed Token Launch', RocketIcon),
    ],
  },
  {
    label: 'Earn',
    match: ['/rwa-pools'],
    items: [{ label: 'Tokenized Pools', icon: DropIcon, path: '/rwa-pools' }, soon('Verdex Pools', BoltIcon, true), soon('Asset Yield', PercentIcon)],
  },
  {
    label: 'Lend and Borrow',
    match: ['/lend'],
    items: [
      { label: 'Lend and Borrow', icon: HandCoinIcon, path: '/lend' },
      { label: 'Multiply', icon: TrendIcon, path: '/lend?tab=multiply' },
    ],
  },
  {
    label: 'Trade',
    match: ['/'],
    items: [
      { label: 'Swap and Bridge', icon: SwapIcon, path: '/', action: 'swap' },
      { label: 'Private Swap', icon: LockIcon, path: '/', action: 'private' },
      { label: 'Auto-Invest', icon: CalendarIcon, path: '/auto-invest', divider: true },
    ],
  },
  { label: 'Portfolio', match: ['/portfolio', '/profile'], items: [], link: { label: 'Portfolio', icon: BriefcaseIcon, path: '/portfolio' } },
  {
    label: 'Docs',
    match: ['/docs'],
    items: [
      doc('Overview', 'overview', BookIcon),
      doc('Tokenized Baskets', 'tokenized-baskets', LayersIcon),
      doc('Tokenized Pools', 'tokenized-pools', DropIcon),
      doc('Lend and Borrow', 'lend-and-borrow', HandCoinIcon),
      doc('Fees', 'fees', ReceiptIcon),
      doc('Safety', 'safety', ShieldIcon),
      doc('FAQ', 'faq', HelpIcon),
    ],
  },
]


export function groupMatches(group: NavGroup, pathname: string) {
  return group.match.some((m) => (m === '/' ? pathname === '/' : pathname.startsWith(m)))
}

export function itemActive(item: NavItem, pathname: string, search: string, hash: string) {
  if (item.action || item.soon) return false
  const [beforeHash, h] = item.path.split('#')
  const [p, q = ''] = beforeHash.split('?')
  return pathname === p && search.replace(/^\?/, '') === q && (!h || hash === `#${h}`)
}

export function scrollToId(id: string, tries = 30) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  else if (tries > 0) setTimeout(() => scrollToId(id, tries - 1), 100)
}
