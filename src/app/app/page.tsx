import type { Metadata } from "next";
import { VaultDashboard } from "@/components/vault/vault-dashboard";
import { VaultGuard } from "@/components/vault/vault-guard";

export const metadata: Metadata = { title: "Vault" };

export default function VaultPage() {
  return (
    <VaultGuard>
      <VaultDashboard />
    </VaultGuard>
  );
}
