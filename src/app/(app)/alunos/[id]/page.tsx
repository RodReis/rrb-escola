import { ArrowLeft, Award, FileText, Pencil, ScrollText } from "lucide-react";
import { ReenrollButton } from "@/components/students/reenroll-button";
import { StudentStatementSection } from "@/components/finance/student-statement-section";
import { AnamneseAlunoSection } from "@/components/students/anamnese-aluno-section";
import { StudentHeaderActions } from "@/components/students/student-header-actions";
import { StudentSheetView } from "@/components/students/student-sheet";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStudentSheet } from "@/lib/data/students";
import { getSignedFotoUrl } from "@/lib/storage/photos";
import { requirePermission } from "@/lib/auth/session";
import { getTemplatesAtivos } from "@/lib/data/templates";
import { listarCobrancasAbertasParaCancelamento } from "@/lib/data/cancelamento";

export default async function StudentPage({ params, searchParams }: { params: { id: string }; searchParams: { ext_de?: string; ext_ate?: string } }) {
  const student = await getStudentSheet(params.id);
  const fotoSrc = await getSignedFotoUrl(student.foto_url);
  const activeEnrollment = student.matriculas.find((item) => item.status === "ativa") ?? student.matriculas[0];
  const matriculaAtivaForDocs = student.matriculas.find((m) => m.status === "ativa") ?? null;
  const matriculaAtivaPayload = matriculaAtivaForDocs
    ? {
        id: matriculaAtivaForDocs.id,
        codigo: matriculaAtivaForDocs.codigo ?? null,
        serieNome: matriculaAtivaForDocs.series?.nome ?? "",
        turmaNome: matriculaAtivaForDocs.turmas?.nome ?? "",
        anoLetivo: matriculaAtivaForDocs.ano_letivo,
      }
    : null;

  // Emissão direta pelo id do aluno. As duas telas aceitam ?aluno= e derivam
  // série/nível da matrícula daquele ano letivo, então o link já cai filtrado.
  const anoDoHistorico = activeEnrollment?.ano_letivo ?? new Date().getFullYear();
  const historicoHref = `/historico/emissao?aluno=${student.id}&ano=${anoDoHistorico}`;
  const certificadoHref = `/historico/certificado?aluno=${student.id}&ano=${anoDoHistorico}`;

  const session = await requirePermission("alunos", "read");
  const templatesAtivos = await getTemplatesAtivos(session.profile.escola_id);
  const templatesLite = templatesAtivos.map((t) => ({
    id: t.id,
    nome: t.nome,
    categoria: t.categoria ?? null
  }));

  // Sem matrícula ativa: a mais recente é a cancelada, e a secretaria precisa
  // saber se sobrou cobrança em aberto vencendo depois do cancelamento.
  const matriculaCanceladaRecente = matriculaAtivaForDocs
    ? null
    : [...student.matriculas]
        .sort((a, b) => (b.data_matricula ?? "").localeCompare(a.data_matricula ?? ""))
        .find((m) => m.cancelamento_data) ?? null;
  const cobrancasPendentesPosCancelamento = matriculaCanceladaRecente?.cancelamento_data
    ? (await listarCobrancasAbertasParaCancelamento(student.id, matriculaCanceladaRecente.cancelamento_data)).filter(
        (c) => c.preSelecionada,
      )
    : [];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Gestao / Ficha do aluno</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl text-ink">{student.nome}</h1>
            {activeEnrollment ? <Badge tone="green">{activeEnrollment.status}</Badge> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Matrícula {student.matricula_codigo}</span>
            {activeEnrollment?.series?.nome ? <span>{activeEnrollment.series.nome}</span> : null}
            {activeEnrollment?.turmas?.nome ? <span>{activeEnrollment.turmas.nome}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/alunos" variant="secondary">
            <ArrowLeft size={14} /> Voltar
          </ButtonLink>
          <ButtonLink href={`/alunos/${student.id}/boletim`} variant="boletim">
            <FileText size={14} /> Boletim
          </ButtonLink>
          <ButtonLink href={historicoHref} variant="historico">
            <ScrollText size={14} /> Histórico Escolar
          </ButtonLink>
          <ButtonLink href={certificadoHref} variant="certificado">
            <Award size={14} /> Certificado
          </ButtonLink>
          <ButtonLink href={`/alunos/${student.id}/editar`} variant="primary">
            <Pencil size={14} /> Editar
          </ButtonLink>
          <ReenrollButton alunoId={student.id} novato={student.matriculas.length === 0} />
          <StudentHeaderActions student={student} matriculaAtiva={matriculaAtivaPayload} templates={templatesLite} />
        </div>
      </header>
      {cobrancasPendentesPosCancelamento.length > 0 ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
          Existem {cobrancasPendentesPosCancelamento.length} cobrança(s) em aberto com vencimento após o
          cancelamento da matrícula. Revise se devem ser canceladas manualmente.
        </div>
      ) : null}
      <StudentSheetView student={student} fotoSrc={fotoSrc} geradoEm={new Date()} />
      <StudentStatementSection alunoId={params.id} searchParams={searchParams} />
      <AnamneseAlunoSection alunoId={params.id} />
    </div>
  );
}
