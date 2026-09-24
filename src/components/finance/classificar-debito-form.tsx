"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FieldNote } from "@/components/ui/field-note";
import { classificarDebitoAction } from "@/lib/actions/debitos";
import { useAction } from "@/lib/hooks/use-action";

type Categoria = { id: string; nome: string };
type Company = { id: string; nome: string };

type Props = {
  /** id do movimento (grupo com 1 item) ou "" quando é um grupo com vários — nesse caso extratoIds cobre todos. */
  extratoId?: string;
  /** Quando o formulário classifica um grupo inteiro de uma vez. */
  extratoIds?: string[];
  documento: string | null;
  /** Empresa dona da conta do primeiro movimento — padrão do select e base da comparação do aviso D4. */
  contaCompanyId: string | null;
  /** Mês de `data_pagamento` no formato YYYY-MM, já calculado pelo caller (D3). */
  competenciaPadrao: string;
  categorias: Categoria[];
  companies: Company[];
  /** Regra sugerida pelo pipeline, pré-selecionada quando a aba é "Sugestões". */
  categoriaSugerida?: string;
  companySugerida?: string | null;
  classeSugerida?: "fixa" | "variavel" | null;
  onDone?: () => void;
};

/**
 * Formulário de classificação de um débito (ou de um grupo inteiro da fila
 * "A classificar"). D1: "salvar como regra" nasce DESMARCADO — os campos de
 * janela (D7) só aparecem depois que o usuário marca a caixa.
 */
export function ClassificarDebitoForm({
  extratoId,
  extratoIds,
  documento,
  contaCompanyId,
  competenciaPadrao,
  categorias,
  companies,
  categoriaSugerida,
  companySugerida,
  classeSugerida,
  onDone,
}: Props) {
  const [companyId, setCompanyId] = useState(companySugerida ?? contaCompanyId ?? "");
  const [salvarRegra, setSalvarRegra] = useState(false);
  const [soDestaConta, setSoDestaConta] = useState(false);
  const [valorEsperado, setValorEsperado] = useState(0);
  const [diaInicio, setDiaInicio] = useState("");
  const [diaFim, setDiaFim] = useState("");

  const empresaDivergente = companyId !== "" && contaCompanyId !== null && companyId !== contaCompanyId;
  const nomeEmpresa = useMemo(() => new Map(companies.map((c) => [c.id, c.nome])), [companies]);

  const ids = extratoIds && extratoIds.length > 0 ? extratoIds : extratoId ? [extratoId] : [];

  const { run, pending } = useAction(
    async (formData: FormData) => {
      // Classificar um grupo inteiro repete a mesma decisão para cada movimento.
      for (const id of ids) {
        const copia = new FormData();
        formData.forEach((v, k) => copia.set(k, v));
        copia.set("extrato_id", id);
        await classificarDebitoAction(copia);
      }
    },
    { success: ids.length > 1 ? `${ids.length} movimentos classificados.` : "Movimento classificado.", onSuccess: onDone },
  );

  return (
    <form
      action={(formData) => run(formData)}
      className="grid gap-3 border-t border-line pt-3 md:grid-cols-2"
    >
      <label>
        Categoria
        <select name="categoria_id" required defaultValue={categoriaSugerida ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Empresa
        <select
          name="company_id"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">Sem empresa</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        {empresaDivergente ? (
          <FieldNote tone="warn">
            Esta despesa fica no CNPJ {nomeEmpresa.get(companyId) ?? companyId} e foi paga pela conta do
            CNPJ {nomeEmpresa.get(contaCompanyId ?? "") ?? contaCompanyId}.
          </FieldNote>
        ) : null}
      </label>

      <label>
        Competência
        <input type="month" name="competencia" defaultValue={competenciaPadrao} required />
      </label>

      <label>
        Classe
        <select name="classe_despesa" defaultValue={classeSugerida ?? "variavel"}>
          <option value="fixa">Fixa</option>
          <option value="variavel">Variável</option>
        </select>
      </label>

      <div className="md:col-span-2 grid gap-3 rounded-ui border border-line bg-muted/40 p-3">
        <Switch
          checked={salvarRegra}
          onChange={setSalvarRegra}
          label="Salvar como regra"
          description="Da próxima vez, movimentos parecidos desta contraparte já vêm classificados como sugestão."
          disabled={!documento}
        />
        <input type="hidden" name="salvar_regra" value={salvarRegra ? "on" : ""} />

        {salvarRegra ? (
          <div className="grid gap-3 border-t border-line pt-3 md:grid-cols-3">
            <Switch
              checked={soDestaConta}
              onChange={setSoDestaConta}
              label="Só para esta conta"
              className="md:col-span-3"
            />
            <input type="hidden" name="regra_so_desta_conta" value={soDestaConta ? "on" : ""} />

            <label>
              Valor recorrente
              <CurrencyInput
                id="regra_valor_esperado"
                name="regra_valor_esperado"
                value={valorEsperado}
                onChange={setValorEsperado}
              />
              <FieldNote>Deixe zero para a regra casar qualquer valor (fornecedor comum).</FieldNote>
            </label>
            <label>
              Entre o dia
              <input
                type="number"
                name="regra_dia_inicio"
                min={1}
                max={31}
                value={diaInicio}
                onChange={(e) => setDiaInicio(e.target.value)}
              />
            </label>
            <label>
              E o dia
              <input
                type="number"
                name="regra_dia_fim"
                min={1}
                max={31}
                value={diaFim}
                onChange={(e) => setDiaFim(e.target.value)}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="md:col-span-2 flex items-center justify-between gap-3">
        {!documento ? (
          <span className="flex items-center gap-1.5 text-xs text-ink/55">
            <AlertTriangle size={13} /> Sem documento identificado — não é possível salvar regra.
          </span>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" loading={pending}>
          {ids.length > 1 ? `Classificar ${ids.length} movimentos` : "Classificar"}
        </Button>
      </div>
    </form>
  );
}
