// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {NaiveAuction} from "../src/step1/NaiveAuction.sol";

/// @notice Step 1 tests. The happy path passes and the auction is still completely broken — which is the point
///         worth making on stage: a green test suite says nothing about whether the design holds.
contract NaiveAuctionTest is Test {
    NaiveAuction private auction;

    address private constant SELLER = address(0xACE);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant MALLORY = address(0xBAD);

    uint256 private constant BIDDING_SECONDS = 1 hours;

    /// @dev `sealedBid` is the first declared storage variable, so its slot index is 0.
    uint256 private constant SEALED_BID_SLOT = 0;

    function setUp() public {
        vm.prank(SELLER);
        auction = new NaiveAuction(BIDDING_SECONDS);
    }

    /// @dev Where Solidity stores `sealedBid[bidder]`: keccak256(key . slotIndex).
    function _slotFor(address bidder) private pure returns (bytes32) {
        return keccak256(abi.encode(bidder, SEALED_BID_SLOT));
    }

    function test_HighestBidWins() public {
        vm.prank(ALICE);
        auction.submitBid(3 ether);

        vm.prank(BOB);
        auction.submitBid(5 ether);

        vm.warp(block.timestamp + BIDDING_SECONDS);

        (address who, uint256 amount) = auction.winner();
        assertEq(who, BOB);
        assertEq(amount, 5 ether);
    }

    function test_CannotBidTwice() public {
        vm.startPrank(ALICE);
        auction.submitBid(1 ether);
        vm.expectRevert(NaiveAuction.AlreadyBid.selector);
        auction.submitBid(2 ether);
        vm.stopPrank();
    }

    function test_CannotBidAfterClose() public {
        vm.warp(block.timestamp + BIDDING_SECONDS);
        vm.prank(ALICE);
        vm.expectRevert(NaiveAuction.BiddingClosed.selector);
        auction.submitBid(1 ether);
    }

    function test_WinnerIsHiddenUntilClose() public {
        vm.prank(ALICE);
        auction.submitBid(1 ether);

        vm.expectRevert(NaiveAuction.BiddingStillOpen.selector);
        auction.winner();
    }

    // ---------------------------------------------------------------------
    // THE ATTACK
    // ---------------------------------------------------------------------

    /// @notice `private` is a visibility keyword, not a secrecy guarantee. Every bid is world-readable while
    ///         bidding is still open.
    /// @dev    The live equivalent of `vm.load` is two shell commands:
    ///             cast index address <bidder> 0
    ///             cast storage <auction> <slot> --rpc-url fuji
    function test_Attack_SealedBidIsReadableFromStorage() public {
        vm.prank(ALICE);
        auction.submitBid(3.7 ether);

        uint256 leaked = uint256(vm.load(address(auction), _slotFor(ALICE)));

        assertEq(leaked, 3.7 ether, "the sealed bid was never sealed");
    }

    /// @notice The consequence: a late bidder reads everyone else's offer and wins by the smallest margin the
    ///         unit allows, paying almost nothing for the privilege.
    function test_Attack_MalloryReadsEveryBidAndWinsByOneWei() public {
        vm.prank(ALICE);
        auction.submitBid(3 ether);

        vm.prank(BOB);
        auction.submitBid(5 ether);

        // Mallory reads the board rather than guessing at it.
        uint256 best;
        address[2] memory rivals = [ALICE, BOB];
        for (uint256 i = 0; i < rivals.length; i++) {
            uint256 seen = uint256(vm.load(address(auction), _slotFor(rivals[i])));
            if (seen > best) best = seen;
        }
        assertEq(best, 5 ether, "Mallory should see Bob's leading bid");

        vm.prank(MALLORY);
        auction.submitBid(best + 1);

        vm.warp(block.timestamp + BIDDING_SECONDS);

        (address who, uint256 amount) = auction.winner();
        assertEq(who, MALLORY, "the attacker wins");
        assertEq(amount, 5 ether + 1, "by one wei, having risked nothing");
    }
}
