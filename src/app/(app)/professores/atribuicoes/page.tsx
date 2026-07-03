import { Layers, Trash2, UserCheck, AlertCircle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PageHeader } from "@/components/ui/page-header";
import { getAcademicData } from "@/lib/data/lookups";
import {
  listAtribuicoes,
  listDisciplinas,
  listProfessores,
} from "@/lib/data/pedagogico";
import { deleteAtribuicaoAction } from "@/lib/actions/disciplinas";
import { requirePermission } from "@/lib/auth/session";
import { AtribuicaoLoteForm } from "@/components/professores/atribuicao-lote-form";

export default async function AtribuicoesPage() {
  await requirePermission("professores", "read");
  const [atribuicoes, disciplinas, professores, { turmas: turmasAll }] = await Promise.all([
    listAtribuicoes(),
    listDisciplinas(),
    listProfessores(),
    getAacademicDataSafe(),
  ]);
  const anoAtual = new Date().getFullYear();
  const turmas = turmasAll.filter((t: { ano_letivo: number }) => t.ano_letivo === anoAtual);

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
          <Layers size={16} className="text-brand" />
          Vincular em lote
        </h2>
        {professores.length === 0 ? (
          <div className="flex items-start gap-2 rounded-ui bg-warning/10 p-3 text-sm text-warning">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>
              Não há perfis com tipo &quot;professor&quot;. Cadastre via{" "}
              <a href="/usuarios" className="underline font-semibold">Usuários</a> antes.
            </span>
          </div>
        ) : (
          <AtribuicaoLoteForm
            professores={professores}
            disciplinas={disciplinas}
            turmas={turmas}
          />
        )}
      </Panel>

      <Panel className="grid gap-3">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-brand" />
          <h3 className="font-bold text-ink">Atribuições atuais</h3>
          <span className="ml-auto text-xs text-ink/60">{atribuicoes.length} vínculos</span>
        </div>

        {atribuicoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
            <UserCheck size={28} />
            <p className="text-sm font-medium">Nenhuma atribuição cadastrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/60">
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
                        <ConfirmButton
                          message={`Tem certeza que quer remover a atribuição de ${a.professorNome} em ${a.disciplina}?`}
                          className="inline-flex items-center gap-1 rounded-ui bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20"
                        >
                          <Trash2 size={12} /> Remover
                        </ConfirmButton>
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
