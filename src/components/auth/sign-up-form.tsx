"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, EnvelopeSimple } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/vault/validation";
import { scorePassword } from "@/lib/vault/strength";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [awaitingEmail, setAwaitingEmail] = React.useState(false);

  const strength = scorePassword(password);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError(emailResult.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your account password.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: emailResult.data,
        password,
        options: {
          data: { display_name: name.trim() || undefined },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
        },
      });
      if (authError) {
        setError(
          authError.message.toLowerCase().includes("already")
            ? "An account with that email already exists. Sign in instead."
            : "Could not create the account. Try again.",
        );
        return;
      }
      if (!data.session) {
        setAwaitingEmail(true);
        return;
      }
      router.replace("/app/setup");
      router.refresh();
    } catch {
      setError("Could not reach the sign-up service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (awaitingEmail) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <span className="grid size-10 place-items-center rounded-full bg-sage text-forest">
          <EnvelopeSimple size={18} />
        </span>
        <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-ink">
          Check your inbox
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          We sent a confirmation link to <span className="font-medium text-ink">{email}</span>.
          Follow it to finish creating your account, then set up your vault.
        </p>
        <Link href="/login" className="mt-5 inline-flex text-[12.5px] font-medium text-forest underline underline-offset-4">
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Name" htmlFor="name" optional>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Taiwo"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
        />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </Field>
      <Field
        label="Account password"
        htmlFor="password"
        hint="This signs you in. Your separate vault master password comes next."
      >
        <PasswordField
          id="password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
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
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={loading} className="w-full justify-between" size="lg">
        Create account
        <ArrowRight size={16} weight="bold" />
      </Button>
      <p className="text-[11px] leading-relaxed text-ink-faint">
        By creating an account you agree to keep your recovery key safe. Keyhold cannot reset a
        lost vault master password.
      </p>
      <div className="pt-1 text-[12px] text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-forest hover:underline hover:underline-offset-4">
          Sign in
        </Link>
      </div>
    </form>
  );
}
