/**
 * Uploading a school logo from the browser (setup and Settings).
 *
 * The picked image is shrunk in the browser before it is sent: Cloudinary
 * keeps logos at most 500 px anyway, and the host refuses request bodies over
 * 4.5 MB, which ordinary phone photos exceed. Every failure comes back as a
 * sentence for the person, and an upload that hangs gives up after a minute
 * instead of spinning forever.
 */

export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** Largest picture someone can pick; it's made smaller before sending. */
export const LOGO_MAX_BYTES = 10 * 1024 * 1024;
/** What the server accepts (api/upload); a little under the host's limit. */
const SEND_MAX_BYTES = 4 * 1024 * 1024;
/** Longest side after shrinking; Cloudinary stores 500 px. */
const MAX_SIDE = 512;
const TIMEOUT_MS = 60_000;

export const LOGO_HINT = "PNG, JPG or WebP, up to 10 MB.";

/** Why a file can't be used as the logo, or null when it can. */
export function logoFileProblem(file: File) {
  if (!LOGO_TYPES.includes(file.type)) return "Use a PNG, JPG or WebP image.";
  if (file.size > LOGO_MAX_BYTES) return "The logo can be up to 10 MB.";
  return null;
}

/**
 * The image at most MAX_SIDE pixels on its longest side, as WebP (PNG where
 * the browser can't make WebP), keeping transparency. The original when it's
 * already small, or when this browser can't redraw it (the server still
 * checks it).
 */
export async function shrinkLogo(file: File): Promise<Blob> {
  if (
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.92),
    );
    // Browsers that can't encode WebP hand back a PNG, which is also fine.
    return blob && blob.size > 0 && blob.size < file.size ? blob : file;
  } finally {
    bitmap.close();
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "You've been signed out. Sign in again, then upload the logo.",
  403: "You can't upload a logo with this login.",
  413: "That image is too large. Try a smaller one.",
  429: "Too many uploads. Wait a few minutes and try again.",
  503: "Logo uploads aren't set up on this server yet.",
};

export type LogoUploadResult = { url: string } | { error: string };

/** Uploads a logo the person picked and returns its address, or why not. */
export async function uploadLogo(file: File): Promise<LogoUploadResult> {
  const problem = logoFileProblem(file);
  if (problem) return { error: problem };

  const image = await shrinkLogo(file);
  if (image.size > SEND_MAX_BYTES) {
    return { error: "That image is too large. Try one under 4 MB." };
  }
  const ext =
    image.type === "image/webp"
      ? "webp"
      : image.type === "image/png"
        ? "png"
        : "jpg";
  const body = new FormData();
  body.append("file", image, `logo.${ext}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body,
      signal: controller.signal,
    });
    // A host's own error page isn't JSON; the status still says what happened.
    const data = await res.json().catch(() => null);
    if (res.ok && typeof data?.url === "string") return { url: data.url };
    return {
      error:
        (typeof data?.error === "string" && data.error) ||
        STATUS_MESSAGES[res.status] ||
        "We couldn't upload the logo. Try again.",
    };
  } catch (err) {
    return {
      error:
        (err as Error)?.name === "AbortError"
          ? "The upload took too long. Check your connection and try again."
          : "We couldn't upload the logo. Check your connection.",
    };
  } finally {
    clearTimeout(timer);
  }
}
