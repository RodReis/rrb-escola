"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { NovaMatriculaFields } from "@/components/matriculas/nova-matricula-fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { createEnrollmentAction } from "@/lib/actions/academics";

type Aluno = {
  id: string;
  nome: string;
  matricula_codigo: string;
  data_nascimento?: string | null;
  matriculas?: { ano_letivo: number; status: string; serie_id?: string | null }[] | null;
};
type Serie = { id: string; nome: string; ordem?: number | null };
type Turma = { id: string; nome: string; serie_id: string; ano_letivo: number; ativo: boolean; turno: string };
type Plano = { id: string; nome: string };

type Props = {
  alunos: Aluno[];
  series: Serie[];
  turmas: Turma[];
  planos: Plano[];
  alunoPre: Aluno | null;
  sucesso: boolean;
  erro: boolean;
};

export function NovaMatriculaDialog({ alunos, series, turmas, planos, alunoPre, sucesso, erro }: Props) {
  const [open, setOpen] = useState(false);

  // Abre automaticamente quando a página chega de um redirect relevante:
  // link "Matricular" de outra tela (alunoPre) ou resultado do submit anterior.
  useEffect(() => {
    if (alunoPre || sucesso || erro) setOpen(true);
  }, [alunoPre, sucesso, erro]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="ds-button ds-button-primary">
        <UserPlus size={14} /> Nova matrícula
      </button>

      <Dialog open={open} title="Cadastrar vínculo acadêmico" onClose={() => setOpen(false)} size="lg">
        {sucesso ? (
          <p className="mb-4 flex items-center gap-2 rounded-ui bg-moss/10 p-3 text-sm font-bold text-moss">
            <CheckCircle2 size={16} />
            Matrícula cadastrada com sucesso.
          </p>
        ) : null}
        {erro ? (
          <p className="mb-4 flex items-center gap-2 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">
            Erro ao cadastrar matrícula. Tente novamente.
          </p>
        ) : null}
        <form action={createEnrollmentAction} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <NovaMatriculaFields alunos={alunos} series={series} turmas={turmas} alunoPre={alunoPre} />
            <label className="self-start">Plano
              <select name="plano_id">
                <option value="">Sem plano</option>
                {planos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label className="self-start">Data<input name="data_matricula" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="self-start">Tipo de vaga
              <select name="tipo_vaga" defaultValue="NORMAL">
                <option value="NORMAL">Normal</option>
                <option value="BOLSA_50_PORCENTO">Bolsa 50%</option>
                <option value="BOLSA_INTEGRAL">Bolsa integral</option>
                <option value="FILHO_PROFESSORA">Filho de professora</option>
                <option value="FILHO_PROFESSORA_INTEGRAL">Filho de professora integral</option>
                <option value="PERMUTA">Permuta</option>
                <option value="ISENTO">Isento</option>
              </select>
            </label>
            <label className="self-start sm:col-span-2">Observações<input name="observacoes" /></label>
          </div>
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setOpen(false)} className="ds-button ds-button-secondary text-xs">
              Cancelar
            </button>
            <SubmitButton>
              <Plus size={14} /> Matricular
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
