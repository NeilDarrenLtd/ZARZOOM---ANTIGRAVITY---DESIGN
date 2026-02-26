/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Optimize cache performance for large JSON imports (like translations)
    // Use file caching instead of pack caching for better serialization
    if (config.cache && typeof config.cache === 'object') {
      config.cache.type = 'filesystem';
      config.cache.cacheDirectory = '.next/cache';
      config.cache.buildDependencies = {
        config: [__filename],
      };
    }

    // Suppress serialization performance hints (large translation files trigger this)
    config.performance = {
      ...config.performance,
      hints: false,
    };

    return config;
  },
};

export default nextConfig;
