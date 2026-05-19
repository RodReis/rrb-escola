import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Copy } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DespesaRow } from "@/components/despesas/despesa-row";
import { duplicateMonthAction } from "@/lib/actions/despesas";
import { money } from "@/lib/constants";
import { getCategorias, getDespesasMensais } from "@/lib/data/despesas";
import {
  totalAberto,
  totalDespesas,
  totalPago,
  totalVencido
} from "@/lib/despesas/totals";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[Number(m) - 1]} ${y}`;
}

function adjacentMes(competencia: string, delta: number) {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DespesasPage({
  searchParams
}: {
  searchParams: Promise<{ mes?: string; categoria_id?: string; status?: string; tipo?: string; erro?: string }>;
}) {
  await requirePermission("despesas", "read");
  const params = await searchParams;
  const now = new Date();
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const competencia = params.mes ?? defaultMes;
  const statusFilter = params.status ? params.status.split(",") : undefined;
  const tipoFilter = params.tipo === "fixa" || params.tipo === "variavel" ? params.tipo : undefined;

  const [categorias, despesas] = await Promise.all([
    getCategorias(),
    getDespesasMensais(competencia, {
      categoria_id: params.categoria_id || undefined,
      status: statusFilter,
      tipo: tipoFilter
    })
  ]);

  const total = totalDespesas(despesas);
  const pago = totalPago(despesas);
  const aberto = totalAberto(despesas);
  const vencido = totalVencido(despesas);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Despesas" }]}
        title="Despesas"
        counter={mesLabel(competencia)}
        description="Despesas operacionais por mês."
        kpis={[
          { label: "Total",      value: money.format(total) },
          { label: "Pago",       value: money.format(pago),    tone: "success" },
          { label: "Em aberto",  value: money.format(aberto),  tone: "warning" },
          { label: "Vencido",    value: money.format(vencido), tone: "danger" }
        ]}
      />

      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/despesas?mes=${adjacentMes(competencia, -1)}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-ui border border-line bg-surface hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="text-lg font-semibold">{mesLabel(competencia)}</div>
          <Link
            href={`/despesas?mes=${adjacentMes(competencia, 1)}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-ui border border-line bg-surface hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={duplicateMonthAction}>
            <input type="hidden" name="to" value={competencia} />
            <Button type="submit" variant="secondary">
              <Copy size={14} /> Duplicar mês anterior
            </Button>
          </form>
          <ButtonLink href={`/despesas/nova?mes=${competencia}`} variant="primary">
            <Plus size={14} /> Nova despesa
          </ButtonLink>
          <ButtonLink href="/despesas/categorias" variant="ghost">Categorias</ButtonLink>
        </div>
      </div>

      <Panel className="p-5">
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="mes" value={competencia} />
          <label>
            Categoria
            <select name="categoria_id" defaultValue={params.categoria_id ?? ""}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select name="tipo" defaultValue={params.tipo ?? ""}>
              <option value="">Todos</option>
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={params.status ?? ""}>
              <option value="">Todos</option>
              <option value="aberta">Aberta</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Aplicar</Button>
          <ButtonLink href={`/despesas?mes=${competencia}`} variant="ghost">Limpar</ButtonLink>
        </form>
      </Panel>

      <Panel className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Despesas do mês</h2>
        {despesas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma despesa neste mês.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">Descrição</th>
                <th className="py-2">Categoria</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Fornecedor</th>
                <th className="py-2">Venc.</th>
                <th className="py-2">Pago em</th>
                <th className="py-2 text-right">Valor</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {despesas.map((d) => <DespesaRow key={d.id} d={d} />)}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
