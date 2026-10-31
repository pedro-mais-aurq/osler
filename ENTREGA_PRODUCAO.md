# Osler — entrega de produção

Execute `npm ci`, configure `.env` a partir de `.env.example` e use `npm run dev` ou `npm run build:production`.

O acesso de professor e aluno usa Google OAuth com PKCE. Nenhuma conta fictícia é disponibilizada no modo conectado. Casos, turmas, matrículas, decisões, tentativas e debriefings usam os serviços e RPCs do Supabase; não existe fallback automático para armazenamento local quando a conexão falta.

Aplique as migrations de `supabase/migrations` na ordem registrada, sem repetir migrations já aplicadas. As duas últimas implementam a gestão docente e a visibilidade pública/privada com prática sem turma. As tabelas possuem RLS. Autorize os e-mails docentes na lista privada conforme `docs/teaching/GUIA_PROFESSOR.md`.

Habilite o provedor Google no Supabase usando o Client ID e o Client Secret do Google Cloud. Cadastre o callback indicado pelo Supabase no Google e a URL da aplicação terminada em `/auth/callback` na lista de retornos permitidos. Nunca inclua o Client Secret ou a chave service_role no frontend.

Os casos demonstrativos não são importados automaticamente para o banco de produção. Publique conteúdo revisado pelo painel docente; o catálogo só mostra os casos efetivamente publicados no banco. A demonstração técnica continua disponível exclusivamente pelos comandos explícitos `dev:local` e `package:local`, fora do fluxo de produção.

Esta entrega contém código conectado e migrations; a ativação exige o projeto Supabase correto da Osler, sua chave pública e o provedor Google configurado. Não foram alterados projetos de outros clientes.
