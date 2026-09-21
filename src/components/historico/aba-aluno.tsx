"use client";

import type { HistoricoData } from "@/lib/historico/tipos";

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {rotulo}
      <input readOnly value={valor ?? ""} className="rounded border border-line bg-muted p-2" />
    </label>
  );
}

export function AbaAluno({ historico }: { historico: HistoricoData | null }) {
  if (!historico) {
    return (
      <p className="rounded-lg border border-line p-6 text-sm text-muted">
        Este aluno ainda não tem histórico neste nível. Cadastre um ano na aba “Escolas anteriores” para criá-lo.
      </p>
    );
  }

  const a = historico.aluno;
  return (
    <div className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-2">
      <Campo rotulo="Aluno" valor={a.nome} />
      <Campo rotulo="CPF" valor={a.cpf} />
      <Campo rotulo="Matrícula" valor={a.matricula} />
      <Campo rotulo="Filiação" valor={a.filiacao} />
      <Campo rotulo="Data de nascimento" valor={a.dataNascimento} />
      <Campo rotulo="Naturalidade" valor={a.naturalidade} />
      <Campo rotulo="Nacionalidade" valor={a.nacionalidade} />
    </div>
  );
}
