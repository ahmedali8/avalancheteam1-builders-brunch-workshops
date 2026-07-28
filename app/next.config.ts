import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app so Next doesn't infer a parent dir from a stray
  // lockfile elsewhere on the machine.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
