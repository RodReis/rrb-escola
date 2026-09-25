"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiFilterDropdown } from "@/components/ui/filter-dropdown";
import type { OpcoesRh } from "@/lib/relatorio-dinamico/dados/opcoes";
import type { FiltrosRh } from "@/lib/relatorio-dinamico/tipos";

type Props = { opcoes: OpcoesRh; professor: boolean; onChange: (f: FiltrosRh) => void };

export function FiltrosRhForm({ opcoes, professor, onChange }: Props) {
  const [f, setF] = useState<FiltrosRh>({ companyId: null, situacao: "ativo", categoria: null, cargo: null, turmaIds: [], disciplinaIds: [] });

  const turmasOpcoes = opcoes.turmas.map((t) => ({ value: t.id, label: `${t.nome} (${t.ano_letivo})` }));
  const disciplinasOpcoes = opcoes.disciplinas.map((d) => ({ value: d.id, label: `${d.nome} — ${d.serie}`, group: d.serie }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 flex-1">
          Empresa
          <select value={f.companyId ?? ""} onChange={(e) => setF({ ...f, companyId: e.target.value || null })}>
            <option value="">Todas</option>
            {opcoes.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <label className="w-32">
          Situação
          <select value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value as FiltrosRh["situacao"] })}>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <label className="min-w-36 flex-1">
          Categoria
          <select value={f.categoria ?? ""} onChange={(e) => setF({ ...f, categoria: (e.target.value || null) as FiltrosRh["categoria"] })}>
            <option value="">Todas</option>
            <option value="admin">Administrativo</option>
            <option value="fund1">Fundamental I</option>
            <option value="fund2">Fundamental II</option>
            <option value="medio">Ensino Médio</option>
          </select>
        </label>
        <label className="min-w-32 flex-1">
          Cargo
          <select value={f.cargo ?? ""} onChange={(e) => setF({ ...f, cargo: e.target.value || null })}>
            <option value="">Todos</option>
            {opcoes.cargos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {professor ? (
          <>
            <MultiFilterDropdown label="Turmas" value={f.turmaIds} options={turmasOpcoes} onChange={(v) => setF({ ...f, turmaIds: v })} />
            <MultiFilterDropdown label="Disciplinas" value={f.disciplinaIds} options={disciplinasOpcoes} onChange={(v) => setF({ ...f, disciplinaIds: v })} />
          </>
        ) : null}
        <Button type="button" onClick={() => onChange(f)} className="ml-auto">
          <Search size={14} /> Aplicar filtros
        </Button>
      </div>
      {professor ? (
        <p className="text-xs text-ink/55">
          Turma/disciplina usa o vínculo "Usuário do sistema (professor)" do cadastro do funcionário em RH › Funcionários. Funcionário sem vínculo não aparece quando esses filtros estão marcados.
        </p>
      ) : null}
    </div>
  );
}
