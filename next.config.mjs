/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Suppress the non-critical "Serializing big strings" warning from webpack's cache strategy.
    // This warning appears when building with large JSON imports (like translation files)
    // but does not affect functionality or performance. The JSON is parsed correctly.
    const originalWarn = console.warn;
    console.warn = function(...args) {
      const message = args[0]?.toString?.() || '';
      if (message.includes('Serializing big strings')) {
        return;
      }
      originalWarn.apply(console, args);
    };
    return config;
  },
};

export default nextConfig;

