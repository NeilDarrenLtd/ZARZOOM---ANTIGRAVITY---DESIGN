/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Suppress the "Serializing big strings" warning for the translations module.
    // We mark it as not cacheable so webpack doesn't try to serialise the 133KiB
    // string into its PackFile cache on every build.
    config.module.rules.push({
      test: /lib\/i18n\/en-translations\.ts$/,
      sideEffects: false,
    });
    return config;
  },
};

export default nextConfig;

