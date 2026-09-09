import { describe, it, expect } from "vitest";
import { parsePageSize, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "@/app/lib/page-size";

describe("parsePageSize", () => {
  it("accepts each of the allowed options", () => {
    for (const option of PAGE_SIZE_OPTIONS) {
      expect(parsePageSize(String(option))).toBe(option);
    }
  });

  it("falls back to the default for undefined", () => {
    expect(parsePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("falls back to the default for a value not in the option set", () => {
    expect(parsePageSize("35")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("0")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("-20")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("falls back to the default for non-numeric input", () => {
    expect(parsePageSize("lots")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("")).toBe(DEFAULT_PAGE_SIZE);
  });
});
