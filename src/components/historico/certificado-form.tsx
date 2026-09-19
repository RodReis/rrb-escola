"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StudentCombobox } from "@/components/matriculas/student-combobox";
import { CertificadoPreview } from "@/components/historico/certificado-preview";
import { salvarCertificadoConfigAction } from "@/lib/actions/certificados";
import { carregarHistoricosAction } from "@/lib/actions/historico";
import type { CertificadoConfig } from "@/lib/data/certificados";
import { renderCertificados } from "@/lib/documents/certificado-pdf";
import type {
  CertificadoData,
  CertificadoEscola,
  CertificadoOptions
} from "@/lib/documents/certificado-tipos";
import { separarElegiveis, type AlunoElegivel } from "@/lib/historico/elegiveis";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";

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
  return `${nome}${t.serieNome} · ${turno} · ${t.anoLetivo}`;
}

/** Hoje em ISO local — `toISOString()` volta um dia em fuso negativo. */
function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const CAMPO = "rounded border border-line bg-surface p-2";
const ROTULO = "flex flex-col gap-1 text-sm";

export function CertificadoForm({
  anoLetivo,
  nivel,
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

  function aplicarFiltro(campo: "serie" | "turma", valor: string) {
    const params = new URLSearchParams({ ano: String(anoLetivo) });
    if (campo !== "serie" && serieSelecionada) params.set("serie", serieSelecionada);
    if (campo !== "turma" && turmaSelecionada) params.set("turma", turmaSelecionada);
    if (valor) params.set(campo, valor);
    setSelecionados([]);
    router.push(`/historico/certificado?${params.toString()}`);
  }

  function filtrarPorAluno(id: string) {
    const params = new URLSearchParams({ ano: String(anoLetivo), modo: "aluno" });
    if (id) params.set("aluno", id);
    setSelecionados([]);
    router.push(`/historico/certificado?${params.toString()}`);
  }

  function trocarModo(modo: "serie" | "aluno") {
    const params = new URLSearchParams({ ano: String(anoLetivo) });
    if (modo === "aluno") params.set("modo", "aluno");
    setSelecionados([]);
    router.push(`/historico/certificado?${params.toString()}`);
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
      renderCertificados(dados, opts, mapa).save(
        `certificados-${sufixo}-${anoConclusao}.pdf`.replace(/\s+/g, "-").toLowerCase()
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
                  ? "border-b-2 border-brand px-3 py-2 text-sm font-medium"
                  : "border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-ink"
              }
            >
              {a.label}
            </button>
          ))}
        </nav>

        {aba === "filtros" && (
          <div className="space-y-4">
            <div className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-2">
              <label className={ROTULO}>
                Ano de referência
                <input
                  type="number"
                  defaultValue={anoLetivo}
                  onBlur={(e) =>
                    router.push(
                      `/historico/certificado?ano=${e.target.value}${porAluno ? "&modo=aluno" : ""}`
                    )
                  }
                  className={CAMPO}
                />
              </label>

              <label className={ROTULO}>
                Data de emissão
                <input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  className={CAMPO}
                />
              </label>

              <label className={ROTULO}>
                Pesquisa por
                <select
                  value={porAluno ? "aluno" : "serie"}
                  onChange={(e) => trocarModo(e.target.value as "serie" | "aluno")}
                  className={CAMPO}
                >
                  <option value="serie">Série / Turma</option>
                  <option value="aluno">Aluno</option>
                </select>
              </label>

              {porAluno ? (
                <label className={ROTULO}>
                  Aluno
                  <StudentCombobox
                    alunos={alunos}
                    defaultValue={alunos.find((a) => a.id === alunoSelecionado)}
                    onSelect={(aluno) => filtrarPorAluno(aluno?.id ?? "")}
                  />
                </label>
              ) : (
                <>
                  <label className={ROTULO}>
                    Série
                    <select
                      value={serieSelecionada}
                      onChange={(e) => aplicarFiltro("serie", e.target.value)}
                      className={CAMPO}
                    >
                      <option value="">Todas as séries</option>
                      {series.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={ROTULO}>
                    Turma
                    <select
                      value={turmaSelecionada}
                      onChange={(e) => aplicarFiltro("turma", e.target.value)}
                      disabled={turmasDaSerie.length === 0}
                      className={`${CAMPO} disabled:opacity-50`}
                    >
                      <option value="">Todas as turmas</option>
                      {turmasDaSerie.map((t) => (
                        <option key={t.id} value={t.id}>
                          {rotuloTurma(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>

            {pendentes.length > 0 && parametros.mostrarHistorico && (
              <div className="rounded border border-line bg-muted p-3 text-sm">
                <p className="font-medium">Sem histórico cadastrado ({pendentes.length}):</p>
                <p className="text-muted">{pendentes.map((a) => a.nome).join(", ")}</p>
                <p className="mt-1 text-muted">
                  Com o histórico no verso ligado, estes alunos não entram na emissão. Cadastre na
                  entrada de notas ou desligue o verso na aba Conteúdo.
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
                        aria-label="Marcar todos"
                        checked={prontos.length > 0 && selecionados.length === prontos.length}
                        onChange={marcarTodos}
                      />
                    </th>
                    <th className="p-2">Aluno</th>
                    <th className="p-2">Histórico</th>
                  </tr>
                </thead>
                <tbody>
                  {elegiveis.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <td className="p-2">
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
                      <td className="p-2">{a.nome}</td>
                      <td className="p-2">{a.temHistorico ? "Pronto" : "Sem histórico"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {aba === "conteudo" && (
          <div className="grid gap-4 rounded-lg border border-line p-4">
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={parametros.mostrarHistorico}
                onChange={(e) =>
                  setParametros((p) => ({ ...p, mostrarHistorico: e.target.checked }))
                }
              />
              Imprimir o histórico escolar no verso
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={usarCustomizado}
                onChange={(e) => setUsarCustomizado(e.target.checked)}
              />
              Escrever o texto manualmente
            </label>

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
                <span className="text-xs text-muted">
                  Campos disponíveis: {"{{aluno}}"}, {"{{curso}}"}, {"{{ano}}"}, {"{{escola}}"},{" "}
                  {"{{serie}}"}, {"{{nascimento}}"}, {"{{naturalidade}}"}, {"{{nacionalidade}}"},{" "}
                  {"{{rg}}"}, {"{{filiacao}}"}.
                </span>
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
          </div>
        )}

        {aba === "leiaute" && (
          <div className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-2">
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

            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={parametros.leiaute.mostrarLogos}
                  onChange={(e) =>
                    setParametros((p) => ({
                      ...p,
                      leiaute: { ...p.leiaute, mostrarLogos: e.target.checked }
                    }))
                  }
                />
                Exibir logo
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={parametros.leiaute.mostrarMoldura}
                  onChange={(e) =>
                    setParametros((p) => ({
                      ...p,
                      leiaute: { ...p.leiaute, mostrarMoldura: e.target.checked }
                    }))
                  }
                />
                Exibir moldura
              </label>
            </div>
          </div>
        )}

        {aba === "assinatura" && (
          <div className="space-y-3 rounded-lg border border-line p-4">
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
                  onClick={() =>
                    setParametros((p) => ({
                      ...p,
                      assinaturas: p.assinaturas.filter((_, j) => j !== i)
                    }))
                  }
                  className="rounded border border-line px-3 text-sm text-muted hover:text-clay"
                >
                  Remover
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setParametros((p) => ({
                  ...p,
                  assinaturas: [...p.assinaturas, { nome: "", cargo: "" }]
                }))
              }
              className="rounded border border-line px-3 py-2 text-sm"
            >
              Adicionar assinatura
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={salvarPadrao}
            disabled={salvando}
            className="rounded border border-line px-4 py-2 text-sm disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar como padrão"}
          </button>

          <button
            type="button"
            onClick={() => emitir()}
            disabled={emitindo || selecionados.length === 0}
            className="rounded bg-brand px-4 py-2 text-sm text-paper disabled:opacity-50"
          >
            {emitindo ? "Emitindo…" : `Emitir selecionados (${selecionados.length})`}
          </button>

          {parametros.mostrarHistorico && pendentesSelecionados.length > 0 && (
            <button
              type="button"
              onClick={() => emitir(true)}
              disabled={emitindo}
              className="rounded border border-line px-4 py-2 text-sm disabled:opacity-50"
            >
              Emitir apenas os prontos (
              {selecionados.length - pendentesSelecionados.length})
            </button>
          )}
        </div>
      </div>

      <CertificadoPreview
        aluno={primeiroSelecionado ? dadosDoAluno(primeiroSelecionado) : null}
        historico={primeiroSelecionado ? historicos.get(primeiroSelecionado) ?? null : null}
        opts={opts}
      />
    </div>
  );
}
