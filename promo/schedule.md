# Tweet schedule: Oct 7 to Oct 9, 2026 (CEST, UTC in brackets)

Every tweet has a video. Intervals 1h45 to 2h30 with odd minutes so nothing looks scheduled; anchors fixed: Vaults 01:00, Agent 17:00, Numbers 01:00, Vote 17:00, the undervalued note after it, Telegram 01:00. All copy in English; no partnership claims; "unaudited" where a contract is involved; "undervalued" is an opinion, no price target.

## Tuesday Oct 7

### 01:00 (23:00 UTC) · `clip-vaultslive.mp4`

> Vaults without you are live.
>
> Box 8 of 11. Target weights over tokenized stocks, kept by a contract on Robinhood Chain while your wallet is closed. Magnificent 7 at equal weight, or your own mix: when any weight drifts 2, 5 or 10% past its target, the executor sells the overweight stocks for USDG, buys the underweight ones and sends it all back to you, in one transaction with a floor on every leg.
>
> You approve each stock for what you hold, and nothing more. Nothing held between runs. No fee. Unaudited, verified.
>
> useverdex.xyz/vaults/without-you

Reply, right after:

> How it differs from the Vaults you already had: those ran in your browser and needed your tap on every trade. These live in the contract: weights, threshold and cadence; the executor that already runs Auto-Invest and Orders checks them every ten minutes. Buy more of a stock, approve it again from the card, and it is part of the vault.

### 03:07 (01:07 UTC) · `clip-onerun.mp4`

> What a rebalance looks like, onchain.
>
> One transaction. The contract pulls the overweight stocks from your allowances, sells them for USDG in their own pools, takes a ten-cent tip, buys the underweight ones with the proceeds and sends everything back. It ends the transaction holding nothing. Every leg has a floor: spot less 1%, read in that same transaction.
>
> useverdex.xyz/vaults/without-you

### 04:58 (02:58 UTC) · `clip-opensource2.mp4`

> Nine contracts. All in the repo, all verified.
>
> Index, Router, Treasury, Lend, Leverage, Auto-Invest, Orders, Vaults, Agent. Exact bytecode match on Sourcify, source on the explorer, compiled artifacts next to the Solidity. The site is public too, every page and script.
>
> Short contracts, plain names, no proxies, no upgrades. Read them before you trust them.
>
> github.com/useverdex/verdex

### 07:23 (05:23 UTC) · `clip-audit2.mp4`

> Audited by us. Not yet by a third party.
>
> We read our own contracts for custody, approvals, floors, reentrancy and admin powers, wrote it up, and fixed what we found in Lend, Leverage and the Index router in the repo. No admin anywhere can move your tokens; the only lever is the executor list.
>
> Until someone else has read them, size positions like a beta. The audit is in the repo: docs/audit-2026-10-05.md.
>
> useverdex.xyz/docs

### 09:14 (07:14 UTC) · `clip-eightofeleven.mp4`

> Eight of eleven. Checked.
>
> Index, Fees buy VERDEX, Lend, Leverage, Base, Solana, Orders without you, Vaults without you. Shipped, verified, live.
>
> Next: Agent without you. Today, 17:00 CEST.
>
> useverdex.xyz

### 11:36 (09:36 UTC) · `clip-executor.mp4`

> One wallet runs it all. Every ten minutes.
>
> Auto-Invest, Orders, Vaults and, from today, the Agent: one pass from the same server, paid in ten-cent USDG tips by the plan, the order, the vault or the mandate it runs. When its ETH runs low it sells the tips for gas. No treasury behind it.
>
> It is a wallet with an allowlist, not a privilege: the owner can always run their own, and the floors hold for everyone.
>
> useverdex.xyz/docs

### 13:22 (11:22 UTC) · `clip-holdersfirst.mp4`

> Holders first. Every box, hours early.
>
> Wallets holding 0.5% of the VERDEX supply open every drop before everyone else, read onchain. Hold any amount and the Index and Leverage fees are 0%. Everyone else's fees buy VERDEX: half burned, half paid back weekly to the wallets that paid them.
>
> No sign-up, no snapshot, no form. Your balance is read onchain.
>
> useverdex.xyz/verdex

### 15:13 (13:13 UTC) · `clip-agentsoon.mp4`

> Box 9 of 11.
>
> Agent without you. Today at 17:00 CEST, 15:00 UTC. A budget and rules in a contract: how much per trade, per day, in all, in what, with what floor. The agent works inside them while your wallet is closed; the contract refuses the rest.
>
> Holders first.
>
> useverdex.xyz

### 17:00 (15:00 UTC) · `clip-agentlive.mp4`

> Agent without you is live.
>
> Box 9 of 11. Give the agent a mandate on Robinhood Chain: the stocks, the rule (buy the dips, buy strength, take profits, cut losses), the size of the move, $100 a trade, $200 a day, $500 in all, one trade per stock per day, for 30 days. The contract enforces every cap and a floor of spot less 1%, read at trade time; the executor applies the rule to each stock's move on the day, every ten minutes, from your allowance. The stock lands in your wallet.
>
> Ask the Agent page for one in a sentence, approve the card, sign. Nothing held between trades. No fee. Unaudited, verified.
>
> useverdex.xyz/agent/without-you

### 19:08 (17:08 UTC) · `clip-limits.mp4`

> What the contract checks, and what it does not.
>
> It checks the budget, the per-trade and per-day caps, the cooldown, the expiry and the floor, on every trade, and reverts anything outside them. It does not check that the stock really moved 3% today: that is the executor reading the market data.
>
> So the worst a rogue executor could do is trade inside your limits at spot less 1%. Set the caps like you would for a stranger with those rules. Pause, close or revoke to end it.
>
> useverdex.xyz/agent/without-you

### 21:21 (19:21 UTC) · `clip-draft.mp4`

> One sentence. One mandate.
>
> "Let the agent buy NVDA and AMD dips with $500." The Agent page drafts the card: buy the dips at 3%, $100 a trade, two a day, $500 in all, a day between trades on the same stock, 30 days. Approve it and the mandate opens with every limit filled in; your wallet signs it and a USDG allowance of exactly the budget plus the tips.
>
> Bring your own model key, or none: the rules-based helper drafts the common ones.
>
> useverdex.xyz/agent

### 23:13 (21:13 UTC) · `clip-numberssoon.mp4`

> Box 10 of 11.
>
> Verdex in numbers. Tonight at 01:00 CEST, 23:00 UTC. What the Index contracts hold, the volume through Verdex, the fees bought, burned and paid back, the plans, fills, runs and trades of the four contracts that work without you. Read from the chain by your browser, with a link to every transaction.
>
> Small and growing beats big and unverifiable. Holders first.
>
> useverdex.xyz

## Wednesday Oct 8

### 01:00 (23:00 UTC, Oct 7) · `clip-numberslive.mp4`

> Verdex in numbers is live.
>
> Box 10 of 11. Index TVL valued at the pools, volume through the aggregator, VERDEX bought, burned and paid back by the treasury, and every plan, order, vault and mandate the executor has run: read from the contracts by your browser, each number with a link to the transactions behind it. Nothing from a screenshot, nothing from us.
>
> Small, and growing.
>
> useverdex.xyz/numbers

### 03:09 (01:09 UTC) · `clip-feesbuy.mp4`

> Every fee buys VERDEX. Half burned, half paid back.
>
> The only fee on Verdex is 0.25% on Index and Leverage, and holders pay none. Every six hours the treasury contract sweeps what it holds into VERDEX through a route it checks against its own floor, burns half, and once a week pays the other half back to the wallets that paid the fees, pro rata.
>
> Sweep by sweep, on the Treasury page.
>
> useverdex.xyz/treasury

### 05:22 (03:22 UTC) · `clip-floors.mp4`

> Spot, less 1%. Read in the same transaction.
>
> Every Index leg, every order fill, every vault leg, every agent trade: the pool's spot price at that moment, less 1%, is the floor. A pool that has moved makes the trade revert, not fill badly. No oracle to feed, no price to post, nothing to game.
>
> One rule, in every contract.
>
> useverdex.xyz/docs

### 07:34 (05:34 UTC) · `clip-chains.mp4`

> Three chains, one token.
>
> Robinhood Chain for everything: the Index, Lend, Leverage, the treasury and the four contracts that work without you. Base for the same indexes in Coinbase's tokenized stocks, paid in USDC. Solana for the baskets in xStocks, built in your browser, signed once. VERDEX lives on Robinhood Chain and pays for all of it.
>
> useverdex.xyz/index?chain=base

### 09:47 (07:47 UTC) · `clip-passthrough.mp4`

> Holds nothing. Between runs, between trades.
>
> Auto-Invest, Orders, Vaults and the Agent never take a deposit. You approve an allowance for exactly what a plan, an order, a vault or a mandate may move; the contract pulls it at execution, swaps it, sends it on, and ends the transaction with a zero balance. One approval of zero ends anything.
>
> Four contracts, one pattern.
>
> useverdex.xyz/docs

### 11:38 (09:38 UTC) · `clip-tenofeleven.mp4`

> Ten of eleven. Checked.
>
> Index, Fees buy VERDEX, Lend, Leverage, Base, Solana, Orders, Vaults, Agent, Numbers. Shipped, verified, live.
>
> Next, the last one: Holders vote. Today, 17:00 CEST.
>
> useverdex.xyz

### 13:26 (11:26 UTC) · `clip-readit.mp4`

> Read it before you trust it.
>
> A docs page per box: what it does, what it checks, what it does not, the risks. The source in the repo with the compiled bytecode next to it. The bytecode hash on every deploy page before a wallet signs. An exact match on the explorer, so what runs is what you read.
>
> Unaudited by anyone but us. That sentence is on every page.
>
> useverdex.xyz/docs

### 15:13 (13:13 UTC) · `clip-votesoon.mp4`

> Box 11 of 11.
>
> Holders vote. Today at 17:00 CEST, 15:00 UTC. Your balance is your vote, read onchain: no sign-up, no snapshot, no token to lock. Rank what ships next; the list is the roadmap and you put it in order. A new round every two weeks, results on the page.
>
> Holders first.
>
> useverdex.xyz

### 17:00 (15:00 UTC) · `clip-votelive.mp4`

> Holders vote is live.
>
> Box 11 of 11, the last one of phase 2. Your VERDEX balance is your vote, read onchain when the round is tallied: no sign-up, no snapshot, no token to lock. Rank the candidates for what ships next; the page weighs every ranking by the balance behind it. A new round every two weeks. Selling is leaving the vote.
>
> useverdex.xyz/vote

### 19:12 (17:12 UTC) · `clip-undervalued.mp4`

> Honest take from the dev, now that phase 2 is closed.
>
> In nine days we put nine contracts on three chains, all verified, all open source, none holding your funds. The site reads every number from the chain. And the market cap is still what it was before any of it existed.
>
> I think that gap is wrong. Not because of what I promise, because of what is already on the explorer. We are going to keep closing it with work, not with words.
>
> 01:00 CEST: a place for holders, and your say on what comes next.
>
> useverdex.xyz

### 21:03 (19:03 UTC) · `clip-elevenofeleven.mp4`

> Eleven of eleven. Checked.
>
> Phase 2, shipped in nine days: Index, Fees buy VERDEX, Lend, Leverage, Base, Solana, Orders, Vaults, Agent, Numbers, Vote. Every contract verified, every page live, nothing held for anyone.
>
> Next: 01:00 CEST.
>
> useverdex.xyz

### 22:58 (20:58 UTC) · `clip-placeofourown.mp4`

> Somewhere to talk. In two hours.
>
> Not a feature this time: a place. For holders first, where you choose the direction after phase 2. No token to lock, no form; holding is enough.
>
> 01:00 CEST, 23:00 UTC.
>
> useverdex.xyz

## Thursday Oct 9

### 01:00 (23:00 UTC, Oct 8) · `clip-telegram.mp4`

> Verdex is on Telegram.
>
> A place to talk to the dev, where every drop and every number lands first. Polls on what ships next: the roadmap after phase 2, chosen by you. And the onchain vote on the site, where your balance is your vote.
>
> Holders first. Phase 3 starts with you.
>
> [LINK]
