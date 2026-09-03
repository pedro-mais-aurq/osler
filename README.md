# OSLER — MVP

Plataforma educacional de simulação clínica interprofissional. Esta versão contém a primeira fatia vertical de simulação da Parte 4/10, sobre a fundação, o modelo mínimo de dados e o onboarding das Partes 1 a 3.

## Executar localmente

Requisito: Node.js 22 (`>=22.12.0`).

1. Execute `nvm use` ou selecione Node 22 no seu gerenciador de versões.
2. Instale exatamente o lockfile com `npm ci`.
3. Copie `.env.example` para `.env`.
4. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Inicie com `npm run dev`.

Use somente uma chave publishable/anon no cliente. Nunca exponha `service_role` no frontend ou no workflow de Pages.

## Verificações do frontend

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run dev`

O build de produção usa `/osler/` como base; o desenvolvimento local continua usando `/`.

## Fluxo da Parte 3

- `Sou aluno` reutiliza a sessão Supabase existente ou cria uma identidade com `signInAnonymously()`.
- O trigger versionado da Parte 2 cria `profiles` e `students`; o frontend não insere essas linhas.
- `/curso` persiste `nursing` ou `clinical_analysis` em `students.course`.
- `/simulacao` valida sessão, papel e curso, aceita somente um `?case=<uuid>` publicado do mesmo curso e, se necessário, escolhe deterministicamente o primeiro caso compatível.
- Sem caso publicado, a aplicação mostra um estado vazio e não publica a fixture técnica.
- `/professor` é somente um placeholder e não inicia autenticação.

A sessão é persistida pelo SDK do Supabase e o curso pelo banco; por isso ambos são retomados após refresh enquanto o armazenamento do navegador for preservado.

## Fluxo da Parte 4

- Para Enfermagem, `/simulacao` carrega caso publicado, paciente e somente a primeira etapa visível; cada avanço busca apenas a próxima etapa por `position`.
- Decisões enviam `case_id`, `step_id` e `option_id` à RPC `evaluate_case_step`; o navegador recebe somente classificação, variação de pontuação, feedback e consequência da opção escolhida.
- Regras e modelo de verdade permanecem privados. O frontend não consulta `case_step_rules` nem `case_truth_models`.
- Pontuação e decisões ficam apenas no estado local da página. Refresh durante o caso reinicia a tentativa; persistência em `simulation_sessions` e `simulation_actions` pertence à Parte 8.
- `/resultado` recebe o resumo mínimo via navigation state. Acesso direto não fabrica resultado.
- Análises Clínicas continua com estado vazio seguro e o fluxo do professor continua como placeholder.

O caso candidato `seguranca-ao-levantar-no-ambulatorio` está em `draft`, com `clinical_content_validated = false` e revisão humana pendente. Consulte `docs/cases/p4-nursing-case.md`. Ele não aparece para estudantes até que exista revisão clínica e pedagógica independente e uma publicação auditável.

## Supabase

O schema versionado está em `supabase/migrations` e a fixture técnica está em `supabase/seed.sql`. Com a CLI e um runtime compatível com Docker:

1. Execute `npx supabase@2.116.0 start`.
2. Recrie o banco local com `npx supabase@2.116.0 db reset`.
3. Rode os testes SQL com `npx supabase@2.116.0 test db`.

Para um projeto remoto, use `npx supabase@2.116.0 link --project-ref <project-ref>`, revise com `npx supabase@2.116.0 db push --dry-run` e aplique com `npx supabase@2.116.0 db push`. Migrations não são executadas pelo deploy do frontend.

Depois de aplicar o schema, gere os tipos completos com `npx supabase@2.116.0 gen types typescript --local > src/types/database.generated.ts`. O arquivo `src/types/database.ts` contém apenas a superfície mínima temporária necessária até a P4; não é um arquivo falsamente apresentado como output da CLI.

O ambiente local já está configurado com `enable_anonymous_sign_ins = true`. Pendência operacional do ambiente hospedado: **Habilitar anonymous sign-ins no projeto Supabase hospedado.** Faça isso em Auth no projeto OSLER correto; não use uma `service_role` no frontend.

O seed permanece técnico, com o caso `Caso estrutural de desenvolvimento` em `draft` e sem conteúdo clínico validado. A P4 não grava `simulation_sessions` nem `simulation_actions`; sua nova migration adiciona somente a RPC e o conteúdo candidato versionado necessário para revisão.

## GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` valida ambiente, tipagem e build antes de publicar. Configure no repositório:

- `Settings → Pages → Source → GitHub Actions`;
- secret `VITE_SUPABASE_URL`;
- secret `VITE_SUPABASE_ANON_KEY`.

O workflow cria `dist/404.html` para o fallback da SPA e não acessa nem altera o banco.
