"use client";

import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { cookieToInitialState, WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

// Client-side providers: wagmi (chain/wallet state) → react-query (async cache) →
// RainbowKit (connect UI), themed to match the deck's dark palette and accent red.
// `cookie` comes from the server layout; deriving initialState from it (same string on
// server and client) rehydrates the wallet connection on reload without a mismatch.
export function Providers({ children, cookie }: { children: ReactNode; cookie: string | null }) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(config, cookie);

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#E6212F",
            accentColorForeground: "#ffffff",
            borderRadius: "small",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
