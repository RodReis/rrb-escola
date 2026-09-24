"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FieldNote } from "@/components/ui/field-note";
import { money } from "@/lib/constants";
import { classificarDebitoAction } from "@/lib/actions/debitos";
import { useAction } from "@/lib/hooks/use-action";

type Categoria = { id: string; nome: string };
type Company = { id: string; nome: string };

export type MovimentoDoForm = {
  id: string;
  data: string;
  valor: number;
  descricao: string;
};

type Props = {
  /** Movimentos deste formulário — 1 para um débito avulso, N para um grupo. */
  movimentos: MovimentoDoForm[];
  documento: string | null;
  /** Empresa dona da conta dos movimentos — padrão do select e base da comparação do aviso D4. */
  contaCompanyId: string | null;
  categorias: Categoria[];
  companies: Company[];
  /** Regra sugerida pelo pipeline, pré-selecionada quando a aba é "Sugestões". */
  categoriaSugerida?: string;
  companySugerida?: string | null;
  classeSugerida?: "fixa" | "variavel" | null;
  onDone?: () => void;
};

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Formulário de classificação de um débito (ou de um grupo inteiro da fila
 * "A classificar"). D1: "salvar como regra" nasce DESMARCADO — os campos de
 * janela (D7) só aparecem depois que o usuário marca a caixa.
 *
 * Quando é um grupo (C3): cada movimento tem um checkbox próprio, todos
 * marcados por padrão, para o usuário poder tirar do lote um movimento que
 * não deveria levar a mesma categoria (ex.: retirada extraordinária no meio
 * dos pagamentos regulares da mesma contraparte). A regra em si é criada
 * UMA VEZ do lado do servidor (RPC `classificar_debito`), não uma vez por
 * movimento — e lá, se a regra tem valor/janela, cada movimento selecionado é
 * reconferido contra ela antes de virar lançamento.
 */
export function ClassificarDebitoForm({
  movimentos,
  documento,
  contaCompanyId,
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
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(movimentos.map((m) => m.id)),
  );

  const empresaDivergente = companyId !== "" && contaCompanyId !== null && companyId !== contaCompanyId;
  const nomeEmpresa = useMemo(() => new Map(companies.map((c) => [c.id, c.nome])), [companies]);

  const ehGrupo = movimentos.length > 1;
  const idsSelecionados = movimentos.filter((m) => selecionados.has(m.id)).map((m) => m.id);

  const { run, pending } = useAction(
    (formData: FormData) => classificarDebitoAction(formData),
    {
      success: idsSelecionados.length > 1 ? `${idsSelecionados.length} movimentos classificados.` : "Movimento classificado.",
      onSuccess: onDone,
    },
  );

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form
      action={(formData) => run(formData)}
      className="grid gap-3 border-t border-line pt-3 md:grid-cols-2"
    >
      {ehGrupo ? (
        <div className="md:col-span-2 grid gap-1 rounded-ui border border-line bg-muted/30 p-2">
          {movimentos.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="extrato_id"
                value={m.id}
                checked={selecionados.has(m.id)}
                onChange={() => toggle(m.id)}
              />
              <span className="text-ink/60">{dateText(m.data)}</span>
              <span className="flex-1 truncate text-ink/70">{m.descricao}</span>
              <strong className="tabular-nums text-clay">{money.format(m.valor)}</strong>
            </label>
          ))}
        </div>
      ) : (
        <input type="hidden" name="extrato_id" value={movimentos[0]?.id ?? ""} />
      )}

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

      {!ehGrupo ? (
        <FieldNote>
          Competência: {dateText(movimentos[0]?.data ?? "")} — a RPC usa o mês da data de pagamento de cada
          movimento automaticamente.
        </FieldNote>
      ) : (
        <FieldNote>
          Cada movimento marcado leva a competência do mês da SUA PRÓPRIA data de pagamento (D3) — não uma
          competência única para o grupo.
        </FieldNote>
      )}

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
            {valorEsperado > 0 && ehGrupo ? (
              <FieldNote tone="warn" className="md:col-span-3">
                Movimentos marcados que não baterem exatamente com esse valor e essa janela ficam de fora —
                não são lançados com a categoria desta regra.
              </FieldNote>
            ) : null}
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
        <Button type="submit" variant="primary" loading={pending} disabled={idsSelecionados.length === 0}>
          {idsSelecionados.length > 1 ? `Classificar ${idsSelecionados.length} movimentos` : "Classificar"}
        </Button>
      </div>
    </form>
  );
}
