# Security

Verdex is a static, non-custodial front end. It holds no funds, no keys and no user accounts, and every
transaction is built client-side and confirmed in the user's own wallet. Even so, a front end can be
made to prepare a bad transaction, show a wrong number, or load something it should not, so we want to
hear about anything of that kind.

## Reporting

Please do not open a public issue for a vulnerability. Use one of these instead:

- GitHub's private vulnerability reporting on this repository, if it is enabled.
- Email `feedback@verdex.app`.
- A direct message to [@useverdex](https://x.com/useverdex).

Include what you found, how to reproduce it, and what a user would lose if it were exploited. We reply
within a few days and will credit you in the fix if you want that.

## Scope

In scope: this repository, the site built from it, the service worker, the data snapshots, and anything
that could make the site request a signature, send a transaction, or show a route the user did not ask
for.

Out of scope: the third-party protocols the site routes through (LI.FI and the DEXs and bridges it
aggregates, Kamino, Reserve), the wallets, the chains, and the issuers of the tokenized assets. Report
those to their own teams.

## What the site never does

- Request a wallet connection or a signature on page load.
- Call `personal_sign`, `eth_sign` or typed-data signing.
- Ask for seed phrases or private keys.
- Send funds anywhere except inside a transaction the user confirmed in their wallet.
