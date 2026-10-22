import type { LoginCandidate } from "./messages";

export type FieldDescriptor = {
  type: string;
  name: string;
  id: string;
  autocomplete: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  visible: boolean;
};

export type LoginPair = {
  username: HTMLInputElement | null;
  password: HTMLInputElement;
};

const USERNAME_HINTS = /user|email|login|account|identifier|phone|handle/i;
const SIGNUP_HINTS = /\b(sign\s*up|signup|register|create\s+(an\s+)?account|join|new\s+account|get\s+started)\b/i;
const LOGIN_HINTS = /\b(log\s*in|login|sign\s*in|signin|continue|next|submit)\b/i;

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function describeField(input: HTMLInputElement): FieldDescriptor {
  const style = window.getComputedStyle(input);
  const rects = input.getClientRects();
  return {
    type: normalized(input.type),
    name: normalized(input.name),
    id: normalized(input.id),
    autocomplete: normalized(input.getAttribute("autocomplete")),
    placeholder: normalized(input.getAttribute("placeholder")),
    value: input.value,
    disabled: input.disabled || input.readOnly,
    visible:
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") > 0 &&
      rects.length > 0,
  };
}

export function isPasswordDescriptor(field: FieldDescriptor): boolean {
  return field.type === "password" && field.visible && !field.disabled;
}

export function isUsernameDescriptor(field: FieldDescriptor): boolean {
  if (!field.visible || field.disabled) return false;
  if (["text", "email", "tel", ""].includes(field.type) === false) return false;
  if (field.autocomplete.includes("current-password") || field.autocomplete.includes("new-password")) {
    return false;
  }
  return (
    USERNAME_HINTS.test(field.autocomplete) ||
    USERNAME_HINTS.test(field.name) ||
    USERNAME_HINTS.test(field.id) ||
    USERNAME_HINTS.test(field.placeholder) ||
    field.type === "email"
  );
}

export function scoreUsernameDescriptor(field: FieldDescriptor): number {
  if (!isUsernameDescriptor(field)) return -1;
  let score = 0;
  if (field.type === "email") score += 30;
  if (USERNAME_HINTS.test(field.autocomplete)) score += 25;
  if (USERNAME_HINTS.test(field.name)) score += 15;
  if (USERNAME_HINTS.test(field.id)) score += 12;
  if (USERNAME_HINTS.test(field.placeholder)) score += 8;
  if (field.autocomplete.includes("username")) score += 20;
  return score;
}

export function isPasswordFieldVisible(input: HTMLInputElement): boolean {
  return isPasswordDescriptor(describeField(input));
}

export function visiblePasswordFields(root: ParentNode = document): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter(
    isPasswordFieldVisible,
  );
}

export function pickUsernameField(
  password: HTMLInputElement,
  scope: ParentNode = document,
): HTMLInputElement | null {
  const candidates = Array.from(
    scope.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="email"], input[type="tel"], input:not([type])',
    ),
  ).filter((input) => {
    if (input === password) return false;
    if (input.closest("[hidden], [aria-hidden='true']")) return false;
    return isUsernameDescriptor(describeField(input));
  });

  const beforePassword = candidates.filter(
    (input) =>
      (input.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  );
  const pool = beforePassword.length > 0 ? beforePassword : candidates;

  let best: HTMLInputElement | null = null;
  let bestScore = -1;
  for (const input of pool) {
    const score = scoreUsernameDescriptor(describeField(input));
    if (score > bestScore) {
      best = input;
      bestScore = score;
    }
  }
  return bestScore >= 0 ? best : null;
}

export function formText(form: HTMLFormElement): string {
  const parts = [form.innerText ?? ""];
  for (const element of Array.from(form.querySelectorAll("button, input[type='submit'], input[type='button']"))) {
    if (element instanceof HTMLInputElement) {
      parts.push(element.value);
    } else {
      parts.push(element.textContent ?? "");
    }
  }
  return parts.join(" ");
}

export function classifyForm(
  form: HTMLFormElement,
  passwordCount: number,
): "login" | "signup" | "unknown" {
  const text = formText(form);
  if (passwordCount > 1) return "signup";
  if (SIGNUP_HINTS.test(text)) return "signup";
  if (LOGIN_HINTS.test(text)) return "login";
  const autocomplete = normalized(
    Array.from(form.querySelectorAll<HTMLInputElement>('input[type="password"]'))
      .map((input) => input.getAttribute("autocomplete"))
      .join(" "),
  );
  if (autocomplete.includes("new-password")) return "signup";
  if (autocomplete.includes("current-password")) return "login";
  return "unknown";
}

export function detectLoginForms(doc: Document = document): Array<{
  form: HTMLFormElement;
  pair: LoginPair;
  kind: "login" | "signup" | "unknown";
}> {
  const results: Array<{
    form: HTMLFormElement;
    pair: LoginPair;
    kind: "login" | "signup" | "unknown";
  }> = [];

  for (const form of Array.from(doc.querySelectorAll("form"))) {
    const passwords = visiblePasswordFields(form);
    if (passwords.length === 0) continue;
    const password = passwords[passwords.length - 1];
    const username = pickUsernameField(password, form);
    const kind = classifyForm(form, passwords.length);
    results.push({ form, pair: { username, password }, kind });
  }

  if (results.length === 0) {
    const passwords = visiblePasswordFields(doc);
    if (passwords.length === 1) {
      const password = passwords[0];
      const container = password.closest("form, [role='form'], main, section, div") ?? doc;
      results.push({
        form: password.form ?? doc.createElement("form"),
        pair: { username: pickUsernameField(password, container), password },
        kind: "unknown",
      });
    }
  }

  return results;
}

export function collectCandidate(pair: LoginPair): LoginCandidate | null {
  const password = pair.password.value;
  const username = pair.username?.value ?? "";
  if (!password || !username.trim()) return null;
  return { username: username.trim(), password };
}

export function findLoginPairForElement(input: HTMLInputElement): LoginPair | null {
  const form = input.form;
  if (form) {
    const passwords = visiblePasswordFields(form);
    if (passwords.length > 0) {
      const password = passwords.includes(input) ? input : passwords[passwords.length - 1];
      return { username: pickUsernameField(password, form), password };
    }
  }
  return { username: pickUsernameField(input, document), password: input };
}

export function hasVisiblePasswordField(doc: Document = document): boolean {
  return visiblePasswordFields(doc).length > 0;
}

export function pageOrigin(): string | null {
  if (location.protocol !== "https:" && location.protocol !== "http:") return null;
  return location.origin;
}

export function hostnameLabel(): string {
  const host = location.hostname.replace(/^www\./, "");
  if (!host) return "This site";
  const label = host.split(".")[0];
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : host;
}

export function pageTitle(): string {
  const title = document.title.replace(/\s+/g, " ").trim();
  if (!title) return hostnameLabel();
  return title.length > 80 ? `${title.slice(0, 77)}…` : title;
}

export function fillFields(pair: LoginPair, username: string, password: string): boolean {
  const targets = [pair.username, pair.password].filter(
    (input): input is HTMLInputElement => input instanceof HTMLInputElement,
  );
  if (targets.length === 0) return false;

  for (const input of targets) {
    const value = input === pair.password ? password : username;
    const setter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  pair.username?.focus();
  pair.password.focus();
  return true;
}

export function maskPassword(password: string): string {
  return "•".repeat(Math.min(12, Math.max(8, Math.min(password.length, 12))));
}
