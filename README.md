# OSLER — Plataforma integrada

A landing page, as páginas do projeto e dos fundadores, a área docente, as atividades dos alunos, o motor determinístico e o debriefing fazem parte da mesma aplicação React.

## Experimentar

Abra `preview-local/Osler_Demonstracao_Local.html` no navegador. O arquivo contém a aplicação completa, com imagens e fontes, sem precisar de servidor ou banco online.

Para executar o código-fonte com Node.js 22.12 ou superior:

```sh
npm ci
npm run dev:local
```

Na página inicial, use **Começar a aprender** ou **Acessar plataforma**. Em **Sou aluno**, entre como `ana@osler.demo` para explorar Enfermagem ou `clara@osler.demo` para Análises Clínicas. O botão **Explorar minha formação** mantém a escolha da landing. Para testar sem turma, use um novo e-mail fictício no campo de aluno. **Sou professor** abre o painel com turmas, casos, atividades e debriefings. Os dados ficam neste navegador.

Após entrar como aluno, escolha Enfermagem ou Análises Clínicas e, em **Como você quer aprender?**, decida entre **Entrar em uma turma** e **Praticar sem turma**. A turma aceita o código fornecido pelo professor ou o convite por e-mail já cadastrado. O caminho individual abre **Casos públicos**, sem exigir matrícula. Trocar de formação mantém a identidade do aluno. É possível alternar os caminhos depois, preservando os vínculos e o histórico.

Cada formação agora oferece dois casos na demonstração. Os novos cenários **Medicação segura: identificação e alergias** e **Amostra hemolisada: qualidade antes do resultado** têm sete etapas e cinco decisões cada. Os dois novos casos estão publicados como públicos na demonstração; os anteriores ficam nas atividades de turma. Os roteiros também estão disponíveis para adaptação no painel do professor. A atualização preserva os dados já existentes. Veja o [roteiro das etapas e as referências](docs/cases/two-complete-cases.md).

A demonstração guiada de interface permanece em `/demonstracao`; as atividades acessadas pelo aluno usam o motor completo, persistem decisões e produzem debriefing. A navegação preserva os identificadores de caso, atividade e tentativa, inclusive ao refazer um caso ou reabrir seu resultado.

## Conectar ao Supabase

Copie `.env.example` para `.env`, configure a URL e uma chave **pública** Supabase e execute `npm run dev:online`. `npm run build` gera a versão conectada; `npm run build:local` gera explicitamente a demonstração local. Ausência de credenciais nunca habilita a demonstração em produção automaticamente.

O login Google e a autorização docente usam os serviços da versão mais recente do motor. Habilite o provedor Google, configure a URL de retorno `<origem><VITE_BASE_PATH>auth/callback` no Supabase e autorize os e-mails docentes conforme [o guia do professor](docs/teaching/GUIA_PROFESSOR.md). A formação escolhida na landing é retomada depois do login; o papel efetivo vem do servidor.

Todas as migrations anteriores foram mantidas. A nova `20261030231749_public_cases_and_optional_classrooms.sql` acrescenta visibilidade, catálogo público, códigos de turma e autorização das tentativas individuais. Ela deve ser aplicada após `20261030181637_teacher_classrooms_google_auth.sql`. Nenhuma alteração foi aplicada ao banco online nesta entrega. Veja o [guia de participação e acesso](docs/teaching/PUBLICO_E_TURMAS.md).

Na criação de casos, **Privado** é o padrão e exige uma atividade em turma autorizada. **Público** permite prática por qualquer aluno autenticado após a publicação; rascunhos nunca aparecem no catálogo. Tentativas individuais e seus debriefings ficam no histórico do próprio aluno e não aparecem no acompanhamento do professor.

## Rotas

| Rota | Experiência |
| --- | --- |
| `/` | Landing institucional |
| `/projeto`, `/fundadores` | Páginas institucionais completas |
| `/entrar` | Acesso de aluno e professor |
| `/professor/*` | Gestão docente |
| `/aluno` | Atividades e tentativas do aluno |
| `/curso` | Seleção de formação |
| `/participacao` | Escolha entre turma e prática individual |
| `/casos-publicos` | Catálogo e histórico individual |
| `/simulacao?case=…&atividade=…` | Motor em uma atividade de turma |
| `/simulacao?case=…&modo=publico` | Motor em prática individual pública |
| `/resultado?session=…&atividade=…` | Debriefing da tentativa |
| `/demonstracao` | Primeiro contato ilustrativo com a interface |
| `/auth/callback` | Retorno do Google |

No modo local, as mesmas rotas usam `#/` para funcionar ao abrir o HTML diretamente. O ambiente conectado usa URLs normais e respeita `VITE_BASE_PATH`. No GitHub Pages, o workflow configura essa base a partir do nome do repositório.

## Verificação e empacotamento

```sh
npm test
npm run typecheck
npm run test:db:offline
npm run build
npm run package:local
```

Os testes de integração percorrem a landing, os perfis, as formações, o motor e o debriefing usando os serviços locais reais. O teste de banco aplica as migrations em PostgreSQL isolado. O login Google real requer as credenciais e a configuração do ambiente conectado.

O motor e os contratos anteriores permanecem documentados em `docs/cases`, `docs/persistence` e `docs/demo`. O guia de gestão docente está em `docs/teaching`.
