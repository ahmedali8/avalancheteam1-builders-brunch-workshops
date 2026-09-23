// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Script, console} from "forge-std/Script.sol";
import {Guestbook} from "../src/Guestbook.sol";

/// @notice Deploys {Guestbook} to whatever RPC is passed on the command line (Fuji, for the live demo).
/// @dev    The script is signer-agnostic: it never touches a private key. Foundry supplies the signer from the
///         command line, so you can deploy from an encrypted keystore, a hardware wallet, or interactively.
///
///         Recommended (encrypted keystore — no plaintext key on disk):
///           just wallet-import                 # paste a THROWAWAY key once, set a password
///           just deploy-fuji                   # simulate
///           just deploy-fuji-live              # broadcast
///           just verify-fuji <ADDRESS>         # verify on Snowtrace (separate step)
///
///         Alternatives: swap `--account fuji-demo` in the justfile for `--ledger` (hardware) or `--interactive`.
///         Fund the deployer from the faucet ahead of time: https://core.app/tools/testnet-faucet
contract Deploy is Script {
    function run() external returns (Guestbook book) {
        vm.startBroadcast();
        book = new Guestbook();
        vm.stopBroadcast();

        console.log("Guestbook deployed at:", address(book));
    }
}
