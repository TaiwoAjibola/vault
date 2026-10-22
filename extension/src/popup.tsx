import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  CredentialSummary,
  ExtensionMessage,
  MessageResponse,
  SiteState,
  VaultState,
} from "./messages";

type TabInfo = {
  id: number | null;
  title: string;
  origin: string | null;
  host: string;
};

type SaveState = {
  applicationName: string;
  username: string;
  password: string;
  notes: string;
};

function Keyhole({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="9.4" r="4.4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 13.2V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="9.4" r="1.35" fill="currentColor" />
    </svg>
  );
}

async function send<T>(message: ExtensionMessage): Promise<MessageResponse<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T>;
    return response ?? { ok: false, error: "Keyhold did not respond." };
  } catch {
    return { ok: false, error: "Could not reach Keyhold. Reopen the popup and try again." };
  }
}

async function activeTab(): Promise<TabInfo> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  let origin: string | null = null;
  try {
    const url = new URL(tab?.url ?? "");
    if (url.protocol === "https:" || url.protocol === "http:") origin = url.origin;
  } catch {
    origin = null;
  }
  return {
    id: tab?.id ?? null,
    title: tab?.title ?? "",
    origin,
    host: origin ? new URL(origin).hostname.replace(/^www\./, "") : "",
  };
}

function hostFromTitle(title: string, host: string): string {
  const cleaned = title.split(/[|–—-]/)[0]?.trim();
  if (cleaned && cleaned.length <= 80) return cleaned;
  return host;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "K";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "K";
}

export function Popup() {
  const [tab, setTab] = useState<TabInfo | null>(null);
  const [status, setStatus] = useState<VaultState | null>(null);
  const [site, setSite] = useState<SiteState | null>(null);
  const [matches, setMatches] = useState<CredentialSummary[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [save, setSave] = useState<SaveState>({
    applicationName: "",
    username: "",
    password: "",
    notes: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const unlocked = status?.unlocked ?? false;
  const signedIn = status?.signedIn ?? false;

  async function loadSite(info: TabInfo) {
    const response = await send<SiteState>({ type: "site:status", origin: info.origin });
    if (response.ok) setSite(response.data);
  }

  async function loadMatches(info: TabInfo) {
    if (!info.origin) {
      setMatches([]);
      return;
    }
    const response = await send<CredentialSummary[]>({
      type: "vault:matches",
      origin: info.origin,
    });
    if (response.ok) setMatches(response.data);
    else if (response.code !== "locked" && response.code !== "signed-out") {
      setError(response.error);
    }
  }

  async function refresh() {
    const info = await activeTab();
    setTab(info);
    await loadSite(info);
    const response = await send<VaultState>({ type: "auth:status" });
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setStatus(response.data);
    if (response.data.unlocked) {
      await loadMatches(info);
    } else {
      setMatches([]);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!status?.unlocked || !tab?.origin) return;
    setSave((current) => ({
      ...current,
      applicationName: current.applicationName || hostFromTitle(tab.title, tab.host),
    }));
  }, [status?.unlocked, tab?.origin, tab?.title, tab?.host]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const busyLabel = useMemo(() => (busy ? "Working…" : ""), [busy]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const response = await send<{ email: string }>({
      type: "auth:signin",
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setNotice("Signed in. Unlock your vault.");
    await refresh();
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
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
    setNotice("Vault unlocked.");
    await refresh();
  }

  async function handleLock() {
    setBusy(true);
    await send({ type: "vault:lock" });
    setBusy(false);
    setNotice("Vault locked.");
    await refresh();
  }

  async function handleSignOut() {
    setBusy(true);
    await send({ type: "auth:signout" });
    setBusy(false);
    setNotice("Signed out.");
    await refresh();
  }

  async function handleEnable() {
    if (!tab?.origin || tab.id === null) return;
    setError("");
    setBusy(true);
    try {
      const hasPermission = await chrome.permissions.contains({
        origins: [`${tab.origin}/*`],
      });
      if (!hasPermission) {
        const granted = await chrome.permissions.request({
          origins: [`${tab.origin}/*`],
        });
        if (!granted) throw new Error("Site access was not granted.");
      }
      const response = await send<SiteState>({
        type: "site:enable",
        origin: tab.origin,
        tabId: tab.id,
      });
      if (!response.ok) throw new Error(response.error);
      setSite(response.data);
      setNotice(`Keyhold is active on ${tab.host}.`);
      if (unlocked) await loadMatches(tab);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not enable this site.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!tab?.origin) return;
    setBusy(true);
    const response = await send<SiteState>({ type: "site:disable", origin: tab.origin });
    setBusy(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setSite(response.data);
    setNotice(`Keyhold is off for ${tab.host}.`);
  }

  async function handleNeverAsk(never: boolean) {
    if (!tab?.origin) return;
    const response = await send<SiteState>({
      type: "site:never-ask",
      origin: tab.origin,
      never,
    });
    if (response.ok) setSite(response.data);
    else setError(response.error);
  }

  async function handleFill(credentialId: string) {
    if (!tab?.origin || tab.id === null) return;
    setError("");
    const response = await send({
      type: "credential:fill",
      tabId: tab.id,
      credentialId,
      origin: tab.origin,
    });
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setNotice("Filled on the page. Review it before signing in.");
  }

  async function handleCopy(credentialId: string) {
    setError("");
    const response = await send<{ password: string }>({
      type: "credential:get",
      credentialId,
    });
    if (!response.ok) {
      setError(response.error);
      return;
    }
    const password = response.data.password;
    try {
      await navigator.clipboard.writeText(password);
      setNotice("Password copied. It clears in 30 seconds.");
      window.setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === password) await navigator.clipboard.writeText("");
        } catch {
          // Clipboard reads may be denied after the popup closes.
        }
      }, 30_000);
    } catch {
      setError("Clipboard access was denied.");
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tab?.origin) return;
    setError("");
    setBusy(true);
    const response = await send<{ updated: boolean }>({
      type: "manual:save",
      origin: tab.origin,
      input: {
        applicationName: save.applicationName,
        websiteUrl: tab.origin,
        username: save.username,
        password: save.password,
        notes: save.notes,
      },
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setNotice(response.data.updated ? "Login updated." : "Login saved.");
    setSave((current) => ({
      applicationName: current.applicationName,
      username: "",
      password: "",
      notes: "",
    }));
    setShowSave(false);
    await loadMatches(tab);
  }

  function openApp() {
    if (!status) return;
    const url = new URL(status.appUrl);
    url.searchParams.set("source", "extension");
    void chrome.tabs.create({ url: url.toString(), active: true });
  }

  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          <span className="mark">
            <Keyhole />
          </span>
          <span className="brand-text">
            <strong>Keyhold</strong>
            <span>Cloud vault</span>
          </span>
        </div>
        <div className="head-actions">
          {unlocked ? (
            <button type="button" className="icon-btn" onClick={handleLock} title="Lock vault" aria-label="Lock vault">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="10" width="14" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8.5 10V7.5a3.5 3.5 0 1 1 7 0V10" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
          ) : null}
          {signedIn ? (
            <button type="button" className="text-btn" onClick={handleSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      <main className="content">
        {!status && !error ? <p className="muted">Opening your vault…</p> : null}

        {error ? (
          <div className="banner banner-error" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="banner banner-ok" role="status">
            {notice}
          </div>
        ) : null}

        {status && !signedIn ? (
          <section className="panel">
            <p className="eyebrow">Welcome back</p>
            <h1 className="title">Sign in to fill.</h1>
            <p className="lede">Your logins stay encrypted in your Keyhold vault.</p>
            <form onSubmit={handleSignIn} className="stack">
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" autoComplete="username" required autoFocus />
              </label>
              <label className="field">
                <span>Account password</span>
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? busyLabel : "Sign in"}
              </button>
            </form>
            <button type="button" className="link" onClick={openApp}>
              Open the web app
            </button>
          </section>
        ) : null}

        {status && signedIn && !unlocked ? (
          <section className="panel">
            <p className="eyebrow">{status.email}</p>
            <h1 className="title">Unlock your vault.</h1>
            <p className="lede">
              Use your master password. It never leaves this browser.
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
                {busy ? busyLabel : "Unlock vault"}
              </button>
            </form>
            <button type="button" className="link" onClick={openApp}>
              Open web vault
            </button>
          </section>
        ) : null}

        {status && unlocked ? (
          <>
            <section className="site-row">
              <div>
                <p className="eyebrow">This site</p>
                <p className="host">{tab?.host || "No website tab"}</p>
              </div>
              {tab?.origin ? (
                site?.enabled ? (
                  <button type="button" className="ghost" onClick={handleDisable} disabled={busy}>
                    Turn off
                  </button>
                ) : (
                  <button type="button" className="ghost strong" onClick={handleEnable} disabled={busy}>
                    Enable
                  </button>
                )
              ) : null}
            </section>

            {tab?.origin && site?.enabled ? (
              <section className="matches">
                {matches.length > 0 ? (
                  matches.map((match) => (
                    <article className="match" key={match.id}>
                      <span className="avatar">{initials(match.applicationName)}</span>
                      <span className="match-meta">
                        <strong>{match.applicationName}</strong>
                        <span>{match.username}</span>
                      </span>
                      <button type="button" className="mini" onClick={() => handleFill(match.id)}>
                        Fill
                      </button>
                      <button
                        type="button"
                        className="mini ghosted"
                        onClick={() => handleCopy(match.id)}
                        title="Copy password"
                      >
                        Copy
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="muted">No saved logins for this site yet.</p>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={site.neverAsk}
                    onChange={(event) => void handleNeverAsk(event.target.checked)}
                  />
                  <span>Never ask to save on this site</span>
                </label>
              </section>
            ) : null}

            {tab?.origin ? (
              <section className="save-area">
                {showSave ? (
                  <form className="panel tight" onSubmit={handleSave}>
                    <p className="eyebrow">Manual save</p>
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={save.applicationName}
                        maxLength={120}
                        required
                        onChange={(event) =>
                          setSave((current) => ({ ...current, applicationName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Username or email</span>
                      <input
                        value={save.username}
                        maxLength={320}
                        autoComplete="off"
                        required
                        onChange={(event) =>
                          setSave((current) => ({ ...current, username: event.target.value }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Password</span>
                      <span className="password-row">
                        <input
                          value={save.password}
                          type={showPassword ? "text" : "password"}
                          maxLength={4096}
                          autoComplete="new-password"
                          required
                          onChange={(event) =>
                            setSave((current) => ({ ...current, password: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="reveal"
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </span>
                    </label>
                    <label className="field">
                      <span>Notes (optional)</span>
                      <textarea
                        value={save.notes}
                        maxLength={4000}
                        rows={2}
                        onChange={(event) =>
                          setSave((current) => ({ ...current, notes: event.target.value }))
                        }
                      />
                    </label>
                    <div className="form-actions">
                      <button type="submit" className="primary" disabled={busy}>
                        {busy ? busyLabel : "Save to Keyhold"}
                      </button>
                      <button type="button" className="ghost" onClick={() => setShowSave(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="save-toggle" onClick={() => setShowSave(true)}>
                    + Save a login manually
                  </button>
                )}
              </section>
            ) : (
              <p className="muted">Open a website tab to fill or save a login.</p>
            )}
          </>
        ) : null}
      </main>

      <footer className="footer">
        <span>End-to-end encrypted</span>
        <button type="button" className="link" onClick={openApp}>
          Open web vault
        </button>
      </footer>
    </div>
  );
}
