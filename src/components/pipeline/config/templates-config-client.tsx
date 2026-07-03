"use client";

import { useState } from "react";
import { Plus, Pencil, Archive, MessageCircle, X } from "lucide-react";
import type { TemplateWpp } from "@/lib/actions/pipeline";
import {
  criarTemplateWppAction,
  editarTemplateWppAction,
  arquivarTemplateWppAction,
} from "@/lib/actions/pipeline";
import { FONTES_WPP, FONTES_WPP_LABEL, type FonteWpp } from "@/lib/validation/pipeline";

type Props = {
  templates: TemplateWpp[];
};

type FormState = {
  nome_template: string;
  descricao: string;
  variaveis_count: number;
  variaveis_fontes: FonteWpp[];
  ativo: boolean;
};

const DEFAULT_FORM: FormState = {
  nome_template: "",
  descricao: "",
  variaveis_count: 0,
  variaveis_fontes: [],
  ativo: true,
};

export function TemplatesConfigClient({ templates: initialTemplates }: Props) {
  const [templates, setTemplates] = useState<TemplateWpp[]>(initialTemplates);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrirCriar() {
    setForm(DEFAULT_FORM);
    setEditandoId(null);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEditar(t: TemplateWpp) {
    setForm({
      nome_template: t.nome_template,
      descricao: t.descricao,
      variaveis_count: t.variaveis_count,
      variaveis_fontes: [...t.variaveis_fontes],
      ativo: t.ativo,
    });
    setEditandoId(t.id);
    setErro(null);
    setModalAberto(true);
  }

  function setCount(n: number) {
    const count = Math.max(0, Math.min(10, n));
    const fontes = Array.from({ length: count }, (_, i) => form.variaveis_fontes[i] ?? "campo_livre") as FonteWpp[];
    setForm((f) => ({ ...f, variaveis_count: count, variaveis_fontes: fontes }));
  }

  function setFonte(i: number, fonte: FonteWpp) {
    const fontes = [...form.variaveis_fontes];
    fontes[i] = fonte;
    setForm((f) => ({ ...f, variaveis_fontes: fontes }));
  }

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    const input = { ...form };
    const result = editandoId
      ? await editarTemplateWppAction(editandoId, input)
      : await criarTemplateWppAction(input);
    setSalvando(false);
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    setModalAberto(false);
    window.location.reload();
  }

  async function handleArquivar(id: string) {
    const result = await arquivarTemplateWppAction(id);
    if (result.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  const ativos = templates.filter((t) => t.ativo);
  const arquivados = templates.filter((t) => !t.ativo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: "rgb(var(--color-success))" }} />
          <h2 className="text-base font-semibold" style={{ color: "rgb(var(--color-ink))" }}>
            Templates WhatsApp
          </h2>
        </div>
        <button
          onClick={abrirCriar}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: "rgb(var(--color-brand))", color: "#fff" }}
        >
          <Plus size={14} />
          Novo template
        </button>
      </div>

      {ativos.length === 0 ? (
        <p className="text-sm" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
          Nenhum template cadastrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {ativos.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
              style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface))" }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "rgb(var(--color-ink))" }}>
                  {t.descricao}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                  Template: <code>{t.nome_template}</code>
                  {" · "}
                  {t.variaveis_count} variável{t.variaveis_count !== 1 ? "is" : ""}
                </p>
                {t.variaveis_count > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Array.from({ length: t.variaveis_count }, (_, i) => (
                      <span
                        key={i}
                        className="text-[10px] rounded px-1.5 py-0.5"
                        style={{ background: "rgb(var(--color-muted))", color: "rgb(var(--color-ink) / 0.6)" }}
                      >
                        {`{{${i + 1}}}`} {FONTES_WPP_LABEL[t.variaveis_fontes[i] ?? "campo_livre"]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => abrirEditar(t)}
                  className="rounded p-1.5 hover:opacity-70"
                  style={{ color: "rgb(var(--color-ink) / 0.6)" }}
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleArquivar(t.id)}
                  className="rounded p-1.5 hover:opacity-70"
                  style={{ color: "rgb(var(--color-ink) / 0.6)" }}
                  title="Arquivar"
                >
                  <Archive size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {arquivados.length > 0 && (
        <details className="mt-4">
          <summary
            className="cursor-pointer text-xs"
            style={{ color: "rgb(var(--color-ink) / 0.6)" }}
          >
            Arquivados ({arquivados.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {arquivados.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded px-3 py-2 opacity-50"
                style={{ background: "rgb(var(--color-muted))" }}
              >
                <span className="text-sm line-through" style={{ color: "rgb(var(--color-ink))" }}>
                  {t.descricao}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setModalAberto(false)}
          />
          <div
            className="relative w-full max-w-md rounded-xl border shadow-xl"
            style={{
              borderColor: "rgb(var(--color-line))",
              background: "rgb(var(--color-surface))",
            }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: "rgb(var(--color-line))" }}>
              <h3 className="text-sm font-semibold" style={{ color: "rgb(var(--color-ink))" }}>
                {editandoId ? "Editar template" : "Novo template WhatsApp"}
              </h3>
              <button onClick={() => setModalAberto(false)}>
                <X size={14} style={{ color: "rgb(var(--color-ink) / 0.6)" }} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                  Descrição (rótulo na UI) *
                </label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  className="w-full rounded-md border px-3 py-1.5 text-sm"
                  style={{
                    borderColor: "rgb(var(--color-line))",
                    background: "rgb(var(--color-surface))",
                    color: "rgb(var(--color-ink))",
                  }}
                  placeholder="Ex: Boas-vindas ao novo interessado"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                  Nome do template Meta *
                </label>
                <input
                  type="text"
                  value={form.nome_template}
                  onChange={(e) => setForm((f) => ({ ...f, nome_template: e.target.value }))}
                  className="w-full rounded-md border px-3 py-1.5 text-sm font-mono"
                  style={{
                    borderColor: "rgb(var(--color-line))",
                    background: "rgb(var(--color-surface))",
                    color: "rgb(var(--color-ink))",
                  }}
                  placeholder="boas_vindas_escola"
                />
                <p className="text-[10px] mt-0.5" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                  Nome exato aprovado no Meta Business Manager.
                </p>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                  Quantidade de variáveis (0–10)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.variaveis_count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-24 rounded-md border px-3 py-1.5 text-sm"
                  style={{
                    borderColor: "rgb(var(--color-line))",
                    background: "rgb(var(--color-surface))",
                    color: "rgb(var(--color-ink))",
                  }}
                />
              </div>
              {form.variaveis_count > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: "rgb(var(--color-ink))" }}>
                    Fonte por variável
                  </p>
                  {Array.from({ length: form.variaveis_count }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs w-10" style={{ color: "rgb(var(--color-ink) / 0.6)" }}>
                        {`{{${i + 1}}}`}
                      </span>
                      <select
                        value={form.variaveis_fontes[i] ?? "campo_livre"}
                        onChange={(e) => setFonte(i, e.target.value as FonteWpp)}
                        className="flex-1 rounded border px-2 py-1 text-sm"
                        style={{
                          borderColor: "rgb(var(--color-line))",
                          background: "rgb(var(--color-surface))",
                          color: "rgb(var(--color-ink))",
                        }}
                      >
                        {FONTES_WPP.map((f) => (
                          <option key={f} value={f}>
                            {FONTES_WPP_LABEL[f]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              {erro && (
                <p className="text-xs" style={{ color: "rgb(var(--color-danger))" }}>
                  {erro}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3"
              style={{ borderColor: "rgb(var(--color-line))" }}>
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-md px-3 py-1.5 text-sm"
                style={{ color: "rgb(var(--color-ink) / 0.6)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando || !form.nome_template.trim() || !form.descricao.trim()}
                className="rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                style={{ background: "rgb(var(--color-brand))", color: "#fff" }}
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
