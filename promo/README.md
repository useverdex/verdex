# Verdex promo video

`index.html` is a 31-second, 1920×1080 promo built as a deterministic timeline. `renderAt(t)` draws the frame at `t` seconds. It uses the site's own fonts, particle landscape, logos and page screenshots (`shots/`), and gets its prices and counts from `data.json`.

The motion follows Apple's fluid-interface rules:

- Critically damped springs by default.
- A little bounce only on the tiles that are thrown in.
- Surfaces arrive with blur and scale together.
- Feedback on the button lands on the press.

- **Preview in a browser:** serve the repo root (for example `python3 -m http.server`), then open `/promo/index.html?play`.
- **Render the MP4:** run `node promo/render.mjs --out promo/verdex-promo.mp4`. This needs Playwright's Chromium and an `ffmpeg` with libx264 (set `FFMPEG=/path/to/ffmpeg` if it is not on the PATH).
- **Stills for review:** run `node promo/render.mjs --still 3,6,13.5,19.8,24,29 --dir /tmp`.

`tweets.md` has the launch tweet, a thread and standalone tweets to post with the video.

## Brand film

`brand.html` is a second, 34-second timeline in the style of the launch films of other onchain products: an "Introducing" wipe, the mark and name inside a ring of real asset logos, a kinetic "Trade stocks / ETFs / gold / treasuries" stack, a flight through a field of logos, one logo growing into the market rows and the assets page, issuer and chain grids, a filled-in swap card with a confirmation toast, three benefit lines, the product cards on a lime route, and the end card with useverdex.xyz.

Render it with `node promo/render.mjs --page promo/brand.html --out promo/verdex-brand.mp4`. Stills: `node promo/render.mjs --page promo/brand.html --still 3,7,12,18,24,30 --dir /tmp`.

## Site walkthrough

`tour.mjs` drives the real preview build in Chromium with a mock wallet, a fake cursor and caption cards, and records it to `verdex-tour.mp4` (about 1:46, under X's 2:20 limit). Start `npx vite preview --outDir dist-preview --port 4174` first, then `node promo/tour.mjs`. External API calls go through `HTTPS_PROXY` when set.

## App promo

`app.html` is a 43-second timeline with the phone as the hero: the mark and "Now in your pocket.", then the phone rises in and moves between sides while its screen plays real footage of the app (markets, search, swap, baskets, lend and borrow, portfolio), the install sheet, the icon landing on a home screen, the app launching, and the end card.

The footage comes from `phone.mjs`, which drives the preview build at an iPhone viewport (393 by 852, captured at 2x) with the mock wallet. Chromium's screencast only records CSS pixels on a phone viewport, so the recorder takes screenshots frame by frame instead: the page clock and its CSS animations run at a third of real speed, every capture is stamped with clip time, and the frames are resampled to a steady 30 fps in `phone/<clip>/`. `phone/index.json` lists the frame counts for `app.html`.

Start `npx vite preview --outDir dist-preview --port 4174`, then `node promo/phone.mjs` (`--only swap,install` re-records some clips), then `node promo/render.mjs --page promo/app.html --out promo/verdex-app.mp4`.

## Auto-Invest launch

`autoinvest.html` is a 34-second film for the feature: "New on Verdex" and the name, the planner card filling itself in and started, twelve weekly buys firing through different routes while the units pile up, three non-custodial lines, the fee line going to zero for VERDEX holders, and the end card. Render it with `node promo/render.mjs --page promo/autoinvest.html --out promo/verdex-autoinvest.mp4`.

The feature itself lives at `/auto-invest` (`src/pages/AutoInvestPage.tsx` on top of `src/lib/autoInvest.ts`): plans are stored on the device for the wallet that made them, each buy is priced through LI.FI, the pay token is approved once, the wallet confirms the swap, and the run is recorded with its transaction. Holding VERDEX on Robinhood Chain removes the Verdex fee (`VITE_VERDEX_FEE`, default 0.25%). `src/components/DueBuys.tsx` reminds the user when a buy is due. The planner shots in `shots/auto-*.png` come from the page.

## Vaults launch

`vaults.html` is a 40-second film for the feature: "New on Verdex" and the name, three strategy cards with the first one picked and the vault created, the vault card drifting off target while a meter climbs past the threshold and the reminder fires, the plan of three trades confirmed one by one while the bars glide back, three non-custodial lines, the fee line going to zero for VERDEX holders, and the end card. Render it with `node promo/render.mjs --page promo/vaults.html --out promo/verdex-vaults.mp4`.

The feature lives at `/vaults` (`src/pages/VaultsPage.tsx` on top of `src/lib/vaults.ts`): a vault is a set of target weights on one chain, stored on the device for the wallet that made it. Balances and prices are read live, drift is computed against the targets, and a vault is due when it passes its threshold or its date. Rebalancing plans sells of the overweight assets and buys of the underweight ones, prices each through LI.FI, approves once per token and confirms every trade in the wallet. `src/components/DueBuys.tsx` also reminds the user of due rebalances. The page shots in `shots/vaults-*.png` come from the preview build.

## Orders launch

`orders.html` is a 40-second film for the feature: "New on Verdex" and the name, the order form filling itself in (buy NVDA below $210, $500, USDG) and placed, a price chart drifting for a week until it crosses the level with the reminder firing, the triggered order card confirmed and filled through KyberSwap, four order-type tiles, three non-custodial lines, the fee line going to zero for holders, and the end card. Render with `node promo/render.mjs --page promo/orders.html --out promo/verdex-orders.mp4`.

The feature lives at `/orders` (`src/pages/OrdersPage.tsx` on top of `src/lib/orders.ts`): orders are stored on the device for the wallet that placed them, watched every 30 to 45 seconds while the app is open through the LI.FI price feed with the snapshot as fallback, marked triggered when the level is crossed, reminded through `DueBuys`, and filled with a LI.FI swap the wallet confirms. The page shots in `shots/orders-*.png` come from the preview build.

## Token page film

`launch.html` is a 34-second film for the Launchpad: the name, the stats strip (launches and graduations in 24 hours, the launch fee, the quote assets), the composer typing a token priced in NVDA, the curve filling and graduating, the creator fee accruing next to VERDEX's own sweeps, and the end card at `useverdex.xyz/launch`. Render with `node promo/render.mjs --page promo/launch.html --out promo/verdex-launch.mp4`. The hype still is `photos/hype-launch.png` (`teaser.html?bg=launch&line=Launch.&sub=…`).

`yield.html` is a 34-second film for Asset Yield: the name, the stats strip (Spark rate, Spark deposits, stock pools, the NVDA pool fee APR), the wallet table of what is idle, the stock composer with a band and an amount, the position turning from waiting to earning next to the Spark balance, and the end card at `useverdex.xyz/yield`. Render with `node promo/render.mjs --page promo/yield.html --out promo/verdex-yield.mp4`. The hype still is `photos/hype-yield.png` (`teaser.html?bg=yield&line=Idle%20is%20over.&sub=…`, the title now centred).

`private.html` is a 34-second film for Private Markets: the name, the stats strip (private companies, liquidity, 24h volume, holders), the table of seven companies rising row by row with the fee column, the Anthropic panel with everything the mint says and Trade opening Jupiter, the mint check catching a replaced OpenAI mint, and the end card at `useverdex.xyz/private-markets`. Render with `node promo/render.mjs --page promo/private.html --out promo/verdex-private.mp4`. The hype still is `photos/hype-private.png` (`teaser.html?bg=private&line=Holders%20see%20it%20first.&sub=…`), which names no feature so the drop stays a surprise until the gate opens. Company logos come from `public/logos/private/`.

`clips18.html` holds four 12-second clips for the days after the Private Markets drop (`?clip=fee`, `mintcheck`, `gone`, `thirteen`): the transfer fee read from each mint with the scheduled change, the mint check catching a replaced OpenAI mint, the two companies that left (SpaceX listed, xAI's conversion closed), and the roadmap at twelve of thirteen. Render each with `node promo/render.mjs --page "promo/clips18.html?clip=fee" --fps 30 --out promo/clip-fee.mp4`.

`clips20.html` is the ten-part series "How Verdex works", one 12-second clip per technology under the site (`?clip=browser`, `lifi`, `robinhood`, `uniswap`, `pons`, `spark`, `reserve`, `kamino`, `jupiter`, `simulate`), each numbered in the corner. Render each with `node promo/render.mjs --page "promo/clips20.html?clip=browser" --fps 30 --out promo/series-01-browser.mp4`. `render.mjs` also takes `--w` and `--h` for a different frame size.

`coingecko-listed.html` is the 26-second film for the CoinGecko listing (approved 2 October 2026): the name, the CoinGecko lockup with the approval and request id, what the page shows and where it comes from, the page's numbers counting up, and the end card at `coingecko.com/en/coins/verdex`. Render with `node promo/render.mjs --page promo/coingecko-listed.html --out promo/verdex-coingecko-listed.mp4`. The photo is `coingecko-listed-photo.html`, rendered to `photos/coingecko-listed.png`.

`autopilot.html` is a 34-second film for Auto-Invest without you: the name, the plan composer (NVDA, $100 every week, twelve buys, the exact allowance counting up), four weekly buys landing while the tab is closed, the four things the contract guarantees, and the end card at `useverdex.xyz/auto-invest/without-you`. Render with `node promo/render.mjs --page promo/autopilot.html --out promo/verdex-autopilot.mp4`. The hype still is `photos/hype-autopilot.png` (`teaser.html?bg=yield&line=Close%20the%20tab.&sub=Tonight%20at%2020%3A00%20UTC…`).

`pools.html` is a 34-second film for Verdex Pools: the name, the live stats strip, the pool table rising row by row, the composer typing one amount and getting the other, a position earning its first fees, and the end card at `useverdex.xyz/pools`. Render with `node promo/render.mjs --page promo/pools.html --out promo/verdex-pools.mp4`.

`holders.html` is a 34-second film for the holder perks: the claim, a quote whose Verdex fee flips to a struck-through zero when the wallet chip lands, the eight surfaces it covers, the early-access gate, the status panel filling in, and the end card at `useverdex.xyz/verdex`. Render with `node promo/render.mjs --page promo/holders.html --out promo/verdex-holders.mp4`.

`token.html` is a 36-second film for the $VERDEX page: the name, the live stats strip counting in, the creator-fees panel filling from the escrow's events, the dev wallet panel (held, burned, never sold) with its buys and burns, the four bounty tiers, and the end card at `useverdex.xyz/verdex`. Render with `node promo/render.mjs --page promo/token.html --out promo/verdex-token.mp4`. The figures in `NUM` are the day's readings; the page itself reads live.

The page lives at `/verdex` (`src/pages/TokenPage.tsx` on top of `src/lib/token.ts`): market data from DexScreener, the creator wallet from the hook's launch record, fees from the escrow's `Credited` events and the hook's `pendingCreatorTax`, the dev holding, buys and burns from the token's `Transfer` events, all read in the browser. `/?buy=VERDEX` preselects the token in the swap widget. The bounty tiers are in `SECURITY.md` and under Docs.

## Audit film

`audit.html` is a 38-second film for the site audit: the name and "We audited every line.", eight scope tiles ticking green, a runner card typing the tool results (npm audit, eslint, tsc, the route crawl), the six fixes, the two trade-offs kept on purpose, and the end card pointing at `useverdex.xyz/docs#audit` and `AUDIT.md`. Render with `node promo/render.mjs --page promo/audit.html --out promo/verdex-audit.mp4`. The teaser still is `photos/teaser-audit.png` (`teaser.html?bg=audit`).

## Agent launch

`agent.html` is a 40-second film for the feature: "New on Verdex" and the name, a sentence typed into the chat ("Buy $250 of NVDA if it drops 5%") with the tool lines, the proposal card and the reply, the card approved and saved to Orders, two more asks side by side (a weekly SPY plan and an AI vault) approved in turn, the three-step approval rail, the key setup with the Anthropic key typed in, three non-custodial lines, the fee line going to zero for holders, and the end card. Render with `node promo/render.mjs --page promo/agent.html --out promo/verdex-agent.mp4`.

The feature lives at `/agent` (`src/pages/AgentPage.tsx` on top of `src/lib/agent.ts`). The key is kept in localStorage and sent only to the chosen provider (Anthropic through `@anthropic-ai/sdk` in the browser, OpenAI through its chat completions endpoint); a rules-based helper covers the no-key case. The tools are `search_assets`, `get_price`, `get_holdings`, `list_activity`, `propose_order`, `propose_plan` and `propose_vault`; the three proposal tools emit cards, and approving a card writes to the same stores the Orders, Auto-Invest and Vaults pages use. The page shots in `shots/agent-*.png` come from the preview build with the built-in helper.

`teaser.html?line=…&sub=…` is a single still for a teaser tweet: the next feature's card and chart blurred past reading under a line and a time. Render with `node promo/render.mjs --page "promo/teaser.html?line=One%20more.&sub=In%205%20hours." --still 0 --dir promo/photos` and rename the still; `photos/teaser-5h.png` and `photos/teaser-0600.png` are the two variants for the Orders teaser.

`clips12.html?clip=<name>` holds the ten 12-second clips of the fifth tweet batch (`sentence`, `key`, `steps`, `holdings`, `stoploss`, `nokey`, `tools`, `level`, `fourtypes`, `cancel`): the first seven around Agent, the last three around Orders. Render each with `node promo/render.mjs --page "promo/clips12.html?clip=sentence" --fps 30 --out promo/clip-sentence.mp4`. `photos/photo3-*.png` are the five stills for the third set of photo tweets, four from the Agent film and one from the Orders film.

`clips17.html?clip=<name>` holds the ten 12-second clips of the tenth tweet batch, the parts of Verdex never announced (`automated`, `venues`, `backed`, `strategy`, `credit`, `categories`, `reminders`, `revoke`, `docs`, `offline`). Render each with `node promo/render.mjs --page "promo/clips17.html?clip=automated" --fps 30 --out promo/clip-automated.mp4`. `photos/photo6-*.png` are four page screenshots for the sixth set of photo tweets: automated baskets, private credit, discover, docs.

`clips16.html?clip=<name>` holds the ten 12-second clips of the ninth tweet batch, all around the Launchpad (`tonight` and `whatwould` are two teaser clips for the hours before the drop, `howto` and `firstwas` two for the days after; then `priced`, `onetx`, `locked`, `creatorfee`, `snipe`, `feed`, `nofee`, `pinned`, `factory`, `roadmap11`). Render each with `node promo/render.mjs --page "promo/clips16.html?clip=priced" --fps 30 --out promo/clip-priced.mp4`. `photos/photo5-*.png` are the four stills for the fifth set of photo tweets: the page's composer and three frames of the Launchpad film.

`clips15.html?clip=<name>` holds the ten clips of the eighth tweet batch (`yieldband`, `yieldcash`, `roadmap` 16 s, `reaudit` 18 s, `sold`, `stop`, `earnmenu`, `week`, `listings`, `nocontract`, 12 s otherwise): two on Asset Yield, the roadmap status, the October re-audit, the band mechanics, the week's recap and the listings. Render each with `node promo/render.mjs --page "promo/clips15.html?clip=yieldband" --fps 30 --out promo/clip-yieldband.mp4`. `photos/photo4-*.png` are the five stills for the fourth set of photo tweets: the re-audit teaser (`teaser.html?bg=audit&line=Re-audit.`), two frames of the Asset Yield film, the roadmap clip's last frame and the Earn menu.

`clips14.html?clip=<name>` holds the ten 12-second clips of the seventh tweet batch (`range`, `pairamount`, `position`, `pools130`, `holderfee`, `early`, `nothing`, `impermanent`, `coingecko`, `dead`): six on Verdex Pools, two on the holder perks, the CoinGecko application and the burn. Render each with `node promo/render.mjs --page "promo/clips14.html?clip=range" --fps 30 --out promo/clip-range.mp4`. The CoinGecko clip uses the official lockup from `brand/`.\n\n`clips13.html?clip=<name>` holds the ten 12-second clips of the sixth tweet batch, one per part of the product (`privateswap`, `gold`, `pools`, `multiply`, `portfolio`, `discover`, `route`, `opensource`, `receipt`, `audit`). Render each with `node promo/render.mjs --page "promo/clips13.html?clip=gold" --fps 30 --out promo/clip-gold.mp4`. Pool, multiply and basket figures come from the bundled snapshots.

## Strategies launch

`strategies.html` is a 38-second film for the feature: "New on Verdex" and the name, three strategy cards with the first one followed, the follower's vault beside the change log while a new version arrives, the update banner adopted and the targets shifting until the vault is due, three non-custodial lines, a vault shared as a link with the copy button pressed, the fee line going to zero for holders, and the end card. Render with `node promo/render.mjs --page promo/strategies.html --out promo/verdex-strategies.mp4`.

The feature lives at `/strategies` (`src/pages/StrategiesPage.tsx` on top of `src/lib/strategies.ts`) with the registry in `public/data/strategies.json`. Following creates a vault that remembers the version it adopted; `VaultsPage` shows the update banner and `DueBuys` reminds the user. Share links encode the weights in the URL. The page shots in `shots/strategies-*.png` come from the preview build.

`clips11.html?clip=<name>` holds the ten 12-second clips of the fourth tweet batch (`manager`, `note`, `delegation`, `link`, `pr`, `changelog`, `leave`, `two`, `registry`, `free`), rendered like the earlier batches at 30 fps. `photos/photo2-*.png` are the five stills for the second set of photo tweets.

## Open source film

`opensource.html` is a 32-second film for the day the repository goes public: "Verdex is" and the name, a terminal cloning the repository into a GitHub-style file list, a real excerpt of the Auto-Invest engine under "Non-custodial. Now you can check it.", eight tiles for what is inside, the repository card with the star pressed, and the end card with the GitHub address. Render it with `node promo/render.mjs --page promo/opensource.html --out promo/verdex-opensource.mp4`.

## Roadmap and showcase films

`roadmap.html` is a 40-second roadmap: two opening lines, the six things that are live thrown in as tiles, three cards each for Next and Then, the private-markets line with logos flying past, the VERDEX step and the end card, with a rail at the bottom that lights up each stop. Render with `node promo/render.mjs --page promo/roadmap.html --out promo/verdex-roadmap.mp4`.

`showcase.html?theme=markets|trade|invest` plays real footage of the site inside a floating browser window with one line of copy per clip. `showcase.mjs` records the footage (cursor only, no captions) against the preview build and extracts it to 30 fps frames under `showcase/<theme>/`. Start the preview, run `node promo/showcase.mjs`, then `node promo/render.mjs --page "promo/showcase.html?theme=markets" --fps 30 --out promo/verdex-showcase-markets.mp4` for each theme.

## Tweet clips, batch two

`clips8.html?clip=hours|schedule|token|chain|basket|lend|next|search` holds eight 12-second clips, one per tweet of the second batch in `tweets.md`: the clock that flips from 4:00 PM to 3:00 AM and the phone app, the weekly buys, VERDEX today and next, every version of NVDA in one row, 142 stocks collapsing into one basket token, lend or borrow, the three things coming, and the search bar typing NVDA, gold and AAPL. Render each with `node promo/render.mjs --page "promo/clips8.html?clip=hours" --fps 30 --out promo/clip-hours.mp4`. The phone and lend footage come from `phone/markets/` and `showcase/invest/lend/`.

## Tweet clips, batch three, and photo tweets

`clips10.html?clip=<name>` holds ten 12-second clips for the third batch of tweets: `vault` (weights drifting and snapping back), `drift` (a drift counter, the reminder, the card), `rebalance` (the three-trade plan confirmed one by one), `fund` ($1,000 splitting into eight buys by weight), `sixty40` (a 60/40 vault selling the equity run into Treasuries), `custody` (the wallet is the vault), `strategies` (six tiles, then a custom builder), `bridge` (USDC on Base to NVDA on Robinhood Chain, signed once), `treasuries` (SGOV, tokenized), `issuers` (eleven issuer logos collapsing into one row). Render each with `node promo/render.mjs --page "promo/clips10.html?clip=vault" --fps 30 --out promo/clip-vault.mp4`.

`photos/photo-*.png` are the five stills for the photo tweets: four frames of the Vaults film (`render.mjs --still`) and the page itself. The texts for all of them are in `tweets.md`.

