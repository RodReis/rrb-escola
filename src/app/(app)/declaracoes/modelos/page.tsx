import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      />
      <div className="flex justify-end">
        <Link href="/declaracoes/modelos/novo">
          <Button variant="primary">+ Cadastrar</Button>
        </Link>
      </div>
      <Panel className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink/60">
              <th className="p-3">Código</th>
              <th className="p-3">Nome da declaração</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {modelos.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="p-3">{m.codigo}</td>
                <td className="p-3">{m.nome}</td>
                <td className="p-3">{m.ativo ? "Ativo" : "Inativo"}</td>
                <td className="p-3">
                  <DeclaracaoModeloRowActions id={m.id} nome={m.nome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
