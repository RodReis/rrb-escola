"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAction } from "@/lib/hooks/use-action";
import { analisarRepasseIsaacAction, confirmarImportacaoIsaacAction, type PreviaImportacao } from "@/lib/actions/isaac";
import { money } from "@/lib/constants";
import type { UnidadeIsaac } from "@/lib/data/isaac";

/** Contagem não é dinheiro: "2 parcelas" não pode virar "R$ 2,00". */
function valorFormatado(valor: number, unidade?: "dinheiro" | "contagem"): string {
  return unidade === "contagem" ? String(valor) : money.format(valor);
}

const MOTIVO_LABEL: Record<string, string> = {
  sem_aluno: "Aluno não encontrado",
  tipo_vaga_incompativel: "Bolsista/isento com mensalidade",
  permuta_manual: "Permuta — revisar valor",
  aluno_cancelado: "Aluno cancelado",
};

export function ImportarRepasseForm({ unidades }: { unidades: UnidadeIsaac[] }) {
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [analisando, setAnalisando] = useState(false);

  // A análise NÃO usa useAction: aquele hook chama router.refresh() no sucesso,
  // o que remonta os Server Components e zera este useState — a prévia sumiria
  // no mesmo instante em que chegasse. useAction é para ação que grava; esta
  // só lê e devolve dados para a tela segurar.
  async function analisar(formData: FormData) {
    setAnalisando(true);
    try {
      const resultado = await analisarRepasseIsaacAction(formData);
      if (resultado.ok) {
        setPrevia(resultado.data);
      } else {
        toast.error(resultado.error);
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao analisar os arquivos.");
    } finally {
      setAnalisando(false);
    }
  }

  const confirmar = useAction(confirmarImportacaoIsaacAction, {
    confirm: {
      title: "Importar repasse",
      message: "Os valores vão para o livro-razão. Reimportar o mesmo mês substitui o repasse anterior.",
      confirmLabel: "Importar",
    },
  });

  if (unidades.length === 0) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-ink/70">
          Nenhuma unidade isaac configurada. Cadastre o vínculo unidade ↔ CNPJ antes de importar.
        </p>
      </Panel>
    );
  }

  if (previa) {
    const bloqueado = previa.bloqueios.length > 0;
    return (
      <div className="grid gap-5">
        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="ds-kicker">Prévia</p>
              <h2 className="mt-1 font-display text-2xl text-ink">
                {previa.unidadeNome} · {previa.competenciaRepasse}
              </h2>
              <p className="mt-1 text-sm text-ink/60">
                Repasse em {previa.dataRepasse} · {previa.contagens.total} parcelas no arquivo
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setPrevia(null)}>
                Trocar arquivos
              </Button>
              <Button
                type="button"
                loading={confirmar.pending}
                disabled={bloqueado}
                onClick={() => confirmar.run(JSON.stringify(previa.payload))}
              >
                {bloqueado ? "Resolva os bloqueios" : "Importar para o razão"}
              </Button>
            </div>
          </div>
        </Panel>

        {previa.bloqueios.length > 0 ? (
          <Panel className="border border-danger/30 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-danger">
              <AlertTriangle size={16} />
              Importação bloqueada
            </div>
            <ul className="grid gap-2 text-sm">
              {previa.bloqueios.map((b) => (
                <li key={b.o_que} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                  <span className="text-ink">{b.o_que}</span>
                  <span className="text-ink/60">
                    esperado {valorFormatado(b.esperado, b.unidade)} · obtido {valorFormatado(b.obtido, b.unidade)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Panel className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CheckCircle2 size={16} className="text-brand" />
              Analítico e resumo fecham centavo a centavo.
            </div>
          </Panel>
        )}

        {previa.avisos.length > 0 ? (
          <Panel className="p-5">
            <p className="ds-kicker mb-3">Avisos (não impedem a importação)</p>
            <ul className="grid gap-2 text-sm">
              {previa.avisos.map((a) => (
                <li key={a.o_que} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink">{a.o_que}</span>
                  <span className="text-ink/60">
                    resumo {a.esperado} · analítico {a.obtido}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <Panel className="p-5">
            <p className="ds-kicker mb-3">Composição do repasse</p>
            <ul className="grid gap-2 text-sm">
              {previa.linhas.map((l) => (
                <li key={`${l.grupo}-${l.tipo}`} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                  <span className="text-ink">{l.tipo}</span>
                  <span className={l.valor < 0 ? "font-semibold text-danger" : "font-semibold text-ink"}>
                    {money.format(l.valor)}
                  </span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-3 pt-1">
                <span className="font-bold text-ink">Total transferido</span>
                <span className="font-display text-lg text-ink">{money.format(previa.totais.totalResumo)}</span>
              </li>
            </ul>
          </Panel>

          <Panel className="p-5">
            <p className="ds-kicker mb-3">Transferências programadas</p>
            <ul className="grid gap-2 text-sm">
              {previa.transferencias.map((t) => (
                <li key={t.data} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                  <span className="text-ink">{t.data}</span>
                  <span className="font-semibold text-ink">{money.format(t.valor)}</span>
                </li>
              ))}
            </ul>
            <p className="ds-kicker mb-2 mt-5">O que vai para o razão</p>
            <ul className="grid gap-1.5 text-sm text-ink/80">
              <li>{previa.contagens.viramCobranca} parcela(s) viram cobrança paga</li>
              <li>{previa.contagens.estornos} estorno(s), registrados sem gerar receita</li>
              <li>
                Taxa isaac: <strong>{money.format(previa.totais.taxa)}</strong> como despesa
              </li>
            </ul>
          </Panel>
        </div>

        {previa.pendencias.length > 0 ? (
          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="ds-kicker">Pendências ({previa.pendencias.length})</p>
              <span className="text-xs text-ink/60">Ficam registradas; não viram cobrança agora.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                    <th className="px-3 py-2">Nome no isaac</th>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.pendencias.slice(0, 50).map((p) => (
                    <tr key={p.idParcela} className="border-b border-line/60">
                      <td className="px-3 py-2 text-ink">{p.nomeIsaac}</td>
                      <td className="px-3 py-2 text-ink/70">{p.produto}</td>
                      <td className="px-3 py-2 text-right text-ink">{money.format(p.valorBase)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={p.motivo === "tipo_vaga_incompativel" ? "red" : "gold"}>
                          {MOTIVO_LABEL[p.motivo] ?? p.motivo}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previa.pendencias.length > 50 ? (
                <p className="mt-3 text-xs text-ink/60">
                  Mostrando 50 de {previa.pendencias.length}. O restante aparece na fila de pendências.
                </p>
              ) : null}
            </div>
          </Panel>
        ) : null}
      </div>
    );
  }

  return (
    <Panel className="p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void analisar(new FormData(e.currentTarget));
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-ink">Unidade isaac</span>
            <select name="unidade_id" required className="rounded-ui border border-line bg-surface px-3 py-2 text-ink">
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nomeIsaac} — {u.companyNome}
                </option>
              ))}
            </select>
            <span className="text-xs text-ink/60">O CNPJ vem da unidade, nunca do nome do arquivo.</span>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-ink">Data do repasse (opcional)</span>
            <input
              type="date"
              name="data_repasse"
              className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
            />
            <span className="text-xs text-ink/60">Em branco, usa a data da primeira transferência do resumo.</span>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <FileSpreadsheet size={14} /> Analítico (.xlsx)
            </span>
            <input
              type="file"
              name="analitico"
              accept=".xlsx"
              required
              className="rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <FileText size={14} /> Resumo (.pdf)
            </span>
            <input
              type="file"
              name="resumo"
              accept=".pdf,application/pdf"
              required
              className="rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={analisando}>
            <Upload size={14} /> Analisar arquivos
          </Button>
          <span className="text-xs text-ink/60">Nada é gravado antes de você conferir a prévia.</span>
        </div>
      </form>
    </Panel>
  );
}
