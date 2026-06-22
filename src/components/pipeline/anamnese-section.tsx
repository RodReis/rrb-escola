"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Paperclip, Trash2, Upload, AlertTriangle, CheckCircle, RotateCcw, Clock } from "lucide-react";
import {
  getAnamnese,
  salvarAnamnese,
  mudarStatusAnamnese,
  uploadAnamneseArquivo,
  getAnamneseArquivoUrl,
  deletarAnamneseArquivo,
  type Anamnese,
  type AnamneseArquivo,
} from "@/lib/actions/pipeline-anamnese";
import type { StatusAnamnese } from "@/lib/validation/pipeline";
import { cn } from "@/lib/utils";
import {
  AnamneseFields,
  emptyAnamneseForm,
  anamneseToForm,
  type AnamneseFormState,
} from "./anamnese-fields";

type Props = {
  cardId: string;
  podeAcessar: boolean;
};

const STATUS_LABEL: Record<StatusAnamnese, string> = {
  nao_iniciada: "Não iniciada",
  enviada: "Enviada",
  pendente: "Pendente",
  em_analise: "Em análise",
  concluida: "Concluída",
  requer_atencao: "Requer atenção",
};

const STATUS_COLOR: Record<StatusAnamnese, string> = {
  nao_iniciada: "bg-[rgb(var(--color-muted))] text-[rgb(var(--color-ink)/0.6)]",
  enviada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  pendente: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  em_analise: "bg-[rgb(var(--color-brand)/0.12)] text-[rgb(var(--color-brand))]",
  concluida: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  requer_atencao: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function AnamneseSection({ cardId, podeAcessar }: Props) {
  const [aberta, setAberta] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const [anamnese, setAnamnese] = useState<Anamnese | null>(null);
  const [arquivos, setArquivos] = useState<AnamneseArquivo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Consentimento
  const [consentimentoEm, setConsentimentoEm] = useState(
    new Date().toISOString().slice(0, 16),
  );

  // Form principal
  const [form, setForm] = useState<AnamneseFormState>(emptyAnamneseForm());
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  function setField<K extends keyof AnamneseFormState>(key: K, val: AnamneseFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setSavedOk(false);
  }

  function abrirSecao() {
    setAberta(true);
    if (carregou) return;
    startTransition(async () => {
      const res = await getAnamnese(cardId);
      setCarregou(true);
      if (!res.ok) { setErro(res.error); return; }
      setAnamnese(res.data.anamnese);
      setArquivos(res.data.arquivos);
      if (res.data.anamnese) {
        const a = res.data.anamnese;
        setForm(anamneseToForm(a));
        if (a.consentimento_em) {
          setConsentimentoEm(a.consentimento_em.slice(0, 16));
        }
      }
    });
  }

  function toggleSecao() {
    if (!aberta) { abrirSecao(); } else { setAberta(false); }
  }

  async function handleRegistrarConsentimento() {
    setErroSalvar(null);
    const res = await salvarAnamnese({
      card_id: cardId,
      consentimento_em: new Date(consentimentoEm).toISOString(),
      termo_versao: "v1",
    });
    if (!res.ok) { setErroSalvar(res.error); return; }
    // Recarrega
    const reload = await getAnamnese(cardId);
    if (reload.ok) {
      setAnamnese(reload.data.anamnese);
      setArquivos(reload.data.arquivos);
    }
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
    // Atualiza status local se necessário
    const reload = await getAnamnese(cardId);
    if (reload.ok) setAnamnese(reload.data.anamnese);
  }

  async function handleMudarStatus(novo: "em_analise" | "concluida" | "requer_atencao") {
    const res = await mudarStatusAnamnese({ card_id: cardId, novo_status: novo });
    if (!res.ok) { setErroSalvar(res.error); return; }
    const reload = await getAnamnese(cardId);
    if (reload.ok) setAnamnese(reload.data.anamnese);
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

  const status = anamnese?.status as StatusAnamnese | undefined;

  return (
    <section>
      <button
        type="button"
        onClick={toggleSecao}
        className="flex w-full items-center justify-between mb-2"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
          Anamnese
        </h4>
        <span className="text-[rgb(var(--color-ink)/0.35)]">
          {aberta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {aberta && (
        <div className="space-y-4 text-sm">
          {!podeAcessar && (
            <p className="text-xs text-[rgb(var(--color-ink)/0.5)]">
              Sem acesso a dados sensíveis.
            </p>
          )}

          {podeAcessar && isPending && !carregou && (
            <p className="text-xs text-[rgb(var(--color-ink)/0.4)] animate-pulse">
              Carregando…
            </p>
          )}

          {podeAcessar && carregou && erro && (
            <p className="text-xs text-[rgb(var(--color-danger))]">{erro}</p>
          )}

          {podeAcessar && carregou && !erro && (
            <>
              {/* Badge de status + transições */}
              {status && status !== "nao_iniciada" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("rounded px-2 py-0.5 text-xs font-medium", STATUS_COLOR[status])}>
                    {STATUS_LABEL[status]}
                  </span>
                  {status === "em_analise" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMudarStatus("concluida")}
                        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs border border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <CheckCircle size={11} /> Concluir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMudarStatus("requer_atencao")}
                        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs border border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <AlertTriangle size={11} /> Requer atenção
                      </button>
                    </>
                  )}
                  {status === "concluida" && (
                    <button
                      type="button"
                      onClick={() => handleMudarStatus("requer_atencao")}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs border border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <AlertTriangle size={11} /> Requer atenção
                    </button>
                  )}
                  {status === "requer_atencao" && (
                    <button
                      type="button"
                      onClick={() => handleMudarStatus("em_analise")}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs border border-[rgb(var(--color-brand))] text-[rgb(var(--color-brand))] hover:bg-[rgb(var(--color-brand)/0.06)]"
                    >
                      <RotateCcw size={11} /> Retomar análise
                    </button>
                  )}
                </div>
              )}

              {/* Bloco de consentimento LGPD */}
              {!anamnese?.consentimento_em ? (
                <div className="rounded-lg border border-[rgb(var(--color-line))] bg-[rgb(var(--color-muted)/0.4)] p-3 space-y-2">
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
                      className="rounded border border-[rgb(var(--color-line))] px-2 py-0.5 text-xs bg-[rgb(var(--color-surface))] text-[rgb(var(--color-ink))]"
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
                  <p className="text-xs text-[rgb(var(--color-ink)/0.45)]">
                    <Clock size={11} className="inline mr-1" />
                    Consentimento em{" "}
                    {new Date(anamnese.consentimento_em).toLocaleDateString("pt-BR")}
                    {" · "} Termo {anamnese.termo_versao ?? "v1"}
                  </p>

                  {/* Formulário de anamnese (campos compartilhados) */}
                  <AnamneseFields form={form} onChange={setField} />

                  {erroSalvar && (
                    <p className="text-xs text-[rgb(var(--color-danger))]">{erroSalvar}</p>
                  )}
                  {savedOk && (
                    <p className="text-xs text-green-600 dark:text-green-400">Salvo com sucesso</p>
                  )}

                  <button
                    type="button"
                    onClick={handleSalvar}
                    disabled={isPending}
                    className="rounded-md bg-[rgb(var(--color-brand))] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Salvar anamnese
                  </button>

                  {/* Anexos */}
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-[rgb(var(--color-ink)/0.5)] uppercase tracking-wide mb-1">
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
                          className="flex items-center gap-1 text-xs text-[rgb(var(--color-brand))] hover:underline truncate max-w-[180px]"
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
      )}
    </section>
  );
}
