import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { RematricularLoteStep1 } from "@/components/matriculas/rematricula-lote-step1";
import { RematricularLoteStep2 } from "@/components/matriculas/rematricula-lote-step2";
import { RematricularLoteStep3 } from "@/components/matriculas/rematricula-lote-step3";

export default async function RematricularLotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("matriculas", "create");
  const params = await searchParams;
  const step = params.step ?? "1";

  const ano = parseInt(params.ano ?? "", 10);
  const turma_id = params.turma_id ?? "";
  const serie_dest_id = params.serie_dest_id ?? "";

  // Guard: step 2 requires ano + turma_id
  if (step === "2" && (!ano || !turma_id)) {
    redirect("/matriculas/rematricula-lote?step=1");
  }

  // Guard: step 3 requires ano + turma_id + serie_dest_id; if only serie missing, go back to step 2
  if (step === "3" && (!ano || !turma_id)) {
    redirect("/matriculas/rematricula-lote?step=1");
  }
  if (step === "3" && !serie_dest_id) {
    redirect(`/matriculas/rematricula-lote?step=2&ano=${ano}&turma_id=${turma_id}`);
  }

  const stepLabel: Record<string, string> = {
    "1": "Turma e ano",
    "2": "Série destino",
    "3": "Confirmar alunos",
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico", href: "/" },
          { label: "Matrículas", href: "/matriculas" },
          { label: "Re-matrícula em lote" },
        ]}
        title="Re-matrícula em lote"
        description={`Passo ${step}: ${stepLabel[step] ?? ""}`}
      />

      {step === "1" && <RematricularLoteStep1 />}
      {step === "2" && <RematricularLoteStep2 ano={ano} turma_id={turma_id} />}
      {step === "3" && (
        <RematricularLoteStep3
          ano={ano}
          turma_id={turma_id}
          serie_dest_id={serie_dest_id}
        />
      )}
    </div>
  );
}
