# Team1 Builders Brunch — Workshops

Monorepo for the Builders Brunch workshop demos, managed as a
[Bun workspace](https://bun.com/docs/install/workspaces). Each workshop lives in its own
folder under `packages/`, with its own README.

## Packages

| # | Folder | What it is |
| --- | --- | --- |
| 1 | [`packages/guestbook`](./packages/guestbook) | On-chain guestbook on Avalanche Fuji — Foundry contract + Next.js app. |
| 2 | [`packages/sealed-bid-auctions`](./packages/sealed-bid-auctions) | Sealed-bid auction built in two steps: a naive auction broken live, then commit-reveal — Foundry contracts. |

```text
packages/
├── guestbook/
└── sealed-bid-auctions/
```

## Getting started

```bash
bun install        # one install at the root covers every workshop (single bun.lock)
```

Then follow the README of the workshop you want to run.

## Adding a workshop

1. Create `packages/<workshop>/<package>/` — every folder matching `packages/*/*` with a
   `package.json` is picked up as a workspace.
2. Give each `package.json` a unique, workshop-prefixed `name` (e.g. `guestbook-app`).
3. Run `bun install` at the root and commit the updated `bun.lock`.
4. Add a row to the table above.
