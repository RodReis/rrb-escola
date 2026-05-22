"use client";

import { useMemo, useRef, useState } from "react";
import { Send, Users, Layers, GraduationCap, Search, X, Megaphone } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { criarComunicadoAction } from "@/lib/actions/comunicados";

type AlunoLite = { id: string; nome: string };
type TurmaLite = { id: string; nome: string; anoLetivo: number; serieId: string; serieNome: string };
type SerieLite = { id: string; nome: string };

type CriterioAlvo = { tipo: "turma" | "serie"; id: string; nome: string };

export function NovoComunicadoForm({
  turmas,
  series,
}: {
  turmas: TurmaLite[];
  series: SerieLite[];
}) {
  const [enviando, setEnviando] = useState(false);

  // alunoId -> nome (acumula entre turmas/séries)
  const [selecionados, setSelecionados] = useState<Map<string, string>>(new Map());
  // critério que originou a seleção (turmas/séries adicionadas)
  const [criterio, setCriterio] = useState<CriterioAlvo[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);

  // alcance é decidido pelo botão clicado — guardado num hidden controlado.
  const [alcance, setAlcance] = useState<"geral" | "segmentado">("segmentado");
  const formRef = useRef<HTMLFormElement>(null);

  const alvos = {
    alunos: Array.from(selecionados.keys()),
    criterio,
  };
  const total = selecionados.size;

  const listaSelecionados = useMemo(() => {
    const arr = Array.from(selecionados.entries()).map(([id, nome]) => ({ id, nome }));
    arr.sort((a, b) => a.nome.localeCompare(b.nome));
    const termo = busca.trim().toLowerCase();
    return termo ? arr.filter((a) => a.nome.toLowerCase().includes(termo)) : arr;
  }, [selecionados, busca]);

  async function buscarAlunosTurma(turmaId: string): Promise<AlunoLite[]> {
    const res = await fetch(`/api/turmas/${turmaId}/alunos`);
    if (!res.ok) return [];
    return (await res.json()) as AlunoLite[];
  }

  function addCriterio(c: CriterioAlvo) {
    setCriterio((prev) =>
      prev.some((x) => x.tipo === c.tipo && x.id === c.id) ? prev : [...prev, c],
    );
  }

  // Adiciona todos os alunos de uma turma à seleção.
  async function adicionarTurma(turmaId: string) {
    const turma = turmas.find((t) => t.id === turmaId);
    if (!turma) return;
    setCarregando(true);
    try {
      const lista = await buscarAlunosTurma(turmaId);
      setSelecionados((prev) => {
        const novo = new Map(prev);
        for (const a of lista) novo.set(a.id, a.nome);
        return novo;
      });
      addCriterio({ tipo: "turma", id: turma.id, nome: `${turma.serieNome} ${turma.nome}` });
    } finally {
      setCarregando(false);
    }
  }

  // Adiciona todos os alunos de todas as turmas de uma série.
  async function adicionarSerie(serieId: string) {
    const serie = series.find((s) => s.id === serieId);
    if (!serie) return;
    const turmasDaSerie = turmas.filter((t) => t.serieId === serieId);
    if (turmasDaSerie.length === 0) return;
    setCarregando(true);
    try {
      const listas = await Promise.all(turmasDaSerie.map((t) => buscarAlunosTurma(t.id)));
      setSelecionados((prev) => {
        const novo = new Map(prev);
        for (const lista of listas) {
          for (const a of lista) novo.set(a.id, a.nome);
        }
        return novo;
      });
      addCriterio({ tipo: "serie", id: serie.id, nome: serie.nome });
    } finally {
      setCarregando(false);
    }
  }

  function removerAluno(id: string) {
    setSelecionados((prev) => {
      const novo = new Map(prev);
      novo.delete(id);
      return novo;
    });
  }

  function limparSelecao() {
    setSelecionados(new Map());
    setCriterio([]);
    setBusca("");
  }

  function submeter(modo: "geral" | "segmentado") {
    setAlcance(modo);
    setEnviando(true);
    // espera o estado do hidden atualizar antes de submeter
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <Panel className="grid gap-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
          <Megaphone size={18} />
        </span>
        <div>
          <h2 className="font-bold text-ink">Novo comunicado</h2>
          <p className="text-xs text-ink/55">Envie um aviso aos responsáveis via WhatsApp.</p>
        </div>
      </div>

      <form
        ref={formRef}
        action={criarComunicadoAction}
        encType="multipart/form-data"
        className="grid gap-5"
      >
        <input type="hidden" name="alcance" value={alcance} />
        <input type="hidden" name="alvos" value={JSON.stringify(alvos)} />

        {/* ── Conteúdo ── */}
        <section className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-ink">Título</span>
            <input type="text" name="titulo" required maxLength={120} placeholder="Ex: Reunião de pais" />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-ink">Mensagem</span>
            <textarea
              name="mensagem"
              required
              rows={5}
              maxLength={2000}
              placeholder="Escreva o comunicado…"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-ink">Imagem (opcional)</span>
            <input type="file" name="imagem" accept="image/png,image/jpeg,image/webp" />
            <span className="text-xs text-ink/55">PNG, JPG ou WEBP — máx 5MB.</span>
          </label>
        </section>

        {/* ── Destinatários ── */}
        <section className="grid gap-3 rounded-ui border border-line bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-bold text-ink">Destinatários</h3>
            <p className="text-xs text-ink/55">
              Adicione séries ou turmas inteiras — os alunos entram na lista abaixo, onde você
              pode revisar e remover. Ou use “Enviar para todos”.
            </p>
          </div>

          {/* seletores de série e turma */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Layers size={13} className="text-brand" /> Adicionar série inteira
              </span>
              <select
                value=""
                disabled={carregando}
                onChange={(e) => {
                  if (e.target.value) adicionarSerie(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">Selecione uma série…</option>
                {series.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <GraduationCap size={13} className="text-brand" /> Adicionar turma
              </span>
              <select
                value=""
                disabled={carregando}
                onChange={(e) => {
                  if (e.target.value) adicionarTurma(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">Selecione uma turma…</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.serieNome} {t.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* critério adicionado */}
          {criterio.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {criterio.map((c) => (
                <span
                  key={`${c.tipo}-${c.id}`}
                  className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2 py-0.5 text-[0.66rem] font-semibold text-brand"
                >
                  {c.tipo === "serie" ? <Layers size={10} /> : <GraduationCap size={10} />}
                  {c.nome}
                </span>
              ))}
            </div>
          )}

          {/* resumo + busca */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Users size={14} className="text-brand" />
              {total} aluno(s) selecionado(s)
            </span>
            {total > 0 && (
              <button
                type="button"
                onClick={limparSelecao}
                className="text-xs font-semibold text-danger"
              >
                Limpar seleção
              </button>
            )}
          </div>

          {total > 0 && (
            <>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/40"
                />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar aluno na lista…"
                  className="!pl-8"
                />
              </div>

              <ul className="grid max-h-64 gap-1 overflow-y-auto">
                {listaSelecionados.length === 0 ? (
                  <li className="py-3 text-center text-xs text-ink/45">
                    Nenhum aluno encontrado para “{busca}”.
                  </li>
                ) : (
                  listaSelecionados.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-ui bg-surface px-2.5 py-1.5 text-sm"
                    >
                      <span className="truncate text-ink">{a.nome}</span>
                      <button
                        type="button"
                        onClick={() => removerAluno(a.id)}
                        aria-label={`Remover ${a.nome}`}
                        className="shrink-0 text-ink/35 hover:text-danger"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}

          {carregando && <p className="text-xs text-ink/55">Carregando alunos…</p>}
        </section>

        {/* ── Ações ── */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={enviando}
            onClick={() => submeter("geral")}
            className="ds-button ds-button-secondary"
          >
            <Users size={14} /> Enviar para todos
          </button>
          <button
            type="button"
            disabled={enviando || total === 0}
            onClick={() => submeter("segmentado")}
            className="ds-button ds-button-primary"
          >
            <Send size={14} /> {enviando ? "Enviando…" : `Enviar (${total})`}
          </button>
        </div>
      </form>
    </Panel>
  );
}
