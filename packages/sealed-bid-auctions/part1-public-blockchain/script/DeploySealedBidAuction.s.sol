// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Script, console} from "forge-std/Script.sol";
import {SealedBidAuction} from "../src/step2/SealedBidAuction.sol";

/// @notice Deploys the finished auction. Phase lengths are short by default so a live audience can commit,
///         reveal and settle inside one session.
contract DeploySealedBidAuction is Script {
    function run() external returns (SealedBidAuction auction) {
        uint256 commitSeconds = vm.envOr("COMMIT_SECONDS", uint256(10 minutes));
        uint256 revealSeconds = vm.envOr("REVEAL_SECONDS", uint256(10 minutes));

        vm.startBroadcast();
        auction = new SealedBidAuction(commitSeconds, revealSeconds);
        vm.stopBroadcast();

        console.log("SealedBidAuction deployed at:", address(auction));
        console.log("Commit closes at:", auction.commitDeadline());
        console.log("Reveal closes at:", auction.revealDeadline());
        console.log("Deposit (wei):", auction.DEPOSIT());
    }
}
