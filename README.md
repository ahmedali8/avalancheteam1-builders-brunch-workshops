# Guestbook

A dead-simple on-chain guestbook, deployed live to the Avalanche **Fuji testnet** during
the talk. Anyone can `sign(message)`; the frontend shows the transaction reaching
**finality in under a second**.

```
guestbook/
├── contracts/     Foundry — Solidity 0.8.36, forge-std, bun-managed deps
└── app/           Next.js + wagmi + RainbowKit + viem + Tailwind + Biome
```

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

## 2. App → local + hosted

```bash
cd ../app
bun install
cp .env.local.example .env.local
# set NEXT_PUBLIC_GUESTBOOK_ADDRESS_FUJI to the deployed address

bun run dev                    # http://localhost:3000
```

Connect a wallet (Core / MetaMask), type a message, hit **Sign** — the finality timer
starts when the transaction is broadcast and freezes on the receipt (~0.8–2s on Fuji).

For the audience finale, deploy the app (e.g. Vercel) and put its URL behind the QR on the
last slide. The same `.env.local` values become the host's environment variables.

## Demo flow, on stage

1. `just test` → green.
2. `just deploy-fuji-live` → live deploy, one command.
3. Open the app, connect, sign → sub-second finality on screen; show the tx on
   [Snowtrace](https://testnet.snowtrace.io).
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
  plenty for a talk-sized wall.
- **No secrets in the repo.** The deployer key lives in foundry's encrypted keystore; `.env`
  and `.env.local` are git-ignored.
