// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {SealedBidAuction} from "../src/step2/SealedBidAuction.sol";

/// @notice Step 2 tests. The step 1 disclosure attack is dead here, and the two attacks a naive commit-reveal
///         would still allow — a silent winner, and a copied commitment — are restated as properties that hold.
contract SealedBidAuctionTest is Test {
    SealedBidAuction private auction;

    address private constant SELLER = address(0xACE);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant MALLORY = address(0xBAD);

    uint256 private constant COMMIT_SECONDS = 1 hours;
    uint256 private constant REVEAL_SECONDS = 1 hours;

    bytes32 private constant ALICE_SALT = keccak256("alice picked this at random");
    bytes32 private constant BOB_SALT = keccak256("bob picked this at random");

    /// @dev Cached in setUp. Reading `deposit` inline would be an external call, and a `vm.prank`
    ///      applies to the very next call — so an inline read silently eats the prank and the commit arrives
    ///      from the test contract instead of the bidder.
    uint256 private deposit;

    function setUp() public {
        vm.prank(SELLER);
        auction = new SealedBidAuction(COMMIT_SECONDS, REVEAL_SECONDS);

        deposit = auction.DEPOSIT();

        vm.deal(ALICE, 100 ether);
        vm.deal(BOB, 100 ether);
        vm.deal(MALLORY, 100 ether);
    }

    function _commitment(address bidder, uint256 amount, bytes32 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(bidder, amount, salt));
    }

    function _commit(address bidder, uint256 amount, bytes32 salt) private {
        vm.prank(bidder);
        auction.commit{value: deposit}(_commitment(bidder, amount, salt));
    }

    function _intoRevealPhase() private {
        vm.warp(auction.commitDeadline());
    }

    function _afterReveal() private {
        vm.warp(auction.revealDeadline());
    }

    // ---------------------------------------------------------------------
    // Happy path
    // ---------------------------------------------------------------------

    function test_HappyPath_WinnerPaysAndSellerIsCredited() public {
        _commit(ALICE, 3 ether, ALICE_SALT);
        _commit(BOB, 5 ether, BOB_SALT);

        _intoRevealPhase();

        vm.prank(ALICE);
        auction.reveal{value: 3 ether}(3 ether, ALICE_SALT);

        vm.prank(BOB);
        auction.reveal{value: 5 ether}(5 ether, BOB_SALT);

        _afterReveal();
        auction.finalise();

        assertEq(auction.highestBidder(), BOB);
        assertEq(auction.highestBid(), 5 ether);
        assertEq(auction.refunds(SELLER), 5 ether, "seller is owed the winning bid");

        // Alice gets her losing bid and her deposit back.
        assertEq(auction.refunds(ALICE), 3 ether + deposit);
        // Bob's bid is spent; only his deposit comes back.
        assertEq(auction.refunds(BOB), deposit);
    }

    function test_LosersAndSellerCanWithdraw() public {
        _commit(ALICE, 3 ether, ALICE_SALT);
        _commit(BOB, 5 ether, BOB_SALT);

        _intoRevealPhase();

        vm.prank(ALICE);
        auction.reveal{value: 3 ether}(3 ether, ALICE_SALT);
        vm.prank(BOB);
        auction.reveal{value: 5 ether}(5 ether, BOB_SALT);

        _afterReveal();
        auction.finalise();

        uint256 aliceBefore = ALICE.balance;
        vm.prank(ALICE);
        auction.withdraw();
        assertEq(ALICE.balance, aliceBefore + 3 ether + deposit);

        vm.prank(SELLER);
        auction.withdraw();
        assertEq(SELLER.balance, 5 ether);

        assertEq(address(auction).balance, deposit, "only Bob's unclaimed deposit is left");
    }

    function test_OutgoingLeaderIsRefunded() public {
        _commit(ALICE, 3 ether, ALICE_SALT);
        _commit(BOB, 5 ether, BOB_SALT);

        _intoRevealPhase();

        // Alice leads first, then is beaten.
        vm.prank(ALICE);
        auction.reveal{value: 3 ether}(3 ether, ALICE_SALT);
        assertEq(auction.highestBidder(), ALICE);

        vm.prank(BOB);
        auction.reveal{value: 5 ether}(5 ether, BOB_SALT);

        assertEq(auction.highestBidder(), BOB);
        assertEq(auction.refunds(ALICE), 3 ether + deposit, "the beaten leader gets her escrow back");
    }

    // ---------------------------------------------------------------------
    // Fix 1 — silence now costs money
    // ---------------------------------------------------------------------

    function test_Fixed_NonRevealerForfeitsDepositToSeller() public {
        _commit(ALICE, 3 ether, ALICE_SALT);
        _commit(BOB, 5 ether, BOB_SALT);

        _intoRevealPhase();

        vm.prank(ALICE);
        auction.reveal{value: 3 ether}(3 ether, ALICE_SALT);

        // Bob, holding the winning bid, stays silent.
        _afterReveal();

        auction.sweepDeposit(BOB);
        auction.finalise();

        assertEq(auction.refunds(BOB), 0, "his deposit is gone");
        assertEq(auction.refunds(SELLER), 3 ether + deposit, "and the seller keeps it");
    }

    function test_DepositCannotBeSweptTwice() public {
        _commit(BOB, 5 ether, BOB_SALT);
        _afterReveal();

        auction.sweepDeposit(BOB);

        vm.expectRevert(SealedBidAuction.NothingCommitted.selector);
        auction.sweepDeposit(BOB);
    }

    function test_CannotSweepSomeoneWhoRevealed() public {
        _commit(ALICE, 3 ether, ALICE_SALT);
        _intoRevealPhase();

        vm.prank(ALICE);
        auction.reveal{value: 3 ether}(3 ether, ALICE_SALT);

        _afterReveal();

        vm.expectRevert(SealedBidAuction.AlreadyRevealed.selector);
        auction.sweepDeposit(ALICE);
    }

    function test_CommitWithoutTheDepositReverts() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.WrongDeposit.selector, 0, deposit));
        auction.commit{value: 0}(_commitment(ALICE, 3 ether, ALICE_SALT));
    }

    // ---------------------------------------------------------------------
    // Fix 2 — the commitment is bound to the bidder
    // ---------------------------------------------------------------------

    /// @notice The step 2 replay, run again. Mallory can still copy the commitment, but revealing it means
    ///         hashing *her* address with Alice's inputs, which produces a different digest.
    function test_Fixed_StolenCommitmentIsWorthless() public {
        _commit(ALICE, 5 ether, ALICE_SALT);

        bytes32 stolen = auction.commitmentOf(ALICE);

        vm.prank(MALLORY);
        auction.commit{value: deposit}(stolen);

        _intoRevealPhase();

        vm.prank(ALICE);
        auction.reveal{value: 5 ether}(5 ether, ALICE_SALT);

        vm.prank(MALLORY);
        vm.expectRevert(SealedBidAuction.BadReveal.selector);
        auction.reveal{value: 5 ether}(5 ether, ALICE_SALT);

        // She also loses the deposit she staked on the stolen commitment.
        _afterReveal();
        auction.sweepDeposit(MALLORY);
        assertEq(auction.refunds(SELLER), deposit);
    }

    // ---------------------------------------------------------------------
    // Payment and phase discipline
    // ---------------------------------------------------------------------

    function test_RevealMustCarryTheBid() public {
        _commit(ALICE, 3 ether, ALICE_SALT);
        _intoRevealPhase();

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.WrongPayment.selector, 1 ether, 3 ether));
        auction.reveal{value: 1 ether}(3 ether, ALICE_SALT);
    }

    function test_CannotRevealBeforeCommitsClose() public {
        _commit(ALICE, 3 ether, ALICE_SALT);

        vm.prank(ALICE);
        vm.expectRevert(SealedBidAuction.NotInRevealPhase.selector);
        auction.reveal{value: 3 ether}(3 ether, ALICE_SALT);
    }

    function test_CannotRevealAfterTheDeadline() public {
        _commit(ALICE, 3 ether, ALICE_SALT);
        _afterReveal();

        vm.prank(ALICE);
        vm.expectRevert(SealedBidAuction.RevealPhaseOver.selector);
        auction.reveal{value: 3 ether}(3 ether, ALICE_SALT);
    }

    function test_CannotFinaliseTwice() public {
        _afterReveal();
        auction.finalise();

        vm.expectRevert(SealedBidAuction.AlreadyFinalised.selector);
        auction.finalise();
    }

    function test_CannotFinaliseEarly() public {
        vm.expectRevert(SealedBidAuction.StillRunning.selector);
        auction.finalise();
    }

    function test_CommitmentHelperMatchesTheContract() public view {
        assertEq(auction.commitmentFor(ALICE, 3 ether, ALICE_SALT), _commitment(ALICE, 3 ether, ALICE_SALT));
    }
}
