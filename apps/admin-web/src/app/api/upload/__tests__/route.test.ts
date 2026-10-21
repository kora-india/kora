import { describe, it, expect, beforeEach, vi } from "vitest";

const { uploadStream } = vi.hoisted(() => ({ uploadStream: vi.fn() }));
vi.mock("cloudinary", () => ({
  v2: { config: vi.fn(), uploader: { upload_stream: uploadStream } },
}));

import { auth } from "@schoolos/auth";
import { POST } from "../route";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

function upload(bytes: Uint8Array, name = "logo.png", type = "image/png") {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type }));
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/upload (sec 9)", () => {
  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = "c";
    process.env.CLOUDINARY_API_KEY = "k";
    process.env.CLOUDINARY_API_SECRET = "s";
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", role: "SCHOOL_ADMIN" },
    } as any);
    uploadStream.mockReset();
    uploadStream.mockImplementation(
      (_opts: unknown, done: (e: unknown, r: unknown) => void) => ({
        end: () => done(null, { secure_url: "https://cdn.example/logo.png" }),
      }),
    );
  });

  it("uploads a real image", async () => {
    const res = await POST(upload(PNG));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://cdn.example/logo.png");
  });

  it("refuses files over 5 MB without uploading them", async () => {
    const res = await POST(upload(new Uint8Array(5 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
    expect(uploadStream).not.toHaveBeenCalled();
  });

  it("checks the bytes, not the file name", async () => {
    const res = await POST(
      upload(Buffer.from("<script>alert(1)</script>"), "logo.png"),
    );
    expect(res.status).toBe(415);
    expect(uploadStream).not.toHaveBeenCalled();
  });

  it("says when uploads aren't configured", async () => {
    delete process.env.CLOUDINARY_API_SECRET;
    const res = await POST(upload(PNG));
    expect(res.status).toBe(503);
  });

  it("requires sign-in", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);
    expect((await POST(upload(PNG))).status).toBe(401);
  });
});
