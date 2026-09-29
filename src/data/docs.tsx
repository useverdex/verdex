import type { ReactNode } from 'react'
import { BRAND } from '../theme/tokens'

const N = BRAND.name
export type DocBlock =
  | { kind: 'p'; text: ReactNode }
  | { kind: 'defs'; items: { term: string; text: ReactNode }[] }
  | { kind: 'steps'; items: { title: string; text: string }[] }
  | { kind: 'fees'; items: { term: string; text: string }[] }
  | { kind: 'issuers' }
  | { kind: 'chains' }
  | { kind: 'faq'; items: { q: string; a: string }[] }
export type DocSection = { id: string; title: string; blocks: DocBlock[]; sub?: boolean }

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    blocks: [
      { kind: 'p', text: `${N} is the unified marketplace for real-world assets. Stock tokens from Ondo, xStocks, Robinhood, Coinbase and bStocks trade in one place, alone or as whole baskets. Every swap and bridge is priced across bridges, exchanges and intent solvers, and you sign from your own address.` },
      { kind: 'p', text: `${N} never holds your funds. Transfers go from your own address through audited routing contracts to the destination address you choose.` },
      { kind: 'p', text: 'Tokenized Baskets are live: index baskets you hold as one token, and strategy baskets you hold stock by stock. Tokenized Pools lists the liquidity pools of tokenized stocks across chains, and you can add liquidity to any of them. Lend and Borrow lets you earn on tokenized stocks, borrow against them, or hold more of one with Multiply.' },
    ],
  },
  {
    id: 'swap-and-bridge',
    title: 'Swap and Bridge',
    blocks: [
      { kind: 'defs', items: [{ term: 'Swap', text: 'Same chain. Trade one token for another on a single chain, e.g. USDC → EURC on Arc.' }, { term: 'Bridge', text: 'Across chains. Move an asset from one chain to another, swapping on the way if needed, e.g. ETH on Base → USDC on Arc.' }] },
      { kind: 'p', text: 'The Swap tab keeps both sides on the same chain. The Bridge tab lets you pick any source and any destination chain.' },
    ],
  },
  {
    id: 'how-a-transfer-works',
    title: 'How a transfer works',
    sub: true,
    blocks: [
      { kind: 'steps', items: [
        { title: 'Choose what to send and receive', text: 'Pick the token and chain on each side and enter an amount.' },
        { title: 'Compare routes', text: `${N} lists every available route, labelled Best Return and Fastest. Tap any route to select it. Quotes refresh about every minute.` },
        { title: 'Review and sign', text: 'Review shows the minimum you will receive, fees and estimated time. Some tokens need a one-time approval before the transfer.' },
        { title: 'Watch it settle', text: 'The route overlay shows each step as it happens: approval, send, bridge and receive, with explorer links for each transaction.' },
      ] },
    ],
  },
  {
    id: 'tokenized-baskets',
    title: 'Tokenized Baskets',
    blocks: [
      { kind: 'p', text: `A basket is a set of tokenized stocks (or other assets) at stated weights. ${N} aggregates baskets from different sources and shows them in one place, with one way to buy and sell each kind. There are three kinds.` },
      { kind: 'defs', items: [
        { term: 'Index baskets', text: 'One token per basket. The token is backed by the assets inside and can be redeemed for them. You buy one token and hold one token.' },
        { term: 'Automated baskets', text: 'A portfolio in your own account, bought for you and rebalanced to its target weights on a schedule. You add or withdraw at any time.' },
        { term: 'Strategy baskets', text: 'A list of stocks and weights. There is no basket token: you buy each stock token yourself in one order, and you hold each of them.' },
      ] },
      { kind: 'p', text: `${N} never holds your funds in any of them. Every purchase is signed by you and the tokens arrive at your own address.` },
    ],
  },
  {
    id: 'index-baskets',
    title: 'Index baskets',
    sub: true,
    blocks: [
      { kind: 'p', text: 'Index baskets are issued through Reserve. Each basket is a single ERC-20 token, backed one to one by the tokens inside it at published weights. Minting and redeeming are open onchain calls, so the token can always be exchanged for the assets inside. The Tokenized Baskets page shows the baskets that hold tokenized stocks; Discover lists every active index basket with search and a chain filter.' },
      { kind: 'steps', items: [
        { title: 'Open a basket', text: 'The basket page shows price, the year-to-date change, a chart, the holdings with their weights, fees, holders, recent mints and redeems, and the disclosures.' },
        { title: 'Choose what to pay with', text: 'Ethereum: USDC, ETH or WETH. BNB Chain: USDT or USDC. Base: USDC, ETH or WETH.' },
        { title: 'Enter an amount', text: `${N} asks every source the basket trades through and uses the one that gives you the most. The card shows the basket tokens you will receive; Details shows the price, the projected slippage, the minimum you will receive at your slippage setting (0.1%, 0.5% or 1%) and every source’s quote, and you can pick a different one.` },
        { title: 'Approve and buy', text: 'A token needs a one-time approval. Then either one transaction mints or buys the basket token to your address, or, when the best quote is CoW Swap or PancakeSwap X, you sign an order and a market maker fills it within a few minutes. An order that is not filled expires and nothing is spent.' },
        { title: 'Sell', text: 'The arrows on the card switch to selling. The basket token goes back into the token you choose, through the source with the best quote.' },
      ] },
      { kind: 'defs', items: [
        { term: 'Exposure and Collateral', text: 'The holdings table has two views. Exposure shows the company or asset you are exposed to. Collateral shows the token actually held, its issuer and that token’s own market cap.' },
        { term: 'Backing', text: 'Stock baskets show “100% backed by real stocks” with the issuer of the stock tokens named. How each stock token is backed is described by its issuer on the basket page.' },
        { term: 'Chart before launch', text: 'Before a basket’s launch date the line is an estimate: the launch-day basket priced with the stocks’ history, without fees or rebalances.' },
        { term: 'Market hours', text: 'Baskets that hold Ondo stock tokens show the US market session. Outside market hours prices can move less and cost more to trade.' },
        { term: 'Where quotes come from', text: 'Reserve’s own minting, two aggregators, and two order venues, CoW Swap and PancakeSwap X. The basket’s mint fee applies when Reserve mints the basket; the other sources trade existing basket tokens.' },
        { term: 'Quotes and VPNs', text: 'Quotes come straight from each source to your browser. Some refuse VPN and proxy connections; if you see that message, turn the VPN off and try again.' },
      ] },
    ],
  },
  {
    id: 'automated-baskets',
    title: 'Automated baskets',
    sub: true,
    blocks: [
      { kind: 'p', text: 'Automated baskets are ready-made portfolios that keep themselves on target: stocks by theme, the trades of well-known investors, crypto, gold and yield. Each one is held in your own account and rebalanced to its target weights on a schedule, so you never have to trade the holdings yourself. Baskets trade on BNB Chain, Base, Ethereum, Arbitrum and Robinhood Chain.' },
      { kind: 'steps', items: [
        { title: 'Pick a basket', text: 'Filter by group and open a basket to see its holdings, weights, performance, total invested and how often it rebalances.' },
        { title: 'Open your account', text: 'One signature opens your own account for that basket. It costs no gas, and only you can withdraw from it.' },
        { title: 'Invest', text: 'Send USDT on BNB Chain, USDC on Base, Ethereum or Arbitrum, or USDG on Robinhood Chain. The holdings are bought as soon as the funds arrive.' },
        { title: 'Let it rebalance', text: 'The basket returns to its target weights on its schedule, daily for most baskets. You can pause and resume rebalancing at any time.' },
        { title: 'Withdraw', text: 'One signature sells every holding and sends the proceeds to your own address in the same stablecoin.' },
      ] },
      { kind: 'defs', items: [
        { term: 'What you hold', text: 'The basket’s holdings, in an account that belongs to your address. Your Profile shows each basket you hold and its value.' },
        { term: 'Rebalancing', text: 'Automatic, to the target weights. When a basket’s weights are updated, your account follows them at its next rebalance.' },
        { term: 'Fee', text: '0.50% per swap, taken on every swap made for your account, rebalances included.' },
        { term: 'Tokenized stocks', text: 'Sold during US market hours (Mon to Fri, 9:30 to 16:00 New York). A withdrawal sent outside those hours may need to be sent again.' },
        { term: 'Returns shown', text: 'The basket’s own history at its target weights, before fees. It is not a forecast.' },
      ] },
    ],
  },
  {
    id: 'strategy-baskets',
    title: 'Strategy baskets',
    sub: true,
    blocks: [
      { kind: 'p', text: 'Strategy baskets are themed stock portfolios: investor trackers, AI and chips, energy and resources, and sectors. Each one is a list of stocks with target weights and a one-year return. Most are bought on BNB Chain with stock tokens from Ondo; one is on Robinhood Chain with stock tokens from Robinhood.' },
      { kind: 'steps', items: [
        { title: 'Pick a basket', text: 'Filter by category and open a basket to see what it holds, the weights, and the buy and sell card.' },
        { title: 'Set the weights', text: 'Target weights uses the basket’s own weights. Equal weight gives every stock the same share. Or move the slider of any stock; a stock at 0% is left out. If the weights do not add to 100%, the order is split in proportion.' },
        { title: 'Enter an amount', text: 'You pay with USDT on BNB Chain or USDG on Robinhood Chain. The order is split by the weights and every stock gets its own live quote. A stock with no route at that moment is marked and left out.' },
        { title: 'Buy', text: 'One approval for the pay token, then one swap per stock, each confirmed by you. The card shows every stock as it goes through, with a link to the transaction. If one swap fails, the others still continue.' },
        { title: 'Sell', text: 'Choose 25%, 50% or 100%. That share of each stock you hold from the basket is swapped back to the pay token, one swap per stock.' },
      ] },
      { kind: 'defs', items: [
        { term: 'What you hold', text: 'The stock tokens themselves, each one separately. You can sell any of them on its own at any time, here or on Swap and Bridge.' },
        { term: 'Rebalancing', text: 'None. The weights are the basket’s target weights on the day you buy; your holdings then move with the stocks.' },
        { term: 'Slippage', text: '0.5%, 1% or 2% per swap. A swap whose price moves past it reverts and that stock is marked as failed.' },
        { term: 'Returns shown', text: 'The one-year return is the basket’s own history at its target weights. It is not a forecast.' },
      ] },
    ],
  },
  {
    id: 'issuers-and-chains',
    title: 'Issuers and chains',
    sub: true,
    blocks: [
      { kind: 'p', text: `Every asset on ${N} is a token from a third-party issuer: stocks and ETFs, gold, private credit and treasuries. How each token is backed is set out by its issuer.` },
      { kind: 'issuers' },
      { kind: 'p', text: 'Issuers decide who may hold their tokens. Tokenized stocks are generally not available to residents of the United States and of sanctioned countries. Each basket page carries the issuer’s own description and risk list.' },
    ],
  },
  {
    id: 'tokenized-pools',
    title: 'Tokenized Pools',
    blocks: [
      { kind: 'p', text: 'Tokenized Pools lists the liquidity pools where tokenized stocks trade: 199 Uniswap v4 pools on Robinhood Chain and Base. Every one of them can be deposited into from here.' },
      { kind: 'defs', items: [
        { term: 'Liquidity', text: 'The dollar value of both tokens in the pool.' },
        { term: '24h volume', text: 'The dollar value traded in the pool over the last 24 hours.' },
        { term: 'Fee', text: 'The pool’s own fee tier, paid by traders to liquidity providers.' },
        { term: 'Fee APR', text: 'One day of fees at the current volume, times 365, divided by liquidity. Shown only where the pool states a fee tier. It changes with volume and is not a promise.' },
        { term: 'Adding liquidity', text: 'Open a pool and choose Add Liquidity. Set a price range and the amounts, approve each token once, and one transaction adds the position to your address. It earns the pool’s fee while the price is inside your range.' },
      ] },
    ],
  },
  {
    id: 'lend-and-borrow',
    title: 'Lend and Borrow',
    blocks: [
      { kind: 'p', text: 'Lend and Borrow (Beta) runs on Kamino, a lending protocol on Solana, in the markets that hold tokenized stocks: xStocks Market, STRCx Market and Sentora xStocks Market. Earn on a stock token, borrow against it, or hold more of it with Multiply. You need a Solana address; the first supply opens your position on Kamino.' },
      { kind: 'defs', items: [
        { term: 'Supply', text: 'Lend a token to a market and earn its supply rate. It stays yours, and everything you supply in one market counts together as collateral there.' },
        { term: 'Borrow', text: 'Borrow against what you supplied in the same market, at that token’s borrow rate. The card shows your loan to value before and after.' },
        { term: 'Withdraw and Repay', text: 'At any time, one transaction each. A withdrawal comes from what is not lent out, so when nearly all of a token is borrowed it waits for repayments or new supply.' },
        { term: 'Multiply', text: 'Hold more of a stock token than you deposit, up to the pair’s maximum leverage. One transaction borrows, swaps and deposits; if any step fails, none of it happens. Closing reverses it and returns the rest to you.' },
        { term: 'Rates', text: 'Supply and borrow rates move with how much of each token is borrowed. Kamino stops new borrowing from a token when it is heavily borrowed; positions can still be repaid and closed.' },
        { term: 'Liquidation', text: 'If what you owe reaches the liquidation loan to value of your collateral, Kamino sells part of the collateral to repay it, at a penalty.' },
        { term: 'Multiply gains and losses', text: 'Both are larger by the leverage you choose. When the borrow rate is above what the stock token earns, holding the position costs money.' },
        { term: 'Fees', text: `No ${N} fee. You pay Kamino’s borrow rate on what you borrow.` },
      ] },
    ],
  },
  {
    id: 'fees',
    title: 'Fees',
    blocks: [
      { kind: 'p', text: 'Every quote shows the full cost before you sign. A transfer can include:' },
      { kind: 'fees', items: [
        { term: `${N} fee`, text: '0.50%' },
        { term: `${N} fee (private swaps)`, text: '0.75%' },
        { term: 'Index baskets', text: `No ${N} fee. The basket charges its own mint fee and yearly fee, shown on each basket page.` },
        { term: 'Automated baskets', text: '0.50% per swap, rebalances included.' },
        { term: 'Strategy baskets', text: '0.50% per swap, the same as Swap and Bridge.' },
        { term: 'Lend and Borrow', text: `No ${N} fee. You pay Kamino’s borrow rate on what you borrow.` },
        { term: 'Bridge or exchange fees', text: 'set by the route, shown in the quote' },
        { term: 'Network gas', text: 'paid in the source chain’s gas token' },
      ] },
      { kind: 'p', text: `The ${N} fee is taken from the token you send. Gas on Arc is paid in USDC.` },
    ],
  },
  {
    id: 'private-swaps',
    title: 'Private swaps',
    blocks: [
      { kind: 'p', text: 'Private swaps move assets across chains with no onchain link between the address that sends and the address that receives.' },
      { kind: 'steps', items: [
        { title: 'Choose tokens and a destination', text: 'Pick tokens, amount and a destination address.' },
        { title: 'Send the deposit', text: 'Send the exact amount to the one-time deposit address.' },
        { title: 'Routing', text: 'Funds route through two partner exchanges.' },
        { title: 'Delivery', text: 'The output arrives at the destination address.' },
      ] },
      { kind: 'fees', items: [{ term: `${N} fee`, text: '0.75%' }, { term: 'Time', text: '15–45 minutes' }, { term: 'Deposit window', text: 'about 30 minutes' }, { term: 'Minimum and maximum', text: 'set per token pair, shown in the quote' }] },
      { kind: 'p', text: 'Partner exchanges screen every swap and may hold, review or refund it.' },
      { kind: 'p', text: 'Private swaps are not available to US residents or in countries under US or EU sanctions.' },
      { kind: 'p', text: 'Routing through Monero: coming soon.' },
    ],
  },
  {
    id: 'tracking-a-transfer',
    title: 'Tracking a transfer',
    blocks: [
      { kind: 'p', text: `Every ${N} transfer appears on the Explorer with the source and destination asset, amounts, route, status, and a link to each chain’s block explorer.` },
      { kind: 'defs', items: [
        { term: 'Pending', text: 'Sent on the source chain, waiting for the bridge or destination transaction' },
        { term: 'Done', text: 'Received on the destination chain' },
        { term: 'Partial', text: 'Bridge completed but the destination swap did not; you received the bridged token' },
        { term: 'Refunded', text: 'The route could not complete and tokens were returned' },
        { term: 'Failed', text: 'The transfer did not go through, e.g. slippage exceeded or not enough balance' },
      ] },
    ],
  },
  {
    id: 'safety',
    title: 'Safety',
    blocks: [
      { kind: 'defs', items: [
        { term: 'Custody', text: 'Non-custodial. You sign every transaction from your own address.' },
        { term: 'Minimum received', text: 'Enforced onchain. If the price moves past your slippage setting, the transaction reverts.' },
        { term: 'Same-chain swaps', text: 'Atomic. A failed swap reverts completely.' },
        { term: 'Cross-chain transfers', text: 'If the bridge succeeds but the destination swap fails, you receive the bridged asset on the destination chain.' },
        { term: 'Contracts', text: 'Routing contracts are audited, open source and covered by a bug bounty.' },
      ] },
    ],
  },
  {
    id: 'supported-chains',
    title: 'Supported chains',
    blocks: [{ kind: 'chains' }],
  },
  {
    id: 'faq',
    title: 'FAQ',
    blocks: [
      { kind: 'faq', items: [
        { q: 'Why is Robinhood Chain the default?', a: `Robinhood Chain hosts the deepest pools of tokenized stocks today, and ${N} is native there. Any other supported chain is one tap away in the token picker.` },
        { q: 'Why does the fastest route pay a little less?', a: 'Faster routes use solvers and bridges that settle in seconds and charge a small premium for it. Best Return waits a little longer for the route that gives you the most.' },
        { q: 'How long does a bridge take?', a: 'Most bridges settle in under two minutes. Routes through canonical bridges can take longer; the estimated time is shown on every quote.' },
        { q: 'My transfer is pending for a long time. What do I do?', a: 'Open the transfer in the tracker. If the source transaction confirmed, the bridge will complete or refund by itself. If a destination swap failed you receive the bridged token instead.' },
        { q: 'What do I hold after buying a basket?', a: 'An index basket: one ERC-20 token backed by the assets inside. A strategy basket: each stock token separately. An automated basket: the holdings, in an account owned by your address.' },
        { q: 'Can I sell a basket at any time?', a: 'Yes. Index baskets redeem or sell onchain at any time. Strategy and automated baskets sell stock by stock during US market hours for tokenized stocks.' },
        { q: 'Why does a stock show no route?', a: 'No pool or solver could price that stock token at that moment, most often outside US market hours. It is marked and left out of the order; try again later.' },
        { q: 'Why was my basket quote refused?', a: 'Some sources refuse VPN and proxy connections, and issuers restrict certain residents. Turn the VPN off and try again; if it persists the source is unavailable in your region.' },
        { q: 'Can I add liquidity to a tokenized stock pool?', a: 'Yes. Open the pool under Tokenized Pools and choose Add Liquidity. Set a price range and the amounts, approve each token once, and one transaction adds the position.' },
        { q: 'Do I need an account?', a: `No. ${N} is non-custodial: connect a wallet and sign each transaction. There is nothing to register and no data to hand over.` },
      ] },
    ],
  },
]

export const BETA_NOTES = [
  { title: 'New integrations keep arriving', text: 'More issuers, chains, lending protocols and basket sources are added as each one is checked.' },
  { title: 'Pages and features can change', text: 'Layouts, options and flows are updated as new products join.' },
  { title: 'Routes depend on third parties', text: `Prices and liquidity come from the protocols ${N} connects to, so a route available now may be missing later, most often outside US market hours.` },
  { title: 'Tell us what you find', text: `Report anything that looks wrong to feedback@${BRAND.domain}.` },
]
