"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ListaRotulos } from "@/components/questionario/lista-rotulos";
import { atualizarQuestaoAction, criarQuestaoAction } from "@/lib/actions/questionario-questoes";
import { useAction } from "@/lib/hooks/use-action";
import type { EscalaRow, GrupoRow, QuestaoDetalhe } from "@/lib/questionario/tipos";
import { QUESTAO_TIPOS, QUESTAO_TIPO_LABEL, type QuestaoTipo } from "@/lib/validation/questionario";

type Props = { grupos: GrupoRow[]; escalas: EscalaRow[]; questao?: QuestaoDetalhe };

const ROTULO = "text-sm font-medium text-ink/80";

export function QuestaoForm({ grupos, escalas, questao }: Props) {
  const [tipo, setTipo] = useState<QuestaoTipo>(questao?.tipo ?? "subjetiva");
  const [ativa, setAtiva] = useState(questao?.ativa ?? true);
  const [obrigatoria, setObrigatoria] = useState(questao?.obrigatoria ?? false);
  const [escalaId, setEscalaId] = useState(questao?.escalaId ?? "");
  const [limitar, setLimitar] = useState(questao?.limitarCaracteres ?? false);
  const [alternativas, setAlternativas] = useState<string[]>(
    questao && questao.alternativas.length > 0 ? questao.alternativas : ["", ""],
  );

  const salvar = useAction((fd: FormData) => (questao ? atualizarQuestaoAction(fd) : criarQuestaoAction(fd)), {});

  const emUso = questao?.emUso ?? false;
  const subjetiva = tipo === "subjetiva";
  const comAlternativas = tipo === "objetiva_unica" || tipo === "objetiva_multipla";
  const escalasDisponiveis = escalas.filter((e) => e.ativo || e.id === questao?.escalaId);
  const escalaEscolhida = escalas.find((e) => e.id === escalaId);
  const gruposDisponiveis = grupos.filter((g) => g.ativo || g.id === questao?.grupoId);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={enviar}>
      <Panel className="grid gap-5">
        {questao ? <input type="hidden" name="id" value={questao.id} /> : null}
        {/* O select de tipo não tem `name`: o valor vai neste hidden, assim também sai quando o select está travado. */}
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="ativa" value={ativa ? "on" : ""} />
        <input type="hidden" name="obrigatoria" value={obrigatoria ? "on" : ""} />
        <input type="hidden" name="limitarCaracteres" value={subjetiva && limitar ? "on" : ""} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="questao-grupo" className={ROTULO}>Grupo *</label>
            <select id="questao-grupo" name="grupoId" required defaultValue={questao?.grupoId ?? ""}>
              <option value="" disabled>Selecione</option>
              {gruposDisponiveis.map((g) => (
                <option key={g.id} value={g.id}>{g.descricao}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="questao-tipo" className={ROTULO}>Tipo de Questão *</label>
            <select
              id="questao-tipo"
              value={tipo}
              disabled={emUso}
              onChange={(e) => setTipo(e.target.value as QuestaoTipo)}
            >
              {QUESTAO_TIPOS.map((t) => (
                <option key={t} value={t}>{QUESTAO_TIPO_LABEL[t]}</option>
              ))}
            </select>
            {emUso ? (
              <p className="text-xs text-ink/60">
                Questão em uso em questionário: o tipo não pode ser trocado.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <Switch checked={ativa} onChange={setAtiva} label="Está ativa" />
          <Switch checked={obrigatoria} onChange={setObrigatoria} label="É obrigatória" />
        </div>

        <div className="grid gap-1">
          <label htmlFor="questao-pergunta" className={ROTULO}>Pergunta *</label>
          <textarea id="questao-pergunta" name="pergunta" required rows={3} defaultValue={questao?.pergunta ?? ""} />
        </div>

        {tipo === "objetiva_escala" ? (
          <div className="grid gap-1">
            <label htmlFor="questao-escala" className={ROTULO}>Escala *</label>
            <select
              id="questao-escala"
              name="escalaId"
              required
              value={escalaId}
              onChange={(e) => setEscalaId(e.target.value)}
            >
              <option value="" disabled>Selecione</option>
              {escalasDisponiveis.map((e) => (
                <option key={e.id} value={e.id}>{e.descricao}</option>
              ))}
            </select>
            {escalaEscolhida ? (
              <p className="text-xs text-ink/60">{escalaEscolhida.opcoes.join(" · ")}</p>
            ) : null}
          </div>
        ) : null}

        {subjetiva ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Switch checked={limitar} onChange={setLimitar} label="Limitar quantidade de caracteres" />
            <div className="grid gap-1">
              <label htmlFor="questao-caracteres" className={ROTULO}>Qtde. Caracteres</label>
              <input
                id="questao-caracteres"
                name="qtdeCaracteres"
                type="number"
                min={0}
                disabled={!limitar}
                defaultValue={questao?.qtdeCaracteres ?? 0}
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="questao-linhas" className={ROTULO}>Qtde. Linhas</label>
              <input
                id="questao-linhas"
                name="qtdeLinhas"
                type="number"
                min={0}
                defaultValue={questao?.qtdeLinhas ?? 0}
              />
            </div>
          </div>
        ) : null}

        {comAlternativas ? (
          <ListaRotulos
            nome="alternativas"
            rotulo="Alternativa"
            valores={alternativas}
            onChange={setAlternativas}
            placeholder="Texto da alternativa"
          />
        ) : null}

        {tipo === "matriz_descritiva" ? (
          <p className="text-sm text-ink/60">
            A configuração da matriz descritiva (linhas e colunas) será definida em uma próxima fase.
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Link href="/questionario/questoes" className="ds-button ds-button-secondary">Cancelar</Link>
          <Button type="submit" variant="primary" loading={salvar.pending}>Gravar</Button>
        </div>
      </Panel>
    </form>
  );
}
