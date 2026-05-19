import { Topbar } from "@/components/layout/topbar";
import { requireSession } from "@/lib/auth/session";
import { runDailyNotifications } from "@/lib/server/notify-daily";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  // Fire-and-forget: gera notificacoes diarias on-demand (idempotente).
  // Nao bloqueia render. Erros sao silenciosos para nao quebrar a UI.
  runDailyNotifications(session.profile.escola_id).catch(() => {});

  const supabase = await createServerClient();
  const { data: anosData } = await supabase
    .from("turmas")
    .select("ano_letivo")
    .eq("escola_id", session.profile.escola_id)
    .order("ano_letivo", { ascending: false });

  const anosLetivos: number[] = Array.from(
    new Set((anosData ?? []).map((r) => r.ano_letivo))
  );
  if (!anosLetivos.includes(new Date().getFullYear())) {
    anosLetivos.push(new Date().getFullYear());
    anosLetivos.sort((a, b) => b - a);
  }

  return (
    <div className="ds-shell">
      <Topbar perfil={session.profile} anosLetivos={anosLetivos} permissions={session.permissions} />
      <main>
        <div className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
