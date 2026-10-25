/**
 * Supabase's transaction pooler (port 6543) hands each query to whichever
 * database connection is free. Prisma must then skip prepared statements
 * (`pgbouncer=true`), or parallel queries fail at random with "prepared
 * statement does not exist" or syntax errors. Adds the flag when it's missing.
 */
export function withPgBouncerFlag(url: string | undefined): {
  url: string | undefined;
  added: boolean;
} {
  if (!url) return { url, added: false };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, added: false };
  }
  if (parsed.port !== "6543" || parsed.searchParams.has("pgbouncer")) {
    return { url, added: false };
  }
  parsed.searchParams.set("pgbouncer", "true");
  return { url: parsed.toString(), added: true };
}
