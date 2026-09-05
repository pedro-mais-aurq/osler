-- P10 adds one narrowly scoped reset operation for interrupted demonstrations.
-- It never deletes a session or action: the old attempt becomes historical and
-- the existing P8 start/resume RPC remains responsible for creating the next one.

create or replace function public.abandon_simulation_session(
  p_session_id uuid
)
returns table (
  session_id uuid,
  case_id uuid,
  status public.simulation_status,
  score_total integer,
  decision_count integer,
  started_at timestamptz,
  abandoned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.simulation_sessions%rowtype;
  v_decision_count integer;
begin
  if v_user_id is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  perform 1
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = v_user_id
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
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
    raise exception 'Apenas uma sessão em andamento pode ser reiniciada.'
      using errcode = 'P0001';
  end if;

  update public.simulation_sessions as simulation_session
  set status = 'abandoned'::public.simulation_status
  where simulation_session.id = v_session.id
    and simulation_session.user_id = v_user_id
    and simulation_session.status = 'in_progress'::public.simulation_status
  returning simulation_session.* into v_session;

  if not found then
    raise exception 'A sessão deixou de estar disponível durante o reinício.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_decision_count
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id;

  return query
  select
    v_session.id,
    v_session.case_id,
    v_session.status,
    v_session.score_total,
    v_decision_count,
    v_session.started_at,
    v_session.updated_at;
end;
$$;

revoke all on function public.abandon_simulation_session(uuid)
  from public, anon, authenticated;
grant execute on function public.abandon_simulation_session(uuid)
  to authenticated;

comment on function public.abandon_simulation_session(uuid) is
  'P10 RPC: abandons one owned in-progress student session without deleting its score or actions.';
