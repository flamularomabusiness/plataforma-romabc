# ROMA BC — Sistema Comercial (Fase 1)

Sistema interno para cadastro de contratos, gestão de clientes e acompanhamento
de pagamentos projetados, com home e menu adaptados por perfil de usuário.

## Tecnologias

- [Next.js 15](https://nextjs.org/) (App Router) + TypeScript
- [Supabase](https://supabase.com/) (PostgreSQL) via `@supabase/supabase-js`
- [TailwindCSS](https://tailwindcss.com/) + componentes no padrão [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query) para data fetching/cache
- React Hook Form + Zod para formulários e validação
- Recharts para os gráficos do dashboard

## Funcionalidades

- Formulário de novo contrato em 5 abas (Produto/UNE, Empresa, Contatos,
  Pagamento, Consultora), com múltiplos contatos por cliente, geração
  automática de 12 parcelas projetadas e campo de contexto/perfil do cliente.
- Painel com Dashboard (KPIs, receita projetada, clientes por dificuldade),
  lista de clientes com busca/filtro/paginação, detalhe do cliente e tela de
  edição (dados cadastrais, contratos e pagamentos).
- Perfis de acesso (Comercial, Gerente, Financeiro) com home e menu lateral
  adaptados por role — ver aviso sobre autenticação abaixo.

## Setup local

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env.local` e preencha com as credenciais do
   seu projeto Supabase:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica
   ```
3. Rode as migrations do banco — veja [supabase/README](#banco-de-dados-supabase) abaixo.
4. Suba o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Acesse [http://localhost:3000/login](http://localhost:3000/login) e escolha
   um perfil (Comercial, Gerente ou Financeiro) para entrar.

## Banco de dados (Supabase)

As definições de schema ficam em `supabase/*.sql`. Se for configurar um
projeto Supabase **novo do zero**, rode os arquivos nesta ordem:

1. `schema.sql`
2. `migration_grau_dificuldade.sql`
3. `fix_rls_anon_access.sql`
4. `migration_schema_real_alinhamento.sql`
5. `migration_contexto_perfil_cliente.sql`

> Se você já está usando o mesmo projeto Supabase do desenvolvimento, essas
> migrations já foram aplicadas — não é necessário rodar nada de novo.

## Deploy

Veja as instruções completas em [DEPLOY.md](DEPLOY.md).

## Avisos importantes

- **Autenticação simplificada**: o perfil do usuário (Comercial/Gerente/
  Financeiro) fica em `localStorage`, sem sessão de servidor nem senha. Serve
  para testar o fluxo por perfil, mas **não é controle de acesso real** —
  qualquer pessoa pode trocar sua própria role pelo console do navegador.
  Antes de expor o sistema para uso real, troque por autenticação de verdade
  (Supabase Auth, OAuth, etc.) e mova a checagem de permissão para o backend.
- **RLS desabilitado**: as tabelas do Supabase estão com Row Level Security
  desligado (uso interno, sem login real ainda). Reative e configure políticas
  antes de expor a chave anon publicamente em um ambiente sem outra camada de
  proteção.
