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

    // Use memory-only cache. The sandbox filesystem does not support the
    // atomic rename webpack uses to commit pack files (*.pack.gz_ -> *.pack.gz),
    // which produces repeated ENOENT errors for every compiler instance.
    config.cache = { type: "memory" };

    return config;
  },

  experimental: {
    // Disable the webpack build worker so all compilers — including the
    // internal `client-development-fallback` compiler — run in the same
    // process and pick up the memory-cache override set in the webpack
    // callback above, rather than spawning a separate worker with its
    // own default filesystem cache.
    webpackBuildWorker: false,
  },
};

export default nextConfig;

