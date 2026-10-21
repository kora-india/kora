import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const { afterMock, generate } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: afterMock,
}));
vi.mock("@/lib/services/fee-generation-service", () => ({
  processClassFeeGeneration: generate,
}));

import { prisma, purgeSchool } from "@schoolos/db";
import { GET } from "../route";
import { calendarDateInTimeZone } from "@/lib/fees/timezone";

const run = Math.random().toString(36).slice(2, 8);
// Sorted ahead of any other school, so a batch of one is always ours.
const ids = ["a", "b", "c"].map((s) => `0000-cron-${run}-${s}`);
const [schoolA, schoolB, schoolC] = ids;
const period = calendarDateInTimeZone("Asia/Kolkata").slice(0, 7);
const classIds: Record<string, string[]> = {};

const call = (search: string, secret = "test-secret") =>
  GET(
    new Request(`https://app.test/api/cron/generate-fees${search}`, {
      headers: { authorization: `Bearer ${secret}` },
    }),
  );

const billedFor = async (id: string) =>
  (await prisma.school.findUniqueOrThrow({ where: { id } })).lastAutoFeePeriod;

describe("monthly fee cron", () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = "test-secret";
    for (const [i, id] of ids.entries()) {
      await prisma.school.create({
        data: {
          id,
          name: `Cron ${"ABC"[i]}`,
          subdomain: `cron-${run}-${i}`,
          timezone: "Asia/Kolkata",
          // C was already billed this month.
          lastAutoFeePeriod: id === schoolC ? period : null,
        },
      });
      await prisma.academicSession.create({
        data: {
          schoolId: id,
          name: "Current",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
          isCurrent: true,
        },
      });
      classIds[id] = [];
      for (const grade of [1, 2]) {
        const cls = await prisma.class.create({
          data: { schoolId: id, name: `${grade}`, grade },
        });
        classIds[id].push(cls.id);
      }
    }
  });

  beforeEach(() => {
    afterMock.mockReset();
    generate.mockReset();
    generate.mockResolvedValue({ success: true, generatedCount: 1 });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    for (const id of ids) await purgeSchool(prisma, id);
  });

  it("refuses a request without the secret", async () => {
    const res = await call("", "wrong-secret");
    expect(res.status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });

  it("bills a batch, marks the school done and starts the next run", async () => {
    const res = await call("?limit=1");
    const body = await res.json();

    expect(body.details).toEqual([
      expect.objectContaining({
        school: "Cron A",
        generated: 2,
        complete: true,
      }),
    ]);
    expect(body).toMatchObject({
      resumable: true,
      continued: true,
      nextCursor: schoolA,
    });
    expect(await billedFor(schoolA)).toBe(period);

    // The hand-off calls this route again, after A, with the same secret.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));
    expect(afterMock).toHaveBeenCalledTimes(1);
    await afterMock.mock.calls[0][0]();
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/cron/generate-fees");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cursor: schoolA,
      limit: "1",
      hop: "1",
    });
    expect(init.headers).toEqual({ authorization: "Bearer test-secret" });
    fetchSpy.mockRestore();
  });

  it("continues after the cursor and skips schools already billed", async () => {
    const body = await (await call(`?limit=1&cursor=${schoolA}&hop=1`)).json();
    expect(body.details[0]).toMatchObject({ school: "Cron B", complete: true });
    expect(body.hop).toBe(1);
    expect(await billedFor(schoolB)).toBe(period);

    // A run from the start finds all three done.
    generate.mockClear();
    await call("?limit=50");
    const touched = new Set(generate.mock.calls.map((c) => c[0]));
    expect(ids.some((id) => touched.has(id))).toBe(false);
  });

  it("leaves a school unbilled after a retryable error, not after a config gap", async () => {
    await prisma.school.update({
      where: { id: schoolA },
      data: { lastAutoFeePeriod: null },
    });
    generate.mockImplementation(async (_s, _session, classId) =>
      classId === classIds[schoolA][1]
        ? { error: "deadlock detected", retryable: true }
        : { success: true, generatedCount: 1 },
    );
    let body = await (await call(`?schoolId=${schoolA}`)).json();
    expect(body.details[0]).toMatchObject({ complete: false, generated: 1 });
    expect(body.resumable).toBe(false);
    expect(afterMock).not.toHaveBeenCalled();
    expect(await billedFor(schoolA)).toBeNull();

    generate.mockImplementation(async () => ({
      error: "No active students in this class",
    }));
    body = await (await call(`?schoolId=${schoolA}`)).json();
    expect(body.details[0]).toMatchObject({ complete: true });
    expect(await billedFor(schoolA)).toBe(period);
  });

  it("stops at the time budget and hands the unfinished school on", async () => {
    await prisma.school.updateMany({
      where: { id: { in: [schoolA, schoolB] } },
      data: { lastAutoFeePeriod: null },
    });
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    // Each class takes 41 seconds, past the 40-second budget.
    generate.mockImplementation(async () => {
      clock += 41_000;
      return { success: true, generatedCount: 1 };
    });

    const body = await (await call("?limit=50")).json();
    expect(body.details).toEqual([
      expect.objectContaining({
        school: "Cron A",
        generated: 1,
        complete: false,
      }),
    ]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(await billedFor(schoolA)).toBeNull();
    // A is redone from the start of the list by the next run.
    expect(body).toMatchObject({
      resumable: true,
      continued: true,
      nextCursor: null,
    });
    vi.mocked(performance.now).mockRestore();
  });
});
