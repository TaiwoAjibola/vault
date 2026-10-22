import type { Metadata } from "next";
import { EditCredentialScreen } from "@/components/vault/credential-form";
import { VaultGuard } from "@/components/vault/vault-guard";

export const metadata: Metadata = { title: "Edit credential" };

export default async function EditCredentialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <VaultGuard>
      <EditCredentialScreen credentialId={id} />
    </VaultGuard>
  );
}
