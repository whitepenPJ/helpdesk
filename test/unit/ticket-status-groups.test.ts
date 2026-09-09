import { describe, it, expect } from "vitest";
import {
  OPEN_STATUSES,
  AWAITING_CLOSE_STATUSES,
  STATUS_FILTER_PRESETS,
  toStatusBucket,
} from "@/app/lib/ticket-status-groups";

describe("status constants", () => {
  it("treats NEW / ASSIGNED / REOPENED as open", () => {
    expect(OPEN_STATUSES).toEqual(["NEW", "ASSIGNED", "REOPENED"]);
  });

  it("treats RESOLVED as awaiting customer close", () => {
    expect(AWAITING_CLOSE_STATUSES).toEqual(["RESOLVED"]);
  });

  it("keeps the filter presets pointed at the shared status arrays", () => {
    const open = STATUS_FILTER_PRESETS.find((p) => p.statuses === OPEN_STATUSES);
    const awaiting = STATUS_FILTER_PRESETS.find((p) => p.statuses === AWAITING_CLOSE_STATUSES);
    expect(open).toBeDefined();
    expect(awaiting).toBeDefined();
    expect(STATUS_FILTER_PRESETS.map((p) => p.label)).toContain("Pending Approval");
  });
});

describe("toStatusBucket", () => {
  it("buckets active work that needs attention now", () => {
    for (const s of ["NEW", "ASSIGNED", "REOPENED"] as const) {
      expect(toStatusBucket(s)).toBe("Active");
    }
  });

  it("buckets WAITING as Processing (blocked on approval)", () => {
    expect(toStatusBucket("WAITING")).toBe("Processing");
  });

  it("buckets RESOLVED and CLOSED as Done", () => {
    expect(toStatusBucket("RESOLVED")).toBe("Done");
    expect(toStatusBucket("CLOSED")).toBe("Done");
  });
});
