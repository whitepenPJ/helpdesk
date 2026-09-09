import { describe, it, expect } from "vitest";
import { isNonEmptyString, isBlank, stripHtml, excerpt, textToSafeHtml } from "@/app/lib/text";

describe("isNonEmptyString", () => {
  it("is true for a string with non-whitespace content", () => {
    expect(isNonEmptyString("a")).toBe(true);
    expect(isNonEmptyString("  hello  ")).toBe(true);
  });

  it("is false for empty or whitespace-only strings", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString("\t\n")).toBe(false);
  });

  it("is false for null, undefined and non-strings", () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(0)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString({})).toBe(false);
    expect(isNonEmptyString([])).toBe(false);
    expect(isNonEmptyString(["x"])).toBe(false);
  });

  it("narrows the type so .trim() is available afterwards", () => {
    const value: unknown = "  padded  ";
    if (isNonEmptyString(value)) {
      expect(value.trim()).toBe("padded");
    } else {
      throw new Error("expected the guard to pass");
    }
  });
});

describe("isBlank", () => {
  it("is the exact inverse of isNonEmptyString", () => {
    for (const v of ["", "  ", null, undefined, 0, {}, "x", " y "]) {
      expect(isBlank(v)).toBe(!isNonEmptyString(v));
    }
  });
});

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello   <b>world</b></p>")).toBe("Hello world");
  });

  it("trims leading/trailing whitespace left by removed tags", () => {
    expect(stripHtml("  <div> spaced </div>  ")).toBe("spaced");
  });

  it("returns an empty string for markup with no text", () => {
    expect(stripHtml("<br><hr/>")).toBe("");
  });
});

describe("excerpt", () => {
  it("returns the full stripped text when under the limit", () => {
    expect(excerpt("<p>short</p>", 160)).toBe("short");
  });

  it("truncates and appends an ellipsis when over the limit", () => {
    const result = excerpt("<p>abcdefghij</p>", 5);
    expect(result).toBe("abcde…");
  });

  it("trims trailing whitespace before the ellipsis", () => {
    // stripHtml collapses the run of spaces to one; slice(0, 3) is "ab ",
    // then trimEnd drops the space before the ellipsis is appended.
    expect(excerpt("ab    cdef", 3)).toBe("ab…");
  });

  it("defaults the limit to 160 characters", () => {
    const long = "x".repeat(200);
    expect(excerpt(long)).toBe(`${"x".repeat(160)}…`);
  });
});

describe("textToSafeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(textToSafeHtml("a < b & c > d")).toBe("<p>a &lt; b &amp; c &gt; d</p>");
  });

  it("wraps each non-empty line in its own <p>", () => {
    expect(textToSafeHtml("one\ntwo")).toBe("<p>one</p><p>two</p>");
  });

  it("drops blank lines produced by consecutive newlines", () => {
    expect(textToSafeHtml("one\n\n\ntwo")).toBe("<p>one</p><p>two</p>");
  });

  it("does not double-escape ampersands", () => {
    expect(textToSafeHtml("Tom & Jerry < friends")).toBe("<p>Tom &amp; Jerry &lt; friends</p>");
  });
});
