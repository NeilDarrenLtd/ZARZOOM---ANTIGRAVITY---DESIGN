/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Treat locale JSON files as static assets to avoid serializing large strings
    // in webpack's cache, which causes performance warnings. The i18n system will
    // still have access to the content via the imported asset path.
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
