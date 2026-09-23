import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { cookieStorage, createStorage, http } from "wagmi";
import { avalancheFuji, foundry } from "wagmi/chains";

// Both chains are live at once. Users switch between Fuji and a local anvil node from the
// wallet's network picker (RainbowKit shows it); the app follows the connected chain and
// resolves the right contract address per chain (see lib/guestbook.ts).

// Curated wallet list: MetaMask + any injected (Core, etc.). Keeps the modal fast and
// uncluttered.
const wallets = [
  {
    groupName: "Recommended",
    wallets: [metaMaskWallet, injectedWallet],
  },
];

// Optional custom Fuji RPC (better rate limits than the public one under finale load).
const fujiRpcUrl = process.env.NEXT_PUBLIC_FUJI_RPC_URL;

// Local chain: viem's `foundry` (id 31337), shown as "Anvil" with the real Foundry logo.
// By default RainbowKit shows the Hardhat icon for 31337 since the id is shared; the white
// background is because the logo artwork is black.
const anvil = {
  ...foundry,
  name: "Anvil",
  iconUrl: "/foundry-logo.png",
  iconBackground: "#ffffff",
};

export const config = getDefaultConfig({
  appName: "Builders Brunch Guestbook",
  // RainbowKit requires a non-empty project id; unused here since no connector needs it.
  projectId: "DEMO_PROJECT_ID",
  wallets,
  chains: [avalancheFuji, anvil],
  transports: {
    [avalancheFuji.id]: http(fujiRpcUrl),
    [anvil.id]: http(), // anvil default: http://127.0.0.1:8545
  },
  // Persist connection state to cookies so it can be rehydrated on the server for reload
  // reconnection (see layout.tsx + providers.tsx).
  storage: createStorage({ storage: cookieStorage }),
  // Next.js App Router renders on the server first; this keeps wallet state hydration-safe.
  ssr: true,
});
