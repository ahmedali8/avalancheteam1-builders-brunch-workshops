# Two L1s, One Message

Boot two Avalanche L1s on your laptop and have one send the other a message over Avalanche
Interchain Messaging (ICM). First with the CLI alone, then with a Sender and Receiver contract of our own.

A standalone 30-minute session.

## What you need

- [Avalanche CLI](https://build.avax.network/docs/tooling/avalanche-cli) v1.9.7
- [Foundry](https://getfoundry.sh) v1.9.0 and [just](https://just.systems)
- `jq`, `curl`, `gpg`
- `bun install` at the repo root (pulls `forge-std`)

Tested on macOS (Apple Silicon). The justfile pins the rest:

| Component | Version | Why this one |
| --- | --- | --- |
| AvalancheGo | v1.14.2 | newest the macOS relayer and signature aggregator can talk to |
| Subnet-EVM | v1.14.2 | now released with AvalancheGo, so the versions match |
| ICM relayer | v1.7.4 | v1.7.5 rejects the config avalanche-cli writes; v1.8+ has no macOS build |
| Signature aggregator | v0.5.4 | v0.6+ has no macOS build and targets AvalancheGo v1.15 |
| ICM Messenger | v1.0.0 | the canonical version, at the same address on every chain |

Avalanche CLI has been in maintenance mode since December 2025. It still only knows the old standalone
Subnet-EVM repository, so `just vm` downloads Subnet-EVM from the AvalancheGo release, checks Ava Labs'
signature on it, and `l1-up` points both L1s at that binary.

## 1 · Boot two L1s

```bash
just l1-up      # about three minutes
```

This creates `chainA` (EVM chain ID 1001, token AAA) and `chainB` (1002, BBB), both with `--icm`, and
deploys them to one local network. On each deploy the CLI also:

- deploys the ICM Messenger and Registry to the L1 (and to the C-Chain, once);
- (re)starts a local ICM relayer that watches every L1 on the network, and funds it.

The Messenger lands at `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf` on every chain. It is deployed
from a pre-signed transaction (Nick's method), so its deployer, nonce and address match everywhere.

```bash
just l1-rpc     # each chain's RPC URL
just ids        # each chain's 32-byte blockchain ID, from the Warp precompile
just messenger  # the Messenger's code, at the same address on both chains
```

Blockchain IDs are minted at deploy time, so they change on every `just l1-reset`.

## 2 · A message, CLI only

```bash
just ping                                  # chainA → chainB
just ping chainB chainA "hello back"       # and the other way
just relayer-logs                          # watch the relayer pick it up and deliver it
```

`ping` wraps `avalanche interchain messenger sendMsg`. It needs `--genesis-key`, which the recipe passes.
Without that flag the CLI stops at an interactive key prompt.

## 3 · Our own contracts

[`src/Sender.sol`](./src/Sender.sol) lives on chain A and hands a string to the Messenger.
[`src/Receiver.sol`](./src/Receiver.sol) lives on chain B and stores the last message, but only
when the Messenger is the caller.

```bash
just test                   # unit tests against a mock Messenger
just deploy-receiver        # on chain B: note the address as R
just deploy-sender          # on chain A: note the address as S
just send $S $R "gm chain B"
just read $R                # about two seconds later
```

`read` shows the message, the source blockchain ID (chain A's) and the origin sender. That is the Sender
contract, not the account that called it.

### Try to forge a delivery

```bash
just forge-delivery $R
```

This calls `receiveTeleporterMessage` directly, claiming to come from chain A. It reverts with `OnlyMessenger`.
Only the Messenger hands over messages the chain has verified against chain A's validators,
so it is the only caller to trust.

The Receiver deliberately skips the next check: it accepts a message from *any* contract on *any* chain. Production
code should also check `sourceBlockchainID` and `originSenderAddress` against the chain and contract it expects.

## How it works

1. `Sender.send` calls `sendCrossChainMessage` on chain A's Messenger.
2. The Messenger emits a Warp message through the Warp precompile (`0x0200…0005`).
3. The relayer collects BLS signatures on it from chain A's validators and aggregates them into one.
4. The relayer submits the message and signature to chain B's Messenger, packed in the transaction's access
   list. Before the block runs, chain B checks that validators holding at least 67% of chain A's stake signed,
   using the BLS keys the P-Chain records for them.
   The Messenger then checks that the message came from a Messenger at its own address and was not
   already received.
5. The Messenger calls `Receiver.receiveTeleporterMessage`.

The relayer can delay a message or drop it. It can't change it or invent one, because it can't produce the
signature.

## Looking after the chains

```bash
just l1-stop     # pause, keeping state
just l1-start    # resume
just l1-reset    # throw both chains away and boot fresh ones
```

`src/icm/` holds a minimal copy of the two ICM interfaces this workshop uses. The full set lives in
[ava-labs/icm-services](https://github.com/ava-labs/icm-services/tree/main/icm-contracts).

Slides: [`builders-brunch-20261104.pdf`](./builders-brunch-20261104.pdf).
