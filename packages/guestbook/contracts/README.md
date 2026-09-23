# Guestbook contracts

The on-chain half of the live demo: a public wall anyone can sign. Every entry is permanent, publicly
readable, and owned by the wallet that wrote it — there is no admin function that can edit or wipe it.
Deployed to the **Avalanche Fuji** testnet.

- [`src/Guestbook.sol`](src/Guestbook.sol) — the contract (`sign`, `total`, `getEntries`, `Signed` event).
- [`test/Guestbook.t.sol`](test/Guestbook.t.sol) — Forge tests.
- [`script/Deploy.s.sol`](script/Deploy.s.sol) — deploy script. Signer-agnostic: it never touches a private key.

## Prerequisites

| Tool | Why | Install |
| --- | --- | --- |
| [Foundry](https://book.getfoundry.sh/getting-started/installation) | `forge` / `cast` — compile, test, deploy | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| [bun](https://bun.com/docs/installation) | installs the Solidity deps (`forge-std`) into `node_modules` | `curl -fsSL https://bun.sh/install \| bash` |
| [just](https://just.systems/man/en/packages.html) | task runner — every command below is a `just` recipe | `brew install just` |

macOS with Homebrew, all three at once:

```shell
brew install just oven-sh/bun/bun
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

Check them: `forge --version`, `bun --version`, `just --version`.

> Solidity deps are **bun-managed**, not `forge install`-managed. `foundry.toml` sets `libs = ["node_modules"]`
> and `remappings.txt` points `forge-std/` there. Run `bun install` — never `forge install`.

## Setup

```shell
bun install          # fetch forge-std into node_modules
cp .env.example .env # then fill it in (see below)
just build
just test
```

`.env` holds **no private key** — only public values:

| Variable | Meaning |
| --- | --- |
| `FUJI_RPC_URL` | Fuji C-Chain RPC. The default public endpoint works. |
| `DEPLOYER_ADDRESS` | Public address of the deployer wallet (the `--sender`). Fill in after `just wallet-import`. |

`.env` is git-ignored. The justfile loads it (`set dotenv-load`), so every recipe sees these values —
that is why there are no `package.json` scripts; `package.json` exists only to pin `forge-std`.

## Commands

```shell
just              # list all recipes
just build        # forge build
just test         # forge test -vvv
just fmt          # forge fmt
```

## Running locally on anvil

No faucet, no testnet — the whole path (deploy → app → sign) on a local node. Two terminals:

```shell
just anvil            # terminal 1: local node on http://127.0.0.1:8545, chain id 31337
just deploy-local     # terminal 2: deploys with anvil's well-known account #0
```

On a fresh anvil the address is deterministically `0x5FbDB2315678afecb367f032d93F642f64180aa3`.
Put it in the app's `.env.local` as `NEXT_PUBLIC_GUESTBOOK_ADDRESS_LOCAL`, then point your wallet
at Anvil (RPC `http://127.0.0.1:8545`, chain id `31337`) and import account #0.

`just anvil` uses `--block-time 1` so confirmations take ~1s like Fuji, instead of the few
milliseconds an instant-mining node would show.

Check the contract without the app:

```shell
just smoke-local 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

That signs once and reads the wall back — `total` should print `1`.

> The private key baked into these recipes is anvil's public, deterministic dev key. It only
> exists on local nodes. Never send it real funds.

## Deploying to Fuji

1. **Import a throwaway key** into an encrypted keystore. Use a wallet that holds nothing but testnet AVAX.

   ```shell
   just wallet-import   # paste the private key once, set a password
   ```

   It prints the address. Put that address in `.env` as `DEPLOYER_ADDRESS`.

2. **Fund it** from the faucet: <https://core.app/tools/testnet-faucet>

3. **Simulate**, then broadcast:

   ```shell
   just deploy-fuji                # dry run, no transaction sent
   just deploy-fuji-live           # deploy for real
   ```

   `deploy-fuji` forwards any extra flags to `forge script`.

4. **Verify** the printed address on the explorer:

   ```shell
   just verify-fuji 0xYourDeployedAddress
   ```

Verification is deliberately a *separate* step. Bundling `--verify` into the deploy means a
flaky explorer API fails the whole recipe with a non-zero exit — after the contract is already
on chain — which reads like the deploy broke when it didn't.

The script asks for the keystore password at run time; the key is never written to `.env` or to the repo.
Prefer a hardware wallet? Swap `--account fuji-demo` in the justfile for `--ledger`.

`just verify-fuji` submits to Routescan, which powers Snowtrace. It needs **no API key** — the
recipe sends the literal string `verifyContract`, which is what Routescan expects.

## Reference

- Foundry Book: <https://book.getfoundry.sh/>
- Fuji explorer: <https://testnet.snowtrace.io/>
- Chain ID: `43113`
