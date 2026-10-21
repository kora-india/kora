import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@schoolos/ui",
    "@schoolos/utils",
    "@schoolos/types",
    "@schoolos/db",
    "@schoolos/auth",
  ],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3001"] },
  },
  // No framing (clickjacking) or MIME sniffing on any page (sec 9).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
