import { School, Save, ImageIcon, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getPublicUrl } from "@/lib/storage/public-urls";
import {
  removeEscolaLogoAction,
  updateEscolaAction,
  uploadEscolaLogoAction,
} from "@/lib/actions/escola";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  sem_arquivo: "Selecione um arquivo.",
  arquivo_grande: "Arquivo maior que 2MB.",
  tipo_invalido: "Tipo de arquivo não suportado (JPG/PNG/WEBP/SVG).",
};

const SUCESSOS: Record<string, string> = {
  salvo: "Dados salvos.",
  logo_atualizada: "Logo atualizada.",
  logo_removida: "Logo removida.",
};

export default async function EscolaConfigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await requirePermission("configuracoes.escola", "read");
  const sp = await searchParams;
  const supabase = await createServerClient();

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome, cnpj, telefone, email, endereco, cidade, uf, cep, logo_url, gestao_financeira")
    .eq("id", session.profile.escola_id)
    .maybeSingle();

  const logoUrl = await getPublicUrl("escola-logos", escola?.logo_url);

  const errMsg = sp.erro ? (ERROS[sp.erro] ?? decodeURIComponent(sp.erro)) : null;
  const sucessoKey = Object.keys(SUCESSOS).find((k) => sp[k]);
  const sucMsg = sucessoKey ? SUCESSOS[sucessoKey] : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Configurações" }, { label: "Escola" }]}
        title="Dados da escola"
        description="Informações cadastrais usadas em boletins, relatórios e PDFs."
      />

      {sucMsg && (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> {sucMsg}
        </div>
      )}
      {errMsg && (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {errMsg}
        </div>
      )}

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-brand" />
          <h2 className="font-bold text-ink">Logo da escola</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-[180px_1fr] items-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="max-h-32 max-w-[180px] rounded-ui border border-line bg-paper object-contain p-2" />
          ) : (
            <div className="grid h-32 w-32 place-items-center rounded-ui border border-line bg-muted/40 text-xs font-semibold text-ink/60">
              Sem logo
            </div>
          )}
          <div className="grid gap-3">
            <form action={uploadEscolaLogoAction} className="grid gap-2">
              <label>
                Enviar logo (JPG/PNG/WEBP/SVG, máx 2MB)
                <input name="logo" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" required />
              </label>
              <div>
                <button className="ds-button ds-button-primary">Salvar logo</button>
              </div>
            </form>
            {logoUrl && (
              <form action={removeEscolaLogoAction}>
                <button className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline">
                  <Trash2 size={12} /> Remover logo
                </button>
              </form>
            )}
          </div>
        </div>
      </Panel>

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

          <div className="md:col-span-2 flex justify-end">
            <button className="ds-button ds-button-primary">
              <Save size={14} /> Salvar dados
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
