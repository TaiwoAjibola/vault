import type { Metadata } from "next";
import { CredentialForm } from "@/components/vault/credential-form";
import { VaultGuard } from "@/components/vault/vault-guard";

export const metadata: Metadata = { title: "Add credential" };

export default function NewCredentialPage() {
  return (
    <VaultGuard>
      <CredentialForm mode="create" />
    </VaultGuard>
  );
}
