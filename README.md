# Verdex

The front door to tokenized markets. Verdex is a non-custodial marketplace for real-world assets:
tokenized stocks, ETFs, commodities, private credit and treasuries from every issuer, on every chain,
bought, sold, bridged, scheduled, held in vaults, lent and borrowed from the user's own wallet.

Live at [useverdex.xyz](https://useverdex.xyz). Token: VERDEX on Robinhood Chain,
`0x96f455a90a80dcf0c2df6703ea4ba3bedf286e43`. Updates on [@useverdex](https://x.com/useverdex).

## What it does

- **Markets.** Every tokenized stock, ETF, commodity, private-credit and treasury token Verdex knows
  about, grouped by underlying asset so NVDA from Ondo, xStocks, bStocks, Robinhood and Coinbase sit in
  one row with their chains and prices. Search, categories, issuers.
- **Swap and Bridge.** Live routes priced through the LI.FI aggregator across the DEXs, bridges and
  solvers it reaches. Any EVM chain in, any listed asset out, one signature. A private-swap mode sends
  the output to a different address.
- **Auto-Invest.** A recurring buy of any listed asset: amount, cadence, pay token. The first buy
  approves the pay token once; each buy after that is one confirmation on its day, priced live.
- **Vaults.** A target allocation across up to twelve assets on one chain, curated or custom. Balances
  and prices are read live, drift is computed against the targets, and when a vault passes its
  threshold or its date, Verdex plans the trades (sells of the overweight, buys of the underweight)
  and the wallet confirms them one by one.
- **Baskets, Pools, Lend and Borrow.** Reserve index baskets and automated baskets, tokenized-stock
  liquidity pools, and Kamino lending markets for tokenized assets.
- **Portfolio.** Everything the connected wallet holds across the listed chains.
- **App.** Installable as a home-screen app (PWA) with a tab bar, offline shell, and reminders when a
  scheduled buy or a rebalance is due.

Holding any amount of VERDEX removes the Verdex fee on Auto-Invest buys and vault rebalances, checked
onchain each time.

## Non-custodial by construction

Verdex never holds funds or keys. The site requests accounts only after the user clicks Connect, never
signs messages, and sends transactions only through the user's own wallet with `eth_sendTransaction`.
Plans and vaults are stored in the browser for the wallet that created them and are never uploaded.
See [SECURITY.md](SECURITY.md).

## Stack

- React 19, TypeScript, Vite 7
- MUI 7 (Emotion) for layout and theming, Motion for scroll reveals
- TanStack Query for data, viem for wallet transactions, EIP-6963 wallet discovery
- LI.FI API for quotes, token lists and chains, with bundled snapshots as fallback
- Geist and LT Remark web fonts

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint
npm run typecheck
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build
npm run build:preview  # relative base + hash routing, for static hosts without rewrites
```

Node 22. Copy `.env.example` to `.env` for the optional variables:

| Variable | Purpose |
| --- | --- |
| `VITE_LIFI_API_KEY` | Lifts the public LI.FI rate limit. Sent as `x-lifi-api-key` on every LI.FI request. |
| `VITE_VERDEX_FEE` | Verdex fee for non-holders on Auto-Invest and vault trades, as a fraction. Default `0.0025`. |

### Data and logos

Chains, tools and token lists come from LI.FI at runtime with snapshots in `public/api` as fallback.
Assets, baskets, pools and lending markets ship as snapshots in `public/api` and `public/data`. Every
remote logo the data references is mirrored in `public/img/logos` as 96px WebP and listed in
`src/data/logos.json`, so the site does not depend on third-party image hosts. The preview build packs
them into one JSON file (`scripts/pack-logos.mjs`).

### Promo material

`promo/` holds the launch films and tweet copy. Timelines are plain HTML pages that paint any second
on demand; `promo/render.mjs` renders them frame by frame with Playwright and encodes with ffmpeg.
`promo/showcase.mjs` and `promo/phone.mjs` record the real site, desktop and phone, with a mock wallet.
Details in [promo/README.md](promo/README.md).

## Layout

```
src/
  landing/     Hero, feature sections, token card, swap intro
  swap/        Swap widget and token picker (LI.FI quotes, viem execution)
  pages/       App routes: markets, issuers, baskets, discover, pools, lend, portfolio, auto-invest, vaults, docs
  components/  Nav, tab bar, footer, icons, motion helpers, wallet provider, install sheet, due reminders
  lib/         Data hooks, LI.FI client, Auto-Invest and Vaults engines, PWA helpers, image resolver
  theme/       Design tokens, MUI theme, shared style objects
  data/        Docs content, logo manifest
public/
  api/, data/  Data snapshots
  logos/, img/ Chain, tool, issuer and token artwork
  icons/       App icons; manifest.webmanifest and sw.js for the installable app
promo/         Films, clips, recorders, tweet copy
scripts/       Logo packing, app icons, public release
```

## Deploy

`railway.json` builds with Railpack (`npm run build`) and serves `dist` with the `index.html` fallback
that client-side routes need. Any static host works the same way: build, serve `dist`, rewrite unknown
paths to `index.html`.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first; it covers the
setup, the layout, and the rules that keep the site non-custodial. CI runs lint, typecheck and build.

## License

The source code is released under the [MIT License](LICENSE).

Third-party material is not covered by that license and stays under its owners' terms: the typefaces in
`src/fonts`, the chain, protocol, issuer and token artwork in `public/logos` and `public/img`, and the
market data snapshots in `public/api` and `public/data`. Replace them with assets you hold rights to
before shipping a fork commercially.
