import { AssociacaoForm } from "@/components/historico/associacao-form";
import { AssociacoesTabela } from "@/components/historico/associacoes-tabela";
import { StatusBanner } from "@/components/ui/status-banner";
import { requirePermission } from "@/lib/auth/session";
import { listarCredenciamentos, listarNiveisEnsino } from "@/lib/data/historico";
import { getAcademicData } from "@/lib/data/lookups";

type Props = {
  searchParams: Promise<{ ok?: string; erro?: string }>;
};

export default async function AssociacoesPage({ searchParams }: Props) {
  await requirePermission("historico", "read");
  const params = await searchParams;
  const [{ series }, empresas, associacoes] = await Promise.all([
    getAcademicData(),
    listarCredenciamentos(),
    listarNiveisEnsino()
  ]);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Histórico Escolar — Associação Série/Turma e Empresa</h1>
        <p className="text-sm text-muted">
          Define qual empresa e credenciamento aparecem no histórico de cada série, e em que período.
        </p>
      </header>

      <StatusBanner ok={params.ok} erro={params.erro} rota="/historico/associacoes" />

      <AssociacaoForm series={series} empresas={empresas} />
      <AssociacoesTabela associacoes={associacoes} />
    </div>
  );
}
