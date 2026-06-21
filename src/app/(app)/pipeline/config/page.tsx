import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { QuadrosConfigClient } from "@/components/pipeline/config/quadros-config-client";
import { TemplatesConfigClient } from "@/components/pipeline/config/templates-config-client";
import { getTemplatesWhatsappAdmin } from "@/lib/actions/pipeline";

export default async function PipelineConfigPage() {
  const session = await requirePermission("pipeline_admin", "read");
  const escola_id = session.profile.escola_id;

  const supabase = await createServerClient();
  const [{ data: quadros }, templatesResult] = await Promise.all([
    supabase
      .from("pipeline_quadro")
      .select("id, nome, tipo, ordem, ativo, descricao")
      .eq("escola_id", escola_id)
      .order("ordem"),
    getTemplatesWhatsappAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[rgb(var(--color-ink))]">
          Configuração do Pipeline
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-ink)/0.55)]">
          Gerencie quadros, colunas e templates WhatsApp.
        </p>
      </div>
      <QuadrosConfigClient quadros={quadros ?? []} />
      <hr style={{ borderColor: "rgb(var(--color-line))" }} />
      <TemplatesConfigClient templates={templatesResult.ok ? templatesResult.data : []} />
    </div>
  );
}
