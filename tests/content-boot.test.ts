// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (message: unknown, sender: unknown, sendResponse: (value: unknown) => void) => boolean;

const listeners: Listener[] = [];

function stubChrome(): void {
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: {
        id: "keyhold-test",
        onMessage: {
          addListener: (listener: Listener) => listeners.push(listener),
        },
        sendMessage: vi.fn(async () => ({
          ok: true,
          data: { signedIn: false, unlocked: false, matches: [], enabled: true },
        })),
      },
    },
  });
}

beforeEach(() => {
  listeners.length = 0;
  document.documentElement.innerHTML = "<head></head><body></body>";
  stubChrome();
  vi.resetModules();
  // The content script polls for SPA navigation; the timer is irrelevant here.
  vi.spyOn(window, "setInterval").mockReturnValue(0 as never);
  delete (window as unknown as { __keyholdLoaded?: boolean }).__keyholdLoaded;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("content script bootstrap", () => {
  it("mounts the panel without throwing during module evaluation", async () => {
    await expect(import("../extension/src/content")).resolves.toBeDefined();

    const host = document.getElementById("keyhold-extension-root");
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).toBeNull();
    expect(listeners.length).toBeGreaterThan(0);
  });

  it("mounts only once even if the script is evaluated twice", async () => {
    await import("../extension/src/content");
    await import("../extension/src/content");

    expect(document.querySelectorAll("#keyhold-extension-root")).toHaveLength(1);
  });
});
