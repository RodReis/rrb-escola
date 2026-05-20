import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Copy, Filter, Receipt, AlertCircle, Tag } from "lucide-react";
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
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {params.erro}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface p-1">
          <Link
            href={`/despesas?mes=${adjacentMes(competencia, -1)}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-ink/60 transition hover:bg-muted hover:text-ink"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="px-3 text-sm font-semibold text-ink tabular-nums">{mesLabel(competencia)}</div>
          <Link
            href={`/despesas?mes=${adjacentMes(competencia, 1)}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-ink/60 transition hover:bg-muted hover:text-ink"
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
          <ButtonLink href="/despesas/categorias" variant="ghost">
            <Tag size={14} /> Categorias
          </ButtonLink>
          <ButtonLink href={`/despesas/nova?mes=${competencia}`} variant="primary">
            <Plus size={14} /> Nova despesa
          </ButtonLink>
        </div>
      </div>

      <Panel className="p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/55">
          <Filter size={12} />
          Filtros
        </div>
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-kicker text-ink/55">Despesas do mês</h2>
          {despesas.length > 0 && (
            <span className="text-xs text-ink/45">{despesas.length} {despesas.length === 1 ? "registro" : "registros"}</span>
          )}
        </div>
        {despesas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-12 text-ink/40">
            <Receipt size={28} />
            <p className="text-sm">Nenhuma despesa neste mês.</p>
            <ButtonLink href={`/despesas/nova?mes=${competencia}`} variant="ghost" className="mt-2">
              <Plus size={14} /> Cadastrar primeira
            </ButtonLink>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
                  <th className="py-2 px-3">Descrição</th>
                  <th className="py-2 px-3">Categoria</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Fornecedor</th>
                  <th className="py-2 px-3">Venc.</th>
                  <th className="py-2 px-3">Pago em</th>
                  <th className="py-2 px-3 text-right">Valor</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {despesas.map((d) => <DespesaRow key={d.id} d={d} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
