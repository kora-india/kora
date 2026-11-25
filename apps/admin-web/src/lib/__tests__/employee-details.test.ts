import { describe, expect, it } from "vitest";
import {
  EmployeeDetailsSchema,
  documentFileProblem,
  documentLabel,
  fileSize,
  formatAadhaar,
  isAadhaar,
  maskAccount,
  maskAadhaar,
  verhoeffValid,
} from "../employee-details";

/** The one check digit that makes these 11 digits a valid Aadhaar number. */
const withCheckDigit = (eleven: string) => {
  const valid = [..."0123456789"].filter((d) => verhoeffValid(eleven + d));
  expect(valid).toHaveLength(1);
  return eleven + valid[0];
};

const parse = (input: Record<string, unknown>) => {
  const r = EmployeeDetailsSchema.safeParse(input);
  return r.success ? r.data : { error: r.error.errors[0].message };
};

describe("Aadhaar numbers", () => {
  const good = withCheckDigit("23456789012");

  it("needs the right check digit", () => {
    expect(isAadhaar(good)).toBe(true);
    const wrongLast = good.slice(0, 11) + ((Number(good[11]) + 1) % 10);
    expect(isAadhaar(wrongLast)).toBe(false);
  });

  it("catches a mistyped or swapped digit", () => {
    const typo =
      good.slice(0, 4) + ((Number(good[4]) + 3) % 10) + good.slice(5);
    expect(isAadhaar(typo)).toBe(false);
    const swapped = good[0] + good[2] + good[1] + good.slice(3);
    if (swapped !== good) expect(isAadhaar(swapped)).toBe(false);
  });

  it("can't start with 0 or 1, and is 12 digits", () => {
    expect(isAadhaar(withCheckDigit("03456789012"))).toBe(false);
    expect(isAadhaar(withCheckDigit("13456789012"))).toBe(false);
    expect(isAadhaar(good.slice(0, 11))).toBe(false);
  });

  it("is shown masked or in groups of four", () => {
    expect(maskAadhaar("1234")).toBe("XXXX XXXX 1234");
    expect(maskAadhaar(null)).toBeNull();
    expect(formatAadhaar("234567890123")).toBe("2345 6789 0123");
  });
});

describe("the details form", () => {
  const aadhaar = withCheckDigit("98765432101");

  it("cleans up what people type and keeps blanks empty", () => {
    expect(
      parse({
        aadhaarNumber: `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8)}`,
        panNumber: "abcde 1234 f",
        uanNumber: "1001-2345-6789",
        bankAccountHolder: "  Ravi Kumar ",
        bankName: "",
        bankAccountNumber: "0012 3456 7890",
        bankIfsc: "sbin 0001234",
        upiId: "ravi@okaxis",
      }),
    ).toEqual({
      aadhaarNumber: aadhaar,
      panNumber: "ABCDE1234F",
      uanNumber: "100123456789",
      bankAccountHolder: "Ravi Kumar",
      bankName: null,
      bankAccountNumber: "001234567890",
      bankIfsc: "SBIN0001234",
      upiId: "ravi@okaxis",
    });
  });

  it("allows everything to be blank", () => {
    expect(parse({})).toMatchObject({
      aadhaarNumber: null,
      panNumber: null,
      bankIfsc: null,
    });
  });

  it.each([
    [
      "aadhaarNumber",
      "123412341234",
      "That isn't a valid Aadhaar number. Check the 12 digits.",
    ],
    ["panNumber", "ABC123", "PAN must look like ABCDE1234F"],
    ["uanNumber", "12345", "UAN must be 12 digits"],
    ["bankAccountNumber", "12345678", "Account number must be 9 to 18 digits"],
    [
      "bankAccountNumber",
      "1234567890123456789",
      "Account number must be 9 to 18 digits",
    ],
    ["bankIfsc", "SBIN1001234", "IFSC must look like SBIN0001234"],
    ["upiId", "ravi.okaxis", "UPI ID must look like name@bank"],
  ])("refuses a wrong %s (%s)", (field, value, message) => {
    expect(parse({ [field]: value })).toEqual({ error: message });
  });

  it("masks account numbers", () => {
    expect(maskAccount("7890")).toBe("XXXXXX7890");
  });
});

describe("document files", () => {
  it("takes PDFs and images up to 10 MB", () => {
    expect(
      documentFileProblem({ type: "application/pdf", size: 2_000_000 }),
    ).toBeNull();
    expect(
      documentFileProblem({ type: "image/jpeg", size: 10 * 1024 * 1024 }),
    ).toBeNull();
    expect(documentFileProblem({ type: "image/gif", size: 10 })).toBe(
      "Use a PDF, JPG, PNG or WebP file.",
    );
    expect(documentFileProblem({ type: "text/html", size: 10 })).toBe(
      "Use a PDF, JPG, PNG or WebP file.",
    );
    expect(
      documentFileProblem({ type: "image/png", size: 10 * 1024 * 1024 + 1 }),
    ).toBe("A document can be up to 10 MB.");
    expect(documentFileProblem({ type: "image/png", size: 0 })).toBe(
      "That file is empty.",
    );
  });

  it("names and sizes them", () => {
    expect(documentLabel({ kind: "MARKSHEET", title: "Class 12" })).toBe(
      "Marksheet: Class 12",
    );
    expect(documentLabel({ kind: "AADHAAR", title: null })).toBe(
      "Aadhaar card",
    );
    expect(fileSize(1_572_864)).toBe("1.5 MB");
    expect(fileSize(2048)).toBe("2 KB");
  });
});
