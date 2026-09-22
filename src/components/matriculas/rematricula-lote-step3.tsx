import { Avatar } from "@/components/ui/avatar";
import { Panel } from "@/components/ui/card";
import { rematricularLoteAction } from "@/lib/actions/academics";
import { listAlunosCandidatosLote } from "@/lib/data/enrollments";
import { getSignedFotoUrls } from "@/lib/storage/photos";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  ano: number;
  turma_id: string;
  serie_dest_id: string;
  turma_dest_id: string;
  plano_dest_id: string;
};

export async function RematricularLoteStep3({ ano, turma_id, serie_dest_id, turma_dest_id, plano_dest_id }: Props) {
  const candidatos = await listAlunosCandidatosLote(turma_id, ano);
  const fotos = await getSignedFotoUrls(candidatos.map((c) => c.foto_url));

  if (candidatos.length === 0) {
    return (
      <Panel className="grid gap-4">
        <p className="ds-kicker">Passo 3 de 3</p>
        <p className="text-sm text-muted">
          Nenhum aluno elegível nesta turma para re-matrícula. Todos já possuem
          matrícula ativa em {ano + 1} ou a turma não tem alunos ativos.
        </p>
        <a
          href="/matriculas/rematricula-lote?step=1"
          className="ds-button ds-button-secondary justify-self-start"
        >
          ← Recomeçar
        </a>
      </Panel>
    );
  }

  return (
    <Panel className="grid gap-6">
      <div>
        <p className="ds-kicker">Passo 3 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Confirme os alunos</h2>
        <p className="mt-1 text-sm text-muted">
          {candidatos.length} aluno{candidatos.length !== 1 ? "s" : ""} elegível
          {candidatos.length !== 1 ? "s" : ""}. Desmarque os que não devem ser re-matriculados.
        </p>
      </div>

      <form action={rematricularLoteAction} className="grid gap-4">
        <input type="hidden" name="ano_letivo" value={ano} />
        <input type="hidden" name="turma_id" value={turma_id} />
        <input type="hidden" name="serie_dest_id" value={serie_dest_id} />
        <input type="hidden" name="turma_dest_id" value={turma_dest_id} />
        <input type="hidden" name="plano_dest_id" value={plano_dest_id} />

        {/* gap + ring nos itens desenha as divisórias sem sobrar borda em linha incompleta */}
        <div className="grid gap-px overflow-hidden rounded-ui bg-line ring-1 ring-line sm:grid-cols-2 xl:grid-cols-3">
          {candidatos.map((aluno) => (
            <label
              key={aluno.matricula_id}
              className="flex cursor-pointer items-center gap-3 bg-surface px-3 py-2 hover:bg-muted"
            >
              <input
                type="checkbox"
                name="matricula_ids"
                value={aluno.matricula_id}
                defaultChecked
                className="h-4 w-4 shrink-0 accent-brand"
              />
              <Avatar name={aluno.nome} src={fotos.get(aluno.foto_url ?? "") ?? null} size={28} />
              <span className="min-w-0 truncate text-sm font-medium text-ink" title={aluno.nome}>
                {aluno.nome}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <a
            href={`/matriculas/rematricula-lote?step=2&ano=${ano}&turma_id=${turma_id}`}
            className="ds-button ds-button-secondary"
          >
            ← Voltar
          </a>
          <SubmitButton>
            Re-matricular {candidatos.length} aluno{candidatos.length !== 1 ? "s" : ""}
          </SubmitButton>
        </div>
      </form>
    </Panel>
  );
}
