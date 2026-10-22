"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Fingerprint,
  Key,
  LockKey,
  SignOut,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useVault } from "@/components/vault/vault-provider";
import { RecoveryKeyPanel } from "@/components/vault/recovery-key-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { formatDate } from "@/lib/vault/format";
import { isValidMasterPassword, scorePassword } from "@/lib/vault/strength";

const AUTO_LOCK_OPTIONS = [1, 5, 10, 30];

export function SecuritySettings() {
  const {
    user,
    vault,
    status,
    autoLockMinutes,
    setAutoLockMinutes,
    lock,
    changeMasterPassword,
    regenerateRecoveryKey,
    deleteVault,
    signOut,
  } = useVault();

  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [recoveryPassword, setRecoveryPassword] = React.useState("");
  const [recoveryError, setRecoveryError] = React.useState<string | null>(null);
  const [newRecoveryKey, setNewRecoveryKey] = React.useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePhrase, setDeletePhrase] = React.useState("");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);

  const strength = scorePassword(next);

  async function onChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (!current) {
      setPasswordError("Enter your current master password.");
      return;
    }
    if (!isValidMasterPassword(next)) {
      setPasswordError("Use a new master password with at least 12 characters and good variety.");
      return;
    }
    if (next !== confirm) {
      setPasswordError("The new master passwords do not match.");
      return;
    }
    setWorking(true);
    try {
      await changeMasterPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Master password changed. The recovery key still works.");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Could not change the master password.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function onRegenerateRecovery(event: React.FormEvent) {
    event.preventDefault();
    setRecoveryError(null);
    if (!recoveryPassword) {
      setRecoveryError("Enter your current master password.");
      return;
    }
    setWorking(true);
    try {
      const key = await regenerateRecoveryKey(recoveryPassword);
      setRecoveryPassword("");
      setNewRecoveryKey(key);
    } catch (error) {
      setRecoveryError(
        error instanceof Error ? error.message : "Could not regenerate the recovery key.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function onDeleteVault() {
    if (deletePhrase !== "DELETE MY VAULT") return;
    setDeleteError(null);
    setWorking(true);
    try {
      await deleteVault();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete the vault.");
      setWorking(false);
    }
  }

  async function onGlobalSignOut() {
    setWorking(true);
    try {
      await signOut("global");
    } finally {
      setWorking(false);
      setSignOutOpen(false);
    }
  }

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        Account & vault
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold leading-[1.02] tracking-[-0.05em] text-ink sm:text-[38px]">
            Security settings.
          </h1>
          <p className="mt-2 max-w-[56ch] text-[13px] leading-relaxed text-ink-soft">
            Control how long this device stays unlocked, rotate the master password, and manage
            recovery. Account sign-in stays separate from vault encryption.
          </p>
        </div>
        <Badge tone={status === "unlocked" ? "accent" : "neutral"}>
          {status === "unlocked" ? "Vault unlocked" : "Vault locked"}
        </Badge>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-sage/60 text-forest">
              <Clock size={15} />
            </span>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Session behavior</h2>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
            The decrypted vault lives in this tab only. Inactivity locks it; closing or reloading the
            page discards the key.
          </p>
          <div className="mt-4">
            <Field label="Auto-lock after" htmlFor="auto-lock" hint="Shorter is safer on shared devices.">
              <select
                id="auto-lock"
                value={autoLockMinutes}
                onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
                className="h-11 w-full rounded-input border border-line bg-surface-raised px-3 text-[13px] text-ink focus:border-forest/50 focus:outline-none focus:ring-4 focus:ring-forest/5"
              >
                {AUTO_LOCK_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 1 ? "1 minute" : `${minutes} minutes`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={lock} disabled={status !== "unlocked"}>
              <LockKey size={13} />
              Lock now
            </Button>
            <Link
              href="/app"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] text-ink-soft hover:bg-ink/5 hover:text-ink"
            >
              Back to vault
              <ArrowRight size={12} />
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-sage/60 text-forest">
              <Fingerprint size={15} />
            </span>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Vault metadata</h2>
          </div>
          <dl className="mt-4 space-y-2.5 text-[11.5px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">Account</dt>
              <dd className="truncate font-mono text-[10px] text-ink-soft">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">Vault created</dt>
              <dd className="text-right text-ink-soft">{vault ? formatDate(vault.created_at) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">KDF</dt>
              <dd className="text-right font-mono text-[10px] text-ink-soft">
                PBKDF2-SHA-256 · {(vault?.kdf_iterations ?? 600000).toLocaleString()} rounds
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-faint">Encryption</dt>
              <dd className="text-right font-mono text-[10px] text-ink-soft">AES-256-GCM · v1</dd>
            </div>
          </dl>
          <Link
            href="/forgot-password"
            className="mt-4 inline-flex text-[11.5px] text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
          >
            Reset the account password instead
          </Link>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-sage/60 text-forest">
              <Key size={15} />
            </span>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
              Change master password
            </h2>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
            Re-wraps the same vault key with a new password. Existing credentials and the recovery key
            remain valid.
          </p>
          <form onSubmit={onChangePassword} className="mt-4 space-y-3.5" noValidate>
            <Field label="Current master password" htmlFor="current-master">
              <PasswordField
                id="current-master"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
              />
            </Field>
            <Field label="New master password" htmlFor="new-master">
              <PasswordField
                id="new-master"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                required
              />
              {next && (
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-forest"
                      style={{ width: `${Math.max(strength.scorePercent, 8)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                    {strength.label}
                  </span>
                </div>
              )}
            </Field>
            <Field label="Confirm new master password" htmlFor="confirm-master">
              <PasswordField
                id="confirm-master"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </Field>
            {passwordError && (
              <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2.5 text-[11.5px] text-danger" role="alert">
                {passwordError}
              </p>
            )}
            <Button type="submit" variant="dark" size="sm" loading={working}>
              Update master password
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-accent/40 text-forest">
              <CheckCircle size={15} weight="fill" />
            </span>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Recovery key</h2>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
            Regenerating replaces the key you saved at setup. The old key stops working immediately.
          </p>
          <form onSubmit={onRegenerateRecovery} className="mt-4 space-y-3">
            <Field label="Confirm with master password" htmlFor="recovery-confirm">
              <PasswordField
                id="recovery-confirm"
                autoComplete="current-password"
                value={recoveryPassword}
                onChange={(event) => setRecoveryPassword(event.target.value)}
                required
              />
            </Field>
            {recoveryError && (
              <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2.5 text-[11.5px] text-danger" role="alert">
                {recoveryError}
              </p>
            )}
            <Button type="submit" variant="outline" size="sm" loading={working}>
              <Key size={13} />
              Generate new recovery key
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-sage/60 text-forest">
              <SignOut size={15} />
            </span>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Sessions</h2>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
            Signing out revokes your account session on this device. An unlocked vault is always
            cleared first.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut("local")}
              disabled={working}
            >
              Sign out this device
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSignOutOpen(true)}>
              Sign out everywhere
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-danger/20 bg-danger-soft/40 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-danger/10 text-danger">
              <Trash size={15} />
            </span>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Delete vault</h2>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
            Permanently removes the vault, every encrypted credential, and audit events. The account
            itself remains; you can create a fresh vault afterward.
          </p>
          <Button
            variant="danger"
            size="sm"
            className="mt-4"
            onClick={() => {
              setDeleteOpen(true);
              setDeletePhrase("");
              setDeleteError(null);
            }}
          >
            Delete my vault
          </Button>
        </section>
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning-soft px-3.5 py-3 text-[11px] leading-relaxed text-warning">
        <Warning size={14} className="mt-0.5 shrink-0" />
        <p>
          Keyhold cannot recover a vault without the master password or recovery key. Account password
          resets do not affect vault encryption.
        </p>
      </div>

      <Dialog
        open={Boolean(newRecoveryKey)}
        onClose={() => undefined}
        dismissible={false}
        title="New recovery key"
        description="The previous recovery key has been retired. Store this one before closing."
        className="w-[min(94vw,620px)]"
      >
        {newRecoveryKey && (
          <RecoveryKeyPanel
            recoveryKey={newRecoveryKey}
            onDone={() => {
              setNewRecoveryKey(null);
              toast.success("Recovery key rotated.");
            }}
            doneLabel="I saved the new key"
            description="This is the only copy. Keyhold does not store it."
          />
        )}
      </Dialog>

      <Dialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out everywhere?"
        description="All account sessions will be revoked. You will need to sign in again on every device, then unlock the vault with the master password."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSignOutOpen(false)} disabled={working}>
              Cancel
            </Button>
            <Button variant="dark" onClick={onGlobalSignOut} loading={working}>
              Sign out all sessions
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          Credentials are not deleted. Pending extension sessions will also fail on their next request.
        </p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          if (!working) setDeleteOpen(false);
        }}
        title="Delete this vault permanently?"
        description="This removes every encrypted credential and cannot be undone. There is no server-side backup that can decrypt your data."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={working}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onDeleteVault}
              loading={working}
              disabled={deletePhrase !== "DELETE MY VAULT"}
            >
              Delete vault
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger-soft p-3.5">
            <Warning size={16} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[12px] leading-relaxed text-danger">
              Type <span className="font-mono font-semibold">DELETE MY VAULT</span> to confirm.
            </p>
          </div>
          <Field label="Confirmation phrase" htmlFor="delete-phrase">
            <Input
              id="delete-phrase"
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value.toUpperCase())}
              placeholder="DELETE MY VAULT"
              autoComplete="off"
              className="font-mono tracking-[0.08em]"
            />
          </Field>
          {deleteError && (
            <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2.5 text-[11.5px] text-danger" role="alert">
              {deleteError}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
