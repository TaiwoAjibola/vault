import type { Metadata } from "next";
import { CredentialDetail } from "@/components/vault/credential-detail";
import { VaultGuard } from "@/components/vault/vault-guard";

export const metadata: Metadata = { title: "Credential" };

export default async function CredentialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <VaultGuard>
      <CredentialDetail credentialId={id} />
    </VaultGuard>
  );
}
