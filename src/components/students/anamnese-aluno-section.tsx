import { getAnamnesePorAluno } from "@/lib/actions/pipeline-anamnese";
import { AnamneseReadOnly } from "./anamnese-readonly";
import { AnamneseExportButton } from "./anamnese-export-button";

// Seção read-only da anamnese na ficha do aluno efetivado.
// Trava: sem permissão pipeline_sensivel → não renderiza nada.
export async function AnamneseAlunoSection({ alunoId }: { alunoId: string }) {
  const res = await getAnamnesePorAluno(alunoId);

  // Sem permissão (secretaria): a seção desaparece por completo.
  if (!res.ok) return null;

  const anamnese = res.data.anamnese;

  return (
    <section className="rounded-2xl border border-line bg-paper px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="ds-kicker">Anamnese</p>
          <h2 className="mt-1 font-display text-2xl text-ink">Ficha de anamnese</h2>
        </div>
        {anamnese ? <AnamneseExportButton alunoId={alunoId} /> : null}
      </div>

      {anamnese ? (
        <div className="mt-5 text-sm">
          <AnamneseReadOnly anamnese={anamnese} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Nenhuma anamnese registrada para este aluno.</p>
      )}
    </section>
  );
}
