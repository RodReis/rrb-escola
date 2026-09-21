// Badge de status da folha com cor propria por estado (bolinha + texto + fundo suave).
// Usado na grid e no detalhe para destacar o status do fluxo.

const STATUS: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  iniciada:     { label: "Iniciada",     dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-500/10" },
  em_andamento: { label: "Em andamento", dot: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-500/10" },
  revisao:      { label: "Revisão",      dot: "bg-violet-500",  text: "text-violet-700",  bg: "bg-violet-500/10" },
  aprovacao:    { label: "Aprovação",    dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-500/10" },
  aprovado:     { label: "Aprovado",     dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-500/10" },
};

export function FolhaStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const s = STATUS[status] ?? { label: status, dot: "bg-ink/40", text: "text-ink/70", bg: "bg-muted" };
  const pad = size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill font-semibold ${pad} ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
