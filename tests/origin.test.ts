import { describe, expect, it } from "vitest";
import {
  displayHost,
  hostnameOf,
  normalizeOrigin,
  normalizeWebsite,
  originsMatch,
  sameOrigin,
} from "../src/lib/vault/origin";
import { findDuplicate, validateCredential } from "../src/lib/vault/validation";

describe("website normalization", () => {
  it("accepts https, localhost http, and bare hostnames", () => {
    expect(normalizeWebsite("https://example.com/login?a=1")?.origin).toBe(
      "https://example.com",
    );
    expect(normalizeWebsite("example.com")?.origin).toBe("https://example.com");
    expect(normalizeWebsite("http://localhost:3000")?.origin).toBe(
      "http://localhost:3000",
    );
    expect(normalizeWebsite("http://127.0.0.1:3000")?.origin).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("rejects unsafe protocols, credentials, and plain-http remote hosts", () => {
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("ftp://example.com")).toBeNull();
    expect(normalizeWebsite("https://user:pass@example.com")).toBeNull();
    expect(normalizeWebsite("http://example.com")).toBeNull();
    expect(normalizeWebsite("not a url")).toBeNull();
  });

  it("normalizes origins consistently", () => {
    expect(normalizeOrigin("HTTPS://Example.COM:443/login")).toBe("https://example.com");
    expect(normalizeOrigin("chrome://extensions")).toBeNull();
    expect(hostnameOf("https://www.example.com")).toBe("www.example.com");
    expect(displayHost("https://www.example.com/path")).toBe("example.com");
  });
});

describe("strict origin matching", () => {
  it("matches exact origins and the www redirect pair", () => {
    expect(originsMatch("https://example.com", "https://example.com/login")).toBe(true);
    expect(originsMatch("https://www.example.com", "https://example.com")).toBe(true);
    expect(originsMatch("https://example.com", "https://www.example.com/login")).toBe(true);
    expect(sameOrigin("https://example.com/a", "https://example.com/b")).toBe(true);
  });

  it("does not match lookalikes, subdomains, protocols, or ports", () => {
    expect(originsMatch("https://example.com", "https://example.com.evil.test")).toBe(false);
    expect(originsMatch("https://example.com", "https://app.example.com")).toBe(false);
    expect(originsMatch("https://example.com", "http://localhost:3000")).toBe(false);
    expect(originsMatch("http://localhost:3000", "http://localhost:3001")).toBe(false);
    expect(originsMatch("https://example.com", "https://example.com:8443")).toBe(false);
    expect(originsMatch("https://example.com", "javascript:alert(1)")).toBe(false);
  });
});

describe("credential validation", () => {
  it("accepts a complete credential and reports missing fields", () => {
    expect(
      validateCredential({
        applicationName: "Example",
        websiteUrl: "https://example.com",
        username: "ada@example.com",
        password: "secret",
        notes: "",
      }),
    ).toEqual({});

    const errors = validateCredential({
      applicationName: "",
      websiteUrl: "ftp://example.com",
      username: "",
      password: "",
      notes: "",
    });
    expect(errors.applicationName).toBeTruthy();
    expect(errors.websiteUrl).toBeTruthy();
    expect(errors.username).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it("finds duplicates on the same site and username, case-insensitively", () => {
    const credentials = [
      {
        id: "a",
        websiteUrl: "https://example.com/login",
        username: "Ada@Example.com",
      },
      {
        id: "b",
        websiteUrl: "https://other.test",
        username: "ada@example.com",
      },
    ];
    expect(findDuplicate(credentials, "https://www.example.com", "ada@example.com")?.id).toBe(
      "a",
    );
    expect(
      findDuplicate(credentials, "https://example.com", "ada@example.com", "a"),
    ).toBeUndefined();
  });
});
