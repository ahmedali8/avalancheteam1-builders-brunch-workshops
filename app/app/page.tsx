"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useChainId, useReadContract } from "wagmi";
import { guestbookAbi, guestbookAddress } from "@/lib/guestbook";
import { Feed } from "./components/Feed";
import { SignPanel } from "./components/SignPanel";

export default function Home() {
  const chainId = useChainId();
  const address = guestbookAddress(chainId);

  const { data: total } = useReadContract({
    address,
    abi: guestbookAbi,
    functionName: "total",
    query: { enabled: !!address },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Builders Brunch</p>
          <h1 className="mt-1 font-display text-4xl font-bold leading-none">
            Sign the <span className="text-red">wall</span>.
          </h1>
        </div>
        <div className="shrink-0">
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>
      </header>

      <SignPanel />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between border-b border-rule pb-2">
          <h2 className="font-display text-lg">The wall</h2>
          <span className="font-mono text-sm text-muted">
            {address && total !== undefined ? `${total.toString()} signatures` : ""}
          </span>
        </div>
        <Feed />
      </section>
    </main>
  );
}
