# Phase 1 was the product. Phase 2 is the protocol.

Six days ago we posted a roadmap with thirteen boxes. Last night the last one shipped. Marketplace, Swap and Bridge, Baskets, Lend and Borrow, the mobile app, Auto-Invest, Vaults, Asset Management, Verdex Pools, Asset Yield, the Launchpad, Private Markets, and Auto-Invest without you. All of it live at useverdex.xyz, all of it open source.

We said we are not leaving, that we believe this project is deeply undervalued, and that the only answer to that is bigger updates and more work. This is what that means.

Here is the honest version of where we stand. Almost everything we built in phase 1 runs in your browser on top of other people's contracts. It is useful, it is fast, and someone could copy it in a week. What cannot be copied in a week is a protocol: contracts that hold positions, earn fees and run without us. Phase 1 earned the right to build that. Phase 2 builds it.

Phase 2 has three parts: what turns Verdex into a protocol, what multiplies the people who can use it, and what gives VERDEX a reason to exist.

## 1. What turns Verdex into a protocol

**Verdex Index.** Today a Basket is seven swaps with a nice interface. In phase 2 a basket becomes a token. You put in USDG, a contract buys the seven stocks and gives you one ERC-20: a Magnificent Seven on Robinhood Chain, an AI Infrastructure index, a Semis index. You can hold it, send it, put it in a pool, see it on DexScreener, and redeem it for the stocks whenever you want. An ETF with no issuer, built from tokenized stocks, the first on Robinhood Chain. The contract holds exactly the stocks behind the shares and nothing else.

**Orders without you. Vaults without you.** Auto-Invest without you proved the pattern: an exact allowance, a price floor read from the pool in the same transaction, an executor that runs while your tab is closed, and a contract that holds nothing between runs. Limit and stop orders get the same treatment, and so does vault rebalancing. By the end of phase 2, every automation on Verdex runs onchain without your tab, your signature or your reminder.

**Agent without you.** The Verdex agent today proposes and you approve. Next, you give it a budget and rules in a contract (how much, in what, with what floor) and it works inside them, 24/7, without ever holding your funds. AI that invests for you, with limits the chain enforces, not limits in a terms-of-service page.

**Verdex Lend and Leverage.** The first money market for tokenized stocks: deposit NVDA and earn, borrow USDG against your stocks without selling them. Then two-times long and short, onchain, around the clock. These are the two boxes we will open last and with hard caps, because the risk is not ours, it is yours. They are on the list so you know where this goes.

## 2. What multiplies the audience

**Verdex on Base.** The people buying tokenized stocks today are on Base, with Coinbase's own NVDAc, TSLAc, AAPLc and the rest. Three of those pools alone move more than sixteen million dollars a day. The same contracts, the same executor and the same site, pointed at those pools, with a chain selector. Auto-Invest without you goes first because it already exists; the Index is born on both chains.

**One token, every chain.** VERDEX stays on Robinhood Chain, one pool, one supply. We are not bridging it and we are not splitting the liquidity. Your holder perks work wherever you trade, because the site reads your VERDEX balance on Robinhood Chain whatever chain you are using. And everything Verdex earns on any chain comes home to buy VERDEX there.

**Solana after.** xStocks on Solana through Jupiter are already in our Markets and Private Markets. Contracts there are another language and another scale of work. It is on the list, after Base.

## 3. What gives VERDEX a reason to exist

**Every protocol fee buys VERDEX.** Everything the protocol earns (Index mint and redeem, Auto-Invest tips, Orders, the Verdex swap fee) lands in one public treasury contract. Half of it buys VERDEX and burns it. The other half buys VERDEX and pays it back every week to the wallets that used Verdex, in proportion to the fees they paid. No inflation, no team allocation: you get paid in VERDEX with the fees you generated. Every sweep is a transaction anyone can read. The creator fee of the VERDEX token itself stays what it is today, separate from this.

**Protocol-owned liquidity.** Part of the treasury goes into the VERDEX pool as liquidity the protocol owns. A pool with nineteen thousand dollars in it moves on any trade, in both directions. The fix is depth, and depth comes from the protocol, not from asking anyone.

**Holders vote the order.** A page that reads your VERDEX balance onchain, nothing to register. Every two weeks, holders rank what ships next from this list. We said in the first roadmap thread that the next one is yours to choose. This is how.

**Every number live.** Index TVL, volume through Verdex, fees earned, VERDEX bought, burned and paid back, plans running, orders filled. Read from the chain by your browser, with a link to every transaction, the way the token page already works. Small today and growing is a better story than big and unverifiable.

## What we are not promising

A price. Dates. Partnerships. Yields. What we are promising is the same thing phase 1 delivered: one box at a time, each one with its contract verified, its page live and its video posted, until the list is done.

useverdex.xyz
