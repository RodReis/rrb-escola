import { FileStack } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { DeclaracaoModeloRowActions } from "@/components/declaracoes/declaracao-modelo-row-actions";
import { listarDeclaracaoModelos } from "@/lib/data/declaracoes";
import { requirePermission } from "@/lib/auth/session";

export default async function ModelosDeclaracaoPage() {
  await requirePermission("historico", "read");
  const modelos = await listarDeclaracaoModelos({ includeInactive: true });

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Declarações", href: "/declaracoes/modelos" }, { label: "Modelos" }]}
        title="Modelos de declaração"
        counter={String(modelos.length)}
        actions={
          <ButtonLink href="/declaracoes/modelos/novo" variant="primary">
            + Cadastrar
          </ButtonLink>
        }
      />

      <DataTableShell>
        <table className="ds-dt min-w-[640px]">
          <thead>
            <tr>
              <th className="w-[110px]">Código</th>
              <th>Nome da declaração</th>
              <th className="w-[140px]">Status</th>
              <th className="w-[100px] text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {modelos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink/60">
                    <FileStack size={28} />
                    <p className="text-sm font-medium">Nenhum modelo de declaração cadastrado.</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {modelos.map((m) => (
              <tr key={m.id}>
                <td className="pl-4 font-semibold text-ink">{m.codigo}</td>
                <td className="font-semibold text-ink">{m.nome}</td>
                <td>
                  <StatusPill tone={m.ativo ? "success" : "neutral"}>{m.ativo ? "Ativo" : "Inativo"}</StatusPill>
                </td>
                <td className="pr-4 text-right">
                  <DeclaracaoModeloRowActions id={m.id} nome={m.nome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
