import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@schoolos/auth";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const { uploadStream } = vi.hoisted(() => ({ uploadStream: vi.fn() }));
vi.mock("cloudinary", () => ({
  v2: { config: vi.fn(), uploader: { upload_stream: uploadStream } },
}));

import { POST } from "../route";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
]);
const GIF = new TextEncoder().encode("GIF89a....");

const upload = (bytes: Uint8Array<ArrayBuffer>) => {
  const body = new FormData();
  body.append("file", new File([bytes], "logo.png", { type: "image/png" }));
  return POST(
    new Request("http://localhost/api/upload", { method: "POST", body }),
  );
};

/** Each call to Cloudinary ends with the next of these outcomes. */
function cloudinaryAnswers(...outcomes: (Error | string)[]) {
  uploadStream.mockImplementation((_opts, done) => ({
    end: () => {
      const next = outcomes.shift();
      if (next instanceof Error) done(next);
      else done(undefined, { secure_url: next });
    },
  }));
}

const reset = (message: string) =>
  Object.assign(new Error(message), { code: "ECONNRESET" });

describe("logo upload route", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("CLOUDINARY_API_KEY", "key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as any);
    uploadStream.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the Cloudinary address of the logo", async () => {
    cloudinaryAnswers("https://res.cloudinary.com/demo/image/upload/a.png");
    const res = await upload(PNG);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      url: "https://res.cloudinary.com/demo/image/upload/a.png",
    });
  });

  it("tries once more when the connection to Cloudinary drops", async () => {
    cloudinaryAnswers(
      reset("read ECONNRESET"),
      "https://res.cloudinary.com/demo/image/upload/b.png",
    );
    const res = await upload(PNG);
    expect(res.status).toBe(200);
    expect(uploadStream).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second dropped connection", async () => {
    cloudinaryAnswers(reset("read ECONNRESET"), reset("read ECONNRESET"));
    const res = await upload(PNG);
    expect(res.status).toBe(500);
    expect(uploadStream).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry what Cloudinary refused", async () => {
    cloudinaryAnswers(new Error("Invalid image file"));
    expect((await upload(PNG)).status).toBe(500);
    expect(uploadStream).toHaveBeenCalledTimes(1);
  });

  it("judges the file by its bytes, not its name", async () => {
    const res = await upload(GIF);
    expect(res.status).toBe(415);
    expect(uploadStream).not.toHaveBeenCalled();
  });

  it("says when uploads aren't set up", async () => {
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    const res = await upload(PNG);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "File uploads aren't set up on this server yet.",
    });
  });

  it("needs a signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    expect((await upload(PNG)).status).toBe(401);
  });
});
