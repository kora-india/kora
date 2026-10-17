import { describe, it, expect } from "vitest";
import {
  classMatchKey,
  displayOrderForClassName,
  parseImportDate,
} from "../student-import-helpers";

describe("parseImportDate", () => {
  const iso = (raw: string | number) =>
    parseImportDate(raw).date?.toISOString().slice(0, 10);

  it("reads day-first dates", () => {
    expect(iso("05/06/2010")).toBe("2010-06-05");
    expect(iso("5-6-2010")).toBe("2010-06-05");
    expect(iso("15.06.2010")).toBe("2010-06-15");
  });

  it("reads ISO dates and Excel serial numbers", () => {
    expect(iso("2010-06-15")).toBe("2010-06-15");
    expect(iso(40321)).toBe("2010-05-23");
    expect(iso("40321")).toBe("2010-05-23");
  });

  it("treats an empty cell as no date", () => {
    expect(parseImportDate("")).toEqual({ date: null });
    expect(parseImportDate(undefined)).toEqual({ date: null });
  });

  it("rejects impossible or ambiguous dates instead of guessing", () => {
    expect(parseImportDate("31/02/2010").error).toBeDefined();
    expect(parseImportDate("13/13/2010").error).toBeDefined();
    expect(parseImportDate("June 5").error).toBeDefined();
    expect(parseImportDate("05/06/10").error).toBeDefined();
    expect(parseImportDate("01/01/2999").error).toMatch(/plausible/);
  });
});

describe("classMatchKey", () => {
  it("gives every spelling of a class the same key", () => {
    const keys = ["5", "Class 5", "Grade V", "5th", "STD 5", "grade  5"].map(
      classMatchKey,
    );
    expect(new Set(keys)).toEqual(new Set(["5"]));
    expect(classMatchKey("Nursery")).toBe("nursery");
  });

  it("orders classes on the catalog's scale", () => {
    expect(displayOrderForClassName("Nursery")).toBe(-2);
    expect(displayOrderForClassName("LKG")).toBe(-1);
    expect(displayOrderForClassName("UKG")).toBe(0);
    expect(displayOrderForClassName("Class 7")).toBe(7);
    expect(displayOrderForClassName("Montessori")).toBe(14);
  });
});
