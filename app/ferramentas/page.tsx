import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FERRAMENTAS } from "@/lib/ferramentas/registro";

export default function FerramentasPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ferramentas</h1>
        <p className="text-sm text-muted-foreground">Ferramentas de apoio ao atendimento e à operação.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FERRAMENTAS.map(({ href, nome, descricao, icone: Icone }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full border-t-4 border-t-brand-secondary transition-shadow group-hover:shadow-md">
              <CardHeader>
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient">
                  <Icone className="h-5 w-5 text-white" />
                </span>
                <CardTitle className="text-lg">{nome}</CardTitle>
                <CardDescription>{descricao}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
