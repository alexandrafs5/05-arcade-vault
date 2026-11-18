// Open-redirect guard for the `next` query param (SPEC 15): only same-origin
// paths are accepted ("/x" yes; "//evil.com", "/\evil.com" and "https://..." no).
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
