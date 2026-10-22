import { describe, it, expect, vi, afterEach } from "vitest";
import { TRIAL_PLAN } from "@/lib/plans";
import {
  CLASSES,
  CLASS_GROUPS,
  STEPS,
  SetupSchema,
  academicSessionOptions,
  describeClasses,
  describeWorkingDays,
  digitsOnly,
  draftKey,
  fitsPlan,
  footerCopy,
  lookupPincode,
  normalizeSubdomainInput,
  parsePincodeResponse,
  readDraft,
  readSavedPayment,
  recommendedPlan,
  savedPaymentKey,
  setupDefaults,
  slugify,
  toggleItem,
  writeDraft,
  writeSavedPayment,
  type SavedPayment,
  type SetupField,
} from "../setup-model";

const VALID = {
  name: "Delhi Public School",
  subdomain: "dps-ranchi",
  schoolType: "School",
  board: "CBSE",
  expectedStudents: "1500",
  expectedStaff: "80",
  address: "01, Near Railway Station, Main Road",
  pincode: "834001",
  city: "Ranchi",
  state: "Jharkhand",
  country: "India",
  phone: "9876543210",
  email: "office@dps.in",
  academicSession: "2026 - 2027",
  classes: ["Grade 1"],
  schoolShift: "SINGLE",
  workingDays: ["Mon"],
  gradingSystem: "CBSE_9_POINT",
};

const errorFor = (field: SetupField, value: unknown) => {
  const result = SetupSchema.safeParse({ ...VALID, [field]: value });
  if (result.success) return null;
  return result.error.issues.find((i) => i.path[0] === field)?.message ?? null;
};

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("SetupSchema", () => {
  it("accepts a complete school and coerces the counts to numbers", () => {
    const result = SetupSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    expect(result.success && result.data.expectedStudents).toBe(1500);
  });

  it.each([
    ["name", "AB", "Enter your school's name (at least 3 characters)"],
    ["name", "   ", "Enter your school's name (at least 3 characters)"],
    ["subdomain", "ab", "Use at least 3 characters"],
    ["subdomain", "DPS", "Use lowercase letters, numbers and hyphens"],
    ["subdomain", "-dps", "Can't start or end with a hyphen"],
    ["subdomain", "dps-", "Can't start or end with a hyphen"],
    ["expectedStudents", "", "Enter roughly how many students you have"],
    ["expectedStaff", "0", "Enter roughly how many staff you have"],
    ["expectedStudents", "12.5", "Enter a whole number"],
    ["address", "Main Rd", "Enter the full street address"],
    ["pincode", "83400", "Enter a 6-digit pincode"],
    ["pincode", "83400a", "Enter a 6-digit pincode"],
    ["phone", "98765", "Enter a 10-digit number, or 11 with the STD code"],
    ["email", "office@", "Enter a valid email address"],
    ["classes", [], "Select at least one class"],
    ["workingDays", [], "Select at least one working day"],
  ] as [SetupField, unknown, string][])(
    "rejects %s = %j with a message that says how to fix it",
    (field, value, message) => {
      expect(errorFor(field, value)).toBe(message);
    },
  );

  it("accepts an 11-digit landline with its STD code", () => {
    expect(errorFor("phone", "06512345678")).toBeNull();
  });

  it("validates every required field on exactly one step", () => {
    const required = Object.keys(SetupSchema.shape).filter(
      (key) =>
        !SetupSchema.shape[key as SetupField].safeParse(undefined).success,
    );
    const stepFields = STEPS.flatMap((s) => s.fields);
    expect(new Set(stepFields).size).toBe(stepFields.length);
    for (const field of required) expect(stepFields).toContain(field);
    for (const field of stepFields) {
      expect(Object.keys(SetupSchema.shape)).toContain(field);
    }
  });

  it("asks for the board on the step that shows it", () => {
    const academic = STEPS.find((s) => s.label === "Academic")!;
    expect(academic.fields).toContain("board");
    expect(STEPS[0].fields).not.toContain("board");
  });
});

describe("academicSessionOptions", () => {
  it("offers the current and next April-to-March sessions", () => {
    expect(academicSessionOptions(new Date(2026, 9, 22))).toEqual([
      { value: "2026 - 2027", label: "2026–27" },
      { value: "2027 - 2028", label: "2027–28" },
    ]);
  });

  it("treats January to March as the end of the previous session", () => {
    expect(academicSessionOptions(new Date(2027, 2, 31))[0].value).toBe(
      "2026 - 2027",
    );
    expect(academicSessionOptions(new Date(2027, 3, 1))[0].value).toBe(
      "2027 - 2028",
    );
  });
});

describe("setupDefaults", () => {
  it("starts from the signed-in email and the current session", () => {
    const defaults = setupDefaults("admin@dps.in", new Date(2026, 5, 1));
    expect(defaults.email).toBe("admin@dps.in");
    expect(defaults.academicSession).toBe("2026 - 2027");
    expect(defaults.workingDays).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(defaults.classes).toEqual([]);
  });
});

describe("input helpers", () => {
  it.each([
    ["Delhi Public School", "delhi-public-school"],
    ["St. Mary's Convent, Ranchi", "st-marys-convent-ranchi"],
    ["  Kendriya   Vidyalaya #2 ", "kendriya-vidyalaya-2"],
    ["École Française", "ecole-francaise"],
    ["!!!", ""],
  ])("slugify(%j) → %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("keeps a slug within 40 characters without a trailing hyphen", () => {
    const slug = slugify("The Extraordinarily Long Name Of A Very Big School");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
    expect(SetupSchema.shape.subdomain.safeParse(slug).success).toBe(true);
  });

  it("normalises typed subdomains without trimming a hyphen mid-word", () => {
    expect(normalizeSubdomainInput("My School_2")).toBe("my-school-2");
    expect(normalizeSubdomainInput("dps-")).toBe("dps-");
    expect(normalizeSubdomainInput("d.p.s!")).toBe("dps");
  });

  it("keeps only digits up to a length", () => {
    expect(digitsOnly("+91 98765-43210", 11)).toBe("91987654321");
    expect(digitsOnly("8340a01", 6)).toBe("834001");
  });

  it("toggles an item in or out of a list without mutating it", () => {
    const days = ["Mon", "Tue"];
    expect(toggleItem(days, "Wed")).toEqual(["Mon", "Tue", "Wed"]);
    expect(toggleItem(days, "Mon")).toEqual(["Tue"]);
    expect(days).toEqual(["Mon", "Tue"]);
  });
});

describe("class groups", () => {
  it("covers every standard class once, in catalogue order", () => {
    expect(CLASS_GROUPS.flatMap((g) => g.classes)).toEqual(CLASSES);
  });

  it("uses the Classes page's group names", () => {
    expect(CLASS_GROUPS.map((g) => g.label)).toEqual([
      "Early Years",
      "Primary",
      "Middle School",
      "Secondary",
      "Senior Secondary",
    ]);
    expect(CLASS_GROUPS[0].classes).toEqual(["Nursery", "LKG", "UKG"]);
  });

  it("describes a selection by count and range", () => {
    expect(describeClasses([])).toBe("No classes selected");
    expect(describeClasses(["UKG"])).toBe("1 class · UKG");
    expect(describeClasses(["Grade 10", "Nursery", "Grade 2"])).toBe(
      "3 classes · Nursery to Grade 10",
    );
  });

  it("describes working days as a range when they run on", () => {
    expect(
      describeWorkingDays(["Sat", "Mon", "Tue", "Wed", "Thu", "Fri"]),
    ).toBe("Mon – Sat");
    expect(describeWorkingDays(["Mon", "Wed", "Fri"])).toBe("Mon, Wed, Fri");
    expect(describeWorkingDays(["Sat", "Sun"])).toBe("Sat, Sun");
    expect(describeWorkingDays([])).toBe("No working days");
  });
});

describe("pincode lookup", () => {
  afterEach(() => vi.unstubAllGlobals());

  const found = [
    {
      Status: "Success",
      PostOffice: [
        { District: "Ranchi", State: "Jharkhand", Country: "India" },
      ],
    },
  ];

  it("reads the district and state from India Post's answer", () => {
    expect(parsePincodeResponse(found)).toEqual({
      city: "Ranchi",
      state: "Jharkhand",
      country: "India",
    });
  });

  it.each([
    [[{ Status: "Error", PostOffice: null }]],
    [[{ Status: "Success", PostOffice: [] }]],
    [{}],
    [null],
  ])("returns null for %j", (data) => {
    expect(parsePincodeResponse(data)).toBeNull();
  });

  it("fetches the pincode and returns null when the service fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => found })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    expect(await lookupPincode("834001")).toMatchObject({ city: "Ranchi" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.postalpincode.in/pincode/834001",
    );
    expect(await lookupPincode("000000")).toBeNull();
  });
});

describe("plans", () => {
  it.each([
    [undefined, TRIAL_PLAN],
    [300, "BASIC"],
    [500, "BASIC"],
    [501, "PRO"],
    [2000, "PRO"],
    [12000, "ENTERPRISE"],
  ])("recommends the cheapest plan with room for %s students", (n, plan) => {
    expect(recommendedPlan(n)).toBe(plan);
  });

  it("says whether a plan has room for the school", () => {
    expect(fitsPlan("BASIC", 499)).toBe(true);
    expect(fitsPlan("BASIC", 1500)).toBe(false);
    expect(fitsPlan("ENTERPRISE", 1_000_000)).toBe(true);
    expect(fitsPlan("BASIC", undefined)).toBe(true);
  });
});

describe("footerCopy", () => {
  const base = {
    choice: "TRIAL" as const,
    hasSavedPayment: false,
    isSubmitting: false,
  };

  it("continues on the form steps", () => {
    expect(footerCopy({ ...base, step: 2 }).label).toBe("Continue");
  });

  it("names the trial, the price, or the saved payment on the last step", () => {
    expect(footerCopy({ ...base, step: 4 })).toEqual({
      label: "Start 14-day free trial",
      note: "No payment needed to start the trial.",
    });
    expect(footerCopy({ ...base, step: 4, choice: "PRO" }).label).toBe(
      "Pay ₹1,999 & create school",
    );
    expect(
      footerCopy({ ...base, step: 4, choice: "PRO", hasSavedPayment: true })
        .label,
    ).toBe("Finish setup");
  });

  it("says what is happening while submitting", () => {
    expect(footerCopy({ ...base, step: 4, isSubmitting: true }).label).toBe(
      "Creating your school…",
    );
    expect(
      footerCopy({ ...base, step: 4, choice: "BASIC", isSubmitting: true })
        .label,
    ).toBe("Opening payment…");
  });
});

describe("browser storage", () => {
  const payment: SavedPayment = {
    plan: "PRO",
    razorpay_order_id: "order_1",
    razorpay_payment_id: "pay_1",
    razorpay_signature: "sig",
  };

  it("keeps a setup payment per user until it is cleared", () => {
    const store = memoryStore();
    writeSavedPayment("u1", payment, store);
    expect(store.data.has(savedPaymentKey("u1"))).toBe(true);
    expect(readSavedPayment("u1", store)).toEqual(payment);
    expect(readSavedPayment("u2", store)).toBeNull();
    writeSavedPayment("u1", null, store);
    expect(readSavedPayment("u1", store)).toBeNull();
  });

  it("ignores a stored payment for an unknown plan or without an id", () => {
    const store = memoryStore();
    store.setItem(
      savedPaymentKey("u1"),
      JSON.stringify({ ...payment, plan: "GOLD" }),
    );
    expect(readSavedPayment("u1", store)).toBeNull();
    store.setItem(
      savedPaymentKey("u1"),
      JSON.stringify({ ...payment, razorpay_payment_id: "" }),
    );
    expect(readSavedPayment("u1", store)).toBeNull();
  });

  it("round-trips a draft and falls back to step 1 for a bad step", () => {
    const store = memoryStore();
    writeDraft("u1", { step: 3, values: { name: "DPS" } }, store);
    expect(readDraft("u1", store)).toEqual({
      step: 3,
      values: { name: "DPS" },
    });

    store.setItem(draftKey("u1"), JSON.stringify({ step: 9, values: {} }));
    expect(readDraft("u1", store)?.step).toBe(1);
  });

  it("treats corrupt or blocked storage as empty", () => {
    const store = memoryStore();
    store.setItem(draftKey("u1"), "{not json");
    expect(readDraft("u1", store)).toBeNull();

    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readSavedPayment("u1", blocked)).toBeNull();
    expect(() =>
      writeDraft("u1", { step: 1, values: {} }, blocked),
    ).not.toThrow();
    expect(() => writeSavedPayment("u1", null, blocked)).not.toThrow();
  });
});
