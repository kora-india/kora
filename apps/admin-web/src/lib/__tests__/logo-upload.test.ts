import { afterEach, describe, expect, it, vi } from "vitest";
import { logoFileProblem, uploadLogo } from "../logo-upload";

const png = (bytes = 10) =>
  new File([new Uint8Array(bytes)], "logo.png", { type: "image/png" });

const respond = (body: string, status: number, type = "application/json") =>
  vi.fn(
    async () =>
      new Response(body, { status, headers: { "content-type": type } }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("uploading a logo", () => {
  it("returns the uploaded address", async () => {
    const fetchMock = respond(
      JSON.stringify({
        url: "https://res.cloudinary.com/x/image/upload/a.png",
      }),
      200,
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await uploadLogo(png())).toEqual({
      url: "https://res.cloudinary.com/x/image/upload/a.png",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("explains the host's own error pages, which aren't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      respond("<html>Request Entity Too Large</html>", 413, "text/html"),
    );
    expect(await uploadLogo(png())).toEqual({
      error: "That image is too large. Try a smaller one.",
    });
    vi.stubGlobal("fetch", respond("<html>oops</html>", 502, "text/html"));
    expect(await uploadLogo(png())).toEqual({
      error: "We couldn't upload the logo. Try again.",
    });
  });

  it("shows the server's own reason when it gives one", async () => {
    vi.stubGlobal(
      "fetch",
      respond(
        JSON.stringify({
          error: "File uploads aren't set up on this server yet.",
        }),
        503,
      ),
    );
    expect(await uploadLogo(png())).toEqual({
      error: "File uploads aren't set up on this server yet.",
    });
  });

  it("gives up after a minute instead of spinning forever", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(
                Object.assign(new Error("aborted"), { name: "AbortError" }),
              ),
            ),
          ),
      ),
    );
    const pending = uploadLogo(png());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await pending).toEqual({
      error: "The upload took too long. Check your connection and try again.",
    });
  });

  it("says so when the network is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await uploadLogo(png())).toEqual({
      error: "We couldn't upload the logo. Check your connection.",
    });
  });

  it("refuses other file types and huge files before sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const gif = new File(["gif"], "a.gif", { type: "image/gif" });
    expect(logoFileProblem(gif)).toBe("Use a PNG, JPG or WebP image.");
    expect(await uploadLogo(gif)).toEqual({
      error: "Use a PNG, JPG or WebP image.",
    });
    // Too big to send even though it's under the pick limit, and can't be
    // shrunk here (no canvas in tests).
    expect(await uploadLogo(png(5 * 1024 * 1024))).toEqual({
      error: "That image is too large. Try one under 4 MB.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
