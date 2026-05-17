import { User, Key, Save } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import {
  changeOwnPasswordAction,
  updateOwnProfileAction,
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
};

export default async function MeuPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ atualizado?: string; senha_alterada?: string; erro?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const errMsg = sp.erro ? (ERROS[sp.erro] ?? decodeURIComponent(sp.erro)) : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Conta" }, { label: "Meu perfil" }]}
        title="Meu perfil"
        description="Atualize seus dados e senha."
      />

      {sp.atualizado && (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Perfil atualizado.
        </div>
      )}
      {sp.senha_alterada && (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Senha alterada com sucesso.
        </div>
      )}
      {errMsg && (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{errMsg}</div>
      )}

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
