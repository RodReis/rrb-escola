"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PARAMETROS_SUPORTADOS } from "@/lib/documents/declaracao-resolver";
import type { DeclaracaoModeloRow } from "@/lib/data/declaracoes";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  modelo?: DeclaracaoModeloRow;
  submitLabel?: string;
};

/**
 * Botão "Adicionar parâmetro": insere `[CHAVE]` no textarea ativo por
 * último (texto ou fecho), na posição do cursor — não sempre no texto, para
 * o fecho também poder usar [DATA_POR_EXTENSO...] e [EMPRESA].
 */
function useInserirParametro(refs: {
  texto: React.RefObject<HTMLTextAreaElement | null>;
  fecho: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const ultimoAtivo = useRef<"texto" | "fecho">("texto");

  function marcarAtivo(campo: "texto" | "fecho") {
    ultimoAtivo.current = campo;
  }

  function inserir(parametro: string) {
    const ref = refs[ultimoAtivo.current].current;
    if (!ref) return;
    const inicio = ref.selectionStart ?? ref.value.length;
    const fim = ref.selectionEnd ?? ref.value.length;
    const token = `[${parametro}]`;
    ref.value = ref.value.slice(0, inicio) + token + ref.value.slice(fim);
    ref.focus();
    ref.setSelectionRange(inicio + token.length, inicio + token.length);
  }

  return { marcarAtivo, inserir };
}

export function DeclaracaoModeloForm({ action, modelo, submitLabel = "Salvar" }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const fechoRef = useRef<HTMLTextAreaElement>(null);
  const { marcarAtivo, inserir } = useInserirParametro({ texto: textoRef, fecho: fechoRef });

  return (
    <form action={action} className="grid gap-4">
      {modelo ? <input type="hidden" name="id" value={modelo.id} /> : null}

      <label className="grid gap-1 text-sm">
        Nome da declaração
        <input name="nome" defaultValue={modelo?.nome ?? ""} required minLength={3} />
      </label>

      <label className="grid gap-1 text-sm">
        Título
        <input name="titulo" defaultValue={modelo?.titulo ?? ""} required />
      </label>

      <div className="flex items-center justify-between">
        <label htmlFor="texto-declaracao" className="text-sm">
          Texto
        </label>
        <div className="relative">
          <Button type="button" variant="secondary" onClick={() => setMenuAberto((v) => !v)}>
            + Adicionar parâmetro
          </Button>
          {menuAberto ? (
            <ul
              role="listbox"
              className="absolute right-0 z-10 mt-1 max-h-64 overflow-auto rounded-ui border border-line bg-paper shadow-pill"
            >
              {PARAMETROS_SUPORTADOS.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      inserir(p);
                      setMenuAberto(false);
                    }}
                  >
                    [{p}]
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <textarea
        id="texto-declaracao"
        name="texto"
        ref={textoRef}
        onFocus={() => marcarAtivo("texto")}
        defaultValue={modelo?.texto ?? ""}
        required
        rows={6}
      />

      <label htmlFor="fecho-declaracao" className="text-sm">
        Fecho
      </label>
      <textarea
        id="fecho-declaracao"
        name="fecho"
        ref={fechoRef}
        onFocus={() => marcarAtivo("fecho")}
        defaultValue={modelo?.fecho ?? ""}
        required
        rows={2}
      />

      {modelo ? (
        <label className="flex items-center gap-2 text-sm">
          <input name="ativo" type="checkbox" defaultChecked={modelo.ativo} className="h-4 w-auto" />
          Ativo
        </label>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
