"use client";

import * as React from "react";
import { ArrowRight, Key, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { useVault } from "@/components/vault/vault-provider";
import { RecoveryKeyPanel } from "@/components/vault/recovery-key-panel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { isValidMasterPassword, scorePassword } from "@/lib/vault/strength";
import { formatDate } from "@/lib/vault/format";

export function UnlockScreen() {
  const { user, vault, unlock, recoverVault, busy } = useVault();
  const [mode, setMode] = React.useState<"password" | "recovery">("password");
  const [password, setPassword] = React.useState("");
  const [recoveryKey, setRecoveryKey] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [capsLock, setCapsLock] = React.useState(false);
  const [newRecoveryKey, setNewRecoveryKey] = React.useState<string | null>(null);
  const [recoveryError, setRecoveryError] = React.useState<string | null>(null);
  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!password) {
      setError("Enter your vault master password.");
      return;
    }
    try {
      await unlock(password);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Could not unlock the vault.");
    }
  }

  async function handleRecovery(event: React.FormEvent) {
    event.preventDefault();
    setRecoveryError(null);
    if (!recoveryKey.trim()) {
      setRecoveryError("Enter your recovery key.");
      return;
    }
    if (!isValidMasterPassword(newPassword)) {
      setRecoveryError("Choose a stronger new master password (12+ characters).");
      return;
    }
    if (newPassword !== confirm) {
      setRecoveryError("The new master passwords do not match.");
      return;
    }
    try {
      const key = await recoverVault(recoveryKey, newPassword);
      setNewRecoveryKey(key);
    } catch (recoveryFailure) {
      setRecoveryError(
        recoveryFailure instanceof Error ? recoveryFailure.message : "Could not recover the vault.",
      );
    }
  }

  async function finishRecovery() {
    try {
      await unlock(newPassword);
      setNewRecoveryKey(null);
    } catch {
      setRecoveryError("Keys were reset. Sign in again and unlock with your new master password.");
      setNewRecoveryKey(null);
      setMode("password");
    }
  }

  const strength = scorePassword(newPassword);

  return (
    <div className="mx-auto grid max-w-[940px] gap-0 overflow-hidden rounded-[26px] border border-line-strong bg-surface shadow-float lg:grid-cols-[0.92fr_1.08fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-sage/35 p-9 lg:flex">
        <div className="pointer-events-none absolute inset-0 keyhole-dots opacity-50" aria-hidden="true" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-forest/15 bg-surface/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-forest">
            <LockKey size={11} weight="fill" />
            Locked
          </span>
          <h1 className="mt-6 max-w-[10ch] text-[38px] font-semibold leading-[0.98] tracking-[-0.05em] text-ink">
            Welcome back to your vault.
          </h1>
          <p className="mt-4 max-w-[32ch] text-[13px] leading-relaxed text-ink-soft">
            {user.email}. Your credentials are still encrypted on the server until this device
            derives the key.
          </p>
        </div>
        <div className="relative mt-10 space-y-2.5 border-t border-forest/10 pt-5">
          <div className="flex items-center gap-2 text-[11.5px] text-ink-soft">
            <ShieldCheck size={14} className="text-forest" />
            Vault created {vault ? formatDate(vault.created_at) : "recently"}
          </div>
          <p className="max-w-[34ch] text-[11px] leading-relaxed text-ink-faint">
            The master password is never sent to the server. It derives a wrapping key locally and
            stays in this browser tab.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-9">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="grid size-9 place-items-center rounded-full bg-sage text-forest">
            <LockKey size={17} />
          </span>
          <div>
            <p className="text-[13px] font-medium text-ink">Vault locked</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              Unlock this device
            </p>
          </div>
        </div>

        {mode === "password" ? (
          <form onSubmit={handleUnlock} className="mt-6 space-y-4 lg:mt-0" noValidate>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                Master password
              </p>
              <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.04em] text-ink">
                Unlock your vault.
              </h2>
            </div>
            <Field label="Master password" htmlFor="master-password">
              <PasswordField
                id="master-password"
                autoFocus
                autoComplete="current-password"
                placeholder="Your vault master password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                invalid={Boolean(error)}
                required
              />
            </Field>
            {capsLock && (
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-warning">
                Caps Lock is on
              </p>
            )}
            {error && (
              <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={busy} className="w-full justify-between" size="lg">
              Unlock vault
              <ArrowRight size={16} weight="bold" />
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11.5px]">
              <button
                type="button"
                onClick={() => {
                  setMode("recovery");
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
              >
                <Key size={12} />
                Use recovery key
              </button>
              <span className="text-ink-faint">Auto-locks after inactivity</span>
            </div>
            <div className="rounded-xl border border-line bg-paper/60 p-3.5 text-[11px] leading-relaxed text-ink-faint">
              Forgot the master password? Use the recovery key you saved when creating the vault.
              Without either, the encrypted vault cannot be recovered.
            </div>
          </form>
        ) : (
          <form onSubmit={handleRecovery} className="mt-6 space-y-4 lg:mt-0" noValidate>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                Recovery
              </p>
              <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.04em] text-ink">
                Reset the master password.
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
                Your recovery key unwraps the vault key. You will choose a new master password and
                receive a new recovery key.
              </p>
            </div>
            <Field label="Recovery key" htmlFor="recovery-key">
              <Input
                id="recovery-key"
                autoComplete="off"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                value={recoveryKey}
                onChange={(event) => setRecoveryKey(event.target.value.toUpperCase())}
                className="font-mono text-[13px] tracking-[0.08em]"
                required
              />
            </Field>
            <Field label="New master password" htmlFor="new-master-password">
              <PasswordField
                id="new-master-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              {newPassword && (
                <div className="flex items-center gap-2.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-forest transition-[width] duration-300"
                      style={{ width: `${Math.max(strength.scorePercent, 8)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                    {strength.label}
                  </span>
                </div>
              )}
            </Field>
            <Field label="Confirm new master password" htmlFor="confirm-master-password">
              <PasswordField
                id="confirm-master-password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </Field>
            {recoveryError && (
              <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger" role="alert">
                {recoveryError}
              </p>
            )}
            <Button type="submit" loading={busy} className="w-full justify-between" size="lg">
              Reset with recovery key
              <ArrowRight size={16} weight="bold" />
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setRecoveryError(null);
              }}
              className="text-[11.5px] text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
            >
              Back to master password
            </button>
          </form>
        )}
      </div>

      <Dialog
        open={Boolean(newRecoveryKey)}
        onClose={() => undefined}
        dismissible={false}
        title="Your new recovery key"
        description="The old recovery key no longer works. Save this replacement before opening the vault."
        className="w-[min(94vw,620px)]"
      >
        {newRecoveryKey && (
          <RecoveryKeyPanel
            recoveryKey={newRecoveryKey}
            onDone={finishRecovery}
            doneLabel="Open my vault"
            title="New recovery key"
            description="The previous recovery key has been retired. Store this new one offline."
          />
        )}
      </Dialog>
    </div>
  );
}
