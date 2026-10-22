export async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is unavailable.");
  }
  await navigator.clipboard.writeText(value);
}

export function scheduleClipboardClear(delayMs = 45_000): void {
  window.setTimeout(() => {
    navigator.clipboard?.writeText("").catch(() => {
      // Best-effort only; the browser may require focus or deny the write.
    });
  }, delayMs);
}
