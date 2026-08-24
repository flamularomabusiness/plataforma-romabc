# Deploy em Vercel

## Pré-requisitos

- Repositório Git com o projeto (GitHub, GitLab ou Bitbucket — GitHub é o mais
  comum com Vercel).
- Um projeto Supabase já configurado (veja [README.md](README.md#banco-de-dados-supabase)
  se for um projeto novo do zero).

## Passo a passo

1. **Suba o código para o Git remoto**, se ainda não tiver feito:
   ```bash
   git remote add origin <url-do-seu-repositorio>
   git push -u origin main
   ```

2. **No painel da Vercel** ([vercel.com](https://vercel.com)):
   - "Add New" → "Project"
   - Selecione o repositório
   - Framework Preset: Vercel detecta **Next.js** automaticamente — não é
     necessário alterar Build Command (`next build`) nem Output Directory.

3. **Configure as variáveis de ambiente** antes do primeiro deploy (ou depois,
   em Project Settings → Environment Variables):

   | Nome                            | Valor                                  |
   | -------------------------------- | --------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`       | URL do seu projeto Supabase             |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Chave `anon`/`public` do Supabase       |

   Marque os 3 ambientes (Production, Preview, Development) se quiser que
   preview deployments também funcionem contra o mesmo Supabase.

4. **Deploy**. A Vercel builda e publica automaticamente. Depois disso, todo
   push na branch de produção (normalmente `main`) gera um novo deploy, e
   pushes em outras branches/PRs geram *preview deployments* isolados.

## Depois do primeiro deploy

- Abra `https://<seu-projeto>.vercel.app/login` e confira se os 3 perfis
  carregam a home (`/painel/inicio`) e os dados do Supabase normalmente.
- Se o formulário ou os painéis aparecerem vazios, confira se as variáveis de
  ambiente foram salvas certinho (nomes exatos, sem espaços) e se o projeto
  Supabase é o mesmo que tem as tabelas/migrations aplicadas.

## Avisos importantes

- ⚠️ **Autenticação por localStorage não é segura para produção real** — ver
  aviso detalhado no [README.md](README.md#avisos-importantes). Use este
  deploy para validação/demonstração interna, não para expor a clientes finais
  sem antes trocar por autenticação de verdade.
- ⚠️ **Nunca commite `.env.local`** — já está no `.gitignore`. As credenciais
  do Supabase em produção vivem só nas Environment Variables da Vercel.
- ⚠️ **Backup do banco** — o Supabase faz backup automático nos planos pagos;
  confira em Project Settings → Database → Backups se o seu plano cobre isso
  antes de depender só disso.
