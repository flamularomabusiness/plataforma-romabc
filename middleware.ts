import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware só decide autenticado-ou-não (redireciona pra /login se não
// tiver sessão, e tira quem já está logado de /login e /signup). Controle
// por role (o que cada Funcionalidade permite) continua nas próprias páginas
// via useUserRole()/podeAcessar() (lib/auth.ts) — não duplicado aqui.
const ROTAS_PUBLICAS = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() (não getSession()) — sempre revalida contra o servidor de auth
  // do Supabase em vez de só ler o cookie local, então um token revogado/
  // expirado é pego aqui mesmo que o cookie ainda esteja no request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const rotaPublica = ROTAS_PUBLICAS.some((r) => path === r || path.startsWith(`${r}/`));

  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel/inicio";
    return NextResponse.redirect(url);
  }

  // Checagem de role/ativo aqui é reforço server-side além do listener em
  // lib/auth.ts (que só reage quando o client já está rodando) — cobre
  // também quem chega direto numa rota por link/refresh sem passar pelo
  // listener ainda.
  if (user && !rotaPublica) {
    const { data: linha } = await supabase.from("usuarios").select("role, ativo").eq("id", user.id).maybeSingle();

    if (linha && linha.ativo === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (path.startsWith("/painel/admin") && linha?.role !== "administrator") {
      const url = request.nextUrl.clone();
      url.pathname = "/painel/inicio";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Todas as rotas exceto assets estáticos e API routes (uma API route
    // interceptada por um redirect vira uma resposta HTML de redirecionamento
    // em vez de rodar — quebraria /api/importar-dados e o webhook).
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
