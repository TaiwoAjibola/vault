"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Fingerprint, Key, LockKey, ShieldCheck, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useVault } from "@/components/vault/vault-provider";
import { RecoveryKeyPanel } from "@/components/vault/recovery-key-panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { isValidMasterPassword, scorePassword } from "@/lib/vault/strength";
import Link from "next/link";

export function SetupScreen() {
  const router = useRouter();
  const { user, vault, status, createVault, busy } = useVault();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = React.useState<string | null>(null);
  const [gate, setGate] = React.useState(false);
  const strength = scorePassword(password);

  React.useEffect(() => {
    if (status === "loading") return;
    if (vault && !gate && !recoveryKey) router.replace("/app");
  }, [gate, recoveryKey, router, status, vault]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidMasterPassword(password)) {
      setError("Choose a master password with at least 12 characters and a mix of character types.");
      return;
    }
    if (password !== confirm) {
      setError("The master passwords do not match.");
      return;
    }
    if (!acknowledged) {
      setError("Acknowledge the key-loss warning before continuing.");
      return;
    }

    setGate(true);
    try {
      const key = await createVault(password);
      setRecoveryKey(key);
    } catch (creationError) {
      setGate(false);
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Could not create the vault. Try again.",
      );
    }
  }

  if (status === "loading") {
    return <div className="mx-auto mt-10 h-96 max-w-[520px] animate-pulse rounded-3xl bg-line/30" />;
  }

  if (vault && !recoveryKey) {
    return (
      <div className="mx-auto mt-12 max-w-[520px] rounded-3xl border border-line bg-surface p-7">
        <span className="grid size-10 place-items-center rounded-full bg-sage text-forest">
          <LockKey size={18} />
        </span>
        <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-ink">
          Your vault already exists.
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          A vault is already associated with {user.email}. Open it and unlock with the master password.
        </p>
        <Button onClick={() => router.replace("/app")} className="mt-5" size="lg">
          Open my vault
        </Button>
      </div>
    );
  }

  if (recoveryKey) {
    return (
      <div className="mx-auto max-w-[620px] pb-16 pt-8">
        <RecoveryKeyPanel
          recoveryKey={recoveryKey}
          onDone={() => {
            toast.success("Vault created.");
            router.replace("/app");
            router.refresh();
          }}
          doneLabel="I saved it — open my vault"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1000px] gap-10 pb-16 pt-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pt-14">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Vault setup · Step 1 of 1
        </p>
        <h1 className="mt-3 max-w-[12ch] text-[40px] font-semibold leading-[0.98] tracking-[-0.05em] text-ink sm:text-[48px]">
          Set the lock.
        </h1>
        <p className="mt-5 max-w-[38ch] text-[14px] leading-relaxed text-ink-soft">
          Choose one master password for this vault. It derives the key that decrypts your
          credentials on this device. It is never sent to the server.
        </p>

        <div className="mt-8 space-y-3.5">
          {[
            { icon: Fingerprint, text: "Only you can derive the vault key." },
            { icon: ShieldCheck, text: "Every credential is sealed with AES-256-GCM." },
            { icon: Key, text: "A recovery key is generated once, at the end." },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2.5 text-[12.5px] text-ink-soft">
              <span className="grid size-7 place-items-center rounded-full border border-line bg-surface text-forest">
                <item.icon size={14} />
              </span>
              {item.text}
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning-soft p-3.5">
          <Warning size={15} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-[11.5px] leading-relaxed text-warning">
            Keyhold cannot reset this password. If you forget it and lose the recovery key, the vault
            cannot be decrypted. Keep the recovery key offline.
          </p>
        </div>
      </div>

      <div className="rounded-[24px] border border-line-strong bg-surface p-6 shadow-card sm:p-8">
        <div className="flex items-center justify-between">
          <span className="grid size-10 place-items-center rounded-full bg-forest text-paper">
            <LockKey size={18} />
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">
            {user.email}
          </span>
        </div>
        <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.035em] text-ink">
          Create a master password.
        </h2>

        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <Field
            label="Master password"
            htmlFor="master-password"
            hint="A long passphrase beats a short complicated word. 16+ characters is ideal."
          >
            <PasswordField
              id="master-password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {password && (
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
          <Field label="Confirm master password" htmlFor="confirm-password">
            <PasswordField
              id="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-paper/60 p-3.5">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 size-4 accent-[#0e2a1f]"
            />
            <span className="text-[11.5px] leading-relaxed text-ink-soft">
              I understand that Keyhold cannot reset this password, and that losing both the master
              password and recovery key makes the vault unrecoverable.
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" loading={busy} className="w-full justify-between" size="lg">
            Create vault
            <ArrowRight size={16} weight="bold" />
          </Button>
        </form>

        <p className="mt-4 text-[10.5px] leading-relaxed text-ink-faint">
          Prefer to look around first?{" "}
          <Link href="/" className="underline underline-offset-2">
            Back to home
          </Link>
          . Your account stays signed in.
        </p>
      </div>
    </div>
  );
}
