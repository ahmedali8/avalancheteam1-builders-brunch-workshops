# Sealed-bid auctions

A two-part Builders Brunch workshop: build a first-price sealed-bid auction, break it live, then fix it properly.

> **Public vs private is not about secrecy. It is about who is in the room.**

| Part | Folder | What it covers |
| --- | --- | --- |
| 1 | [`part1-public-blockchain`](./part1-public-blockchain) | On Fuji, where anyone can read the bids. A naive auction broken live, then commit-reveal. Includes the slides. |
| 2 | [`part2-permissioned-l1`](./part2-permissioned-l1) | The same contracts on a permissioned Avalanche L1 running locally. The allowlist keeps strangers out; the bidders inside still read each other's bids. |

```text
sealed-bid-auctions/
├── part1-public-blockchain/   Foundry — Solidity 0.8.36, forge-std, bun-managed deps
└── part2-permissioned-l1/     Same, plus avalanche-cli for the local L1
```
