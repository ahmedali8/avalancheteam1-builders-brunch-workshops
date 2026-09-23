"use client";

import { useQuery } from "@tanstack/react-query";
import {
  useChainId,
  useConfig,
  usePublicClient,
  useReadContract,
  useWatchContractEvent,
} from "wagmi";
import { guestbookAbi, guestbookAddress } from "@/lib/guestbook";

// How far back to scan for `Signed` logs when linking entries to their transactions. The
// public Fuji RPC rejects `eth_getLogs` ranges over 2048 blocks, so this is the ceiling.
const TX_LOOKBACK_BLOCKS = 2000n;

// The wall. Reads the newest 50 entries directly from the contract (a free view call) and
// re-reads whenever a `Signed` event fires — no indexer, per idea.md § Reading the feed.
export function Feed() {
  const chainId = useChainId();
  const address = guestbookAddress(chainId);
  const client = usePublicClient();
  const explorerUrl = useConfig().chains.find((c) => c.id === chainId)?.blockExplorers?.default.url;

  const {
    data: entries,
    error,
    refetch,
  } = useReadContract({
    address,
    abi: guestbookAbi,
    functionName: "getEntries",
    args: [BigInt(0), BigInt(50)],
    // The event watch below is the fast path; this poll is the fallback for when the RPC
    // drops the log filter, which would otherwise leave the wall stale forever.
    query: { enabled: !!address, refetchInterval: 3000 },
  });

  useWatchContractEvent({
    address,
    abi: guestbookAbi,
    eventName: "Signed",
    enabled: !!address,
    pollingInterval: 1000,
    onLogs: () => refetch(),
  });

  // `getEntries` can't return a transaction hash — a contract never sees its own. The hash
  // only exists on the `Signed` logs, so index them by entry to link each card. Entries
  // older than the lookback window simply render without a link.
  const { data: txByEntry } = useQuery({
    queryKey: ["signed-txs", chainId, address],
    enabled: !!address && !!client && !!explorerUrl,
    refetchInterval: 3000,
    queryFn: async () => {
      if (!client || !address) return new Map<string, string>();
      const tip = await client.getBlockNumber();
      const logs = await client.getContractEvents({
        address,
        abi: guestbookAbi,
        eventName: "Signed",
        fromBlock: tip > TX_LOOKBACK_BLOCKS ? tip - TX_LOOKBACK_BLOCKS : BigInt(0),
        toBlock: "latest",
      });
      return new Map(
        logs.flatMap(({ args, transactionHash }) =>
          args.signer &&
          args.message !== undefined &&
          args.timestamp !== undefined &&
          transactionHash
            ? [[entryKey(args.signer, args.message, args.timestamp), transactionHash] as const]
            : [],
        ),
      );
    },
  });

  // A failed read used to render as "No signatures yet", which hides an RPC problem behind
  // what looks like an empty wall. Say which chain and RPC it was, so it's debuggable.
  if (error) {
    return (
      <p className="py-8 text-center text-sm text-red">
        Couldn&apos;t read the wall on chain {chainId} at {address}: {error.message.split("\n")[0]}
      </p>
    );
  }

  if (!entries || entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No signatures yet. Be the first.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-rule">
      {entries.map((entry) => {
        const key = entryKey(entry.signer, entry.message, entry.timestamp);
        const txHash = txByEntry?.get(key);

        return (
          <li key={key} className="flex items-start gap-3 py-3">
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
                {txHash && explorerUrl && (
                  <>
                    <span>·</span>
                    <a
                      href={`${explorerUrl}/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-text"
                    >
                      {truncate(txHash)} ↗
                    </a>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Entries have no id on-chain, so identify one by its contents — the same tuple the
// `Signed` event carries, which is what lets the log index line up with the read.
function entryKey(signer: string, message: string, timestamp: bigint) {
  return `${signer}-${timestamp}-${message}`;
}

function truncate(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

// Deterministic colour chip from the signer address — gives each wallet a stable identity.
function colorFor(address: string) {
  const hue = Number.parseInt(address.slice(2, 8), 16) % 360;
  return `hsl(${hue} 55% 45%)`;
}

function formatTime(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleTimeString();
}
