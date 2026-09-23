# Guestbook

A dead-simple on-chain guestbook, deployed live to the Avalanche **Fuji testnet** during
the talk. Anyone can `sign(message)`; the wall fills in live, each entry linking out to its
transaction on Snowtrace.

```
guestbook/
├── contracts/     Foundry — Solidity 0.8.36, forge-std, bun-managed deps
└── app/           Next.js + wagmi + RainbowKit + viem + Tailwind + Biome
```

Part of the workshops monorepo: `bun install` (from the repo root or any package folder)
installs deps for every workspace into the single root `bun.lock`.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- [Bun](https://bun.com/docs/installation) — `curl -fsSL https://bun.sh/install | bash`
- [just](https://just.systems/man/en/packages.html) — `brew install just` (task runner for the contracts)
- A throwaway wallet funded from the [Fuji faucet](https://core.app/tools/testnet-faucet)

macOS, in one go: `brew install just oven-sh/bun/bun && curl -L https://foundry.paradigm.xyz | bash && foundryup`

## 1. Contract → Fuji

```bash
cd contracts
bun install                    # forge-std, pinned from GitHub (not `forge install`)
just test                      # 7 tests, all green

# One-time: import a THROWAWAY key into an encrypted keystore (no plaintext on disk).
just wallet-import             # paste the key, set a password

cp .env.example .env           # set FUJI_RPC_URL + DEPLOYER_ADDRESS
just deploy-fuji-live          # deploys; prints "Guestbook deployed at: 0x…"
just verify-fuji 0xYourAddr    # verify on Snowtrace (separate step, needs no API key)
```

Copy the printed address — the app needs it. See [`contracts/README.md`](./contracts/README.md)
for the full command list.

## 2. App → local

```bash
cd ../app
bun install
cp .env.local.example .env.local
# set NEXT_PUBLIC_GUESTBOOK_ADDRESS_FUJI to the deployed address

bun run dev                    # http://localhost:3000
```

Connect a wallet (Core / MetaMask), type a message, hit **Sign** — the entry lands on the
wall once the receipt confirms (~0.8–2s on Fuji).

## Demo flow, on stage

1. `just test` → green.
2. `just deploy-fuji-live` → live deploy, one command.
3. Open the app, connect, sign → the entry appears on the wall in about a second; click its
   tx link through to [Snowtrace](https://testnet.snowtrace.io).
4. *(Optional finale)* QR → audience signs from their phones; the feed fills live.

## Fuji reference

| | |
|---|---|
| Chain ID | `43113` |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Explorer | https://testnet.snowtrace.io |
| Faucet | https://core.app/tools/testnet-faucet |

## Notes

- **No indexer.** The feed reads `getEntries` directly and watches the `Signed` event —
  plenty for a talk-sized wall. Tx links come from a 2000-block `Signed` log scan, since a
  contract can't return its own transaction hash; the public Fuji RPC caps `eth_getLogs` at
  2048 blocks, so entries older than that render without a link.
- **No secrets in the repo.** The deployer key lives in foundry's encrypted keystore; `.env`
  and `.env.local` are git-ignored.
