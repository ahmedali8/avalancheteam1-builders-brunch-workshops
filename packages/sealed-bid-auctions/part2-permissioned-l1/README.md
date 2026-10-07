# Sealed-bid auctions — Part 2: permissioned L1

Part 1 built a sealed-bid auction on Fuji, broke it by reading every "private" bid straight out
of storage, then fixed it with commit-reveal. It ended on a question: *if the whole world can
read the bids, why not run the auction on our own chain?*

This part does exactly that. You launch a permissioned Avalanche L1 on your machine, decide who
may use it, and run the part 1 contracts on it — byte-for-byte, only the chain changes. Then you
find out what that bought you, and what it didn't.

> **Public vs private is not about secrecy. It is about who is in the room.**

## Before you start

You need [avalanche-cli](https://build.avax.network/docs/tooling/avalanche-cli) (tested with
1.9.6, which runs Subnet-EVM v0.8.0), Foundry, `just` and `jq`. Then, from this folder:

```bash
bun install        # installs deps for every workspace into the root bun.lock
just test          # the same 20 tests as part 1
```

There are four people in this story. They are anvil's well-known accounts — public keys, local
only, the same as part 1 — and you refer to each by name in every command:

| Name | Role |
| --- | --- |
| `admin` | Runs the chain. Decides who gets in. Deploys the auction and sells the asset. |
| `alice` | An invited bidder. |
| `bob` | Another invited bidder — and Alice's competitor. |
| `carol` | A bidder nobody invited. She has money, but no invitation. |

## 1. Build the room

The whole chain is described by one file, `l1/genesis.json`. It starts from avalanche-cli's
defaults for a proof-of-authority L1, which carry the validator manager contracts, and changes
four things:

- **Who may transact.** The transaction allowlist names `admin` as its admin and enables
  `alice` and `bob`. Nobody else can send a transaction.
- **Who may deploy.** The deployer allowlist names only `admin`.
- **Who starts with funds.** All four accounts get 1000 BRUNCH, the chain's own token —
  including `carol`, so it is clear that money alone does not get you in.
- **What a transaction costs.** The base fee floor is 1 wei and block gas cost is off, so
  nobody needs a faucet.

Both allowlists are *precompiles*: contracts at fixed addresses, built into the chain and
switched on in genesis. The chain ID is 1717.

Boot it:

```bash
just l1-up
```

That takes about a minute: it starts a local Avalanche network, creates the L1 on it and brings
up its validator. `just l1-rpc` prints its RPC URL; every other recipe finds it on its own.

## 2. Deploy the same contracts

The admin deploys the part 1 naive auction, untouched:

```bash
just deploy-naive
```

Note the address it prints — it is `<auction>` below. Now try deploying as Alice:

```bash
just deploy-naive alice     # Transaction Failure
just roles alice            # deploy : none
```

She is invited to bid, not to put her own contracts on the chain. That is the first thing your
own chain gives you that Fuji can't.

## 3. Carol at the door

Carol has 1000 BRUNCH. She tries to bid:

```bash
just roles carol
just bid <auction> 5ether carol
# cannot issue transaction from non-allow listed address: 0x90F7…b906
```

The node refuses the transaction before it ever reaches the auction. Balance doesn't matter;
the allowlist does. The admin can let her in, through the allowlist precompile at
`0x0200…0002`:

```bash
just allow carol
just bid <auction> 5ether carol     # succeeds
just revoke carol                   # and out again
```

So far, the permissioned chain is doing exactly what it promised.

## 4. Bob reads Alice's bid

Alice, who was invited, places her bid:

```bash
just bid <auction> 3ether alice
```

Bob is invited too. He runs the part 1 attack, unchanged:

```bash
just peek <auction> 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
# bid    : 3000000000000000000 wei  =  3.000000000000000000 BRUNCH
```

The allowlist stops strangers *sending transactions*. Reading storage is not a transaction, and
Bob is not a stranger. Your own chain decides who is in the room; it does not hide anything from
the people in it — and in an auction, the people in the room are exactly the people who must not
see your bid.

## 5. Commit-reveal still holds

So the part 1 fix carries over unchanged. Deploy the sealed auction with short phases:

```bash
COMMIT_SECONDS=120 REVEAL_SECONDS=120 just deploy-sealed
```

Each bidder makes a secret salt, builds a commitment locally — that computation never touches
the chain — and commits it with the 0.01 BRUNCH deposit:

```bash
just salt                                              # keep the output
just commit <auction> $(just commit-hash alice 3ether <salt>) alice
```

Bob tries `peek` again. Slot 0 of this contract holds commitments, so he finds a hash, not a bid.

Once the commit deadline passes, each bidder reveals the bid and pays it in. Once the reveal
deadline passes, anyone can close the auction, and everyone pulls what they are owed — losers
their bids, everyone their deposits, the admin the winning bid:

```bash
just reveal <auction> 3ether <salt> alice
just finalise <auction>
just withdraw <auction> alice
just withdraw <auction> admin
```

**Why `reveal` and `finalise` pass a fixed gas limit.** This L1 only makes a block when a
transaction arrives. After a quiet commit phase, the latest block is still the one with the last
commit in it, so its timestamp is still inside the commit phase. `cast send` estimates gas
against that block, and the reveal fails in estimation with `NotInRevealPhase` though the
deadline has clearly passed. A fixed gas limit skips estimation; the transaction lands in a new
block stamped with the current time. Part 1 never hit this, because `just anvil` mines a block
every second whether or not anything happens.

## 6. What the L1 bought, and what it didn't

Check what all of this cost the admin:

```bash
just roles admin     # balance : 999.9999999999996… BRUNCH
```

A bid costs about 90,000 wei. That's not free — every transaction still pays the 1 wei base fee
per unit of gas — but nobody needs a faucet. One catch: the node still *suggests* a 150 gwei tip,
and wallets take the suggestion. The recipes ask for no tip, which is why they pay almost
nothing.

| Your own chain bought | It did not buy |
| --- | --- |
| Who can transact, who can deploy, who validates | Secrecy from anyone already inside |
| Fees the operator chooses | A reason to drop commit-reveal |
| A chain you can reset, upgrade and configure | |

Hashing hides a bid until it is revealed. Hiding it for good takes encryption — a later session.

## Looking after the chain

```bash
just l1-stop     # pause it, keeping its state
just l1-start    # resume, in seconds
just l1-reset    # throw it away and boot a fresh one from genesis
```
