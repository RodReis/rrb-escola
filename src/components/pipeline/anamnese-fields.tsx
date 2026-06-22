"use client";

import type { Anamnese } from "@/lib/actions/pipeline-anamnese";

// Estado do formulário: a anamnese sem os campos gerenciados server-side / metadados.
export type AnamneseFormState = Omit<
  Anamnese,
  | "id"
  | "card_id"
  | "aluno_id"
  | "status"
  | "created_at"
  | "updated_at"
  | "consentimento_em"
  | "consentimento_por"
  | "termo_versao"
>;

// Opções de enum (rádio) — reproduzem o PDF FICHA FUND 1.
const OPCOES_TURNO = ["matutino", "vespertino"] as const;
const OPCOES_PAIS = ["casados", "separados"] as const;
const OPCOES_GESTACAO = ["completa", "pre-matura", "pos-matura"] as const;
const OPCOES_PARTO = ["normal", "cesariano", "induzido"] as const;
const OPCOES_POSICAO = ["primogenito", "do-meio", "cacula", "unico"] as const;

// Opções de múltipla escolha (CSV) — chave canônica → rótulo exibido.
const OPCOES_ATITUDES = ["obediente", "independente", "comunicativo", "agressivo", "cooperador"] as const;
const OPCOES_EMOCIONAL = ["tranquilo", "seguro", "ansioso", "alegre", "emotivo", "queixoso"] as const;
const OPCOES_SONO = [
  "insonia", "pesadelo", "hipersonia",
  "dorme-sozinho", "dorme-com-pais", "divide-quarto",
] as const;
const OPCOES_DISTRACOES = ["televisao", "musica", "leitura", "computador"] as const;

const ROTULOS: Record<string, string> = {
  matutino: "Matutino", vespertino: "Vespertino",
  casados: "Casados", separados: "Separados",
  completa: "Completa", "pre-matura": "Pré-matura", "pos-matura": "Pós-matura",
  normal: "Normal", cesariano: "Cesariano", induzido: "Induzido",
  primogenito: "Primogênito", "do-meio": "Do meio", cacula: "Caçula", unico: "Único",
  obediente: "Obediente", independente: "Independente", comunicativo: "Comunicativo",
  agressivo: "Agressivo", cooperador: "Cooperador",
  tranquilo: "Tranquilo", seguro: "Seguro", ansioso: "Ansioso",
  alegre: "Alegre", emotivo: "Emotivo", queixoso: "Queixoso",
  insonia: "Insônia", pesadelo: "Pesadelo", hipersonia: "Hipersonia (excesso de sono)",
  "dorme-sozinho": "Dorme sozinho", "dorme-com-pais": "Dorme com os pais",
  "divide-quarto": "Divide o quarto com alguém",
  televisao: "Televisão", musica: "Música", leitura: "Leitura", computador: "Computador",
};

function rotulo(v: string): string {
  return ROTULOS[v] ?? v;
}

export function emptyAnamneseForm(): AnamneseFormState {
  return {
    necessidade_especial: false,
    necessidade_especial_descricao: null,
    alergias: null,
    medicamentos_continuos: null,
    restricoes_alimentares: null,
    acomp_psicologico: false,
    acomp_psicologico_descricao: null,
    acomp_fonoaudiologico: false,
    acomp_fonoaudiologico_descricao: null,
    acomp_psicopedagogico: false,
    acomp_psicopedagogico_descricao: null,
    historico_desenvolvimento: null,
    comportamento_social: null,
    rotina_familiar: null,
    observacoes_responsaveis: null,
    observacoes_coordenacao: null,
    como_soube_escola: null,
    turno: null,
    data_visita: null,
    crianca_compareceu: null,
    pais_estado_civil: null,
    crianca_vive_com: null,
    gestacao: null,
    saude_mae_gravidez: null,
    parto: null,
    amamentou: null,
    mamadeira: null,
    tem_irmaos: null,
    posicao_familiar: null,
    filho_adotivo: null,
    ciente_adocao: null,
    desenvolvimento_motor: null,
    atraso_fala: null,
    troca_fonemas: null,
    dificuldade_visao_locomocao: null,
    fatos_desenvolvimento: null,
    controle_esfincter: null,
    enurese_noturna: null,
    perturbacoes_sono_dev: null,
    habitos_especiais: null,
    atende_intervencoes: null,
    choro_facil: null,
    recusa_auxilio: null,
    resistencia_toque: null,
    escola_anterior: null,
    faz_amigos: null,
    adapta_meio: null,
    companheiros_brincadeira: null,
    distracoes_preferidas: null,
    atitudes_sociais: null,
    emocional: null,
    sono: null,
    problemas_neurologicos: null,
    acompanhamento_medico: null,
    reacao_contrariada: null,
    intolerancia_frustracao: null,
    uso_internet: null,
    orientacao_internet: null,
    outras_informacoes: null,
  };
}

// Extrai apenas os campos de FormState de uma Anamnese carregada.
export function anamneseToForm(a: Anamnese): AnamneseFormState {
  const base = emptyAnamneseForm();
  const out = { ...base };
  for (const k of Object.keys(base) as (keyof AnamneseFormState)[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[k] = (a as any)[k] ?? base[k];
  }
  return out;
}

type Props = {
  form: AnamneseFormState;
  onChange: <K extends keyof AnamneseFormState>(key: K, val: AnamneseFormState[K]) => void;
  readOnly?: boolean;
};

export function AnamneseFields({ form, onChange, readOnly = false }: Props) {
  return (
    <div className="space-y-4">
      <Bloco titulo="Identificação / entrevista">
        <Field label="Como soube da escola?" v={form.como_soube_escola} on={(x) => onChange("como_soube_escola", x)} ro={readOnly} />
        <Radio label="Turno" opcoes={OPCOES_TURNO} v={form.turno} on={(x) => onChange("turno", x)} ro={readOnly} />
        <DateField label="Data da visita" v={form.data_visita} on={(x) => onChange("data_visita", x)} ro={readOnly} />
        <Bool label="A criança compareceu?" v={form.crianca_compareceu} on={(x) => onChange("crianca_compareceu", x)} ro={readOnly} />
      </Bloco>

      <Bloco titulo="Família">
        <Radio label="Pais" opcoes={OPCOES_PAIS} v={form.pais_estado_civil} on={(x) => onChange("pais_estado_civil", x)} ro={readOnly} />
        <Field label="Em caso de separação, a criança vive com quem?" v={form.crianca_vive_com} on={(x) => onChange("crianca_vive_com", x)} ro={readOnly} />
      </Bloco>

      <Bloco titulo="Gestação / parto">
        <Radio label="Gestação" opcoes={OPCOES_GESTACAO} v={form.gestacao} on={(x) => onChange("gestacao", x)} ro={readOnly} />
        <Field label="Saúde da mãe durante a gravidez" v={form.saude_mae_gravidez} on={(x) => onChange("saude_mae_gravidez", x)} ro={readOnly} multiline />
        <Radio label="Parto" opcoes={OPCOES_PARTO} v={form.parto} on={(x) => onChange("parto", x)} ro={readOnly} />
        <Field label="Amamentou? Quanto tempo?" v={form.amamentou} on={(x) => onChange("amamentou", x)} ro={readOnly} />
        <Field label="Mamadeira? Quanto tempo?" v={form.mamadeira} on={(x) => onChange("mamadeira", x)} ro={readOnly} />
      </Bloco>

      <Bloco titulo="Estrutura familiar">
        <Bool label="Tem irmãos?" v={form.tem_irmaos} on={(x) => onChange("tem_irmaos", x)} ro={readOnly} />
        <Radio label="Posição no bloco familiar" opcoes={OPCOES_POSICAO} v={form.posicao_familiar} on={(x) => onChange("posicao_familiar", x)} ro={readOnly} />
        <Bool label="Filho adotivo?" v={form.filho_adotivo} on={(x) => onChange("filho_adotivo", x)} ro={readOnly} />
        <Bool label="A criança é ciente da adoção?" v={form.ciente_adocao} on={(x) => onChange("ciente_adocao", x)} ro={readOnly} />
      </Bloco>

      <Bloco titulo="Desenvolvimento">
        <Field label="O desenvolvimento motor foi no tempo esperado?" v={form.desenvolvimento_motor} on={(x) => onChange("desenvolvimento_motor", x)} ro={readOnly} multiline />
        <Field label="Atraso ou problema na fala?" v={form.atraso_fala} on={(x) => onChange("atraso_fala", x)} ro={readOnly} multiline />
        <Field label="Troca letras, fonemas? Se sim, quais?" v={form.troca_fonemas} on={(x) => onChange("troca_fonemas", x)} ro={readOnly} multiline />
        <Field label="Dificuldades na visão ou na locomoção?" v={form.dificuldade_visao_locomocao} on={(x) => onChange("dificuldade_visao_locomocao", x)} ro={readOnly} multiline />
        <Field label="Fatos que afetaram o desenvolvimento (acidentes, cirurgias, traumas)?" v={form.fatos_desenvolvimento} on={(x) => onChange("fatos_desenvolvimento", x)} ro={readOnly} multiline />
        <Field label="Dificuldades ou atraso no esfíncter?" v={form.controle_esfincter} on={(x) => onChange("controle_esfincter", x)} ro={readOnly} multiline />
        <Field label="Enurese noturna?" v={form.enurese_noturna} on={(x) => onChange("enurese_noturna", x)} ro={readOnly} multiline />
        <Field label="Perturbações (pesadelos, sonambulismo, agitação)?" v={form.perturbacoes_sono_dev} on={(x) => onChange("perturbacoes_sono_dev", x)} ro={readOnly} multiline />
        <Field label="Possui hábitos especiais (requer presença de alguém, medos)?" v={form.habitos_especiais} on={(x) => onChange("habitos_especiais", x)} ro={readOnly} multiline />
        <Field label="Atende às intervenções quando está desobedecendo?" v={form.atende_intervencoes} on={(x) => onChange("atende_intervencoes", x)} ro={readOnly} multiline />
      </Bloco>

      <Bloco titulo="Comportamento / emocional">
        <Field label="Apresenta choro fácil?" v={form.choro_facil} on={(x) => onChange("choro_facil", x)} ro={readOnly} multiline />
        <Field label="Recusa auxílio?" v={form.recusa_auxilio} on={(x) => onChange("recusa_auxilio", x)} ro={readOnly} multiline />
        <Field label="Tem resistência ao toque (carinho, afago)?" v={form.resistencia_toque} on={(x) => onChange("resistencia_toque", x)} ro={readOnly} multiline />
        <Field label="Já estudou em outra escola? Qual? Motivo da transferência?" v={form.escola_anterior} on={(x) => onChange("escola_anterior", x)} ro={readOnly} multiline />
        <Field label="Faz amigos com facilidade?" v={form.faz_amigos} on={(x) => onChange("faz_amigos", x)} ro={readOnly} multiline />
        <Bool label="Adapta-se facilmente ao meio?" v={form.adapta_meio} on={(x) => onChange("adapta_meio", x)} ro={readOnly} />
        <Field label="Quem são os companheiros nas brincadeiras?" v={form.companheiros_brincadeira} on={(x) => onChange("companheiros_brincadeira", x)} ro={readOnly} />
        <Multi label="Distrações preferidas" opcoes={OPCOES_DISTRACOES} csv={form.distracoes_preferidas} on={(x) => onChange("distracoes_preferidas", x)} ro={readOnly} />
        <Multi label="Atitudes sociais predominantes" opcoes={OPCOES_ATITUDES} csv={form.atitudes_sociais} on={(x) => onChange("atitudes_sociais", x)} ro={readOnly} />
        <Multi label="Emocional" opcoes={OPCOES_EMOCIONAL} csv={form.emocional} on={(x) => onChange("emocional", x)} ro={readOnly} />
        <Multi label="Sono" opcoes={OPCOES_SONO} csv={form.sono} on={(x) => onChange("sono", x)} ro={readOnly} />
      </Bloco>

      <Bloco titulo="Saúde">
        <Field label="Alergias" v={form.alergias} on={(x) => onChange("alergias", x)} ro={readOnly} multiline />
        <Field label="Medicamentos contínuos" v={form.medicamentos_continuos} on={(x) => onChange("medicamentos_continuos", x)} ro={readOnly} multiline />
        <Field label="Restrições alimentares" v={form.restricoes_alimentares} on={(x) => onChange("restricoes_alimentares", x)} ro={readOnly} multiline />
        <Field label="Problemas neurológicos? Se sim, qual?" v={form.problemas_neurologicos} on={(x) => onChange("problemas_neurologicos", x)} ro={readOnly} multiline />
        <Field label="Faz acompanhamento (médico, psicológico, fonoaudiológico)?" v={form.acompanhamento_medico} on={(x) => onChange("acompanhamento_medico", x)} ro={readOnly} multiline />
        <Bool label="Necessidade especial / aluno atípico?" v={form.necessidade_especial} on={(x) => onChange("necessidade_especial", x ?? false)} ro={readOnly} />
        {form.necessidade_especial && (
          <Field label="Descrição da necessidade especial" v={form.necessidade_especial_descricao} on={(x) => onChange("necessidade_especial_descricao", x)} ro={readOnly} multiline />
        )}
        <Bool label="Acompanhamento psicológico" v={form.acomp_psicologico} on={(x) => onChange("acomp_psicologico", x ?? false)} ro={readOnly} />
        {form.acomp_psicologico && (
          <Field label="Detalhes (psicológico)" v={form.acomp_psicologico_descricao} on={(x) => onChange("acomp_psicologico_descricao", x)} ro={readOnly} />
        )}
        <Bool label="Acompanhamento fonoaudiológico" v={form.acomp_fonoaudiologico} on={(x) => onChange("acomp_fonoaudiologico", x ?? false)} ro={readOnly} />
        {form.acomp_fonoaudiologico && (
          <Field label="Detalhes (fonoaudiológico)" v={form.acomp_fonoaudiologico_descricao} on={(x) => onChange("acomp_fonoaudiologico_descricao", x)} ro={readOnly} />
        )}
        <Bool label="Acompanhamento psicopedagógico" v={form.acomp_psicopedagogico} on={(x) => onChange("acomp_psicopedagogico", x ?? false)} ro={readOnly} />
        {form.acomp_psicopedagogico && (
          <Field label="Detalhes (psicopedagógico)" v={form.acomp_psicopedagogico_descricao} on={(x) => onChange("acomp_psicopedagogico_descricao", x)} ro={readOnly} />
        )}
      </Bloco>

      <Bloco titulo="Reação / internet">
        <Field label="Como reage quando contrariada e qual a atitude dos pais?" v={form.reacao_contrariada} on={(x) => onChange("reacao_contrariada", x)} ro={readOnly} multiline />
        <Bool label="Apresenta intolerância diante da frustração?" v={form.intolerancia_frustracao} on={(x) => onChange("intolerancia_frustracao", x)} ro={readOnly} />
        <Field label="Faz uso da internet e redes sociais? Especificar." v={form.uso_internet} on={(x) => onChange("uso_internet", x)} ro={readOnly} multiline />
        <Field label="Os pais orientam quanto ao uso da internet/redes sociais?" v={form.orientacao_internet} on={(x) => onChange("orientacao_internet", x)} ro={readOnly} multiline />
      </Bloco>

      <Bloco titulo="Desenvolvimento (resumo) / rotina">
        <Field label="Histórico de desenvolvimento" v={form.historico_desenvolvimento} on={(x) => onChange("historico_desenvolvimento", x)} ro={readOnly} multiline />
        <Field label="Comportamento social" v={form.comportamento_social} on={(x) => onChange("comportamento_social", x)} ro={readOnly} multiline />
        <Field label="Rotina familiar" v={form.rotina_familiar} on={(x) => onChange("rotina_familiar", x)} ro={readOnly} multiline />
      </Bloco>

      <Bloco titulo="Observações">
        <Field label="Outras informações importantes sobre a criança" v={form.outras_informacoes} on={(x) => onChange("outras_informacoes", x)} ro={readOnly} multiline />
        <Field label="Obs. dos responsáveis" v={form.observacoes_responsaveis} on={(x) => onChange("observacoes_responsaveis", x)} ro={readOnly} multiline />
        <Field label="Obs. da coordenação" v={form.observacoes_coordenacao} on={(x) => onChange("observacoes_coordenacao", x)} ro={readOnly} multiline />
      </Bloco>
    </div>
  );
}

// ─── Helpers de UI ───────────────────────────────────────────────────────────

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.5)]">
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label, v, on, ro, multiline = false,
}: {
  label: string;
  v: string | null;
  on: (val: string | null) => void;
  ro: boolean;
  multiline?: boolean;
}) {
  if (ro) {
    return (
      <div>
        <p className="text-xs text-[rgb(var(--color-ink)/0.55)]">{label}</p>
        <p className="text-xs text-[rgb(var(--color-ink))] whitespace-pre-wrap">{v?.trim() ? v : "—"}</p>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-0.5">{label}</label>
      {multiline ? (
        <textarea
          rows={2}
          value={v ?? ""}
          onChange={(e) => on(e.target.value || null)}
          className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-xs text-[rgb(var(--color-ink))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-brand)/0.4)] resize-none"
        />
      ) : (
        <input
          type="text"
          value={v ?? ""}
          onChange={(e) => on(e.target.value || null)}
          className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-xs text-[rgb(var(--color-ink))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-brand)/0.4)]"
        />
      )}
    </div>
  );
}

function DateField({
  label, v, on, ro,
}: {
  label: string;
  v: string | null;
  on: (val: string | null) => void;
  ro: boolean;
}) {
  if (ro) {
    const fmt = v ? new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR") : "—";
    return (
      <div>
        <p className="text-xs text-[rgb(var(--color-ink)/0.55)]">{label}</p>
        <p className="text-xs text-[rgb(var(--color-ink))]">{fmt}</p>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-0.5">{label}</label>
      <input
        type="date"
        value={v ?? ""}
        onChange={(e) => on(e.target.value || null)}
        className="rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-xs text-[rgb(var(--color-ink))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-brand)/0.4)]"
      />
    </div>
  );
}

function Bool({
  label, v, on, ro,
}: {
  label: string;
  v: boolean | null;
  on: (val: boolean | null) => void;
  ro: boolean;
}) {
  if (ro) {
    const txt = v === true ? "Sim" : v === false ? "Não" : "—";
    return (
      <div className="flex items-center justify-between">
        <p className="text-xs text-[rgb(var(--color-ink)/0.55)]">{label}</p>
        <p className="text-xs text-[rgb(var(--color-ink))]">{txt}</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[rgb(var(--color-ink)/0.75)]">{label}</span>
      <div className="flex gap-1">
        {([["Sim", true], ["Não", false]] as const).map(([txt, val]) => (
          <button
            key={txt}
            type="button"
            onClick={() => on(v === val ? null : val)}
            className={
              "rounded px-2 py-0.5 text-xs border " +
              (v === val
                ? "border-[rgb(var(--color-brand))] bg-[rgb(var(--color-brand)/0.1)] text-[rgb(var(--color-brand))]"
                : "border-[rgb(var(--color-line))] text-[rgb(var(--color-ink)/0.6)]")
            }
          >
            {txt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Radio({
  label, opcoes, v, on, ro,
}: {
  label: string;
  opcoes: readonly string[];
  v: string | null;
  on: (val: string | null) => void;
  ro: boolean;
}) {
  if (ro) {
    return (
      <div>
        <p className="text-xs text-[rgb(var(--color-ink)/0.55)]">{label}</p>
        <p className="text-xs text-[rgb(var(--color-ink))]">{v ? rotulo(v) : "—"}</p>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">{label}</label>
      <div className="flex flex-wrap gap-1">
        {opcoes.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => on(v === o ? null : o)}
            className={
              "rounded px-2 py-0.5 text-xs border " +
              (v === o
                ? "border-[rgb(var(--color-brand))] bg-[rgb(var(--color-brand)/0.1)] text-[rgb(var(--color-brand))]"
                : "border-[rgb(var(--color-line))] text-[rgb(var(--color-ink)/0.6)]")
            }
          >
            {rotulo(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Multi({
  label, opcoes, csv, on, ro,
}: {
  label: string;
  opcoes: readonly string[];
  csv: string | null;
  on: (val: string | null) => void;
  ro: boolean;
}) {
  const selecionados = (csv ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (ro) {
    const txt = selecionados.length ? selecionados.map(rotulo).join(", ") : "—";
    return (
      <div>
        <p className="text-xs text-[rgb(var(--color-ink)/0.55)]">{label}</p>
        <p className="text-xs text-[rgb(var(--color-ink))]">{txt}</p>
      </div>
    );
  }

  function toggle(o: string) {
    const set = new Set(selecionados);
    if (set.has(o)) set.delete(o);
    else set.add(o);
    const next = Array.from(set);
    on(next.length ? next.join(",") : null);
  }

  return (
    <div>
      <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">{label}</label>
      <div className="flex flex-wrap gap-1">
        {opcoes.map((o) => {
          const ativo = selecionados.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={
                "rounded px-2 py-0.5 text-xs border " +
                (ativo
                  ? "border-[rgb(var(--color-brand))] bg-[rgb(var(--color-brand)/0.1)] text-[rgb(var(--color-brand))]"
                  : "border-[rgb(var(--color-line))] text-[rgb(var(--color-ink)/0.6)]")
              }
            >
              {rotulo(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
