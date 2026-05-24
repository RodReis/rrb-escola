import { notFound } from "next/navigation";
import { GraduationCap, CalendarCheck, ArrowLeft, BookOpen, ClipboardList } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { getBoletim } from "@/lib/data/pedagogico";
import { getSignedFotoUrls } from "@/lib/storage/photos";
import { getPublicUrl } from "@/lib/storage/public-urls";
import { ExportBoletimButton } from "@/components/pdf/export-boletim-button";
import { requirePermission } from "@/lib/auth/session";

function colorMedia(media: number | null): string {
  if (media === null) return "bg-muted text-ink/40";
  if (media >= 8) return "bg-success/15 text-success";
  if (media >= 6) return "bg-brand/10 text-brand";
  if (media >= 4) return "bg-warning/15 text-warning";
  return "bg-danger/15 text-danger";
}

export default async function BoletimPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ano?: string }>;
}) {
  await requirePermission("avaliacoes", "read");
  const { id } = await params;
  const sp = await searchParams;
  const ano = sp.ano ? Number(sp.ano) : new Date().getFullYear();

  const boletim = await getBoletim(id, ano);
  if (!boletim) notFound();

  const [signed, logoUrl] = await Promise.all([
    getSignedFotoUrls([boletim.aluno.fotoUrl]),
    getPublicUrl("escola-logos", boletim.escola.logoUrl),
  ]);
  const foto = boletim.aluno.fotoUrl ? signed.get(boletim.aluno.fotoUrl) ?? null : null;

  const totalDisciplinas = boletim.disciplinas.length;
  const aprovadas = boletim.disciplinas.filter((d) => d.mediaAnual !== null && d.mediaAnual >= 6).length;
  const reprovadas = boletim.disciplinas.filter((d) => d.mediaAnual !== null && d.mediaAnual < 6).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Alunos", href: "/alunos" },
          { label: boletim.aluno.nome, href: `/alunos/${boletim.aluno.id}` },
          { label: "Boletim" },
        ]}
        title={`Boletim · ${ano}`}
        description={`${boletim.matricula.serie} ${boletim.matricula.turma}`}
        actions={
          <>
            <ExportBoletimButton boletim={boletim} fotoUrl={foto} logoUrl={logoUrl} />
            <ButtonLink href={`/alunos/${boletim.aluno.id}`} variant="secondary">
              <ArrowLeft size={14} /> Voltar à ficha
            </ButtonLink>
          </>
        }
      />

      <Panel className="grid gap-4 md:grid-cols-[auto_1fr_auto] items-center">
        <Avatar src={foto} name={boletim.aluno.nome} size={80} />
        <div>
          <h2 className="text-2xl font-bold text-ink">{boletim.aluno.nome}</h2>
          <p className="text-sm text-ink/60">
            {boletim.matricula.serie} {boletim.matricula.turma}
            {boletim.aluno.matriculaCodigo && ` · Mat. ${boletim.aluno.matriculaCodigo}`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-ui bg-muted/40 p-3 text-center">
            <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Disciplinas</p>
            <strong className="mt-1 block text-2xl font-bold text-ink">{totalDisciplinas}</strong>
          </div>
          <div className="rounded-ui bg-success/10 p-3 text-center">
            <p className="text-[0.66rem] uppercase tracking-kicker text-success/80">Aprovado em</p>
            <strong className="mt-1 block text-2xl font-bold text-success">{aprovadas}</strong>
          </div>
          <div className="rounded-ui bg-danger/10 p-3 text-center">
            <p className="text-[0.66rem] uppercase tracking-kicker text-danger/80">Reprovado em</p>
            <strong className="mt-1 block text-2xl font-bold text-danger">{reprovadas}</strong>
          </div>
        </div>
      </Panel>

      <Panel className="grid gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-brand" />
          <h3 className="font-bold text-ink">Notas por bimestre</h3>
        </div>
        {boletim.disciplinas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
            <BookOpen size={28} />
            <p className="text-sm font-medium">Nenhuma nota lançada neste ano letivo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
                  <th className="px-2 py-2 text-left">Disciplina</th>
                  <th className="px-2 py-2 text-center">1º Bim</th>
                  <th className="px-2 py-2 text-center">2º Bim</th>
                  <th className="px-2 py-2 text-center">3º Bim</th>
                  <th className="px-2 py-2 text-center">4º Bim</th>
                  <th className="px-2 py-2 text-center">Anual</th>
                  <th className="px-2 py-2 text-center">Situação</th>
                </tr>
              </thead>
              <tbody>
                {boletim.disciplinas.map((d) => {
                  const situacao = d.mediaAnual === null ? "—" : d.mediaAnual >= 6 ? "Aprovado" : "Reprovado";
                  const sitColor = d.mediaAnual === null ? "text-ink/40"
                    : d.mediaAnual >= 6 ? "text-success" : "text-danger";
                  return (
                    <tr key={d.disciplinaId} className="border-t border-line">
                      <td className="px-2 py-2 font-semibold text-ink">{d.disciplina}</td>
                      {d.bimestres.map((b) => (
                        <td key={b.bimestre} className="px-2 py-2 text-center">
                          <span className={`inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-pill px-2 text-xs font-bold ${colorMedia(b.media)}`}>
                            {b.media != null ? b.media.toFixed(1) : "—"}
                          </span>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-flex h-8 min-w-[3rem] items-center justify-center rounded-pill px-3 text-sm font-bold ${colorMedia(d.mediaAnual)}`}>
                          {d.mediaAnual != null ? d.mediaAnual.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className={`px-2 py-2 text-center text-xs font-bold ${sitColor}`}>
                        {situacao}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="grid gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={16} className="text-brand" />
          <h3 className="font-bold text-ink">Frequência (ano letivo)</h3>
        </div>
        {boletim.frequencia.totalDias === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
            <ClipboardList size={28} />
            <p className="text-sm font-medium">Nenhum registro de frequência.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-ui bg-muted/40 p-3">
              <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55">Total dias</p>
              <strong className="mt-1 block text-xl font-bold text-ink">{boletim.frequencia.totalDias}</strong>
            </div>
            <div className="rounded-ui bg-success/10 p-3">
              <p className="text-[0.66rem] uppercase tracking-kicker text-success/80">Presenças</p>
              <strong className="mt-1 block text-xl font-bold text-success">{boletim.frequencia.presencas}</strong>
            </div>
            <div className="rounded-ui bg-danger/10 p-3">
              <p className="text-[0.66rem] uppercase tracking-kicker text-danger/80">Faltas</p>
              <strong className="mt-1 block text-xl font-bold text-danger">{boletim.frequencia.faltas}</strong>
            </div>
            <div className="rounded-ui bg-brand/10 p-3">
              <p className="text-[0.66rem] uppercase tracking-kicker text-brand/80">Taxa</p>
              <strong className="mt-1 block text-xl font-bold text-brand">
                {(boletim.frequencia.taxa * 100).toFixed(1)}%
              </strong>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
