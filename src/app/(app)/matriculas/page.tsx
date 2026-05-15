import Link from "next/link";
import { Eye, FileText, Plus, UserRound } from "lucide-react";
import { updateEnrollmentStatusAction, createEnrollmentAction } from "@/lib/actions/academics";
import { getEnrollments } from "@/lib/data/enrollments";
import { getAcademicData } from "@/lib/data/lookups";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";

const statuses = ["ativa", "cancelada", "transferida", "concluida"];

const statusTone = {
  ativa: "green",
  cancelada: "red",
  transferida: "gold",
  concluida: "gray"
} as const;

function dateText(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function MatriculasPage() {
  const [{ alunos, series, turmas, planos }, matriculas] = await Promise.all([getAcademicData(), getEnrollments()]);

  const summary = [
    ["Total", String(matriculas.length)],
    ["Ativas", String(matriculas.filter((item) => item.status === "ativa").length)],
    ["Concluidas", String(matriculas.filter((item) => item.status === "concluida").length)],
    ["Canceladas", String(matriculas.filter((item) => item.status === "cancelada").length)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Academico</span>
              <span className="text-line">/</span>
              <span className="text-brand">Matriculas</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Matriculas <span className="font-serif italic text-ink/42">{matriculas.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Controle de vinculo do aluno com serie, turma, plano financeiro e historico academico.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ButtonLink href="/alunos/novo" variant="secondary">
                <UserRound size={16} /> Novo aluno
              </ButtonLink>
              <ButtonLink href="/series" variant="secondary">
                <FileText size={16} /> Series
              </ButtonLink>
              <ButtonLink href="/turmas" variant="accent" className="shadow-[0_12px_26px_rgba(255,36,36,0.22)]">
                <Plus size={16} /> Nova turma
              </ButtonLink>
            </div>

            <dl className="grid gap-0 sm:grid-cols-4">
              {summary.map(([label, value]) => (
                <div key={label} className="border-line py-1 sm:border-l sm:px-6 first:sm:border-l-0">
                  <dt className="text-xs font-medium text-ink/62">{label}</dt>
                  <dd className="mt-1 font-serif text-2xl italic leading-none text-brand">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <Panel className="grid gap-5">
        <div>
          <p className="ds-kicker">Nova matricula</p>
          <h2 className="mt-2 text-xl font-black text-ink">Cadastrar vinculo academico</h2>
        </div>
        <form action={createEnrollmentAction} className="grid gap-4 md:grid-cols-4">
          <label>
            Aluno
            <select name="aluno_id" required>
              {alunos.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Serie
            <select name="serie_id" required>
              {series.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Turma
            <select name="turma_id" required>
              {turmas.map((item) => (
                <option key={item.id} value={item.id}>{item.nome} - {item.ano_letivo}</option>
              ))}
            </select>
          </label>
          <label>
            Plano
            <select name="plano_id">
              <option value="">Sem plano</option>
              {planos.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Codigo
            <input name="codigo" />
          </label>
          <label>
            Data
            <input name="data_matricula" type="date" />
          </label>
          <label>
            Ano letivo
            <input name="ano_letivo" type="number" defaultValue={new Date().getFullYear()} />
          </label>
          <label>
            Idade
            <input name="idade_na_matricula" type="number" />
          </label>
          <label className="md:col-span-3">
            Observacoes
            <input name="observacoes" />
          </label>
          <button className="ds-button ds-button-accent self-end">
            <Plus size={16} /> Matricular
          </button>
        </form>
      </Panel>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-ink">Historico de matriculas</h2>
            <p className="text-sm text-ink/60">Acompanhamento de status, turma e acesso a ficha do aluno.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead className="bg-muted text-xs font-black uppercase tracking-[0.1em] text-ink/62">
              <tr>
                <th className="px-5 py-3">Aluno</th>
                <th className="px-5 py-3">Serie</th>
                <th className="px-5 py-3">Turma</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">Ano</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {matriculas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm font-medium text-ink/60">
                    Nenhuma matricula cadastrada.
                  </td>
                </tr>
              ) : null}
              {matriculas.map((item) => {
                const tone = statusTone[item.status as keyof typeof statusTone] ?? "gray";

                return (
                  <tr key={item.id} className="border-t border-line transition hover:bg-muted/60">
                    <td className="px-5 py-4">
                      <Link href={`/alunos/${item.aluno_id}`} className="font-black text-ink hover:text-brand">
                        {item.alunos?.nome}
                      </Link>
                      <span className="block text-xs font-medium text-ink/55">{item.alunos?.matricula_codigo}</span>
                    </td>
                    <td className="px-5 py-4 text-ink/70">{item.series?.nome ?? "-"}</td>
                    <td className="px-5 py-4 text-ink/70">{item.turmas?.nome ?? "-"}</td>
                    <td className="px-5 py-4 text-ink/70">{item.planos?.nome ?? "Sem plano"}</td>
                    <td className="px-5 py-4 text-ink/70">{item.ano_letivo}</td>
                    <td className="px-5 py-4 text-ink/70">{dateText(item.data_matricula)}</td>
                    <td className="px-5 py-4">
                      <form action={updateEnrollmentStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="aluno_id" value={item.aluno_id} />
                        <Badge tone={tone}>{item.status}</Badge>
                        <select name="status" defaultValue={item.status} className="min-w-[132px]">
                          {statuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button className="ds-button ds-button-secondary min-h-0 px-3 py-2 text-xs">Salvar</button>
                      </form>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link href={`/matriculas/${item.id}`} className="ds-button ds-button-secondary min-h-0 px-3 py-2 text-xs">
                          <Eye size={14} /> Historico
                        </Link>
                        <Link href={`/alunos/${item.aluno_id}`} className="ds-button ds-button-secondary min-h-0 px-3 py-2 text-xs">
                          Ficha
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
