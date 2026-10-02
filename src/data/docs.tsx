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
      { kind: 'p', text: 'Tokenized Baskets are live: index baskets you hold as one token, and strategy baskets you hold stock by stock. Tokenized Pools lists the liquidity pools of tokenized stocks across chains, and Verdex Pools lets you provide liquidity to the ones on Robinhood Chain from your wallet. Lend and Borrow lets you earn on tokenized stocks, borrow against them, or hold more of one with Multiply.' },
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
    id: 'private-markets',
    title: 'Private Markets',
    blocks: [
      { kind: 'p', text: `Private Markets lists the private companies that have a token: pre-IPO exposure issued by PreStocks on Solana, one Token-2022 mint per company, priced where it trades. ${N} reads the price, the liquidity, the day’s volume and the holder count from Jupiter, and the transfer fee, the pause switch and the supply from each mint on Solana, every minute, in the browser. ${N} adds no contract and takes no fee; the trade happens on Jupiter, in your own Solana wallet.` },
      { kind: 'defs', items: [
        { term: 'What the token is', text: 'The issuer takes exposure to a private company’s shares through vehicles that hold them and issues a token against it. Holding the token is a claim on that exposure under the issuer’s terms: no shares in your name, no vote, no dividend. The issuer’s terms exclude U.S. persons. If the issuer fails, the token fails with it, whatever the company does.' },
        { term: 'The price', text: 'The last trade in the mint’s pools on Meteora and Raydium, reached through Jupiter. It is not the company’s last funding round and it moves with every buy and sell. Liquidity is how much sits in those pools; it tells you how far a trade would move the price.' },
        { term: 'Transfer fee', text: 'Every mint carries a Token-2022 transfer fee, taken on every transfer, the buy included. The issuer can change it with an epoch’s notice; the page shows the fee in force and any scheduled change, read from the mint.' },
        { term: 'Pause and delegate', text: 'The issuer holds a pause switch that stops every transfer of a mint, and a permanent delegate that can move or burn tokens from any account. Both are part of how it converts and refunds. The page shows whether transfers are open.' },
        { term: 'How it ends', text: 'When a company lists or is bought, the issuer converts, redeems or refunds the token under its terms. SpaceX listed in June 2026 and its public stock trades tokenized as SPCX in Markets; xAI’s token had a conversion window that closed on 12 September 2026. Both are kept on the page with what is left in their pools.' },
        { term: 'Replaced and refunded mints', text: `The issuer has retired more than twenty earlier mints, renamed OUTDATED or REFUNDED onchain. They still carry the PreStocks name and still get pasted into swap boxes. Only the mints on the page trade today; the check at the bottom tells you what any other mint is, by ${N}’s list first and by Jupiter’s name for the rest.` },
        { term: 'Fees', text: `No ${N} fee. You pay the mint’s transfer fee on the buy and on every later transfer, the pool fee, and Jupiter’s own terms.` },
      ] },
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
    id: 'verdex-pools',
    title: 'Verdex Pools',
    blocks: [
      { kind: 'p', text: `Verdex Pools is where you provide that liquidity. It reads every Uniswap v3 pool of a tokenized stock on Robinhood Chain from the factory, against USDG and ETH at every fee tier, and lets you open, top up, collect from and close positions from ${N}, signed in your own wallet. ${N} adds no contract and takes no fee on it.` },
      { kind: 'defs', items: [
        { term: 'Where the numbers come from', text: 'The pool list, the price and the tick from the chain, refreshed every minute. Liquidity and volume in dollars from DexScreener. Fee APR is one day of the pool fee at the current volume, times 365, divided by the liquidity: a snapshot, not a forecast.' },
        { term: 'Range', text: 'Presets of ±2%, ±5%, ±10% and ±25% around the current price, full range, or your own bounds. A tighter range earns a larger share of the fees while the price is inside and stops earning when it leaves; a full-range position always earns, but less.' },
        { term: 'Amounts', text: 'Type one side and the other follows from the range and the price. Outside the range only one token is needed. The minimums sent with the transaction allow 0.5% of movement; the deadline is 20 minutes.' },
        { term: 'The transaction', text: 'One approval per token the first time, then one call to the Uniswap v3 position manager. ETH is sent as ETH and wrapped inside the call, with any excess refunded in the same transaction. The position is an NFT held by your address.' },
        { term: 'Your positions', text: 'Every position your address holds in these pools, with the amounts it represents at the current price, whether the price is inside its range, and the fees it has earned but not yet collected. Collect pays the fees out; Remove takes out a share and the fees together, and closing the position burns the NFT.' },
        { term: 'Impermanent loss', text: 'A position is a bet the price stays inside the range. If the stock rises past the top you hold only the quote token; if it falls below the bottom you hold only the stock. The fees are the compensation for taking that side of every trade.' },
      ] },
    ],
  },
  {
    id: 'asset-yield',
    title: 'Asset Yield',
    blocks: [
      { kind: 'p', text: `Asset Yield puts what sits idle in your wallet on Robinhood Chain to work, through public contracts only. A tokenized stock goes into a one-sided Uniswap v3 band just above its price, where it earns the pool fee on every trade that reaches the band and is sold only if the price climbs through it. USDG goes into Spark Savings USDG, an ERC-4626 vault that accrues the Spark rate every second. ${N} adds no contract and takes no fee on either.` },
      { kind: 'defs', items: [
        { term: 'What is idle', text: 'When you connect, the page reads the balance of every tokenized stock the site lists on Robinhood Chain and your USDG, and for each stock picks the pool it would work in: a USDG pool with at least $1,000 of liquidity and the highest fee APR, or failing that the deepest pool of any quote.' },
        { term: 'The band', text: 'Presets of +2%, +5% and +10% above the current price, aligned to the pool’s tick spacing. The position holds only the stock, so nothing else is deposited and the shares stay yours while the price is below the band. Inside the band they earn the pool fee; through the top they have been sold at about the geometric mean of the two edges, which the page shows before you sign.' },
        { term: 'Stocks: the transaction', text: 'One approval of the stock token the first time, then one call to the Uniswap v3 position manager. The position is an NFT in your wallet and also appears on the Verdex Pools page and in the Uniswap app. Stop closes it and returns whatever it holds, stock or quote, plus the fees.' },
        { term: 'Cash: Spark Savings USDG', text: 'Deposit sends USDG to the vault and you receive spUSDG, whose value in USDG grows at the per-second rate the vault reports. The page compounds that rate over a year to show the APY. Withdraw redeems a share of your spUSDG back to USDG in the same wallet, with no lock and no exit fee. The vault has a deposit cap set by Spark.' },
        { term: 'Working now', text: 'Every position your address holds in these pools, labelled Earning when the price is inside its band, Waiting when it holds only the stock below the band, and Sold when the price has gone through and it holds the quote. Your Spark balance is listed with them.' },
        { term: 'Risks', text: 'A band is a sale you agreed to: if the stock rises through it you no longer hold the stock. Fee APR is today’s figure at today’s volume. The Spark vault is a contract run and audited by Spark; its rate moves when Spark moves it, and a deposit is exposed to that contract. There is no insurance on any of it.' },
      ] },
    ],
  },
  {
    id: 'launchpad',
    title: 'Launchpad',
    blocks: [
      { kind: 'p', text: `The Launchpad lets anyone launch a token on Robinhood Chain from ${N}, through the Pons V2 contracts that created VERDEX: the launch factory, its launch-and-buy router and the hook that charges fees in the pool. A launch mints a fixed supply of 1,000,000,000, opens a bonding curve quoted in ETH, USDG or one of the tokenized stocks the factory accepts, and graduates by itself into a Uniswap v4 pool with locked liquidity once the curve has raised its threshold. ${N} adds no contract and takes no fee; the launch fee and the curve fee are Pons's, read from the factory as you look.` },
      { kind: 'defs', items: [
        { term: 'What you choose', text: 'A name, a symbol, a logo link and a description, an X link and a website if you have them, the asset the token is priced in, your creator fee up to the factory’s maximum, and your first buy. The first buy lands in the same transaction as the launch, before anyone else can trade, and is exempt from the snipe tax.' },
        { term: 'The transaction', text: 'One call to the Pons router, after one approval when the quote is an ERC-20. The value sent is the launch fee plus the first buy for an ETH launch, or the launch fee alone otherwise. The page reads the factory’s economics digest just before and pins it into the call, so a change of terms by Pons in between makes the launch revert instead of repricing it.' },
        { term: 'Snipe tax', text: 'For the first seconds after a launch the curve taxes buys at a rate that starts near 99% and decays to zero, so bots cannot front-run a creator’s own first buy. The creator’s first buy and the addresses they list are exempt.' },
        { term: 'Graduation', text: 'Each quote asset has a threshold set by Pons. When the curve has raised it, the factory moves the raised quote and the reserved tokens into a Uniswap v4 pool behind the Pons hook and locks the liquidity position. From then on the token trades in the pool.' },
        { term: 'Creator fee', text: 'Your fee in basis points, charged by Pons on every trade, on the curve and in the pool after graduation, and paid to your wallet in the quote asset. VERDEX runs at 2%; its sweeps are listed on its page with every transaction.' },
        { term: 'The feed', text: 'The newest launches on the factory, whoever made them, with the quote, the curve’s progress, the age and the creator address, read from the factory’s events and the curve contracts. Most launches are memecoins and most never graduate. The list is what the chain says, not a recommendation.' },
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
    id: 'auto-invest',
    title: 'Auto-Invest',
    blocks: [
      { kind: 'p', text: `A recurring buy of one listed asset: the amount, the cadence (daily, weekly, every two weeks, monthly) and the stablecoin to pay with. Plans are stored in your browser for the wallet that made them; nothing is deposited anywhere.` },
      { kind: 'steps', items: [
        { title: 'Set it up', text: 'Pick the asset and its version (issuer and chain), the amount in dollars, the cadence and the pay token. The first buy can run right away or wait for the first scheduled date.' },
        { title: 'On its day', text: `${N} reminds you, prices the buy through the aggregator, approves the pay token once if needed, and asks your wallet to confirm the swap. Nothing moves before that confirmation.` },
        { title: 'Pause or remove', text: 'A plan is a note on your device. Pause it, change it or remove it at any time; the history of buys and their transactions stays with it.' },
      ] },
    ],
  },
  {
    id: 'auto-invest-without-you',
    title: 'Auto-Invest without you',
    blocks: [
      { kind: 'p', text: `Auto-Invest without you is a recurring buy of a tokenized stock on Robinhood Chain that runs while your wallet is closed. It is the one ${N} contract: short, open source, verified on the explorer, and unaudited. You approve an exact USDG allowance and create a plan: the stock, the amount per buy, the cadence, how many buys, and the first run. When a buy is due, an executor calls the contract, which pulls one buy's worth from your allowance, swaps it in the stock's USDG pool on Uniswap v3, sends the stock to your wallet and a tip of a few cents to the executor. ${N} takes no fee.` },
      { kind: 'defs', items: [
        { term: 'The allowance', text: 'Exact, never unlimited: the buys you asked for plus their tips, or a year of buys for an open-ended plan. It is the most the contract can ever pull. Cut it to zero from the page or from any wallet and every plan stops at once.' },
        { term: 'The price floor', text: 'Each buy must return at least the pool’s spot price less the plan’s slippage, read from the pool in the same transaction. If the pool is thin or moved, the buy waits for the next run instead of filling badly. The pool must hold at least $25k of liquidity when the plan is made.' },
        { term: 'Who runs it', text: `An executor on the contract’s list, or you. ${N} runs an executor every ten minutes from the same server that serves this site, with a wallet that holds a little ETH for gas and nothing else; its address is on the contract. The list exists so that the price floor cannot be gamed by an arbitrary caller; the admin can add or remove executors and nothing else.` },
        { term: 'Nothing held', text: 'Tokens pass through the contract inside one transaction. Between buys it holds no balance of yours, and no admin can move a plan, change it, pause it or touch your allowance.' },
        { term: 'Pause, resume, cancel', text: 'From the page, one transaction each. A cancelled plan never runs again. A finished plan has made every buy it was asked for.' },
        { term: 'Missed buys', text: 'If a buy cannot run (balance or allowance short, pool too far from spot) the plan simply waits. When it runs again the next buy is one interval later; missed buys do not pile up.' },
        { term: 'Risk', text: `The contract is unaudited. It is about two hundred lines, tested on a fork of Robinhood Chain, with the source and compiled bytecode in the repository. Read it before you trust it with more than you would lose.` },
      ] },
    ],
  },
  {
    id: 'vaults',
    title: 'Vaults',
    blocks: [
      { kind: 'p', text: `A target allocation across up to twelve listed assets on one chain, curated from a template or built by hand, held in your own wallet. ${N} reads balances and prices live, computes how far each asset has drifted from its target, and plans the trades back to target when the vault passes its drift threshold or its scheduled date.` },
      { kind: 'defs', items: [
        { term: 'Rule', text: 'Weekly, monthly, quarterly, or only when it drifts. A drift-only vault has no date.' },
        { term: 'Threshold', text: 'The drift, in percentage points, that makes a rebalance due: 2, 5 or 10.' },
        { term: 'Rebalance', text: 'Sells of the overweight assets and buys of the underweight ones, each priced through the aggregator and confirmed in your wallet one by one. A rebalance you start can be stopped between trades.' },
        { term: 'Funding', text: 'Add the quote stablecoin and the next rebalance buys the assets by weight.' },
      ] },
    ],
  },
  {
    id: 'strategies',
    title: 'Strategies',
    blocks: [
      { kind: 'p', text: `Published allocations you can follow into a vault of your own. A strategy is a set of weights with a change log; following it creates a vault in your wallet at the current version. When the manager publishes a new version, your vault shows the update and adopting it plans the trades; nothing changes until you do.` },
      { kind: 'p', text: 'Any vault can also be shared as a link. The link carries the weights, the chain and the rule, and nothing about the wallet that made it.' },
    ],
  },
  {
    id: 'orders',
    title: 'Orders',
    blocks: [
      { kind: 'p', text: 'Limit and stop orders on any listed asset on an EVM chain. An order names an asset, a side, a trigger price and a size, and is stored in your browser for the wallet that placed it.' },
      { kind: 'defs', items: [
        { term: 'Limit buy', text: 'Buys when the price falls to your level or lower.' },
        { term: 'Stop buy', text: 'Buys when the price breaks above your level.' },
        { term: 'Limit sell', text: 'Sells when the price rises to your level or higher.' },
        { term: 'Stop sell', text: 'A stop-loss: sells when the price falls to your level or lower.' },
        { term: 'Watching', text: `The price is checked every 30 seconds while ${N} is open, including the installed app, through the same feed that prices swaps. A level crossed while the app was closed triggers on the next open.` },
        { term: 'Fill', text: 'The fill is a market swap at the moment you confirm it, through the best route, so it lands at or near your level. Nothing is filled without that confirmation.' },
      ] },
    ],
  },
  {
    id: 'agent',
    title: 'Agent',
    blocks: [
      { kind: 'p', text: `Ask for an order, a recurring buy or a vault in plain words. The agent reads the market snapshot, the live price feed and your wallet through a fixed set of tools, and returns each action as a card with every field filled in. Approving the card saves a normal order, plan or vault; dismissing it leaves nothing behind. Your wallet still confirms every trade afterwards.` },
      { kind: 'defs', items: [
        { term: 'Your key', text: `Bring your own Anthropic or OpenAI key. It is stored in your browser only and sent, with your messages and the tool results, straight to that provider over HTTPS. ${N} has no server in that path.` },
        { term: 'No key', text: 'A small built-in helper understands the common phrasings and drafts the same cards without sending anything anywhere.' },
        { term: 'Tools', text: 'Four that read (search assets, price, holdings, activity) and three that draft (an order, a plan, a vault). The model cannot call anything else, and none of the tools can sign, send or move funds.' },
        { term: 'Approval', text: 'The agent proposes, you approve, your wallet confirms. There is no mode that skips a step.' },
      ] },
    ],
  },
  {
    id: 'fees',
    title: 'Fees',
    blocks: [
      { kind: 'p', text: 'Every quote shows the full cost before you sign. A transfer can include:' },
      { kind: 'fees', items: [
        { term: `${N} fee`, text: '0.25% of the amount sent, on swaps, bridges, private swaps, Auto-Invest buys, order fills, vault rebalances and agent trades. Zero for wallets that hold VERDEX.' },
        { term: 'VERDEX holders', text: `No ${N} fee on anything. The balance is read from the token contract on Robinhood Chain before each quote; any amount counts.` },
        { term: 'Index baskets', text: `No ${N} fee. The basket charges its own mint fee and yearly fee, shown on each basket page.` },
        { term: 'Automated baskets', text: '0.50% per swap, rebalances included.' },
        { term: 'Strategy baskets', text: '0.50% per swap, the same as Swap and Bridge.' },
        { term: 'Lend and Borrow', text: `No ${N} fee. You pay Kamino’s borrow rate on what you borrow.` },
        { term: 'Route fees', text: 'What the route itself charges, shown as one line in the quote. LI.FI, which prices and executes every trade, takes 0.25% of the amount sent on the routes it runs; a bridge or exchange on the route can add its own.' },
        { term: 'Network gas', text: 'paid in the source chain’s gas token' },
      ] },
      { kind: 'p', text: `Both the ${N} fee and the route fees are taken from the token you send and are already inside the amount the quote says you will receive. Gas on Arc is paid in USDC.` },
    ],
  },
  {
    id: 'holding',
    title: 'Holding VERDEX',
    blocks: [
      { kind: 'p', text: `VERDEX is the token behind ${N}. Holding it changes two things, both read from the wallet's balance on Robinhood Chain and nothing else: no contract to stake into, no lock, no registration.` },
      { kind: 'defs', items: [
        { term: 'Any amount', text: `The ${N} fee is zero on every trade: swaps, bridges, private swaps, Auto-Invest, Orders, Vaults, Strategies and the agent. Everyone else pays 0.25%.` },
        { term: '0.5% of the supply', text: `Early access. Each new feature opens to wallets holding at least 0.5% of the supply first, and to everyone a stated time later. The threshold is computed from the live total supply, so burns lower it.` },
        { term: 'How it is checked', text: `Your browser reads balanceOf and totalSupply from the token contract before each quote and when you open a gated page. The result is cached for a minute. Nothing is sent to ${N}.` },
        { term: 'Where it stands', text: 'The VERDEX page shows your balance, your share of the supply and how far you are from early access when a wallet is connected.' },
      ] },
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
        { term: 'Approvals', text: `Before a swap from an ERC-20 token, your wallet approves the aggregator's router to spend it. ${N} asks for an unlimited allowance once per token and chain so that recurring buys and rebalances need one confirmation each; you can revoke it at any time from your wallet or a tool such as revoke.cash, and the next trade will ask again.` },
        { term: 'Automation', text: `Plans, vaults, orders and agent proposals live in your browser. Nothing runs while the site is closed, nothing is executed without a confirmation in your wallet, and ${N} never holds keys, funds or allowances of its own.` },
      ] },
    ],
  },
  {
    id: 'audit',
    title: 'Audit',
    blocks: [
      { kind: 'p', text: `An internal audit of the site, published on 30 September 2026 so that anyone can check the findings against the code. It covers custody, approvals, routes, fees, the automation features, the agent, dependencies, the installed app and privacy, plus a crawl of every route on desktop and mobile. It is not a third-party audit, and it does not cover contracts ${N} does not own.` },
      { kind: 'defs', items: [
        { term: 'Automated checks', text: 'npm audit: 0 vulnerabilities in production and development packages. ESLint: 0 problems. TypeScript strict: 0 errors. 20 routes on two viewports: 0 page errors, 0 console errors, 0 failed requests.' },
        { term: 'Fixed', text: 'The privacy policy now names every data flow and who receives it. Every route has its own title. Shared links carry a preview image. Thirteen inputs are labelled for screen readers. Private-swap addresses are checksummed. Vendor code ships in its own chunks, so the largest file went from 1.1 MB to 288 kB.' },
        { term: 'Kept, and why', text: 'One unlimited allowance per token to the router named by each quote, so recurring buys and rebalances stay a single confirmation; revocable at any time. The agent key lives in your browser because there is no Verdex server to hold it. Order fills are market swaps at the moment you confirm.' },
        { term: 'Out of scope', text: 'The routing contracts, the issuers\' tokens, the lending and basket protocols and the launchpad behind VERDEX have their own audits.' },
        { term: 'Re-audit, 1 October 2026', text: 'Every check re-run after the seven launches that followed: 0 vulnerabilities, 0 lint problems, 0 type errors, 24 routes on two viewports with 0 errors. The holder, pools and yield engines read line by line. Two low findings fixed and shipped: a Spark deposit above the vault cap is refused before it reaches the wallet, and a stock’s band is placed in a pool with at least $25,000 of liquidity. Four things kept with the reasoning, among them that the Spark vault is upgradeable by Spark.' },
        { term: 'Full report', text: 'AUDIT.md in the repository lists every finding with the file to open: github.com/useverdex/verdex/blob/main/AUDIT.md. Report anything it missed to feedback@verdex.app.' },
      ] },
    ],
  },
  {
    id: 'bug-bounty',
    title: 'Bug bounty',
    blocks: [
      { kind: 'p', text: `Anyone who finds what the audit missed gets paid, in ETH on Robinhood Chain, from the creator fees the VERDEX token earns. Report privately first and give us reasonable time to fix; the channels and the full rules are in SECURITY.md in the repository.` },
      { kind: 'fees', items: [
        { term: 'Critical · 0.5 ETH', text: 'The site requests a signature or sends a transaction the user did not ask for, or what is sent is changed.' },
        { term: 'High · 0.2 ETH', text: 'A wrong route, amount, address or fee at confirmation time; reading another user\'s stored plans, orders, vaults or key.' },
        { term: 'Medium · 0.05 ETH', text: 'A data leak, a broken safety check, or automation acting on the wrong data.' },
        { term: 'Low · credit', text: 'Anything else that misleads a user.' },
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
