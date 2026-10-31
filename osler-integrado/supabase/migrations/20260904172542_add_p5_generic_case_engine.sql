create or replace function private.resolve_simulation_transition_internal(
  p_case_id uuid,
  p_step_id uuid,
  p_option_id text default null
)
returns table (
  classification text,
  score_delta integer,
  feedback text,
  consequence text,
  next_step_key text,
  completed boolean,
  presentation_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_course public.course_code;
  v_step_type text;
  v_step_position integer;
  v_selected_rule jsonb;
  v_transition jsonb;
  v_target_metadata jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  select student.course
  into v_student_course
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = auth.uid()
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
      using errcode = '42501';
  end if;

  if v_student_course is null then
    raise exception 'Selecione um curso antes de iniciar a simulação.'
      using errcode = '42501';
  end if;

  perform 1
  from public.clinical_cases as clinical_case
  where clinical_case.id = p_case_id
    and clinical_case.status = 'published'::public.case_status
    and clinical_case.course = v_student_course;

  if not found then
    raise exception 'Caso publicado indisponível para o curso do estudante.'
      using errcode = 'P0001';
  end if;

  select case_step.step_type, case_step.position
  into v_step_type, v_step_position
  from public.case_steps as case_step
  where case_step.id = p_step_id
    and case_step.case_id = p_case_id;

  if not found or v_step_type not in ('information', 'decision') then
    raise exception 'Etapa inválida ou não suportada para este caso.'
      using errcode = 'P0001';
  end if;

  classification := null;
  score_delta := 0;
  feedback := null;
  consequence := null;
  next_step_key := null;
  completed := false;
  presentation_state := null;

  if v_step_type = 'information' then
    if p_option_id is not null then
      raise exception 'Etapas informativas não aceitam opção.' using errcode = 'P0001';
    end if;

    select next_step.step_key, next_step.metadata
    into next_step_key, v_target_metadata
    from public.case_steps as next_step
    where next_step.case_id = p_case_id
      and next_step.position > v_step_position
    order by next_step.position asc
    limit 1;

    completed := not found;
  else
    if p_option_id is null or btrim(p_option_id) = '' then
      raise exception 'Etapas de decisão exigem uma opção.' using errcode = 'P0001';
    end if;

    perform 1
    from public.case_steps as visible_step
    cross join lateral jsonb_array_elements(visible_step.options) as visible_option
    where visible_step.id = p_step_id
      and visible_step.case_id = p_case_id
      and jsonb_typeof(visible_option) = 'object'
      and visible_option ->> 'id' = p_option_id;

    if not found then
      raise exception 'Opção inválida para esta etapa.' using errcode = 'P0001';
    end if;

    select step_rule.rules -> 'options' -> p_option_id
    into v_selected_rule
    from public.case_step_rules as step_rule
    where step_rule.step_id = p_step_id;

    if not found
      or v_selected_rule is null
      or jsonb_typeof(v_selected_rule) <> 'object'
      or v_selected_rule ->> 'classification' not in (
        'ideal',
        'acceptable',
        'needs_improvement',
        'unsafe'
      )
      or jsonb_typeof(v_selected_rule -> 'score_delta') <> 'number'
      or (v_selected_rule ->> 'score_delta') !~ '^-?[0-9]+$'
      or jsonb_typeof(v_selected_rule -> 'feedback') <> 'string'
      or nullif(btrim(v_selected_rule ->> 'feedback'), '') is null
      or (
        v_selected_rule ? 'consequence'
        and jsonb_typeof(v_selected_rule -> 'consequence') not in ('string', 'null')
      )
    then
      raise exception 'Regra de avaliação indisponível para esta opção.'
        using errcode = 'P0001';
    end if;

    classification := v_selected_rule ->> 'classification';
    score_delta := (v_selected_rule ->> 'score_delta')::integer;
    feedback := v_selected_rule ->> 'feedback';
    consequence := nullif(btrim(v_selected_rule ->> 'consequence'), '');
    v_transition := v_selected_rule -> 'transition';

    if v_transition is null or jsonb_typeof(v_transition) = 'null' then
      select next_step.step_key, next_step.metadata
      into next_step_key, v_target_metadata
      from public.case_steps as next_step
      where next_step.case_id = p_case_id
        and next_step.position > v_step_position
      order by next_step.position asc
      limit 1;

      completed := not found;
    elsif jsonb_typeof(v_transition) <> 'object' then
      raise exception 'Transição inválida para esta opção.' using errcode = 'P0001';
    elsif v_transition ->> 'type' = 'step' then
      if jsonb_typeof(v_transition -> 'step_key') <> 'string'
        or nullif(btrim(v_transition ->> 'step_key'), '') is null
      then
        raise exception 'Transição de etapa sem destino válido.' using errcode = 'P0001';
      end if;

      select target_step.step_key, target_step.metadata
      into next_step_key, v_target_metadata
      from public.case_steps as target_step
      where target_step.case_id = p_case_id
        and target_step.step_key = v_transition ->> 'step_key';

      if not found then
        raise exception 'Destino da transição não pertence a este caso.'
          using errcode = 'P0001';
      end if;
    elsif v_transition ->> 'type' = 'complete' then
      completed := true;
      next_step_key := null;
    else
      raise exception 'Tipo de transição inválido.' using errcode = 'P0001';
    end if;

    if v_selected_rule ? 'presentation_state' then
      if jsonb_typeof(v_selected_rule -> 'presentation_state') <> 'string' then
        raise exception 'Estado de apresentação inválido.' using errcode = 'P0001';
      end if;

      presentation_state := v_selected_rule ->> 'presentation_state';
    end if;
  end if;

  if presentation_state is null and v_target_metadata ? 'presentation_state' then
    if jsonb_typeof(v_target_metadata -> 'presentation_state') <> 'string' then
      raise exception 'Estado de apresentação inválido.' using errcode = 'P0001';
    end if;

    presentation_state := v_target_metadata ->> 'presentation_state';
  end if;

  if presentation_state is not null
    and presentation_state not in ('stable', 'warning', 'critical', 'recovery')
  then
    raise exception 'Estado de apresentação inválido.' using errcode = 'P0001';
  end if;

  return next;
end;
$$;

revoke all on function private.resolve_simulation_transition_internal(uuid, uuid, text)
from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.resolve_simulation_transition_internal(uuid, uuid, text)
to authenticated;

comment on function private.resolve_simulation_transition_internal(uuid, uuid, text) is
  'P5 private implementation: validates and resolves one authorized transition without exposing rules or truth models.';

create or replace function public.resolve_simulation_transition(
  p_case_id uuid,
  p_step_id uuid,
  p_option_id text default null
)
returns table (
  classification text,
  score_delta integer,
  feedback text,
  consequence text,
  next_step_key text,
  completed boolean,
  presentation_state text
)
language sql
security invoker
set search_path = ''
as $$
  select
    resolved.classification,
    resolved.score_delta,
    resolved.feedback,
    resolved.consequence,
    resolved.next_step_key,
    resolved.completed,
    resolved.presentation_state
  from private.resolve_simulation_transition_internal($1, $2, $3) as resolved;
$$;

revoke all on function public.resolve_simulation_transition(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.resolve_simulation_transition(uuid, uuid, text)
to authenticated;

comment on function public.resolve_simulation_transition(uuid, uuid, text) is
  'P5 RPC: exposes only the sanitized result of the private authorized transition resolver.';
