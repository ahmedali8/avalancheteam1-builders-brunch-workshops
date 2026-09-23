// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {Guestbook} from "../src/Guestbook.sol";

/// @notice A few focused tests: signing works and is owned, the feed reads back newest-first with pagination, and
///         bad input reverts. Not exhaustive — enough to say "it's tested" honestly before deploying live.
contract GuestbookTest is Test {
    Guestbook internal book;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    // Mirror of the contract event so `vm.expectEmit` can match it.
    event Signed(address indexed signer, string message, uint256 timestamp);

    function setUp() public {
        book = new Guestbook();
    }

    function test_SignStoresOwnedEntry() public {
        vm.prank(alice);
        book.sign("gm from alice");

        assertEq(book.total(), 1);

        Guestbook.Entry[] memory page = book.getEntries(0, 10);
        assertEq(page[0].signer, alice, "entry is owned by the signer");
        assertEq(page[0].message, "gm from alice");
        assertEq(page[0].timestamp, block.timestamp);
    }

    function test_SignEmitsSignedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit Signed(alice, "hello wall", block.timestamp);

        vm.prank(alice);
        book.sign("hello wall");
    }

    function test_FeedIsNewestFirst() public {
        vm.prank(alice);
        book.sign("first");
        vm.prank(bob);
        book.sign("second");

        Guestbook.Entry[] memory page = book.getEntries(0, 10);
        assertEq(page.length, 2);
        assertEq(page[0].message, "second", "newest entry comes first");
        assertEq(page[1].message, "first");
    }

    function test_GetEntriesPaginates() public {
        for (uint256 i = 0; i < 5; i++) {
            book.sign(vm.toString(i)); // messages "0".."4"
        }

        // Skip the newest 1, take 2 → entries "3" then "2".
        Guestbook.Entry[] memory page = book.getEntries(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].message, "3");
        assertEq(page[1].message, "2");
    }

    function test_GetEntriesOutOfRangeReturnsEmpty() public {
        book.sign("only one");
        assertEq(book.getEntries(5, 10).length, 0, "offset past the end yields an empty page");
    }

    function test_RevertOnEmptyMessage() public {
        vm.expectRevert(Guestbook.InvalidMessageLength.selector);
        book.sign("");
    }

    function test_RevertOnTooLongMessage() public {
        string memory tooLong = new string(book.MAX_MESSAGE_LENGTH() + 1);
        vm.expectRevert(Guestbook.InvalidMessageLength.selector);
        book.sign(tooLong);
    }
}
