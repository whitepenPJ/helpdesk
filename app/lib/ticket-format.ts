export function formatAssignment(assigneeName?: string | null, groupName?: string | null): string {
  const parts = [assigneeName, groupName].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" / ") : "Unassigned";
}
