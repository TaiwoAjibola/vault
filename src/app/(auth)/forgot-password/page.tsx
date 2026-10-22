"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, EnvelopeSimple } from "@phosphor-icons/react";
import { AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/vault/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(result.data, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setSent(true);
    } catch {
      setError("Could not send the reset email. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title={sent ? "Check your inbox." : "Reset account access."}
      subtitle={
        sent
          ? "If an account exists for that email, a password reset link is on its way."
          : "This resets the password that signs you in to Keyhold. It does not reset or recover your vault master password."
      }
      footer={
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          Remember: losing your vault master password requires your recovery key. Account reset
          emails cannot decrypt a vault.
        </p>
      }
    >
      {sent ? (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <span className="grid size-10 place-items-center rounded-full bg-sage text-forest">
            <EnvelopeSimple size={18} />
          </span>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
            The link expires after a short time. If it does not arrive, check spam or request another.
          </p>
          <Link href="/login" className="mt-5 inline-flex text-[12.5px] font-medium text-forest underline underline-offset-4">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          {error && (
            <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full justify-between" size="lg">
            Send reset link
            <ArrowRight size={16} weight="bold" />
          </Button>
          <Link href="/login" className="inline-flex pt-1 text-[12px] text-ink-soft underline decoration-line-strong underline-offset-4">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
