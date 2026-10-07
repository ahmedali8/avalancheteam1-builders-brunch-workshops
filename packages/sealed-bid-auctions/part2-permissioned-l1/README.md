# Sealed-bid auctions — Part 2: permissioned L1

Part 1 ended on a question: *the whole world can read the bids, so what if we ran this on our
own chain?* This part does exactly that. It launches a permissioned Avalanche L1 on your
machine, lets only invited bidders transact, and runs the part 1 contracts on it unchanged.

> **Public vs private is not about secrecy. It is about who is in the room.**

A permissioned L1 decides who joins, who deploys and who transacts. It does **not** encrypt
storage. Everyone in the room can still read every slot — and in a procurement auction, the
people in the room are your competitors. So the naive auction is still broken, and
commit-reveal still matters.

- `src/` — the part 1 contracts, byte-for-byte. Only the chain changes.
- `l1/genesis.json` — the L1: allowlists, fees, and who starts with funds.

Part of the workshops monorepo: `bun install` (from the repo root or any package folder)
installs deps for every workspace into the single root `bun.lock`.

```bash
bun install
just test          # the same 20 tests as part 1
```

Needs [avalanche-cli](https://build.avax.network/docs/tooling/avalanche-cli) (tested with
1.9.6, which runs Subnet-EVM v0.8.0) and `jq`.

## The chain

`l1/genesis.json` starts from the avalanche-cli defaults for a proof-of-authority L1 — those
carry the validator manager contracts — and changes these:

| Setting | Value | Why |
| --- | --- | --- |
| `chainId` | 1717 | Its own chain, not Fuji's. |
| `txAllowListConfig` | admin is admin; alice and bob are enabled | Only invited accounts can send a transaction. |
| `contractDeployerAllowListConfig` | admin is admin | Only the admin can deploy contracts. |
| `feeConfig` | `minBaseFee` 1 wei, block gas cost off | Bidders don't need a faucet. |
| `alloc` | 1000 BRUNCH each to admin, alice, bob and carol | Carol is funded but not invited: money alone does not get you in. |

The accounts are anvil's well-known keys, the same as part 1. Local only.

```bash
just l1-up      # create and boot the L1 — about a minute
just l1-rpc     # its RPC URL
just l1-stop    # pause, keeping state; `just l1-start` resumes in seconds
just l1-reset   # throw it away and start again from genesis
```

**Fees.** The base fee floor is 1 wei, but the node still suggests a 150 gwei tip, and wallets
take the suggestion. The recipes ask for a zero tip, so a bid costs about 90,000 wei — not
zero, but nothing anyone will notice. Fees are cheap here because the admin chose a genesis that
makes them cheap, not because transactions are free.

## Moment 1 — the room has a door

Deploy the part 1 naive auction, as the admin:

```bash
just deploy-naive
```

Nobody else can deploy:

```bash
just deploy-naive alice     # Transaction Failure — alice is not on the deployer allowlist
```

Carol has 1000 BRUNCH and still can't bid:

```bash
just roles carol
just bid <auction> 5ether carol
# cannot issue transaction from non-allow listed address: 0x90F7…b906
```

The admin lets her in, through the transaction allowlist precompile at `0x0200…0002`:

```bash
just allow carol
just bid <auction> 5ether carol     # succeeds
```

`just revoke carol` takes it away again.

## Moment 2 — the room is full of competitors

Alice bids. Bob is in the room too, so he reads her bid straight out of storage, exactly as in
part 1:

```bash
just bid <auction> 3ether alice
just peek <auction> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
# bid    : 3000000000000000000 wei  =  3.000000000000000000 BRUNCH
```

The allowlist stops strangers sending transactions. Reading storage is not a transaction.

## Commit-reveal still holds

Same contract, same flow as part 1, against the L1:

```bash
COMMIT_SECONDS=120 REVEAL_SECONDS=120 just deploy-sealed
just salt                                    # each bidder keeps their own
just commit <auction> $(just commit-hash alice 3000000000000000000 <salt>) alice
# … after the commit deadline
just reveal <auction> 3000000000000000000 <salt> alice
# … after the reveal deadline
just finalise <auction>
just withdraw <auction> admin                # the seller collects the winning bid
```

Before the reveal, `peek` on this contract finds a hash, not a bid.

### Gotcha: a quiet chain has an old clock

This L1 only makes a block when a transaction arrives. Commit, wait for the deadline, then
reveal, and the latest block is still the one with your commit in it — so `block.timestamp`
is still inside the commit phase. `cast send` estimates gas against that block, and the
reveal fails in estimation with `NotInRevealPhase`, though the deadline has clearly passed.

`reveal` and `finalise` pass a fixed `--gas-limit` to skip estimation. The transaction lands
in a new block stamped with the current time, and goes through. Part 1 never hit this:
`just anvil` mines a block every second whether or not anything happens.

## What the L1 bought, and what it didn't

| Bought | Did not buy |
| --- | --- |
| Who can transact and deploy, and who validates | Secrecy from anyone already inside |
| Fees the operator sets — no faucet | A reason to drop commit-reveal |
| A chain you can reset, upgrade, and configure | |

Hashing hides a bid until it is revealed. Hiding it for good takes encryption — a later
session.
