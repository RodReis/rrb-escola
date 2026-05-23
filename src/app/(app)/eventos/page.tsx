import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getEventos, getEventoById } from "@/lib/data/eventos";
import { EventoForm } from "@/components/eventos/evento-form";
import { EventosList } from "@/components/eventos/eventos-list";

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  await requirePermission("eventos", "read");
  const session = await requireSession();
  const perms = session.permissions;
  const isAdmin = session.profile.perfil === "admin";

  const canCreate = isAdmin || can(perms, "eventos", "create");
  const canEdit = isAdmin || can(perms, "eventos", "update");
  const canDelete = isAdmin || can(perms, "eventos", "delete");

  const params = await searchParams;
  const eventoEditando = params.editar
    ? await getEventoById(params.editar)
    : null;

  const eventos = await getEventos();

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Secretaria" }, { label: "Eventos" }]}
        title="Eventos"
        description="Agenda da escola: reuniões, festas, conselhos e demais atividades."
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
        <EventosList
          eventos={eventos}
          canEdit={canEdit}
          canDelete={canDelete}
        />
        {(canCreate || (canEdit && eventoEditando)) && (
          <EventoForm evento={eventoEditando} />
        )}
      </section>
    </div>
  );
}
