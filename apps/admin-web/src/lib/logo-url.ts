import { z } from "zod";

/**
 * A school logo is always an image our upload put on Cloudinary. Anything
 * else (another site's address, a data: or javascript: URL) is refused, since
 * the logo is shown on report cards, salary slips and in Settings.
 */
export function isLogoUrl(value: string) {
  if (value.length > 500) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/image/upload/")
    );
  } catch {
    return false;
  }
}

export const LogoUrlSchema = z
  .string()
  .refine(isLogoUrl, "Upload the logo again; that address isn't one of ours.");
