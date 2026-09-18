import { Plus, RefreshCcw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

type Props = { alunoId: string; novato?: boolean };

export function ReenrollButton({ alunoId, novato = false }: Props) {
  return (
    <ButtonLink href={`/matriculas?aluno_id=${alunoId}#nova-matricula`} variant={novato ? "secondary" : "warn"}>
      {novato ? <Plus size={14} /> : <RefreshCcw size={14} />}
      {novato ? "Matricular" : "Re-matricular"}
    </ButtonLink>
  );
}
