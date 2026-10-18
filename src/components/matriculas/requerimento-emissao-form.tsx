"use client";

import { Download, Inbox } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { StudentCombobox } from "@/components/matriculas/student-combobox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { FieldNote } from "@/components/ui/field-note";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterDropdown, type DropdownOption } from "@/components/ui/filter-dropdown";
import { PageNotice } from "@/components/ui/page-notice";
import { StatusPill } from "@/components/ui/status-pill";
import { carregarRequerimentosAction } from "@/lib/actions/requerimento-matricula";
import { carregarImagens } from "@/lib/documents/pdf-utils";
import { renderRequerimentos } from "@/lib/documents/requerimento-matricula-pdf";
import type { AlunoParaRequerimento } from "@/lib/data/requerimento-matricula";
import { companyLogoUrl } from "@/lib/storage/company-logo-url";

type Turma = { id: string; serieId: string; turno: string };
type Aluno = { id: string; nome: string; matricula_codigo: string };

type Props = {
  anoLetivo: number;
  anosDisponiveis: number[];
  series: Array<{ id: string; nome: string }>;
  turmas: Turma[];
  alunos: Aluno[];
  elegiveis: AlunoParaRequerimento[];
};

type Falha = { nome: string; motivo: string };

function slug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function RequerimentoEmissaoForm({ anoLetivo, anosDisponiveis, series, turmas, alunos, elegiveis }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serieSelecionada = searchParams.get("serie") ?? "";
  const turmaSelecionada = searchParams.get("turma") ?? "";
  const alunoSelecionado = searchParams.get("aluno") ?? "";
  const porAluno = searchParams.get("modo") === "aluno";

  // A Turma só existe dentro de uma Série: sem Série escolhida a lista fica vazia.
  const turmasDaSerie = serieSelecionada ? turmas.filter((t) => t.serieId === serieSelecionada) : [];
  const prontos = elegiveis.filter((a) => a.temResponsavelFinanceiro);
  const pendentes = elegiveis.filter((a) => !a.temResponsavelFinanceiro);

  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<Falha[]>([]);

  function alternar(matriculaId: string) {
    setSelecionados((atual) =>
      atual.includes(matriculaId) ? atual.filter((x) => x !== matriculaId) : [...atual, matriculaId]
    );
  }

  function marcarTodos() {
    setSelecionados(selecionados.length === prontos.length ? [] : prontos.map((a) => a.matriculaId));
  }

  const atualizar = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      setSelecionados([]);
      setFalhas([]);
      router.push(`/matriculas/requerimento?${params.toString()}`);
    },
    [router, searchParams]
  );

  /** Trocar o tipo de pesquisa descarta o filtro do modo anterior. */
  function trocarModo(modo: "serie" | "aluno") {
    atualizar({ modo: modo === "aluno" ? "aluno" : null, serie: null, turma: null, aluno: null });
  }

  async function emitir() {
    if (selecionados.length === 0) return;
    setEmitindo(true);
    setErro(null);
    setFalhas([]);
    try {
      // Observações vão iguais em todas as páginas do lote — nunca por aluno.
      const { paginas, falhas: falhasEmissao } = await carregarRequerimentosAction(
        selecionados,
        observacoes.trim() || null
      );
      setFalhas(falhasEmissao);
      if (paginas.length === 0) {
        setErro("Nenhum requerimento pôde ser gerado para os alunos selecionados.");
        return;
      }
      // Logo (bucket público) e fotos (URL assinada vinda do servidor) entram no
      // mesmo cache; imagem que falhar em baixar só sai em branco no PDF.
      const imagens = await carregarImagens([
        ...paginas.map((p) => companyLogoUrl(p.escola.logoPath)),
        ...paginas.map((p) => p.dados.aluno.fotoUrl)
      ]);
      const nomeArquivo =
        paginas.length === 1
          ? `${slug(paginas[0].dados.aluno.nome)}-requerimento-${anoLetivo}.pdf`
          : `requerimentos-matricula-${anoLetivo}.pdf`;
      renderRequerimentos(paginas, imagens).save(nomeArquivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao emitir os requerimentos.");
    } finally {
      setEmitindo(false);
    }
  }

  const anoOptions: DropdownOption[] = anosDisponiveis.map((a) => ({ value: String(a), label: String(a) }));
  const serieOptions: DropdownOption[] = series.map((s) => ({ value: s.id, label: s.nome }));
  const turmaOptions: DropdownOption[] = turmasDaSerie.map((t) => ({ value: t.id, label: t.turno.toUpperCase() }));

  return (
    <div className="grid gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <FilterDropdown
            label="Ano letivo"
            value={String(anoLetivo)}
            options={anoOptions}
            hideEmpty
            onChange={(v) => atualizar({ ano: v, serie: null, turma: null })}
          />

          <FilterChips
            items={[
              { value: "serie", label: "Série / Turma" },
              { value: "aluno", label: "Aluno" }
            ]}
            value={porAluno ? "aluno" : "serie"}
            onChange={(v) => trocarModo(v as "serie" | "aluno")}
          />

          {porAluno ? (
            <div className="min-w-[240px] flex-1">
              <StudentCombobox
                alunos={alunos}
                defaultValue={alunos.find((a) => a.id === alunoSelecionado)}
                onSelect={(aluno) => atualizar({ aluno: aluno?.id ?? null })}
              />
            </div>
          ) : (
            <>
              <FilterDropdown
                label="Série"
                value={serieSelecionada}
                options={serieOptions}
                emptyLabel="Todas"
                onChange={(v) => atualizar({ serie: v, turma: null })}
              />
              <FilterDropdown
                label="Turma"
                value={turmaSelecionada}
                options={turmaOptions}
                emptyLabel="Todas"
                disabled={turmaOptions.length === 0}
                onChange={(v) => atualizar({ turma: v })}
              />
            </>
          )}
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-ink">Observações</span>
          <textarea
            rows={2}
            maxLength={600}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional — sai igual em todos os requerimentos emitidos."
          />
        </label>
      </Card>

      {erro && (
        <FieldNote tone="warn" className="text-sm">
          {erro}
        </FieldNote>
      )}

      {pendentes.length > 0 && (
        <PageNotice tone="warning" title={`Sem responsável financeiro (${pendentes.length})`}>
          <p>{pendentes.map((a) => a.nome).join(", ")}</p>
          <p className="mt-1 text-ink/60">
            Estes alunos não entram na emissão — marque o responsável financeiro no cadastro do aluno.
          </p>
        </PageNotice>
      )}

      {falhas.length > 0 && (
        <PageNotice tone="warning" title={`Não gerados (${falhas.length})`}>
          <ul className="list-inside list-disc">
            {falhas.map((f, i) => (
              <li key={`${f.nome}-${i}`}>
                {f.nome}: {f.motivo}
              </li>
            ))}
          </ul>
        </PageNotice>
      )}

      <DataTableShell>
        <table className="ds-dt min-w-[520px]">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Marcar todos"
                  checked={prontos.length > 0 && selecionados.length === prontos.length}
                  onChange={marcarTodos}
                  disabled={prontos.length === 0}
                />
              </th>
              <th>Aluno</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {elegiveis.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink/60">
                    <Inbox size={28} />
                    <p className="text-sm font-medium">
                      {porAluno
                        ? "Busque um aluno para listar."
                        : "Selecione uma série ou turma para listar os alunos."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              elegiveis.map((a) => (
                <tr key={a.matriculaId}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${a.nome}`}
                      disabled={!a.temResponsavelFinanceiro}
                      checked={selecionados.includes(a.matriculaId)}
                      onChange={() => alternar(a.matriculaId)}
                    />
                  </td>
                  <td className="font-medium text-ink">{a.nome}</td>
                  <td>
                    <StatusPill tone={a.temResponsavelFinanceiro ? "success" : "neutral"}>
                      {a.temResponsavelFinanceiro ? "Pronto" : "Sem responsável financeiro"}
                    </StatusPill>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={emitir} disabled={emitindo || selecionados.length === 0}>
          {emitindo ? (
            "Emitindo…"
          ) : (
            <>
              <Download size={14} />
              {`Emitir selecionados (${selecionados.length})`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
