import { describe, it, expect } from "vitest";
import { parseSort } from "@/app/lib/table-sort";

const COLUMNS = ["name", "createdAt", "status"] as const;
const FALLBACK = { column: "createdAt", dir: "desc" } as const;

describe("parseSort", () => {
  it("uses a recognized column and explicit direction", () => {
    expect(parseSort("name", "asc", COLUMNS, FALLBACK)).toEqual({ sortBy: "name", sortDir: "asc" });
  });

  it("falls back to the default column when the param is missing", () => {
    expect(parseSort(undefined, "asc", COLUMNS, FALLBACK)).toEqual({ sortBy: "createdAt", sortDir: "asc" });
  });

  it("falls back to the default column when the param is not in the allowed list", () => {
    expect(parseSort("droptable", "asc", COLUMNS, FALLBACK)).toEqual({ sortBy: "createdAt", sortDir: "asc" });
  });

  it("falls back to the default direction when dir is missing or garbage", () => {
    expect(parseSort("name", undefined, COLUMNS, FALLBACK).sortDir).toBe("desc");
    expect(parseSort("name", "sideways", COLUMNS, FALLBACK).sortDir).toBe("desc");
  });

  it("honors an explicit direction that differs from the fallback", () => {
    expect(parseSort("status", "asc", COLUMNS, { column: "status", dir: "desc" }).sortDir).toBe("asc");
  });
});
