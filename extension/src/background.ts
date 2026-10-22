import {
  getVault,
  insertCredentialRow,
  listCredentialRows,
  markRetrieved,
  signIn,
  signOut,
  updateCredentialRow,
  AuthExpiredError,
} from "./api";
import { appLink } from "./config";
import {
  clearDek,
  configureSessionStorage,
  getDek,
  getNeverAsk,
  getSession,
  getSettings,
  setDek,
  setNeverAsk,
} from "./session";
import {
  openAllCredentials,
  sealCredential,
  toBase64,
  unlockVault,
} from "../../src/lib/vault/crypto";
import type { DecryptedCredential, CredentialPayload } from "../../src/lib/vault/types";
import { normalizeOrigin, originsMatch } from "../../src/lib/vault/origin";
import { validateCredential } from "../../src/lib/vault/validation";
import type {
  CredentialSummary,
  ExtensionMessage,
  LoginCandidate,
  ManualSaveInput,
  MessageResponse,
  SavePrompt,
  SiteState,
  VaultState,
} from "./messages";
import { summarizeCredential } from "./messages";

const SITES_KEY = "kh.sites";

type VaultCache = {
  userId: string;
  vaultId: string | null;
  dek: CryptoKey;
  credentials: DecryptedCredential[] | null;
  expiresAt: number;
};

type PendingLogin = {
  candidate: LoginCandidate;
  kind: "login" | "signup";
  origin: string;
  title: string;
  submittedAt: number;
};

type PromptRecord = {
  promptId: string;
  tabId: number;
  origin: string;
  title: string;
  candidate: LoginCandidate;
  createdAt: number;
  prompt: SavePrompt | null;
};

class LockedError extends Error {
  constructor() {
    super("Unlock your vault to continue.");
    this.name = "LockedError";
  }
}

let cache: VaultCache | null = null;
const pendingLogins = new Map<number, PendingLogin>();
const prompts = new Map<string, PromptRecord>();
const promptByTab = new Map<number, string>();

configureSessionStorage().catch(() => undefined);

function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname.replace(/^www\./, "");
  } catch {
    return origin;
  }
}

function canonicalOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  return normalizeOrigin(value);
}

function senderOrigin(sender: chrome.runtime.MessageSender): string | null {
  return canonicalOrigin(sender.tab?.url ?? sender.url ?? null);
}

function checkOrigin(sender: chrome.runtime.MessageSender, claimed: string): string {
  const claimedOrigin = canonicalOrigin(claimed);
  const actual = senderOrigin(sender);
  if (!claimedOrigin || !actual || claimedOrigin !== actual) {
    throw new Error("This action is not allowed for this page.");
  }
  return claimedOrigin;
}

async function requireSession() {
  const session = await getSession();
  if (!session) throw new AuthExpiredError();
  return session;
}

async function restoreCache(): Promise<VaultCache | null> {
  if (cache) {
    if (cache.expiresAt <= Date.now()) {
      await lockVault();
      return null;
    }
    return cache;
  }

  const session = await getSession();
  const stored = await getDek();
  if (!session || !stored || stored.userId !== session.user.id) return null;
  if (stored.expiresAt <= Date.now()) {
    await clearDek();
    return null;
  }

  const raw = Uint8Array.from(atob(stored.raw), (char) => char.charCodeAt(0));
  const dek = await crypto.subtle.importKey(
    "raw",
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
  cache = {
    userId: session.user.id,
    vaultId: null,
    dek,
    credentials: null,
    expiresAt: stored.expiresAt,
  };
  return cache;
}

async function requireUnlocked(): Promise<VaultCache> {
  const restored = await restoreCache();
  if (!restored) throw new LockedError();
  return restored;
}

async function ensureVaultId(active: VaultCache): Promise<string> {
  if (active.vaultId) return active.vaultId;
  const vault = await getVault(active.userId);
  if (!vault) throw new Error("No vault was found. Set up Keyhold in the web app first.");
  active.vaultId = vault.id;
  return vault.id;
}

async function ensureCredentials(): Promise<DecryptedCredential[]> {
  const active = await requireUnlocked();
  if (active.credentials) return active.credentials;
  const rows = await listCredentialRows(active.userId);
  try {
    active.credentials = await openAllCredentials(active.dek, rows);
  } catch {
    await lockVault();
    throw new LockedError();
  }
  return active.credentials;
}

async function reloadCredentials(): Promise<DecryptedCredential[]> {
  const active = await requireUnlocked();
  active.credentials = null;
  return ensureCredentials();
}

async function lockVault(notify = true): Promise<void> {
  cache = null;
  prompts.clear();
  promptByTab.clear();
  pendingLogins.clear();
  await clearDek();
  if (notify) await broadcastState();
}

async function broadcastState(): Promise<void> {
  const session = await getSession();
  const sites = await getSites();
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      const origin = canonicalOrigin(tab.url ?? null);
      if (!origin) return;
      await sendToTab(tab.id, {
        type: "content:state",
        signedIn: Boolean(session),
        unlocked: Boolean(cache),
        enabled: sites.includes(origin),
      });
    }),
  );
}

async function sendToTab(tabId: number, message: unknown): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

async function signInWithPassword(email: string, password: string) {
  if (!email.trim() || !password) throw new Error("Enter your email and password.");
  await lockVault(false);
  const session = await signIn(email.trim(), password);
  await broadcastState();
  return {
    email: session.user.email,
    userId: session.user.id,
  };
}

async function unlockVaultWithPassword(masterPassword: string) {
  const session = await requireSession();
  if (!masterPassword) throw new Error("Enter your master password.");
  const vault = await getVault(session.user.id);
  if (!vault) throw new Error("No vault was found. Set up Keyhold in the web app first.");
  const dek = await unlockVault(session.user.id, masterPassword, vault);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", dek));
  const settings = await getSettings();
  const expiresAt = await setDek(toBase64(raw), session.user.id, settings.autoLockMinutes);
  cache = {
    userId: session.user.id,
    vaultId: vault.id,
    dek,
    credentials: null,
    expiresAt,
  };
  await ensureCredentials();
  await broadcastState();
  await resendPrompts();
  return { unlockExpiresAt: expiresAt };
}

async function authStatus(): Promise<VaultState> {
  const session = await getSession();
  const stored = session ? await getDek() : null;
  if (!session || !stored) {
    if (cache) await lockVault(false);
    return {
      signedIn: Boolean(session),
      unlocked: false,
      email: session?.user.email ?? null,
      userId: session?.user.id ?? null,
      unlockExpiresAt: null,
      appUrl: appLink("/app"),
    };
  }
  const active = await restoreCache();
  return {
    signedIn: Boolean(session),
    unlocked: Boolean(active),
    email: session?.user.email ?? null,
    userId: session?.user.id ?? null,
    unlockExpiresAt: active?.expiresAt ?? null,
    appUrl: appLink("/app"),
  };
}

function matchesFor(credentials: DecryptedCredential[], origin: string): CredentialSummary[] {
  return credentials
    .filter((credential) => originsMatch(credential.websiteUrl, origin))
    .map(summarizeCredential);
}

function findExisting(
  credentials: DecryptedCredential[],
  origin: string,
  username: string,
): DecryptedCredential | undefined {
  const target = username.trim().toLowerCase();
  return credentials.find(
    (credential) =>
      credential.username.trim().toLowerCase() === target &&
      originsMatch(credential.websiteUrl, origin),
  );
}

function buildPrompt(
  record: PromptRecord,
  existing: DecryptedCredential | undefined,
): SavePrompt {
  return {
    promptId: record.promptId,
    kind: existing ? "update" : "save",
    origin: record.origin,
    host: hostOf(record.origin),
    applicationName: existing?.applicationName ?? (record.title || hostOf(record.origin)),
    username: record.candidate.username,
    maskedPassword: "••••••••",
    existingId: existing?.id,
  };
}

async function sendPrompt(record: PromptRecord): Promise<void> {
  if (!cache) {
    await sendToTab(record.tabId, { type: "content:locked-prompt", origin: record.origin });
    return;
  }
  let credentials: DecryptedCredential[];
  try {
    credentials = await ensureCredentials();
  } catch {
    await sendToTab(record.tabId, { type: "content:locked-prompt", origin: record.origin });
    return;
  }
  const existing = findExisting(credentials, record.origin, record.candidate.username);
  const prompt = buildPrompt(record, existing);
  record.prompt = prompt;
  const sent = await sendToTab(record.tabId, { type: "content:prompt", prompt });
  if (!sent) {
    prompts.delete(record.promptId);
    promptByTab.delete(record.tabId);
  }
}

async function resendPrompts(): Promise<void> {
  for (const record of [...prompts.values()]) {
    await sendPrompt(record);
  }
}

async function preparePrompt(
  tabId: number,
  origin: string,
  title: string,
  candidate: LoginCandidate,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (candidate.password.length === 0 || candidate.username.length === 0) return;
  const neverAsk = await getNeverAsk();
  if (neverAsk.includes(origin)) return;

  const previous = promptByTab.get(tabId);
  if (previous) {
    prompts.delete(previous);
    promptByTab.delete(tabId);
  }

  const record: PromptRecord = {
    promptId: crypto.randomUUID(),
    tabId,
    origin,
    title: title.slice(0, 120),
    candidate: {
      username: candidate.username.slice(0, 320),
      password: candidate.password.slice(0, 4096),
    },
    createdAt: Date.now(),
    prompt: null,
  };
  prompts.set(record.promptId, record);
  promptByTab.set(tabId, record.promptId);
  await sendPrompt(record);
}

function promotePending(tabId: number): Promise<void> | null {
  const pending = pendingLogins.get(tabId);
  if (!pending) return null;
  pendingLogins.delete(tabId);
  if (pending.kind === "signup") return null;
  if (Date.now() - pending.submittedAt < 500) return null;
  return preparePrompt(tabId, pending.origin, pending.title, pending.candidate);
}

async function savePromptCredential(record: PromptRecord): Promise<void> {
  const active = await requireUnlocked();
  const credentials = await ensureCredentials();
  const existing =
    findExisting(credentials, record.origin, record.candidate.username) ??
    (record.prompt?.existingId
      ? credentials.find((credential) => credential.id === record.prompt?.existingId)
      : undefined);

  const payload: CredentialPayload = {
    applicationName:
      existing?.applicationName ?? (record.title || hostOf(record.origin)),
    websiteUrl: existing?.websiteUrl ?? record.origin,
    username: record.candidate.username,
    password: record.candidate.password,
    notes: existing?.notes ?? "",
  };

  const errors = validateCredential(payload);
  const firstError = Object.values(errors)[0];
  if (firstError) throw new Error(firstError);

  const id = existing?.id ?? crypto.randomUUID();
  const sealed = await sealCredential(active.dek, active.userId, id, payload);

  if (existing) {
    await updateCredentialRow(active.userId, existing.id, sealed.ciphertext, sealed.iv);
  } else {
    const vaultId = await ensureVaultId(active);
    await insertCredentialRow({
      id,
      user_id: active.userId,
      vault_id: vaultId,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
    });
  }

  await reloadCredentials();
  prompts.delete(record.promptId);
  if (promptByTab.get(record.tabId) === record.promptId) promptByTab.delete(record.tabId);

  await sendToTab(record.tabId, {
    type: "content:prompt-result",
    success: true,
    message: existing ? "Login updated in Keyhold." : "Login saved to Keyhold.",
  });
  const refreshed = await ensureCredentials();
  await sendToTab(record.tabId, {
    type: "content:matches",
    matches: matchesFor(refreshed, record.origin),
    enabled: true,
  });
}

async function handlePromptAction(
  sender: chrome.runtime.MessageSender,
  promptId: string,
  action: "save" | "dismiss" | "never",
): Promise<void> {
  const record = prompts.get(promptId);
  if (!record || !sender.tab?.id || record.tabId !== sender.tab.id) {
    throw new Error("That save prompt is no longer available.");
  }
  const origin = checkOrigin(sender, record.origin);

  if (action === "dismiss") {
    prompts.delete(promptId);
    if (promptByTab.get(record.tabId) === promptId) promptByTab.delete(record.tabId);
    return;
  }

  if (action === "never") {
    await setNeverAsk(origin, true);
    prompts.delete(promptId);
    if (promptByTab.get(record.tabId) === promptId) promptByTab.delete(record.tabId);
    return;
  }

  await savePromptCredential(record);
}

async function manualSave(
  input: ManualSaveInput,
  claimedOrigin: string | null,
): Promise<{ id: string; updated: boolean }> {
  const active = await requireUnlocked();
  if (!claimedOrigin) throw new Error("Open a website tab to save a login.");
  const origin = canonicalOrigin(claimedOrigin);
  if (!origin) throw new Error("This page cannot be saved to Keyhold.");

  const credentials = await ensureCredentials();
  const existing =
    (input.updateId
      ? credentials.find((credential) => credential.id === input.updateId)
      : undefined) ?? findExisting(credentials, origin, input.username);

  const payload: CredentialPayload = {
    applicationName: input.applicationName,
    websiteUrl: existing?.websiteUrl ?? origin,
    username: input.username,
    password: input.password,
    notes: input.notes?.trim() || existing?.notes || "",
  };
  const errors = validateCredential(payload);
  const firstError = Object.values(errors)[0];
  if (firstError) throw new Error(firstError);

  const id = existing?.id ?? crypto.randomUUID();
  const sealed = await sealCredential(active.dek, active.userId, id, payload);

  if (existing) {
    await updateCredentialRow(active.userId, existing.id, sealed.ciphertext, sealed.iv);
  } else {
    const vaultId = await ensureVaultId(active);
    await insertCredentialRow({
      id,
      user_id: active.userId,
      vault_id: vaultId,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
    });
  }

  await reloadCredentials();
  return { id, updated: Boolean(existing) };
}

async function fillCredential(
  tabId: number,
  credentialId: string,
  origin: string,
): Promise<void> {
  const active = await requireUnlocked();
  const credentials = await ensureCredentials();
  const credential = credentials.find((item) => item.id === credentialId);
  if (!credential) throw new Error("That login is no longer in your vault.");
  if (!originsMatch(credential.websiteUrl, origin)) {
    throw new Error("That login is not saved for this site.");
  }
  const sent = await sendToTab(tabId, { type: "content:fill", credential });
  if (!sent) throw new Error("Reload the page, then try filling again.");

  try {
    const timestamp = await markRetrieved(credential.id);
    credential.lastRetrievedAt = timestamp ?? new Date().toISOString();
  } catch {
    // Filling succeeded; the audit timestamp is best effort.
  }
  void active;
}

async function getCredential(credentialId: string): Promise<DecryptedCredential> {
  const active = await requireUnlocked();
  const credentials = await ensureCredentials();
  const credential = credentials.find((item) => item.id === credentialId);
  if (!credential) throw new Error("That login is no longer in your vault.");
  void active;
  return credential;
}

async function getSites(): Promise<string[]> {
  const result = await chrome.storage.local.get(SITES_KEY);
  const value = result[SITES_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function setSites(sites: string[]): Promise<void> {
  await chrome.storage.local.set({ [SITES_KEY]: [...new Set(sites)] });
}

function scriptIdFor(origin: string): string {
  let hash = 2166136261;
  for (let index = 0; index < origin.length; index += 1) {
    hash ^= origin.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const slug = origin.replace(/[^a-z0-9]/gi, "").slice(0, 24);
  return `kh_${(hash >>> 0).toString(36)}_${slug}`;
}

async function registerSite(origin: string): Promise<void> {
  const id = scriptIdFor(origin);
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  } catch {
    // Nothing registered yet.
  }
  await chrome.scripting.registerContentScripts([
    {
      id,
      matches: [`${origin}/*`],
      js: ["content.js"],
      css: ["content.css"],
      runAt: "document_idle",
      allFrames: false,
      persistAcrossSessions: true,
    },
  ]);
}

async function syncRegistrations(): Promise<void> {
  const sites = await getSites();
  const kept: string[] = [];
  for (const origin of sites) {
    const hasPermission = await chrome.permissions
      .contains({ origins: [`${origin}/*`] })
      .catch(() => false);
    if (!hasPermission) continue;
    kept.push(origin);
    try {
      await registerSite(origin);
    } catch {
      // A malformed origin should not break the rest of the registrations.
    }
  }
  if (kept.length !== sites.length) await setSites(kept);

  try {
    const registered = await chrome.scripting.getRegisteredContentScripts();
    const validIds = new Set(kept.map(scriptIdFor));
    const stale = registered
      .map((script) => script.id)
      .filter((id) => id.startsWith("kh_") && !validIds.has(id));
    if (stale.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: stale });
    }
  } catch {
    // Registration cleanup is best effort.
  }
}

async function enableSite(originInput: string, tabId?: number): Promise<SiteState> {
  const origin = canonicalOrigin(originInput);
  if (!origin) throw new Error("Only http and https sites can be enabled.");
  const hasPermission = await chrome.permissions.contains({ origins: [`${origin}/*`] });
  if (!hasPermission) {
    throw new Error("Enable site access first, then try again.");
  }
  const sites = await getSites();
  if (!sites.includes(origin)) await setSites([...sites, origin]);
  await registerSite(origin);

  if (tabId) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    } catch {
      // The tab may have navigated; the registered script covers the next load.
    }
  }
  await broadcastState();
  return getSiteState(origin);
}

async function disableSite(originInput: string): Promise<SiteState> {
  const origin = canonicalOrigin(originInput);
  if (!origin) throw new Error("That site cannot be disabled.");
  const sites = await getSites();
  await setSites(sites.filter((site) => site !== origin));
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [scriptIdFor(origin)] });
  } catch {
    // Not registered.
  }
  try {
    await chrome.permissions.remove({ origins: [`${origin}/*`] });
  } catch {
    // Permission removal is best effort.
  }
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) continue;
    const tabOrigin = canonicalOrigin(tab.url ?? null);
    if (tabOrigin === origin) {
      await sendToTab(tab.id, {
        type: "content:state",
        signedIn: Boolean(await getSession()),
        unlocked: Boolean(cache),
        enabled: false,
      });
    }
  }
  return getSiteState(origin);
}

async function getSiteState(originInput: string | null): Promise<SiteState> {
  const origin = canonicalOrigin(originInput);
  const sites = await getSites();
  const neverAsk = await getNeverAsk();
  const hasPermission = origin
    ? await chrome.permissions.contains({ origins: [`${origin}/*`] }).catch(() => false)
    : false;
  return {
    origin,
    enabled: origin ? sites.includes(origin) : false,
    neverAsk: origin ? neverAsk.includes(origin) : false,
    hasPermission,
  };
}

function pruneCapturedState(): void {
  const cutoff = Date.now() - 5 * 60_000;
  for (const [tabId, pending] of pendingLogins) {
    if (pending.submittedAt < cutoff) pendingLogins.delete(tabId);
  }
  for (const [promptId, record] of prompts) {
    if (record.createdAt >= cutoff) continue;
    prompts.delete(promptId);
    if (promptByTab.get(record.tabId) === promptId) promptByTab.delete(record.tabId);
    void sendToTab(record.tabId, { type: "content:prompt-clear" });
  }
}

function openUnlockPage(origin?: string): void {
  const url = new URL(chrome.runtime.getURL("unlock.html"));
  if (origin) url.searchParams.set("origin", origin);
  void chrome.tabs.create({ url: url.toString(), active: true });
}

function openAppPage(): void {
  void chrome.tabs.create({ url: appLink("/app"), active: true });
}

function errorResponse(error: unknown): MessageResponse {
  if (error instanceof AuthExpiredError) {
    return { ok: false, error: error.message, code: "signed-out" };
  }
  if (error instanceof LockedError) {
    return { ok: false, error: error.message, code: "locked" };
  }
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Something went wrong. Try again.";
  return { ok: false, error: message };
}

async function handleContentMessage(
  message: Extract<ExtensionMessage, { type: `page:${string}` }>,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  const tabId = sender.tab?.id;
  if (!tabId) throw new Error("This action is not allowed for this page.");

  switch (message.type) {
    case "page:ready": {
      const origin = checkOrigin(sender, message.origin);
      const pending = pendingLogins.get(tabId);
      if (pending && pending.origin === origin) {
        if (Date.now() - pending.submittedAt > 30_000) {
          pendingLogins.delete(tabId);
        } else if (!message.hasPasswordField && Date.now() - pending.submittedAt > 700) {
          await promotePending(tabId);
        }
      }
      return { enabled: (await getSites()).includes(origin) };
    }
    case "page:login-submitted": {
      const origin = checkOrigin(sender, message.origin);
      const session = await getSession();
      if (!session) return null;
      if ((await getNeverAsk()).includes(origin)) return null;
      pendingLogins.set(tabId, {
        candidate: {
          username: message.candidate.username.slice(0, 320),
          password: message.candidate.password.slice(0, 4096),
        },
        kind: message.kind,
        origin,
        title: message.title.slice(0, 120),
        submittedAt: Date.now(),
      });
      return null;
    }
    case "page:login-result": {
      const origin = checkOrigin(sender, message.origin);
      const pending = pendingLogins.get(tabId);
      if (!pending || pending.origin !== origin) return null;
      if (message.success) {
        await promotePending(tabId);
      } else {
        pendingLogins.delete(tabId);
      }
      return null;
    }
    case "page:request-matches": {
      const origin = checkOrigin(sender, message.origin);
      const session = await getSession();
      if (!session) {
        return { signedIn: false, unlocked: false, matches: [], enabled: true };
      }
      if (!cache) {
        return { signedIn: true, unlocked: false, matches: [], enabled: true };
      }
      const credentials = await ensureCredentials();
      return {
        signedIn: true,
        unlocked: true,
        matches: matchesFor(credentials, origin),
        enabled: (await getSites()).includes(origin),
      };
    }
    case "page:fill-request": {
      const origin = checkOrigin(sender, message.origin);
      await fillCredential(tabId, message.credentialId, origin);
      return null;
    }
    case "page:manual-save": {
      const origin = checkOrigin(sender, message.origin);
      await preparePrompt(tabId, origin, message.title, message.candidate);
      return null;
    }
    case "page:prompt-action": {
      await handlePromptAction(sender, message.promptId, message.action);
      return null;
    }
    case "page:open-unlock": {
      openUnlockPage(senderOrigin(sender) ?? undefined);
      return null;
    }
    case "page:open-app": {
      openAppPage();
      return null;
    }
    case "page:site-status": {
      const origin = checkOrigin(sender, message.origin);
      return getSiteState(origin);
    }
    case "page:enable-site": {
      throw new Error("Enable site access from the Keyhold toolbar popup.");
    }
    default:
      throw new Error("Unknown page request.");
  }
}

async function handlePopupMessage(
  message: Exclude<ExtensionMessage, { type: `page:${string}` | `content:${string}` }>,
): Promise<unknown> {
  switch (message.type) {
    case "auth:status":
      return authStatus();
    case "auth:signin":
      return signInWithPassword(message.email, message.password);
    case "auth:signout":
      await signOut();
      await lockVault(false);
      await broadcastState();
      return null;
    case "vault:unlock":
      return unlockVaultWithPassword(message.masterPassword);
    case "vault:lock":
      await lockVault();
      return null;
    case "vault:matches": {
      if (!cache) throw new LockedError();
      if (!message.origin) return [];
      const origin = canonicalOrigin(message.origin);
      if (!origin) return [];
      const credentials = await ensureCredentials();
      return matchesFor(credentials, origin);
    }
    case "vault:all": {
      const credentials = await ensureCredentials();
      return credentials.map(summarizeCredential);
    }
    case "credential:fill": {
      const tab = await chrome.tabs.get(message.tabId);
      const tabOrigin = canonicalOrigin(tab.url ?? null);
      if (!tabOrigin) throw new Error("This page cannot be filled.");
      if (tabOrigin !== canonicalOrigin(message.origin)) {
        throw new Error("The page changed. Try again.");
      }
      await fillCredential(message.tabId, message.credentialId, tabOrigin);
      return null;
    }
    case "credential:get": {
      const credential = await getCredential(message.credentialId);
      try {
        const timestamp = await markRetrieved(credential.id);
        credential.lastRetrievedAt = timestamp ?? new Date().toISOString();
      } catch {
        // Copy still succeeds if the audit write fails.
      }
      return credential;
    }
    case "manual:save": {
      const result = await manualSave(message.input, message.origin);
      return result;
    }
    case "site:status":
      return getSiteState(message.origin);
    case "site:enable":
      return enableSite(message.origin, message.tabId);
    case "site:disable":
      return disableSite(message.origin);
    case "site:never-ask":
      await setNeverAsk(canonicalOrigin(message.origin) ?? message.origin, message.never);
      return getSiteState(message.origin);
    case "ui:open-unlock":
      openUnlockPage();
      return null;
    case "ui:open-app":
      openAppPage();
      return null;
    case "ui:unlocked":
      await broadcastState();
      await resendPrompts();
      return null;
    default:
      throw new Error("Unknown extension request.");
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== "object" || !("type" in message)) return false;
  const typed = message as ExtensionMessage;
  if (typed.type.startsWith("content:")) return false;
  if (sender.id !== chrome.runtime.id) return false;

  pruneCapturedState();

  const task = typed.type.startsWith("page:")
    ? handleContentMessage(
        typed as Extract<ExtensionMessage, { type: `page:${string}` }>,
        sender,
      )
    : handlePopupMessage(
        typed as Exclude<ExtensionMessage, { type: `page:${string}` | `content:${string}` }>,
      );

  task
    .then((data) => sendResponse({ ok: true, data }))
    .catch(async (error: unknown) => {
      if (error instanceof AuthExpiredError) {
        await lockVault(false);
      }
      sendResponse(errorResponse(error));
    });
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void configureSessionStorage();
  void syncRegistrations();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSessionStorage();
  void syncRegistrations();
});
