import { describe, it, expect } from "vitest";
import {
  classMatchKey,
  displayOrderForClassName,
  importFieldForHeader,
  missingImportColumns,
  normalizeImportRow,
  parseImportDate,
  rollNumberKey,
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

describe("importFieldForHeader", () => {
  it("reads the headers schools actually use", () => {
    const sheet = [
      "Full Name",
      "Admission Number",
      "Roll Number",
      "Class",
      "Section",
      "Gender",
      "Blood Group",
      "Date of Birth",
      "Parent / Guardian Name",
      "Parent Phone",
      "Parent Email",
      "Address",
      "City",
      "State",
      "Pincode",
    ];
    expect(sheet.map(importFieldForHeader)).toEqual([
      "name",
      "admissionNumber",
      "rollNumber",
      "class",
      "section",
      "gender",
      "bloodGroup",
      "dateOfBirth",
      "parentName",
      "parentPhone",
      "parentEmail",
      "address",
      "city",
      "state",
      "pincode",
    ]);
  });

  it("understands other ways of writing them", () => {
    const cases: [string, string | null][] = [
      ["Student's Name", "name"],
      ["Name of Student", "name"],
      ["name", "name"],
      ["Father's Name", "fatherName"],
      ["Mother Name", "motherName"],
      ["Guardian", "parentName"],
      ["Mobile No.", "parentPhone"],
      ["Father Mobile", "parentPhone"],
      ["Student Phone", "studentPhone"],
      ["E-mail", "parentEmail"],
      ["Adm. No", "admissionNumber"],
      ["Admission Date", null],
      ["DOB", "dateOfBirth"],
      ["Roll No", "rollNumber"],
      ["Std", "class"],
      ["first_name", "firstName"],
      ["Surname", "lastName"],
      ["PIN Code", "pincode"],
      ["Religion", null],
    ];
    for (const [header, field] of cases) {
      expect(importFieldForHeader(header), header).toBe(field);
    }
  });
});

describe("normalizeImportRow", () => {
  it("turns a row into student fields", () => {
    expect(
      normalizeImportRow({
        "Full Name": " Tanvi Shah ",
        "Roll Number": "04",
        Gender: "Female",
        "Blood Group": "",
        "Parent / Guardian Name": "Myra Prasad",
        "Parent Phone": 9416940224,
        Religion: "Hindu",
      }),
    ).toEqual({
      name: "Tanvi Shah",
      rollNumber: "04",
      gender: "FEMALE",
      parentName: "Myra Prasad",
      parentPhone: "9416940224",
    });
  });

  it("builds names from parts and falls back to a father's name", () => {
    expect(
      normalizeImportRow({
        "First Name": "Asha",
        "Last Name": "Rao",
        "Father Name": "Ravi Rao",
        "Student Phone": "9000000000",
      }),
    ).toEqual({
      name: "Asha Rao",
      parentName: "Ravi Rao",
      parentPhone: "9000000000",
    });
  });
});

describe("missingImportColumns", () => {
  it("names the required columns a file doesn't have", () => {
    expect(
      missingImportColumns(["Full Name", "Class", "Parent Phone"]),
    ).toEqual(["Parent name"]);
    expect(missingImportColumns(["Name", "Father's Name", "Mobile"])).toEqual(
      [],
    );
  });
});

describe("rollNumberKey", () => {
  it("treats leading zeros as the same roll", () => {
    expect(rollNumberKey("04")).toBe(rollNumberKey("4"));
    expect(rollNumberKey(" A12 ")).toBe("a12");
  });
});
