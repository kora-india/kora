import { describe, it, expect } from "vitest";
import {
  formatAdmissionNumber,
  ADMISSION_FORMAT_PRESETS,
} from "../admission-number";

describe("formatAdmissionNumber", () => {
  const fixedDate = new Date("2026-05-15T12:00:00Z"); // May 2026 (Session 2026-27)

  it("should format with default template {PREFIX}-{YYYY}-{SEQ:4}", () => {
    const formatted = formatAdmissionNumber(
      "{PREFIX}-{YYYY}-{SEQ:4}",
      "DPS",
      1,
      fixedDate,
    );
    expect(formatted).toBe("DPS-2026-0001");
  });

  it("should handle custom sequence padding {SEQ:3} and {SEQ:5}", () => {
    const formatted3 = formatAdmissionNumber(
      "{PREFIX}-{SEQ:3}",
      "SCH",
      42,
      fixedDate,
    );
    expect(formatted3).toBe("SCH-042");

    const formatted5 = formatAdmissionNumber(
      "{PREFIX}-{SEQ:5}",
      "SCH",
      42,
      fixedDate,
    );
    expect(formatted5).toBe("SCH-00042");
  });

  it("should format 2-digit year {YY}", () => {
    const formatted = formatAdmissionNumber(
      "{PREFIX}/{YY}/{SEQ:4}",
      "KORA",
      7,
      fixedDate,
    );
    expect(formatted).toBe("KORA/26/0007");
  });

  it("should format academic session {SESSION} and {SESSION:SHORT}", () => {
    const formatted = formatAdmissionNumber(
      "{PREFIX}/{SESSION}/{SEQ:4}",
      "DPS",
      9,
      fixedDate,
    );
    expect(formatted).toBe("DPS/2026-27/0009");

    const formattedShort = formatAdmissionNumber(
      "{PREFIX}/{SESSION:SHORT}/{SEQ:4}",
      "DPS",
      9,
      fixedDate,
    );
    expect(formattedShort).toBe("DPS/2627/0009");
  });

  it("should handle session for dates before April (e.g. February)", () => {
    const febDate = new Date("2026-02-10T12:00:00Z"); // Session 2025-26
    const formatted = formatAdmissionNumber(
      "{PREFIX}/{SESSION}/{SEQ:4}",
      "DPS",
      12,
      febDate,
    );
    expect(formatted).toBe("DPS/2025-26/0012");
  });

  it("should uppercase prefix and sanitize empty inputs", () => {
    const formatted = formatAdmissionNumber("", "  dps  ", 5, fixedDate);
    // Empty template falls back to default {PREFIX}-{YYYY}-{SEQ:4}
    expect(formatted).toBe("DPS-2026-0005");
  });

  it("should render all presets correctly", () => {
    for (const preset of ADMISSION_FORMAT_PRESETS) {
      const sample = formatAdmissionNumber(preset.format, "SCH", 1, fixedDate);
      expect(sample).toBe(preset.example);
    }
  });
});
