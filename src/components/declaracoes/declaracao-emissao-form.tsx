"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { carregarDeclaracoesAction, previsualizarDeclaracaoAction } from "@/lib/actions/declaracao-emissao";
import { renderDeclaracoes } from "@/lib/documents/declaracao-pdf";
import { carregarImagens } from "@/lib/documents/pdf-utils";
import type { AlunoParaDeclaracao } from "@/lib/data/declaracao-emissao";
import type { DeclaracaoModeloRow } from "@/lib/data/declaracoes";

type Serie = { id: string; nome: string };
type Turma = { id: string; nome: string; serieId: string };
type Preview = { titulo: string; texto: string; fecho: string };

type Props = {
  anoLetivo: number;
  series: Serie[];
  turmas: Turma[];
  alunosElegiveis: AlunoParaDeclaracao[];
  modelos: DeclaracaoModeloRow[];
};

export function DeclaracaoEmissaoForm({ anoLetivo, series, turmas, alunosElegiveis, modelos }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serieSelecionada = searchParams.get("serie") ?? "";
  const turmaSelecionada = searchParams.get("turma") ?? "";
  const alunoSelecionado = searchParams.get("aluno") ?? "";
  const modeloSelecionado = searchParams.get("modelo") ?? "";

  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [falhas, setFalhas] = useState<Array<{ nome: string; motivo: string }>>([]);

  const turmasDaSerie = serieSelecionada ? turmas.filter((t) => t.serieId === serieSelecionada) : turmas;

  // Só há edição plena da pré-visualização quando a emissão é para UM aluno
  // específico (filtro "Aluno" com valor escolhido, não "Todos"). Em lote,
  // os campos ficam somente leitura e os overrides nunca são enviados —
  // cada aluno do lote é resolvido com os PRÓPRIOS dados dentro da action
  // (ver achado CRITICAL: vazamento de dados pessoais de um aluno para
  // todos os demais quando o texto já resolvido era usado como "modelo").
  const emitindoParaUmAluno = Boolean(alunoSelecionado);

  // Aluno de referência para a pré-visualização: o selecionado no filtro,
  // ou o primeiro da lista de elegíveis — mesma regra da spec ("resolvidos
  // para o primeiro aluno do filtro, ou o único, se um aluno específico foi
  // escolhido").
  const matriculaReferencia = alunoSelecionado
    ? alunosElegiveis.find((a) => a.alunoId === alunoSelecionado)?.matriculaId
    : alunosElegiveis[0]?.matriculaId;

  // Troca de modelo (ou de aluno/turma, que muda quem é o "primeiro aluno")
  // busca a pré-visualização de novo. A edição feita pela pessoa no
  // textarea abaixo é sobrescrita nessa recarga — comportamento esperado,
  // pois mudar o filtro é escolher para quem gerar, não uma continuação da
  // mesma edição.
  useEffect(() => {
    if (!modeloSelecionado || !matriculaReferencia) {
      setPreview(null);
      return;
    }
    let cancelado = false;
    setCarregandoPreview(true);
    previsualizarDeclaracaoAction(matriculaReferencia, modeloSelecionado)
      .then((resultado) => {
        if (!cancelado) setPreview(resultado);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar a pré-visualização.");
      })
      .finally(() => {
        if (!cancelado) setCarregandoPreview(false);
      });
    return () => {
      cancelado = true;
    };
  }, [modeloSelecionado, matriculaReferencia]);

  const atualizar = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      router.push(`/declaracoes/emitir?${params.toString()}`);
    },
    [router, searchParams]
  );

  const podeEmitir = alunosElegiveis.length > 0 && modeloSelecionado !== "" && !emitindo;

  async function emitir() {
    if (!podeEmitir) return;
    setEmitindo(true);
    setErro(null);
    setFalhas([]);
    try {
      const matriculaIds = alunosElegiveis.map((a) => a.matriculaId);
      // A edição da pré-visualização só é aplicada quando a emissão é para
      // UM aluno específico — em lote, overrides é sempre undefined, e cada
      // aluno é resolvido com os próprios dados dentro da action (ver
      // emitindoParaUmAluno).
      const overrides =
        emitindoParaUmAluno && preview ? { titulo: preview.titulo, texto: preview.texto, fecho: preview.fecho } : undefined;
      const { paginas, falhas: falhasEmissao } = await carregarDeclaracoesAction(matriculaIds, modeloSelecionado, overrides);
      setFalhas(falhasEmissao);
      if (paginas.length === 0) {
        setErro("Nenhuma declaração pôde ser gerada para os alunos selecionados.");
        return;
      }
      const logoPaths = paginas.map((p) => p.credenciamento.logoPath ?? "/historico/logo-epg.png");
      const imagens = await carregarImagens(Array.from(new Set([...logoPaths, "/historico/logo-epg.png"])));
      renderDeclaracoes(paginas, imagens).save(`declaracoes-${anoLetivo}.pdf`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao emitir as declarações.");
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <label>
          Ano Letivo
          <input
            type="number"
            value={anoLetivo}
            onChange={(e) => atualizar({ ano: e.target.value })}
          />
        </label>
        <label>
          Série
          <select value={serieSelecionada} onChange={(e) => atualizar({ serie: e.target.value, turma: null, aluno: null })}>
            <option value="">Todas</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Turma
          <select value={turmaSelecionada} onChange={(e) => atualizar({ turma: e.target.value, aluno: null })}>
            <option value="">Todas</option>
            {turmasDaSerie.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Aluno
          <select value={alunoSelecionado} onChange={(e) => atualizar({ aluno: e.target.value })}>
            <option value="">Todos ({alunosElegiveis.length})</option>
            {alunosElegiveis.map((a) => (
              <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Modelo de Declaração
          <select value={modeloSelecionado} onChange={(e) => atualizar({ modelo: e.target.value })}>
            <option value="">Selecione</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </label>
      </div>

      {modeloSelecionado ? (
        <div className="grid gap-3 rounded-ui border border-line p-4">
          <p className="text-xs font-medium text-ink/60">
            {emitindoParaUmAluno
              ? "Visualização do modelo (edições aqui valem só para esta emissão — o modelo salvo não muda)"
              : "Emissão em lote: a pré-visualização é somente leitura. Para editar o texto desta emissão, selecione um aluno específico."}
          </p>
          {carregandoPreview ? (
            <p className="text-sm text-ink/60">Carregando pré-visualização...</p>
          ) : preview ? (
            <>
              <label>
                Título da declaração
                <input
                  value={preview.titulo}
                  readOnly={!emitindoParaUmAluno}
                  onChange={(e) => emitindoParaUmAluno && setPreview({ ...preview, titulo: e.target.value })}
                />
              </label>
              <label>
                Texto (pré-visualização)
                <textarea
                  value={preview.texto}
                  readOnly={!emitindoParaUmAluno}
                  onChange={(e) => emitindoParaUmAluno && setPreview({ ...preview, texto: e.target.value })}
                  rows={5}
                />
              </label>
              <label>
                Fecho (pré-visualização)
                <textarea
                  value={preview.fecho}
                  readOnly={!emitindoParaUmAluno}
                  onChange={(e) => emitindoParaUmAluno && setPreview({ ...preview, fecho: e.target.value })}
                  rows={2}
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-ink/60">Selecione ao menos um aluno elegível para pré-visualizar.</p>
          )}
        </div>
      ) : null}

      {erro ? <p className="text-sm text-danger">{erro}</p> : null}

      {falhas.length > 0 ? (
        <div className="rounded-ui border border-warning/40 bg-warning/5 p-4 text-sm text-ink/80">
          <p className="font-medium">{falhas.length} aluno(s) não tiveram declaração gerada:</p>
          <ul className="mt-1 list-inside list-disc">
            {falhas.map((f, i) => (
              <li key={i}>
                {f.nome}: {f.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="primary" disabled={!podeEmitir} loading={emitindo} onClick={emitir}>
          Emitir PDF
        </Button>
      </div>
    </div>
  );
}
