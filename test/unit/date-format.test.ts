import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatTime, toDateTimeLocalValue } from "@/app/lib/date-format";

// Constructed with the local-time Date constructor so these assertions hold
// regardless of the machine's timezone — the formatters all read local
// getters (getDate/getHours/...), never UTC.
const d = new Date(2026, 8, 7, 9, 5, 3); // 7 Sep 2026, 09:05:03 local

describe("formatDate", () => {
  it("formats as dd/mm/yyyy with zero-padding", () => {
    expect(formatDate(d)).toBe("07/09/2026");
  });

  it("does not pad the four-digit year", () => {
    expect(formatDate(new Date(2026, 11, 25, 0, 0, 0))).toBe("25/12/2026");
  });
});

describe("formatDateTime", () => {
  it("appends zero-padded hh:mm:ss", () => {
    expect(formatDateTime(d)).toBe("07/09/2026 09:05:03");
  });
});

describe("formatTime", () => {
  it("returns zero-padded hh:mm only", () => {
    expect(formatTime(d)).toBe("09:05");
  });
});

describe("toDateTimeLocalValue", () => {
  it("returns YYYY-MM-DDTHH:mm for <input type=datetime-local>", () => {
    expect(toDateTimeLocalValue(d)).toBe("2026-09-07T09:05");
  });
});
