import { describe, expect, it } from "vitest";
import { isLogoUrl } from "../logo-url";

describe("logo addresses", () => {
  it("accepts images our upload put on Cloudinary", () => {
    expect(
      isLogoUrl(
        "https://res.cloudinary.com/demo/image/upload/v1/kora_logos/a.png",
      ),
    ).toBe(true);
  });

  it.each([
    "https://example.com/a.png",
    "https://res.cloudinary.com.evil.com/demo/image/upload/a.png",
    "http://res.cloudinary.com/demo/image/upload/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "not a url",
    `https://res.cloudinary.com/demo/image/upload/${"a".repeat(500)}.png`,
  ])("refuses %s", (url) => {
    expect(isLogoUrl(url)).toBe(false);
  });
});
