import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { updateEnrollmentStatusAction, createEnrollmentAction } from "@/lib/actions/academics";
import { getEnrollments } from "@/lib/data/enrollments";
import { getAcademicData } from "@/lib/data/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { Panel } from "@/components/ui/card";

const statuses = ["ativa", "cancelada", "transferida", "concluida"];

const statusTone = {
  ativa: "success",
  cancelada: "danger",
  transferida: "warning",
  concluida: "neutral"
} as const;

function dateText(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function MatriculasPage() {
  const [{ alunos, series, turmas, planos }, matriculas] = await Promise.all([getAcademicData(), getEnrollments()]);

  const ativas = matriculas.filter((m) => m.status === "ativa").length;
  const concluidas = matriculas.filter((m) => m.status === "concluida").length;
  const canceladas = matriculas.filter((m) => m.status === "cancelada").length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico", href: "/" }, { label: "Matrículas" }]}
        title="Matrículas"
        counter={matriculas.length.toLocaleString("pt-BR")}
        description="Vínculo do aluno com série, turma, plano financeiro e histórico acadêmico."
        kpis={[
          { label: "Total",      value: matriculas.length.toLocaleString("pt-BR") },
          { label: "Ativas",     value: ativas.toLocaleString("pt-BR"), tone: "success" },
          { label: "Concluídas", value: concluidas.toLocaleString("pt-BR") },
          { label: "Canceladas", value: canceladas.toLocaleString("pt-BR"), tone: "danger" }
        ]}
      />

      <Panel className="grid gap-5">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink/55">Nova matrícula</p>
          <h2 className="mt-1 text-xl font-bold text-ink">Cadastrar vínculo acadêmico</h2>
        </div>
        <form action={createEnrollmentAction} className="grid gap-4 md:grid-cols-4">
          <label>Aluno
            <select name="aluno_id" required>
              {alunos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>Série
            <select name="serie_id" required>
              {series.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>Turma
            <select name="turma_id" required>
              {turmas.map((item) => <option key={item.id} value={item.id}>{item.nome} — {item.ano_letivo}</option>)}
            </select>
          </label>
          <label>Plano
            <select name="plano_id">
              <option value="">Sem plano</option>
              {planos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>Código<input name="codigo" /></label>
          <label>Data<input name="data_matricula" type="date" /></label>
          <label>Ano letivo<input name="ano_letivo" type="number" defaultValue={new Date().getFullYear()} /></label>
          <label>Idade<input name="idade_na_matricula" type="number" /></label>
          <label className="md:col-span-3">Observações<input name="observacoes" /></label>
          <button className="ds-button ds-button-primary self-end">
            <Plus size={14} /> Matricular
          </button>
        </form>
      </Panel>

      <DataTableShell>
        <table className="ds-dt min-w-[1020px]">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Série</th>
              <th>Turma</th>
              <th>Plano</th>
              <th>Ano</th>
              <th>Data</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {matriculas.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-ink/50 py-10">Nenhuma matrícula cadastrada.</td></tr>
            ) : null}
            {matriculas.map((item) => {
              const tone = statusTone[item.status as keyof typeof statusTone] ?? "neutral";
              return (
                <tr key={item.id}>
                  <td>
                    <Link href={`/alunos/${item.aluno_id}`} className="flex flex-col leading-tight group">
                      <span className="font-semibold text-ink group-hover:text-brand">{item.alunos?.nome}</span>
                      <span className="text-xs text-ink/50">#{item.alunos?.matricula_codigo}</span>
                    </Link>
                  </td>
                  <td className="text-ink/80">{item.series?.nome ?? "—"}</td>
                  <td className="text-ink/80">{item.turmas?.nome ?? "—"}</td>
                  <td className="text-ink/80">{item.planos?.nome ?? "Sem plano"}</td>
                  <td className="text-ink/80">{item.ano_letivo}</td>
                  <td className="text-ink/80">{dateText(item.data_matricula)}</td>
                  <td>
                    <form action={updateEnrollmentStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="aluno_id" value={item.aluno_id} />
                      <StatusPill tone={tone}>{item.status}</StatusPill>
                      <select name="status" defaultValue={item.status} className="min-w-[120px]">
                        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button className="ds-button ds-button-secondary min-h-0 px-2.5 py-1.5 text-xs">Salvar</button>
                    </form>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <Link href={`/matriculas/${item.id}`} className="ds-button ds-button-secondary min-h-0 px-2.5 py-1.5 text-xs">
                        <Eye size={12} /> Histórico
                      </Link>
                      <Link href={`/alunos/${item.aluno_id}`} className="ds-button ds-button-secondary min-h-0 px-2.5 py-1.5 text-xs">
                        Ficha
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
