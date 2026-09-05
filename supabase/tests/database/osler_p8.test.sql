begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_function(
  'public',
  'start_or_resume_simulation_session',
  array['uuid'],
  'P8 exposes start/resume RPC'
);
select has_function(
  'public',
  'record_simulation_decision',
  array['uuid', 'uuid', 'text'],
  'P8 exposes decision RPC'
);
select has_function(
  'public',
  'advance_simulation_session',
  array['uuid', 'uuid'],
  'P8 exposes advance RPC'
);

select is(
  (
    select count(*)::integer
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname in (
        'start_or_resume_simulation_session',
        'record_simulation_decision',
        'advance_simulation_session'
      )
      and routine.prosecdef
  ),
  3,
  'all P8 RPCs are security definer'
);

select is(
  (
    select count(*)::integer
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname in (
        'start_or_resume_simulation_session',
        'record_simulation_decision',
        'advance_simulation_session'
      )
      and routine.proconfig[1] in ('search_path=', 'search_path=""')
  ),
  3,
  'all P8 RPCs pin an empty search_path'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.start_or_resume_simulation_session(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.record_simulation_decision(uuid, uuid, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.advance_simulation_session(uuid, uuid)',
    'execute'
  ),
  'anon cannot execute P8 RPCs'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.start_or_resume_simulation_session(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.record_simulation_decision(uuid, uuid, text)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.advance_simulation_session(uuid, uuid)',
    'execute'
  ),
  'authenticated has explicit execute privilege on P8 RPCs'
);

select ok(
  not has_table_privilege(
    'authenticated', 'public.simulation_sessions', 'insert'
  )
  and not has_table_privilege(
    'authenticated', 'public.simulation_sessions', 'update'
  )
  and not has_table_privilege(
    'authenticated', 'public.simulation_actions', 'insert'
  ),
  'P8 revokes all direct execution writes from authenticated'
);

select ok(
  has_table_privilege(
    'authenticated', 'public.simulation_sessions', 'select'
  )
  and has_table_privilege(
    'authenticated', 'public.simulation_actions', 'select'
  ),
  'authenticated keeps read access governed by own-only RLS'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in ('simulation_sessions', 'simulation_actions')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ),
  0,
  'execution tables have no client write policy after P8'
);

select has_index(
  'public',
  'simulation_sessions',
  'simulation_sessions_one_active_per_user_case_idx',
  'one active session per user and case is enforced'
);
select has_index(
  'public',
  'simulation_actions',
  'simulation_actions_one_decision_per_step_idx',
  'one decision per session and step is enforced'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('81000000-0000-4000-8000-000000000001', 'p8-student@test.invalid', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000002', 'p8-other@test.invalid', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000003', 'p8-no-course@test.invalid', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000004', 'p8-teacher@test.invalid', '{}'::jsonb),
  ('81000000-0000-4000-8000-000000000005', 'p8-clinical@test.invalid', '{}'::jsonb);

update public.students
set course = 'nursing'
where user_id in (
  '81000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000004'
);

update public.students
set course = 'clinical_analysis'
where user_id = '81000000-0000-4000-8000-000000000005';

update public.profiles
set role = 'teacher'
where user_id = '81000000-0000-4000-8000-000000000004';

insert into public.patients (id, display_name, metadata)
values (
  '82000000-0000-4000-8000-000000000001',
  'P8 technical fixture',
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
values
  (
    '83000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    'p8-published-nursing-fixture',
    'P8 published nursing fixture',
    'nursing',
    'Technical fixture without clinical content.',
    'published',
    '{"fixture": true, "clinical_content": false}'::jsonb
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    'p8-draft-nursing-fixture',
    'P8 draft nursing fixture',
    'nursing',
    'Technical fixture without clinical content.',
    'draft',
    '{"fixture": true, "clinical_content": false}'::jsonb
  ),
  (
    '83000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000001',
    'p8-published-clinical-fixture',
    'P8 published clinical analysis fixture',
    'clinical_analysis',
    'Technical fixture without clinical content.',
    'published',
    '{"fixture": true, "clinical_content": false}'::jsonb
  );

insert into public.case_truth_models (case_id, truth_model)
values (
  '83000000-0000-4000-8000-000000000001',
  '{"private_marker": "P8_TRUTH_MUST_NOT_LEAK"}'::jsonb
);

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
values
  (
    '84000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    1,
    'p8-information',
    'information',
    'P8 information',
    '{"body": "Technical information."}'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "stable"}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000001',
    2,
    'p8-plus-two',
    'decision',
    'P8 plus two',
    '{"body": "Technical decision."}'::jsonb,
    '[
      {"id": "plus-two", "label": "Selected plus two"},
      {"id": "other-option", "label": "Other option"}
    ]'::jsonb,
    '{"presentation_state": "warning"}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000003',
    '83000000-0000-4000-8000-000000000001',
    3,
    'p8-plus-one',
    'decision',
    'P8 plus one',
    '{"body": "Technical decision."}'::jsonb,
    '[{"id": "plus-one", "label": "Plus one"}]'::jsonb,
    '{}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000004',
    '83000000-0000-4000-8000-000000000001',
    4,
    'p8-zero',
    'decision',
    'P8 zero',
    '{"body": "Technical decision."}'::jsonb,
    '[{"id": "zero", "label": "Zero"}]'::jsonb,
    '{}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000005',
    '83000000-0000-4000-8000-000000000001',
    5,
    'p8-minus-one',
    'decision',
    'P8 minus one',
    '{"body": "Technical decision."}'::jsonb,
    '[{"id": "minus-one", "label": "Minus one"}]'::jsonb,
    '{}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000006',
    '83000000-0000-4000-8000-000000000001',
    6,
    'p8-final-information',
    'information',
    'P8 final information',
    '{"body": "Technical completion."}'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "recovery"}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000007',
    '83000000-0000-4000-8000-000000000002',
    1,
    'p8-draft-information',
    'information',
    'P8 draft',
    '{"body": "Technical draft."}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000008',
    '83000000-0000-4000-8000-000000000003',
    1,
    'p8-clinical-information',
    'information',
    'P8 clinical analysis',
    '{"body": "Technical clinical analysis fixture."}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  );

insert into public.case_step_rules (step_id, rules)
values
  (
    '84000000-0000-4000-8000-000000000002',
    '{
      "private_marker": "P8_RULE_CONTAINER_MUST_NOT_LEAK",
      "options": {
        "plus-two": {
          "classification": "acceptable",
          "score_delta": 2,
          "feedback": "P8 selected feedback.",
          "consequence": "P8 selected consequence.",
          "presentation_state": "recovery",
          "transition": {"type": "step", "step_key": "p8-plus-one"}
        },
        "other-option": {
          "classification": "unsafe",
          "score_delta": -99,
          "feedback": "P8_NON_SELECTED_SECRET",
          "transition": {"type": "complete"}
        }
      }
    }'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000003',
    '{"options": {"plus-one": {
      "classification": "ideal",
      "score_delta": 1,
      "feedback": "Plus one persisted.",
      "transition": {"type": "step", "step_key": "p8-zero"}
    }}}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000004',
    '{"options": {"zero": {
      "classification": "acceptable",
      "score_delta": 0,
      "feedback": "Zero persisted.",
      "transition": {"type": "step", "step_key": "p8-minus-one"}
    }}}'::jsonb
  ),
  (
    '84000000-0000-4000-8000-000000000005',
    '{"options": {"minus-one": {
      "classification": "needs_improvement",
      "score_delta": -1,
      "feedback": "Minus one persisted.",
      "transition": {"type": "step", "step_key": "p8-final-information"}
    }}}'::jsonb
  );

insert into public.simulation_sessions (
  id,
  user_id,
  case_id,
  current_step_id
)
values (
  '85000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000002',
  '83000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001'
);

insert into public.simulation_actions (
  id,
  session_id,
  user_id,
  step_id,
  selected_option_id,
  outcome,
  score_delta
)
values (
  '86000000-0000-4000-8000-000000000002',
  '85000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000002',
  '84000000-0000-4000-8000-000000000002',
  'plus-two',
  '{
    "schema_version": 1,
    "selected_option_label": "Other user fixture",
    "classification": "acceptable",
    "feedback": "Other user feedback.",
    "consequence": null,
    "next_step_key": "p8-plus-one",
    "completed": false,
    "presentation_state": "recovery"
  }'::jsonb,
  2
);

set local role anon;
set local request.jwt.claim.role = 'anon';

select throws_ok(
  $$
    select *
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  null,
  'anon cannot execute start/resume'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '81000000-0000-4000-8000-000000000004';
set local request.jwt.claim.role = 'authenticated';

select throws_ok(
  $$
    select *
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  null,
  'teacher cannot start a student simulation session'
);

set local request.jwt.claim.sub = '81000000-0000-4000-8000-000000000003';

select throws_ok(
  $$
    select *
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  null,
  'student without selected course cannot start'
);

set local request.jwt.claim.sub = '81000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select *
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000003'
    )
  $$,
  'P0001',
  null,
  'student cannot start a case from another course'
);

set local request.jwt.claim.sub = '81000000-0000-4000-8000-000000000005';

create temporary table p8_clinical_started as
select *
from public.start_or_resume_simulation_session(
  '83000000-0000-4000-8000-000000000003'
);

select is(
  (select current_step_id from p8_clinical_started),
  '84000000-0000-4000-8000-000000000008'::uuid,
  'Clinical Analysis uses the same start/resume RPC'
);

set local request.jwt.claim.sub = '81000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select *
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  null,
  'student cannot start a draft case'
);

create temporary table p8_started as
select *
from public.start_or_resume_simulation_session(
  '83000000-0000-4000-8000-000000000001'
);

select is((select status::text from p8_started), 'in_progress', 'session starts in progress');
select is(
  (select current_step_id from p8_started),
  '84000000-0000-4000-8000-000000000001'::uuid,
  'session starts on first step'
);
select is((select score_total from p8_started), 0, 'session starts with zero score');
select is((select decision_count from p8_started), 0, 'session starts with no decisions');
select is((select resumed from p8_started), false, 'first start is not a resume');

select throws_ok(
  $$
    select *
    from public.advance_simulation_session(
      '85000000-0000-4000-8000-000000000002',
      '84000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  null,
  'student cannot advance another user session'
);
select throws_ok(
  $$
    select *
    from public.record_simulation_decision(
      '85000000-0000-4000-8000-000000000002',
      '84000000-0000-4000-8000-000000000002',
      'plus-two'
    )
  $$,
  '42501',
  null,
  'student cannot record a decision in another user session'
);

select is(
  (
    select session_id
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000001'
    )
  ),
  (select session_id from p8_started),
  'repeated start returns the same active session'
);
select is(
  (
    select count(*)::integer
    from public.simulation_sessions
    where case_id = '83000000-0000-4000-8000-000000000001'
  ),
  1,
  'student sees only their single active session'
);

select throws_ok(
  $$
    insert into public.simulation_sessions (user_id, case_id)
    values (
      '81000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  null,
  'authenticated cannot insert a session directly'
);
select throws_ok(
  $$
    update public.simulation_sessions
    set score_total = 999,
        status = 'completed',
        completed_at = now(),
        current_step_id = '84000000-0000-4000-8000-000000000006'
    where id = (select session_id from p8_started)
  $$,
  '42501',
  null,
  'authenticated cannot tamper with score status completion or current step'
);
select throws_ok(
  $$
    insert into public.simulation_actions (
      session_id,
      user_id,
      step_id,
      selected_option_id,
      outcome,
      score_delta
    )
    values (
      (select session_id from p8_started),
      '81000000-0000-4000-8000-000000000001',
      '84000000-0000-4000-8000-000000000002',
      'plus-two',
      '{"classification": "ideal"}'::jsonb,
      999
    )
  $$,
  '42501',
  null,
  'authenticated cannot inject action outcome or score delta'
);

create temporary table p8_after_information as
select *
from public.advance_simulation_session(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000001'
);

select is(
  (select current_step_id from p8_after_information),
  '84000000-0000-4000-8000-000000000002'::uuid,
  'information advance persists the server-resolved next step'
);
select is((select score_total from p8_after_information), 0, 'information does not change score');
select is((select decision_count from p8_after_information), 0, 'information creates no action');

select throws_ok(
  format(
    'select * from public.advance_simulation_session(%L, %L)',
    (select session_id from p8_started),
    '84000000-0000-4000-8000-000000000002'
  ),
  'P0001',
  null,
  'decision cannot advance before its action is persisted'
);

select throws_ok(
  format(
    'select * from public.record_simulation_decision(%L, %L, %L)',
    (select session_id from p8_started),
    '84000000-0000-4000-8000-000000000003',
    'plus-one'
  ),
  'P0001',
  null,
  'decision step must be the current step'
);
select throws_ok(
  format(
    'select * from public.record_simulation_decision(%L, %L, %L)',
    (select session_id from p8_started),
    '84000000-0000-4000-8000-000000000002',
    'missing-option'
  ),
  'P0001',
  null,
  'decision option must exist in visible step data'
);

create temporary table p8_first_decision as
select *
from public.record_simulation_decision(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000002',
  'plus-two'
);

select is((select score_delta from p8_first_decision), 2, 'score delta comes from private rule');
select is((select score_total from p8_first_decision), 2, 'server atomically updates total score');
select is((select decision_count from p8_first_decision), 1, 'server reports persisted decision count');
select is(
  (
    select user_id
    from public.simulation_actions
    where id = (select action_id from p8_first_decision)
  ),
  '81000000-0000-4000-8000-000000000001'::uuid,
  'action user id comes from auth context'
);
select is(
  (
    select array_agg(outcome_key order by outcome_key)
    from public.simulation_actions as simulation_action
    cross join lateral jsonb_object_keys(simulation_action.outcome)
      as outcome_keys(outcome_key)
    where simulation_action.id = (select action_id from p8_first_decision)
  ),
  array[
    'classification',
    'completed',
    'consequence',
    'feedback',
    'next_step_key',
    'presentation_state',
    'schema_version',
    'selected_option_label'
  ]::text[],
  'outcome contains only the selected sanitized snapshot contract'
);
select ok(
  (
    select position('P8_NON_SELECTED_SECRET' in outcome::text) = 0
      and position('P8_RULE_CONTAINER_MUST_NOT_LEAK' in outcome::text) = 0
      and position('P8_TRUTH_MUST_NOT_LEAK' in outcome::text) = 0
    from public.simulation_actions
    where id = (select action_id from p8_first_decision)
  ),
  'outcome leaks neither other option rules nor truth'
);

select is(
  (
    select selected_option_id
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000001'
    )
  ),
  'plus-two',
  'resume restores the selected option for pending feedback'
);
select is(
  (
    select feedback
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000001'
    )
  ),
  'P8 selected feedback.',
  'resume restores only the persisted selected feedback'
);
select is(
  (
    select score_total
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000001'
    )
  ),
  2,
  'resume returns server score'
);
select is(
  (
    select decision_count
    from public.start_or_resume_simulation_session(
      '83000000-0000-4000-8000-000000000001'
    )
  ),
  1,
  'resume returns persisted decision count'
);

create temporary table p8_retry_decision as
select *
from public.record_simulation_decision(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000002',
  'plus-two'
);

select is((select replayed from p8_retry_decision), true, 'same decision retry is replayed');
select is((select action_id from p8_retry_decision), (select action_id from p8_first_decision), 'retry returns same action');
select is((select score_total from p8_retry_decision), 2, 'decision retry does not double score');
select is(
  (
    select count(*)::integer
    from public.simulation_actions
    where session_id = (select session_id from p8_started)
  ),
  1,
  'decision retry does not duplicate action'
);

select throws_ok(
  format(
    'select * from public.record_simulation_decision(%L, %L, %L)',
    (select session_id from p8_started),
    '84000000-0000-4000-8000-000000000002',
    'other-option'
  ),
  'P0001',
  null,
  'persisted decision cannot be changed to another option'
);

create temporary table p8_after_first_decision as
select *
from public.advance_simulation_session(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000002'
);

select is(
  (select current_step_key from p8_after_first_decision),
  'p8-plus-one',
  'decision advance uses persisted authorized target'
);
select is(
  (
    select replayed
    from public.advance_simulation_session(
      (select session_id from p8_started),
      '84000000-0000-4000-8000-000000000002'
    )
  ),
  true,
  'advance retry returns the already reached authorized target'
);

create temporary table p8_scored_path as
select *
from public.record_simulation_decision(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000003',
  'plus-one'
);
create temporary table p8_advance_plus_one as
select *
from public.advance_simulation_session(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000003'
);
insert into p8_scored_path
select *
from public.record_simulation_decision(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000004',
  'zero'
);
create temporary table p8_advance_zero as
select *
from public.advance_simulation_session(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000004'
);
insert into p8_scored_path
select *
from public.record_simulation_decision(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000005',
  'minus-one'
);
create temporary table p8_advance_minus_one as
select *
from public.advance_simulation_session(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000005'
);

select is(
  (
    select score_total
    from public.simulation_sessions
    where id = (select session_id from p8_started)
  ),
  2,
  'persisted score equals +2 +1 +0 -1'
);
select is(
  (
    select sum(score_delta)::integer
    from public.simulation_actions
    where session_id = (select session_id from p8_started)
  ),
  2,
  'session score equals sum of persisted action deltas'
);
select is(
  (
    select count(*)::integer
    from public.simulation_actions
    where session_id = (select session_id from p8_started)
  ),
  4,
  'only four decisions create actions along the six-step path'
);

create temporary table p8_completed as
select *
from public.advance_simulation_session(
  (select session_id from p8_started),
  '84000000-0000-4000-8000-000000000006'
);

select is((select status::text from p8_completed), 'completed', 'final information completes session');
select ok((select completed_at is not null from p8_completed), 'completion timestamp is server-side');
select is((select score_total from p8_completed), 2, 'completion returns persisted final score');
select is((select decision_count from p8_completed), 4, 'completion returns persisted decision count');
select is(
  (
    select replayed
    from public.advance_simulation_session(
      (select session_id from p8_started),
      '84000000-0000-4000-8000-000000000006'
    )
  ),
  true,
  'completion retry is idempotent'
);

select throws_ok(
  format(
    'select * from public.record_simulation_decision(%L, %L, %L)',
    (select session_id from p8_started),
    '84000000-0000-4000-8000-000000000002',
    'plus-two'
  ),
  'P0001',
  null,
  'completed session accepts no new decision'
);

select is(
  (
    select count(*)::integer
    from public.simulation_sessions
    where id = '85000000-0000-4000-8000-000000000002'
  ),
  0,
  'student cannot read another user session'
);
select is(
  (
    select count(*)::integer
    from public.simulation_actions
    where id = '86000000-0000-4000-8000-000000000002'
  ),
  0,
  'student cannot read another user action'
);
select throws_ok(
  $$select * from public.case_truth_models$$,
  '42501',
  null,
  'truth remains inaccessible'
);
select throws_ok(
  $$select * from public.case_step_rules$$,
  '42501',
  null,
  'rules remain inaccessible'
);

reset role;

select is(
  (
    select status::text
    from public.clinical_cases
    where id = '40000000-0000-4000-8000-000000000002'
  ),
  'draft',
  'P4 candidate remains draft'
);
select is(
  (
    select status::text
    from public.clinical_cases
    where id = '70000000-0000-4000-8000-000000000002'
  ),
  'draft',
  'P7 candidate remains draft'
);

select * from finish();
rollback;
