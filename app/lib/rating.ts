import type { Rating } from "@/app/generated/prisma/client";

export const RATING_SCALE = [
  { score: 1, icon: "bi-emoji-angry", label: "Very Dissatisfied" },
  { score: 2, icon: "bi-emoji-frown", label: "Dissatisfied" },
  { score: 3, icon: "bi-emoji-neutral", label: "Neutral" },
  { score: 4, icon: "bi-emoji-smile", label: "Satisfied" },
  { score: 5, icon: "bi-emoji-laughing", label: "Very Satisfied" },
] as const;

// The legacy 3-tier Rating enum is kept in sync via a simple mapping so
// anything still reading it (nothing currently does, but it's a real live
// column) gets a sensible value from the 5-point score.
export function mapScoreToRating(score: number): Rating {
  if (score <= 2) return "NEEDS_IMPROVEMENT";
  if (score === 3) return "FAIRLY_SATISFIED";
  return "FULLY_SATISFIED";
}
