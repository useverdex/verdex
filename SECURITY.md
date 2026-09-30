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

## Bug bounty

Rewards are paid in ETH on Robinhood Chain, from the creator fees the VERDEX token earns, within a week
of the fix shipping. Report privately first, through one of the channels above, and give us reasonable
time to fix before publishing. One reward per issue, to the first clear report; duplicates and
findings from automated scanners with no working reproduction do not qualify.

| Tier | Reward | What qualifies |
| --- | --- | --- |
| Critical | 0.5 ETH | A way to make the site request a signature or send a transaction the user did not ask for, or to change what is sent: the recipient, the token, the amount, the approval target. |
| High | 0.2 ETH | A wrong route, amount, address or fee shown at confirmation time; a way to read another user's stored plans, orders, vaults or model key. |
| Medium | 0.05 ETH | A data leak, a broken safety check, or a reminder or automation that acts on the wrong data. |
| Low | Credit | Anything else that misleads a user. Credited in the fix and paid at our discretion. |

Third-party contracts and services are out of scope (below); report those to their own teams.

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
