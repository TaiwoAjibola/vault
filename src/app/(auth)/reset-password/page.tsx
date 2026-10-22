"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
import { AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { scorePassword } from "@/lib/vault/strength";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(Boolean(data.session));
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Could not update the password. Request a fresh reset link.");
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch {
      setError("Could not reach the account service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const strength = scorePassword(password);

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new account password."
      subtitle="This changes the password you use to sign in. Your vault master password and encrypted credentials are unaffected."
      footer={
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          After signing in, you will still need your vault master password or recovery key to open
          the credential vault.
        </p>
      }
    >
      {checking ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface" />
      ) : ready ? (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="New account password" htmlFor="password">
            <PasswordField
              id="password"
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
          <Field label="Confirm password" htmlFor="confirm">
            <PasswordField
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </Field>
          {error && (
            <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full justify-between" size="lg">
            Update password
            <ArrowRight size={16} weight="bold" />
          </Button>
        </form>
      ) : (
        <div className="rounded-2xl border border-warning/20 bg-warning-soft p-6">
          <p className="text-[13px] leading-relaxed text-warning">
            This reset link is missing or expired. Request a new one from the sign-in page.
          </p>
          <Link href="/forgot-password" className="mt-4 inline-flex text-[12.5px] font-medium text-forest underline underline-offset-4">
            Request a new link
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
