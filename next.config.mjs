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

    // Locale JSON files exceed 128kiB, which causes webpack's PackFileCacheStrategy
    // to warn about serializing big strings. Enabling gzip compression on the
    // persistent cache stores large entries as compressed Buffers instead of raw
    // strings, eliminating the warning without changing module resolution.
    if (config.cache && typeof config.cache === "object") {
      config.cache.compression = "gzip";
    }

    return config;
  },
};

export default nextConfig;

