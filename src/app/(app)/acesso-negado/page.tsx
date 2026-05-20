import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";

export default function AcessoNegadoPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Sistema" }, { label: "Acesso negado" }]}
        title="Acesso negado"
        description="Você não tem permissão para acessar esta página."
      />
      <Panel className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-pill bg-danger/12 text-danger">
          <ShieldAlert size={28} strokeWidth={2} />
        </span>
        <p className="text-sm text-ink/65 max-w-md">
          Esta funcionalidade está disponível apenas para perfis específicos.
          Se você acredita que deveria ter acesso, contate um administrador.
        </p>
        <ButtonLink href="/" variant="primary">Voltar ao início</ButtonLink>
      </Panel>
    </div>
  );
}
