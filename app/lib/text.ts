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
