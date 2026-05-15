import { cn } from "@/lib/utils";

const tones = {
  green: "bg-[rgb(var(--color-success)/0.14)] text-[rgb(var(--color-success))]",
  red: "bg-clay/12 text-clay",
  gold: "bg-gold/15 text-gold",
  gray: "bg-ink/8 text-ink"
};

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center rounded-ui px-2 py-1 text-xs font-bold", tones[tone])}>{children}</span>;
}
