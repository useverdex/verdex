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

## Roadmap and showcase films

`roadmap.html` is a 40-second roadmap: two opening lines, the six things that are live thrown in as tiles, three cards each for Next and Then, the private-markets line with logos flying past, the VERDEX step and the end card, with a rail at the bottom that lights up each stop. Render with `node promo/render.mjs --page promo/roadmap.html --out promo/verdex-roadmap.mp4`.

`showcase.html?theme=markets|trade|invest` plays real footage of the site inside a floating browser window with one line of copy per clip. `showcase.mjs` records the footage (cursor only, no captions) against the preview build and extracts it to 30 fps frames under `showcase/<theme>/`. Start the preview, run `node promo/showcase.mjs`, then `node promo/render.mjs --page "promo/showcase.html?theme=markets" --fps 30 --out promo/verdex-showcase-markets.mp4` for each theme.

## Tweet clips, batch two

`clips8.html?clip=hours|schedule|token|chain|basket|lend|next|search` holds eight 12-second clips, one per tweet of the second batch in `tweets.md`: the clock that flips from 4:00 PM to 3:00 AM and the phone app, the weekly buys, VERDEX today and next, every version of NVDA in one row, 142 stocks collapsing into one basket token, lend or borrow, the three things coming, and the search bar typing NVDA, gold and AAPL. Render each with `node promo/render.mjs --page "promo/clips8.html?clip=hours" --fps 30 --out promo/clip-hours.mp4`. The phone and lend footage come from `phone/markets/` and `showcase/invest/lend/`.

## Tweet clips, batch three, and photo tweets

`clips10.html?clip=<name>` holds ten 12-second clips for the third batch of tweets: `vault` (weights drifting and snapping back), `drift` (a drift counter, the reminder, the card), `rebalance` (the three-trade plan confirmed one by one), `fund` ($1,000 splitting into eight buys by weight), `sixty40` (a 60/40 vault selling the equity run into Treasuries), `custody` (the wallet is the vault), `strategies` (six tiles, then a custom builder), `bridge` (USDC on Base to NVDA on Robinhood Chain, signed once), `treasuries` (SGOV, tokenized), `issuers` (eleven issuer logos collapsing into one row). Render each with `node promo/render.mjs --page "promo/clips10.html?clip=vault" --fps 30 --out promo/clip-vault.mp4`.

`photos/photo-*.png` are the five stills for the photo tweets: four frames of the Vaults film (`render.mjs --still`) and the page itself. The texts for all of them are in `tweets.md`.

