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
