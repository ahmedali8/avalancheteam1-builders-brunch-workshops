# Sealed-bid auctions

A two-part Builders Brunch workshop: build a first-price sealed-bid auction, break it live, then fix it properly.

> **Public vs private is not about secrecy. It is about who is in the room.**

| Part | Folder | What it covers |
| --- | --- | --- |
| 1 | [`part1-public-blockchain`](./part1-public-blockchain) | On Fuji, where anyone can read the bids. A naive auction broken live, then commit-reveal. Includes the slides. |
| 2 | — | The same auction on a permissioned Avalanche L1. Coming later. |

```text
sealed-bid-auctions/
└── part1-public-blockchain/   Foundry — Solidity 0.8.36, forge-std, bun-managed deps
```

A permissioned L1 controls who can join, validate, read the RPC and transact. It does **not** encrypt storage:
everyone on the chain can still read every slot, so commit-reveal is still needed in part 2.
