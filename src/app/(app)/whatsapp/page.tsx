import { requirePermission } from "@/lib/auth/session";
import { getConversas } from "@/lib/data/inbox";
import { InboxClient } from "@/components/whatsapp/inbox-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  try {
    const session = await requirePermission("whatsapp_inbox", "read");
    const conversas = await getConversas("todas");
    return (
      <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 h-[calc(100vh-62px)] overflow-hidden">
        <InboxClient conversasIniciais={conversas} perfilId={session.profile.id} />
      </div>
    );
  } catch {
    redirect("/acesso-negado");
  }
}
