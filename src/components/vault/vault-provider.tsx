"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  createSealedVault,
  openCredential,
  regenerateRecoveryWrap,
  rewrapVault,
  sealCredential,
  unlockVault,
  unlockVaultWithRecoveryKey,
} from "@/lib/vault/crypto";
import type {
  DecryptedCredential,
  EncryptedCredentialRow,
  EncryptedVaultRecord,
  EncryptedVaultRecord as VaultRecord,
  SealedVault,
  VaultStatus,
} from "@/lib/vault/types";
import type { CredentialInput as CredentialInputValue } from "@/lib/vault/validation";
import { findDuplicate } from "@/lib/vault/validation";
import { createClient } from "@/lib/supabase/client";

export class DuplicateCredentialError extends Error {
  existingId: string;
  constructor(existingId: string) {
    super("A credential for this site and username already exists.");
    this.name = "DuplicateCredentialError";
    this.existingId = existingId;
  }
}

type VaultContextValue = {
  user: User;
  vault: EncryptedVaultRecord | null;
  status: VaultStatus;
  credentials: DecryptedCredential[];
  busy: boolean;
  error: string | null;
  clearError: () => void;
  createVault: (masterPassword: string) => Promise<string>;
  unlock: (masterPassword: string) => Promise<void>;
  recoverVault: (recoveryKey: string, newMasterPassword: string) => Promise<string>;
  lock: () => void;
  refresh: () => Promise<void>;
  createCredential: (input: CredentialInputValue) => Promise<DecryptedCredential>;
  updateCredential: (id: string, input: CredentialInputValue) => Promise<DecryptedCredential>;
  deleteCredential: (id: string) => Promise<void>;
  retrieveSecret: (id: string) => Promise<string>;
  changeMasterPassword: (current: string, next: string) => Promise<void>;
  regenerateRecoveryKey: (current: string) => Promise<string>;
  deleteVault: () => Promise<void>;
  signOut: (scope?: "local" | "global") => Promise<void>;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;
};

const VaultContext = React.createContext<VaultContextValue | null>(null);
const AUTO_LOCK_KEY = "keyhold.autolock.minutes";
const AUTO_LOCK_OPTIONS = [1, 5, 10, 30] as const;

function readAutoLock(): number {
  if (typeof window === "undefined") return 10;
  const raw = Number(window.localStorage.getItem(AUTO_LOCK_KEY));
  return (AUTO_LOCK_OPTIONS as readonly number[]).includes(raw) ? raw : 10;
}

function toCredentialInput(input: CredentialInputValue): CredentialInputValue {
  return {
    applicationName: input.applicationName.trim(),
    websiteUrl: input.websiteUrl.trim(),
    username: input.username.trim(),
    password: input.password,
    notes: input.notes.trim(),
  };
}

function wrapColumns(
  wrapped: Pick<SealedVault, "kdfSalt" | "kdfIterations" | "wrappedDek" | "wrappedDekIv">,
) {
  return {
    kdf_salt: wrapped.kdfSalt,
    kdf_iterations: wrapped.kdfIterations,
    wrapped_dek: wrapped.wrappedDek,
    wrapped_dek_iv: wrapped.wrappedDekIv,
  };
}

function recoveryColumns(
  recovery: Pick<
    SealedVault,
    | "recoverySalt"
    | "recoveryIterations"
    | "recoveryWrappedDek"
    | "recoveryWrappedDekIv"
    | "recoveryKey"
  >,
) {
  return {
    recovery_salt: recovery.recoverySalt,
    recovery_iterations: recovery.recoveryIterations,
    recovery_wrapped_dek: recovery.recoveryWrappedDek,
    recovery_wrapped_dek_iv: recovery.recoveryWrappedDekIv,
  };
}

export function VaultProvider({
  user,
  initialVault,
  children,
}: {
  user: User;
  initialVault: EncryptedVaultRecord | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [vault, setVault] = React.useState<VaultRecord | null>(initialVault);
  const [status, setStatus] = React.useState<VaultStatus>(initialVault ? "locked" : "loading");
  const [credentials, setCredentials] = React.useState<DecryptedCredential[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [autoLockMinutes, setAutoLockState] = React.useState(10);
  const [lastActivity, setLastActivity] = React.useState(() => Date.now());
  const dekRef = React.useRef<CryptoKey | null>(null);

  React.useEffect(() => {
    setAutoLockState(readAutoLock());
  }, []);

  React.useEffect(() => {
    if (initialVault) return;
    let active = true;
    supabase
      .from("vaults")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError("Could not load your vault. Refresh to try again.");
          setStatus("loading");
          return;
        }
        setVault(data ?? null);
        setStatus(data ? "locked" : "no-vault");
      });
    return () => {
      active = false;
    };
  }, [initialVault, supabase, user.id]);

  const lock = React.useCallback(() => {
    dekRef.current = null;
    setCredentials([]);
    setStatus((current) => (current === "no-vault" ? current : current === "loading" ? current : "locked"));
  }, []);

  React.useEffect(() => {
    if (status !== "unlocked") return;
    const handler = () => setLastActivity(Date.now());
    window.addEventListener("pointerdown", handler, { passive: true });
    window.addEventListener("keydown", handler);
    window.addEventListener("touchstart", handler, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [status]);

  React.useEffect(() => {
    if (status !== "unlocked") return;
    const limit = autoLockMinutes * 60_000;
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity >= limit) {
        lock();
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [autoLockMinutes, lastActivity, lock, status]);

  const loadCredentialRows = React.useCallback(
    async (dek: CryptoKey) => {
      const { data, error: queryError } = await supabase
        .from("credentials")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (queryError) throw new Error("Could not load credentials.");
      const settled = await Promise.allSettled(
        (data ?? []).map((row) => openCredential(dek, row as EncryptedCredentialRow)),
      );
      const opened: DecryptedCredential[] = [];
      let failures = 0;
      for (const result of settled) {
        if (result.status === "fulfilled") opened.push(result.value);
        else failures += 1;
      }
      opened.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setCredentials(opened);
      if (failures > 0) {
        setError(
          failures === 1
            ? "One credential could not be decrypted and was skipped."
            : `${failures} credentials could not be decrypted and were skipped.`,
        );
      }
    },
    [supabase, user.id],
  );

  const createVault = React.useCallback(
    async (masterPassword: string) => {
      setBusy(true);
      setError(null);
      try {
        const sealed = await createSealedVault(user.id, masterPassword);
        const { data, error: insertError } = await supabase
          .from("vaults")
          .insert({
            user_id: user.id,
            kdf_salt: sealed.kdfSalt,
            kdf_iterations: sealed.kdfIterations,
            wrapped_dek: sealed.wrappedDek,
            wrapped_dek_iv: sealed.wrappedDekIv,
            recovery_salt: sealed.recoverySalt,
            recovery_iterations: sealed.recoveryIterations,
            recovery_wrapped_dek: sealed.recoveryWrappedDek,
            recovery_wrapped_dek_iv: sealed.recoveryWrappedDekIv,
            encryption_version: 1,
          })
          .select("*")
          .single();
        if (insertError || !data) {
          throw new Error("Could not create the vault. Refresh and try again.");
        }
        const dek = await unlockVault(user.id, masterPassword, data);
        dekRef.current = dek;
        setVault(data);
        setCredentials([]);
        setLastActivity(Date.now());
        setStatus("unlocked");
        return sealed.recoveryKey;
      } finally {
        setBusy(false);
      }
    },
    [supabase, user.id],
  );

  const unlock = React.useCallback(
    async (masterPassword: string) => {
      if (!vault) throw new Error("No vault exists for this account.");
      setBusy(true);
      setError(null);
      try {
        const dek = await unlockVault(user.id, masterPassword, vault);
        dekRef.current = dek;
        await loadCredentialRows(dek);
        setLastActivity(Date.now());
        setStatus("unlocked");
      } finally {
        setBusy(false);
      }
    },
    [loadCredentialRows, user.id, vault],
  );

  const recoverVault = React.useCallback(
    async (recoveryKey: string, newMasterPassword: string) => {
      if (!vault) throw new Error("No vault exists for this account.");
      setBusy(true);
      setError(null);
      try {
        const dek = await unlockVaultWithRecoveryKey(user.id, recoveryKey, vault);
        const rewrapped = await rewrapVault(user.id, dek, newMasterPassword);
        const recovery = await regenerateRecoveryWrap(user.id, dek);
        const { data, error: updateError } = await supabase
          .from("vaults")
          .update({
            ...wrapColumns(rewrapped),
            ...recoveryColumns(recovery),
          })
          .eq("id", vault.id)
          .eq("user_id", user.id)
          .select("*")
          .single();
        if (updateError || !data) throw new Error("Could not update the vault keys.");
        setVault(data);
        return recovery.recoveryKey;
      } finally {
        setBusy(false);
      }
    },
    [supabase, user.id, vault],
  );

  const refresh = React.useCallback(async () => {
    if (!dekRef.current) return;
    setError(null);
    await loadCredentialRows(dekRef.current);
  }, [loadCredentialRows]);

  React.useEffect(() => {
    if (status !== "unlocked") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh().catch(() => setError("Could not refresh the vault."));
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh, status]);

  const createCredential = React.useCallback(
    async (input: CredentialInputValue) => {
      const dek = dekRef.current;
      if (!dek || !vault || status !== "unlocked") throw new Error("Unlock the vault first.");
      const normalized = toCredentialInput(input);
      const duplicate = findDuplicate(credentials, normalized.websiteUrl, normalized.username);
      if (duplicate) throw new DuplicateCredentialError(duplicate.id);

      setBusy(true);
      try {
        const id = crypto.randomUUID();
        const sealed = await sealCredential(dek, user.id, id, normalized);
        const { data, error: insertError } = await supabase
          .from("credentials")
          .insert({
            id,
            user_id: user.id,
            vault_id: vault.id,
            ciphertext: sealed.ciphertext,
            iv: sealed.iv,
            encryption_version: 1,
          })
          .select("*")
          .single();
        if (insertError || !data) throw new Error("Could not save the credential.");
        const opened = await openCredential(dek, data as EncryptedCredentialRow);
        setCredentials((current) => [opened, ...current]);
        return opened;
      } finally {
        setBusy(false);
      }
    },
    [credentials, status, supabase, user.id, vault],
  );

  const updateCredential = React.useCallback(
    async (id: string, input: CredentialInputValue) => {
      const dek = dekRef.current;
      if (!dek || !vault || status !== "unlocked") throw new Error("Unlock the vault first.");
      const normalized = toCredentialInput(input);
      const duplicate = findDuplicate(credentials, normalized.websiteUrl, normalized.username, id);
      if (duplicate) throw new DuplicateCredentialError(duplicate.id);

      setBusy(true);
      try {
        const sealed = await sealCredential(dek, user.id, id, normalized);
        const { data, error: updateError } = await supabase
          .from("credentials")
          .update({ ciphertext: sealed.ciphertext, iv: sealed.iv })
          .eq("id", id)
          .eq("user_id", user.id)
          .select("*")
          .single();
        if (updateError || !data) throw new Error("Could not update the credential.");
        const opened = await openCredential(dek, data as EncryptedCredentialRow);
        setCredentials((current) => current.map((item) => (item.id === id ? opened : item)));
        return opened;
      } finally {
        setBusy(false);
      }
    },
    [credentials, status, supabase, user.id, vault],
  );

  const deleteCredential = React.useCallback(
    async (id: string) => {
      if (status !== "unlocked") throw new Error("Unlock the vault first.");
      setBusy(true);
      try {
        const { error: deleteError } = await supabase
          .from("credentials")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);
        if (deleteError) throw new Error("Could not delete the credential.");
        setCredentials((current) => current.filter((item) => item.id !== id));
      } finally {
        setBusy(false);
      }
    },
    [status, supabase, user.id],
  );

  const retrieveSecret = React.useCallback(
    async (id: string) => {
      if (status !== "unlocked") throw new Error("Unlock the vault first.");
      const credential = credentials.find((item) => item.id === id);
      if (!credential) throw new Error("Credential not found in the unlocked vault.");
      const { data, error: rpcError } = await supabase.rpc("mark_credential_retrieved", {
        p_credential_id: id,
      });
      if (rpcError) throw new Error("Could not record this retrieval.");
      const stamped = typeof data === "string" ? data : new Date().toISOString();
      setCredentials((current) =>
        current.map((item) => (item.id === id ? { ...item, lastRetrievedAt: stamped } : item)),
      );
      return credential.password;
    },
    [credentials, status, supabase],
  );

  const changeMasterPassword = React.useCallback(
    async (current: string, next: string) => {
      if (!vault || !dekRef.current) throw new Error("Unlock the vault first.");
      setBusy(true);
      try {
        await unlockVault(user.id, current, vault);
        const rewrapped = await rewrapVault(user.id, dekRef.current, next);
        const { data, error: updateError } = await supabase
          .from("vaults")
          .update(wrapColumns(rewrapped))
          .eq("id", vault.id)
          .eq("user_id", user.id)
          .select("*")
          .single();
        if (updateError || !data) throw new Error("Could not update the master password.");
        setVault(data);
      } finally {
        setBusy(false);
      }
    },
    [supabase, user.id, vault],
  );

  const regenerateRecoveryKey = React.useCallback(
    async (current: string) => {
      if (!vault || !dekRef.current) throw new Error("Unlock the vault first.");
      setBusy(true);
      try {
        await unlockVault(user.id, current, vault);
        const recovery = await regenerateRecoveryWrap(user.id, dekRef.current);
        const { data, error: updateError } = await supabase
          .from("vaults")
          .update(recoveryColumns(recovery))
          .eq("id", vault.id)
          .eq("user_id", user.id)
          .select("*")
          .single();
        if (updateError || !data) throw new Error("Could not regenerate the recovery key.");
        setVault(data);
        return recovery.recoveryKey;
      } finally {
        setBusy(false);
      }
    },
    [supabase, user.id, vault],
  );

  const deleteVault = React.useCallback(async () => {
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("delete_vault_data");
      if (rpcError) throw new Error("Could not delete the vault.");
      dekRef.current = null;
      setCredentials([]);
      setVault(null);
      setStatus("no-vault");
      router.replace("/app/setup");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [router, supabase]);

  const signOut = React.useCallback(
    async (scope: "local" | "global" = "local") => {
      lock();
      await supabase.auth.signOut({ scope });
      router.replace("/login");
      router.refresh();
    },
    [lock, router, supabase],
  );

  const setAutoLockMinutes = React.useCallback((minutes: number) => {
    const safe = (AUTO_LOCK_OPTIONS as readonly number[]).includes(minutes) ? minutes : 10;
    window.localStorage.setItem(AUTO_LOCK_KEY, String(safe));
    setAutoLockState(safe);
    setLastActivity(Date.now());
  }, []);

  const value = React.useMemo<VaultContextValue>(
    () => ({
      user,
      vault,
      status,
      credentials,
      busy,
      error,
      clearError: () => setError(null),
      createVault,
      unlock,
      recoverVault,
      lock,
      refresh,
      createCredential,
      updateCredential,
      deleteCredential,
      retrieveSecret,
      changeMasterPassword,
      regenerateRecoveryKey,
      deleteVault,
      signOut,
      autoLockMinutes,
      setAutoLockMinutes,
    }),
    [
      autoLockMinutes,
      busy,
      changeMasterPassword,
      createCredential,
      createVault,
      credentials,
      deleteCredential,
      deleteVault,
      error,
      lock,
      recoverVault,
      refresh,
      regenerateRecoveryKey,
      retrieveSecret,
      setAutoLockMinutes,
      signOut,
      status,
      unlock,
      updateCredential,
      user,
      vault,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = React.useContext(VaultContext);
  if (!context) throw new Error("useVault must be used inside VaultProvider.");
  return context;
}
