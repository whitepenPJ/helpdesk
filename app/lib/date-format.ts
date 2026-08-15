// System-wide date formatting: dd/mm/yyyy, or dd/mm/yyyy hh:mm:ss when a
// time is needed. Deliberately not `toLocaleDateString()`/`toLocaleString()`
// — those follow the browser's locale, which doesn't match this app's fixed
// display format.
function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
