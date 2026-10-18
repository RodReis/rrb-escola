"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { carregarRequerimentosAction, previsualizarRequerimentoAction } from "@/lib/actions/requerimento-matricula";
import { renderRequerimentos } from "@/lib/documents/requerimento-matricula-pdf";
import { carregarImagens } from "@/lib/documents/pdf-utils";
import { companyLogoUrl } from "@/lib/storage/company-logo-url";
import type { AlunoParaRequerimento, DadosRequerimento } from "@/lib/data/requerimento-matricula";

type Serie = { id: string; nome: string };
type Turma = { id: string; nome: string; serieId: string; turno: string };

type Props = {
  anoLetivo: number;
  series: Serie[];
  turmas: Turma[];
  alunosElegiveis: AlunoParaRequerimento[];
};

export function RequerimentoEmissaoForm({ anoLetivo, series, turmas, alunosElegiveis }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serieSelecionada = searchParams.get("serie") ?? "";
  const turmaSelecionada = searchParams.get("turma") ?? "";
  const alunoSelecionado = searchParams.get("aluno") ?? "";

  const [observacoes, setObservacoes] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<DadosRequerimento | null>(null);
  const [previewErro, setPreviewErro] = useState<string | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [falhas, setFalhas] = useState<Array<{ nome: string; motivo: string }>>([]);

  // A Turma só existe dentro de uma Série: sem Série escolhida a lista fica vazia.
  const turmasDaSerie = serieSelecionada ? turmas.filter((t) => t.serieId === serieSelecionada) : [];

  // "Coletivo" ou "Individual" é só nome para o que já é a regra real:
  // aluno vazio emite para todos os elegíveis do filtro, aluno escolhido
  // emite (e pré-visualiza) só esse aluno.
  const emitindoParaUmAluno = Boolean(alunoSelecionado);
  const tipoEmissao = emitindoParaUmAluno ? "individual" : "coletivo";

  const matriculaReferencia = alunoSelecionado
    ? alunosElegiveis.find((a) => a.alunoId === alunoSelecionado)?.matriculaId
    : undefined;

  useEffect(() => {
    if (!matriculaReferencia) {
      setPreview(null);
      setPreviewErro(null);
      return;
    }
    let cancelado = false;
    setCarregandoPreview(true);
    setPreviewErro(null);
    previsualizarRequerimentoAction(matriculaReferencia)
      .then((resultado) => {
        if (!cancelado) setPreview(resultado);
      })
      .catch((e: unknown) => {
        if (!cancelado) {
          setPreview(null);
          setPreviewErro(e instanceof Error ? e.message : "Não foi possível carregar a pré-visualização.");
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoPreview(false);
      });
    return () => {
      cancelado = true;
    };
  }, [matriculaReferencia]);

  const atualizar = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      router.push(`/matriculas/requerimento?${params.toString()}`);
    },
    [router, searchParams]
  );

  const podeEmitir =
    alunosElegiveis.length > 0 && !emitindo && (!emitindoParaUmAluno || (!carregandoPreview && !previewErro && preview !== null));

  async function emitir() {
    if (!podeEmitir) return;
    setEmitindo(true);
    setErro(null);
    setFalhas([]);
    try {
      const matriculaIds = emitindoParaUmAluno && matriculaReferencia ? [matriculaReferencia] : alunosElegiveis.map((a) => a.matriculaId);
      const { paginas, falhas: falhasEmissao } = await carregarRequerimentosAction(matriculaIds, observacoes || null);
      setFalhas(falhasEmissao);
      if (paginas.length === 0) {
        setErro("Nenhum requerimento pôde ser gerado para os alunos selecionados.");
        return;
      }
      // companyLogoUrl converte o path cru salvo em companies.logo_path para
      // a URL pública do bucket — carregarImagens faz fetch da URL e indexa
      // o ImagemCache por ela, igual o renderer espera ao buscar a logo.
      // As fotos dos alunos (URL assinada vinda do servidor) entram no mesmo
      // cache; foto que falhar em baixar só deixa o espaço "Foto" em branco.
      const logoUrls = paginas.map((p) => companyLogoUrl(p.escola.logoPath));
      const fotoUrls = paginas.map((p) => p.dados.aluno.fotoUrl);
      const imagens = await carregarImagens([...logoUrls, ...fotoUrls]);
      const slugNome = alunosElegiveis.find((a) => a.alunoId === alunoSelecionado)?.nome
        ?.normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toUpperCase();
      const nomeArquivo =
        emitindoParaUmAluno && slugNome ? `${slugNome}-requerimento-${anoLetivo}.pdf` : `requerimentos-matricula-${anoLetivo}.pdf`;
      renderRequerimentos(paginas, imagens).save(nomeArquivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao emitir os requerimentos.");
    } finally {
      setEmitindo(false);
    }
  }

  const campoLabel = "grid gap-1.5 text-sm font-medium text-ink";
  const campoInput =
    "rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink/50";

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <label className={campoLabel}>
          Ano
          <input type="number" value={anoLetivo} onChange={(e) => atualizar({ ano: e.target.value })} className={campoInput} />
        </label>
        <label className={campoLabel}>
          Série
          <select
            value={serieSelecionada}
            onChange={(e) => atualizar({ serie: e.target.value, turma: null, aluno: null })}
            className={campoInput}
          >
            <option value="">Todas</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
        <label className={campoLabel}>
          Turma
          <select
            value={turmaSelecionada}
            onChange={(e) => atualizar({ turma: e.target.value, aluno: null })}
            disabled={!serieSelecionada}
            className={campoInput}
          >
            <option value="">Todas</option>
            {turmasDaSerie.map((t) => (
              <option key={t.id} value={t.id}>{t.turno.toUpperCase()}</option>
            ))}
          </select>
        </label>
        <label className={campoLabel}>
          Tipo de emissão
          <input value={emitindoParaUmAluno ? "Individual" : "Coletivo"} readOnly disabled className={campoInput} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={campoLabel}>
          Aluno
          <select value={alunoSelecionado} onChange={(e) => atualizar({ aluno: e.target.value })} className={campoInput}>
            <option value="">Todos ({alunosElegiveis.length})</option>
            {alunosElegiveis.map((a) => (
              <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>
            ))}
          </select>
        </label>
        <label className={campoLabel}>
          Observações
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className={`${campoInput} resize-y font-normal`}
          />
        </label>
      </div>

      {emitindoParaUmAluno ? (
        <div className="grid gap-2 rounded-panel border border-line bg-surface p-5 shadow-soft text-sm">
          {carregandoPreview ? (
            <p className="text-ink/60">Carregando pré-visualização...</p>
          ) : previewErro ? (
            <p className="text-danger">{previewErro}</p>
          ) : preview ? (
            <p>{preview.aluno.nome}</p>
          ) : (
            <p className="text-ink/60">Selecione um aluno para pré-visualizar.</p>
          )}
        </div>
      ) : null}

      {erro ? <p className="text-sm text-danger">{erro}</p> : null}

      {falhas.length > 0 ? (
        <div className="rounded-ui border border-warning/40 bg-warning/5 p-4 text-sm text-ink/80">
          <p className="font-medium">{falhas.length} aluno(s) não tiveram requerimento gerado:</p>
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
          Emitir
        </Button>
      </div>
    </div>
  );
}
