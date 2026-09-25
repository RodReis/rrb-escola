import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID, money } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { carregarRecorrentes, competenciaDe } from "@/lib/previsto/gerar-recorrentes";
import { planejarCompetencia } from "@/lib/previsto/recorrencia";
import {
  createRecorrenteAction,
  encerrarRecorrenteAction,
  gerarMesAction,
  lancarValorRecorrenteAction,
} from "@/lib/actions/recorrentes";

export default async function RecorrentesPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requirePermission("financeiro.lancamentos", "read");
  const { erro } = await searchParams;
  const supabase = await createServerClient();
  const competencia = competenciaDe(new Date());

  const [recorrentes, categoriasRes, companiesRes] = await Promise.all([
    carregarRecorrentes(supabase, DEFAULT_SCHOOL_ID),
    supabase.from("categorias_financeiras").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("tipo", "despesa").eq("ativo", true).order("nome"),
    supabase.from("companies").select("id, name").eq("ativo", true).order("name"),
  ]);
  const categorias = categoriasRes.data ?? [];
  const companies = companiesRes.data ?? [];
  const nomeEmpresa = new Map(companies.map((c) => [c.id as string, c.name as string]));

  // Quais valores variáveis ainda faltam neste mês (já lançado = título existente).
  const { aguardandoValor } = planejarCompetencia(recorrentes, competencia);
  const { data: jaLancados } = await supabase
    .from("lancamento_financeiro")
    .select("recorrente_id")
    .eq("competencia", competencia)
    .in("recorrente_id", aguardandoValor.map((r) => r.id));
  const lancados = new Set((jaLancados ?? []).map((l) => l.recorrente_id as string));
  const faltando = aguardandoValor.filter((r) => !lancados.has(r.id));

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Livro-Razão", href: "/financeiro/lancamentos" }, { label: "Recorrentes" }]}
        title="Despesas recorrentes"
        description="Os títulos do mês nascem sozinhos todo dia (sem duplicar). Valor variável espera você informar."
        actions={
          <form action={gerarMesAction}>
            <input type="hidden" name="competencia" value={competencia} />
            <Button type="submit" variant="primary">Gerar títulos de {competencia}</Button>
          </form>
        }
      />
      {erro ? <p className="text-sm text-danger">{decodeURIComponent(erro)}</p> : null}

      {faltando.length > 0 ? (
        <Panel className="grid gap-3">
          <h2 className="text-xs font-bold uppercase tracking-kicker text-ink/60">Aguardando valor — {competencia}</h2>
          {faltando.map((r) => (
            <form key={r.id} action={lancarValorRecorrenteAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="recorrente_id" value={r.id} />
              <input type="hidden" name="competencia" value={competencia} />
              <span className="min-w-48 text-sm font-semibold">{r.descricao}</span>
              <label>
                Valor da conta
                <input name="valor" type="number" step="0.01" min="0.01" required />
              </label>
              <Button type="submit" variant="primary">Lançar título</Button>
            </form>
          ))}
        </Panel>
      ) : null}

      <Panel>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink/60">
              <th>Descrição</th><th>Empresa</th><th>Dia</th><th className="text-right">Valor</th><th>Desde</th><th />
            </tr>
          </thead>
          <tbody>
            {recorrentes.map((r) => (
              <tr key={r.id}>
                <td>{r.descricao}</td>
                <td>{r.companyId ? nomeEmpresa.get(r.companyId) ?? "—" : "—"}</td>
                <td>{r.diaVencimento}</td>
                <td className="text-right tabular-nums">{r.valorReferencia === null ? "varia" : money.format(r.valorReferencia)}</td>
                <td>{r.inicioCompetencia}</td>
                <td>
                  <form action={encerrarRecorrenteAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" className="text-xs">Encerrar</Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-kicker text-ink/60">Nova recorrência</h2>
        <form action={createRecorrenteAction} className="flex flex-wrap items-end gap-3">
          <label>Descrição<input name="descricao" required maxLength={200} /></label>
          <label>Empresa
            <select name="company_id" required defaultValue="">
              <option value="" disabled>Selecione</option>
              {companies.map((c) => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}
            </select>
          </label>
          <label>Categoria
            <select name="categoria_id" required defaultValue="">
              <option value="" disabled>Selecione</option>
              {categorias.map((c) => <option key={c.id as string} value={c.id as string}>{c.nome as string}</option>)}
            </select>
          </label>
          <label>Classe
            <select name="classe_despesa" defaultValue="fixa">
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
            </select>
          </label>
          <label>Dia do vencimento<input name="dia_vencimento" type="number" min={1} max={31} required /></label>
          <label>Valor (vazio = varia)<input name="valor_referencia" type="number" step="0.01" min="0" /></label>
          <label>CPF/CNPJ (opcional)<input name="contraparte" maxLength={200} /></label>
          <label>A partir de<input name="inicio_competencia" placeholder="2026-10" pattern="\d{4}-\d{2}" defaultValue={competencia} required /></label>
          <Button type="submit" variant="primary">Criar</Button>
        </form>
      </Panel>
    </div>
  );
}
