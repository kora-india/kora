import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  transpilePackages: ["@schoolos/ui", "@schoolos/utils", "@schoolos/types", "@schoolos/db", "@schoolos/auth"],

  // In a monorepo, Prisma lives outside the app folder; set tracing root so Vercel
  // includes the Prisma query engine in the serverless bundle.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  experimental: {
    serverActions: {
      allowedOrigins: isProd
        ? [process.env.NEXT_PUBLIC_APP_URL ?? ""]
        : ["localhost:3000", "localhost:3001"],
    },
  },

  // Silence noisy build output in prod
  logging: isProd ? { fetches: { fullUrl: false } } : undefined,

  // Recommended production headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
