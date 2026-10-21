import { describe, it, expect, afterEach } from "vitest";
import { checkEnv } from "../../env";
import { getClientIp } from "../ip";

const base = {
  DATABASE_URL: "postgresql://u@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
};

describe("environment check (sec 9)", () => {
  it("needs a database URL and an auth secret", () => {
    expect(checkEnv({}).errors).toHaveLength(2);
    expect(
      checkEnv({
        ...base,
        AUTH_SECRET: undefined,
        NEXTAUTH_SECRET: "y".repeat(32),
      }).errors,
    ).toEqual([]);
  });

  it("names what won't work when a feature isn't configured", () => {
    const { warnings } = checkEnv(base);
    expect(warnings.find((w) => w.startsWith("Scheduled jobs"))).toMatch(
      /CRON_SECRET not set, so monthly fees and late fees won't be generated/,
    );
    expect(warnings.some((w) => w.startsWith("Redis"))).toBe(true);
  });

  it("accepts the old SMTP password name, with a nudge", () => {
    const { warnings } = checkEnv({
      ...base,
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "u",
      SMTP_PASS: "p",
    });
    expect(warnings.some((w) => w.startsWith("Email"))).toBe(false);
    expect(warnings).toContain(
      "SMTP_PASS is deprecated; rename it to SMTP_PASSWORD",
    );
  });
});

describe("client IP (sec 9)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/", { headers });

  it("ignores a forged first X-Forwarded-For entry off Vercel", () => {
    delete process.env.VERCEL;
    delete process.env.TRUSTED_PROXY_COUNT;
    delete process.env.CLIENT_IP_HEADER;
    expect(
      getClientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })),
    ).toBe("203.0.113.9");
  });

  it("trusts Vercel's header, a named header, or a proxy count", () => {
    process.env.VERCEL = "1";
    expect(
      getClientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })),
    ).toBe("203.0.113.9");
    delete process.env.VERCEL;

    process.env.TRUSTED_PROXY_COUNT = "2";
    expect(
      getClientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.1" })),
    ).toBe("203.0.113.9");
    delete process.env.TRUSTED_PROXY_COUNT;

    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    expect(
      getClientIp(
        req({
          "cf-connecting-ip": "198.51.100.4",
          "x-forwarded-for": "6.6.6.6",
        }),
      ),
    ).toBe("198.51.100.4");
  });
});
