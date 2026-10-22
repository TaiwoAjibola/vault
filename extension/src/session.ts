export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; email: string };
};

export type StoredDek = {
  raw: string;
  userId: string;
  expiresAt: number;
};

export type ExtensionSettings = {
  autoLockMinutes: number;
};

const KEYS = {
  session: "kh.session",
  dek: "kh.dek",
  neverAsk: "kh.neverAsk",
  settings: "kh.settings",
} as const;

const DEFAULT_SETTINGS: ExtensionSettings = { autoLockMinutes: 10 };

export async function configureSessionStorage(): Promise<void> {
  try {
    await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  } catch {
    // Older Chromium builds may not expose setAccessLevel. Session storage is
    // still memory-only and unavailable to content scripts by default.
  }
}

export async function getSession(): Promise<StoredSession | null> {
  const result = await chrome.storage.session.get(KEYS.session);
  const value = result[KEYS.session] as StoredSession | undefined;
  if (!value?.accessToken || !value.refreshToken || !value.user?.id) return null;
  return value;
}

export async function setSession(session: StoredSession): Promise<void> {
  await chrome.storage.session.set({ [KEYS.session]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove([KEYS.session, KEYS.dek]);
}

export async function getDek(): Promise<StoredDek | null> {
  const result = await chrome.storage.session.get(KEYS.dek);
  const value = result[KEYS.dek] as StoredDek | undefined;
  if (!value?.raw || !value.userId || !value.expiresAt) return null;
  if (value.expiresAt <= Date.now()) {
    await chrome.storage.session.remove(KEYS.dek);
    return null;
  }
  return value;
}

export async function setDek(raw: string, userId: string, autoLockMinutes: number): Promise<number> {
  const expiresAt = Date.now() + autoLockMinutes * 60_000;
  await chrome.storage.session.set({ [KEYS.dek]: { raw, userId, expiresAt } });
  return expiresAt;
}

export async function clearDek(): Promise<void> {
  await chrome.storage.session.remove(KEYS.dek);
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(KEYS.settings);
  const value = result[KEYS.settings] as ExtensionSettings | undefined;
  const minutes = value?.autoLockMinutes;
  return {
    autoLockMinutes:
      typeof minutes === "number" && [1, 5, 10, 30].includes(minutes)
        ? minutes
        : DEFAULT_SETTINGS.autoLockMinutes,
  };
}

export async function getNeverAsk(): Promise<string[]> {
  const result = await chrome.storage.local.get(KEYS.neverAsk);
  const value = result[KEYS.neverAsk];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function setNeverAsk(origin: string, never: boolean): Promise<void> {
  const current = new Set(await getNeverAsk());
  if (never) current.add(origin);
  else current.delete(origin);
  await chrome.storage.local.set({ [KEYS.neverAsk]: [...current] });
}
