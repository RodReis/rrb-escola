import { AssociacaoForm } from "@/components/historico/associacao-form";
import { AssociacoesTabela } from "@/components/historico/associacoes-tabela";
import { requirePermission } from "@/lib/auth/session";
import { listarCredenciamentos, listarNiveisEnsino } from "@/lib/data/historico";
import { getAcademicData } from "@/lib/data/lookups";

export default async function AssociacoesPage() {
  await requirePermission("historico", "read");
  const [{ series }, credenciamentos, associacoes] = await Promise.all([
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

      <AssociacaoForm series={series} credenciamentos={credenciamentos} />
      <AssociacoesTabela associacoes={associacoes} />
    </div>
  );
}
