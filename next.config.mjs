/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["unpdf"],
  webpack: (config) => {
    // Suppress serialization performance warning for large cached strings
    config.performance = {
      ...config.performance,
      hints: false,
    };
    return config;
  },
};

export default nextConfig;
