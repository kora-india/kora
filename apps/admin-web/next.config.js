/** @type {import('next').NextConfig} */
const path = require("node:path");
const { withSentryConfig } = require("@sentry/nextjs");
const isProd = process.env.NODE_ENV === "production";

// Server Actions compare `allowedOrigins` with the request's host, so this
// must be "app.example.com", not "https://app.example.com" (sec 9). Empty
// means Next.js's own same-host check.
const appHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").host;
  } catch {
    return "";
  }
})();

// Every route, including /login and /register: no framing (clickjacking),
// no MIME sniffing, no plugins, no <base> hijacking (sec 9).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig = {
  // The end-to-end tests build into their own folder (e2e/env.ts), so a test
  // run never replaces the build or dev cache in .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // @schoolos/db intentionally excluded — Prisma must not be bundled by webpack
  // or it loses the __dirname reference needed to locate the native .node engine.
  transpilePackages: [
    "@schoolos/ui",
    "@schoolos/utils",
    "@schoolos/types",
    "@schoolos/auth",
    "@schoolos/logger",
  ],

  // Prevent Next.js from bundling Prisma; Node.js module resolution at runtime
  // correctly finds the native engine binary.
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pino", "pino-pretty"],

  // In a monorepo, Prisma lives outside the app folder; set tracing root so Vercel
  // includes the Prisma query engine in the serverless bundle.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Explicitly include the Prisma native engine so it is copied into the lambda bundle.
  outputFileTracingIncludes: {
    "**": [
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.node",
    ],
  },

  images: {
    domains: ["avatars.githubusercontent.com", "lh3.googleusercontent.com"],
  },

  experimental: {
    serverActions: {
      allowedOrigins: isProd
        ? appHost
          ? [appHost]
          : []
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
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...securityHeaders,
        ],
      },
    ];
  },
};

const sentryOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

module.exports = withSentryConfig(nextConfig, sentryOptions);
