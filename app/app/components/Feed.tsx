"use client";

import { useChainId, useReadContract, useWatchContractEvent } from "wagmi";
import { guestbookAbi, guestbookAddress } from "@/lib/guestbook";

// The wall. Reads the newest 50 entries directly from the contract (a free view call) and
// re-reads whenever a `Signed` event fires — no indexer, per idea.md § Reading the feed.
export function Feed() {
  const chainId = useChainId();
  const address = guestbookAddress(chainId);

  const { data: entries, refetch } = useReadContract({
    address,
    abi: guestbookAbi,
    functionName: "getEntries",
    args: [BigInt(0), BigInt(50)],
    query: { enabled: !!address },
  });

  useWatchContractEvent({
    address,
    abi: guestbookAbi,
    eventName: "Signed",
    enabled: !!address,
    onLogs: () => refetch(),
  });

  if (!entries || entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No signatures yet. Be the first.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-rule">
      {entries.map((entry) => (
        <li
          key={`${entry.signer}-${entry.timestamp}-${entry.message}`}
          className="flex items-start gap-3 py-3"
        >
          <span
            className="mt-1 h-6 w-6 shrink-0 rounded-md"
            style={{ backgroundColor: colorFor(entry.signer) }}
            aria-hidden
          />
          <div className="flex flex-col gap-0.5">
            <p className="font-sans text-text">{entry.message}</p>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="font-mono">{truncate(entry.signer)}</span>
              <span>·</span>
              <span>{formatTime(entry.timestamp)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Deterministic colour chip from the signer address — gives each wallet a stable identity.
function colorFor(address: string) {
  const hue = Number.parseInt(address.slice(2, 8), 16) % 360;
  return `hsl(${hue} 55% 45%)`;
}

function formatTime(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleTimeString();
}
