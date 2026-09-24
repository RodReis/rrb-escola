import { requirePermission } from "@/lib/auth/session";
import { listarSaidasDoAno } from "@/lib/data/saidas-ano";
import { Badge } from "@/components/ui/badge";
import { anoLetivoDaData } from "@/lib/matriculas/ano-letivo";

export default async function SaidasAnoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("matriculas", "read");
  const { ano = "" } = await searchParams;
  const anoLetivo = ano ? parseInt(ano, 10) : anoLetivoDaData(new Date());
  const saidas = await listarSaidasDoAno(anoLetivo);

  const contagemPorMotivo = saidas.reduce<Record<string, number>>((acc, s) => {
    acc[s.motivoLabel] = (acc[s.motivoLabel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-6 p-6">
      <header>
        <p className="ds-kicker">Acadêmico / Matrículas</p>
        <h1 className="font-display text-3xl text-ink">Saídas do ano — {anoLetivo}</h1>
        <p className="mt-2 text-sm text-muted">
          {Object.entries(contagemPorMotivo).map(([label, n]) => `${n} ${label.toLowerCase()}`).join(", ") || "Nenhuma saída registrada."}
        </p>
      </header>

      <table className="ds-table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Série/Turma</th>
            <th>Motivo</th>
            <th>Data</th>
            <th>Ciente coordenação</th>
            <th>Ciente diretoria</th>
          </tr>
        </thead>
        <tbody>
          {saidas.map((s) => (
            <tr key={s.id}>
              <td>{s.alunoNome}</td>
              <td>{s.serieNome} {s.turmaNome}</td>
              <td>{s.motivoLabel}</td>
              <td>{s.data}</td>
              <td>{s.cienteCoordenacao ? <Badge tone="green">✓</Badge> : "—"}</td>
              <td>{s.cienteDiretoria ? <Badge tone="green">✓</Badge> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
