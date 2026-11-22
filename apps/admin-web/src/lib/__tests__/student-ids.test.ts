import { describe, expect, it } from "vitest";
import {
  APAAR_PROBLEM,
  ApaarIdSchema,
  PAN_PROBLEM,
  PanSchema,
  duplicateField,
} from "../student-ids";

const parse = (schema: typeof PanSchema, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success
    ? { value: result.data }
    : { error: result.error.errors[0].message };
};

describe("student PAN", () => {
  it("cleans up what people type", () => {
    expect(parse(PanSchema, "abcde1234f")).toEqual({ value: "ABCDE1234F" });
    expect(parse(PanSchema, " ABCDE 1234 F ")).toEqual({ value: "ABCDE1234F" });
    expect(parse(PanSchema, "ABCDE-1234-F")).toEqual({ value: "ABCDE1234F" });
  });

  it("treats blank as not given", () => {
    for (const blank of ["", "   ", null, undefined]) {
      expect(parse(PanSchema, blank)).toEqual({ value: null });
    }
  });

  it.each([
    "ABCD1234F",
    "ABCDE12345",
    "12345ABCDE",
    "ABCDE1234FF",
    "ABCDE123$F",
  ])("refuses %s", (value) => {
    expect(parse(PanSchema, value)).toEqual({ error: PAN_PROBLEM });
  });
});

describe("student APAAR ID", () => {
  it("keeps 12 digits, with spaces or dashes taken out", () => {
    expect(parse(ApaarIdSchema, "123456789012")).toEqual({
      value: "123456789012",
    });
    expect(parse(ApaarIdSchema, "1234 5678 9012")).toEqual({
      value: "123456789012",
    });
    expect(parse(ApaarIdSchema, "1234-5678-9012")).toEqual({
      value: "123456789012",
    });
  });

  it("reads a number from a spreadsheet as its digits", () => {
    expect(parse(ApaarIdSchema, 123456789012)).toEqual({
      value: "123456789012",
    });
  });

  it.each(["12345678901", "1234567890123", "12345678901A", "ABCDEFGHIJKL"])(
    "refuses %s",
    (value) => {
      expect(parse(ApaarIdSchema, value)).toEqual({ error: APAAR_PROBLEM });
    },
  );
});

describe("which field a duplicate is", () => {
  it("reads Prisma's unique-constraint error", () => {
    expect(
      duplicateField({
        code: "P2002",
        meta: { target: ["schoolId", "panNumber"] },
      }),
    ).toBe("panNumber");
    expect(
      duplicateField({
        code: "P2002",
        meta: { target: "students_schoolId_apaarId_key" },
      }),
    ).toBe("apaarId");
    expect(
      duplicateField({
        code: "P2002",
        meta: { target: ["schoolId", "admissionNumber"] },
      }),
    ).toBe("admissionNumber");
    expect(duplicateField({ code: "P2025" })).toBeNull();
    expect(duplicateField(new Error("boom"))).toBeNull();
  });
});
