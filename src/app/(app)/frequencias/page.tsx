import { CalendarCheck, Plus, ClipboardList } from "lucide-react";
import { createAttendanceAction } from "@/lib/actions/attendance";
import { getAttendanceData } from "@/lib/data/attendance";
import { getAcademicData } from "@/lib/data/lookups";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";

function dateText(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function FrequenciasPage() {
  await requirePermission("frequencias", "read");
  const [{ alunos }, frequencias] = await Promise.all([getAcademicData(), getAttendanceData()]);

  const presencas = frequencias.filter((item) => item.presente).length;
  const faltas = frequencias.length - presencas;
  const percentual = frequencias.length ? Math.round((presencas / frequencias.length) * 100) : 0;
  const summary = [
    ["Registros", String(frequencias.length)],
    ["Presencas", String(presencas)],
    ["Faltas", String(faltas)],
    ["Percentual", `${percentual}%`]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Diário</span>
              <span className="text-line">/</span>
              <span className="text-brand">Frequência</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Frequência <span className="font-display italic text-ink/60">{frequencias.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Registro diário de presenças e faltas por aluno, com suporte a chamada por turma.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ButtonLink href="/frequencias/chamada" variant="accent" className="shadow-[0_12px_26px_rgba(255,36,36,0.22)]">
                <CalendarCheck size={16} /> Chamada por turma
              </ButtonLink>
            </div>
            <dl className="grid gap-0 sm:grid-cols-4">
              {summary.map(([label, value]) => (
                <div key={label} className="border-line py-1 sm:border-l sm:px-6 first:sm:border-l-0">
                  <dt className="text-xs font-medium text-ink/62">{label}</dt>
                  <dd className="mt-1 font-display text-2xl italic leading-none text-brand">{value}</dd>
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
          <p className="ds-kicker">Registro avulso</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black text-ink">
            <Plus size={20} className="text-brand" />
            Lancamento de frequencia
          </h2>
        </div>
        <form action={createAttendanceAction} className="grid gap-4 md:grid-cols-5">
          <label className="md:col-span-2">
            Aluno
            <select name="aluno_id" required>
              {alunos.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input name="data_aula" type="date" />
          </label>
          <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
            <input name="presente" type="checkbox" defaultChecked className="h-4 w-4" />
            Presente
          </label>
          <label>
            Justificativa
            <input name="justificativa" />
          </label>
          <button className="ds-button ds-button-accent md:col-start-5">
            <Plus size={16} /> Registrar
          </button>
        </form>
      </Panel>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-black text-ink">Ultimos registros</h2>
          <p className="text-sm text-ink/60">Lancamentos mais recentes de frequencia.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted text-xs font-black uppercase tracking-[0.1em] text-ink/62">
              <tr>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Aluno</th>
                <th className="px-5 py-3">Presenca</th>
                <th className="px-5 py-3">Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {frequencias.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-ink/60">
                      <ClipboardList size={28} />
                      <p className="text-sm font-medium">Nenhum registro de frequência.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {frequencias.map((item) => (
                <tr key={item.id} className="border-t border-line transition hover:bg-muted/60">
                  <td className="px-5 py-4 font-medium text-ink/70">{dateText(item.data_aula)}</td>
                  <td className="px-5 py-4">
                    <strong className="text-ink">{item.alunos?.nome}</strong>
                    <span className="block text-xs text-ink/60">{item.alunos?.matricula_codigo}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={item.presente ? "green" : "red"}>{item.presente ? "Presente" : "Falta"}</Badge>
                  </td>
                  <td className="px-5 py-4 text-ink/65">{item.justificativa || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
