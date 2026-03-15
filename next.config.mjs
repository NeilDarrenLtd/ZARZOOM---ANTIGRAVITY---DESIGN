import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

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

    // Switch to memory-only cache to prevent the ENOENT atomic-rename error
    // (*.pack.gz_ -> *.pack.gz) that occurs when the sandbox filesystem wipes
    // .next/cache between restarts. We mutate the existing cache object rather
    // than replacing it so webpack retains all other properties (name, version,
    // buildDependencies, etc.) that Next.js set before invoking this callback.
    if (config.cache && typeof config.cache === "object") {
      config.cache.type = "memory";
    } else {
      config.cache = { type: "memory" };
    }

    return config;
  },

  experimental: {
    webpackBuildWorker: false,
  },

  // Suppress the "Caching failed for pack: ENOENT" warning that fires for the
  // client-development-fallback compiler. This compiler is internal to Next.js
  // and does not pass through the webpack() callback, so config.cache cannot
  // be overridden for it. Filtering it from infrastructure logs is the only
  // reliable way to silence it without switching to a different build tool.
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;

