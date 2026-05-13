import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@schoolos/ui", "@schoolos/utils", "@schoolos/types", "@schoolos/db", "@schoolos/auth"],
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
};

export default nextConfig;
