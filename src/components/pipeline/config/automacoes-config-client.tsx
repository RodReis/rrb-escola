"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Zap, Clock } from "lucide-react";
import type { Automacao } from "@/lib/actions/pipeline";
import {
  criarAutomacaoAction,
  editarAutomacaoAction,
  toggleAutomacaoAction,
  deletarAutomacaoAction,
} from "@/lib/actions/pipeline";
import {
  TIPOS_AUTOMACAO,
  AUTOMACAO_LABEL,
  AUTOMACAO_GATILHO,
  STATUS_LEAD,
  type TipoAutomacao,
} from "@/lib/validation/pipeline";

type Quadro = { id: string; nome: string };
type Coluna = { id: string; nome: string; quadro_id: string };
type Template = { id: string; descricao: string };
type Perfil = { id: string; nome: string };

type Props = {
  automacoes: Automacao[];
  quadros: Quadro[];
  colunas: Coluna[];
  templates: Template[];
  perfis: Perfil[];
};

type FormState = {
  tipo: TipoAutomacao;
  quadro_id: string;
  ativo: boolean;
  // params campos
  coluna_id: string;
  template_id: string;
  titulo: string;
  dias: string;
  due_em_dias: string;
  assigned_to: string;
  status_destino: string;
  de_coluna_id: string;
  para_coluna_id: string;
};

const DEFAULT_FORM: FormState = {
  tipo: "coluna_entrada_envia_template",
  quadro_id: "",
  ativo: true,
  coluna_id: "",
  template_id: "",
  titulo: "",
  dias: "3",
  due_em_dias: "",
  assigned_to: "",
  status_destino: "em_analise",
  de_coluna_id: "",
  para_coluna_id: "",
};

function buildParams(form: FormState): Record<string, unknown> {
  switch (form.tipo) {
    case "card_parado_cria_tarefa":
      return {
        dias: form.dias ? Number(form.dias) : undefined,
        titulo: form.titulo,
        assigned_to: form.assigned_to || undefined,
      };
    case "coluna_entrada_envia_template":
      return { coluna_id: form.coluna_id, template_id: form.template_id };
    case "coluna_entrada_cria_tarefa":
      return {
        coluna_id: form.coluna_id,
        titulo: form.titulo,
        due_em_dias: form.due_em_dias ? Number(form.due_em_dias) : undefined,
        assigned_to: form.assigned_to || undefined,
      };
    case "coluna_entrada_solicita_dado":
      return { coluna_id: form.coluna_id, campo: form.titulo, label: form.titulo, obrigatorio: true };
    case "coluna_entrada_muda_status":
      return { coluna_id: form.coluna_id, status_destino: form.status_destino };
    case "entrada_etapa_final_boas_vindas":
      return { template_id: form.template_id };
    case "mover_card_condicional":
      return { de_coluna_id: form.de_coluna_id, para_coluna_id: form.para_coluna_id };
    default:
      return {};
  }
}

function formFromAutomacao(a: Automacao): FormState {
  const p = a.params;
  return {
    tipo: a.tipo,
    quadro_id: a.quadro_id ?? "",
    ativo: a.ativo,
    coluna_id: (p.coluna_id as string) ?? "",
    template_id: (p.template_id as string) ?? "",
    titulo: ((p.titulo as string) ?? (p.campo as string)) ?? "",
    dias: p.dias ? String(p.dias) : "3",
    due_em_dias: p.due_em_dias ? String(p.due_em_dias) : "",
    assigned_to: (p.assigned_to as string) ?? "",
    status_destino: (p.status_destino as string) ?? "em_analise",
    de_coluna_id: (p.de_coluna_id as string) ?? "",
    para_coluna_id: (p.para_coluna_id as string) ?? "",
  };
}

function descricaoAutomacao(a: Automacao, colunas: Coluna[], templates: Template[]): string {
  const p = a.params;
  const nomeColuna = (id: string) => colunas.find((c) => c.id === id)?.nome ?? id;
  const nomeTemplate = (id: string) => templates.find((t) => t.id === id)?.descricao ?? id;
  switch (a.tipo) {
    case "card_parado_cria_tarefa":
      return `Tarefa "${p.titulo}" após ${p.dias ?? "prazo da coluna"} dias parado`;
    case "coluna_entrada_envia_template":
      return `Ao entrar em "${nomeColuna(p.coluna_id as string)}" → template "${nomeTemplate(p.template_id as string)}"`;
    case "coluna_entrada_cria_tarefa":
      return `Ao entrar em "${nomeColuna(p.coluna_id as string)}" → tarefa "${p.titulo}"`;
    case "coluna_entrada_solicita_dado":
      return `Ao entrar em "${nomeColuna(p.coluna_id as string)}" → solicitar "${p.campo}"`;
    case "coluna_entrada_muda_status":
      return `Ao entrar em "${nomeColuna(p.coluna_id as string)}" → status "${p.status_destino}"`;
    case "entrada_etapa_final_boas_vindas":
      return `Ao atingir etapa final → template "${nomeTemplate(p.template_id as string)}"`;
    case "mover_card_condicional":
      return `Mover de "${nomeColuna(p.de_coluna_id as string)}" para "${nomeColuna(p.para_coluna_id as string)}"`;
    default:
      return a.tipo;
  }
}

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo", em_analise: "Em análise", reserva: "Reserva",
  convertido: "Convertido", perdido: "Perdido",
};

export function AutomacoesConfigClient({ automacoes: init, quadros, colunas, templates, perfis }: Props) {
  const [automacoes, setAutomacoes] = useState<Automacao[]>(init);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function abrirCriar() {
    setForm(DEFAULT_FORM);
    setEditandoId(null);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(a: Automacao) {
    setForm(formFromAutomacao(a));
    setEditandoId(a.id);
    setErro(null);
    setModalAberto(true);
  }

  function handleSalvar() {
    startTransition(async () => {
      setErro(null);
      const input = { tipo: form.tipo, quadro_id: form.quadro_id || null, ativo: form.ativo, params: buildParams(form) };
      const result = editandoId
        ? await editarAutomacaoAction(editandoId, input)
        : await criarAutomacaoAction(input);
      if (!result.ok) { setErro(result.error); return; }
      setModalAberto(false);
      window.location.reload();
    });
  }

  function handleToggle(a: Automacao) {
    startTransition(async () => {
      const result = await toggleAutomacaoAction(a.id, !a.ativo);
      if (result.ok) {
        setAutomacoes((prev) => prev.map((x) => x.id === a.id ? { ...x, ativo: !a.ativo } : x));
      }
    });
  }

  function handleDeletar(id: string) {
    startTransition(async () => {
      const result = await deletarAutomacaoAction(id);
      if (result.ok) setAutomacoes((prev) => prev.filter((x) => x.id !== id));
    });
  }

  const colunasDoQuadro = form.quadro_id
    ? colunas.filter((c) => c.quadro_id === form.quadro_id)
    : colunas;

  const precisaColuna = [
    "coluna_entrada_envia_template",
    "coluna_entrada_cria_tarefa",
    "coluna_entrada_solicita_dado",
    "coluna_entrada_muda_status",
  ].includes(form.tipo);

  const precisaTemplate = ["coluna_entrada_envia_template", "entrada_etapa_final_boas_vindas"].includes(form.tipo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} style={{ color: "rgb(var(--color-warning))" }} />
          <h2 className="text-base font-semibold" style={{ color: "rgb(var(--color-ink))" }}>
            Automações
          </h2>
        </div>
        <button
          onClick={abrirCriar}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: "rgb(var(--color-brand))", color: "#fff" }}
        >
          <Plus size={14} />
          Nova automação
        </button>
      </div>

      {automacoes.length === 0 ? (
        <p className="text-sm" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
          Nenhuma automação configurada.
        </p>
      ) : (
        <ul className="space-y-2">
          {automacoes.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
              style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", opacity: a.ativo ? 1 : 0.55 }}
            >
              <div className="flex items-start gap-2 min-w-0">
                {AUTOMACAO_GATILHO[a.tipo] === "tempo"
                  ? <Clock size={13} className="mt-0.5 shrink-0" style={{ color: "rgb(var(--color-warning))" }} />
                  : <Zap size={13} className="mt-0.5 shrink-0" style={{ color: "rgb(var(--color-brand))" }} />
                }
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                    {AUTOMACAO_LABEL[a.tipo]}
                  </p>
                  <p className="text-sm mt-0.5 truncate" style={{ color: "rgb(var(--color-ink))" }}>
                    {descricaoAutomacao(a, colunas, templates)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(a)}
                  disabled={isPending}
                  title={a.ativo ? "Desativar" : "Ativar"}
                  className="rounded px-2 py-1 text-[10px] font-medium border"
                  style={{
                    borderColor: a.ativo ? "rgb(var(--color-success))" : "rgb(var(--color-line))",
                    color: a.ativo ? "rgb(var(--color-success))" : "rgb(var(--color-ink) / 0.6)",
                  }}
                >
                  {a.ativo ? "Ativo" : "Inativo"}
                </button>
                <button
                  onClick={() => abrirEditar(a)}
                  className="rounded p-1.5 hover:opacity-70"
                  style={{ color: "rgb(var(--color-ink) / 0.6)" }}
                  title="Editar"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDeletar(a.id)}
                  disabled={isPending}
                  className="rounded p-1.5 hover:opacity-70"
                  style={{ color: "rgb(var(--color-danger))" }}
                  title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalAberto(false)} />
          <div
            className="relative w-full max-w-lg rounded-xl border shadow-xl overflow-y-auto max-h-[90vh]"
            style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))" }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgb(var(--color-line))" }}>
              <h3 className="text-sm font-semibold" style={{ color: "rgb(var(--color-ink))" }}>
                {editandoId ? "Editar automação" : "Nova automação"}
              </h3>
              <button onClick={() => setModalAberto(false)}>
                <X size={14} style={{ color: "rgb(var(--color-ink) / 0.6)" }} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={(e) => set("tipo", e.target.value as TipoAutomacao)}
                  className="w-full rounded-md border px-3 py-1.5 text-sm"
                  style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                >
                  {TIPOS_AUTOMACAO.map((t) => (
                    <option key={t} value={t}>{AUTOMACAO_LABEL[t]}</option>
                  ))}
                </select>
              </div>

              {/* Quadro (opcional) */}
              {quadros.length > 0 && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Quadro (deixe vazio para todos)</label>
                  <select
                    value={form.quadro_id}
                    onChange={(e) => { set("quadro_id", e.target.value); set("coluna_id", ""); }}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                  >
                    <option value="">Todos os quadros</option>
                    {quadros.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
                  </select>
                </div>
              )}

              {/* Coluna (quando aplicável) */}
              {precisaColuna && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Coluna *</label>
                  <select
                    value={form.coluna_id}
                    onChange={(e) => set("coluna_id", e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                  >
                    <option value="">Selecione…</option>
                    {colunasDoQuadro.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}

              {/* Template */}
              {precisaTemplate && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Template WhatsApp *</label>
                  <select
                    value={form.template_id}
                    onChange={(e) => set("template_id", e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                  >
                    <option value="">Selecione…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
                  </select>
                </div>
              )}

              {/* Título da tarefa */}
              {["card_parado_cria_tarefa", "coluna_entrada_cria_tarefa", "coluna_entrada_solicita_dado"].includes(form.tipo) && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                    {form.tipo === "coluna_entrada_solicita_dado" ? "Campo a solicitar *" : "Título da tarefa *"}
                  </label>
                  <input
                    type="text"
                    value={form.titulo}
                    onChange={(e) => set("titulo", e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                  />
                </div>
              )}

              {/* Dias (card_parado) */}
              {form.tipo === "card_parado_cria_tarefa" && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                    Dias parado antes de acionar (mín. 2; deixe vazio para usar prazo da coluna)
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={form.dias}
                    onChange={(e) => set("dias", e.target.value)}
                    className="w-24 rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                  />
                </div>
              )}

              {/* Due em dias (cria_tarefa) */}
              {form.tipo === "coluna_entrada_cria_tarefa" && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Prazo em dias (opcional)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.due_em_dias}
                    onChange={(e) => set("due_em_dias", e.target.value)}
                    className="w-24 rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                  />
                </div>
              )}

              {/* Responsável (tarefas) */}
              {["card_parado_cria_tarefa", "coluna_entrada_cria_tarefa"].includes(form.tipo) && perfis.length > 0 && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Responsável pela tarefa (opcional)</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => set("assigned_to", e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                  >
                    <option value="">Sem responsável</option>
                    {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}

              {/* Status destino */}
              {form.tipo === "coluna_entrada_muda_status" && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Status destino *</label>
                  <select
                    value={form.status_destino}
                    onChange={(e) => set("status_destino", e.target.value)}
                    className="w-full rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                  >
                    {STATUS_LEAD.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
                  </select>
                </div>
              )}

              {/* Mover condicional */}
              {form.tipo === "mover_card_condicional" && (
                <>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Da coluna *</label>
                    <select
                      value={form.de_coluna_id}
                      onChange={(e) => set("de_coluna_id", e.target.value)}
                      className="w-full rounded-md border px-3 py-1.5 text-sm"
                      style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                    >
                      <option value="">Selecione…</option>
                      {colunasDoQuadro.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>Para a coluna *</label>
                    <select
                      value={form.para_coluna_id}
                      onChange={(e) => set("para_coluna_id", e.target.value)}
                      className="w-full rounded-md border px-3 py-1.5 text-sm"
                      style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))", color: "rgb(var(--color-ink))" }}
                    >
                      <option value="">Selecione…</option>
                      {colunasDoQuadro.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </>
              )}

              {erro && <p className="text-xs" style={{ color: "rgb(var(--color-danger))" }}>{erro}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: "rgb(var(--color-line))" }}>
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-md px-3 py-1.5 text-sm"
                style={{ color: "rgb(var(--color-ink) / 0.6)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={isPending}
                className="rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                style={{ background: "rgb(var(--color-brand))", color: "#fff" }}
              >
                {isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
