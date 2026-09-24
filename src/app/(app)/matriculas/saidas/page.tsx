import { requirePermission } from "@/lib/auth/session";
import { listarSaidasDoAno } from "@/lib/data/saidas-ano";
import { Badge } from "@/components/ui/badge";

const ANOS_NO_FILTRO = 5;

export default async function SaidasAnoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("matriculas", "read");
  const { ano = "" } = await searchParams;
  const anoAtual = new Date().getFullYear();
  const anoParseado = ano ? parseInt(ano, 10) : NaN;
  const anoLetivo = Number.isFinite(anoParseado) ? anoParseado : anoAtual;
  const saidas = await listarSaidasDoAno(anoLetivo);

  const opcoesAno = Array.from({ length: ANOS_NO_FILTRO }, (_, i) => anoAtual - i);

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

      <form method="get" className="flex items-end gap-2">
        <label className="grid gap-1 text-sm">
          Ano
          <select name="ano" defaultValue={anoLetivo} className="ds-input">
            {opcoesAno.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="ds-button ds-button-secondary text-xs">
          Filtrar
        </button>
      </form>

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
