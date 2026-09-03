# OSLER — MVP

Plataforma educacional de simulação clínica interprofissional. Esta versão contém a fundação do frontend e o modelo mínimo de dados da Parte 2/10.

## Executar localmente

Requisito: Node.js 22 (`>=22.12.0`).

1. Execute `nvm use` ou selecione Node 22 no seu gerenciador de versões.
2. Instale exatamente o lockfile com `npm ci`.
3. Copie `.env.example` para `.env`.
4. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Inicie com `npm run dev`.

Use somente uma chave publishable/anon no cliente. Nunca exponha `service_role` no frontend ou no workflow de Pages.

## Verificações do frontend

- `npm run typecheck`
- `npm run build`
- `npm run dev`

O build de produção usa `/osler/` como base; o desenvolvimento local continua usando `/`.

## Supabase

O schema versionado está em `supabase/migrations` e a fixture técnica está em `supabase/seed.sql`. Com a CLI e um runtime compatível com Docker:

1. Execute `npx supabase@2.116.0 start`.
2. Recrie o banco local com `npx supabase@2.116.0 db reset`.
3. Rode os testes SQL com `npx supabase@2.116.0 test db`.

Para um projeto remoto, use `npx supabase@2.116.0 link --project-ref <project-ref>`, revise com `npx supabase@2.116.0 db push --dry-run` e aplique com `npx supabase@2.116.0 db push`. Migrations não são executadas pelo deploy do frontend.

Depois de aplicar o schema, gere os tipos completos com `npx supabase@2.116.0 gen types typescript --local > src/types/database.generated.ts`. O arquivo `src/types/database.ts` contém apenas a superfície mínima temporária usada pela leitura de catálogo.

A Parte 2 não implementa login nem autenticação anônima. O trigger de identidade apenas prepara novos usuários como estudantes; a criação da identidade e a escolha do curso pertencem à Parte 3.

## GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` valida ambiente, tipagem e build antes de publicar. Configure no repositório:

- `Settings → Pages → Source → GitHub Actions`;
- secret `VITE_SUPABASE_URL`;
- secret `VITE_SUPABASE_ANON_KEY`.

O workflow cria `dist/404.html` para o fallback da SPA e não acessa nem altera o banco.
