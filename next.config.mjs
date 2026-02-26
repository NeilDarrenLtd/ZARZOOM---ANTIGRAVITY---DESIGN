/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Tell webpack to handle locale JSON files as Buffer-backed asset/resource modules.
    // This is the exact remedy recommended by the PackFileCacheStrategy warning:
    // "Serializing big strings impacts deserialization performance
    //  (consider using Buffer instead and decode when needed)"
    config.module.rules.push({
      test: /\/locales\/[^/]+\.json$/,
      type: "asset/resource",
      generator: {
        filename: "static/locales/[name][ext]",
      },
    });

    return config;
  },
};

export default nextConfig;
