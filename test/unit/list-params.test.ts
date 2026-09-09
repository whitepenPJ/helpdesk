import { describe, it, expect } from "vitest";
import { parseListParams } from "@/app/lib/list-params";

const COLUMNS = ["name", "createdAt"] as const;
const DEFAULT_SORT = { column: "createdAt", dir: "desc" } as const;

describe("parseListParams", () => {
  it("returns sensible defaults for an empty search-params object", () => {
    expect(parseListParams({}, COLUMNS, DEFAULT_SORT)).toEqual({
      query: "",
      currentPage: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortDir: "desc",
      linkQuery: { pageSize: "20" },
    });
  });

  it("parses q, page, pageSize, sort and dir together", () => {
    const result = parseListParams(
      { q: "acme", page: "3", pageSize: "50", sort: "name", dir: "asc" },
      COLUMNS,
      DEFAULT_SORT
    );
    expect(result).toEqual({
      query: "acme",
      currentPage: 3,
      pageSize: 50,
      sortBy: "name",
      sortDir: "asc",
      linkQuery: { q: "acme", pageSize: "50" },
    });
  });

  it("clamps page to a minimum of 1 for zero, negative or non-numeric input", () => {
    expect(parseListParams({ page: "0" }, COLUMNS, DEFAULT_SORT).currentPage).toBe(1);
    expect(parseListParams({ page: "-5" }, COLUMNS, DEFAULT_SORT).currentPage).toBe(1);
    expect(parseListParams({ page: "abc" }, COLUMNS, DEFAULT_SORT).currentPage).toBe(1);
  });

  it("ignores array-valued and unknown params", () => {
    const result = parseListParams({ q: ["a", "b"], sort: ["name"] }, COLUMNS, DEFAULT_SORT);
    expect(result.query).toBe("");
    expect(result.sortBy).toBe("createdAt");
  });

  it("omits q from linkQuery when there is no query", () => {
    expect(parseListParams({ pageSize: "100" }, COLUMNS, DEFAULT_SORT).linkQuery).toEqual({ pageSize: "100" });
  });

  it("rejects a sort column outside the allowed set", () => {
    expect(parseListParams({ sort: "secret" }, COLUMNS, DEFAULT_SORT).sortBy).toBe("createdAt");
  });
});
