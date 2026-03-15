import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);

// Pre-create all known webpack cache directories so the atomic rename
// (*.pack.gz_ -> *.pack.gz) never fails with ENOENT on first write.
// Next.js 15 creates the `client-development-fallback` compiler before
// the webpack callback runs, so the directory must exist beforehand.
const cacheBase = join(process.cwd(), ".next/cache/webpack");
for (const name of [
  "client-development",
  "client-development-fallback",
  "server-development",
]) {
  try {
    mkdirSync(join(cacheBase, name), { recursive: true });
  } catch {
    // Ignore — directory already exists or filesystem is read-only.
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    const MiniCssExtractPlugin = require("mini-css-extract-plugin");
    const hasPlugin = config.plugins?.some(
      (p) => p?.constructor?.name === "MiniCssExtractPlugin"
    );
    if (!hasPlugin) {
      config.plugins = config.plugins ?? [];
      config.plugins.push(new MiniCssExtractPlugin());
    }

    // Use memory-only cache for all compilers to avoid filesystem atomic-rename
    // failures (ENOENT: *.pack.gz_ -> *.pack.gz) in the sandbox environment.
    config.cache = { type: "memory" };

    return config;
  },

  experimental: {
    webpackBuildWorker: false,
  },
};

export default nextConfig;

