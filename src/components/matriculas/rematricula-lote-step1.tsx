import { Panel } from "@/components/ui/card";
import { getAcademicData } from "@/lib/data/lookups";

export async function RematricularLoteStep1() {
  const { turmas } = await getAcademicData();
  const currentYear = new Date().getFullYear();

  // Collect distinct years from turmas
  const anos = Array.from(new Set(turmas.map((t) => Number(t.ano_letivo)))).sort((a, b) => b - a);

  return (
    <Panel className="grid gap-6 max-w-lg">
      <div>
        <p className="ds-kicker">Passo 1 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Selecione turma e ano letivo</h2>
        <p className="mt-1 text-sm text-ink/60">
          Serão listados apenas alunos com matrícula ativa na turma selecionada
          que ainda não foram re-matriculados para o próximo ano.
        </p>
      </div>

      <form method="GET" className="grid gap-4">
        <input type="hidden" name="step" value="2" />

        <label>
          Ano letivo origem
          <select name="ano" required defaultValue={currentYear}>
            {anos.map((ano) => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </label>

        <label>
          Turma
          <select name="turma_id" required>
            <option value="">Selecione…</option>
            {turmas
              .filter((t) => t.ativo)
              .sort((a, b) => Number(b.ano_letivo) - Number(a.ano_letivo))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ano_letivo} — {(t.series as { nome: string } | null)?.nome} — {t.nome}
                </option>
              ))}
          </select>
        </label>

        <button type="submit" className="ds-button ds-button-primary justify-self-start">
          Próximo →
        </button>
      </form>
    </Panel>
  );
}
