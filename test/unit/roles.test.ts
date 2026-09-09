import { describe, it, expect } from "vitest";
import { getHomePathForRole, ROLE_LABEL } from "@/app/lib/roles";

describe("getHomePathForRole", () => {
  it("sends an admin to the dashboard", () => {
    expect(getHomePathForRole("ADMIN")).toBe("/dashboard");
  });

  it("sends a supervisor to the approval queue", () => {
    expect(getHomePathForRole("SUPERVISOR")).toBe("/tickets/approval");
  });

  it("sends a plain user to their tickets", () => {
    expect(getHomePathForRole("USER")).toBe("/tickets");
  });
});

describe("ROLE_LABEL", () => {
  it("shows SUPERVISOR as 'Approver' in the UI while keeping the enum value", () => {
    expect(ROLE_LABEL.SUPERVISOR).toBe("Approver");
  });

  it("labels the other roles plainly", () => {
    expect(ROLE_LABEL.ADMIN).toBe("Admin");
    expect(ROLE_LABEL.USER).toBe("User");
  });
});
