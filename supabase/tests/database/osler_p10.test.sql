begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_function(
  'public',
  'abandon_simulation_session',
  array['uuid'],
  'P10 exposes the narrowly scoped abandon RPC'
);

select ok(
  (
    select routine.prosecdef
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'abandon_simulation_session'
      and routine.proargtypes = '2950'::oidvector
  ),
  'P10 abandon RPC is security definer'
);

select ok(
  (
    select routine.proconfig[1] in ('search_path=', 'search_path=""')
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'abandon_simulation_session'
      and routine.proargtypes = '2950'::oidvector
  ),
  'P10 abandon RPC pins an empty search_path'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.abandon_simulation_session(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.abandon_simulation_session(uuid)',
    'execute'
  ),
  'only authenticated clients receive execute privilege'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1000000-0000-4000-8000-000000000001', 'p10-owner@test.invalid', '{}'::jsonb),
  ('a1000000-0000-4000-8000-000000000002', 'p10-other@test.invalid', '{}'::jsonb);

update public.students
set course = 'nursing'
where user_id in (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002'
);

insert into public.patients (id, display_name, metadata)
values (
  'a2000000-0000-4000-8000-000000000001',
  'P10 technical fixture',
  '{"fixture": true, "clinical_content": false}'::jsonb
);

insert into public.clinical_cases (
  id,
  patient_id,
  slug,
  title,
  course,
  description,
  status,
  metadata
)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'p10-reset-technical-fixture',
  'P10 reset technical fixture',
  'nursing',
  'Technical fixture without clinical content.',
  'published',
  '{"fixture": true, "clinical_content": false}'::jsonb
);

-- Transaction-only public fixtures for independent legacy engine checks.
update public.clinical_cases set visibility = 'public'
where slug like 'p10-%' and owner_teacher_id is null;

insert into public.case_steps (
  id,
  case_id,
  position,
  step_key,
  step_type,
  title,
  content,
  options,
  metadata
)
values (
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  1,
  'p10-reset-decision',
  'decision',
  'P10 reset decision',
  '{"body": "Technical decision."}'::jsonb,
  '[{"id": "technical", "label": "Technical option"}]'::jsonb,
  '{"presentation_state": "stable"}'::jsonb
);

insert into public.case_step_rules (step_id, rules)
values (
  'a4000000-0000-4000-8000-000000000001',
  '{
    "options": {
      "technical": {
        "classification": "ideal",
        "score_delta": 5,
        "feedback": "P10 technical feedback.",
        "transition": {"type": "complete"}
      }
    }
  }'::jsonb
);

-- Import historical test rows without a live owner JWT; restore authorization before assertions.
alter table public.simulation_sessions disable trigger classroom_session_guard;
alter table public.simulation_actions disable trigger classroom_action_guard;
insert into public.simulation_sessions (
  id,
  user_id,
  case_id,
  status,
  current_step_id,
  score_total,
  started_at,
  completed_at
)
values
  (
    'a5000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'completed',
    'a4000000-0000-4000-8000-000000000001',
    11,
    '2026-09-05 10:00:00+00',
    '2026-09-05 10:15:00+00'
  ),
  (
    'a5000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'abandoned',
    'a4000000-0000-4000-8000-000000000001',
    -2,
    '2026-09-05 11:00:00+00',
    null
  );

alter table public.simulation_sessions enable trigger classroom_session_guard;
alter table public.simulation_actions enable trigger classroom_action_guard;

set local role anon;
set local request.jwt.claim.role = 'anon';

select throws_ok(
  $$
    select *
    from public.abandon_simulation_session(
      'a5000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  null,
  'anon cannot execute the P10 RPC'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';

create temporary table p10_started as
select *
from public.start_or_resume_simulation_session(
  'a3000000-0000-4000-8000-000000000001'
);

create temporary table p10_recorded as
select *
from public.record_simulation_decision(
  (select session_id from p10_started),
  'a4000000-0000-4000-8000-000000000001',
  'technical'
);

create temporary table p10_before_abandon as
select
  simulation_session.id,
  simulation_session.score_total,
  simulation_session.started_at,
  simulation_action.id as action_id,
  simulation_action.created_at as action_created_at
from public.simulation_sessions as simulation_session
join public.simulation_actions as simulation_action
  on simulation_action.session_id = simulation_session.id
where simulation_session.id = (select session_id from p10_started);

create temporary table p10_abandoned as
select *
from public.abandon_simulation_session(
  (select session_id from p10_started)
);

select is(
  (select status::text from p10_abandoned),
  'abandoned',
  'owner can mark an in-progress attempt as abandoned'
);
select is(
  (select score_total from p10_abandoned),
  (select score_total from p10_before_abandon),
  'abandon preserves server-side score'
);
select is(
  (select decision_count from p10_abandoned),
  1,
  'abandon preserves the recorded decision count'
);
select is(
  (select started_at from p10_abandoned),
  (select started_at from p10_before_abandon),
  'abandon preserves the original start timestamp'
);
select is(
  (
    select count(*)::integer
    from public.simulation_actions
    where id = (select action_id from p10_before_abandon)
      and created_at = (select action_created_at from p10_before_abandon)
  ),
  1,
  'abandon preserves actions and their historical timestamps'
);
select is(
  (
    select completed_at
    from public.simulation_sessions
    where id = (select session_id from p10_started)
  ),
  null::timestamptz,
  'abandoned attempt is not falsified as completed'
);

create temporary table p10_restarted as
select *
from public.start_or_resume_simulation_session(
  'a3000000-0000-4000-8000-000000000001'
);

select isnt(
  (select session_id from p10_restarted),
  (select session_id from p10_started),
  'start/resume creates a distinct attempt after abandonment'
);
select is(
  (select resumed from p10_restarted),
  false,
  'the replacement attempt is reported as new'
);

set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000002';

select throws_ok(
  format(
    'select * from public.abandon_simulation_session(%L::uuid)',
    (select session_id from p10_restarted)
  ),
  '42501',
  null,
  'another student cannot abandon the owner session'
);

set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select *
    from public.abandon_simulation_session(
      'a5000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  null,
  'completed attempt cannot be abandoned'
);
select throws_ok(
  $$
    select *
    from public.abandon_simulation_session(
      'a5000000-0000-4000-8000-000000000003'
    )
  $$,
  'P0001',
  null,
  'abandoned attempt cannot be abandoned again'
);

select throws_ok(
  $$
    update public.simulation_sessions
    set status = 'abandoned'
    where id = (select session_id from p10_restarted)
  $$,
  '42501',
  null,
  'P8 direct session writes remain blocked'
);
select throws_ok(
  $$
    delete from public.simulation_actions
    where session_id = (select session_id from p10_started)
  $$,
  '42501',
  null,
  'reset does not add a client-side action deletion path'
);

select * from finish();
rollback;
