import {
  Activity, StickyNote, Phone, Mail, MessageCircle, Settings,
  type LucideIcon,
} from "lucide-react";
import type { IndicadoresPipeline } from "@/lib/actions/pipeline-indicadores";
import type { AtividadeRecente } from "@/lib/data/pipeline-atividade";
import type { StatusAnamnese, TipoAtividade } from "@/lib/validation/pipeline";
import { tempoRelativoBR } from "@/lib/dates";

const ATIVIDADE_ICONE: Record<TipoAtividade, LucideIcon> = {
  nota: StickyNote,
  ligacao: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  sistema: Settings,
};

const ANAMNESE_LABEL: Record<StatusAnamnese, string> = {
  nao_iniciada: "Não iniciada",
  enviada: "Enviada",
  pendente: "Pendente",
  em_analise: "Em análise",
  concluida: "Concluída",
  requer_atencao: "Requer atenção",
};

// Ordem de exibição das anamneses (status mais relevantes primeiro).
const ANAMNESE_ORDEM: StatusAnamnese[] = [
  "em_analise", "requer_atencao", "concluida", "pendente", "enviada", "nao_iniciada",
];

type Props = {
  anamneses: IndicadoresPipeline["anamneses"];
  atividades: AtividadeRecente[];
  showAnamnese: boolean;
};

export function PipelineAtividadeCard({ anamneses, atividades, showAnamnese }: Props) {
  const anamneseItens = showAnamnese
    ? ANAMNESE_ORDEM.map((status) => ({ status, total: anamneses[status] ?? 0 })).filter(
        (a) => a.total > 0,
      )
    : [];

  const vazio = !showAnamnese && atividades.length === 0;

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
          <Activity size={16} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-ink">Pipeline — Entrevistas &amp; Atividade</h3>
          <p className="text-[0.66rem] text-ink/55">resumo recente</p>
        </div>
      </div>

      {vazio ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/40">
          <Activity size={24} />
          <p className="text-sm text-center px-3">Sem atividade recente no pipeline.</p>
        </div>
      ) : (
        <>
          {/* Entrevistas / anamnese — só para quem tem acesso sensível */}
          {showAnamnese && (
            <div className="mt-4">
              <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
                Entrevistas (anamnese)
              </p>
              {anamneseItens.length === 0 ? (
                <p className="mt-2 text-xs text-ink/40">Nenhuma anamnese registrada.</p>
              ) : (
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {anamneseItens.map((a) => (
                    <div key={a.status} className="rounded-ui bg-muted/40 p-2">
                      <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
                        {ANAMNESE_LABEL[a.status]}
                      </dt>
                      <dd className="mt-1 font-bold text-ink">{a.total}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {/* Timeline de atividade recente */}
          <div className="mt-5">
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
              Atividade recente
            </p>
            {atividades.length === 0 ? (
              <p className="mt-2 text-xs text-ink/40">Sem atividade recente.</p>
            ) : (
              <ul className="mt-2 grid gap-2.5">
                {atividades.map((a) => {
                  const Icone = ATIVIDADE_ICONE[a.tipo] ?? Settings;
                  return (
                    <li key={a.id} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-ui bg-muted/50 text-ink/55">
                        <Icone size={12} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink">{a.descricao || "—"}</p>
                        <p className="text-[0.66rem] text-ink/45">
                          {a.cardTitulo ? `${a.cardTitulo} · ` : ""}
                          {a.autorNome ?? "—"} · {tempoRelativoBR(a.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </article>
  );
}
