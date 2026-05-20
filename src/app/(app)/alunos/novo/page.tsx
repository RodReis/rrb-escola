import { ArrowLeft } from "lucide-react";
import { StudentForm } from "@/components/students/student-form";
import { ButtonLink } from "@/components/ui/button";
import { getStudentFormOptions } from "@/lib/data/students";
import { requirePermission } from "@/lib/auth/session";

export default async function NewStudentPage() {
  await requirePermission("alunos", "create");
  const options = await getStudentFormOptions();

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Gestao / Alunos</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">Novo aluno</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Cadastre a ficha completa do aluno, responsaveis, contato, endereco, dados medicos e matricula inicial.
          </p>
        </div>
        <ButtonLink href="/alunos" variant="secondary">
          <ArrowLeft size={14} /> Voltar
        </ButtonLink>
      </header>
      <StudentForm options={options} />
    </div>
  );
}
