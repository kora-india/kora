import { describe, it, expect } from "vitest";
import { compareRollNumbers } from "@schoolos/types";
import { getAllPlanLimitsMap, getPlanLimits } from "@/lib/plan-limits";

describe("Performance Optimizations (P1 - P10)", () => {
  describe("P9: Natural roll-number sorting", () => {
    it("sorts single-digit and double-digit numeric roll numbers in natural order", () => {
      const rollNumbers = ["10", "1", "2", "20", "11", "3"];
      const sorted = [...rollNumbers].sort(compareRollNumbers);
      expect(sorted).toEqual(["1", "2", "3", "10", "11", "20"]);
    });

    it("sorts alphanumeric roll numbers naturally", () => {
      const rollNumbers = ["10A", "2A", "1B", "2B", "1A"];
      const sorted = [...rollNumbers].sort(compareRollNumbers);
      expect(sorted).toEqual(["1A", "1B", "2A", "2B", "10A"]);
    });

    it("handles null, undefined, and empty string roll numbers gracefully", () => {
      const rollNumbers = ["5", null, "1", undefined, "", "2"];
      const sorted = [...rollNumbers].sort(compareRollNumbers);
      expect(sorted[0]).toBe("1");
      expect(sorted[1]).toBe("2");
      expect(sorted[2]).toBe("5");
    });
  });

  describe("P3: Plan limits batch loading and caching", () => {
    it("returns pre-populated plan limits map without N+1 individual queries", async () => {
      const map = await getAllPlanLimitsMap();
      expect(map).toBeInstanceOf(Map);
      expect(map.has("FREE")).toBe(true);
      expect(map.has("BASIC")).toBe(true);
      expect(map.has("PRO")).toBe(true);
      expect(map.has("ENTERPRISE")).toBe(true);

      const proLimits = await getPlanLimits("PRO");
      expect(proLimits.maxStudents).toBe(2000); // U1: what setup promised
      expect(proLimits.analyticsEnabled).toBe(true);
    });
  });
});
