"use client";

import { Download, Inbox } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { StudentCombobox } from "@/components/matriculas/student-combobox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { FieldNote } from "@/components/ui/field-note";
import { PageNotice } from "@/components/ui/page-notice";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterDropdown, type DropdownOption } from "@/components/ui/filter-dropdown";
import { StatusPill } from "@/components/ui/status-pill";
import { carregarHistoricosAction } from "@/lib/actions/historico";
import { renderHistoricos } from "@/lib/documents/historico-pdf";
import { separarElegiveis, type AlunoElegivel } from "@/lib/historico/elegiveis";
import type { NivelEnsino } from "@/lib/historico/tipos";

type Turma = {
  id: string;
  nome: string;
  turno: string;
  serieId: string;
  serieNome: string;
  anoLetivo: number;
};

type Aluno = { id: string; nome: string; matricula_codigo: string };

type Props = {
  anoLetivo: number;
  nivel: NivelEnsino;
  anosDisponiveis: number[];
  series: Array<{ id: string; nome: string }>;
  turmas: Turma[];
  alunos: Aluno[];
  elegiveis: AlunoElegivel[];
};

const TURNO_LABEL: Record<string, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  integral: "Integral",
  noturno: "Noturno"
};

function rotuloTurma(t: Turma): string {
  const turno = TURNO_LABEL[t.turno.toLowerCase()] ?? t.turno;
  const nome = t.nome && t.nome.toLowerCase() !== t.turno.toLowerCase() ? `${t.nome} — ` : "";
  return `${nome}${t.serieNome} · ${turno}`;
}

async function logoParaDataUrl(): Promise<string | undefined> {
  try {
    const resposta = await fetch("/historico/logo-epg.png");
    if (!resposta.ok) return undefined;
    const blob = await resposta.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export function EmissaoForm({
  anoLetivo,
  nivel,
  anosDisponiveis,
  series,
  turmas,
  alunos,
  elegiveis
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serieSelecionada = searchParams.get("serie") ?? "";
  const turmaSelecionada = searchParams.get("turma") ?? "";
  const alunoSelecionado = searchParams.get("aluno") ?? "";
  // O modo e estado proprio: inferir de `aluno` fazia a combo voltar para
  // "Serie / Turma" enquanto nenhum aluno tivesse sido escolhido ainda.
  const porAluno = searchParams.get("modo") === "aluno";
  const turmasDaSerie = serieSelecionada
    ? turmas.filter((t) => t.serieId === serieSelecionada && t.anoLetivo === anoLetivo)
    : turmas.filter((t) => t.anoLetivo === anoLetivo);
  const { prontos, pendentes } = separarElegiveis(elegiveis);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  }

  function marcarTodos() {
    setSelecionados(selecionados.length === prontos.length ? [] : prontos.map((a) => a.id));
  }

  async function emitir() {
    if (selecionados.length === 0) return;
    setEmitindo(true);
    setErro(null);
    try {
      const [historicos, logoDataUrl] = await Promise.all([
        carregarHistoricosAction(selecionados, nivel),
        logoParaDataUrl()
      ]);
      if (historicos.length === 0) {
        setErro("Nenhum histórico pôde ser carregado para os alunos selecionados.");
        return;
      }
      renderHistoricos(historicos, { logoDataUrl }).save(`historicos-${anoLetivo}.pdf`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao emitir os históricos.");
    } finally {
      setEmitindo(false);
    }
  }

  const atualizar = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      setSelecionados([]);
      router.push(`/historico/emissao?${params.toString()}`);
    },
    [router, searchParams]
  );

  function aplicarFiltro(campo: "serie" | "turma", valor: string) {
    atualizar(campo === "serie" ? { serie: valor, turma: null } : { turma: valor });
  }

  function filtrarPorAluno(id: string) {
    atualizar({ aluno: id || null });
  }

  /** Trocar o tipo de pesquisa descarta o filtro do modo anterior. */
  function trocarModo(modo: "serie" | "aluno") {
    atualizar({ modo: modo === "aluno" ? "aluno" : null, serie: null, turma: null, aluno: null });
  }

  const serieOptions: DropdownOption[] = series.map((s) => ({ value: s.id, label: s.nome }));
  const turmaOptions: DropdownOption[] = turmasDaSerie.map((t) => ({ value: t.id, label: rotuloTurma(t) }));
  const anoOptions: DropdownOption[] = anosDisponiveis.map((a) => ({ value: String(a), label: String(a) }));

  return (
    <div className="grid gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <FilterDropdown
            label="Ano letivo"
            value={String(anoLetivo)}
            options={anoOptions}
            hideEmpty
            onChange={(v) => atualizar({ ano: v })}
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
                onSelect={(aluno) => filtrarPorAluno(aluno?.id ?? "")}
              />
            </div>
          ) : (
            <>
              <FilterDropdown
                label="Série"
                value={serieSelecionada}
                options={serieOptions}
                emptyLabel="Todas"
                onChange={(v) => aplicarFiltro("serie", v)}
              />
              <FilterDropdown
                label="Turma"
                value={turmaSelecionada}
                options={turmaOptions}
                emptyLabel="Todas"
                disabled={turmaOptions.length === 0}
                onChange={(v) => aplicarFiltro("turma", v)}
              />
            </>
          )}
        </div>
      </Card>

      {erro && (
        <FieldNote tone="warn" className="text-sm">
          {erro}
        </FieldNote>
      )}

      {pendentes.length > 0 && (
        <PageNotice tone="warning" title={`Sem histórico cadastrado (${pendentes.length})`}>
          <p>{pendentes.map((a) => a.nome).join(", ")}</p>
          <p className="mt-1 text-ink/60">
            Estes alunos não entram na emissão — cadastre o histórico deles na Entrada de Notas.
          </p>
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
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${a.nome}`}
                      disabled={!a.temHistorico}
                      checked={selecionados.includes(a.id)}
                      onChange={() => alternar(a.id)}
                    />
                  </td>
                  <td className="font-medium text-ink">{a.nome}</td>
                  <td>
                    <StatusPill tone={a.temHistorico ? "success" : "neutral"}>
                      {a.temHistorico ? "Pronto" : "Sem histórico"}
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
