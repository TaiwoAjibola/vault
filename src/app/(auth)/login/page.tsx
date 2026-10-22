import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

function SignInFallback() {
  return (
    <div className="space-y-4">
      <div className="h-[70px] animate-pulse rounded-xl bg-surface" />
      <div className="h-[70px] animate-pulse rounded-xl bg-surface" />
      <div className="h-12 animate-pulse rounded-full bg-surface" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Open your vault."
      subtitle="Sign in to your account. Your vault stays locked until you enter the master password on this device."
      footer={
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          New to Keyhold?{" "}
          <a href="/signup" className="font-medium text-forest underline underline-offset-4">
            Create your vault
          </a>
          . Account sign-in and vault unlock are two separate steps by design.
        </p>
      }
    >
      <Suspense fallback={<SignInFallback />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
