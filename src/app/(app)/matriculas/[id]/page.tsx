import { ArrowLeft, Calendar, Pencil, Receipt, Wallet, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { GenerateChargesButton } from "@/components/finance/generate-charges-button";
import { DocumentGenerator } from "@/components/matriculas/document-generator";
import { EnrollmentTabs } from "@/components/matriculas/enrollment-tabs";
import { StudentCombobox } from "@/components/matriculas/student-combobox";
import { updateEnrollmentAction, updateEnrollmentStatusAction } from "@/lib/actions/academics";
import { money } from "@/lib/constants";
import { getEnrollmentDetail } from "@/lib/data/enrollments";
import { getEnrollmentChargesPreview } from "@/lib/data/finance";
import { getAcademicData } from "@/lib/data/lookups";
import { getMatriculaDocumentos } from "@/lib/data/documents";
import { requirePermission } from "@/lib/auth/session";
import { getTemplatesAtivos } from "@/lib/data/templates";
import { ReenrollButton } from "@/components/students/reenroll-button";

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

export default async function EnrollmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const { tab = "cadastro", rematricula } = await searchParams;

  const [{ alunos, series, turmas, planos }, detail, chargesPreview] = await Promise.all([
    getAcademicData(),
    getEnrollmentDetail(id),
    getEnrollmentChargesPreview(id),
  ]);
  const enrollment = detail.enrollment;
  const documentos = await getMatriculaDocumentos(enrollment.aluno_id);
  const student = one(enrollment.alunos);
  const serie = one(enrollment.series);
  const turma = one(enrollment.turmas);
  const plan = one(enrollment.planos);
  const totalAttendance = detail.totals.presencas + detail.totals.faltas;

  const session = await requirePermission("matriculas", "read");
  const templatesAtivos = await getTemplatesAtivos(session.profile.escola_id);
  const templatesLite = templatesAtivos.map((t) => ({ id: t.id, nome: t.nome, categoria: t.categoria }));

  return (
    <div className="grid gap-0 overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-surface px-6 py-7">
        <div>
          <p className="ds-kicker">Gestão / Histórico de matrícula</p>
          <h1 className="mt-7 font-display text-4xl text-ink">{student?.nome ?? "Matrícula"}</h1>
          <p className="mt-3 text-sm text-muted">
            {student?.matricula_codigo ?? "—"} / {serie?.nome ?? "—"} / {turma?.nome ?? "—"} / {enrollment.ano_letivo}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/matriculas" variant="secondary">
            <ArrowLeft size={14} /> Voltar
          </ButtonLink>
          {student?.id ? <ButtonLink href={`/alunos/${student.id}`} variant="primary">Ficha do aluno</ButtonLink> : null}
          {enrollment.status === "ativa" ? <ReenrollButton matriculaId={enrollment.id} /> : null}
        </div>
      </header>
      {rematricula === "1" && (
        <div className="mx-6 mt-4 rounded-ui border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-moss">
          Matrícula {enrollment.ano_letivo} criada com sucesso. Atribua a turma e confirme o plano.
        </div>
      )}

      {/* KPIs */}
      <section className="grid gap-3 border-b border-line bg-paper px-6 py-5 md:grid-cols-5">
        {[
          ["Status",     enrollment.status,                         "badge"],
          ["Plano",      plan?.nome ?? "Sem plano",                 "text"],
          ["Cobrado",    money.format(detail.totals.valorCobrado),  "money"],
          ["Pago",       money.format(detail.totals.valorPago),     "green"],
          ["Frequência", `${detail.totals.presencas}/${totalAttendance}`, "text"],
        ].map(([label, value, kind]) => (
          <Card key={label} className="min-h-[96px]">
            <p className="ds-kicker">{label}</p>
            {kind === "badge" ? (
              <div className="mt-5"><Badge tone={statusTone(String(value))}>{value}</Badge></div>
            ) : (
              <strong className={kind === "green" ? "mt-4 block text-2xl text-moss" : "mt-4 block text-2xl text-ink"}>{value}</strong>
            )}
          </Card>
        ))}
      </section>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 w-full bg-surface shadow-soft">
        <EnrollmentTabs />
      </div>

      {/* Tab content */}
      <div className="grid gap-6 p-6">

        {/* ── CADASTRO ───────────────────────────────────────────── */}
        {tab === "cadastro" && (
          <Panel className="grid gap-5">
            <div>
              <p className="ds-kicker">Cadastro</p>
              <h2 className="mt-2 flex items-center gap-2 font-display text-2xl text-ink">
                <Pencil size={20} className="text-brand" />
                Editar matrícula
              </h2>
            </div>
            <form action={updateEnrollmentAction} className="grid gap-4 md:grid-cols-4">
              <input type="hidden" name="id" value={enrollment.id} />
              <label className="md:col-span-2">Aluno
                <StudentCombobox alunos={alunos} defaultValue={{ id: enrollment.aluno_id, nome: student?.nome ?? "", matricula_codigo: student?.matricula_codigo ?? "" }} />
              </label>
              <label>Série
                <select name="serie_id" defaultValue={enrollment.serie_id} required>
                  {series.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
              <label>Turma
                <select name="turma_id" defaultValue={enrollment.turma_id} required>
                  {turmas.map((item) => <option key={item.id} value={item.id}>{item.nome} — {item.ano_letivo}</option>)}
                </select>
              </label>
              <label>Plano
                <select name="plano_id" defaultValue={enrollment.plano_id ?? ""}>
                  <option value="">Sem plano</option>
                  {planos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
              <label>Código<input name="codigo" defaultValue={enrollment.codigo ?? ""} /></label>
              <label>Data<input name="data_matricula" type="date" defaultValue={enrollment.data_matricula ?? ""} /></label>
              <label>Ano letivo<input name="ano_letivo" type="number" defaultValue={enrollment.ano_letivo ?? ""} /></label>
              <label>Idade<input name="idade_na_matricula" type="number" defaultValue={enrollment.idade_na_matricula ?? ""} /></label>
              <label>Status
                <select name="status" defaultValue={enrollment.status}>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="md:col-span-3">Observações<input name="observacoes" defaultValue={enrollment.observacoes ?? ""} /></label>
              <button className="ds-button ds-button-accent self-end">Salvar matrícula</button>
            </form>
          </Panel>
        )}

        {/* ── FINANCEIRO ─────────────────────────────────────────── */}
        {tab === "financeiro" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel className="grid gap-4">
              <div>
                <p className="ds-kicker">Financeiro</p>
                <h2 className="mt-2 flex items-center gap-2 font-display text-2xl text-ink">
                  <Receipt size={20} className="text-brand" />
                  Histórico financeiro
                </h2>
                <GenerateChargesButton matriculaId={enrollment.id} preview={chargesPreview} />
              </div>
              <div className="grid gap-2">
                {detail.charges.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
                    <Receipt size={24} />
                    <p className="text-sm">Nenhuma cobrança vinculada.</p>
                  </div>
                ) : null}
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
                <h2 className="mt-2 flex items-center gap-2 font-display text-2xl text-ink">
                  <Wallet size={20} className="text-brand" />
                  Pagamentos
                </h2>
              </div>
              <div className="grid gap-2">
                {detail.payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
                    <Wallet size={24} />
                    <p className="text-sm">Nenhum pagamento vinculado.</p>
                  </div>
                ) : null}
                {detail.payments.map((payment) => (
                  <div key={payment.id} className="border-b border-line py-3 text-sm last:border-b-0">
                    <strong className="text-lg text-ink">{money.format(Number(payment.valor_pago ?? 0))}</strong>
                    <span className="block text-muted">
                      {dateText(payment.data_pagamento)} / {payment.forma_pagamento} / {payment.cobrancas?.descricao ?? "Cobrança"}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* ── DOCUMENTOS ─────────────────────────────────────────── */}
        {tab === "documentos" && (
          <DocumentGenerator matriculaId={id} templates={templatesLite} documentosIniciais={documentos} />
        )}

        {/* ── FREQUÊNCIA ─────────────────────────────────────────── */}
        {tab === "frequencia" && (
          <Panel className="grid gap-4">
            <div>
              <p className="ds-kicker">Presença</p>
              <h2 className="mt-2 flex items-center gap-2 font-display text-2xl text-ink">
                <Calendar size={20} className="text-brand" />
                Histórico de frequência
              </h2>
            </div>
            <div className="grid gap-2">
              {detail.attendance.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
                  <Calendar size={24} />
                  <p className="text-sm">Nenhuma frequência vinculada.</p>
                </div>
              ) : null}
              {detail.attendance.map((item) => (
                <div key={item.id} className="grid gap-2 border-b border-line py-3 text-sm last:border-b-0 md:grid-cols-[140px_110px_1fr]">
                  <strong>{dateText(item.data_aula)}</strong>
                  <Badge tone={item.presente ? "green" : "red"}>{item.presente ? "Presente" : "Falta"}</Badge>
                  <span className="text-muted">{item.justificativa}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* ── AUDITORIA ──────────────────────────────────────────── */}
        {tab === "auditoria" && (
          <Panel className="grid gap-4">
            <div>
              <p className="ds-kicker">Auditoria</p>
              <h2 className="mt-2 flex items-center gap-2 font-display text-2xl text-ink">
                <History size={20} className="text-brand" />
                Alterações da matrícula
              </h2>
            </div>
            <div className="grid gap-2">
              {detail.history.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
                  <History size={24} />
                  <p className="text-sm">Nenhuma alteração registrada.</p>
                </div>
              ) : null}
              {detail.history.map((item) => (
                <div key={item.id} className="grid gap-2 border-b border-line py-3 text-sm last:border-b-0 md:grid-cols-[170px_120px_1fr]">
                  <strong>{new Date(item.created_at).toLocaleString("pt-BR")}</strong>
                  <span className="font-black">{item.acao}</span>
                  <span className="text-muted">Status: {item.status_anterior ?? "-"} → {item.status_novo ?? "-"}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

      </div>
    </div>
  );
}
