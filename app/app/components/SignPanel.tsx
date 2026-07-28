"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  guestbookAbi,
  guestbookAddress,
  MAX_MESSAGE_LENGTH,
  messageByteLength,
} from "@/lib/guestbook";

// Phases of one signature. The finality timer only runs during "confirming" — it starts
// when the transaction is broadcast (we have a hash), NOT when the button is clicked, so
// it measures the chain's time-to-finality, not how long you took to approve in the wallet.
type Phase = "idle" | "signing" | "confirming" | "final";

export function SignPanel() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const address = guestbookAddress(chainId);
  const { writeContractAsync } = useWriteContract();

  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hash, setHash] = useState<`0x${string}`>();
  const [error, setError] = useState<string>();
  const startRef = useRef<number>(0);

  const { data: receipt } = useWaitForTransactionReceipt({ hash });

  // Freeze the timer the moment the receipt lands — this is the finality number.
  useEffect(() => {
    if (receipt && phase === "confirming") {
      setElapsedMs(performance.now() - startRef.current);
      setPhase("final");
    }
  }, [receipt, phase]);

  // Tick the timer up while we wait for the receipt.
  useEffect(() => {
    if (phase !== "confirming") return;
    let raf = 0;
    const tick = () => {
      setElapsedMs(performance.now() - startRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

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
      startRef.current = performance.now(); // start timing at broadcast
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
    setElapsedMs(0);
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

  const seconds = (elapsedMs / 1000).toFixed(2);
  const messageBytes = messageByteLength(message);
  const tooLong = messageBytes > MAX_MESSAGE_LENGTH;
  const canSign =
    isConnected && !!address && message.trim().length > 0 && !tooLong && phase === "idle";

  if (!address) return null;

  const timerColor =
    phase === "final" ? "text-good" : phase === "confirming" ? "text-text" : "text-muted/40";

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      {/* The finality timer — the hero. Always a live number; colour tells the state. */}
      <div className="flex items-end justify-between gap-4 border-b border-rule px-6 py-5">
        <div className="flex flex-col gap-2">
          <span className="text-[0.7rem] uppercase tracking-[0.28em] text-muted">
            Time to finality
          </span>
          <div className="flex items-end gap-1">
            <span
              className={`font-mono text-6xl leading-none tabular-nums transition-colors ${timerColor}`}
            >
              {seconds}
            </span>
            <span className={`mb-1 font-mono text-2xl transition-colors ${timerColor}`}>s</span>
          </div>
        </div>
        <div className="mb-1 flex items-center gap-2 text-sm">
          {phase === "confirming" && (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-red" />
              <span className="text-muted">confirming</span>
            </>
          )}
          {phase === "final" && <span className="font-medium text-good">✓ final</span>}
        </div>
      </div>

      {/* Input + action. */}
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
                {phase === "signing"
                  ? "Approve in wallet…"
                  : phase === "confirming"
                    ? "Confirming…"
                    : "Sign"}
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
