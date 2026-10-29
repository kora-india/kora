import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({
  requirePermission: mocks.requirePermission,
  isError: (r: unknown) => typeof r === "object" && r !== null && "error" in r,
}));
vi.mock("@/lib/ratelimit", () => ({ aiRatelimit: { limit: mocks.limit } }));

import { suggestImportMapping } from "../import-mapping";

/** A Gemini generateContent reply whose text is `answer` as JSON. */
const geminiReply = (answer: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

const columns = [
  { header: "छात्र का नाम", description: "text of about 2 words" },
  { header: "F/N", description: "text of about 2 words" },
  { header: "Religion", description: "repeating values: Hindu, Muslim" },
];

describe("suggestImportMapping", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      id: "user-1",
      schoolId: "school-1",
      role: "SCHOOL_ADMIN",
    });
    mocks.limit.mockResolvedValue({ success: true });
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-test");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns Gemini's field for each column", async () => {
    fetchMock.mockResolvedValue(
      geminiReply({
        columns: [
          { header: "छात्र का नाम", field: "name" },
          { header: "F/N", field: "fatherName" },
          { header: "Religion", field: "ignore" },
        ],
      }),
    );

    const result = await suggestImportMapping({
      columns,
      taken: ["parentPhone"],
    });

    expect(result).toEqual({
      suggestions: {
        "छात्र का नाम": "name",
        "F/N": "fatherName",
        Religion: null,
      },
    });
  });

  it("sends only headers and descriptions, and forces an answer from our fields", async () => {
    fetchMock.mockResolvedValue(geminiReply({ columns: [] }));

    await suggestImportMapping({ columns, taken: ["parentPhone"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/models/gemini-test:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain('"F/N": text of about 2 words');
    expect(prompt).toContain('"छात्र का नाम"');
    // Already matched by the rules, so Gemini is told not to use it.
    expect(body.systemInstruction.parts[0].text).toContain(
      "already matched to other columns: parentPhone",
    );
    const fieldSchema =
      body.generationConfig.responseSchema.properties.columns.items.properties
        .field;
    expect(fieldSchema.enum).toContain("parentName");
    expect(fieldSchema.enum).toContain("ignore");
    expect(body.generationConfig.temperature).toBe(0);
  });

  it("drops answers for other headers, unknown fields, taken or repeated fields", async () => {
    fetchMock.mockResolvedValue(
      geminiReply({
        columns: [
          { header: "छात्र का नाम", field: "name" },
          { header: "F/N", field: "name" }, // name is used once already
          { header: "Religion", field: "parentPhone" }, // taken by the rules
          { header: "Not asked", field: "city" },
          { header: "Religion", field: "caste" },
        ],
      }),
    );

    const result = await suggestImportMapping({
      columns,
      taken: ["parentPhone"],
    });

    expect(result).toEqual({
      suggestions: { "छात्र का नाम": "name", "F/N": null, Religion: null },
    });
  });

  it("says AI isn't set up when there's no Gemini key, without calling it", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    expect(await suggestImportMapping({ columns })).toEqual({
      available: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers with a message instead of throwing when Gemini fails", async () => {
    fetchMock.mockImplementation(
      async () => new Response("boom", { status: 500 }),
    );

    const result = await suggestImportMapping({ columns });

    expect(result).toEqual({
      error: "AI couldn't match the columns right now. Match them below.",
    });
    // The configured model, then one fallback.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats an answer that isn't the expected JSON as a failure", async () => {
    fetchMock.mockImplementation(async () =>
      geminiReply({ something: "else" }),
    );

    expect(await suggestImportMapping({ columns })).toHaveProperty("error");
  });

  it("is limited per person", async () => {
    mocks.limit.mockResolvedValue({ success: false });

    expect(await suggestImportMapping({ columns })).toEqual({
      error: "AI matching is busy for your account. Match the columns below.",
    });
    expect(mocks.limit).toHaveBeenCalledWith("ai:import:user-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("needs permission to manage students", async () => {
    mocks.requirePermission.mockResolvedValue({ error: "Forbidden" });

    expect(await suggestImportMapping({ columns })).toEqual({
      error: "Forbidden",
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith("students", "manage");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses input that isn't a list of columns", async () => {
    expect(await suggestImportMapping({ columns: [] })).toHaveProperty("error");
    expect(
      await suggestImportMapping({
        columns: [{ header: "x".repeat(101), description: "" }],
      }),
    ).toHaveProperty("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
