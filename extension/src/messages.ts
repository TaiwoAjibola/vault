import type { DecryptedCredential } from "../../src/lib/vault/types";

export type CredentialSummary = {
  id: string;
  applicationName: string;
  websiteUrl: string;
  origin: string;
  username: string;
  updatedAt: string;
  lastRetrievedAt: string | null;
};

export type VaultState = {
  signedIn: boolean;
  unlocked: boolean;
  email: string | null;
  userId: string | null;
  unlockExpiresAt: number | null;
  appUrl: string;
};

export type PromptKind = "save" | "update";

export type SavePrompt = {
  promptId: string;
  kind: PromptKind;
  origin: string;
  host: string;
  applicationName: string;
  username: string;
  maskedPassword: string;
  existingId?: string;
};

export type LoginCandidate = {
  username: string;
  password: string;
};

export type ManualSaveInput = {
  applicationName: string;
  websiteUrl: string;
  username: string;
  password: string;
  notes?: string;
  updateId?: string;
};

export type SiteState = {
  origin: string | null;
  enabled: boolean;
  neverAsk: boolean;
  hasPermission: boolean;
};

export type PageReady = {
  type: "page:ready";
  origin: string;
  hasPasswordField: boolean;
  hasLoginForm: boolean;
  title: string;
};

export type PageLoginSubmitted = {
  type: "page:login-submitted";
  origin: string;
  kind: "login" | "signup";
  candidate: LoginCandidate;
  title: string;
};

export type PageLoginResult = {
  type: "page:login-result";
  origin: string;
  success: boolean;
};

export type ContentRequest =
  | PageReady
  | PageLoginSubmitted
  | PageLoginResult
  | { type: "page:request-matches"; origin: string }
  | { type: "page:fill-request"; origin: string; credentialId: string }
  | { type: "page:manual-save"; origin: string; title: string; candidate: LoginCandidate }
  | { type: "page:prompt-action"; promptId: string; action: "save" | "dismiss" | "never" }
  | { type: "page:open-unlock" }
  | { type: "page:open-app" }
  | { type: "page:site-status"; origin: string }
  | { type: "page:enable-site"; origin: string };

export type PopupRequest =
  | { type: "auth:status" }
  | { type: "auth:signin"; email: string; password: string }
  | { type: "auth:signout" }
  | { type: "vault:unlock"; masterPassword: string }
  | { type: "vault:lock" }
  | { type: "vault:matches"; origin: string | null }
  | { type: "vault:all" }
  | { type: "credential:fill"; tabId: number; credentialId: string; origin: string }
  | { type: "credential:get"; credentialId: string }
  | { type: "manual:save"; input: ManualSaveInput; origin: string | null }
  | { type: "site:status"; origin: string | null }
  | { type: "site:enable"; origin: string; tabId?: number }
  | { type: "site:disable"; origin: string }
  | { type: "site:never-ask"; origin: string; never: boolean }
  | { type: "ui:open-unlock" }
  | { type: "ui:open-app" };

export type ExtensionMessage = ContentRequest | PopupRequest | { type: "ui:unlocked"; origin?: string };

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "locked" | "signed-out" | "forbidden" | "not-found" };

export type ContentMessage =
  | {
      type: "content:state";
      signedIn: boolean;
      unlocked: boolean;
      enabled: boolean;
    }
  | {
      type: "content:matches";
      matches: CredentialSummary[];
      enabled: boolean;
    }
  | { type: "content:fill"; credential: DecryptedCredential }
  | { type: "content:prompt"; prompt: SavePrompt }
  | { type: "content:locked-prompt"; origin: string }
  | { type: "content:prompt-clear" }
  | { type: "content:prompt-result"; success: boolean; message?: string }
  | { type: "content:toast"; message: string; tone: "success" | "error" };

export function summarizeCredential(credential: DecryptedCredential): CredentialSummary {
  return {
    id: credential.id,
    applicationName: credential.applicationName,
    websiteUrl: credential.websiteUrl,
    origin: credential.websiteUrl,
    username: credential.username,
    updatedAt: credential.updatedAt,
    lastRetrievedAt: credential.lastRetrievedAt,
  };
}
