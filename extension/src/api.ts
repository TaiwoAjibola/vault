import { config } from "./config";
import {
  clearSession,
  getSession,
  setSession,
  type StoredSession,
} from "./session";
import type { EncryptedCredentialRow, EncryptedVaultRecord } from "../../src/lib/vault/types";

const AUTH_URL = `${config.supabaseUrl.replace(/\/$/, "")}/auth/v1`;
const REST_URL = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1`;

export class AuthExpiredError extends Error {
  constructor() {
    super("Your Keyhold session expired. Sign in again.");
    this.name = "AuthExpiredError";
  }
}

function headers(accessToken?: string): Record<string, string> {
  return {
    apikey: config.anonKey,
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function authErrorMessage(payload: unknown): string {
  const message =
    payload && typeof payload === "object" && "error_description" in payload
      ? String((payload as { error_description?: unknown }).error_description ?? "")
      : "";
  if (message.toLowerCase().includes("invalid")) return "Email or password is incorrect.";
  return "Could not sign in. Check your email and password.";
}

function toStoredSession(payload: unknown): StoredSession {
  const value = payload as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user?: { id?: string; email?: string };
  };
  if (!value.access_token || !value.refresh_token || !value.user?.id) {
    throw new Error("The authentication service returned an unexpected response.");
  }
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: Date.now() + Math.max(60, value.expires_in ?? 3600) * 1000,
    user: { id: value.user.id, email: value.user.email ?? "" },
  };
}

let refreshPromise: Promise<StoredSession> | null = null;

async function refreshSession(): Promise<StoredSession> {
  const current = await getSession();
  if (!current) throw new AuthExpiredError();
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ refresh_token: current.refreshToken }),
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        await clearSession();
        throw new AuthExpiredError();
      }
      const next = toStoredSession(payload);
      await setSession(next);
      return next;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function requireSession(): Promise<StoredSession> {
  const session = await getSession();
  if (!session) throw new AuthExpiredError();
  if (session.expiresAt <= Date.now() + 60_000) {
    return refreshSession();
  }
  return session;
}

export async function signIn(email: string, password: string): Promise<StoredSession> {
  const response = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const payload = await safeJson(response);
  if (!response.ok) throw new Error(authErrorMessage(payload));
  const session = toStoredSession(payload);
  await setSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  const session = await getSession();
  try {
    if (session) {
      await fetch(`${AUTH_URL}/logout`, {
        method: "POST",
        headers: headers(session.accessToken),
      });
    }
  } catch {
    // Local session is cleared regardless.
  } finally {
    await clearSession();
  }
}

export async function authedFetch(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  let session = await requireSession();
  let response = await fetch(`${REST_URL}${path}`, {
    ...init,
    headers: { ...headers(session.accessToken), ...(init.headers ?? {}) },
  });

  if (response.status === 401 && retry) {
    session = await refreshSession();
    response = await fetch(`${REST_URL}${path}`, {
      ...init,
      headers: { ...headers(session.accessToken), ...(init.headers ?? {}) },
    });
  }

  if (response.status === 401) {
    await clearSession();
    throw new AuthExpiredError();
  }

  return response;
}

async function dataError(response: Response): Promise<Error> {
  if (response.status === 403) {
    return new Error("This request is not permitted for your account.");
  }
  if (response.status === 404) {
    return new Error("The requested vault record was not found.");
  }
  return new Error("The vault request failed. Try again.");
}

export async function getVault(userId: string): Promise<EncryptedVaultRecord | null> {
  const response = await authedFetch(`/vaults?select=*&user_id=eq.${encodeURIComponent(userId)}`);
  if (!response.ok) throw await dataError(response);
  const rows = (await response.json()) as EncryptedVaultRecord[];
  return rows[0] ?? null;
}

export async function listCredentialRows(userId: string): Promise<EncryptedCredentialRow[]> {
  const response = await authedFetch(
    `/credentials?select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
  );
  if (!response.ok) throw await dataError(response);
  return (await response.json()) as EncryptedCredentialRow[];
}

export async function insertCredentialRow(row: {
  id: string;
  user_id: string;
  vault_id: string;
  ciphertext: string;
  iv: string;
}): Promise<EncryptedCredentialRow> {
  const response = await authedFetch("/credentials", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...row, encryption_version: 1 }),
  });
  if (!response.ok) throw await dataError(response);
  const rows = (await response.json()) as EncryptedCredentialRow[];
  if (!rows[0]) throw new Error("The credential was not saved.");
  return rows[0];
}

export async function updateCredentialRow(
  userId: string,
  credentialId: string,
  ciphertext: string,
  iv: string,
): Promise<EncryptedCredentialRow> {
  const response = await authedFetch(
    `/credentials?id=eq.${encodeURIComponent(credentialId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ciphertext, iv }),
    },
  );
  if (!response.ok) throw await dataError(response);
  const rows = (await response.json()) as EncryptedCredentialRow[];
  if (!rows[0]) throw new Error("The credential was not updated.");
  return rows[0];
}

export async function markRetrieved(credentialId: string): Promise<string | null> {
  const response = await authedFetch("/rpc/mark_credential_retrieved", {
    method: "POST",
    body: JSON.stringify({ p_credential_id: credentialId }),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return typeof payload === "string" ? payload : null;
}
