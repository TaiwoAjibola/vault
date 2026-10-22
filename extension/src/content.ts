import {
  collectCandidate,
  detectLoginForms,
  fillFields,
  findLoginPairForElement,
  hasVisiblePasswordField,
  hostnameLabel,
  pageOrigin,
  pageTitle,
  visiblePasswordFields,
  type LoginPair,
} from "./detect";
import type {
  ContentMessage,
  CredentialSummary,
  LoginCandidate,
  MessageResponse,
  SavePrompt,
} from "./messages";

declare global {
  interface Window {
    __keyholdLoaded?: boolean;
  }
}

const LOGO =`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="9.4" r="4.4" stroke="currentColor" stroke-width="1.9"/><path d="M12 13.2V21" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="9.4" r="1.35" fill="currentColor"/></svg>`;

const PANEL_CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
.kh-wrap {
  position: fixed; top: 16px; right: 16px; z-index: 2147483647;
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #14231b; -webkit-font-smoothing: antialiased;
}
.kh-badge {
  position: relative; width: 42px; height: 42px; border-radius: 14px; border: 1px solid rgba(200,241,105,.34);
  background: #0e2a1f; color: #c8f169; display: grid; place-items: center; cursor: pointer; padding: 0;
  box-shadow: 0 10px 28px rgba(8,24,17,.3); transition: transform .16s ease, box-shadow .16s ease;
}
.kh-badge:hover { transform: translateY(-1px); box-shadow: 0 14px 32px rgba(8,24,17,.36); }
.kh-badge svg { width: 22px; height: 22px; }
.kh-badge:focus-visible, .kh-card button:focus-visible { outline: 2px solid #0e2a1f; outline-offset: 2px; }
.kh-dot { position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 999px; background: #c8f169; border: 2px solid #0e2a1f; }
.kh-card {
  width: 318px; max-width: calc(100vw - 32px); overflow: hidden; border-radius: 18px;
  background: #f7f4eb; border: 1px solid rgba(20,35,27,.14); box-shadow: 0 24px 64px rgba(8,24,17,.26);
}
.kh-head { display: flex; align-items: center; gap: 9px; padding: 11px 12px; background: #efebe0; border-bottom: 1px solid rgba(20,35,27,.1); }
.kh-mark { width: 28px; height: 28px; border-radius: 9px; background: #0e2a1f; color: #c8f169; display: grid; place-items: center; flex: none; }
.kh-mark svg { width: 17px; height: 17px; }
.kh-brand { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.kh-name { font-size: 13px; font-weight: 650; letter-spacing: -.01em; line-height: 1.2; }
.kh-sub { font-size: 9px; font-weight: 600; letter-spacing: .13em; text-transform: uppercase; color: #6b7468; }
.kh-grow { flex: 1; }
.kh-icon { width: 26px; height: 26px; border-radius: 8px; border: 0; background: transparent; color: #57635a; cursor: pointer; display: grid; place-items: center; font-size: 17px; line-height: 1; }
.kh-icon:hover { background: rgba(14,42,31,.08); }
.kh-body { padding: 12px; display: flex; flex-direction: column; gap: 9px; max-height: 360px; overflow-y: auto; }
.kh-note { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px dashed rgba(20,35,27,.2); border-radius: 12px; background: #fbf9f3; }
.kh-note-title { font-size: 13px; font-weight: 640; letter-spacing: -.01em; }
.kh-note-copy { font-size: 12px; line-height: 1.45; color: #5b665d; }
.kh-label { font-size: 10px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; color: #778075; }
.kh-item { display: flex; align-items: center; gap: 9px; padding: 8px; border: 1px solid rgba(20,35,27,.1); border-radius: 12px; background: #fdfbf6; }
.kh-avatar { width: 30px; height: 30px; flex: none; border-radius: 9px; background: #e4ead9; color: #294533; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
.kh-meta { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 1px; }
.kh-app { font-size: 12.5px; font-weight: 620; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kh-user { font-size: 11px; color: #677168; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kh-btn { border: 1px solid rgba(14,42,31,.18); background: #fdfbf6; color: #14231b; border-radius: 9px; padding: 6px 10px; font: inherit; font-size: 11.5px; font-weight: 620; cursor: pointer; white-space: nowrap; }
.kh-btn:hover { background: #f0ecdf; }
.kh-btn[disabled] { opacity: .55; cursor: default; }
.kh-btn-primary { background: #0e2a1f; border-color: #0e2a1f; color: #eaf7d4; }
.kh-btn-primary:hover { background: #173d2c; }
.kh-btn-accent { background: #c8f169; border-color: #b3dc55; color: #14231b; }
.kh-btn-accent:hover { background: #d6fa86; }
.kh-btn-wide { width: 100%; padding: 8px 10px; }
.kh-prompt { border: 1px solid rgba(14,42,31,.16); border-radius: 13px; background: #fffdf7; padding: 11px; display: flex; flex-direction: column; gap: 8px; }
.kh-prompt-top { display: flex; align-items: flex-start; gap: 8px; }
.kh-prompt-title { font-size: 13px; font-weight: 680; letter-spacing: -.01em; flex: 1; }
.kh-prompt-site { font-size: 11.5px; color: #5d685f; line-height: 1.4; word-break: break-word; }
.kh-actions { display: flex; gap: 7px; }
.kh-actions .kh-btn { flex: 1; padding: 7px 8px; }
.kh-never { border: 0; background: transparent; color: #778075; font: inherit; font-size: 10.5px; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; align-self: flex-start; padding: 0; }
.kh-never:hover { color: #14231b; }
.kh-empty { font-size: 12px; color: #5d685f; line-height: 1.5; padding: 4px 2px; }
.kh-foot { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-top: 1px solid rgba(20,35,27,.1); background: #f2eee4; }
.kh-link { border: 0; background: transparent; color: #24402f; font: inherit; font-size: 11px; font-weight: 640; text-decoration: none; cursor: pointer; padding: 0; }
.kh-link:hover { text-decoration: underline; text-underline-offset: 2px; }
.kh-secure { margin-left: auto; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; color: #7b8378; }
.kh-toast {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; max-width: 300px;
  background: #0e2a1f; color: #f0f6e6; border: 1px solid rgba(200,241,105,.3);
  border-radius: 11px; padding: 10px 12px; font-size: 12px; line-height: 1.4;
  box-shadow: 0 16px 36px rgba(8,24,17,.3); opacity: 0; transform: translateY(6px);
  transition: opacity .18s ease, transform .18s ease; pointer-events: none;
}
.kh-toast[data-show="true"] { opacity: 1; transform: translateY(0); }
.kh-toast[data-tone="error"] { background: #3a1717; border-color: rgba(255,180,160,.4); }
@media (prefers-reduced-motion: reduce) {
  .kh-badge, .kh-toast { transition: none; }
}
`;

type UiState = {
  enabled: boolean;
  open: boolean;
  signedIn: boolean;
  unlocked: boolean;
  matches: CredentialSummary[];
  prompt: SavePrompt | null;
  lockedPrompt: boolean;
  busy: boolean;
};

const state: UiState = {
  enabled: true,
  open: false,
  signedIn: false,
  unlocked: false,
  matches: [],
  prompt: null,
  lockedPrompt: false,
  busy: false,
};

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let badge: HTMLButtonElement | null = null;
let card: HTMLDivElement | null = null;
let body: HTMLDivElement | null = null;
let toast: HTMLDivElement | null = null;
let toastTimer: number | null = null;
let currentOrigin: string | null = null;
let lastHref = location.href;
let lastSubmission: { value: string; at: number } | null = null;
let successTimer: number | null = null;

function start(): void {
  if (!document.documentElement) {
    document.addEventListener("DOMContentLoaded", () => start(), { once: true });
    return;
  }
  currentOrigin = pageOrigin();
  if (!currentOrigin) return;
  mount();
  attachPageListeners();
  void reportReady();
  void requestMatches();
  window.setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    const nextOrigin = pageOrigin();
    if (!nextOrigin) return;
    currentOrigin = nextOrigin;
    state.prompt = null;
    state.lockedPrompt = false;
    void reportReady();
    void requestMatches();
    render();
  }, 900);
}

function mount(): void {
  host = document.createElement("div");
  host.id = "keyhold-extension-root";
  shadow = host.attachShadow({ mode: "closed" });

  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(PANEL_CSS);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    shadow.append(style);
  }

  const wrap = document.createElement("div");
  wrap.className = "kh-wrap";

  badge = document.createElement("button");
  badge.className = "kh-badge";
  badge.type = "button";
  badge.title = "Keyhold";
  badge.setAttribute("aria-label", "Open Keyhold");
  badge.setAttribute("aria-expanded", "false");
  badge.innerHTML = `${LOGO}<span class="kh-dot" hidden></span>`;
  badge.addEventListener("click", () => {
    state.open = !state.open;
    if (state.open) void requestMatches();
    render();
  });

  card = document.createElement("div");
  card.className = "kh-card";
  card.hidden = true;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "Keyhold logins");

  const head = document.createElement("div");
  head.className = "kh-head";
  head.innerHTML = `
    <span class="kh-mark">${LOGO}</span>
    <span class="kh-brand"><span class="kh-name">Keyhold</span><span class="kh-sub">Cloud vault</span></span>
    <span class="kh-grow"></span>
    <button type="button" class="kh-icon" data-close aria-label="Close">×</button>
  `;

  body = document.createElement("div");
  body.className = "kh-body";

  const foot = document.createElement("div");
  foot.className = "kh-foot";
  foot.innerHTML = `
    <button type="button" class="kh-link" data-open-vault>Open vault</button>
    <span class="kh-secure">Encrypted</span>
  `;

  card.append(head, body, foot);
  wrap.append(badge, card);
  shadow.append(wrap);

  shadow.addEventListener("click", onShadowClick);
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!state.open || !host) return;
      if (event.composedPath().includes(host)) return;
      state.open = false;
      render();
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.open) return;
    state.open = false;
    render();
  });

  toast = document.createElement("div");
  toast.className = "kh-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  shadow.append(toast);

  document.documentElement.append(host);
  render();
}

function render(): void {
  if (!host || !badge || !card || !body) return;
  host.style.display = state.enabled ? "block" : "none";
  if (!state.enabled) return;

  badge.setAttribute("aria-expanded", String(state.open));
  const dot = badge.querySelector<HTMLElement>(".kh-dot");
  if (dot) dot.hidden = !(state.matches.length > 0 || state.prompt || (!state.signedIn && state.open));
  card.hidden = !state.open;
  if (!state.open) return;

  body.replaceChildren();
  body.append(...buildBody());
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, action: string, style = "kh-btn", dataset: Record<string, string> = {}): HTMLButtonElement {
  const node = element("button", style, label);
  node.type = "button";
  node.dataset.action = action;
  for (const [key, value] of Object.entries(dataset)) node.dataset[key] = value;
  return node;
}

function buildBody(): HTMLElement[] {
  const nodes: HTMLElement[] = [];

  if (state.prompt) {
    nodes.push(buildPrompt(state.prompt));
    return nodes;
  }

  if (state.lockedPrompt) {
    nodes.push(
      buildNotice(
        "Login captured",
        "Unlock Keyhold to save this login to your vault.",
        button("Unlock Keyhold", "unlock", "kh-btn kh-btn-primary kh-btn-wide"),
      ),
    );
    return nodes;
  }

  if (!state.signedIn) {
    nodes.push(
      buildNotice(
        "Sign in to Keyhold",
        "Save and fill logins from your encrypted cloud vault.",
        button("Open Keyhold", "open-app", "kh-btn kh-btn-primary kh-btn-wide"),
      ),
    );
    return nodes;
  }

  if (!state.unlocked) {
    nodes.push(
      buildNotice(
        "Vault locked",
        "Unlock your vault to fill saved logins on this site.",
        button("Unlock Keyhold", "unlock", "kh-btn kh-btn-primary kh-btn-wide"),
      ),
    );
    return nodes;
  }

  if (state.matches.length === 0) {
    nodes.push(
      buildNotice(
        "No logins for this site",
        `Save a login for ${hostnameLabel()} from the Keyhold toolbar button.`,
      ),
    );
  } else {
    nodes.push(element("div", "kh-label", state.matches.length === 1 ? "1 saved login" : `${state.matches.length} saved logins`));
    for (const match of state.matches) nodes.push(buildMatch(match));
    nodes.push(
      button("Manage saved logins", "open-app", "kh-btn kh-btn-wide"),
    );
  }

  return nodes;
}

function buildNotice(title: string, copy: string, action?: HTMLButtonElement): HTMLElement {
  const notice = element("div", "kh-note");
  notice.append(element("div", "kh-notice-title kh-note-title", title), element("div", "kh-note-copy", copy));
  if (action) notice.append(action);
  return notice;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "K";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function buildMatch(match: CredentialSummary): HTMLElement {
  const row = element("div", "kh-item");
  row.append(element("span", "kh-avatar", initials(match.applicationName)));
  const meta = element("div", "kh-meta");
  meta.append(
    element("span", "kh-app", match.applicationName),
    element("span", "kh-user", match.username),
  );
  const fill = button("Fill", "fill", "kh-btn kh-btn-accent", { id: match.id });
  fill.setAttribute("aria-label", `Fill ${match.applicationName}`);
  row.append(meta, fill);
  return row;
}

function buildPrompt(prompt: SavePrompt): HTMLElement {
  const wrapper = element("div", "kh-prompt");
  const top = element("div", "kh-prompt-top");
  top.append(
    element("div", "kh-prompt-title", prompt.kind === "update" ? "Update saved login?" : "Save this login?"),
  );
  const site = element("div", "kh-prompt-site");
  site.textContent = `${prompt.applicationName} · ${prompt.username}`;
  const actions = element("div", "kh-actions");
  actions.append(
    button("Save", "save", "kh-btn kh-btn-primary", { prompt: prompt.promptId }),
    button("Not now", "dismiss", "kh-btn", { prompt: prompt.promptId }),
  );
  const never = element("button", "kh-never", "Never ask on this site");
  never.type = "button";
  never.dataset.action = "never";
  never.dataset.prompt = prompt.promptId;
  wrapper.append(top, site, actions, never);
  return wrapper;
}

function showToast(message: string, tone: "success" | "error" = "success"): void {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.dataset.show = "true";
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toast) toast.dataset.show = "false";
  }, 3600);
}

async function send<T>(message: unknown): Promise<MessageResponse<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T>;
    return response ?? { ok: false, error: "Keyhold did not respond." };
  } catch {
    return {
      ok: false,
      error: "Keyhold was updated. Reload this page to reconnect.",
    };
  }
}

async function requestMatches(): Promise<void> {
  if (!currentOrigin) return;
  const response = await send<{
    signedIn: boolean;
    unlocked: boolean;
    matches: CredentialSummary[];
  }>({ type: "page:request-matches", origin: currentOrigin });
  if (!response.ok) {
    state.signedIn = false;
    state.unlocked = false;
    state.matches = [];
    render();
    return;
  }
  state.signedIn = response.data.signedIn;
  state.unlocked = response.data.unlocked;
  state.matches = response.data.matches;
  if (!state.unlocked) {
    state.prompt = null;
  }
  render();
}

async function reportReady(): Promise<void> {
  if (!currentOrigin) return;
  await send({
    type: "page:ready",
    origin: currentOrigin,
    hasPasswordField: hasVisiblePasswordField(),
    hasLoginForm: detectLoginForms().length > 0,
    title: pageTitle(),
  });
}

function onShadowClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const actionElement = target.closest<HTMLElement>("[data-action], [data-close], [data-open-vault]");
  if (!actionElement) return;

  if (actionElement.hasAttribute("data-close")) {
    state.open = false;
    render();
    return;
  }
  if (actionElement.hasAttribute("data-open-vault")) {
    void send({ type: "page:open-app" });
    return;
  }

  const action = actionElement.dataset.action;
  if (action === "open-app") {
    void send({ type: "page:open-app" });
    return;
  }
  if (action === "unlock") {
    void send({ type: "page:open-unlock" });
    return;
  }
  if (action === "fill") {
    const id = actionElement.dataset.id;
    if (id && currentOrigin) void handleFill(id);
    return;
  }
  if (action === "save" || action === "dismiss" || action === "never") {
    const promptId = actionElement.dataset.prompt;
    if (!promptId) return;
    void handlePromptAction(promptId, action);
  }
}

async function handlePromptAction(
  promptId: string,
  action: "save" | "dismiss" | "never",
): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  const response = await send({
    type: "page:prompt-action",
    promptId,
    action,
  });
  state.busy = false;
  if (!response.ok) {
    showToast(response.error, "error");
    return;
  }
  if (action === "never") showToast("Keyhold will not ask to save on this site.");
  state.prompt = null;
  state.lockedPrompt = false;
  render();
  if (action === "save") void requestMatches();
}

async function handleFill(credentialId: string): Promise<void> {
  if (!currentOrigin) return;
  const response = await send({ type: "page:fill-request", origin: currentOrigin, credentialId });
  if (!response.ok) {
    showToast(response.error, "error");
  }
}

function attachPageListeners(): void {
  document.addEventListener("submit", onSubmitCapture, true);
  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "password") return;
    const pair = findLoginPairForElement(target);
    const candidate = pair ? collectCandidate(pair) : null;
    if (candidate) reportSubmission(candidate);
  }, true);
}

function onSubmitCapture(event: Event): void {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const detected = detectLoginForms(document).find((item) => item.form === form);
  if (!detected || detected.kind === "signup") return;
  if (visiblePasswordFields(form).length > 1) return;
  const candidate = collectCandidate(detected.pair);
  if (candidate) reportSubmission(candidate);
}

function buttonLabel(button: Element): string {
  if (button instanceof HTMLInputElement) return button.value;
  return [button.textContent ?? "", button.getAttribute("aria-label") ?? "", button.getAttribute("title") ?? ""].join(" ");
}

function onClickCapture(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest("button, input[type='submit'], input[type='button'], [role='button']");
  if (!button) return;
  const label = buttonLabel(button);
  if (!/\b(log\s*in|sign\s*in|continue|next|submit)\b/i.test(label)) return;
  if (/\b(sign\s*up|create\s+account|register)\b/i.test(label)) return;

  const passwords = visiblePasswordFields(document);
  if (passwords.length !== 1) return;
  const pair = findLoginPairForElement(passwords[0]);
  const candidate = pair ? collectCandidate(pair) : null;
  if (candidate) reportSubmission(candidate);
}

function reportSubmission(candidate: LoginCandidate): void {
  if (!currentOrigin) return;
  const submissionOrigin = currentOrigin;
  const fingerprint = `${submissionOrigin}:${candidate.username}:${candidate.password}`;
  const now = Date.now();
  if (lastSubmission && lastSubmission.value === fingerprint && now - lastSubmission.at < 1500) {
    return;
  }
  lastSubmission = { value: fingerprint, at: now };

  void send({
    type: "page:login-submitted",
    origin: submissionOrigin,
    kind: "login",
    candidate,
    title: pageTitle(),
  });

  const startedAt = now;
  const startedUrl = location.href;
  if (successTimer) window.clearInterval(successTimer);
  successTimer = window.setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (location.href !== startedUrl || (elapsed > 1400 && !hasVisiblePasswordField())) {
      window.clearInterval(successTimer ?? undefined);
      successTimer = null;
      void send({ type: "page:login-result", origin: submissionOrigin, success: true });
      return;
    }
    if (elapsed > 1800 && visibleError()) {
      window.clearInterval(successTimer ?? undefined);
      successTimer = null;
      void send({ type: "page:login-result", origin: submissionOrigin, success: false });
      return;
    }
    if (elapsed > 12_000) {
      window.clearInterval(successTimer ?? undefined);
      successTimer = null;
    }
  }, 450);
}

function visibleError(): boolean {
  const candidates = document.querySelectorAll(
    "[role='alert'], [aria-live='assertive'], .error, .error-message, [class*='error'], [data-error]",
  );
  const pattern = /invalid|incorrect|wrong|failed|try again|not recognized|unable|could not|doesn.?t match/i;
  for (const node of Array.from(candidates).slice(0, 20)) {
    const element = node as HTMLElement;
    if (element.getClientRects().length === 0) continue;
    if (pattern.test(element.textContent ?? "")) return true;
  }
  return false;
}

function findFillPair(): LoginPair | null {
  const forms = detectLoginForms(document);
  for (const item of forms) {
    if (item.kind === "signup") continue;
    if (visiblePasswordFields(document).length > 1) continue;
    return item.pair;
  }
  const single = visiblePasswordFields(document);
  if (single.length === 1) return findLoginPairForElement(single[0]);
  return null;
}

chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
  switch (message?.type) {
    case "content:state": {
      state.signedIn = message.signedIn;
      state.unlocked = message.unlocked;
      state.enabled = message.enabled;
      if (!message.unlocked) {
        state.prompt = null;
        state.lockedPrompt = false;
      }
      render();
      if (message.enabled) void requestMatches();
      sendResponse({ ok: true });
      return false;
    }
    case "content:matches": {
      state.matches = message.matches;
      render();
      sendResponse({ ok: true });
      return false;
    }
    case "content:prompt": {
      state.prompt = message.prompt;
      state.lockedPrompt = false;
      state.open = true;
      render();
      sendResponse({ ok: true });
      return false;
    }
    case "content:locked-prompt": {
      state.prompt = null;
      state.lockedPrompt = true;
      state.open = true;
      render();
      sendResponse({ ok: true });
      return false;
    }
    case "content:prompt-clear": {
      state.prompt = null;
      state.lockedPrompt = false;
      render();
      sendResponse({ ok: true });
      return false;
    }
    case "content:prompt-result": {
      if (message.success) {
        state.prompt = null;
        showToast(message.message ?? "Saved to Keyhold.");
      }
      render();
      sendResponse({ ok: true });
      return false;
    }
    case "content:fill": {
      const pair = findFillPair();
      if (!pair) {
        showToast("No login form found on this page.", "error");
        sendResponse({ ok: false });
        return false;
      }
      const filled = fillFields(pair, message.credential.username, message.credential.password);
      if (filled) {
        showToast("Login filled. Review it, then sign in.");
        state.open = false;
        render();
      } else {
        showToast("Could not fill this form.", "error");
      }
      sendResponse({ ok: filled });
      return false;
    }
    case "content:toast": {
      showToast(message.message, message.tone);
      sendResponse({ ok: true });
      return false;
    }
    default:
      return false;
  }
});

if (!window.__keyholdLoaded) {
  window.__keyholdLoaded = true;
  start();
}
