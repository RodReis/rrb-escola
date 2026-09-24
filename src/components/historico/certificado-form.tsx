"use client";

import { Download, Inbox, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StudentCombobox } from "@/components/matriculas/student-combobox";
import { CertificadoPreview } from "@/components/historico/certificado-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { FieldNote } from "@/components/ui/field-note";
import { PageNotice } from "@/components/ui/page-notice";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterDropdown, type DropdownOption } from "@/components/ui/filter-dropdown";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { salvarCertificadoConfigAction } from "@/lib/actions/certificados";
import { carregarHistoricosAction } from "@/lib/actions/historico";
import type { CertificadoConfig } from "@/lib/data/certificados";
import {
  BRASAO_DIREITA_PATH,
  BRASAO_ESQUERDA_PATH,
  LOGO_PADRAO_PATH,
  renderCertificados,
  type ImagemCache
} from "@/lib/documents/certificado-pdf";
import type {
  CertificadoData,
  CertificadoEscola,
  CertificadoOptions
} from "@/lib/documents/certificado-tipos";
import { carregarImagens } from "@/lib/documents/pdf-utils";
import { separarElegiveis, type AlunoElegivel } from "@/lib/historico/elegiveis";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";
import { companyLogoUrl } from "@/lib/storage/company-logo-url";

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
  config: CertificadoConfig;
  escola: CertificadoEscola;
  series: Array<{ id: string; nome: string }>;
  turmas: Turma[];
  alunos: Aluno[];
  elegiveis: AlunoElegivel[];
};

type Aba = "filtros" | "conteudo" | "leiaute" | "assinatura";

const ABAS: Array<{ id: Aba; label: string }> = [
  { id: "filtros", label: "Filtros" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "leiaute", label: "Leiaute" },
  { id: "assinatura", label: "Assinatura" }
];

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

/** Hoje em ISO local — `toISOString()` volta um dia em fuso negativo. */
function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const CAMPO =
  "rounded-ui border border-line bg-surface px-3 py-2 text-sm transition focus:border-brand/60 focus:outline-none focus:shadow-ring";
const ROTULO = "flex flex-col gap-1.5 text-sm font-medium text-ink/80";

export function CertificadoForm({
  anoLetivo,
  nivel,
  anosDisponiveis,
  config,
  escola,
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
  const porAluno = searchParams.get("modo") === "aluno";

  const [aba, setAba] = useState<Aba>("filtros");
  const [parametros, setParametros] = useState<CertificadoConfig>(config);
  const [anoConclusao, setAnoConclusao] = useState(anoLetivo);
  const [dataEmissao, setDataEmissao] = useState(hojeIso());
  const [usarCustomizado, setUsarCustomizado] = useState(config.textoCustomizado !== null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [emitindo, setEmitindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [historicos, setHistoricos] = useState<Map<string, HistoricoData>>(new Map());
  const [imagens, setImagens] = useState<ImagemCache>(new Map());

  // Brasões (fixos) e logo da mantenedora: baixados uma vez, não a cada
  // seleção de aluno — só mudam se `escola.logoPath` mudar entre navegações.
  useEffect(() => {
    let ativo = true;
    // `escola.logoPath` é o path cru salvo em `companies.logo_path` — precisa
    // virar a URL pública do bucket antes de ir para `carregarImagens`
    // (que só sabe fazer `fetch`), senão a busca sempre 404 e cai no padrão.
    carregarImagens([
      BRASAO_ESQUERDA_PATH,
      BRASAO_DIREITA_PATH,
      LOGO_PADRAO_PATH,
      companyLogoUrl(escola.logoPath)
    ]).then((cache) => {
      if (ativo) setImagens(cache);
    });
    return () => {
      ativo = false;
    };
  }, [escola.logoPath]);

  // Sugere o nome de secretária/diretora do cadastro da escola assim que ela
  // é conhecida (a config vem do server antes da série ser filtrada) — só
  // quando a linha ainda está vazia, para não sobrescrever o que a
  // secretária já digitou ou salvou como padrão.
  useEffect(() => {
    setParametros((p) => {
      let mudou = false;
      const assinaturas = p.assinaturas.map((a) => {
        if (a.ehSecretario && !a.nome.trim() && escola.secretarioNome) {
          mudou = true;
          return { ...a, nome: escola.secretarioNome };
        }
        if (a.ehDiretor && !a.nome.trim() && escola.diretorNome) {
          mudou = true;
          return { ...a, nome: escola.diretorNome };
        }
        return a;
      });
      return mudou ? { ...p, assinaturas } : p;
    });
  }, [escola.secretarioNome, escola.diretorNome]);

  const { prontos, pendentes } = separarElegiveis(elegiveis);
  const turmasDaSerie = serieSelecionada
    ? turmas.filter((t) => t.serieId === serieSelecionada && t.anoLetivo === anoLetivo)
    : turmas.filter((t) => t.anoLetivo === anoLetivo);

  const opts: CertificadoOptions = useMemo(
    () => ({
      tituloCertificado: parametros.tituloCertificado,
      textoInicio: parametros.textoInicio,
      descricaoCurso: parametros.descricaoCurso,
      baseLegal: parametros.baseLegal,
      anoConclusao,
      dataEmissao,
      textoCustomizado: usarCustomizado ? parametros.textoCustomizado : null,
      mostrarHistorico: parametros.mostrarHistorico,
      leiaute: parametros.leiaute,
      assinaturas: parametros.assinaturas
    }),
    [parametros, anoConclusao, dataEmissao, usarCustomizado]
  );

  const primeiroSelecionado = selecionados[0] ?? null;

  // Histórico do aluno em preview: carregado sob demanda e guardado, para que
  // editar o texto não refaça a consulta a cada tecla.
  useEffect(() => {
    if (!primeiroSelecionado || !parametros.mostrarHistorico) return;
    if (historicos.has(primeiroSelecionado)) return;

    let ativo = true;
    carregarHistoricosAction([primeiroSelecionado], nivel)
      .then(([historico]) => {
        if (!ativo || !historico) return;
        setHistoricos((atual) => new Map(atual).set(primeiroSelecionado, historico));
      })
      .catch(() => {
        // Preview sem o verso é degradação aceitável; a emissão avisa de novo.
      });

    return () => {
      ativo = false;
    };
  }, [primeiroSelecionado, parametros.mostrarHistorico, nivel, historicos]);

  const dadosDoAluno = (id: string): CertificadoData | null => {
    const elegivel = elegiveis.find((a) => a.id === id);
    if (!elegivel) return null;
    const historico = historicos.get(id);
    const turma = turmas.find((t) => t.id === turmaSelecionada);
    const serie = series.find((s) => s.id === (turma?.serieId ?? serieSelecionada));

    return {
      escola,
      aluno: {
        // Sem o histórico carregado ainda, o preview mostra o que a lista sabe;
        // os campos de documento chegam quando o histórico responde.
        id: elegivel.id,
        nome: historico?.aluno.nome ?? elegivel.nome,
        cpf: historico?.aluno.cpf ?? null,
        matricula: historico?.aluno.matricula ?? null,
        filiacao: historico?.aluno.filiacao ?? null,
        dataNascimento: historico?.aluno.dataNascimento ?? null,
        naturalidade: historico?.aluno.naturalidade ?? null,
        nacionalidade: historico?.aluno.nacionalidade ?? null,
        rg: historico?.aluno.rg ?? null,
        orgaoExpedidor: historico?.aluno.orgaoExpedidor ?? null,
        dataExpedicao: historico?.aluno.dataExpedicao ?? null,
        matriculaId: "",
        serie: serie?.nome ?? "",
        turma: turma?.nome ?? "",
        anoLetivo
      }
    };
  };

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  }

  function marcarTodos() {
    setSelecionados(selecionados.length === prontos.length ? [] : prontos.map((a) => a.id));
  }

  const atualizar = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      setSelecionados([]);
      router.push(`/historico/certificado?${params.toString()}`);
    },
    [router, searchParams]
  );

  function aplicarFiltro(campo: "serie" | "turma", valor: string) {
    atualizar(campo === "serie" ? { serie: valor, turma: null } : { turma: valor });
  }

  function filtrarPorAluno(id: string) {
    atualizar({ aluno: id || null });
  }

  function trocarModo(modo: "serie" | "aluno") {
    atualizar({ modo: modo === "aluno" ? "aluno" : null, serie: null, turma: null, aluno: null });
  }

  async function salvarPadrao() {
    setSalvando(true);
    try {
      await salvarCertificadoConfigAction({
        ...parametros,
        textoCustomizado: usarCustomizado ? parametros.textoCustomizado : null
      });
      toast.success("Parâmetros salvos como padrão.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar os parâmetros.");
    } finally {
      setSalvando(false);
    }
  }

  async function emitir(apenasProntos = false) {
    const ids = apenasProntos
      ? selecionados.filter((id) => elegiveis.find((a) => a.id === id)?.temHistorico)
      : selecionados;
    if (ids.length === 0) return;

    setEmitindo(true);
    try {
      const mapa = new Map(historicos);

      if (parametros.mostrarHistorico) {
        const faltando = ids.filter((id) => !mapa.has(id));
        if (faltando.length > 0) {
          for (const historico of await carregarHistoricosAction(faltando, nivel)) {
            mapa.set(historico.aluno.id, historico);
          }
        }

        const semHistorico = ids.filter((id) => !mapa.has(id));
        if (semHistorico.length > 0) {
          const nomes = semHistorico
            .map((id) => elegiveis.find((a) => a.id === id)?.nome ?? id)
            .join(", ");
          toast.error(
            `Sem histórico cadastrado: ${nomes}. Cadastre na entrada de notas ou desligue o histórico no verso.`
          );
          return;
        }
        setHistoricos(mapa);
      }

      const dados = ids.map(dadosDoAluno).filter((d): d is CertificadoData => d !== null);
      if (dados.length === 0) {
        toast.error("Nenhum aluno pôde ser carregado.");
        return;
      }

      const sufixo = dados[0].aluno.serie || String(anoConclusao);
      renderCertificados(dados, opts, mapa, imagens).save(
        `certificados-${sufixo}-${anoConclusao}.pdf`.replace(/\s+/g, "-").toLowerCase()
      );
      toast.success(
        dados.length === 1
          ? "Certificado emitido."
          : `${dados.length} certificados emitidos em um único PDF.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao emitir os certificados.");
    } finally {
      setEmitindo(false);
    }
  }

  const pendentesSelecionados = selecionados.filter(
    (id) => !elegiveis.find((a) => a.id === id)?.temHistorico
  );

  const serieOptions: DropdownOption[] = series.map((s) => ({ value: s.id, label: s.nome }));
  const turmaOptions: DropdownOption[] = turmasDaSerie.map((t) => ({ value: t.id, label: rotuloTurma(t) }));
  const anoOptions: DropdownOption[] = anosDisponiveis.map((a) => ({ value: String(a), label: String(a) }));

  return (
    <div className="grid gap-8">
      <div className="space-y-4">
        <nav className="flex flex-wrap gap-1 border-b border-line" aria-label="Parâmetros">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              aria-current={aba === a.id ? "page" : undefined}
              className={
                aba === a.id
                  ? "border-b-2 border-brand px-4 py-3 text-sm font-black text-brand"
                  : "border-b-2 border-transparent px-4 py-3 text-sm font-black text-ink/60 transition hover:text-ink"
              }
            >
              {a.label}
            </button>
          ))}
        </nav>

        {aba === "filtros" && (
          <div className="space-y-4">
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

              <label className={ROTULO}>
                Data de emissão
                <input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  className={`${CAMPO} w-fit`}
                />
              </label>
            </Card>

            {pendentes.length > 0 && parametros.mostrarHistorico && (
              <PageNotice tone="warning" title={`Sem histórico cadastrado (${pendentes.length})`}>
                <p>{pendentes.map((a) => a.nome).join(", ")}</p>
                <p className="mt-1 text-ink/60">
                  Com o histórico no verso ligado, estes alunos não entram na emissão — cadastre na
                  Entrada de Notas ou desligue o verso na aba Conteúdo.
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
                    <th>Histórico</th>
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
                            // Sem o verso ligado, o certificado sai sem histórico:
                            // aluno sem histórico continua elegível.
                            disabled={parametros.mostrarHistorico && !a.temHistorico}
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
          </div>
        )}

        {aba === "conteudo" && (
          <Card className="grid gap-4">
            <label className={ROTULO}>
              Título do certificado
              <input
                value={parametros.tituloCertificado}
                onChange={(e) =>
                  setParametros((p) => ({ ...p, tituloCertificado: e.target.value }))
                }
                className={CAMPO}
              />
            </label>

            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <Switch
                checked={parametros.mostrarHistorico}
                onChange={(checked) => setParametros((p) => ({ ...p, mostrarHistorico: checked }))}
                label="Imprimir o histórico escolar no verso"
              />
              <Switch
                checked={usarCustomizado}
                onChange={setUsarCustomizado}
                label="Escrever o texto manualmente"
              />
            </div>

            {usarCustomizado ? (
              <label className={ROTULO}>
                Texto do certificado
                <textarea
                  rows={6}
                  value={parametros.textoCustomizado ?? ""}
                  onChange={(e) =>
                    setParametros((p) => ({ ...p, textoCustomizado: e.target.value }))
                  }
                  className={CAMPO}
                />
                <FieldNote tone="info">
                  Campos disponíveis: {"{{aluno}}"}, {"{{curso}}"}, {"{{ano}}"}, {"{{escola}}"},{" "}
                  {"{{serie}}"}, {"{{nascimento}}"}, {"{{naturalidade}}"}, {"{{nacionalidade}}"},{" "}
                  {"{{rg}}"}, {"{{filiacao}}"}.
                </FieldNote>
              </label>
            ) : (
              <>
                <label className={ROTULO}>
                  Início do texto
                  <input
                    value={parametros.textoInicio}
                    onChange={(e) => setParametros((p) => ({ ...p, textoInicio: e.target.value }))}
                    className={CAMPO}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className={ROTULO}>
                    Ano de conclusão
                    <input
                      type="number"
                      value={anoConclusao}
                      onChange={(e) => setAnoConclusao(Number(e.target.value))}
                      className={CAMPO}
                    />
                  </label>

                  <label className={ROTULO}>
                    Descrição do curso
                    <input
                      value={parametros.descricaoCurso}
                      onChange={(e) =>
                        setParametros((p) => ({ ...p, descricaoCurso: e.target.value }))
                      }
                      className={CAMPO}
                    />
                  </label>
                </div>

                <label className={ROTULO}>
                  Base legal
                  <textarea
                    rows={3}
                    value={parametros.baseLegal}
                    onChange={(e) => setParametros((p) => ({ ...p, baseLegal: e.target.value }))}
                    className={CAMPO}
                  />
                </label>
              </>
            )}
          </Card>
        )}

        {aba === "leiaute" && (
          <Card className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className={ROTULO}>
                Orientação
                <select
                  value={parametros.leiaute.orientacao}
                  onChange={(e) =>
                    setParametros((p) => ({
                      ...p,
                      leiaute: {
                        ...p.leiaute,
                        orientacao: e.target.value as "landscape" | "portrait"
                      }
                    }))
                  }
                  className={CAMPO}
                >
                  <option value="landscape">Paisagem</option>
                  <option value="portrait">Retrato</option>
                </select>
              </label>

              <label className={ROTULO}>
                Margem (mm)
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={parametros.leiaute.margemMm}
                  onChange={(e) =>
                    setParametros((p) => ({
                      ...p,
                      leiaute: { ...p.leiaute, margemMm: Number(e.target.value) }
                    }))
                  }
                  className={CAMPO}
                />
              </label>

              <label className={ROTULO}>
                Tamanho da fonte (pt)
                <input
                  type="number"
                  min={7}
                  max={18}
                  step={0.5}
                  value={parametros.leiaute.fonteCorpoPt}
                  onChange={(e) =>
                    setParametros((p) => ({
                      ...p,
                      leiaute: { ...p.leiaute, fonteCorpoPt: Number(e.target.value) }
                    }))
                  }
                  className={CAMPO}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-6 border-t border-line pt-4">
              <Switch
                checked={parametros.leiaute.mostrarLogos}
                onChange={(checked) =>
                  setParametros((p) => ({ ...p, leiaute: { ...p.leiaute, mostrarLogos: checked } }))
                }
                label="Exibir logo"
              />
              <Switch
                checked={parametros.leiaute.mostrarMoldura}
                onChange={(checked) =>
                  setParametros((p) => ({ ...p, leiaute: { ...p.leiaute, mostrarMoldura: checked } }))
                }
                label="Exibir moldura"
              />
            </div>
          </Card>
        )}

        {aba === "assinatura" && (
          <Card className="space-y-3">
            {parametros.assinaturas.map((assinatura, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <label className={ROTULO}>
                  <span className="sr-only">Nome da assinatura {i + 1}</span>
                  <input
                    placeholder="Nome"
                    value={assinatura.nome}
                    onChange={(e) =>
                      setParametros((p) => ({
                        ...p,
                        assinaturas: p.assinaturas.map((a, j) =>
                          j === i ? { ...a, nome: e.target.value } : a
                        )
                      }))
                    }
                    className={CAMPO}
                  />
                </label>
                <label className={ROTULO}>
                  <span className="sr-only">Cargo da assinatura {i + 1}</span>
                  <input
                    placeholder="Cargo"
                    value={assinatura.cargo}
                    onChange={(e) =>
                      setParametros((p) => ({
                        ...p,
                        assinaturas: p.assinaturas.map((a, j) =>
                          j === i ? { ...a, cargo: e.target.value } : a
                        )
                      }))
                    }
                    className={CAMPO}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remover assinatura ${i + 1}`}
                  onClick={() =>
                    setParametros((p) => ({
                      ...p,
                      assinaturas: p.assinaturas.filter((_, j) => j !== i)
                    }))
                  }
                  className="flex items-center justify-center rounded-ui border border-line px-3 text-ink/60 transition hover:border-clay/40 hover:text-clay"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setParametros((p) => ({
                  ...p,
                  assinaturas: [...p.assinaturas, { nome: "", cargo: "" }]
                }))
              }
            >
              <Plus size={14} /> Adicionar assinatura
            </Button>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={salvarPadrao} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar como padrão"}
          </Button>

          <Button type="button" onClick={() => emitir()} disabled={emitindo || selecionados.length === 0}>
            {emitindo ? (
              "Emitindo…"
            ) : (
              <>
                <Download size={14} />
                {`Emitir selecionados (${selecionados.length})`}
              </>
            )}
          </Button>

          {parametros.mostrarHistorico && pendentesSelecionados.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => emitir(true)}
              disabled={emitindo}
            >
              Emitir apenas os prontos ({selecionados.length - pendentesSelecionados.length})
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-black text-ink/60">Pré-visualização</h2>
        <CertificadoPreview
          aluno={primeiroSelecionado ? dadosDoAluno(primeiroSelecionado) : null}
          historico={primeiroSelecionado ? historicos.get(primeiroSelecionado) ?? null : null}
          opts={opts}
          imagens={imagens}
        />
      </div>
    </div>
  );
}
