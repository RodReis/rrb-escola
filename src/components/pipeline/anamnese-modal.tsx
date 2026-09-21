"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Paperclip, Trash2, Upload, Clock } from "lucide-react";
import {
  getAnamnese,
  salvarAnamnese,
  uploadAnamneseArquivo,
  getAnamneseArquivoUrl,
  deletarAnamneseArquivo,
  type Anamnese,
  type AnamneseArquivo,
} from "@/lib/actions/pipeline-anamnese";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  AnamneseFields,
  emptyAnamneseForm,
  anamneseToForm,
  type AnamneseFormState,
} from "./anamnese-fields";

type Props = {
  cardId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AnamneseModal({ cardId, onClose, onSaved }: Props) {
  const confirm = useConfirm();
  const [carregou, setCarregou] = useState(false);
  const [anamnese, setAnamnese] = useState<Anamnese | null>(null);
  const [arquivos, setArquivos] = useState<AnamneseArquivo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [consentimentoEm, setConsentimentoEm] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [form, setForm] = useState<AnamneseFormState>(emptyAnamneseForm());
  const [dirty, setDirty] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  function setField<K extends keyof AnamneseFormState>(key: K, val: AnamneseFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setSavedOk(false);
    setDirty(true);
  }

  // Carrega ao abrir
  useEffect(() => {
    startTransition(async () => {
      const res = await getAnamnese(cardId);
      setCarregou(true);
      if (!res.ok) { setErro(res.error); return; }
      setAnamnese(res.data.anamnese);
      setArquivos(res.data.arquivos);
      if (res.data.anamnese) {
        const a = res.data.anamnese;
        setForm(anamneseToForm(a));
        if (a.consentimento_em) setConsentimentoEm(a.consentimento_em.slice(0, 16));
      }
    });
  }, [cardId]);

  // Fecha com Esc (passa pelo guard de unsaved)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void tentarFechar();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  async function tentarFechar() {
    if (dirty) {
      const ok = await confirm({
        title: "Descartar alterações?",
        message: "Há alterações não salvas na anamnese. Deseja sair sem salvar?",
        confirmLabel: "Sair sem salvar",
        cancelLabel: "Continuar editando",
        variant: "warning",
      });
      if (!ok) return;
    }
    onClose();
  }

  async function handleRegistrarConsentimento() {
    setErroSalvar(null);
    const res = await salvarAnamnese({
      card_id: cardId,
      consentimento_em: new Date(consentimentoEm).toISOString(),
      termo_versao: "v1",
    });
    if (!res.ok) { setErroSalvar(res.error); return; }
    const reload = await getAnamnese(cardId);
    if (reload.ok) {
      setAnamnese(reload.data.anamnese);
      setArquivos(reload.data.arquivos);
    }
    onSaved();
  }

  async function handleSalvar() {
    if (!anamnese?.consentimento_em) {
      setErroSalvar("Registre o consentimento LGPD antes de salvar");
      return;
    }
    setErroSalvar(null);
    const res = await salvarAnamnese({
      card_id: cardId,
      consentimento_em: anamnese.consentimento_em,
      termo_versao: anamnese.termo_versao ?? "v1",
      ...form,
    });
    if (!res.ok) { setErroSalvar(res.error); return; }
    setSavedOk(true);
    setDirty(false);
    const reload = await getAnamnese(cardId);
    if (reload.ok) setAnamnese(reload.data.anamnese);
    onSaved();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadAnamneseArquivo(cardId, fd);
    if (!res.ok) { setErroSalvar(res.error); return; }
    const reload = await getAnamnese(cardId);
    if (reload.ok) setArquivos(reload.data.arquivos);
    e.target.value = "";
  }

  async function handleDownload(arquivo: AnamneseArquivo) {
    const res = await getAnamneseArquivoUrl(arquivo.id);
    if (!res.ok) { setErroSalvar(res.error); return; }
    window.open(res.data.url, "_blank");
  }

  async function handleDeletarArquivo(id: string) {
    const res = await deletarAnamneseArquivo(id);
    if (!res.ok) { setErroSalvar(res.error); return; }
    setArquivos((prev) => prev.filter((a) => a.id !== id));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void tentarFechar();
      }}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Responder anamnese"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgb(var(--color-line))] px-5 py-4">
          <p className="text-sm font-semibold text-[rgb(var(--color-ink))]">Anamnese</p>
          <button
            type="button"
            onClick={() => void tentarFechar()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--color-ink)/0.4)] hover:bg-[rgb(var(--color-muted))]"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Corpo com scroll próprio */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {isPending && !carregou && (
            <p className="text-xs text-[rgb(var(--color-ink)/0.4)] animate-pulse">Carregando…</p>
          )}
          {carregou && erro && (
            <p className="text-xs text-[rgb(var(--color-danger))]">{erro}</p>
          )}

          {carregou && !erro && (
            <>
              {!anamnese?.consentimento_em ? (
                <div className="space-y-2 rounded-lg border border-[rgb(var(--color-line))] bg-[rgb(var(--color-muted)/0.4)] p-3">
                  <p className="text-xs font-medium text-[rgb(var(--color-ink))]">
                    Consentimento LGPD obrigatório
                  </p>
                  <p className="text-xs text-[rgb(var(--color-ink)/0.6)]">
                    Registre o consentimento do responsável antes de preencher a anamnese.
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[rgb(var(--color-ink)/0.55)]">Data:</label>
                    <input
                      type="datetime-local"
                      value={consentimentoEm}
                      onChange={(e) => setConsentimentoEm(e.target.value)}
                      className="rounded border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-0.5 text-xs text-[rgb(var(--color-ink))]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRegistrarConsentimento}
                    disabled={isPending}
                    className="rounded-md bg-[rgb(var(--color-brand))] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Registrar consentimento e iniciar
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs text-[rgb(var(--color-ink)/0.45)]">
                    <Clock size={11} className="mr-1 inline" />
                    Consentimento em{" "}
                    {new Date(anamnese.consentimento_em).toLocaleDateString("pt-BR")}
                    {" · "} Termo {anamnese.termo_versao ?? "v1"}
                  </p>

                  <AnamneseFields form={form} onChange={setField} />

                  {/* Anexos */}
                  <div className="mt-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.5)]">
                      Anexos
                    </p>
                    {arquivos.length === 0 && (
                      <p className="text-xs text-[rgb(var(--color-ink)/0.4)]">Nenhum anexo</p>
                    )}
                    {arquivos.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 py-1">
                        <button
                          type="button"
                          onClick={() => handleDownload(a)}
                          className="flex max-w-[220px] items-center gap-1 truncate text-xs text-[rgb(var(--color-brand))] hover:underline"
                        >
                          <Paperclip size={11} />
                          {a.nome}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletarArquivo(a.id)}
                          className="shrink-0 text-[rgb(var(--color-danger)/0.6)] hover:text-[rgb(var(--color-danger))]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <label className="mt-2 flex cursor-pointer items-center gap-1 text-xs text-[rgb(var(--color-ink)/0.55)] hover:text-[rgb(var(--color-brand))]">
                      <Upload size={12} />
                      Enviar arquivo (PDF ou imagem, máx 10MB)
                      <input type="file" className="sr-only" accept=".pdf,image/*" onChange={handleUpload} />
                    </label>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Rodapé fixo com ações */}
        {carregou && !erro && anamnese?.consentimento_em && (
          <div className="flex items-center justify-between gap-2 border-t border-[rgb(var(--color-line))] px-5 py-3">
            <div className="min-h-[1rem] text-xs">
              {erroSalvar && <span className="text-[rgb(var(--color-danger))]">{erroSalvar}</span>}
              {savedOk && <span className="text-green-600 dark:text-green-400">Salvo com sucesso</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void tentarFechar()}
                className="rounded-md px-3 py-1.5 text-xs text-[rgb(var(--color-ink)/0.6)] hover:bg-[rgb(var(--color-muted))]"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={isPending}
                className="rounded-md bg-[rgb(var(--color-brand))] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Salvar anamnese
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
