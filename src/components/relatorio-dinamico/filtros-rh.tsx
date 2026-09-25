"use client";

import { useEffect, useState } from "react";
import type { OpcoesRh } from "@/lib/relatorio-dinamico/dados/opcoes";
import type { FiltrosRh } from "@/lib/relatorio-dinamico/tipos";

type Props = { opcoes: OpcoesRh; professor: boolean; onChange: (f: FiltrosRh) => void };

export function FiltrosRhForm({ opcoes, professor, onChange }: Props) {
  const [f, setF] = useState<FiltrosRh>({ companyId: null, situacao: "ativo", categoria: null, cargo: null, turmaIds: [], disciplinaIds: [] });

  // Carga inicial da lista de registros (uma vez).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onChange(f), []);

  const atualizar = (novo: FiltrosRh) => { setF(novo); onChange(novo); };
  const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <label>
          Empresa
          <select value={f.companyId ?? ""} onChange={(e) => atualizar({ ...f, companyId: e.target.value || null })}>
            <option value="">Todas</option>
            {opcoes.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <label>
          Situação
          <select value={f.situacao} onChange={(e) => atualizar({ ...f, situacao: e.target.value as FiltrosRh["situacao"] })}>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <label>
          Categoria
          <select value={f.categoria ?? ""} onChange={(e) => atualizar({ ...f, categoria: (e.target.value || null) as FiltrosRh["categoria"] })}>
            <option value="">Todas</option>
            <option value="admin">Administrativo</option>
            <option value="fund1">Fundamental I</option>
            <option value="fund2">Fundamental II</option>
            <option value="medio">Ensino Médio</option>
          </select>
        </label>
        <label>
          Cargo
          <select value={f.cargo ?? ""} onChange={(e) => atualizar({ ...f, cargo: e.target.value || null })}>
            <option value="">Todos</option>
            {opcoes.cargos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {professor ? (
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Turmas <span className="text-ink/50">(nenhuma = todas)</span></legend>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {opcoes.turmas.map((t) => {
                const rotulo = `${t.nome} (${t.ano_letivo})`;
                return (
                  <label key={t.id} className="flex items-center gap-1.5 rounded-ui border border-line px-2.5 py-1.5 text-sm">
                    <input type="checkbox" aria-label={rotulo} checked={f.turmaIds.includes(t.id)} onChange={() => atualizar({ ...f, turmaIds: alternar(f.turmaIds, t.id) })} />
                    {rotulo}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Disciplinas <span className="text-ink/50">(nenhuma = todas)</span></legend>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {opcoes.disciplinas.map((d) => {
                const rotulo = `${d.nome} — ${d.serie}`;
                return (
                  <label key={d.id} className="flex items-center gap-1.5 rounded-ui border border-line px-2.5 py-1.5 text-sm">
                    <input type="checkbox" aria-label={rotulo} checked={f.disciplinaIds.includes(d.id)} onChange={() => atualizar({ ...f, disciplinaIds: alternar(f.disciplinaIds, d.id) })} />
                    {rotulo}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="md:col-span-2 text-xs text-ink/55">
            Turma/disciplina usa o vínculo "Usuário do sistema (professor)" do cadastro do funcionário em RH › Funcionários. Funcionário sem vínculo não aparece quando esses filtros estão marcados.
          </p>
        </div>
      ) : null}
    </div>
  );
}
