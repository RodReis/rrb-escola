import { Plus, Trash2, UserCheck } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAcademicData } from "@/lib/data/lookups";
import {
  listAtribuicoes,
  listDisciplinas,
  listProfessores,
} from "@/lib/data/pedagogico";
import {
  createAtribuicaoAction,
  deleteAtribuicaoAction,
} from "@/lib/actions/disciplinas";

export default async function AtribuicoesPage() {
  const [atribuicoes, disciplinas, professores, { turmas }] = await Promise.all([
    listAtribuicoes(),
    listDisciplinas(),
    listProfessores(),
    getAacademicDataSafe(),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Pedagógico" }, { label: "Atribuições" }]}
        title="Atribuições de Professor"
        counter={atribuicoes.length.toString()}
        description="Vincule professores a disciplinas e turmas. Define quem pode lançar notas."
      />

      <Panel className="grid gap-4">
        <h2 className="text-lg font-bold text-ink flex items-center gap-2">
          <Plus size={16} className="text-brand" />
          Nova atribuição
        </h2>
        {professores.length === 0 ? (
          <p className="rounded-ui bg-warning/10 p-3 text-sm text-warning">
            Não há perfis com tipo &quot;professor&quot;. Cadastre via{" "}
            <a href="/usuarios" className="underline font-semibold">Usuários</a> antes.
          </p>
        ) : (
          <form action={createAtribuicaoAction} className="grid gap-3 md:grid-cols-4">
            <label>
              Professor
              <select name="perfil_id" required>
                <option value="">Selecione...</option>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </label>
            <label>
              Disciplina
              <select name="disciplina_id" required>
                <option value="">Selecione...</option>
                {disciplinas.map((d) => (
                  <option key={d.id} value={d.id}>{d.serie} · {d.nome}</option>
                ))}
              </select>
            </label>
            <label>
              Turma
              <select name="turma_id" required>
                <option value="">Selecione...</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.series as { nome?: string } | undefined)?.nome ?? "—"} {t.nome} ({t.ano_letivo})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button className="ds-button ds-button-primary w-full">Vincular</button>
            </div>
          </form>
        )}
      </Panel>

      <Panel className="grid gap-3">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-brand" />
          <h3 className="font-bold text-ink">Atribuições atuais</h3>
          <span className="ml-auto text-xs text-ink/55">{atribuicoes.length} vínculos</span>
        </div>

        {atribuicoes.length === 0 ? (
          <p className="text-sm text-ink/60">Nenhuma atribuição cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
                  <th className="px-2 py-2 text-left">Professor</th>
                  <th className="px-2 py-2 text-left">Disciplina</th>
                  <th className="px-2 py-2 text-left">Série</th>
                  <th className="px-2 py-2 text-left">Turma</th>
                  <th className="px-2 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {atribuicoes.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="px-2 py-2 font-semibold text-ink">{a.professorNome}</td>
                    <td className="px-2 py-2">{a.disciplina}</td>
                    <td className="px-2 py-2 text-ink/70">{a.serie}</td>
                    <td className="px-2 py-2 text-ink/70">{a.turma}</td>
                    <td className="px-2 py-2 text-right">
                      <form action={deleteAtribuicaoAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="inline-flex items-center gap-1 rounded-ui bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20">
                          <Trash2 size={12} /> Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

async function getAacademicDataSafe() {
  return getAcademicData();
}
