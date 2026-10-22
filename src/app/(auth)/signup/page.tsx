import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create your vault" };

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Start here"
      title="Create your account."
      subtitle="Set up sign-in first. Next you will create the vault master password that encrypts your credentials."
      footer={
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          Two passwords, two jobs: the account password authenticates you with the server. The vault
          master password decrypts your data locally and is never sent anywhere.
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
