// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {Sender} from "../src/Sender.sol";
import {Receiver} from "../src/Receiver.sol";
import {ITeleporterMessenger, TeleporterMessageInput} from "../src/icm/ITeleporterMessenger.sol";

/// Stands in for the ICM Messenger: records what it was asked to send.
contract MockMessenger is ITeleporterMessenger {
    TeleporterMessageInput internal last;

    function sendCrossChainMessage(TeleporterMessageInput calldata input) external returns (bytes32) {
        last = input;
        return keccak256("message-1");
    }

    function lastInput() external view returns (TeleporterMessageInput memory) {
        return last;
    }
}

contract MessagingTest is Test {
    bytes32 constant CHAIN_A = keccak256("chainA");
    bytes32 constant CHAIN_B = keccak256("chainB");

    MockMessenger messenger;
    Sender sender;
    Receiver receiver;

    function setUp() public {
        messenger = new MockMessenger();
        sender = new Sender(messenger);
        receiver = new Receiver(address(messenger));
    }

    function test_SendAddressesTheMessenger() public {
        bytes32 id = sender.send(CHAIN_B, address(receiver), "gm");

        TeleporterMessageInput memory input = messenger.lastInput();
        assertEq(id, keccak256("message-1"));
        assertEq(input.destinationBlockchainID, CHAIN_B);
        assertEq(input.destinationAddress, address(receiver));
        assertEq(input.requiredGasLimit, sender.RECEIVE_GAS_LIMIT());
        assertEq(input.allowedRelayerAddresses.length, 0);
        assertEq(abi.decode(input.message, (string)), "gm");
    }

    function test_ReceiveStoresTheMessage() public {
        vm.prank(address(messenger));
        receiver.receiveTeleporterMessage(CHAIN_A, address(sender), abi.encode("gm"));

        assertEq(receiver.lastMessage(), "gm");
        assertEq(receiver.lastSourceBlockchainID(), CHAIN_A);
        assertEq(receiver.lastOriginSender(), address(sender));
        assertEq(receiver.received(), 1);
    }

    function test_ReceiveRejectsAnyoneButTheMessenger() public {
        vm.expectRevert(Receiver.OnlyMessenger.selector);
        receiver.receiveTeleporterMessage(CHAIN_A, address(sender), abi.encode("forged"));
    }
}
