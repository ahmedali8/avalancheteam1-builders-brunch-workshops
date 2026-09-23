# Sealed-bid auction

Built live at Builders Brunch — a first-price sealed-bid auction in two steps, where the
second exists to fix what the first gets wrong.

Part 1 of 2. This half runs on Fuji, a public chain where anyone can read the bids.
Part 2 re-runs the same auction on a permissioned Avalanche L1 — which changes who is on
the network, and does **not** change the fact that everyone on it can read storage.

- `contracts/src/step1/NaiveAuction.sol` — the obvious version. Bids sit in a `private`
  mapping and are readable by anyone.
- `contracts/src/step2/SealedBidAuction.sol` — the version you'd ship. Commit-reveal,
  deposits that make silence expensive, commitments bound to the bidder, pull refunds.

Part of the workshops monorepo: `bun install` (from the repo root or any package folder)
installs deps for every workspace into the single root `bun.lock`.

```bash
cd contracts
bun install
just test          # 20 tests
just test-attacks  # just the attacks — they pass, meaning they work
```

The live attack, against a running auction:

```bash
just anvil                 # terminal 1
just deploy-naive-local    # terminal 2
just bid-local <auction> 3000000000000000000
just peek <auction> <bidder>     # <- reads the "sealed" bid out of storage
```

Run of show for the session: [`RUNSHEET.md`](./RUNSHEET.md).
