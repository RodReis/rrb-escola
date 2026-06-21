import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { QuadrosConfigClient } from "@/components/pipeline/config/quadros-config-client";
import { TemplatesConfigClient } from "@/components/pipeline/config/templates-config-client";
import { AutomacoesConfigClient } from "@/components/pipeline/config/automacoes-config-client";
import { getTemplatesWhatsappAdmin, getAutomacoesAdmin } from "@/lib/actions/pipeline";

export default async function PipelineConfigPage() {
  const session = await requirePermission("pipeline_admin", "read");
  const escola_id = session.profile.escola_id;

  const supabase = await createServerClient();
  const [{ data: quadros }, { data: colunas }, { data: perfis }, templatesResult, automacoesResult] = await Promise.all([
    supabase
      .from("pipeline_quadro")
      .select("id, nome, tipo, ordem, ativo, descricao")
      .eq("escola_id", escola_id)
      .order("ordem"),
    supabase
      .from("pipeline_coluna")
      .select("id, nome, quadro_id")
      .eq("escola_id", escola_id)
      .eq("ativo", true)
      .order("ordem"),
    supabase
      .from("perfis")
      .select("id, nome")
      .eq("escola_id", escola_id)
      .eq("ativo", true)
      .order("nome"),
    getTemplatesWhatsappAdmin(),
    getAutomacoesAdmin(),
  ]);

  const templates = templatesResult.ok ? templatesResult.data : [];
  const templateOptions = templates
    .filter((t) => t.ativo)
    .map((t) => ({ id: t.id, descricao: t.descricao }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[rgb(var(--color-ink))]">
          Configuração do Pipeline
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-ink)/0.55)]">
          Gerencie quadros, colunas, templates WhatsApp e automações.
        </p>
      </div>
      <QuadrosConfigClient quadros={quadros ?? []} />
      <hr style={{ borderColor: "rgb(var(--color-line))" }} />
      <TemplatesConfigClient templates={templates} />
      <hr style={{ borderColor: "rgb(var(--color-line))" }} />
      <AutomacoesConfigClient
        automacoes={automacoesResult.ok ? automacoesResult.data : []}
        quadros={(quadros ?? []).filter((q) => q.ativo).map((q) => ({ id: q.id, nome: q.nome }))}
        colunas={(colunas ?? []).map((c) => ({ id: c.id, nome: c.nome, quadro_id: c.quadro_id as string }))}
        templates={templateOptions}
        perfis={(perfis ?? []).map((p) => ({ id: p.id, nome: p.nome as string }))}
      />
    </div>
  );
}
