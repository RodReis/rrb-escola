import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { updateEnrollmentAction, updateEnrollmentStatusAction } from "@/lib/actions/academics";
import { money } from "@/lib/constants";
import { getEnrollmentDetail } from "@/lib/data/enrollments";
import { getAcademicData } from "@/lib/data/lookups";

const statuses = ["ativa", "cancelada", "transferida", "concluida"];

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function dateText(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";
}

function statusTone(status: string): "green" | "red" | "gold" | "gray" {
  if (status === "ativa" || status === "pago" || status === "presente") return "green";
  if (status === "cancelada" || status === "vencido" || status === "falta") return "red";
  if (status === "transferida" || status === "pendente") return "gold";
  return "gray";
}

export default async function EnrollmentDetailPage({ params }: { params: { id: string } }) {
  const [{ alunos, series, turmas, planos }, detail] = await Promise.all([getAcademicData(), getEnrollmentDetail(params.id)]);
  const enrollment = detail.enrollment;
  const student = one(enrollment.alunos);
  const serie = one(enrollment.series);
  const turma = one(enrollment.turmas);
  const plan = one(enrollment.planos);
  const totalAttendance = detail.totals.presencas + detail.totals.faltas;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Gestao / Historico de matricula</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">{student?.nome ?? "Matricula"}</h1>
          <p className="mt-3 text-sm text-muted">
            {student?.matricula_codigo ?? "Sem codigo"} / {serie?.nome ?? "Sem serie"} / {turma?.nome ?? "Sem turma"} / {enrollment.ano_letivo}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/matriculas" variant="secondary">Voltar</ButtonLink>
          {student?.id ? <ButtonLink href={`/alunos/${student.id}`} variant="primary">Ficha do aluno</ButtonLink> : null}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ["Status", enrollment.status, "badge"],
          ["Plano", plan?.nome ?? "Sem plano", "text"],
          ["Cobrado", money.format(detail.totals.valorCobrado), "money"],
          ["Pago", money.format(detail.totals.valorPago), "green"],
          ["Frequencia", `${detail.totals.presencas}/${totalAttendance}`, "text"]
        ].map(([label, value, kind]) => (
          <Card key={label} className="min-h-[112px]">
            <p className="ds-kicker">{label}</p>
            {kind === "badge" ? (
              <div className="mt-5"><Badge tone={statusTone(String(value))}>{value}</Badge></div>
            ) : (
              <strong className={kind === "green" ? "mt-4 block text-2xl text-moss" : "mt-4 block text-2xl text-ink"}>{value}</strong>
            )}
          </Card>
        ))}
      </section>

      <Panel className="grid gap-5">
        <div>
          <p className="ds-kicker">Cadastro</p>
          <h2 className="mt-2 font-serif text-2xl text-ink">Editar matricula</h2>
        </div>
        <form action={updateEnrollmentAction} className="grid gap-4 md:grid-cols-4">
          <input type="hidden" name="id" value={enrollment.id} />
          <label>
            Aluno
            <select name="aluno_id" defaultValue={enrollment.aluno_id} required>
              {alunos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>
            Serie
            <select name="serie_id" defaultValue={enrollment.serie_id} required>
              {series.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>
            Turma
            <select name="turma_id" defaultValue={enrollment.turma_id} required>
              {turmas.map((item) => <option key={item.id} value={item.id}>{item.nome} - {item.ano_letivo}</option>)}
            </select>
          </label>
          <label>
            Plano
            <select name="plano_id" defaultValue={enrollment.plano_id ?? ""}>
              <option value="">Sem plano</option>
              {planos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>Codigo<input name="codigo" defaultValue={enrollment.codigo ?? ""} /></label>
          <label>Data<input name="data_matricula" type="date" defaultValue={enrollment.data_matricula} /></label>
          <label>Ano letivo<input name="ano_letivo" type="number" defaultValue={enrollment.ano_letivo} /></label>
          <label>Idade<input name="idade_na_matricula" type="number" defaultValue={enrollment.idade_na_matricula ?? ""} /></label>
          <label>
            Status
            <select name="status" defaultValue={enrollment.status}>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="md:col-span-3">Observacoes<input name="observacoes" defaultValue={enrollment.observacoes ?? ""} /></label>
          <button className="ds-button ds-button-accent self-end">Salvar matricula</button>
        </form>

        <form action={updateEnrollmentStatusAction} className="grid gap-4 border-t border-line pt-5 md:grid-cols-[220px_1fr_auto]">
          <input type="hidden" name="id" value={enrollment.id} />
          <input type="hidden" name="aluno_id" value={enrollment.aluno_id} />
          <label>
            Alterar status rapido
            <select name="status" defaultValue={enrollment.status}>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label>Observacao do status<input name="observacoes" defaultValue={enrollment.observacoes ?? ""} /></label>
          <button className="ds-button ds-button-secondary self-end">Atualizar status</button>
        </form>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel className="grid gap-4">
          <div>
            <p className="ds-kicker">Financeiro</p>
            <h2 className="mt-2 font-serif text-2xl text-ink">Historico financeiro</h2>
          </div>
          <div className="grid gap-2">
            {detail.charges.length === 0 ? <p className="text-sm text-muted">Nenhuma cobranca vinculada.</p> : null}
            {detail.charges.map((charge) => (
              <div key={charge.id} className="grid gap-3 border-b border-line py-3 text-sm last:border-b-0 md:grid-cols-[1fr_110px_110px_90px]">
                <div>
                  <strong className="text-ink">{charge.descricao}</strong>
                  <span className="block text-muted">{charge.competencia} / vence {dateText(charge.data_vencimento)}</span>
                </div>
                <span>{money.format(Number(charge.valor_total ?? 0))}</span>
                <span className="font-bold text-moss">{money.format(Number(charge.valor_pago ?? 0))}</span>
                <Badge tone={statusTone(charge.status)}>{charge.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="grid gap-4">
          <div>
            <p className="ds-kicker">Baixas</p>
            <h2 className="mt-2 font-serif text-2xl text-ink">Pagamentos</h2>
          </div>
          <div className="grid gap-2">
            {detail.payments.length === 0 ? <p className="text-sm text-muted">Nenhum pagamento vinculado.</p> : null}
            {detail.payments.map((payment) => (
              <div key={payment.id} className="border-b border-line py-3 text-sm last:border-b-0">
                <strong className="text-lg text-ink">{money.format(Number(payment.valor_pago ?? 0))}</strong>
                <span className="block text-muted">
                  {dateText(payment.data_pagamento)} / {payment.forma_pagamento} / {payment.cobrancas?.descricao ?? "Cobranca"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel className="grid gap-4">
        <div>
          <p className="ds-kicker">Auditoria</p>
          <h2 className="mt-2 font-serif text-2xl text-ink">Alteracoes da matricula</h2>
        </div>
        <div className="grid gap-2">
          {detail.history.length === 0 ? <p className="text-sm text-muted">Nenhuma alteracao registrada.</p> : null}
          {detail.history.map((item) => (
            <div key={item.id} className="grid gap-2 border-b border-line py-3 text-sm last:border-b-0 md:grid-cols-[170px_120px_1fr]">
              <strong>{new Date(item.created_at).toLocaleString("pt-BR")}</strong>
              <span className="font-black">{item.acao}</span>
              <span className="text-muted">Status: {item.status_anterior ?? "-"} {">"} {item.status_novo ?? "-"}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="grid gap-4">
        <div>
          <p className="ds-kicker">Presenca</p>
          <h2 className="mt-2 font-serif text-2xl text-ink">Historico de frequencia</h2>
        </div>
        <div className="grid gap-2">
          {detail.attendance.length === 0 ? <p className="text-sm text-muted">Nenhuma frequencia vinculada.</p> : null}
          {detail.attendance.map((item) => (
            <div key={item.id} className="grid gap-2 border-b border-line py-3 text-sm last:border-b-0 md:grid-cols-[140px_110px_1fr]">
              <strong>{dateText(item.data_aula)}</strong>
              <Badge tone={item.presente ? "green" : "red"}>{item.presente ? "Presente" : "Falta"}</Badge>
              <span className="text-muted">{item.justificativa}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
