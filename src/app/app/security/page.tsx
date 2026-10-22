import type { Metadata } from "next";
import { SecuritySettings } from "@/components/vault/security-settings";
import { VaultGuard } from "@/components/vault/vault-guard";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <VaultGuard>
      <SecuritySettings />
    </VaultGuard>
  );
}
