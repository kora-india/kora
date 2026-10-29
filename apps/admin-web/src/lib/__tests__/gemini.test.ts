import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateAiScheduleDraft, type AiTimetableRequest } from "../gemini";

const request: AiTimetableRequest = {
  className: "Class 4",
  sectionName: "A",
  daysOfWeek: [1],
  periods: [
    {
      periodNumber: 1,
      name: "P1",
      startTime: "08:00",
      endTime: "08:45",
      isBreak: false,
    },
  ],
  subjects: [{ subjectName: "Maths", periodsPerWeek: 1 }],
};

const reply = (text: string, status = 200) =>
  new Response(
    status === 200
      ? JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })
      : text,
    { status },
  );

const slot = {
  dayOfWeek: 1,
  periodNumber: 1,
  startTime: "08:00",
  endTime: "08:45",
  subjectName: "Maths",
};

describe("generateAiScheduleDraft", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-test");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns the slots and rationale Gemini drafts", async () => {
    fetchMock.mockResolvedValue(
      reply(JSON.stringify({ slots: [slot], rationale: "Maths first." })),
    );

    expect(await generateAiScheduleDraft(request)).toEqual({
      slots: [slot],
      rationale: "Maths first.",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig).toEqual({
      responseMimeType: "application/json",
      temperature: 0.2,
    });
    expect(body.contents[0].parts[0].text).toContain("Maths: 1 periods/week");
  });

  it("retries a busy model once, then answers", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(reply("busy", 503))
      .mockResolvedValueOnce(reply(JSON.stringify({ slots: [slot] })));

    const draft = generateAiScheduleDraft(request);
    await vi.advanceTimersByTimeAsync(1500);

    const result = await draft;
    expect(result.slots).toEqual([slot]);
    expect(result.rationale).toContain("gemini-test");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("gemini-test"),
      expect.stringContaining("gemini-test"),
    ]);
  });

  it("moves to the next model when one fails, and reports an empty answer", async () => {
    fetchMock.mockImplementation(async () => reply(""));

    await expect(generateAiScheduleDraft(request)).rejects.toThrow(
      /empty response/,
    );
    // Every model was tried once.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("needs an API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    await expect(generateAiScheduleDraft(request)).rejects.toThrow(
      /API key is not configured/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
