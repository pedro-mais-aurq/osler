begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(42);

select has_function(
  'public',
  'resolve_simulation_transition',
  array['uuid', 'uuid', 'text'],
  'P5 exposes the generic transition RPC'
);

select ok(
  (
    select not routine.prosecdef
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'resolve_simulation_transition'
      and pg_get_function_identity_arguments(routine.oid) =
        'p_case_id uuid, p_step_id uuid, p_option_id text'
  ),
  'the exposed transition RPC is security invoker'
);

select ok(
  (
    select routine.proconfig[1] in ('search_path=', 'search_path=""')
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'resolve_simulation_transition'
      and pg_get_function_identity_arguments(routine.oid) =
        'p_case_id uuid, p_step_id uuid, p_option_id text'
  ),
  'the transition RPC pins an empty search_path'
);

select is(
  has_function_privilege(
    'anon',
    'public.resolve_simulation_transition(uuid, uuid, text)',
    'execute'
  ),
  false,
  'anon has no execute privilege on the P5 RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.resolve_simulation_transition(uuid, uuid, text)',
    'execute'
  ),
  true,
  'authenticated has explicit execute privilege on the P5 RPC'
);

select has_function(
  'private',
  'resolve_simulation_transition_internal',
  array['uuid', 'uuid', 'text'],
  'the privileged transition implementation lives in the private schema'
);

select ok(
  (
    select routine.prosecdef
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'private'
      and routine.proname = 'resolve_simulation_transition_internal'
      and pg_get_function_identity_arguments(routine.oid) =
        'p_case_id uuid, p_step_id uuid, p_option_id text'
  ),
  'the private implementation is security definer'
);

select ok(
  (
    select routine.proconfig[1] in ('search_path=', 'search_path=""')
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'private'
      and routine.proname = 'resolve_simulation_transition_internal'
      and pg_get_function_identity_arguments(routine.oid) =
        'p_case_id uuid, p_step_id uuid, p_option_id text'
  ),
  'the private implementation pins an empty search_path'
);

select is(
  has_function_privilege(
    'anon',
    'private.resolve_simulation_transition_internal(uuid, uuid, text)',
    'execute'
  ),
  false,
  'anon cannot execute the private implementation'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.resolve_simulation_transition_internal(uuid, uuid, text)',
    'execute'
  ),
  true,
  'authenticated can reach the private implementation only through an allowed schema'
);

select has_function(
  'public',
  'evaluate_case_step',
  array['uuid', 'uuid', 'text'],
  'the P4 evaluation RPC remains available'
);

select is(
  (
    select status::text
    from public.clinical_cases
    where id = '40000000-0000-4000-8000-000000000002'
  ),
  'draft',
  'the P4 candidate remains a draft'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('61000000-0000-4000-8000-000000000001', 'p5-nursing@test.invalid', '{}'::jsonb),
  ('61000000-0000-4000-8000-000000000002', 'p5-clinical@test.invalid', '{}'::jsonb);

update public.students
set course = 'nursing'
where user_id = '61000000-0000-4000-8000-000000000001';

update public.students
set course = 'clinical_analysis'
where user_id = '61000000-0000-4000-8000-000000000002';

insert into public.patients (id, display_name, metadata)
values (
  '62000000-0000-4000-8000-000000000001',
  'P5 technical fixture',
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
    '63000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    'p5-published-case-a',
    'P5 published fixture A',
    'nursing',
    'Technical fixture without clinical content.',
    'published',
    '{"fixture": true, "clinical_content": false}'::jsonb
  ),
  (
    '63000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000001',
    'p5-published-case-b',
    'P5 published fixture B',
    'nursing',
    'Technical fixture without clinical content.',
    'published',
    '{"fixture": true, "clinical_content": false}'::jsonb
  ),
  (
    '63000000-0000-4000-8000-000000000003',
    '62000000-0000-4000-8000-000000000001',
    'p5-published-clinical-fixture',
    'P5 published clinical fixture',
    'clinical_analysis',
    'Technical fixture without clinical content.',
    'published',
    '{"fixture": true, "clinical_content": false}'::jsonb
  ),
  (
    '63000000-0000-4000-8000-000000000004',
    '62000000-0000-4000-8000-000000000001',
    'p5-draft-fixture',
    'P5 draft fixture',
    'nursing',
    'Technical fixture without clinical content.',
    'draft',
    '{"fixture": true, "clinical_content": false}'::jsonb
  );

insert into public.case_truth_models (case_id, truth_model)
values (
  '63000000-0000-4000-8000-000000000001',
  '{"private_marker": "P5_TRUTH_MUST_NOT_LEAK"}'::jsonb
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
    '64000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    1,
    'a-information',
    'information',
    'Technical information',
    '{"body": "Technical body."}'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "stable"}'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000002',
    '63000000-0000-4000-8000-000000000001',
    2,
    'a-decision',
    'decision',
    'Technical decision',
    '{"body": "Technical decision body."}'::jsonb,
    '[
      {"id": "selected-option", "label": "Selected option"},
      {"id": "non-selected-option", "label": "Non-selected option"}
    ]'::jsonb,
    '{}'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000003',
    '63000000-0000-4000-8000-000000000001',
    3,
    'a-linear-target',
    'information',
    'Linear target',
    '{"body": "Linear target body."}'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "recovery"}'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000004',
    '63000000-0000-4000-8000-000000000001',
    4,
    'a-branch-decision',
    'decision',
    'Branch decision',
    '{"body": "Branch decision body."}'::jsonb,
    '[
      {"id": "branch-option", "label": "Branch"},
      {"id": "complete-option", "label": "Complete"},
      {"id": "other-case-option", "label": "Other case"},
      {"id": "invalid-transition-option", "label": "Invalid transition"},
      {"id": "invalid-state-option", "label": "Invalid state"}
    ]'::jsonb,
    '{}'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000005',
    '63000000-0000-4000-8000-000000000001',
    5,
    'a-branch-target',
    'information',
    'Branch target',
    '{"body": "Branch target body."}'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "warning"}'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000006',
    '63000000-0000-4000-8000-000000000001',
    6,
    'a-unsupported',
    'technical_unknown',
    'Unsupported step',
    '{"body": "Unsupported body."}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000007',
    '63000000-0000-4000-8000-000000000002',
    1,
    'only-other-case',
    'information',
    'Other case target',
    '{"body": "Other case body."}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000008',
    '63000000-0000-4000-8000-000000000003',
    1,
    'clinical-information',
    'information',
    'Clinical course fixture',
    '{"body": "Technical body."}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000009',
    '63000000-0000-4000-8000-000000000004',
    1,
    'draft-information',
    'information',
    'Draft fixture',
    '{"body": "Technical body."}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  );

insert into public.case_step_rules (step_id, rules)
values
  (
    '64000000-0000-4000-8000-000000000002',
    '{
      "private_marker": "P5_RULE_CONTAINER_MUST_NOT_LEAK",
      "options": {
        "selected-option": {
          "classification": "ideal",
          "score_delta": 2,
          "feedback": "Selected feedback only.",
          "consequence": "Selected consequence only.",
          "private_marker": "P5_SELECTED_PRIVATE_MARKER"
        },
        "non-selected-option": {
          "classification": "unsafe",
          "score_delta": -2,
          "feedback": "P5_NON_SELECTED_SECRET",
          "transition": {"type": "complete"}
        }
      }
    }'::jsonb
  ),
  (
    '64000000-0000-4000-8000-000000000004',
    '{
      "options": {
        "branch-option": {
          "classification": "acceptable",
          "score_delta": 0,
          "feedback": "Branch selected.",
          "presentation_state": "warning",
          "transition": {"type": "step", "step_key": "a-branch-target"}
        },
        "complete-option": {
          "classification": "ideal",
          "score_delta": 1,
          "feedback": "Complete selected.",
          "transition": {"type": "complete"}
        },
        "other-case-option": {
          "classification": "needs_improvement",
          "score_delta": -1,
          "feedback": "Invalid target selected.",
          "transition": {"type": "step", "step_key": "only-other-case"}
        },
        "invalid-transition-option": {
          "classification": "acceptable",
          "score_delta": 0,
          "feedback": "Invalid transition selected.",
          "transition": {"type": "teleport"}
        },
        "invalid-state-option": {
          "classification": "unsafe",
          "score_delta": -1,
          "feedback": "Invalid state selected.",
          "presentation_state": "unknown",
          "transition": {"type": "complete"}
        }
      }
    }'::jsonb
  );

create temporary table p5_write_counts as
select
  (select count(*) from public.simulation_sessions) as sessions,
  (select count(*) from public.simulation_actions) as actions;

set local role anon;

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      null
    )
  $$,
  '42501',
  null,
  'anon cannot execute the transition RPC'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';

select lives_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      null
    )
  $$,
  'an authenticated student can resolve a valid transition'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000003',
      '64000000-0000-4000-8000-000000000008',
      null
    )
  $$,
  'P0001',
  null,
  'a student cannot resolve a case from another course'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000004',
      '64000000-0000-4000-8000-000000000009',
      null
    )
  $$,
  'P0001',
  null,
  'a student cannot resolve a draft case'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000007',
      null
    )
  $$,
  'P0001',
  null,
  'a step from another case is rejected'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000002',
      'missing-option'
    )
  $$,
  'P0001',
  null,
  'an option not present in the visible step is rejected'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      'selected-option'
    )
  $$,
  'P0001',
  null,
  'an information step rejects an option'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000002',
      null
    )
  $$,
  'P0001',
  null,
  'a decision step requires an option'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      null
    )
  ),
  'a-decision',
  'an information step uses the next position as linear fallback'
);

select is(
  (
    select classification
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      null
    )
  ),
  null,
  'an information step returns no classification'
);

select is(
  (
    select score_delta
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      null
    )
  ),
  0,
  'an information step returns zero score delta'
);

select is(
  (
    select completed
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      null
    )
  ),
  false,
  'a linear transition with a target is not complete'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000002',
      'selected-option'
    )
  ),
  'a-linear-target',
  'a decision without an explicit transition uses linear fallback'
);

select is(
  (
    select classification
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000002',
      'selected-option'
    )
  ),
  'ideal',
  'the selected option classification is returned'
);

select is(
  (
    select score_delta
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000002',
      'selected-option'
    )
  ),
  2,
  'the selected option score is returned'
);

select is(
  (
    select feedback
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000002',
      'selected-option'
    )
  ),
  'Selected feedback only.',
  'the selected option feedback is returned'
);

select ok(
  position(
    'P5_NON_SELECTED_SECRET' in (
      select row_to_json(transition_result)::text
      from public.resolve_simulation_transition(
        '63000000-0000-4000-8000-000000000001',
        '64000000-0000-4000-8000-000000000002',
        'selected-option'
      ) as transition_result
    )
  ) = 0,
  'the result contains no rule for a non-selected option'
);

select ok(
  position(
    'P5_TRUTH_MUST_NOT_LEAK' in (
      select row_to_json(transition_result)::text
      from public.resolve_simulation_transition(
        '63000000-0000-4000-8000-000000000001',
        '64000000-0000-4000-8000-000000000002',
        'selected-option'
      ) as transition_result
    )
  ) = 0,
  'the result contains no truth model data'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000004',
      'branch-option'
    )
  ),
  'a-branch-target',
  'an explicit branch resolves its target in the same case'
);

select is(
  (
    select presentation_state
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000004',
      'branch-option'
    )
  ),
  'warning',
  'the selected rule controls the explicit presentation state'
);

select is(
  (
    select completed
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000004',
      'complete-option'
    )
  ),
  true,
  'an explicit complete transition completes the case'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000004',
      'complete-option'
    )
  ),
  null,
  'an explicit complete transition returns no next step'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000004',
      'other-case-option'
    )
  $$,
  'P0001',
  null,
  'a target that exists only in another case is rejected'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000004',
      'invalid-transition-option'
    )
  $$,
  'P0001',
  null,
  'an unknown transition type is rejected'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000004',
      'invalid-state-option'
    )
  $$,
  'P0001',
  null,
  'an invalid presentation state is rejected'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '63000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000006',
      null
    )
  $$,
  'P0001',
  null,
  'an unsupported step type is rejected'
);

reset role;

select is(
  (select count(*) from public.simulation_sessions),
  (select sessions from p5_write_counts),
  'the P5 RPC does not write simulation sessions'
);

select is(
  (select count(*) from public.simulation_actions),
  (select actions from p5_write_counts),
  'the P5 RPC does not write simulation actions'
);

select ok(
  not has_table_privilege('authenticated', 'public.case_truth_models', 'select')
  and not has_table_privilege('authenticated', 'public.case_step_rules', 'select'),
  'private truth and rule tables remain unreadable to authenticated clients'
);

select is(
  (
    select count(*)::integer
    from public.clinical_cases
    where metadata ->> 'fixture' = 'true'
      and metadata ->> 'clinical_content' <> 'false'
  ),
  0,
  'P5 fixtures contain no clinical content'
);

select * from finish();
rollback;
