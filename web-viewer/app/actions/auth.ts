"use server";
/**
 * auth.ts — Authentication actions.
 * Currently only sign-out; future: account deletion, password reset.
 */
import { createServerClient } from "@/lib/supabase";

export async function signOut(): Promise<void> {
  const { redirect } = await import("next/navigation");
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
