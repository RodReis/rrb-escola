import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { getItemComRun, getItemLancamentos, getRubricas } from "@/lib/data/folha";
import { adicionarLancamentoAction } from "@/lib/actions/folha";
import { LancamentoRow } from "@/components/folha/lancamento-row";
import { requirePermission } from "@/lib/auth/session";
import { money } from "@/lib/constants";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  paga: "Paga",
  fechada: "Fechada",
};

const STATUS_TONE: Record<string, StatusTone> = {
  rascunho: "warning",
  em_revisao: "neutral",
  aprovada: "neutral",
  paga: "success",
  fechada: "success",
};

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[Number(m) - 1]} ${y}`;
}

type RubricaRow = {
  codigo: string;
  nome: string;
  tipo: string;
  ordem_holerite: number;
};

type LancamentoRow2 = {
  id: string;
  valor: number;
  referencia: string | null;
  origem: string;
  valor_calculado: number | null;
  recorrente_parcelas: number | null;
  recorrente_parcela_atual: number | null;
  folha_rubricas: RubricaRow | null;
};

export default async function ContrachequeePage({
  params,
}: {
  params: { id: string; itemId: string };
}) {
  await requirePermission("rh.folha-v2", "read");

  const [item, lancamentos, todasRubricas] = await Promise.all([
    getItemComRun(params.itemId),
    getItemLancamentos(params.itemId),
    getRubricas(),
  ]);

  type RunShape = { id: string; status: string; competencia: string; companies: { name: string } | null };
  type ContratoShape = { employees: { name: string } | null; folha_perfis_calculo: { nome: string } | null };

  const runData = item.folha_runs as unknown as RunShape | null;
  const contratoData = item.folha_contratos as unknown as ContratoShape | null;

  const runStatus = runData?.status ?? "fechada";
  const runId = runData?.id ?? params.id;
  const competencia = runData?.competencia ?? "";
  const companyName = runData?.companies?.name ?? "—";
  const funcionarioName = contratoData?.employees?.name ?? "—";
  const perfilNome = contratoData?.folha_perfis_calculo?.nome ?? "—";

  const editavel = ["rascunho", "em_revisao"].includes(runStatus);

  const rows = lancamentos as unknown as LancamentoRow2[];

  const proventos = rows.filter((l) => l.folha_rubricas?.tipo === "provento");
  const descontos = rows.filter((l) => l.folha_rubricas?.tipo === "desconto");
  const informativas = rows.filter(
    (l) => l.folha_rubricas?.tipo !== "provento" && l.folha_rubricas?.tipo !== "desconto"
  );

  const rubricasAtivas = (todasRubricas ?? []).filter(
    (r) => (r as unknown as { ativa: boolean }).ativa !== false
  );

  const totalProventos = proventos.reduce((s, l) => s + Number(l.valor), 0);
  const totalDescontos = descontos.reduce((s, l) => s + Number(l.valor), 0);
  const liquido = totalProventos - totalDescontos;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha de Pagamento v2", href: "/rh/folha-v2" },
          { label: mesLabel(competencia), href: `/rh/folha-v2/${runId}` },
          { label: funcionarioName },
        ]}
        title={`Contracheque — ${funcionarioName}`}
        description={
          <span className="flex items-center gap-2">
            <span className="text-sm text-ink/60">{companyName} · {mesLabel(competencia)} · {perfilNome}</span>
            <StatusPill tone={STATUS_TONE[runStatus] ?? "neutral"}>
              {STATUS_LABEL[runStatus] ?? runStatus}
            </StatusPill>
          </span>
        }
      />

      {proventos.length > 0 || editavel ? (
        <DataTableShell>
          <table className="ds-dt min-w-[600px]">
            <thead>
              <tr>
                <th>Rubrica</th>
                <th>Referência</th>
                <th>Origem</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {proventos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-ink/40">
                    Nenhum provento lançado.
                  </td>
                </tr>
              ) : null}
              {proventos.map((l) => (
                <LancamentoRow key={l.id} lancamento={l} editavel={editavel} />
              ))}
            </tbody>
            {descontos.length > 0 && (
              <>
                <tbody>
                  <tr>
                    <td colSpan={4} className="bg-line/30 py-1 pl-3 text-xs font-bold uppercase tracking-kicker text-ink/45">
                      Descontos
                    </td>
                  </tr>
                  {descontos.map((l) => (
                    <LancamentoRow key={l.id} lancamento={l} editavel={editavel} />
                  ))}
                </tbody>
              </>
            )}
            <tfoot>
              <tr className="border-t font-semibold">
                <td colSpan={3}>Proventos</td>
                <td className="text-right tabular-nums">{money.format(totalProventos)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="text-ink/60">Descontos</td>
                <td className="text-right tabular-nums text-ink/60">
                  − {money.format(totalDescontos)}
                </td>
              </tr>
              <tr className="border-t text-base font-bold">
                <td colSpan={3}>Líquido</td>
                <td className="text-right tabular-nums">{money.format(liquido)}</td>
              </tr>
            </tfoot>
          </table>
        </DataTableShell>
      ) : null}

      {informativas.length > 0 && (
        <DataTableShell>
          <table className="ds-dt min-w-[600px]">
            <thead>
              <tr>
                <th colSpan={4} className="text-xs font-bold uppercase tracking-kicker text-ink/45">
                  Informativas (não afetam o líquido)
                </th>
              </tr>
              <tr>
                <th>Rubrica</th>
                <th>Referência</th>
                <th>Origem</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {informativas.map((l) => (
                <LancamentoRow key={l.id} lancamento={l} editavel={editavel} />
              ))}
            </tbody>
          </table>
        </DataTableShell>
      )}

      {editavel && (
        <Card>
          <p className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/55">
            Adicionar lançamento manual
          </p>
          <form action={adicionarLancamentoAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="item_id" value={params.itemId} />
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Rubrica
              <select name="rubrica_id" required className="min-w-[220px]">
                <option value="">Selecione…</option>
                {rubricasAtivas.map((r) => {
                  const rr = r as unknown as { id: string; codigo: string; nome: string };
                  return (
                    <option key={rr.id} value={rr.id}>
                      {rr.codigo} — {rr.nome}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Valor (R$)
              <input
                name="valor"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0,00"
                className="w-32"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Parcelas (recorrente)
              <input
                name="recorrente_parcelas"
                type="number"
                min="1"
                step="1"
                placeholder="—"
                className="w-24"
              />
            </label>
            <Button type="submit" variant="primary">
              Adicionar
            </Button>
          </form>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Link
          href={`/rh/folha-v2/${runId}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          ← Voltar para a folha
        </Link>
        <a
          href={`/api/folha/holerite/${params.itemId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ds-button ds-button-primary text-sm"
        >
          Holerite (PDF)
        </a>
      </div>
    </div>
  );
}
