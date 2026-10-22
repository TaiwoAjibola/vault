export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/app";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/app";
  if (value.includes("://")) return "/app";
  return value;
}
