import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { requirePermission } from "@/lib/auth/session";
import { listComunicados } from "@/lib/data/comunicados";

export const dynamic = "force-dynamic";

export default async function ComunicadosPage() {
  await requirePermission("comunicados", "read");
  const comunicados = await listComunicados();

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Comunicados" }]}
        title="Comunicados"
        counter={comunicados.length.toString()}
        description="Avisos enviados aos responsáveis via WhatsApp."
        actions={
          <ButtonLink href="/comunicados/novo" variant="primary">
            <Plus size={14} /> Novo comunicado
          </ButtonLink>
        }
      />

      {comunicados.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
            <Megaphone size={28} />
            <p className="text-sm font-medium">Nenhum comunicado enviado.</p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-2">
          {comunicados.map((c) => {
            const tone: StatusTone = c.status === "concluido" ? "success" : "warning";
            return (
              <Link
                key={c.id}
                href={`/comunicados/${c.id}`}
                className="grid gap-2 rounded-ui border border-line p-4 hover:bg-muted/40 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{c.titulo}</p>
                  <p className="text-xs text-ink/55">
                    {c.alcance === "geral"
                      ? "Geral"
                      : c.alcance === "segmentado"
                        ? "Segmentado"
                        : "Individual"}{" "}
                    · {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="text-xs text-ink/60">
                  {c.totalEnviados}/{c.totalDestinatarios} enviados
                </span>
                {c.totalFalhas > 0 && (
                  <span className="text-xs font-semibold text-danger">
                    {c.totalFalhas} falhas
                  </span>
                )}
                <StatusPill tone={tone}>
                  {c.status === "concluido" ? "Concluído" : "Processando"}
                </StatusPill>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
