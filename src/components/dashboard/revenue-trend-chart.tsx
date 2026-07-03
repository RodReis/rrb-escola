"use client";

import { LineChart } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/constants";
import type { RevenueTrendPoint } from "@/lib/data/dashboard-executive";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function labelMes(c: string): string {
  const [, m] = c.split("-").map(Number);
  return MESES[(m as number) - 1] ?? c;
}

export function RevenueTrendChart({ data }: { data: RevenueTrendPoint[] }) {
  const chartData = data.map((p) => ({
    mes: labelMes(p.competencia),
    Receita: p.receita,
    Custos: p.custos,
  }));

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
          <LineChart size={16} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-ink">Receita × Custos</h3>
          <p className="text-[0.66rem] text-ink/60">tendência últimos 6 meses</p>
        </div>
      </div>
      <div className="mt-5 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-brand))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="rgb(var(--color-brand))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="custosGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-danger))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="rgb(var(--color-danger))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgb(var(--color-line))" vertical={false} />
            <XAxis dataKey="mes" stroke="rgb(var(--color-ink) / 0.5)" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              stroke="rgb(var(--color-ink) / 0.5)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number) => money.format(value)}
              contentStyle={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-line))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="Receita" stroke="rgb(var(--color-brand))" fill="url(#receitaGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="Custos" stroke="rgb(var(--color-danger))" fill="url(#custosGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
