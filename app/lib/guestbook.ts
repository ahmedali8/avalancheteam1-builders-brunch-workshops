// The Guestbook contract: its per-chain addresses and ABI.
// `as const` lets wagmi/viem infer fully-typed reads, writes, and event args from the ABI.

import { avalancheFuji, foundry } from "wagmi/chains";

// Deployed address per chain, injected at build/run time. Empty until you deploy on that
// chain; the UI shows a "not configured" banner for whichever chain has no address.
const ADDRESSES: Record<number, string> = {
  [avalancheFuji.id]: process.env.NEXT_PUBLIC_GUESTBOOK_ADDRESS_FUJI ?? "",
  [foundry.id]: process.env.NEXT_PUBLIC_GUESTBOOK_ADDRESS_LOCAL ?? "",
};

/** Resolve the contract address for the connected chain, or undefined if none is set. */
export function guestbookAddress(chainId?: number): `0x${string}` | undefined {
  const address = (chainId && ADDRESSES[chainId]) || "";
  return /^0x[0-9a-fA-F]{40}$/.test(address) ? (address as `0x${string}`) : undefined;
}

export const guestbookAbi = [
  {
    type: "function",
    name: "MAX_MESSAGE_LENGTH",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEntries",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "page",
        type: "tuple[]",
        components: [
          { name: "signer", type: "address" },
          { name: "message", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sign",
    inputs: [{ name: "message", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "total",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Signed",
    inputs: [
      { name: "signer", type: "address", indexed: true },
      { name: "message", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  { type: "error", name: "InvalidMessageLength", inputs: [] },
] as const;

/** Max message length, mirrored from the contract so the form can validate before sending. */
export const MAX_MESSAGE_LENGTH = 280;

/**
 * Length of `message` the way the contract measures it: UTF-8 bytes, not JS string length.
 * `"🎉".length` is 2 but it costs 4 bytes on-chain, so counting characters would let an
 * emoji-heavy message pass the form and then revert with `InvalidMessageLength`.
 */
export function messageByteLength(message: string): number {
  return new TextEncoder().encode(message).length;
}
