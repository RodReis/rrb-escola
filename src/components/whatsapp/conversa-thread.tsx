"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ConversaResumo, MensagemThread } from "@/lib/data/inbox";
import type { TemplateWpp } from "@/lib/actions/pipeline";
import { getTemplatesWhatsapp } from "@/lib/actions/pipeline";
import { VinculoChip } from "./vinculo-chip";
import {
  responderTextoAction,
  responderImagemAction,
  responderTemplateAction,
  atribuirConversaAction,
  arquivarConversaAction,
} from "@/lib/actions/whatsapp-inbox";
import { Send, Paperclip, X, Archive, UserCheck } from "lucide-react";

type Props = {
  conversa: ConversaResumo | null;
  mensagens: MensagemThread[];
  carregando: boolean;
  onEnviado: () => void;
  onAtribuido: (perfilId: string | null) => void;
};

/** Verifica se a janela de 24h do WhatsApp está aberta (sem importar node:crypto). */
function janelaAberta(janelaExpiraEm: string | null, agora: Date): boolean {
  if (!janelaExpiraEm) return false;
  return new Date(janelaExpiraEm).getTime() > agora.getTime();
}

function formatHoraMsg(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Balao({ msg }: { msg: MensagemThread }) {
  const isSaida = msg.direcao === "saida";
  return (
    <div
      className={`flex ${isSaida ? "justify-end" : "justify-start"} mb-2 px-4`}
    >
      <div
        className="max-w-[70%] rounded-[var(--r-md)] px-3 py-2 text-[13px] shadow-[var(--shadow-xs)]"
        style={{
          background: isSaida
            ? "color-mix(in oklab, var(--brand-600) 15%, var(--surface))"
            : "var(--surface)",
          color: "var(--text)",
          borderBottomRightRadius: isSaida ? "var(--r-xs)" : undefined,
          borderBottomLeftRadius: !isSaida ? "var(--r-xs)" : undefined,
        }}
      >
        {msg.tipo === "imagem" && msg.midia_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={msg.midia_url}
            alt="Imagem"
            className="mb-1 max-h-48 w-auto rounded-[var(--r-sm)] object-cover"
          />
        )}
        {msg.texto && (
          <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
        )}
        {msg.tipo === "template" && !msg.texto && (
          <p className="italic" style={{ color: "var(--text-muted)" }}>
            Template enviado
          </p>
        )}
        <div
          className="mt-0.5 text-right text-[10px]"
          style={{ color: "var(--text-faint)" }}
        >
          {formatHoraMsg(msg.created_at)}
          {isSaida && msg.status === "enviada" && " ✓"}
          {isSaida && msg.status === "falha" && (
            <span style={{ color: "var(--bad)" }}> ✗</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateSelector({
  conversaId,
  onEnviado,
}: {
  conversaId: string;
  onEnviado: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateWpp[]>([]);
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    void getTemplatesWhatsapp().then((r) => {
      if (r.ok && r.data) setTemplates(r.data);
    });
  }, []);

  const enviarTemplate = async () => {
    if (!templateId) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await responderTemplateAction(conversaId, templateId, []);
      if (r.ok) {
        setTemplateId("");
        onEnviado();
      } else {
        setErro(r.error);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-xs">
      {erro && (
        <span className="text-[11px]" style={{ color: "var(--bad)" }}>
          {erro}
        </span>
      )}
      <select
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
        disabled={enviando}
        className="w-full rounded-[var(--r-sm)] border px-2.5 py-1.5 text-[12px] outline-none"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
        }}
      >
        <option value="">Selecione um template...</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.descricao}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void enviarTemplate()}
        disabled={enviando || !templateId}
        className="rounded-[var(--r-pill)] px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ background: "var(--brand-600)" }}
      >
        {enviando ? "Enviando..." : "Enviar template"}
      </button>
    </div>
  );
}

function CaixaEnvio({
  conversaId,
  janelaOk,
  onEnviado,
}: {
  conversaId: string;
  janelaOk: boolean;
  onEnviado: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const enviarTexto = useCallback(async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await responderTextoAction(conversaId, texto.trim());
      if (r.ok) {
        setTexto("");
        onEnviado();
      } else {
        setErro(r.error);
      }
    } finally {
      setEnviando(false);
    }
  }, [conversaId, texto, enviando, onEnviado]);

  const enviarImagem = useCallback(async () => {
    if (!uploadFile || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("conversa_id", conversaId);
      const upRes = await fetch("/api/whatsapp/upload", {
        method: "POST",
        body: fd,
      });
      if (!upRes.ok) {
        const body = (await upRes.json()) as { error?: string };
        setErro(body.error ?? "Falha no upload");
        return;
      }
      const { url } = (await upRes.json()) as { url: string };
      const legenda = texto.trim() || undefined;
      const r = await responderImagemAction(conversaId, url, legenda);
      if (r.ok) {
        setTexto("");
        setUploadFile(null);
        onEnviado();
      } else {
        setErro(r.error);
      }
    } finally {
      setEnviando(false);
    }
  }, [conversaId, uploadFile, texto, enviando, onEnviado]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviarTexto();
    }
  };

  if (!janelaOk) {
    return (
      <div
        className="flex flex-col items-center gap-2 border-t px-4 py-4 text-center text-[13px]"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>
          ⏰ Janela de 24h fechada — somente templates
        </span>
        <TemplateSelector conversaId={conversaId} onEnviado={onEnviado} />
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 border-t"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {uploadFile && (
        <div
          className="flex items-center gap-2 border-b px-4 py-2 text-[12px]"
          style={{
            borderColor: "var(--border-soft)",
            color: "var(--text-soft)",
          }}
        >
          <span className="truncate">📎 {uploadFile.name}</span>
          <button
            type="button"
            onClick={() => setUploadFile(null)}
            className="ml-auto shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {erro && (
        <div
          className="px-4 py-1 text-[12px]"
          style={{
            color: "var(--bad)",
            background:
              "color-mix(in oklab, var(--bad) 8%, var(--surface))",
          }}
        >
          {erro}
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Anexar imagem"
          disabled={enviando}
          className="shrink-0 rounded-[var(--r-sm)] p-1.5 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setUploadFile(f);
            e.target.value = "";
          }}
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem... (Enter envia)"
          rows={1}
          className="flex-1 resize-none rounded-[var(--r-md)] border px-3 py-2 text-[13px] outline-none"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--text)",
            maxHeight: 120,
          }}
        />
        <button
          type="button"
          onClick={
            uploadFile
              ? () => void enviarImagem()
              : () => void enviarTexto()
          }
          disabled={enviando || (!texto.trim() && !uploadFile)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:opacity-50"
          style={{ background: "var(--brand-600)" }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

export function ConversaThread({
  conversa,
  mensagens,
  carregando,
  onEnviado,
  onAtribuido,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [arquivando, setArquivando] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [mostrarFormAtribuir, setMostrarFormAtribuir] = useState(false);
  const [perfilIdInput, setPerfilIdInput] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  if (!conversa) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
        style={{ background: "var(--bg)" }}
      >
        <span className="text-5xl">💬</span>
        <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
          Selecione uma conversa para começar
        </p>
      </div>
    );
  }

  const janelaOk = janelaAberta(conversa.janela_expira_em, new Date());

  const handleArquivar = async () => {
    if (arquivando) return;
    setArquivando(true);
    await arquivarConversaAction(conversa.id);
    setArquivando(false);
  };

  const handleAtribuirSubmit = async () => {
    if (atribuindo) return;
    setAtribuindo(true);
    const pid = perfilIdInput.trim() || null;
    await atribuirConversaAction(conversa.id, pid);
    onAtribuido(pid);
    setAtribuindo(false);
    setMostrarFormAtribuir(false);
    setPerfilIdInput("");
  };

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Cabeçalho */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate text-[14px] font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text)",
              }}
            >
              {conversa.nome_whatsapp ?? conversa.telefone}
            </span>
            <VinculoChip
              lead_id={conversa.lead_id}
              aluno_id={conversa.aluno_id}
              responsavel_id={conversa.responsavel_id}
            />
            {janelaOk ? (
              <span
                className="rounded-[var(--r-pill)] px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: "var(--tint-green)",
                  color: "var(--ok)",
                }}
              >
                Janela aberta
              </span>
            ) : (
              <span
                className="rounded-[var(--r-pill)] px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background:
                    "color-mix(in oklab, var(--warn) 10%, var(--surface))",
                  color: "var(--warn)",
                }}
              >
                Janela fechada
              </span>
            )}
          </div>
          {conversa.nome_whatsapp && (
            <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>
              {conversa.telefone}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMostrarFormAtribuir((v) => !v);
              setPerfilIdInput("");
            }}
            disabled={atribuindo}
            title="Atribuir conversa"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] transition-colors"
            style={{ color: mostrarFormAtribuir ? "var(--brand-600)" : "var(--text-muted)" }}
          >
            <UserCheck size={15} />
          </button>
          <button
            type="button"
            onClick={() => void handleArquivar()}
            disabled={arquivando}
            title="Arquivar conversa"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <Archive size={15} />
          </button>
        </div>
      </div>
      {/* Formulário de atribuição inline */}
      {mostrarFormAtribuir && (
        <div
          className="flex shrink-0 items-center gap-2 border-b px-4 py-2"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <span className="shrink-0 text-[12px]" style={{ color: "var(--text-soft)" }}>
            ID do perfil:
          </span>
          <input
            type="text"
            value={perfilIdInput}
            onChange={(e) => setPerfilIdInput(e.target.value)}
            placeholder="ID ou vazio para desatribuir"
            className="flex-1 rounded-[var(--r-sm)] border px-2.5 py-1 text-[12px] outline-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAtribuirSubmit();
              if (e.key === "Escape") {
                setMostrarFormAtribuir(false);
                setPerfilIdInput("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleAtribuirSubmit()}
            disabled={atribuindo}
            className="rounded-[var(--r-sm)] px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--brand-600)" }}
          >
            {atribuindo ? "..." : "Atribuir"}
          </button>
          <button
            type="button"
            onClick={() => { setMostrarFormAtribuir(false); setPerfilIdInput(""); }}
            className="rounded-[var(--r-sm)] px-2 py-1 text-[12px]"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Mensagens */}
      <div
        className="flex-1 overflow-y-auto py-4"
        style={{ background: "var(--bg)" }}
      >
        {carregando ? (
          <div className="flex items-center justify-center py-10">
            <span
              className="text-[13px]"
              style={{ color: "var(--text-muted)" }}
            >
              Carregando...
            </span>
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span
              className="text-[13px]"
              style={{ color: "var(--text-faint)" }}
            >
              Nenhuma mensagem ainda
            </span>
          </div>
        ) : (
          mensagens.map((m) => <Balao key={m.id} msg={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Envio */}
      <CaixaEnvio
        conversaId={conversa.id}
        janelaOk={janelaOk}
        onEnviado={onEnviado}
      />
    </div>
  );
}
