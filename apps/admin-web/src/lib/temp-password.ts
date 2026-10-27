import crypto from "crypto";

/**
 * The first password for a login the school creates (school admins, teachers,
 * accountants). Shown once to whoever created it; no look-alike characters.
 */
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(
    { length: 16 },
    () => chars[crypto.randomInt(0, chars.length)],
  ).join("");
}
