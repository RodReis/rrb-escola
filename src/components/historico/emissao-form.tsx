"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { StudentCombobox } from "@/components/matriculas/student-combobox";
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
  return `${nome}${t.serieNome} · ${turno} · ${t.anoLetivo}`;
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

export function EmissaoForm({ anoLetivo, nivel, series, turmas, alunos, elegiveis }: Props) {
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

  function aplicarFiltro(campo: "serie" | "turma", valor: string) {
    const params = new URLSearchParams({ ano: String(anoLetivo), nivel });
    if (campo !== "serie" && serieSelecionada) params.set("serie", serieSelecionada);
    if (campo !== "turma" && turmaSelecionada) params.set("turma", turmaSelecionada);
    if (valor) params.set(campo, valor);
    router.push(`/historico/emissao?${params.toString()}`);
  }

  function filtrarPorAluno(id: string) {
    const params = new URLSearchParams({ ano: String(anoLetivo), nivel, modo: "aluno" });
    if (id) params.set("aluno", id);
    router.push(`/historico/emissao?${params.toString()}`);
  }

  /** Trocar o tipo de pesquisa descarta o filtro do modo anterior. */
  function trocarModo(modo: "serie" | "aluno") {
    const params = new URLSearchParams({ ano: String(anoLetivo), nivel });
    if (modo === "aluno") params.set("modo", "aluno");
    router.push(`/historico/emissao?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Ano de referência
          <input
            type="number"
            defaultValue={anoLetivo}
            onBlur={(e) =>
              router.push(
                `/historico/emissao?ano=${e.target.value}&nivel=${nivel}${porAluno ? "&modo=aluno" : ""}`
              )
            }
            className="rounded border border-line bg-surface p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Pesquisa por
          <select
            value={porAluno ? "aluno" : "serie"}
            onChange={(e) => trocarModo(e.target.value as "serie" | "aluno")}
            className="rounded border border-line bg-surface p-2"
          >
            <option value="serie">Série / Turma</option>
            <option value="aluno">Aluno</option>
          </select>
        </label>

        {porAluno ? (
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Aluno
            <StudentCombobox
              alunos={alunos}
              defaultValue={alunos.find((a) => a.id === alunoSelecionado)}
              onSelect={(aluno) => filtrarPorAluno(aluno?.id ?? "")}
            />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Série
              <select
                value={serieSelecionada}
                onChange={(e) => aplicarFiltro("serie", e.target.value)}
                className="rounded border border-line bg-surface p-2"
              >
                <option value="">Todas as séries</option>
                {series.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Turma
              <select
                value={turmaSelecionada}
                onChange={(e) => aplicarFiltro("turma", e.target.value)}
                disabled={turmasDaSerie.length === 0}
                className="rounded border border-line bg-surface p-2 disabled:opacity-50"
              >
                <option value="">Todas as turmas</option>
                {turmasDaSerie.map((t) => (
                  <option key={t.id} value={t.id}>{rotuloTurma(t)}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {erro && <p className="rounded border border-clay p-3 text-sm text-clay">{erro}</p>}

      {pendentes.length > 0 && (
        <div className="rounded border border-line bg-muted p-3 text-sm">
          <p className="font-medium">Sem histórico cadastrado ({pendentes.length}):</p>
          <p className="text-muted">{pendentes.map((a) => a.nome).join(", ")}</p>
          <p className="mt-1 text-muted">
            Estes alunos não entram na emissão. Cadastre o histórico deles na tela de entrada de notas.
          </p>
        </div>
      )}

      {elegiveis.length === 0 ? (
        <p className="rounded-lg border border-line p-6 text-center text-sm text-muted">
          {porAluno
            ? "Busque um aluno para listar."
            : "Selecione uma série ou turma para listar os alunos."}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={prontos.length > 0 && selecionados.length === prontos.length}
                  onChange={marcarTodos}
                />
              </th>
              <th className="p-2">Aluno</th>
              <th className="p-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {elegiveis.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="p-2">
                  <input
                    type="checkbox"
                    disabled={!a.temHistorico}
                    checked={selecionados.includes(a.id)}
                    onChange={() => alternar(a.id)}
                  />
                </td>
                <td className="p-2">{a.nome}</td>
                <td className="p-2">{a.temHistorico ? "Pronto" : "Sem histórico"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        type="button"
        onClick={emitir}
        disabled={emitindo || selecionados.length === 0}
        className="rounded bg-brand px-4 py-2 text-paper disabled:opacity-50"
      >
        {emitindo ? "Emitindo…" : `Emitir selecionados (${selecionados.length})`}
      </button>
    </div>
  );
}
