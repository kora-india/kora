import { describe, it, expect } from "vitest";
import {
  applySuggestions,
  classMatchKey,
  describeColumn,
  displayOrderForClassName,
  guessColumnMapping,
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
  it("names the required fields no column is matched to", () => {
    expect(
      missingImportColumns(
        guessColumnMapping(["Full Name", "Class", "Parent Phone"]),
      ),
    ).toEqual(["Parent name"]);
    expect(
      missingImportColumns(
        guessColumnMapping(["Name", "Father's Name", "Mobile"]),
      ),
    ).toEqual([]);
  });

  it("follows the columns the person picked", () => {
    expect(
      missingImportColumns({ Kid: "name", "Ma Baap": "parentName", Ph: null }),
    ).toEqual(["Parent phone"]);
  });
});

describe("guessColumnMapping", () => {
  it("leaves columns the rules can't read unmatched", () => {
    expect(guessColumnMapping(["छात्र का नाम", "F/N", "Mobile"])).toEqual({
      "छात्र का नाम": null,
      "F/N": null,
      Mobile: "parentPhone",
    });
  });
});

describe("normalizeImportRow with a mapping", () => {
  it("fills fields from the columns the mapping names", () => {
    expect(
      normalizeImportRow(
        { "छात्र का नाम": "Asha", "F/N": "Ravi", Mobile: "9000000000" },
        { "छात्र का नाम": "name", "F/N": "fatherName", Mobile: null },
      ),
    ).toEqual({ name: "Asha", parentName: "Ravi" });
  });
});

describe("applySuggestions", () => {
  const rules = { Name: "name", "F/N": null, X: null, Y: null } as const;

  it("fills only columns the rules left unmatched", () => {
    const { mapping, suggested } = applySuggestions(
      { ...rules },
      { Name: "parentName", "F/N": "fatherName", X: null },
    );
    expect(mapping).toEqual({ ...rules, "F/N": "fatherName" });
    expect(suggested).toEqual(["F/N"]);
  });

  it("never changes a column the person set, or one not in the file", () => {
    const { mapping, suggested } = applySuggestions(
      { ...rules },
      { Y: "city", Unknown: "state" },
      new Set(["Y"]),
    );
    expect(mapping).toEqual(rules);
    expect(suggested).toEqual([]);
  });
});

describe("describeColumn", () => {
  const sample = (values: string[], times = 1) =>
    Array.from({ length: times }, () => values).flat();

  it("describes values by their shape", () => {
    expect(describeColumn(["9416940224", "9158116441"])).toBe(
      "phone-like numbers of 10 digits",
    );
    expect(describeColumn(["24/11/2009", "27/05/2021"])).toBe(
      "dates like DD/MM/YYYY",
    );
    expect(describeColumn(["a@example.com", "b@example.com"])).toBe(
      "email addresses",
    );
    expect(describeColumn(["832401", "832402"])).toBe("6-digit numbers");
    expect(describeColumn(["BCS-2026-0001", "BCS-2026-0002"])).toBe(
      "codes shaped like AAA-0000-0000",
    );
    expect(describeColumn(["43", "56", "24", "36"])).toBe(
      "small whole numbers",
    );
    expect(describeColumn(["", "", ""])).toBe("always empty");
  });

  it("names only short lists of repeating values", () => {
    expect(describeColumn(sample(["Male", "Female"], 4))).toBe(
      "repeating values: Male, Female",
    );
    expect(describeColumn(sample(["A", "B", "C", "D"], 3))).toBe(
      "repeating values: A, B, C, D",
    );
  });

  it("never repeats a student's or parent's details", () => {
    const names = ["Tanvi Shah", "Anika Mishra", "Yash Choudhary"];
    const phones = ["9416940224", "9158116441", "9434671635"];
    const emails = ["parent0001@example.com", "parent0002@example.com"];
    const addresses = ["House No. 1, Main Road", "House No. 2, Station Road"];
    for (const values of [names, phones, emails, addresses]) {
      const description = describeColumn(values);
      for (const value of values) {
        expect(description).not.toContain(value);
      }
    }
    expect(describeColumn(names)).toBe("text of about 2 words");
    // Even names that repeat in a small file aren't listed.
    expect(describeColumn(sample(names, 2))).toBe("text of about 2 words");
  });

  it("says when a column is mostly empty", () => {
    expect(describeColumn(["9416940224", "", "", ""])).toBe(
      "phone-like numbers of 10 digits, often empty",
    );
  });
});

describe("rollNumberKey", () => {
  it("treats leading zeros as the same roll", () => {
    expect(rollNumberKey("04")).toBe(rollNumberKey("4"));
    expect(rollNumberKey(" A12 ")).toBe("a12");
  });
});
