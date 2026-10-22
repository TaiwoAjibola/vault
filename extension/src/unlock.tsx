import { useEffect, useState, type FormEvent } from "react";
import type { MessageResponse, VaultState } from "./messages";

function Keyhole() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9.4" r="4.4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 13.2V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="9.4" r="1.35" fill="currentColor" />
    </svg>
  );
}

async function send<T>(message: unknown): Promise<MessageResponse<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T>;
    return response ?? { ok: false, error: "Keyhold did not respond." };
  } catch {
    return { ok: false, error: "Could not reach Keyhold. Reload this page." };
  }
}

export function UnlockPage() {
  const [status, setStatus] = useState<VaultState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const origin = new URLSearchParams(location.search).get("origin");
  let host = "";
  try {
    host = origin ? new URL(origin).hostname.replace(/^www\./, "") : "";
  } catch {
    host = "";
  }

  useEffect(() => {
    void (async () => {
      const response = await send<VaultState>({ type: "auth:status" });
      if (response.ok) setStatus(response.data);
      else setError(response.error);
    })();
  }, []);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await send({
      type: "vault:unlock",
      masterPassword: String(data.get("masterPassword") ?? ""),
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setDone(true);
    await send({ type: "ui:unlocked" });
    window.setTimeout(() => window.close(), 900);
  }

  function openApp() {
    if (!status) return;
    void chrome.tabs.create({ url: status.appUrl, active: true });
  }

  return (
    <div className="page">
      <main className="card">
        <div className="brand">
          <span className="mark">
            <Keyhole />
          </span>
          <span className="wordmark">
            <strong>Keyhold</strong>
            <span>Cloud vault</span>
          </span>
        </div>

        {done ? (
          <>
            <p className="eyebrow">Unlocked</p>
            <h1>Vault ready.</h1>
            <p className="lede">Return to the page and fill your login. This tab will close.</p>
            <button type="button" className="primary" onClick={() => window.close()}>
              Close this tab
            </button>
          </>
        ) : null}

        {!done && status && !status.signedIn ? (
          <>
            <p className="eyebrow">Not signed in</p>
            <h1>Sign in first.</h1>
            <p className="lede">
              Sign in to Keyhold in the web app, then reopen this window from the page.
            </p>
            <button type="button" className="primary" onClick={openApp}>
              Open Keyhold
            </button>
          </>
        ) : null}

        {!done && status?.signedIn && !status.unlocked ? (
          <>
            <p className="eyebrow">{host ? `Unlock for ${host}` : status.email}</p>
            <h1>Unlock your vault.</h1>
            <p className="lede">
              Your master password decrypts the vault in this browser. It is never sent to
              a server.
            </p>
            <form onSubmit={handleUnlock} className="stack">
              <label className="field">
                <span>Master password</span>
                <input
                  name="masterPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  autoFocus
                />
              </label>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "Unlocking…" : "Unlock vault"}
              </button>
            </form>
          </>
        ) : null}

        {!done && status?.unlocked ? (
          <>
            <p className="eyebrow">{status.email}</p>
            <h1>Already unlocked.</h1>
            <p className="lede">Return to the page to fill your login.</p>
            <button type="button" className="primary" onClick={() => window.close()}>
              Close this tab
            </button>
          </>
        ) : null}

        {!status && !error ? <p className="muted">Opening…</p> : null}
        {error ? (
          <div className="banner" role="alert">
            {error}
          </div>
        ) : null}

        <p className="fine">Auto-locks after 10 minutes of inactivity.</p>
      </main>
    </div>
  );
}
