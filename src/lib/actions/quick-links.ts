"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";

export async function saveQuickLinksAction(hrefs: string[]): Promise<void> {
  const session = await requireSession();
  const links = hrefs.slice(0, 5);
  const supabase = await createServerClient();
  await supabase
    .from("perfis")
    .update({ quick_links: links })
    .eq("id", session.profile.id);
  revalidatePath("/");
}
