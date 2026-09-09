import { describe, it, expect } from "vitest";
import { formatAssignment } from "@/app/lib/ticket-format";

describe("formatAssignment", () => {
  it("returns 'Unassigned' when there are no assignees or groups", () => {
    expect(formatAssignment([], [])).toBe("Unassigned");
  });

  it("joins multiple individual assignees with commas", () => {
    expect(formatAssignment(["Alice", "Bob"], [])).toBe("Alice, Bob");
  });

  it("shows only the group when there is no individual assignee", () => {
    expect(formatAssignment([], ["Network Team"])).toBe("Network Team");
  });

  it("separates assignees and groups with ' / '", () => {
    expect(formatAssignment(["Alice"], ["Network Team"])).toBe("Alice / Network Team");
  });

  it("combines multiple assignees and multiple groups", () => {
    expect(formatAssignment(["Alice", "Bob"], ["Net", "Ops"])).toBe("Alice, Bob / Net, Ops");
  });
});
