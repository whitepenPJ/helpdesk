// True only when `value` is a string with at least one non-whitespace
// character — i.e. false for null, undefined, non-strings, "" and "   ".
// Narrows to `string` so callers can `.trim()` afterwards without a recheck.
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Inverse of isNonEmptyString — reads better in guard clauses that bail out
// on missing/blank input.
export function isBlank(value: unknown): boolean {
  return !isNonEmptyString(value);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(html: string, maxLength = 160): string {
  const text = stripHtml(html);
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

// HTML-escapes plain text and wraps each non-empty line in <p>, producing
// output safe to render via dangerouslySetInnerHTML alongside genuinely
// Tiptap-authored HTML in the same field. Escaping order matters: & first,
// then </>, so entities produced by escaping aren't themselves re-escaped.
// Don't extend this to emit links/attributes without redoing this analysis.
export function textToSafeHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}
