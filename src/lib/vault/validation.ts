import { z } from "zod";
import { normalizeWebsite, originsMatch } from "./origin";

export const credentialInputSchema = z.object({
  applicationName: z
    .string()
    .trim()
    .min(1, "Application name is required.")
    .max(120, "Keep the application name under 120 characters."),
  websiteUrl: z
    .string()
    .trim()
    .min(1, "Website URL is required.")
    .max(2048, "That URL is too long.")
    .superRefine((value, ctx) => {
      if (!normalizeWebsite(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid http(s) URL, for example https://example.com.",
        });
      }
    }),
  username: z
    .string()
    .trim()
    .min(1, "Username or email is required.")
    .max(320, "Keep the username under 320 characters."),
  password: z.string().min(1, "Password is required.").max(4096, "That password is too long."),
  notes: z.string().max(4000, "Keep notes under 4,000 characters.").default(""),
});

export type CredentialInput = z.infer<typeof credentialInputSchema>;

export const masterPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(1024, "That master password is too long.");

export const emailSchema = z.string().trim().email("Enter a valid email address.").max(320);

export function validateCredential(input: CredentialInput): Record<string, string> {
  const result = credentialInputSchema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function findDuplicate(
  credentials: { id: string; websiteUrl: string; username: string }[],
  websiteUrl: string,
  username: string,
  excludeId?: string,
) {
  const normalizedUser = username.trim().toLowerCase();
  return credentials.find(
    (credential) =>
      credential.id !== excludeId &&
      credential.username.trim().toLowerCase() === normalizedUser &&
      originsMatch(credential.websiteUrl, websiteUrl),
  );
}
