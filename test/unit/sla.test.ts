import { describe, it, expect, vi } from "vitest";

// sla.ts pulls in the Prisma client via "@/app/lib/db" for its one DB
// helper (getFirstAssignedAtByTicket). The pure functions under test need
// nothing from it, so stub the module rather than open a real pool.
vi.mock("@/app/lib/db", () => ({ prisma: {} }));

import { slaDays, slaDaysLabel } from "@/app/lib/sla";

describe("slaDays", () => {
  it("returns whole days between assignment and resolution", () => {
    const assigned = new Date("2026-09-01T00:00:00Z");
    const resolved = new Date("2026-09-04T00:00:00Z");
    expect(slaDays(assigned, resolved)).toBe(3);
  });

  it("returns a fractional value for a same-day turnaround", () => {
    const assigned = new Date("2026-09-01T00:00:00Z");
    const resolved = new Date("2026-09-01T12:00:00Z");
    expect(slaDays(assigned, resolved)).toBe(0.5);
  });

  it("can go negative if resolved precedes assigned (bad data)", () => {
    const assigned = new Date("2026-09-02T00:00:00Z");
    const resolved = new Date("2026-09-01T00:00:00Z");
    expect(slaDays(assigned, resolved)).toBe(-1);
  });
});

describe("slaDaysLabel", () => {
  it("formats a number to one decimal place with a 'd' suffix", () => {
    expect(slaDaysLabel(3)).toBe("3.0d");
    expect(slaDaysLabel(0.5)).toBe("0.5d");
    expect(slaDaysLabel(2.345)).toBe("2.3d");
  });

  it("renders an em dash for null", () => {
    expect(slaDaysLabel(null)).toBe("—");
  });
});
