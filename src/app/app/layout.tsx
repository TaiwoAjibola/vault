import { redirect } from "next/navigation";
import { AppShell } from "@/components/vault/app-shell";
import { VaultProvider } from "@/components/vault/vault-provider";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/app");

  const { data: vault, error } = await supabase
    .from("vaults")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load vault metadata.");
  }

  return (
    <VaultProvider user={user} initialVault={vault}>
      <AppShell user={user}>{children}</AppShell>
    </VaultProvider>
  );
}
