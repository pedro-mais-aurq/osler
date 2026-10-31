# Osler — Sala de aula do professor

## Testar sem banco e sem instalar dependências

Abra `preview-local/Osler_Demonstracao_Local.html` em um navegador atualizado. O arquivo contém a aplicação, estilos, logos e pacientes ilustrados. A navegação usa `#` e os dados ficam no armazenamento deste navegador. Não há conexão com Supabase, Google ou APIs externas na demonstração.

Se o navegador restringir o armazenamento de arquivos abertos pelo disco, sirva a pasta com:

```sh
python3 -m http.server 8080 --directory preview-local
```

Depois, abra `http://localhost:8080/Osler_Demonstracao_Local.html`.

Contas de demonstração:

| Perfil | E-mail | Acesso inicial |
| --- | --- | --- |
| Professora Helena | professora@osler.demo | Duas turmas, quatro casos publicados e um rascunho |
| Ana Martins | ana@osler.demo | Enfermagem; tentativa concluída com devolutiva |
| Lucas Oliveira | lucas@osler.demo | Enfermagem; trajetória com pontos de atenção |
| Beatriz Souza | beatriz@osler.demo | Enfermagem; pronta para iniciar |
| Rafael Lima | rafael@osler.demo | Enfermagem; pronto para iniciar |
| Clara Alves | clara@osler.demo | Análises clínicas; tentativa concluída |
| João Santos | joao@osler.demo | Análises clínicas; pronto para iniciar |
| Novo aluno | novo.aluno@osler.demo | Convite pendente; vínculo automático ao entrar |

O professor pode adicionar outro e-mail de teste à turma. Na entrada local, digite esse endereço no campo do aluno para concluir o vínculo. Todos os dados são fictícios. Os casos demonstram o funcionamento do software e não constituem conteúdo clínico validado.

O botão **Restaurar demonstração** apaga somente as alterações da demonstração deste navegador. Os dados locais não são enviados nem migrados automaticamente para produção.

## Executar o código

Requisito: Node.js 22.12 ou superior.

```sh
npm ci
npm run dev:local
```

`npm run dev` também abre a demonstração. Não é necessário criar `.env`. Mesmo que existam credenciais no ambiente, o modo `demo` não instancia o cliente Supabase.

Para recriar o HTML autossuficiente:

```sh
npm run package:local
```

Para trabalhar no modo conectado:

```sh
cp .env.example .env
# Preencha a URL e a chave pública do projeto correto.
npm run dev:online
```

`npm run build` gera a versão conectada. A base é configurável por `VITE_BASE_PATH`; o workflow do GitHub Pages usa o nome do repositório. `npm run build:local` gera a versão de demonstração com base `/`. A aplicação não troca automaticamente para dados fictícios quando faltam credenciais em produção.

## Fluxo do professor

1. **Turmas:** crie uma turma com nome, curso, período e descrição. O detalhe da turma exibe seu código de entrada; copie-o e compartilhe com os alunos que deseja receber. O curso fica fixo depois da primeira atividade. Arquivar bloqueia o acesso dos alunos; reabrir restaura as atividades que ainda estiverem abertas.
2. **Alunos:** cadastre até 100 e-mails por operação. Os endereços são normalizados e duplicados não criam novos vínculos. O cadastro libera acesso e não envia mensagens de e-mail.
3. **Casos:** crie rascunhos, inclusive incompletos, e salve o progresso. Em **Visibilidade do caso**, escolha **Privado** (padrão, acesso por atividade nas turmas autorizadas) ou **Público** (após publicar, qualquer aluno autenticado pode praticar sem turma). Rascunhos permanecem disponíveis apenas ao autor, independentemente da seleção. Acrescente informações, observações e decisões. Cada alternativa tem classificação, variação de pontuação, feedback, consequência e estado visual. Pode avançar, concluir ou saltar para uma etapa posterior. Ciclos não são aceitos, em conformidade com a persistência de uma decisão por etapa.
4. **Publicação:** complete o contexto, paciente fictício, objetivo, etapas, referências e confirmação de revisão. Publicar preserva a versão. Para alterações futuras, duplique o caso. Arquivar encerra suas atividades e mantém as tentativas históricas.
5. **Atividades:** disponibilize um caso publicado do mesmo curso na turma. O prazo é orientativo, na hora local do navegador. Encerrar bloqueia novas decisões, inclusive de tentativas já iniciadas. Reabrir permite retomada.
6. **Debriefings:** filtre por turma, atividade e e-mail. Cada tentativa concluída mostra as escolhas, feedbacks e consequências gravados pelo motor. A devolutiva escrita do professor aparece nas atividades do aluno. Tentativas interrompidas e em andamento aparecem no acompanhamento; o debriefing completo exige conclusão.

O painel consulta atualizações a cada 20 segundos enquanto está visível. Também há atualização manual. A pontuação é bruta e contextual à tentativa; não é automaticamente uma nota nem uma medida de competência profissional.

## Fluxo do aluno

Entre com sua conta Google, escolha a formação e decida como estudar. **Entrar em uma turma** permite usar o código do professor; convites cadastrados por e-mail são vinculados à identidade confirmada no servidor. Entrar pelo código seleciona a formação da turma. Abra uma atividade, conclua o caso e veja o debriefing e a devolutiva em **Minhas atividades**.

Em **Praticar sem turma**, abra **Casos públicos**, inicie um caso e retome a tentativa após atualizar a página. As conclusões ficam em **Minhas tentativas individuais**, com debriefing próprio. Essa prática não é enviada ao professor, mesmo que você já pertença a uma turma. É possível alternar os caminhos sem apagar vínculos ou histórico. A escolha do caminho não remove uma matrícula existente.

Cada atividade possui tentativas próprias, mesmo quando o mesmo caso é usado em duas turmas ou dois encontros. Remover o acesso de um aluno impede novas execuções; o histórico já submetido continua disponível ao próprio aluno e ao professor da atividade. Uma mudança no e-mail Google exige um novo cadastro na turma. Os relatórios preservam o endereço apresentado no início da tentativa.

## Preparar o Supabase de produção

Nenhuma alteração foi aplicada ao banco online nesta entrega. As migrations de gestão e de acesso são, nesta ordem:

- `supabase/migrations/20261030181637_teacher_classrooms_google_auth.sql`
- `supabase/migrations/20261030231749_public_cases_and_optional_classrooms.sql`

Elas pressupõem as migrations anteriores do ZIP. Não execute novamente migrations que o projeto já registrou. Faça backup e revise o `dry-run` antes da implantação.

A migration acrescenta turmas, vínculos por e-mail, rascunhos privados do autor, atividades, vínculo da tentativa à atividade, e-mail histórico e devolutivas. Os resultados do motor e as tentativas anteriores são mantidos. A migration de visibilidade preserva publicados legados sem autor como públicos e mantém privados os casos docentes existentes. Casos novos começam privados. Códigos só aceitam turmas ativas e não restabelecem uma matrícula revogada. Consulte a [matriz de acesso](PUBLICO_E_TURMAS.md).

### Google OAuth

1. No Google Cloud, crie um cliente OAuth de aplicação web e configure a tela de consentimento. Para teste, inclua as contas permitidas pelo seu modo de publicação do Google.
2. Cadastre como URI de redirecionamento autorizada do Google a URL **exata** exibida pelo provedor Google no painel Supabase, normalmente `https://PROJECT_REF.supabase.co/auth/v1/callback`.
3. Em Supabase → Authentication → Sign In / Providers → Google, habilite o provedor e informe Client ID e Client Secret. O segredo permanece no Supabase.
4. Em Authentication → URL Configuration, configure o Site URL e permita os retornos da aplicação. Para o GitHub Pages atual: `https://SEU_USUARIO.github.io/osler/auth/callback`. Para teste conectado local: `http://localhost:5173/auth/callback`. Use as URLs e a porta reais do ambiente.
5. No frontend, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A chave antiga `VITE_SUPABASE_ANON_KEY` continua aceita. Nunca coloque Client Secret, chave secreta Supabase ou `service_role` no frontend.
6. Aplique as migrations e habilite os professores autorizados conforme abaixo. No primeiro login, a função `teaching_bootstrap` cria o vínculo da conta com seus convites.

A aplicação usa OAuth com PKCE. Apenas `email` e `profile` são solicitados. A configuração de Google não pode ser completada só com uma migration: exige as credenciais e os retornos do seu projeto. O OAuth real não foi exercitado nesta entrega por não terem sido fornecidas credenciais.

### Autorizar professores

O botão “Sou professor” não concede o papel por si só. Um responsável pelo projeto deve cadastrar o e-mail na lista privada pelo SQL Editor, usando uma conta administrativa:

```sql
insert into private.teacher_allowlist (email, enabled)
values (lower(trim('professor@instituicao.edu.br')), true)
on conflict (email) do update set enabled = excluded.enabled;
```

O professor entra com essa conta Google. A autorização depende do e-mail confirmado em `auth.users` e de uma identidade Google com e-mail verificado correspondente em `auth.identities`. Metadados editáveis pelo usuário nunca concedem o papel. Não há função pública para um aluno se promover.

Para revogar o acesso docente:

```sql
update private.teacher_allowlist
set enabled = false
where email = lower(trim('professor@instituicao.edu.br'));
```

As operações do professor consultam a autorização no banco; a revogação não depende de atualizar uma claim antiga no navegador. Administradores previamente provisionados em `admins` e `profiles` também podem usar a área, dentro das mesmas regras de autoria e propriedade.

### Aplicar depois da homologação

A CLI usada para criar a migration foi a 2.116.0. Descubra as opções da versão instalada com `--help`.

```sh
npx supabase@2.116.0 link --project-ref SEU_PROJECT_REF
npx supabase@2.116.0 db push --dry-run
npx supabase@2.116.0 db push
```

O deploy do frontend não executa migrations. Ao publicar em Pages, mantenha o fallback SPA para `auth/callback` e cadastre a URL correta no Supabase. Os fluxos antigos anônimos permanecem no backend para compatibilidade com tentativas e integrações anteriores; a entrada nova usa Google para professor e aluno.

## Contratos e segurança

- RLS em todas as tabelas expostas; escrita de gestão somente por RPCs com verificação de propriedade.
- Corpos privilegiados novos ficam no schema `private`, com `search_path` vazio e privilégios explícitos. As fachadas públicas são `SECURITY INVOKER`.
- Apenas o autor lê o rascunho completo e as regras. Alunos recebem contexto, alternativas visíveis e o resultado da escolha, sem o gabarito das outras opções.
- As APIs antigas de avaliação sem sessão não avaliam casos criados por professores; as escolhas desses casos precisam ser registradas em uma sessão autorizada, impedindo consultas livres ao gabarito.
- O professor lê apenas tentativas explicitamente ligadas às atividades de suas turmas; o vínculo atual de um aluno não permite inspecionar suas tentativas pessoais ou de outro professor.
- Convite é comparado ao e-mail confirmado no banco, nunca a um e-mail enviado pelo aluno no payload da simulação.
- Os snapshots do motor continuam sendo a fonte do debriefing. A avaliação não é recalculada ao abrir um resultado antigo.
- A RPC `start_or_resume_simulation_session` aceita `p_assignment_id` opcional. Sem atividade, o caso precisa estar publicado e público; com atividade, a matrícula e a disponibilidade da turma são sempre verificadas, mesmo para um caso público.
- Há um índice único por usuário, caso e atividade para tentativas em andamento. Decisões e avanços mantêm a idempotência.

## Validação realizada

```sh
npm test
npm run typecheck
npm run test:db:offline
npm run build
npm run package:local
```

O teste offline aplica todas as migrations a um PostgreSQL/WASM isolado com primitivas Auth simuladas, e exercita publicação, autorização, RLS, matrícula atômica, e-mail normalizado, privacidade, tentativas por atividade e individuais, catálogo público, visibilidade privada, código de turma, conclusão, histórico, devolutivas e revogação. Não conecta a projetos Supabase. O esquema Auth simplificado desse teste não substitui uma homologação de Google, PostgREST e serviços Supabase completos.

Com Docker e Supabase CLI disponíveis, a homologação adicional é:

```sh
npx supabase@2.116.0 start
npx supabase@2.116.0 db reset
npx supabase@2.116.0 test db
```

Não execute `db reset` contra produção. Os testes pgTAP legados foram ajustados para a nova assinatura de início e para as fachadas públicas; Docker não estava disponível nesta entrega para executá-los. O fluxo visual professor → turma → caso publicado → atividade → aluno → decisão → debriefing também foi conferido no navegador.
