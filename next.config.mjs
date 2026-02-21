/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Configure JSON handling for large translation files
    config.module.rules.push({
      test: /\.json$/,
      type: 'asset/resource',
      parser: {
        dataUrlCondition: {
          maxSize: 8 * 1024, // Only inline JSON files smaller than 8KB
        },
      },
    });

    // Optimize cache strategy for large strings
    config.cache = {
      type: 'filesystem',
      cacheDirectory: '.next/cache',
      buildDependencies: {
        config: [__filename],
      },
    };

    return config;
  },
};

export default nextConfig;
