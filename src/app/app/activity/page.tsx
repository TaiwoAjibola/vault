import type { Metadata } from "next";
import { ActivityFeed } from "@/components/vault/activity-feed";
import { VaultGuard } from "@/components/vault/vault-guard";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <VaultGuard>
      <ActivityFeed />
    </VaultGuard>
  );
}
