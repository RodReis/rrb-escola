import { School, Save } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { updateEscolaAction } from "@/lib/actions/escola";

export default async function EscolaConfigPage() {
  const session = await requireAdmin();
  const supabase = await createServerClient();

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome, cnpj, telefone, email, endereco, cidade, uf, cep, logo_url, gestao_financeira")
    .eq("id", session.profile.escola_id)
    .maybeSingle();

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Configurações" }, { label: "Escola" }]}
        title="Dados da escola"
        description="Informações cadastrais usadas em boletins, relatórios e PDFs."
      />

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <School size={16} className="text-brand" />
          <h2 className="font-bold text-ink">Informações gerais</h2>
        </div>

        <form action={updateEscolaAction} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            Nome
            <input name="nome" required defaultValue={escola?.nome ?? ""} />
          </label>
          <label>
            CNPJ
            <input name="cnpj" defaultValue={escola?.cnpj ?? ""} placeholder="00.000.000/0001-00" />
          </label>
          <label>
            Telefone
            <input name="telefone" defaultValue={escola?.telefone ?? ""} />
          </label>
          <label className="md:col-span-2">
            Email
            <input name="email" type="email" defaultValue={escola?.email ?? ""} />
          </label>
          <label className="md:col-span-2">
            Endereço
            <input name="endereco" defaultValue={escola?.endereco ?? ""} />
          </label>
          <label>
            Cidade
            <input name="cidade" defaultValue={escola?.cidade ?? ""} />
          </label>
          <label>
            UF
            <input name="uf" maxLength={2} defaultValue={escola?.uf ?? ""} />
          </label>
          <label>
            CEP
            <input name="cep" defaultValue={escola?.cep ?? ""} placeholder="00000-000" />
          </label>
          <label>
            Modelo de gestão
            <input value={escola?.gestao_financeira ?? "—"} readOnly disabled />
          </label>
          <label className="md:col-span-2">
            URL da logo
            <input
              name="logo_url"
              type="url"
              defaultValue={escola?.logo_url ?? ""}
              placeholder="https://..."
            />
          </label>

          {escola?.logo_url && (
            <div className="md:col-span-2 rounded-ui border border-line bg-muted/30 p-4">
              <p className="text-xs font-semibold text-ink/55 mb-2">Preview da logo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={escola.logo_url} alt="Logo" className="max-h-24 object-contain" />
            </div>
          )}

          <div className="md:col-span-2 flex justify-end">
            <button className="ds-button ds-button-primary">
              <Save size={14} /> Salvar
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
