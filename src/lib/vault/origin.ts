const SAFE_PROTOCOLS = new Set(["https:", "http:"]);

export function normalizeWebsite(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
    if (!url.hostname || !url.hostname.includes(".")) {
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
    }
    if (url.username || url.password) return null;
    if (url.protocol === "http:" && !isLoopback(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function normalizeOrigin(value: string): string | null {
  const url = normalizeWebsite(value);
  return url ? url.origin.toLowerCase() : null;
}

export function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Strict site matching for autofill. Exact origins always match. A saved
 * `www.` host may match its bare host (and vice versa) on the same protocol
 * and port, which covers the common redirect pattern without enabling fuzzy
 * or lookalike matching.
 */
export function originsMatch(savedWebsite: string, currentUrl: string): boolean {
  const saved = normalizeWebsite(savedWebsite);
  const current = normalizeWebsite(currentUrl);
  if (!saved || !current) return false;
  if (saved.origin.toLowerCase() === current.origin.toLowerCase()) return true;
  if (saved.protocol !== current.protocol) return false;
  if (saved.port !== current.port) return false;
  return stripWww(saved.hostname) === stripWww(current.hostname);
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin.toLowerCase() === new URL(b).origin.toLowerCase();
  } catch {
    return false;
  }
}

export function hostnameOf(value: string): string | null {
  const url = normalizeWebsite(value);
  return url ? url.hostname.toLowerCase() : null;
}

export function displayHost(value: string): string {
  const url = normalizeWebsite(value);
  if (!url) return value;
  return url.hostname.replace(/^www\./, "");
}
