import { describe, it, expect } from "vitest";
import { withPgBouncerFlag } from "@schoolos/db";

const POOLER =
  "postgresql://postgres.ref:p%40ss@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

describe("withPgBouncerFlag", () => {
  it("adds pgbouncer=true to a transaction-pooler URL that lacks it", () => {
    const { url, added } = withPgBouncerFlag(POOLER);
    expect(added).toBe(true);
    expect(url).toBe(`${POOLER}?pgbouncer=true`);
  });

  it("keeps other settings and the encoded password", () => {
    const { url } = withPgBouncerFlag(`${POOLER}?connection_limit=1`);
    expect(url).toBe(`${POOLER}?connection_limit=1&pgbouncer=true`);
  });

  it.each([
    ["already has the flag", `${POOLER}?pgbouncer=true`],
    ["sets it explicitly", `${POOLER}?pgbouncer=false`],
    [
      "uses the session pooler",
      "postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
    ],
    [
      "is a local database",
      "postgresql://postgres:password@localhost:5432/schoolos",
    ],
    ["isn't a URL", "not a url"],
  ])("leaves a URL alone when it %s", (_, input) => {
    expect(withPgBouncerFlag(input)).toEqual({ url: input, added: false });
  });

  it("handles a missing URL", () => {
    expect(withPgBouncerFlag(undefined)).toEqual({
      url: undefined,
      added: false,
    });
  });
});
