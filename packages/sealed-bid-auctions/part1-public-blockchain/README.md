# Sealed-bid auctions — Part 1: public blockchain

Built live at Builders Brunch — a first-price sealed-bid auction in two steps, where the
second exists to fix what the first gets wrong.

Part 1 of 2. This half runs on Fuji, a public chain where anyone can read the bids.
Part 2 re-runs the same auction on a permissioned Avalanche L1 — which changes who is on
the network, and does **not** change the fact that everyone on it can read storage.

- `src/step1/NaiveAuction.sol` — the obvious version. Bids sit in a `private`
  mapping and are readable by anyone.
- `src/step2/SealedBidAuction.sol` — the version you'd ship. Commit-reveal,
  deposits that make silence expensive, commitments bound to the bidder, pull refunds.

Part of the workshops monorepo: `bun install` (from the repo root or any package folder)
installs deps for every workspace into the single root `bun.lock`.

```bash
bun install
just test          # 20 tests
just test-attacks  # just the attacks — they pass, meaning they work
```

## Step 1 — the naive auction

The tests pass and the contract is still broken:

```bash
forge test --match-contract NaiveAuctionTest -vv
```

The live attack, against a running auction:

```bash
just anvil                 # terminal 1
just deploy-naive-local    # terminal 2
just bid-local <auction> 3000000000000000000
just peek <auction> <bidder>     # <- reads the "sealed" bid out of storage
```

`peek` prints the storage slot, the raw word and the bid in ETH. `private` only stops other contracts reading a
value — anyone with an RPC endpoint can read it.

## Step 2 — commit-reveal

Each fix has a test that proves it:

```bash
# Deposit: a bidder who never reveals forfeits the deposit to the seller.
forge test --match-test test_Fixed_NonRevealerForfeitsDepositToSeller -vv

# Commitments cover msg.sender, so a copied commitment is worthless.
forge test --match-test test_Fixed_StolenCommitmentIsWorthless -vv
```

Run it against anvil:

```bash
just deploy-sealed-local
just salt                                  # each bidder generates one and keeps it
just commit-hash <bidder> <amount> <salt>  # computed locally, never sent on chain
cast send <auction> "commit(bytes32)" <hash> --value 0.01ether \
  --rpc-url http://127.0.0.1:8545 --private-key <bidder-key>
```

Use an unguessable salt: plausible bids are a small set, so a guessable salt makes the commitment brute-forcible.

## Gotcha in the tests

`vm.prank` applies to the very next call only. Reading `auction.DEPOSIT()` inline between the prank and the target
uses up the prank, so the transaction comes from the test contract instead of the bidder. See the comment on
`deposit` in `test/SealedBidAuction.t.sol`.

Slides: [`builders-brunch-20260923.pdf`](./builders-brunch-20260923.pdf).
