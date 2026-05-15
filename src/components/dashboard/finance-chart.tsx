"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = {
  competencia: string;
  aberto: number;
  pago: number;
};

export function FinanceChart({ data }: { data: Row[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke="#e5decf" vertical={false} />
          <XAxis dataKey="competencia" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
          <Bar dataKey="pago" name="Pago" fill="#526b4e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="aberto" name="Aberto" fill="#b85b3f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
