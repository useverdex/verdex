# Verdex site audit, September 2026

An internal audit of the Verdex web application by the people who build it, published so that anyone
can check the findings against the code. It covers the site at commit `a16e8e7` on 30 September 2026:
every page, every engine that touches a wallet, the installed app, the dependencies, and the data that
leaves the browser. It is not a third-party audit and does not cover contracts Verdex does not own.

## Re-audit, 1 October 2026 (commit `f878cf5`)

Seven launches followed the first audit in two days: Vaults, Strategies, Orders, Agent, the VERDEX
holder perks, Verdex Pools and Asset Yield. This pass re-ran every check above on the site at commit
`f878cf5` and read the three engines that did not exist on 30 September, line by line: `src/lib/holding.ts`
(the holder check and early access), `src/lib/pools.ts` (Uniswap v3 positions) and `src/lib/yield.ts`
(one-sided bands and Spark Savings). The scope, method and out-of-scope list below still apply; the
new pages added four routes to the crawl.

### Results of the automated checks, re-run

| Check | Result |
| --- | --- |
| `npm audit` (production) | 0 vulnerabilities |
| `npm audit` (all) | 0 vulnerabilities |
| `eslint .` | 0 problems |
| `tsc -b --noEmit` | 0 errors |
| 24 routes × 2 viewports | 0 page errors, 0 console errors or warnings |
| Same-origin requests | 0 failed |
| External links (17) | All reachable; two sites refuse automated fetches with 403 but open in a browser |

### Fixed in this re-audit (commit `f878cf5`)

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 7 | Low | A Spark Savings deposit larger than the vault's remaining cap was sent to the wallet and reverted onchain, costing gas for nothing. | `readSavings` in `src/lib/yield.ts` reads `depositCap` and `totalAssets`; the cash composer in `src/pages/AssetYieldPage.tsx` refuses an amount above the room left and says how much the cap allows. |
| 8 | Low | The pool chosen for a stock's band was the highest fee APR among pools with $1,000 of liquidity, so a thin pool with a stale price could set the band off the market. | `bestPool` in `src/lib/yield.ts` requires $25,000 of liquidity before fee APR counts; when a stock has only thin pools the composer names the liquidity and tells the user to check the band against the market price. |

### Reviewed and kept, with the reasoning

| # | Area | What the code does | Why it stays |
| --- | --- | --- | --- |
| G | Approvals, pools and savings | A stock token is approved once, unlimited, to the Uniswap v3 position manager (`addLiquidity` in `src/lib/pools.ts`); USDG is approved once, unlimited, to the Spark Savings USDG vault (`depositSavings` in `src/lib/yield.ts`). | Same reasoning as A: one approval per token, to a contract named on the page and verified onchain (the position manager at `0x7399…0D3` is the one the Uniswap app uses; the vault at `0xde77…4087` reports USDG as its asset). Revocable at any time; the next deposit asks again. |
| H | Spark Savings USDG is a proxy | The vault is an EIP-1967 proxy whose implementation Spark can change. The page shows its rate from `vsr()` and its value from `convertToAssets`, both read from the contract. | Every ERC-4626 savings vault of this kind is upgradeable by its operator, and the page says so under "Spark is a contract, not a bank". The alternative is not offering cash yield. Deposits are the user's choice, with no Verdex contract in between. |
| I | Market figures from DexScreener | Liquidity and 24-hour volume in dollars, and so the fee APR, come from DexScreener (`readMarket` in `src/lib/pools.ts`); price and tick come from the pool itself. | A public API read in the browser. If it fails, the pool lists with onchain figures and no APR rather than a wrong one, and the APR is labelled as today's snapshot wherever it appears. |
| J | Holder check | `useHolding` reads the wallet's VERDEX balance from a public RPC and keeps it for 60 seconds; a quote asks for the Verdex fee only when the balance is zero or the read failed (`src/swap/SwapWidget.tsx`). | A failed read costs a holder the fee on one quote, never a non-holder a free trade; the next quote reads again. The threshold for early access follows the live supply, so burns lower it without a deploy. |

## Scope

| Area | What was checked |
| --- | --- |
| Custody | That no code path deposits, pools or holds user funds, keys or allowances of its own; that every transfer is a transaction signed in the user's wallet. |
| Approvals | Which address receives an ERC-20 allowance, for how much, when it is requested, and how it can be withdrawn. |
| Routes | Quote freshness before a send, slippage handling, minimum received, chain switching. |
| Fees | How the Verdex fee is applied, how the VERDEX holder check is made, what happens when a route rejects the fee parameter. |
| Automation | Auto-Invest, Vaults, Strategies and Orders: where state lives, what runs unattended, what needs a confirmation. |
| Agent | Where the model key is stored, what leaves the browser and to whom, which tools the model can call, and whether any path executes without approval. |
| Dependencies | Every production and development package against the npm advisory database. |
| Code quality | ESLint with the React Hooks rules, TypeScript strict, and a crawl of every route on desktop and mobile viewports. |
| App shell | What the service worker caches and what it never touches. |
| Privacy and content | What the privacy policy says against what the code does; social previews, titles, accessibility of inputs, external links. |

## Method

- Read of `src/lib/*.ts` (LI.FI client, Auto-Invest, Vaults, Strategies, Orders, Agent), `src/swap`, `src/components/wallet`, `public/sw.js`, `index.html`, `vite.config.ts` and the deploy configuration.
- `npm audit` for production and development dependencies.
- `eslint .` and `tsc -b --noEmit`.
- A Playwright crawl of 20 routes at 1440×900 and 393×852, recording page errors, console errors and warnings, failed same-origin requests, document titles and external links; every external link fetched.
- Production headers inspected with a plain HTTP request.

## Results of the automated checks

| Check | Result |
| --- | --- |
| `npm audit` (production) | 0 vulnerabilities |
| `npm audit` (all) | 0 vulnerabilities |
| `eslint .` | 0 problems |
| `tsc -b --noEmit` | 0 errors |
| 20 routes × 2 viewports | 0 page errors, 0 console errors or warnings |
| Same-origin requests | 0 failed |
| External links (15) | All reachable; three sites refuse automated fetches with 403 but open in a browser |
| Service worker | Caches only navigations and `/assets`, `/img`, `/logos`, `/icons`, `/design`, `/brand`; never `/api`, quotes, prices or wallet traffic |

## Findings

Severity is about user impact. Every finding lists where to look.

### Fixed in this audit (commit `a16e8e7`)

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | Medium | The privacy policy was generic and did not name the services that receive data (LI.FI for quotes, public RPC endpoints for reads, the model provider for the agent) or say what stays on the device. | Rewritten in `src/pages/LegalPage.tsx` to list exactly what leaves the browser, to whom, and what is stored locally. |
| 2 | Low | Every route shared one document title, which hurts tabs, history, sharing and search results. | `RouteTitle` in `src/App.tsx` sets a title per route. |
| 3 | Low | No `og:image` or `twitter:image`, so shared links unfurled without an image despite `summary_large_image`. | `public/brand/og.png` (1200×630) and the meta tags in `index.html`. |
| 4 | Low | 13 text inputs carried `aria-label` on the wrapper element instead of the input, so screen readers announced them without a name. | Labels moved to the input element (`inputProps`) in the Orders, Vaults, Auto-Invest, Strategies, Agent and swap forms and the shared search. |
| 5 | Low | The private-swap receiving address was validated with a plain hex pattern, so a mixed-case address with a wrong checksum was accepted. | `isAddress` from viem in `src/swap/SwapWidget.tsx`, which rejects a bad checksum. |
| 6 | Low | All vendor code shipped in one 1.1 MB chunk, so every deploy made returning visitors download React, MUI and viem again. | Vendor chunks in `vite.config.ts`: the largest file is now 288 kB and vendor files keep their hash between deploys. |

### Reviewed and kept, with the reasoning

| # | Area | What the code does | Why it stays |
| --- | --- | --- | --- |
| A | Approvals | Before a swap from an ERC-20 token, the wallet is asked once for an unlimited allowance to the `approvalAddress` returned by the LI.FI quote (`src/lib/autoInvest.ts`, `vaults.ts`, `orders.ts`, `src/swap/SwapWidget.tsx`). | One approval per token and chain is what lets a recurring buy or a rebalance be a single confirmation. The address comes from the audited LI.FI router for that chain. Users can revoke at any time from the wallet or a tool such as revoke.cash; the next trade asks again. Documented under Docs → Safety. |
| B | Agent key | The user's Anthropic or OpenAI key is stored in `localStorage` and sent only to that provider from the browser (`src/lib/agent.ts`). | The request has to be made from the device, and Verdex has no server to hold the key more safely. It is never logged or sent elsewhere; Forget key removes it. |
| C | Agent tools | Seven tools with strict JSON schemas: four read (assets, price, holdings, activity), three draft proposals. No tool signs, sends or writes to a store; `approve()` runs only from the card's button. | The design goal is approval by default. Tool results contain only Verdex's own data and the user's balances, which limits prompt-injection surface. |
| D | Order fills | The trigger is watched every 30 seconds while the site is open; the fill is a market swap at the moment the user confirms it. | Stated on the page and in Docs. A guaranteed price would need an onchain order book. |
| E | Price and quote sources | Prices and routes come from the LI.FI API with the bundled market snapshot as fallback; balances from public RPC endpoints. | Inherent to a non-custodial front end. Every transaction the API prepares is shown in the wallet before signing, and `toAmountMin` is enforced onchain. |
| F | Response headers | The host sets `X-Content-Type-Options: nosniff`; there is no Content-Security-Policy. | A CSP strict enough to matter would need to allow the RPC and wallet hosts users bring, and can break wallet extensions. Revisit when the host supports per-path headers. |

### Out of scope

The LI.FI routing contracts, the issuers' token contracts, the lending markets, the basket protocols and the launchpad and hook contracts behind the VERDEX token are third-party code with their own audits. This audit covers the Verdex site and everything it does with a connected wallet.

## Reporting

Found something this audit missed? Write to feedback@verdex.app or open an issue at
github.com/useverdex/verdex. The policy is in `SECURITY.md`.
