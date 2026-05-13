/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@schoolos/ui", "@schoolos/db", "@schoolos/auth", "@schoolos/types", "@schoolos/utils"],
  images: {
    domains: ["avatars.githubusercontent.com", "lh3.googleusercontent.com"],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

module.exports = nextConfig;
