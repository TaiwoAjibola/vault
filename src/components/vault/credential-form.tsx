"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Key,
  LockKey,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useVault, DuplicateCredentialError } from "@/components/vault/vault-provider";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { Badge } from "@/components/ui/badge";
import type { DecryptedCredential } from "@/lib/vault/types";
import { normalizeWebsite, displayHost } from "@/lib/vault/origin";
import { formatDate } from "@/lib/vault/format";
import { scorePassword } from "@/lib/vault/strength";
import { generatePassword } from "@/lib/vault/generate";
import { copyText, scheduleClipboardClear } from "@/lib/vault/clipboard";
import { validateCredential, type CredentialInput } from "@/lib/vault/validation";

const EMPTY: CredentialInput = {
  applicationName: "",
  websiteUrl: "",
  username: "",
  password: "",
  notes: "",
};

export function CredentialForm({
  mode,
  credential,
}: {
  mode: "create" | "edit";
  credential?: DecryptedCredential;
}) {
  const router = useRouter();
  const { createCredential, updateCredential, busy, credentials } = useVault();
  const [form, setForm] = React.useState<CredentialInput>(
    credential
      ? {
          applicationName: credential.applicationName,
          websiteUrl: credential.websiteUrl,
          username: credential.username,
          password: credential.password,
          notes: credential.notes,
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [duplicateId, setDuplicateId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function update<K extends keyof CredentialInput>(key: K, value: CredentialInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSubmitError(null);
    setDuplicateId(null);
  }

  function normalizeUrl() {
    const url = normalizeWebsite(form.websiteUrl);
    if (url && url.origin !== form.websiteUrl) {
      setForm((current) => ({ ...current, websiteUrl: url.origin }));
    }
  }

  function handleGenerate() {
    const value = generatePassword(20);
    update("password", value);
    toast.success("Strong password generated. Reveal it to review, then save.");
  }

  async function handleCopyGenerated() {
    if (!form.password) return;
    try {
      await copyText(form.password);
      scheduleClipboardClear();
      toast.success("Password copied. Clipboard clears in 45 seconds.");
    } catch {
      toast.error("Could not copy the password.");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setDuplicateId(null);
    const nextErrors = validateCredential(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const url = normalizeWebsite(form.websiteUrl);
    if (!url) {
      setErrors({ websiteUrl: "Enter a valid http(s) URL." });
      return;
    }
    const payload: CredentialInput = {
      ...form,
      applicationName: form.applicationName.trim(),
      websiteUrl: url.origin,
      username: form.username.trim(),
      notes: form.notes.trim(),
    };

    setSubmitting(true);
    try {
      if (mode === "create") {
        const created = await createCredential(payload);
        toast.success("Credential saved and encrypted.");
        router.push(`/app/credentials/${created.id}`);
      } else if (credential) {
        await updateCredential(credential.id, payload);
        toast.success("Credential updated.");
        router.push(`/app/credentials/${credential.id}`);
      }
      router.refresh();
    } catch (error) {
      if (error instanceof DuplicateCredentialError) {
        setDuplicateId(error.existingId);
        setSubmitError("A credential for this website and username already exists.");
      } else {
        setSubmitError(error instanceof Error ? error.message : "Could not save the credential.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const strength = scorePassword(form.password);
  const existing = duplicateId ? credentials.find((item) => item.id === duplicateId) : undefined;
  const working = submitting || busy;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Link
          href={credential ? `/app/credentials/${credential.id}` : "/app"}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft size={12} />
          {credential ? "Back to credential" : "Back to vault"}
        </Link>
        <Badge tone="neutral">
          {mode === "create" ? "New record" : "Editing record"}
        </Badge>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {mode === "create" ? "Add credential" : "Edit credential"}
          </p>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.02] tracking-[-0.05em] text-ink sm:text-[38px]">
            {mode === "create" ? "Seal a new login." : "Update this login."}
          </h1>
          <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-ink-soft">
            All five fields are encrypted together in this browser. The server only receives the
            sealed payload and timestamps.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-sage/60 text-forest">
                  <LockKey size={13} />
                </span>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                  Application
                </p>
              </div>
              <div className="mt-4 space-y-4">
                <Field label="Application name" htmlFor="application-name">
                  <Input
                    id="application-name"
                    value={form.applicationName}
                    onChange={(event) => update("applicationName", event.target.value)}
                    placeholder="e.g. Linear, Figma, HDFC Bank"
                    autoComplete="off"
                    invalid={Boolean(errors.applicationName)}
                    maxLength={120}
                  />
                  {errors.applicationName && (
                    <p className="text-xs text-danger" role="alert">{errors.applicationName}</p>
                  )}
                </Field>
                <Field
                  label="Website URL"
                  htmlFor="website-url"
                  hint="Stored as a site origin so the extension matches the right domain."
                >
                  <Input
                    id="website-url"
                    value={form.websiteUrl}
                    onChange={(event) => update("websiteUrl", event.target.value)}
                    onBlur={normalizeUrl}
                    placeholder="https://example.com"
                    autoComplete="url"
                    inputMode="url"
                    invalid={Boolean(errors.websiteUrl)}
                    maxLength={2048}
                  />
                  {errors.websiteUrl && (
                    <p className="text-xs text-danger" role="alert">{errors.websiteUrl}</p>
                  )}
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-sage/60 text-forest">
                  <Key size={13} />
                </span>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                  Sign-in details
                </p>
              </div>
              <div className="mt-4 space-y-4">
                <Field label="Username or email" htmlFor="username">
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(event) => update("username", event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="off"
                    spellCheck={false}
                    invalid={Boolean(errors.username)}
                    maxLength={320}
                  />
                  {errors.username && (
                    <p className="text-xs text-danger" role="alert">{errors.username}</p>
                  )}
                </Field>
                <Field label="Password" htmlFor="credential-password">
                  <PasswordField
                    id="credential-password"
                    value={form.password}
                    onChange={(event) => update("password", event.target.value)}
                    placeholder="The password for this site"
                    autoComplete="new-password"
                    invalid={Boolean(errors.password)}
                    maxLength={4096}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleGenerate}>
                      <Sparkle size={13} />
                      Generate strong
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyGenerated}
                      disabled={!form.password}
                    >
                      <Copy size={13} />
                      Copy
                    </Button>
                    {form.password && (
                      <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                        <span className="h-1 w-14 overflow-hidden rounded-full bg-line">
                          <span
                            className="block h-full rounded-full bg-forest"
                            style={{ width: `${Math.max(strength.scorePercent, 8)}%` }}
                          />
                        </span>
                        {strength.label}
                      </span>
                    )}
                  </div>
                  {errors.password && (
                    <p className="text-xs text-danger" role="alert">{errors.password}</p>
                  )}
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <Field
                label="Notes"
                htmlFor="notes"
                optional
                hint="Security questions, recovery hints, account IDs. Also encrypted."
              >
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder="Anything you want to remember about this login."
                  maxLength={4000}
                />
              </Field>
            </div>

            {submitError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3">
                <WarningCircle size={16} className="mt-0.5 shrink-0 text-danger" />
                <div className="text-[12px] leading-relaxed text-danger">
                  <p>{submitError}</p>
                  {existing && (
                    <Link
                      href={`/app/credentials/${existing.id}`}
                      className="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2"
                    >
                      Open existing credential
                      <ArrowRight size={11} />
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={working} size="lg">
                {mode === "create" ? "Save credential" : "Save changes"}
                <ArrowRight size={15} weight="bold" />
              </Button>
              <Link
                href={credential ? `/app/credentials/${credential.id}` : "/app"}
                className={buttonClass({ variant: "ghost", size: "lg" })}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        <aside className="space-y-4 lg:pt-12">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              What gets encrypted
            </p>
            <ul className="mt-3.5 space-y-2.5 text-[12px] text-ink-soft">
              {["Application name", "Website URL", "Username or email", "Password", "Notes"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-forest/50" />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <div className="mt-4 border-t border-line pt-3.5 font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.1em] text-ink-faint">
              AES-256-GCM
              <br />
              AAD bound to user + record
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-paper/60 p-5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
              {mode === "edit" && credential ? "Record history" : "Before you save"}
            </p>
            {mode === "edit" && credential ? (
              <dl className="mt-3.5 space-y-2.5 text-[11.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-faint">Created</dt>
                  <dd className="text-right text-ink-soft">{formatDate(credential.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-faint">Updated</dt>
                  <dd className="text-right text-ink-soft">{formatDate(credential.updatedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-faint">Last retrieved</dt>
                  <dd className="text-right text-ink-soft">
                    {credential.lastRetrievedAt ? formatDate(credential.lastRetrievedAt) : "Never"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-2.5">
                  <dt className="text-ink-faint">Site</dt>
                  <dd className="font-mono text-[10px] text-ink-soft">
                    {displayHost(credential.websiteUrl)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-soft">
                Use the site origin (for example <span className="font-mono">https://linear.app</span>).
                Paths and query strings are dropped so the extension can match the exact domain.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-warning/20 bg-warning-soft p-4">
            <p className="text-[11px] leading-relaxed text-warning">
              Saving records a <span className="font-medium">created</span> or{" "}
              <span className="font-medium">updated</span> event. Revealing or copying later records a{" "}
              <span className="font-medium">retrieved</span> event. No secret values appear in audit
              events.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function EditCredentialScreen({ credentialId }: { credentialId: string }) {
  const { credentials } = useVault();
  const credential = credentials.find((item) => item.id === credentialId);
  if (!credential) {
    return (
      <div className="mx-auto max-w-[560px] rounded-2xl border border-line bg-surface p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-sage/60 text-forest">
          <Key size={22} />
        </span>
        <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-ink">
          Credential not found
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          It may have been deleted on another device. Refresh the vault or return to the dashboard.
        </p>
        <Link href="/app" className={buttonClass({ variant: "dark", size: "md", className: "mt-5" })}>
          Back to vault
        </Link>
      </div>
    );
  }
  return <CredentialForm mode="edit" credential={credential} />;
}
