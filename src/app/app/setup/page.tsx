import type { Metadata } from "next";
import { SetupScreen } from "@/components/vault/setup-screen";

export const metadata: Metadata = { title: "Set up your vault" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  return <SetupScreen />;
}
