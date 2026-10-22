"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/vault/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { safeNextPath } from "@/lib/auth/next-path";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError(emailResult.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your account password.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailResult.data,
        password,
      });
      if (authError) {
        setError("Email or password is incorrect.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Could not reach the sign-in service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {params.get("error") === "callback" && (
        <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger">
          That sign-in link has expired. Request a new one and try again.
        </p>
      )}
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
      <Field label="Account password" htmlFor="password">
        <PasswordField
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="Your account password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </Field>
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={loading} className="w-full justify-between" size="lg">
        Sign in
        <ArrowRight size={16} weight="bold" />
      </Button>
      <div className="flex items-center justify-between pt-1 text-[12px]">
        <Link href="/forgot-password" className="text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink">
          Forgot account password?
        </Link>
        <Link href="/signup" className="font-medium text-forest hover:underline hover:underline-offset-4">
          Create an account
        </Link>
      </div>
    </form>
  );
}
