import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { ColunasConfigClient } from "@/components/pipeline/config/colunas-config-client";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ quadro_id: string }> };

export default async function ColunasConfigPage({ params }: Props) {
  const { quadro_id } = await params;
  const session = await requirePermission("pipeline_admin", "read");
  const escola_id = session.profile.escola_id;

  const supabase = await createServerClient();

  const [quadroRes, colunasRes] = await Promise.all([
    supabase
      .from("pipeline_quadro")
      .select("id, nome")
      .eq("id", quadro_id)
      .eq("escola_id", escola_id)
      .single(),
    supabase
      .from("pipeline_coluna")
      .select("id, nome, cor, ordem, etapa_final, prazo_max_dias")
      .eq("quadro_id", quadro_id)
      .eq("escola_id", escola_id)
      .order("ordem"),
  ]);

  if (quadroRes.error || !quadroRes.data) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <a
          href="/pipeline/config"
          className="text-xs text-[rgb(var(--color-brand))] hover:underline"
        >
          ← Quadros
        </a>
        <h1 className="mt-2 text-xl font-semibold text-[rgb(var(--color-ink))]">
          {quadroRes.data.nome}
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-ink)/0.55)]">
          Colunas do quadro — arraste para reordenar.
        </p>
      </div>
      <ColunasConfigClient
        quadroId={quadro_id}
        colunas={colunasRes.data ?? []}
      />
    </div>
  );
}
