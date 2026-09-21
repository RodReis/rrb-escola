import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { EditarRubricaForm } from "@/components/rh/folha-v2/editar-rubrica-form";

export const dynamic = "force-dynamic";

type RubricaRow = {
  id: string; codigo: string; nome: string; tipo: string;
  metodo_calculo: string; incide_inss: boolean; incide_irrf: boolean;
  incide_fgts: boolean; incide_dsr: boolean; ordem_holerite: number; ativa: boolean;
};

export default async function EditarRubricaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("rh.folha-v2", "update");
  const { id } = await params;

  const supabase = await createServerClient();
  const { data } = await supabase.from("folha_rubricas").select("*").eq("id", id).single();
  if (!data) notFound();
  const r = data as unknown as RubricaRow;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Rubricas", href: "/rh/folha-v2/rubricas" },
          { label: r.codigo },
        ]}
        title={`Editar — ${r.codigo}`}
        description={r.nome}
      />

      <EditarRubricaForm r={r} />
    </div>
  );
}
