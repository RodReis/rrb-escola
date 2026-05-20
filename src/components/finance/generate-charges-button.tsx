import { generateChargesForEnrollmentAction } from "@/lib/actions/finance";

type Props = {
  matriculaId: string;
  preview: { temPlano: boolean; existentes: number; totalPlano: number; aGerar: number };
};

export function GenerateChargesButton({ matriculaId, preview }: Props) {
  if (!preview.temPlano) {
    return <p className="text-sm text-muted">Matrícula sem plano vinculado. Adicione um plano para gerar cobranças.</p>;
  }
  return (
    <form action={generateChargesForEnrollmentAction} className="flex items-center gap-3">
      <input type="hidden" name="matricula_id" value={matriculaId} />
      <button className="ds-button ds-button-primary" type="submit">
        Gerar cobranças ({preview.aGerar} novas)
      </button>
      <span className="text-xs text-muted">Plano: {preview.totalPlano} parcelas. Existentes: {preview.existentes}.</span>
    </form>
  );
}
