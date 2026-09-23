"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { guestbookAbi, guestbookAddress, MAX_MESSAGE_LENGTH, messageByteLength } from "@/lib/guestbook";

// Phases of one signature: approving in the wallet, waiting for the receipt, then done.
type Phase = "idle" | "signing" | "confirming" | "final";

export function SignPanel() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const address = guestbookAddress(chainId);
  const { writeContractAsync } = useWriteContract();

  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [error, setError] = useState<string>();

  // Poll fast and skip viem's replacement check. The default 4s poll plus the
  // `checkReplacement` retry ladder (getTransaction backs off ~12.6s while blocking the
  // block watcher) leaves the panel stuck on "Confirming…" long after the chain is done.
  const { data: receipt } = useWaitForTransactionReceipt({
    hash,
    pollingInterval: 250,
    checkReplacement: false,
  });

  useEffect(() => {
    if (receipt && phase === "confirming") setPhase("final");
  }, [receipt, phase]);

  async function onSign() {
    if (!address) return;
    setError(undefined);
    setPhase("signing");
    try {
      const txHash = await writeContractAsync({
        address,
        abi: guestbookAbi,
        functionName: "sign",
        args: [message],
        chainId,
      });
      setHash(txHash);
      setPhase("confirming");
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : "Transaction rejected");
      setPhase("idle");
    }
  }

  function reset() {
    setMessage("");
    setHash(undefined);
    setPhase("idle");
  }

  // No address for the connected chain — log it for devs instead of showing a banner.
  useEffect(() => {
    if (!address) {
      console.warn(
        `[Guestbook] No contract address for chain ${chainId}. Set NEXT_PUBLIC_GUESTBOOK_ADDRESS_FUJI or NEXT_PUBLIC_GUESTBOOK_ADDRESS_LOCAL in .env.local, or switch networks.`,
      );
    }
  }, [address, chainId]);

  const messageBytes = messageByteLength(message);
  const tooLong = messageBytes > MAX_MESSAGE_LENGTH;
  const canSign = isConnected && !!address && message.trim().length > 0 && !tooLong && phase === "idle";

  if (!address) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="px-6 py-5">
        {phase === "final" ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-text-2">Recorded on-chain. Yours — nobody can edit it.</p>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 rounded-md border border-line px-4 py-2 text-sm text-text-2 transition-colors hover:border-muted hover:text-text"
            >
              Sign again
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="gm from the Builders Brunch"
              rows={2}
              disabled={phase !== "idle"}
              className="w-full resize-none rounded-md border border-line bg-ground p-3 font-sans text-text placeholder:text-muted focus:border-red focus:outline-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-4">
              <span className={`font-mono text-xs ${tooLong ? "text-red" : "text-muted"}`}>
                {messageBytes}/{MAX_MESSAGE_LENGTH}
              </span>
              <button
                type="button"
                onClick={onSign}
                disabled={!canSign}
                className="rounded-md bg-red px-7 py-2 font-display text-base text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-chip disabled:text-muted"
              >
                {phase === "signing" ? "Approve in wallet…" : phase === "confirming" ? "Confirming…" : "Sign"}
              </button>
            </div>
            {!isConnected && <p className="text-xs text-muted">Connect a wallet to sign.</p>}
            {error && <p className="text-xs text-red">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
