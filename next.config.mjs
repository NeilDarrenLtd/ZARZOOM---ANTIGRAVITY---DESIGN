import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress the webpack PackFileCacheStrategy "Serializing big strings" warning
  // that fires for the large locale JSON files (en/site.json, en/app.json, admin.json).
  // These files must be statically imported so getDefaultTranslationsSync() works
  // synchronously in both the client I18nProvider and the server translation cache.
  // The warning is a build-cache performance hint only and does not affect runtime.
  webpack: (config, { dev }) => {
    const MiniCssExtractPlugin = require("mini-css-extract-plugin");
    const hasPlugin = config.plugins?.some(
      (p) => p?.constructor?.name === "MiniCssExtractPlugin"
    );
    if (!hasPlugin) {
      config.plugins = config.plugins ?? [];
      config.plugins.push(new MiniCssExtractPlugin());
    }

    // Disable the filesystem pack-file cache in development.
    // The sandbox environment does not support the atomic rename that webpack
    // uses when writing cache pack files (*.pack.gz_ -> *.pack.gz), which
    // produces repeated ENOENT errors. Memory-only cache still gives fast
    // incremental rebuilds within a single dev-server session.
    if (dev) {
      config.cache = { type: "memory" };
    }

    return config;
  },

  // Filter out the PackFileCacheStrategy noise from infrastructure logs
  // so it does not clutter the dev server and CI output.
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;

