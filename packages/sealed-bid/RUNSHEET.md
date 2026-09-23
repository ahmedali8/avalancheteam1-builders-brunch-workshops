# Secrets on a Public Chain — run of show

**Builders Brunch · Part 1 of 2 · Wed 23 Sep 2026 · ~90 minutes · Intermediate**

Build a sealed-bid auction from an empty file, break it live, then fix it properly.

Part 2 re-runs the same auction on our own permissioned Avalanche L1. The thesis across
both sessions:

> **Public vs private is not about secrecy. It is about who is in the room.**

Say this early and come back to it at the close. It is what makes part 2 necessary
rather than a victory lap, and it is the honest position — a permissioned L1 restricts
who can join, validate, read the RPC and transact. It does **not** encrypt storage.
Anyone on the chain still reads every slot. Do not let part 2 be advertised as
"and then the bids are private", because they are not.

The arc is two contracts. The first is broken on stage with a command, not with a claim
on a slide; the second fixes it, and resists two further attacks that the obvious fix
would have let through.

| Step | Contract | What it teaches |
| --- | --- | --- |
| 1 | `src/step1/NaiveAuction.sol` | `private` is not secret. Storage is world-readable. |
| 2 | `src/step2/SealedBidAuction.sol` | Commit-reveal, deposits, sender-bound commitments, pull refunds. |

All 20 tests pass. `just test`.

---

## The real-world framing (use this, don't skip it)

Sealed-bid auctions are not a crypto invention. Scottish house sales run on them — you
submit one closed offer and never learn what anyone else bid. So do government tenders
and spectrum licences. The design exists to stop bidding wars and to stop the auctioneer
leaking your number to a rival.

That is the whole session: **the entire value of the mechanism is that the bids stay
secret until they're all in.** Step 1 fails at exactly that.

And it sets up the two-parter. The obvious reaction to "the whole world can read this"
is "fine, I'll run my own chain" — which is a real Avalanche answer, and is where part 2
goes. It is also only half an answer, for reasons the room will work out themselves once
you point out that the other bidders are on that chain too.

---

## Timings

### 0–10 · Cold open

Helicon activated on 22 Sep — the day before. Pull up the release notes and say what
changed: ACP-194 async C-Chain execution, ACP-273 minimum staking duration cut from two
weeks to 48 hours, ACP-267 uptime requirement to 90%.

> Verify it actually activated cleanly before opening with this.

Then the framing above. Ask the room: "if you were writing this, where would you put the
bids?" Someone will say a mapping. That's step 1, and they wrote it.

### 10–25 · Write step 1 live

Type `NaiveAuction` from empty. Roughly 40 lines: a `private` mapping, `submitBid`,
`winner()`. Say "private" out loud when you type it — you want it remembered.

```bash
just test --match-contract NaiveAuctionTest
```

Green. Make the point explicitly: **the tests pass and the contract is broken.** A green
suite says nothing about whether the design holds.

### 25–35 · Deploy and take bids

```bash
just anvil                  # terminal 1
just deploy-naive-local     # terminal 2
just bid-local <auction> 3000000000000000000
```

Take two or three bids from the room. Let them believe the bids are hidden.

### 35–45 · THE ATTACK

```bash
just peek <auction> <bidder>
```

Three lines of output: the storage slot, the raw word, the bid in plain ETH. Do it for
every bidder in the room, one after another, and put their numbers on screen.

Then land it:

> `private` stops *other contracts* reading this. It stops nobody else. Every value in
> every contract you have ever deployed is readable by anyone with an RPC endpoint.

Follow with the consequence — `test_Attack_MalloryReadsEveryBidAndWinsByOneWei`. The
attacker reads the board and wins by one wei, risking nothing.

### 45–85 · Write step 2 live

Build `SealedBidAuction` in three passes, pausing after each to say what would go wrong
without it. Each pause is the "why does this line exist" beat that the deleted third
contract used to carry — deliver it verbally, then prove it with the test.

**Pass 1 — commit-reveal.** `commit(bytes32)` then `reveal(amount, salt)`. Re-run
`just peek` against the new contract: storage holds a hash now, and the step 1 attack
dies on screen.

**Pass 2 — the deposit.** Ask the room: *what stops the highest bidder simply never
revealing?* Nothing, if committing is free — they hold a free option on the asset and
walk away for nothing. So `commit` takes a deposit, and `sweepDeposit` hands it to the
seller if they stay silent.

```bash
forge test --match-test test_Fixed_NonRevealerForfeitsDepositToSeller -vv
```

**Pass 3 — bind the commitment to the bidder.** Ask: *the commitment is public — what
stops me copying yours?* Nothing, if the hash only covers `(amount, salt)`. It is a
bearer token: copy it, wait for the victim to reveal the inputs in public calldata,
replay them. So the hash covers `msg.sender` too.

```bash
forge test --match-test test_Fixed_StolenCommitmentIsWorthless -vv
```

Then pull refunds, never push — and say why: one bidder with a reverting `receive()` can
wedge an auction that pushes.

One more worth thirty seconds, no test needed: a guessable salt makes the commitment
brute-forcible, because plausible bids are a small set. Hashing only hides a value whose
inputs are unguessable.

```bash
just test
```

20 passing. Then run it for real with the room:

```bash
just deploy-sealed-local
just salt                              # each bidder generates one, keeps it
just commit-hash <bidder> <amount> <salt>
cast send <auction> "commit(bytes32)" <hash> --value 0.01ether ...
```

Rehearsed and working — commit, reveal, finalise, withdraw all verified on anvil.

### 85–90 · Close — and set up part 2

Put the question to the room: *"what if we just ran this on our own chain instead?"*

That is exactly what Avalanche lets you do, and it is part 2 — we launch a permissioned
L1, allowlist the bidders, and run the same auction gasless. But land the honest catch
before they leave:

> Your own chain controls **who is in the room**. It does not make storage secret from
> the people who are in it — and in a procurement auction, the people in the room are
> your competitors. So commit-reveal survives. What changes is everything around it.

Then the longer arc: hashing hides a bid until you reveal it, encryption hides it
permanently. **eERC** is a later session.

---

## Prep checklist

- [ ] `bun install && just test` on the machine you'll present from
- [ ] Anvil running before you start, block time 1
- [ ] Font size up. `just peek` output must be readable from the back
- [ ] Git tags at each step so you can jump if you fall behind:
      `git tag step-1-done`, `step-2-done`, `step-3-done`
- [ ] Second terminal holding a pre-deployed auction at each step, as the fallback
- [ ] Confirm Helicon activated cleanly on 22 Sep

## If you fall behind

Collapse passes 2 and 3 — write the deposit and the sender-bound hash together, then run
both `test_Fixed_*` tests in one go. Saves about eight minutes.

Never drop the step 1 attack. It is the reason people came.

## Gotcha worth showing if someone asks about the tests

`vm.prank` applies to the very next call. Reading `auction.DEPOSIT()` inline between the
prank and the target silently eats it, and the transaction arrives from the test contract
instead of the bidder. It cost me twenty minutes writing these. See the comment on
`deposit` in `test/SealedBidAuction.t.sol`.
