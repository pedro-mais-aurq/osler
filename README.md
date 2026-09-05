# OSLER — MVP

Plataforma educacional de simulação clínica interprofissional. Esta versão contém duas áreas profissionais no mesmo motor, persistência server-authoritative e debriefing histórico por tentativa, concluindo a Parte 9/10 do MVP.

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
- Na entrega P4, pontuação e decisões ainda eram locais. A Parte 8 supera esse contrato e restaura sessão, etapa, score e feedback persistidos após refresh.
- `/resultado?session=<uuid>` reconstrói um debriefing concluído pelo identificador da tentativa; navigation state não é fonte de autoridade.
- Na entrega P4, Análises Clínicas ainda usava o estado vazio seguro. Desde a P7, os dois cursos percorrem o mesmo motor; o fluxo do professor continua como placeholder.

O caso candidato `seguranca-ao-levantar-no-ambulatorio` está em `draft`, com `clinical_content_validated = false` e revisão humana pendente. Consulte `docs/cases/p4-nursing-case.md`. Ele não aparece para estudantes até que exista revisão clínica e pedagógica independente e uma publicação auditável.

## Motor da Parte 5

- `SimulationPage` cuida somente de identidade, curso, resolução/carregamento do caso, estados de página e navegação; `SimulationEngine` recebe dados normalizados e mantém o ciclo genérico de início, seleção, avaliação, avanço e conclusão.
- `StepRenderer` suporta as etapas discriminadas `information` e `decision`. Um tipo desconhecido falha de modo amigável e não é interpretado como outro tipo.
- O cliente carrega apenas a primeira etapa e, depois, somente a `step_key` sanitizada escolhida pela RPC. Não há preload de etapas futuras.
- `resolve_simulation_transition` valida estudante, curso, caso publicado, etapa, opção, regra privada e destino. Ela suporta fallback linear, ramificação simples para outra etapa do mesmo caso e conclusão explícita.
- Classificação, pontuação e feedback continuam vindo apenas da regra da opção selecionada. O estado visual `stable | warning | critical | recovery` é uma projeção explícita, independente da pontuação e do modelo de verdade.
- Tipos de domínio e adapters camelCase vivem em `src/features/simulation`; `src/types/database.ts` não se apresenta como arquivo gerado pela CLI.
- A resolução científica do motor permanece independente da persistência. A Parte 8 passa a orquestrar sessões e decisões por RPC sem introduzir lógica de curso no reducer.

Novos casos lineares ou com ramificações simples podem ser adicionados por dados, sem alterar o motor. O mesmo vale para casos de `clinical_analysis`: basta haver conteúdo publicado e autorizado para o curso. A camada visual pode ser substituída na Parte 6 sem mudar o reducer ou o contrato de transição.

## Persistência da Parte 8

- `start_or_resume_simulation_session` cria uma tentativa ou devolve a única sessão `in_progress` do usuário e caso.
- `record_simulation_decision` usa a regra privada P5, persiste apenas o resultado sanitizado da opção escolhida e atualiza o score na mesma transação.
- `advance_simulation_session` determina o destino no servidor, persiste `current_step_id` e conclui com `completed_at` server-side.
- Retries da mesma decisão e do mesmo avanço são idempotentes; índices únicos impedem sessão ativa ou decisão duplicada.
- O papel `authenticated` não pode inserir/atualizar diretamente as tabelas de execução. RLS mantém a leitura limitada aos próprios registros.
- Refresh restaura etapa atual, score, contagem e feedback já persistido sem carregar etapas futuras.
- O resultado mínimo transporta `sessionId`; a P9 usa esse identificador para consultar o histórico concluído sem recalcular regras atuais.

## Debriefing da Parte 9

- `get_simulation_debrief` entrega somente uma tentativa `completed` pertencente ao estudante autenticado e permanece disponível quando o caso é arquivado.
- A trajetória é ordenada por `created_at, id` e usa exclusivamente o snapshot de resultado gravado pela P8: escolha, classificação, pontuação, feedback e consequência não são recalculados.
- O frontend valida uma resposta com whitelist estrita. Modelo de verdade, regras privadas, outras opções e identidade do usuário não integram o contrato.
- A bibliografia é uma projeção sanitizada de `evidence`, limitada a identificador, autoridade, título, ano, URL HTTP(S) e data de verificação.
- Pontuação é apresentada como valor bruto e as classificações descrevem somente aquela tentativa; o debriefing não atribui nota nem infere competência profissional geral.
- Refresh e acesso direto à URL preservam o resultado. UUID inválido, tentativa inexistente, alheia ou ainda em andamento compartilham a mesma resposta segura de indisponibilidade; falhas transitórias oferecem nova tentativa.

As consultas de validação e o contrato de privacidade estão em `docs/persistence/p8-validation-data.md`.

## Supabase

O schema versionado está em `supabase/migrations` e a fixture técnica está em `supabase/seed.sql`. Com a CLI e um runtime compatível com Docker:

1. Execute `npx supabase@2.116.0 start`.
2. Recrie o banco local com `npx supabase@2.116.0 db reset`.
3. Rode os testes SQL com `npx supabase@2.116.0 test db`.

Para um projeto remoto, use `npx supabase@2.116.0 link --project-ref <project-ref>`, revise com `npx supabase@2.116.0 db push --dry-run` e aplique com `npx supabase@2.116.0 db push`. Migrations não são executadas pelo deploy do frontend.

Depois de aplicar o schema, gere os tipos completos com `npx supabase@2.116.0 gen types typescript --local > src/types/database.generated.ts`. O arquivo `src/types/database.ts` contém apenas a superfície mínima temporária de infraestrutura; não é um arquivo falsamente apresentado como output da CLI.

O ambiente local já está configurado com `enable_anonymous_sign_ins = true`. Pendência operacional do ambiente hospedado: **Habilitar anonymous sign-ins no projeto Supabase hospedado.** Faça isso em Auth no projeto OSLER correto; não use uma `service_role` no frontend.

O seed permanece técnico, com o caso `Caso estrutural de desenvolvimento` em `draft` e sem conteúdo clínico validado. A entrega P4 não gravava `simulation_sessions` nem `simulation_actions`; a P8 passa a fazê-lo exclusivamente pelas RPCs autorizadas.

## GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` valida ambiente, tipagem e build antes de publicar. Configure no repositório:

- `Settings → Pages → Source → GitHub Actions`;
- secret `VITE_SUPABASE_URL`;
- secret `VITE_SUPABASE_ANON_KEY`.

O workflow cria `dist/404.html` para o fallback da SPA e não acessa nem altera o banco.
