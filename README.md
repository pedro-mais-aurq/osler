# OSLER — MVP

Fundação técnica da plataforma educacional de simulação clínica interprofissional.

## Executar localmente

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env` e preencha as variáveis do projeto Supabase.
3. Inicie a aplicação com `npm run dev`.

## Variáveis de ambiente

- `VITE_SUPABASE_URL`: URL pública do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: chave anon/publishable destinada ao cliente web.

Nunca use a chave `service_role` no frontend.

## Verificações

- `npm run typecheck`
- `npm run build`

Esta entrega corresponde somente à Parte 1/10. Ela não contém schema, autenticação, conteúdo clínico nem lógica de simulação.
