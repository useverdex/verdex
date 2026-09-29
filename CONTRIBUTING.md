# Contributing to Verdex

Thanks for helping. Verdex is a non-custodial front end for tokenized real-world assets, and every change
should keep it that way: the site never holds funds or keys, never signs anything on the user's behalf, and
every transaction is prepared in the open and confirmed in the user's own wallet.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint       # eslint
npm run typecheck  # tsc
npm run build      # production build into dist/
```

Node 22. Copy `.env.example` to `.env` if you want a LI.FI API key during development; without one the
public API works but rate-limits by IP, so quotes may be slow or fail under load.

## Where things live

- `src/pages` are the routes, `src/landing` the home page, `src/swap` the swap and bridge widget.
- `src/lib` holds the data hooks and engines: `api.ts` (snapshots and LI.FI), `lifi.ts` (quotes, RPC
  clients, execution helpers), `autoInvest.ts` (scheduled buys), `vaults.ts` (target allocations and
  rebalancing), `pwa.ts` (install and service worker).
- `src/theme` is the design system: tokens, the MUI theme, shared style objects.
- `public/api` and `public/data` are data snapshots that ship with the site so it renders without any
  third-party service. `public/img/logos` mirrors every logo the data references.
- `promo/` holds the launch material: film timelines rendered frame by frame with `promo/render.mjs`,
  recorders for real footage, tweet copy. See `promo/README.md`.

## Rules of the road

- No custody, no signatures on load, no `personal_sign` or typed-data signing. Wallet calls are
  `eth_accounts` to restore a session, `eth_requestAccounts` after a click, `eth_sendTransaction` for
  approvals and swaps, and the chain-switch methods.
- Anything that spends the user's money shows the amounts, the route and the fees before the wallet
  prompt, and records the transaction hash afterwards.
- Plans and vaults live in `localStorage` for the wallet that created them. Nothing about them is sent
  anywhere.
- Copy uses plain sentences, no em dashes, no exclamation marks. Numbers come from the data, not from
  the head.
- Keep `npm run lint`, `npm run typecheck` and `npm run build` green. The React Compiler lint rules are
  on: no state updates inside effects, no `Date.now()` in render (put it in an engine function).
- Logos, fonts and market data are third-party material; do not add any you do not have the rights to.

## Pull requests

1. Branch from `main`, keep the change focused, and describe what a user sees differently.
2. Add or update the relevant snapshot, docs section or FAQ entry when the change touches them.
3. Screenshots or a short clip help for anything visual; `promo/showcase.mjs` records the site if you
   want real footage.
4. CI runs lint, typecheck and build on every push.

## Reporting problems

Bugs and feature requests go in GitHub issues. Security issues go through the channels in
[SECURITY.md](SECURITY.md), not public issues.
