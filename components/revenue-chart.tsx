"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBRL } from "@/lib/utils";
import type { ReceitaMensal } from "@/lib/types";

export function RevenueChart({ data }: { data: ReceitaMensal[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip formatter={(value: number) => formatBRL(value)} />
        <Line
          type="monotone"
          dataKey="projetada"
          name="Projetada"
          stroke="#5B4CF5"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="realizada"
          name="Realizada"
          stroke="#10B981"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
