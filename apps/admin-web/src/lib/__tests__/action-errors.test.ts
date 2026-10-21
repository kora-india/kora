import { describe, it, expect } from "vitest";
import { Prisma } from "@schoolos/db";
import { actionErrorMessage, toActionResult } from "../action-errors";
import { unwrapAction } from "../action-result";

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("raw prisma text", {
    code,
    clientVersion: "5.22.0",
    meta,
  });

describe("action errors (U4)", () => {
  it("turns known database errors into plain sentences", () => {
    expect(
      actionErrorMessage(known("P2002", { target: ["schoolId", "receiptNo"] })),
    ).toBe("That receipt number is already in use.");
    expect(
      actionErrorMessage(known("P2002", { target: "users_email_key" })),
    ).toBe("That email address is already in use.");
    expect(actionErrorMessage(known("P2003"))).toMatch(
      /linked to other records/,
    );
    expect(actionErrorMessage(known("P2025"))).toMatch(/no longer exists/);
  });

  it("hides other database errors and keeps the app's own messages", () => {
    expect(actionErrorMessage(known("P2034"), "Couldn't save")).toBe(
      "Couldn't save",
    );
    expect(actionErrorMessage(new Error("Exam not found"))).toBe(
      "Exam not found",
    );
    expect(actionErrorMessage("boom")).toMatch(/Something went wrong/);
  });

  it("carries the message through a result and back", async () => {
    const failed = await toActionResult(async () => {
      throw new Error("Section not found");
    });
    expect(failed).toEqual({ error: "Section not found" });
    expect(() => unwrapAction(failed)).toThrow("Section not found");
    expect(unwrapAction(await toActionResult(async () => 7))).toBe(7);
  });
});
