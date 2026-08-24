export function formatAssignment(assigneeNames: string[], groupNames: string[]): string {
  const assignee = assigneeNames.length ? assigneeNames.join(", ") : null;
  const group = groupNames.length ? groupNames.join(", ") : null;
  return assignee || group ? [assignee, group].filter(Boolean).join(" / ") : "Unassigned";
}
