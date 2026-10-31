-- P8 makes simulation execution server-authoritative. Existing rows are never
-- discarded automatically: duplicate active sessions or duplicate decisions
-- must be resolved explicitly before this migration can be applied.

do $$
begin
  if exists (
    select 1
    from public.simulation_sessions as simulation_session
    where simulation_session.status = 'in_progress'::public.simulation_status
    group by simulation_session.user_id, simulation_session.case_id
    having count(*) > 1
  ) then
    raise exception
      'P8 migration blocked: duplicate in-progress simulation sessions exist for the same user and case. Resolve them explicitly before retrying.';
  end if;

  if exists (
    select 1
    from public.simulation_actions as simulation_action
    group by simulation_action.session_id, simulation_action.step_id
    having count(*) > 1
  ) then
    raise exception
      'P8 migration blocked: duplicate simulation actions exist for the same session and step. Resolve them explicitly before retrying.';
  end if;
end
$$;

create unique index simulation_sessions_one_active_per_user_case_idx
  on public.simulation_sessions (user_id, case_id)
  where status = 'in_progress'::public.simulation_status;

create unique index simulation_actions_one_decision_per_step_idx
  on public.simulation_actions (session_id, step_id);

-- P2 intentionally exposed a provisional direct-write surface. P8 supersedes
-- that contract: execution writes now happen exclusively through RPCs.
revoke insert (user_id, case_id)
  on public.simulation_sessions from authenticated;
revoke update (status, current_step_id, completed_at)
  on public.simulation_sessions from authenticated;
revoke insert (session_id, user_id, step_id, selected_option_id)
  on public.simulation_actions from authenticated;
revoke all privileges on table
  public.simulation_sessions,
  public.simulation_actions
from authenticated;
grant select on table
  public.simulation_sessions,
  public.simulation_actions
to authenticated;

drop policy if exists simulation_sessions_insert_own_published_case
  on public.simulation_sessions;
drop policy if exists simulation_sessions_update_own
  on public.simulation_sessions;
drop policy if exists simulation_actions_insert_own_session
  on public.simulation_actions;

create or replace function public.start_or_resume_simulation_session(
  p_case_id uuid
)
returns table (
  session_id uuid,
  case_id uuid,
  status public.simulation_status,
  current_step_id uuid,
  current_step_key text,
  score_total integer,
  decision_count integer,
  started_at timestamptz,
  resumed boolean,
  selected_option_id text,
  classification text,
  score_delta integer,
  feedback text,
  consequence text,
  next_step_key text,
  transition_completed boolean,
  presentation_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_course public.course_code;
  v_case_id uuid;
  v_first_step_id uuid;
  v_session public.simulation_sessions%rowtype;
  v_action public.simulation_actions%rowtype;
  v_current_step_key text;
  v_current_step_state text;
  v_decision_count integer;
  v_resumed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  select student.course
  into v_student_course
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = v_user_id
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
      using errcode = '42501';
  end if;

  if v_student_course is null then
    raise exception 'Selecione um curso antes de iniciar a simulação.'
      using errcode = '42501';
  end if;

  select clinical_case.id
  into v_case_id
  from public.clinical_cases as clinical_case
  where clinical_case.id = p_case_id
    and clinical_case.status = 'published'::public.case_status
    and clinical_case.course = v_student_course;

  if not found then
    raise exception 'Caso publicado indisponível para o curso do estudante.'
      using errcode = 'P0001';
  end if;

  select case_step.id
  into v_first_step_id
  from public.case_steps as case_step
  where case_step.case_id = v_case_id
    and case_step.step_type in ('information', 'decision')
  order by case_step.position asc
  limit 1;

  if not found then
    raise exception 'O caso publicado não possui uma primeira etapa.'
      using errcode = 'P0001';
  end if;

  select simulation_session.*
  into v_session
  from public.simulation_sessions as simulation_session
  where simulation_session.user_id = v_user_id
    and simulation_session.case_id = v_case_id
    and simulation_session.status = 'in_progress'::public.simulation_status
  for update;

  if found then
    v_resumed := true;
  else
    begin
      insert into public.simulation_sessions (
        user_id,
        case_id,
        status,
        current_step_id,
        score_total,
        started_at,
        completed_at
      )
      values (
        v_user_id,
        v_case_id,
        'in_progress'::public.simulation_status,
        v_first_step_id,
        0,
        now(),
        null
      )
      returning * into v_session;
    exception
      when unique_violation then
      select simulation_session.*
      into v_session
      from public.simulation_sessions as simulation_session
      where simulation_session.user_id = v_user_id
        and simulation_session.case_id = v_case_id
        and simulation_session.status = 'in_progress'::public.simulation_status
      for update;

      if not found then
        raise exception 'Não foi possível criar ou retomar a sessão.'
          using errcode = 'P0001';
      end if;

      v_resumed := true;
    end;
  end if;

  select
    case_step.step_key,
    case
      when case_step.metadata ->> 'presentation_state' in (
        'stable', 'warning', 'critical', 'recovery'
      ) then case_step.metadata ->> 'presentation_state'
      else 'stable'
    end
  into v_current_step_key, v_current_step_state
  from public.case_steps as case_step
  where case_step.id = v_session.current_step_id
    and case_step.case_id = v_session.case_id;

  if not found then
    raise exception 'A sessão aponta para uma etapa inválida.'
      using errcode = 'P0001';
  end if;

  select simulation_action.*
  into v_action
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id
    and simulation_action.step_id = v_session.current_step_id;

  select count(*)::integer
  into v_decision_count
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id;

  if v_action.id is not null and (
    v_action.outcome is null
    or jsonb_typeof(v_action.outcome) is distinct from 'object'
    or v_action.outcome ->> 'schema_version' is distinct from '1'
    or v_action.outcome ->> 'classification' is null
    or v_action.outcome ->> 'classification' not in (
      'ideal', 'acceptable', 'needs_improvement', 'unsafe'
    )
    or jsonb_typeof(v_action.outcome -> 'feedback') is distinct from 'string'
    or nullif(btrim(v_action.outcome ->> 'feedback'), '') is null
    or jsonb_typeof(v_action.outcome -> 'completed') is distinct from 'boolean'
    or (
      v_action.outcome -> 'consequence' is not null
      and jsonb_typeof(v_action.outcome -> 'consequence') not in ('string', 'null')
    )
    or (
      v_action.outcome -> 'next_step_key' is not null
      and jsonb_typeof(v_action.outcome -> 'next_step_key') not in ('string', 'null')
    )
    or (
      v_action.outcome -> 'presentation_state' is not null
      and jsonb_typeof(v_action.outcome -> 'presentation_state') not in ('string', 'null')
    )
    or (
      nullif(v_action.outcome ->> 'presentation_state', '') is not null
      and v_action.outcome ->> 'presentation_state' not in (
        'stable', 'warning', 'critical', 'recovery'
      )
    )
    or (
      v_action.outcome ->> 'completed' = 'true'
      and nullif(v_action.outcome ->> 'next_step_key', '') is not null
    )
    or (
      v_action.outcome ->> 'completed' = 'false'
      and nullif(v_action.outcome ->> 'next_step_key', '') is null
    )
  ) then
    raise exception
      'A ação existente não possui um snapshot P8 válido; saneamento explícito é necessário.'
      using errcode = 'P0001';
  end if;

  return query
  select
    v_session.id,
    v_session.case_id,
    v_session.status,
    v_session.current_step_id,
    v_current_step_key,
    v_session.score_total,
    v_decision_count,
    v_session.started_at,
    v_resumed,
    v_action.selected_option_id,
    v_action.outcome ->> 'classification',
    case when v_action.id is null then null else v_action.score_delta end,
    v_action.outcome ->> 'feedback',
    nullif(v_action.outcome ->> 'consequence', ''),
    nullif(v_action.outcome ->> 'next_step_key', ''),
    case
      when v_action.id is null then null
      else (v_action.outcome ->> 'completed')::boolean
    end,
    coalesce(
      nullif(v_action.outcome ->> 'presentation_state', ''),
      v_current_step_state
    );
end;
$$;

create or replace function public.record_simulation_decision(
  p_session_id uuid,
  p_step_id uuid,
  p_option_id text
)
returns table (
  action_id uuid,
  session_id uuid,
  step_id uuid,
  selected_option_id text,
  classification text,
  score_delta integer,
  feedback text,
  consequence text,
  next_step_key text,
  completed boolean,
  presentation_state text,
  score_total integer,
  decision_count integer,
  created_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_course public.course_code;
  v_session public.simulation_sessions%rowtype;
  v_existing_action public.simulation_actions%rowtype;
  v_action public.simulation_actions%rowtype;
  v_step_type text;
  v_options jsonb;
  v_option_label text;
  v_classification text;
  v_score_delta integer;
  v_feedback text;
  v_consequence text;
  v_next_step_key text;
  v_completed boolean;
  v_presentation_state text;
  v_outcome jsonb;
  v_decision_count integer;
begin
  if v_user_id is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  select student.course
  into v_student_course
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = v_user_id
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
      using errcode = '42501';
  end if;

  if v_student_course is null then
    raise exception 'Selecione um curso antes de continuar a simulação.'
      using errcode = '42501';
  end if;

  select simulation_session.*
  into v_session
  from public.simulation_sessions as simulation_session
  where simulation_session.id = p_session_id
    and simulation_session.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Sessão indisponível para o estudante autenticado.'
      using errcode = '42501';
  end if;

  if v_session.status <> 'in_progress'::public.simulation_status then
    raise exception 'A sessão não está em andamento.' using errcode = 'P0001';
  end if;

  if v_session.current_step_id <> p_step_id then
    raise exception 'A etapa informada não é a etapa atual da sessão.'
      using errcode = 'P0001';
  end if;

  perform 1
  from public.clinical_cases as clinical_case
  where clinical_case.id = v_session.case_id
    and clinical_case.status = 'published'::public.case_status
    and clinical_case.course = v_student_course;

  if not found then
    raise exception 'Caso publicado indisponível para o curso do estudante.'
      using errcode = 'P0001';
  end if;

  select case_step.step_type, case_step.options
  into v_step_type, v_options
  from public.case_steps as case_step
  where case_step.id = p_step_id
    and case_step.case_id = v_session.case_id;

  if not found or v_step_type <> 'decision' then
    raise exception 'A etapa atual não aceita uma decisão.' using errcode = 'P0001';
  end if;

  if p_option_id is null or btrim(p_option_id) = '' then
    raise exception 'Selecione uma opção válida.' using errcode = 'P0001';
  end if;

  select visible_option ->> 'label'
  into v_option_label
  from jsonb_array_elements(v_options) as visible_option
  where jsonb_typeof(visible_option) = 'object'
    and visible_option ->> 'id' = p_option_id
    and jsonb_typeof(visible_option -> 'label') = 'string'
    and nullif(btrim(visible_option ->> 'label'), '') is not null
  limit 1;

  if not found then
    raise exception 'Opção inválida para esta etapa.' using errcode = 'P0001';
  end if;

  select simulation_action.*
  into v_existing_action
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id
    and simulation_action.step_id = p_step_id;

  if found then
    if v_existing_action.selected_option_id <> p_option_id then
      raise exception 'Esta etapa já foi respondida com outra opção.'
        using errcode = 'P0001';
    end if;

    if v_existing_action.outcome is null
      or jsonb_typeof(v_existing_action.outcome) is distinct from 'object'
      or v_existing_action.outcome ->> 'schema_version' is distinct from '1'
      or v_existing_action.outcome ->> 'classification' is null
      or v_existing_action.outcome ->> 'classification' not in (
        'ideal', 'acceptable', 'needs_improvement', 'unsafe'
      )
      or jsonb_typeof(v_existing_action.outcome -> 'feedback') is distinct from 'string'
      or nullif(btrim(v_existing_action.outcome ->> 'feedback'), '') is null
      or jsonb_typeof(v_existing_action.outcome -> 'completed') is distinct from 'boolean'
      or (
        v_existing_action.outcome -> 'consequence' is not null
        and jsonb_typeof(v_existing_action.outcome -> 'consequence') not in ('string', 'null')
      )
      or (
        v_existing_action.outcome -> 'next_step_key' is not null
        and jsonb_typeof(v_existing_action.outcome -> 'next_step_key') not in ('string', 'null')
      )
      or (
        nullif(v_existing_action.outcome ->> 'presentation_state', '') is not null
        and v_existing_action.outcome ->> 'presentation_state' not in (
          'stable', 'warning', 'critical', 'recovery'
        )
      )
      or (
        v_existing_action.outcome ->> 'completed' = 'true'
        and nullif(v_existing_action.outcome ->> 'next_step_key', '') is not null
      )
      or (
        v_existing_action.outcome ->> 'completed' = 'false'
        and nullif(v_existing_action.outcome ->> 'next_step_key', '') is null
      )
    then
      raise exception
        'A ação existente não possui um snapshot P8 válido; saneamento explícito é necessário.'
        using errcode = 'P0001';
    end if;

    select count(*)::integer
    into v_decision_count
    from public.simulation_actions as simulation_action
    where simulation_action.session_id = v_session.id;

    return query
    select
      v_existing_action.id,
      v_existing_action.session_id,
      v_existing_action.step_id,
      v_existing_action.selected_option_id,
      v_existing_action.outcome ->> 'classification',
      v_existing_action.score_delta,
      v_existing_action.outcome ->> 'feedback',
      nullif(v_existing_action.outcome ->> 'consequence', ''),
      nullif(v_existing_action.outcome ->> 'next_step_key', ''),
      (v_existing_action.outcome ->> 'completed')::boolean,
      nullif(v_existing_action.outcome ->> 'presentation_state', ''),
      v_session.score_total,
      v_decision_count,
      v_existing_action.created_at,
      true;
    return;
  end if;

  select
    resolved.classification,
    resolved.score_delta,
    resolved.feedback,
    resolved.consequence,
    resolved.next_step_key,
    resolved.completed,
    resolved.presentation_state
  into
    v_classification,
    v_score_delta,
    v_feedback,
    v_consequence,
    v_next_step_key,
    v_completed,
    v_presentation_state
  from private.resolve_simulation_transition_internal(
    v_session.case_id,
    p_step_id,
    p_option_id
  ) as resolved;

  if not found or v_classification is null then
    raise exception 'A avaliação da decisão não retornou um resultado válido.'
      using errcode = 'P0001';
  end if;

  v_outcome := jsonb_build_object(
    'schema_version', 1,
    'selected_option_label', v_option_label,
    'classification', v_classification,
    'feedback', v_feedback,
    'consequence', v_consequence,
    'next_step_key', v_next_step_key,
    'completed', v_completed,
    'presentation_state', v_presentation_state
  );

  insert into public.simulation_actions (
    session_id,
    user_id,
    step_id,
    selected_option_id,
    outcome,
    score_delta
  )
  values (
    v_session.id,
    v_user_id,
    p_step_id,
    p_option_id,
    v_outcome,
    v_score_delta
  )
  returning * into v_action;

  update public.simulation_sessions as simulation_session
  set score_total = simulation_session.score_total + v_score_delta
  where simulation_session.id = v_session.id
    and simulation_session.user_id = v_user_id
  returning simulation_session.* into v_session;

  if not found then
    raise exception 'A sessão deixou de estar disponível durante o registro.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_decision_count
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id;

  return query
  select
    v_action.id,
    v_action.session_id,
    v_action.step_id,
    v_action.selected_option_id,
    v_classification,
    v_action.score_delta,
    v_feedback,
    v_consequence,
    v_next_step_key,
    v_completed,
    v_presentation_state,
    v_session.score_total,
    v_decision_count,
    v_action.created_at,
    false;
end;
$$;

create or replace function public.advance_simulation_session(
  p_session_id uuid,
  p_step_id uuid
)
returns table (
  session_id uuid,
  status public.simulation_status,
  current_step_id uuid,
  current_step_key text,
  score_total integer,
  decision_count integer,
  completed_at timestamptz,
  previous_step_id uuid,
  presentation_state text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_course public.course_code;
  v_session public.simulation_sessions%rowtype;
  v_action public.simulation_actions%rowtype;
  v_requested_step_type text;
  v_next_step_key text;
  v_transition_completed boolean;
  v_presentation_state text;
  v_target_step_id uuid;
  v_target_step_key text;
  v_target_state text;
  v_decision_count integer;
  v_replayed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  select student.course
  into v_student_course
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = v_user_id
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
      using errcode = '42501';
  end if;

  if v_student_course is null then
    raise exception 'Selecione um curso antes de continuar a simulação.'
      using errcode = '42501';
  end if;

  select simulation_session.*
  into v_session
  from public.simulation_sessions as simulation_session
  where simulation_session.id = p_session_id
    and simulation_session.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Sessão indisponível para o estudante autenticado.'
      using errcode = '42501';
  end if;

  perform 1
  from public.clinical_cases as clinical_case
  where clinical_case.id = v_session.case_id
    and clinical_case.status = 'published'::public.case_status
    and clinical_case.course = v_student_course;

  if not found then
    raise exception 'Caso publicado indisponível para o curso do estudante.'
      using errcode = 'P0001';
  end if;

  select case_step.step_type
  into v_requested_step_type
  from public.case_steps as case_step
  where case_step.id = p_step_id
    and case_step.case_id = v_session.case_id;

  if not found or v_requested_step_type not in ('information', 'decision') then
    raise exception 'Etapa inválida para esta sessão.' using errcode = 'P0001';
  end if;

  if v_requested_step_type = 'information' then
    select
      resolved.next_step_key,
      resolved.completed,
      resolved.presentation_state
    into
      v_next_step_key,
      v_transition_completed,
      v_presentation_state
    from private.resolve_simulation_transition_internal(
      v_session.case_id,
      p_step_id,
      null
    ) as resolved;

    if not found then
      raise exception 'A etapa informativa não possui uma transição válida.'
        using errcode = 'P0001';
    end if;
  else
    select simulation_action.*
    into v_action
    from public.simulation_actions as simulation_action
    where simulation_action.session_id = v_session.id
      and simulation_action.step_id = p_step_id;

    if not found then
      raise exception 'Registre a decisão antes de avançar.' using errcode = 'P0001';
    end if;

    if v_action.outcome is null
      or jsonb_typeof(v_action.outcome) is distinct from 'object'
      or v_action.outcome ->> 'schema_version' is distinct from '1'
      or jsonb_typeof(v_action.outcome -> 'completed') is distinct from 'boolean'
      or (
        v_action.outcome -> 'next_step_key' is not null
        and jsonb_typeof(v_action.outcome -> 'next_step_key') not in ('string', 'null')
      )
      or (
        nullif(v_action.outcome ->> 'presentation_state', '') is not null
        and v_action.outcome ->> 'presentation_state' not in (
          'stable', 'warning', 'critical', 'recovery'
        )
      )
    then
      raise exception 'A decisão persistida não possui transição válida.'
        using errcode = 'P0001';
    end if;

    v_next_step_key := nullif(v_action.outcome ->> 'next_step_key', '');
    v_transition_completed := (v_action.outcome ->> 'completed')::boolean;
    v_presentation_state := nullif(
      v_action.outcome ->> 'presentation_state',
      ''
    );
  end if;

  if v_transition_completed then
    if v_next_step_key is not null then
      raise exception 'A transição concluída não pode indicar próxima etapa.'
        using errcode = 'P0001';
    end if;
  else
    if v_next_step_key is null then
      raise exception 'A transição não informou uma próxima etapa.'
        using errcode = 'P0001';
    end if;

    select
      target_step.id,
      target_step.step_key,
      case
        when target_step.metadata ->> 'presentation_state' in (
          'stable', 'warning', 'critical', 'recovery'
        ) then target_step.metadata ->> 'presentation_state'
        else 'stable'
      end
    into v_target_step_id, v_target_step_key, v_target_state
    from public.case_steps as target_step
    where target_step.case_id = v_session.case_id
      and target_step.step_key = v_next_step_key;

    if not found then
      raise exception 'O destino autorizado não pertence ao caso da sessão.'
        using errcode = 'P0001';
    end if;
  end if;

  if v_session.status = 'completed'::public.simulation_status then
    if v_session.current_step_id <> p_step_id or not v_transition_completed then
      raise exception 'A sessão já foi concluída em outro estado.'
        using errcode = 'P0001';
    end if;

    v_replayed := true;
  elsif v_session.status <> 'in_progress'::public.simulation_status then
    raise exception 'A sessão não está em andamento.' using errcode = 'P0001';
  elsif v_session.current_step_id = p_step_id then
    if v_transition_completed then
      update public.simulation_sessions as simulation_session
      set
        status = 'completed'::public.simulation_status,
        completed_at = now()
      where simulation_session.id = v_session.id
        and simulation_session.user_id = v_user_id
      returning simulation_session.* into v_session;

      if not found then
        raise exception 'A sessão deixou de estar disponível durante a conclusão.'
          using errcode = 'P0001';
      end if;
    else
      update public.simulation_sessions as simulation_session
      set current_step_id = v_target_step_id
      where simulation_session.id = v_session.id
        and simulation_session.user_id = v_user_id
      returning simulation_session.* into v_session;

      if not found then
        raise exception 'A sessão deixou de estar disponível durante o avanço.'
          using errcode = 'P0001';
      end if;
    end if;
  elsif not v_transition_completed
    and v_session.current_step_id = v_target_step_id
  then
    v_replayed := true;
  else
    raise exception 'A solicitação de avanço está desatualizada.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_decision_count
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id;

  if v_session.status = 'completed'::public.simulation_status then
    v_target_step_id := v_session.current_step_id;

    select final_step.step_key
    into v_target_step_key
    from public.case_steps as final_step
    where final_step.id = v_session.current_step_id
      and final_step.case_id = v_session.case_id;
  elsif v_replayed then
    select
      current_step.step_key,
      case
        when current_step.metadata ->> 'presentation_state' in (
          'stable', 'warning', 'critical', 'recovery'
        ) then current_step.metadata ->> 'presentation_state'
        else 'stable'
      end
    into v_target_step_key, v_target_state
    from public.case_steps as current_step
    where current_step.id = v_session.current_step_id
      and current_step.case_id = v_session.case_id;
  end if;

  return query
  select
    v_session.id,
    v_session.status,
    v_session.current_step_id,
    v_target_step_key,
    v_session.score_total,
    v_decision_count,
    v_session.completed_at,
    p_step_id,
    case
      when v_session.status = 'completed'::public.simulation_status
        then v_presentation_state
      else coalesce(v_presentation_state, v_target_state)
    end,
    v_replayed;
end;
$$;

revoke all on function public.start_or_resume_simulation_session(uuid)
  from public, anon, authenticated;
revoke all on function public.record_simulation_decision(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.advance_simulation_session(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.start_or_resume_simulation_session(uuid)
  to authenticated;
grant execute on function public.record_simulation_decision(uuid, uuid, text)
  to authenticated;
grant execute on function public.advance_simulation_session(uuid, uuid)
  to authenticated;

comment on function public.start_or_resume_simulation_session(uuid) is
  'P8 RPC: atomically starts or resumes one authorized in-progress session and returns a sanitized snapshot.';
comment on function public.record_simulation_decision(uuid, uuid, text) is
  'P8 RPC: evaluates and persists one current-step decision atomically and idempotently.';
comment on function public.advance_simulation_session(uuid, uuid) is
  'P8 RPC: advances or completes an owned session using only server-authorized transition data.';
