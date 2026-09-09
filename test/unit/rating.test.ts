import { describe, it, expect } from "vitest";
import { RATING_SCALE, mapScoreToRating } from "@/app/lib/rating";

describe("RATING_SCALE", () => {
  it("is a contiguous 1..5 scale", () => {
    expect(RATING_SCALE.map((r) => r.score)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("mapScoreToRating", () => {
  it("maps 1 and 2 to NEEDS_IMPROVEMENT", () => {
    expect(mapScoreToRating(1)).toBe("NEEDS_IMPROVEMENT");
    expect(mapScoreToRating(2)).toBe("NEEDS_IMPROVEMENT");
  });

  it("maps 3 to FAIRLY_SATISFIED", () => {
    expect(mapScoreToRating(3)).toBe("FAIRLY_SATISFIED");
  });

  it("maps 4 and 5 to FULLY_SATISFIED", () => {
    expect(mapScoreToRating(4)).toBe("FULLY_SATISFIED");
    expect(mapScoreToRating(5)).toBe("FULLY_SATISFIED");
  });

  it("clamps out-of-range scores to the nearest tier", () => {
    expect(mapScoreToRating(0)).toBe("NEEDS_IMPROVEMENT");
    expect(mapScoreToRating(9)).toBe("FULLY_SATISFIED");
  });
});
