import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@schoolos/auth";
import { createLogger } from "@schoolos/logger";
import { uploadRatelimit, createRateLimitResponse } from "@/lib/ratelimit";

const uploadLogger = createLogger("upload-api");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** School logos: small images only (sec 9). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Room for the multipart boundaries and headers around the file.
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const IMAGE_SIGNATURES: { type: string; matches: (b: Buffer) => boolean }[] = [
  {
    type: "image/png",
    matches: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    type: "image/jpeg",
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: "image/webp",
    matches: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/**
 * Reads the request body, stopping as soon as it passes `limit` bytes, so an
 * oversized upload is never held in memory in full. Null when too large.
 */
async function readBody(req: Request, limit: number): Promise<Buffer | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!req.body) return Buffer.alloc(0);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

const tooLarge = () =>
  NextResponse.json(
    {
      error: `The file is too large. Logos can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    },
    { status: 413 },
  );

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await uploadRatelimit.limit(session.user.id);
    if (!limited.success) {
      return createRateLimitResponse(
        limited,
        "Too many uploads. Please wait a few minutes and try again.",
      );
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      uploadLogger.error("Cloudinary is not configured; uploads are disabled");
      return NextResponse.json(
        { error: "File uploads aren't set up on this server yet." },
        { status: 503 },
      );
    }

    const body = await readBody(req, MAX_BODY_BYTES);
    if (!body) return tooLarge();

    const formData = await new Response(new Uint8Array(body), {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    })
      .formData()
      .catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) return tooLarge();

    const buffer = Buffer.from(await file.arrayBuffer());
    // The bytes, not the browser's label, decide what the file is.
    if (!IMAGE_SIGNATURES.some((sig) => sig.matches(buffer))) {
      return NextResponse.json(
        { error: "Upload a PNG, JPG or WebP image." },
        { status: 415 },
      );
    }

    // Upload to Cloudinary using a Promise wrapper
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "kora_logos",
            allowed_formats: ["jpg", "png", "jpeg", "webp"],
            transformation: [{ width: 500, height: 500, crop: "limit" }],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
        )
        .end(buffer);
    });

    return NextResponse.json({
      success: true,
      url: (uploadResult as any).secure_url,
    });
  } catch (error) {
    uploadLogger.error({ err: error }, "Error uploading to Cloudinary");
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
