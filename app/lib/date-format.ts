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

export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// `<input type="datetime-local">` needs "YYYY-MM-DDTHH:mm" in the browser's
// local time — toISOString() would shift to UTC and desync from what the
// user sees on screen.
export function toDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
