import { setConsentAction } from "@/lib/actions/biometrics";

type Props = {
  alunoId: string;
  responsaveis: Array<{ id: string; nome: string }>;
  consentimento: { autorizado: boolean; observacao: string | null } | null;
};

export function BiometricConsentForm({ alunoId, responsaveis, consentimento }: Props) {
  if (responsaveis.length === 0) {
    return (
      <p className="text-sm text-clay">
        Cadastre um responsavel antes de coletar consentimento biometrico (LGPD).
      </p>
    );
  }
  return (
    <form action={setConsentAction} className="grid gap-3 rounded-ui border border-line bg-muted/30 p-3">
      <input type="hidden" name="aluno_id" value={alunoId} />
      <label className="text-sm">
        Responsavel que autoriza
        <select name="responsavel_id" required>
          {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="autorizado" value="true" defaultChecked={consentimento?.autorizado ?? false} required />
        <span>Autorizo coleta, armazenamento e uso da biometria facial do aluno conforme a LGPD para controle de acesso na portaria.</span>
      </label>
      <label className="text-sm">
        Observação
        <textarea name="observacao" rows={2} defaultValue={consentimento?.observacao ?? ""} />
      </label>
      <button className="ds-button ds-button-primary w-fit" type="submit">Salvar consentimento</button>
    </form>
  );
}
