import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // @schoolos/db intentionally excluded — Prisma must not be bundled by webpack
  // or it loses the __dirname reference needed to locate the native .node engine.
  transpilePackages: ["@schoolos/ui", "@schoolos/utils", "@schoolos/types", "@schoolos/auth"],

  // Prevent Next.js from bundling Prisma; Node.js module resolution at runtime
  // correctly finds the native engine binary.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],

  // In a monorepo, Prisma lives outside the app folder; set tracing root so Vercel
  // includes the Prisma query engine in the serverless bundle.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Explicitly include the Prisma native engine so it is copied into the lambda bundle.
  outputFileTracingIncludes: {
    "**": ["../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node"],
  },

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
