"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Item = { label: string; valor: number };

// Gráfico de barras horizontal simples e reutilizável para os relatórios.
export function BarrasChart({ data, cor = "#2563eb", altura = 280 }: { data: Item[]; cor?: string; altura?: number }) {
  if (data.length === 0) return null;
  return (
    <div style={{ width: "100%", height: altura }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={cor} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
