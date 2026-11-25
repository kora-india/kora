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
  // Prisma stays a Node package (not bundled), and its query engine for
  // Vercel's Linux is copied into each server function, as in admin-web.
  // Without this, a pnpm monorepo on Vercel can't find the engine at runtime.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "**": [
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node",
    ],
  },
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
