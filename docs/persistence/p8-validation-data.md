# P8 — persistência e dados de validação

## Contrato de execução

A Parte 8 registra uma tentativa com `simulation_sessions` e somente decisões do estudante com `simulation_actions`. Início/retomada, registro de decisão e avanço/conclusão passam pelas RPCs autorizadas; o cliente autenticado conserva apenas leitura own-only nas tabelas.

O `outcome` é um snapshot sanitizado da opção efetivamente escolhida. Ele contém versão do schema, rótulo da opção, classificação, feedback, consequência, destino autorizado, indicador de conclusão e estado de apresentação. Não contém regras, modelo de verdade ou avaliações das demais opções.

Os registros guardam apenas IDs técnicos, estado da tentativa, pontuação e resultado da decisão fictícia. A P8 não coleta nome, e-mail, telefone, CPF, CNS, IP, user-agent, geolocalização ou dados clínicos reais.

## Consultas administrativas de QA

As consultas abaixo exigem um papel administrativo apropriado. Elas não devem ser executadas pelo browser do estudante.

### Inícios e conclusões por caso

```sql
select
  case_id,
  count(*) as started,
  count(*) filter (where status = 'completed') as completed
from public.simulation_sessions
group by case_id
order by case_id;
```

### Escolhas e classificações por etapa

```sql
select
  step_id,
  selected_option_id,
  outcome ->> 'classification' as classification,
  count(*) as choices
from public.simulation_actions
group by step_id, selected_option_id, outcome ->> 'classification'
order by step_id, selected_option_id;
```

### Conferência da soma server-side

```sql
select
  session.id as session_id,
  session.score_total,
  coalesce(sum(action.score_delta), 0) as action_score_total
from public.simulation_sessions as session
left join public.simulation_actions as action
  on action.session_id = session.id
group by session.id, session.score_total
having session.score_total <> coalesce(sum(action.score_delta), 0);
```

Resultado esperado: nenhuma linha.

### Trajetória disponível para a P9

```sql
select
  session_id,
  step_id,
  selected_option_id,
  score_delta,
  outcome ->> 'classification' as classification,
  outcome ->> 'feedback' as feedback,
  outcome ->> 'consequence' as consequence,
  created_at
from public.simulation_actions
where session_id = '<session-id>'::uuid
order by created_at, id;
```

### Duplicatas que bloqueariam a migration

```sql
select user_id, case_id, count(*)
from public.simulation_sessions
where status = 'in_progress'
group by user_id, case_id
having count(*) > 1;

select session_id, step_id, count(*)
from public.simulation_actions
group by session_id, step_id
having count(*) > 1;
```

As duas consultas devem retornar zero linhas antes da aplicação da migration P8. A migration falha com mensagem explícita caso encontre duplicatas; ela não apaga histórico automaticamente.
