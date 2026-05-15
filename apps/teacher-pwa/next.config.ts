import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@schoolos/ui", "@schoolos/utils", "@schoolos/types", "@schoolos/db", "@schoolos/auth"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3001"] },
  },
};

export default nextConfig;
