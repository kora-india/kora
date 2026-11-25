import "server-only";
import crypto from "crypto";

/**
 * Encrypts the few values that shouldn't sit in the database as plain text
 * (a staff member's Aadhaar and bank account numbers), with AES-256-GCM.
 *
 * The key is DATA_ENCRYPTION_KEY. Without it, one is made from AUTH_SECRET,
 * so the data is still encrypted; set DATA_ENCRYPTION_KEY to keep the two
 * apart. Each value records which key made it ("v1.<key>.<iv>.<tag>.<data>"),
 * so values from before a key was added still open.
 *
 * Changing or losing the key that made a value makes it unreadable.
 */

type KeyId = "d" | "a";

function keyFor(id: KeyId): Buffer | null {
  if (id === "d") {
    const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
    return raw && raw.length >= 32
      ? crypto.createHash("sha256").update(raw).digest()
      : null;
  }
  const secret = (
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  )?.trim();
  return secret
    ? Buffer.from(
        crypto.hkdfSync(
          "sha256",
          secret,
          "kora",
          "kora-field-encryption-v1",
          32,
        ),
      )
    : null;
}

/** The key new values are made with. */
function currentKey(): { id: KeyId; key: Buffer } {
  for (const id of ["d", "a"] as const) {
    const key = keyFor(id);
    if (key) return { id, key };
  }
  throw new Error(
    "No encryption key: set DATA_ENCRYPTION_KEY (or AUTH_SECRET) on the server",
  );
}

export function encryptField(plain: string): string {
  const { id, key } = currentKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", id, iv, tag, data]
    .map((part) => (Buffer.isBuffer(part) ? part.toString("base64url") : part))
    .join(".");
}

/** The plain value, or null when it can't be opened with today's keys. */
export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [version, id, iv, tag, data] = stored.split(".");
  if (version !== "v1" || (id !== "d" && id !== "a") || !data) return null;
  const key = keyFor(id);
  if (!key) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
