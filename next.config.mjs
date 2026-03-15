import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress the webpack PackFileCacheStrategy "Serializing big strings" warning
  // that fires for the large locale JSON files (en/site.json, en/app.json, admin.json).
  // These files must be statically imported so getDefaultTranslationsSync() works
  // synchronously in both the client I18nProvider and the server translation cache.
  // The warning is a build-cache performance hint only and does not affect runtime.
  webpack: (config) => {
    const MiniCssExtractPlugin = require("mini-css-extract-plugin");
    const hasPlugin = config.plugins?.some(
      (p) => p?.constructor?.name === "MiniCssExtractPlugin"
    );
    if (!hasPlugin) {
      config.plugins = config.plugins ?? [];
      config.plugins.push(new MiniCssExtractPlugin());
    }

    // Raise the threshold at which webpack warns about large serialized strings
    // in the pack-file cache. Default is 128 KiB; raising to 512 KiB covers
    // all current locale files without hiding genuinely oversized assets.
    if (config.cache && typeof config.cache === "object") {
      config.cache.maxMemoryGenerations = 1;
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

