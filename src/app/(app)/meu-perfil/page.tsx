import { User, Key, Save, ImageIcon, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getPublicUrl } from "@/lib/storage/public-urls";
import {
  changeOwnPasswordAction,
  removeOwnAvatarAction,
  updateOwnProfileAction,
  uploadOwnAvatarAction,
} from "@/lib/actions/perfil";

export const dynamic = "force-dynamic";

const PERFIL_LABEL: Record<string, string> = {
  admin: "Admin",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
  professor: "Professor",
};

const ERROS: Record<string, string> = {
  nome: "Nome obrigatório.",
  senha_curta: "A nova senha precisa ter pelo menos 8 caracteres.",
  senha_nao_bate: "Senha e confirmação não conferem.",
  sem_arquivo: "Selecione um arquivo.",
  arquivo_grande: "Arquivo maior que 2MB.",
  tipo_invalido: "Tipo de arquivo não suportado (JPG/PNG/WEBP/SVG).",
};

const SUCESSOS: Record<string, string> = {
  atualizado: "Perfil atualizado.",
  senha_alterada: "Senha alterada com sucesso.",
  avatar_atualizado: "Foto atualizada.",
  avatar_removido: "Foto removida.",
};

export default async function MeuPerfilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const supabase = await createServerClient();
  const { data: perfilDb } = await supabase
    .from("perfis")
    .select("foto_url")
    .eq("id", session.profile.id)
    .maybeSingle();

  const fotoUrl = await getPublicUrl("perfis-fotos", perfilDb?.foto_url);

  const errMsg = sp.erro ? (ERROS[sp.erro] ?? decodeURIComponent(sp.erro)) : null;
  const sucessoKey = Object.keys(SUCESSOS).find((k) => sp[k]);
  const sucMsg = sucessoKey ? SUCESSOS[sucessoKey] : null;

  const initials = session.profile.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Conta" }, { label: "Meu perfil" }]}
        title="Meu perfil"
        description="Atualize foto, dados e senha."
      />

      {sucMsg && (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">{sucMsg}</div>
      )}
      {errMsg && (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{errMsg}</div>
      )}

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-brand" />
          <h2 className="font-bold text-ink">Foto do perfil</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-[140px_1fr] items-center">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt={session.profile.nome} className="h-32 w-32 rounded-full border border-line object-cover" />
          ) : (
            <div className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-brand to-brand/60 text-2xl font-bold text-paper">
              {initials}
            </div>
          )}
          <div className="grid gap-3">
            <form action={uploadOwnAvatarAction} className="grid gap-2">
              <label>
                Enviar imagem (JPG/PNG/WEBP/SVG, máx 2MB)
                <input name="foto" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" required />
              </label>
              <div>
                <button className="ds-button ds-button-primary">Salvar foto</button>
              </div>
            </form>
            {fotoUrl && (
              <form action={removeOwnAvatarAction}>
                <button className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline">
                  <Trash2 size={12} /> Remover foto
                </button>
              </form>
            )}
          </div>
        </div>
      </Panel>

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <User size={16} className="text-brand" />
          <h2 className="font-bold text-ink">Dados pessoais</h2>
        </div>
        <form action={updateOwnProfileAction} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            Nome
            <input name="nome" required defaultValue={session.profile.nome} />
          </label>
          <label>
            Email (somente leitura)
            <input value={session.profile.email} readOnly disabled />
          </label>
          <label>
            Perfil
            <input value={PERFIL_LABEL[session.profile.perfil] ?? session.profile.perfil} readOnly disabled />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button className="ds-button ds-button-primary">
              <Save size={14} /> Salvar
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-warning" />
          <h2 className="font-bold text-ink">Alterar senha</h2>
        </div>
        <form action={changeOwnPasswordAction} className="grid gap-4 md:grid-cols-2">
          <label>
            Nova senha (mín. 8)
            <input name="nova_senha" type="password" required minLength={8} />
          </label>
          <label>
            Confirmar
            <input name="confirmacao" type="password" required minLength={8} />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button className="ds-button ds-button-primary">
              <Key size={14} /> Alterar senha
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
