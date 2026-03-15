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

    config.cache = { type: "memory" };

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

