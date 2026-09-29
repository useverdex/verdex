import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }

function Base({ size = 20, strokeWidth = 2, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  )
}

export const CloseIcon = (p: IconProps) => <Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>
export const MenuIcon = (p: IconProps) => <Base {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Base>
export const DotsIcon = (p: IconProps) => <Base {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Base>
export const ChevronDownIcon = (p: IconProps) => <Base {...p}><path d="M6 9l6 6 6-6" /></Base>
export const ArrowsUpDownIcon = (p: IconProps) => <Base {...p}><path d="M8 4v16M8 4L4 8M8 4l4 4M16 20V4M16 20l-4-4M16 20l4-4" /></Base>
export const SwapIcon = (p: IconProps) => <Base {...p}><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></Base>
export const SearchIcon = (p: IconProps) => <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Base>
export const BookIcon = (p: IconProps) => <Base {...p}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></Base>
export const CoinIcon = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v8" /></Base>
export const XLogoIcon = ({ size = 20, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...rest}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)
export const ExternalIcon = (p: IconProps) => <Base {...p}><path d="M7 17 17 7M9 7h8v8" /></Base>
export const CheckIcon = (p: IconProps) => <Base {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Base>
export const InfoIcon = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></Base>
export const PauseIcon = (p: IconProps) => <Base {...p}><path d="M9 5v14M15 5v14" /></Base>
export const ArrowRightIcon = (p: IconProps) => <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>
export const CopyIcon = (p: IconProps) => <Base {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></Base>
export const LockIcon = (p: IconProps) => <Base {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Base>
export const CalendarIcon = (p: IconProps) => <Base {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1" fill="currentColor" /></Base>
export const RefreshIcon = (p: IconProps) => <Base {...p}><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></Base>
export const LayersIcon = (p: IconProps) => <Base {...p}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" /></Base>
export const BriefcaseIcon = (p: IconProps) => <Base {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></Base>
export const VaultIcon = (p: IconProps) => <Base {...p}><rect x="3" y="4" width="18" height="15" rx="2" /><circle cx="12" cy="11.5" r="3" /><path d="M12 8.5V7M12 16v-1.5M7 19v2M17 19v2" /></Base>
export const RocketIcon = (p: IconProps) => <Base {...p}><path d="M9 15l-3-3c1-4 4.5-8 11-9 .8 0 1.2.4 1.2 1.2-1 6.5-5 10-9.2 10.8z" /><path d="M6 12l-3 .5 2.5-4H9M12 18l-.5 3 4-2.5V15M6.5 17.5c-1.2 1.2-1.5 3.5-1.5 3.5s2.3-.3 3.5-1.5" /></Base>
export const DropIcon = (p: IconProps) => <Base {...p}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></Base>
export const BoltIcon = (p: IconProps) => <Base {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></Base>
export const PercentIcon = (p: IconProps) => <Base {...p}><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></Base>
export const TrendIcon = (p: IconProps) => <Base {...p}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></Base>
export const HandCoinIcon = (p: IconProps) => <Base {...p}><circle cx="15" cy="7" r="3.5" /><path d="M3 14h3l3.5 1.5H13a1.5 1.5 0 0 1 0 3H9M6 21H3M13 18.5l5.5-2.5a1.6 1.6 0 0 1 1.8 2.6L15 22H6" /></Base>
export const GridIcon = (p: IconProps) => <Base {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Base>
export const BarsIcon = (p: IconProps) => <Base {...p}><path d="M3 20h18M7 16V9M12 16V4M17 16v-5" /></Base>
export const PieIcon = (p: IconProps) => <Base {...p}><path d="M12 3a9 9 0 1 0 9 9h-9V3z" /><path d="M15.5 2.8a9 9 0 0 1 5.7 5.7h-5.7V2.8z" /></Base>
export const GemIcon = (p: IconProps) => <Base {...p}><path d="M6 3h12l4 6-10 12L2 9l4-6zM2 9h20M9.5 3L8 9l4 12 4-12-1.5-6" /></Base>
export const DocIcon = (p: IconProps) => <Base {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></Base>
export const BankIcon = (p: IconProps) => <Base {...p}><path d="M3 21h18M4 10h16M12 3l8 4H4l8-4zM6 10v8M10 10v8M14 10v8M18 10v8" /></Base>
export const BuildingIcon = (p: IconProps) => <Base {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3" /></Base>
export const ReceiptIcon = (p: IconProps) => <Base {...p}><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3z" /><path d="M9 8h6M9 12h6" /></Base>
export const ShieldIcon = (p: IconProps) => <Base {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></Base>
export const HelpIcon = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01" /></Base>
export const WalletIcon = (p: IconProps) => <Base {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h.01M3 10h18" /></Base>
export const SettingsIcon = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Base>
export const PlusIcon = (p: IconProps) => <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
export const MinusIcon = (p: IconProps) => <Base {...p}><path d="M5 12h14" /></Base>
export const StarIcon = (p: IconProps) => <Base {...p}><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" /></Base>
export const UsersIcon = (p: IconProps) => <Base {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" /></Base>
export const RouteIcon = (p: IconProps) => <Base {...p}><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5" /></Base>
export const ArrowUpRightIcon = (p: IconProps) => <Base {...p}><path d="M7 17 17 7M8 7h9v9" /></Base>
export const ChevronLeftIcon = (p: IconProps) => <Base {...p}><path d="m15 6-6 6 6 6" /></Base>
export const ChevronRightIcon = (p: IconProps) => <Base {...p}><path d="m9 6 6 6-6 6" /></Base>
export const GlobeIcon = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Base>
export const QuoteIcon = ({ size = 20, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...rest}>
    <path d="M6.5 5A4.5 4.5 0 0 0 2 9.5C2 12 4 14 6.5 14c0 0 0 1.7-1.4 4.1-.2.5.1 1 .6 1.2.4.1.8 0 1-.3C9.8 15.5 11 11.5 11 9.5A4.5 4.5 0 0 0 6.5 5m11 0A4.5 4.5 0 0 0 13 9.5c0 2.5 2 4.5 4.5 4.5 0 0 0 1.7-1.4 4.1-.2.5.1 1 .6 1.2.4.1.8 0 1-.3C20.8 15.5 22 11.5 22 9.5A4.5 4.5 0 0 0 17.5 5" />
  </svg>
)
