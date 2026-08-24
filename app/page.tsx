import Link from "next/link";
import { FileText, LayoutDashboard } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">ROMA BC</h1>
        <p className="mt-2 text-muted-foreground">Sistema Comercial — Fase 1</p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <Link
          href="/formulario"
          className="flex flex-col items-center gap-3 rounded-lg border p-8 shadow-sm transition-colors hover:bg-accent"
        >
          <FileText className="h-10 w-10 text-primary" />
          <span className="font-semibold">Novo Contrato</span>
          <span className="text-center text-sm text-muted-foreground">
            Cadastrar cliente, contatos e contrato
          </span>
        </Link>

        <Link
          href="/painel/dashboard"
          className="flex flex-col items-center gap-3 rounded-lg border p-8 shadow-sm transition-colors hover:bg-accent"
        >
          <LayoutDashboard className="h-10 w-10 text-primary" />
          <span className="font-semibold">Painel</span>
          <span className="text-center text-sm text-muted-foreground">
            Dashboard, clientes e pagamentos
          </span>
        </Link>
      </div>
    </main>
  );
}
