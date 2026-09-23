import { resolve } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to the monorepo root (where bun.lock lives). Bun's isolated
  // installs symlink next & co. into ../../../node_modules/.bun, which Turbopack refuses
  // to compile if the root is this app's own folder.
  turbopack: { root: resolve(import.meta.dirname, "../../..") },
};

export default nextConfig;
