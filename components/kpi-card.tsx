import { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  titulo: string;
  valor: string;
  icone: LucideIcon;
  className?: string;
}

export function KpiCard({ titulo, valor, icone: Icon, className }: KpiCardProps) {
  return (
    <Card className="border-t-4 border-t-brand-secondary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient">
          <Icon className={cn("h-4 w-4 text-white", className)} />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{valor}</div>
      </CardContent>
    </Card>
  );
}
