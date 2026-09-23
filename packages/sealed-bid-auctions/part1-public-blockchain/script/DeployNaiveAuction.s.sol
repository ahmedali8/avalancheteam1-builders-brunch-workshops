// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Script, console} from "forge-std/Script.sol";
import {NaiveAuction} from "../src/step1/NaiveAuction.sol";

/// @notice Deploys the deliberately broken step 1 auction, so the storage-reading attack can be run against a
///         real chain rather than a test harness.
contract DeployNaiveAuction is Script {
    function run() external returns (NaiveAuction auction) {
        uint256 biddingSeconds = vm.envOr("BIDDING_SECONDS", uint256(30 minutes));

        vm.startBroadcast();
        auction = new NaiveAuction(biddingSeconds);
        vm.stopBroadcast();

        console.log("NaiveAuction deployed at:", address(auction));
        console.log("Bidding closes at:", auction.closesAt());
    }
}
