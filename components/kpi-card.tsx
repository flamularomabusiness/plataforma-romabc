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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
        <Icon className={cn("h-5 w-5 text-primary", className)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{valor}</div>
      </CardContent>
    </Card>
  );
}
