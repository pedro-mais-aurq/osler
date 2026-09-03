begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

select has_function(
  'public',
  'evaluate_case_step',
  array['uuid', 'uuid', 'text'],
  'P4 exposes the narrow step evaluation RPC'
);

select ok(
  (
    select routine.prosecdef
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'evaluate_case_step'
      and pg_get_function_identity_arguments(routine.oid) = 'p_case_id uuid, p_step_id uuid, p_option_id text'
  ),
  'the evaluation RPC is security definer'
);

select ok(
  (
    select routine.proconfig[1] in ('search_path=', 'search_path=""')
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'evaluate_case_step'
      and pg_get_function_identity_arguments(routine.oid) = 'p_case_id uuid, p_step_id uuid, p_option_id text'
  ),
  'the evaluation RPC pins an empty search_path'
);

select is(
  has_function_privilege(
    'anon',
    'public.evaluate_case_step(uuid, uuid, text)',
    'execute'
  ),
  false,
  'anon has no execute privilege'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.evaluate_case_step(uuid, uuid, text)',
    'execute'
  ),
  true,
  'authenticated receives the explicit execute privilege'
);

select is(
  (
    select status::text
    from public.clinical_cases
    where id = '40000000-0000-4000-8000-000000000002'
  ),
  'draft',
  'the nursing candidate remains a draft'
);

select ok(
  (
    select
      metadata ->> 'clinical_content_validated' = 'false'
      and reviewed_at is null
    from public.clinical_cases as clinical_case
    join public.case_truth_models as truth_model
      on truth_model.case_id = clinical_case.id
    where clinical_case.id = '40000000-0000-4000-8000-000000000002'
  ),
  'the candidate is explicitly unvalidated and unreviewed'
);

select is(
  (
    select count(*)::integer
    from public.clinical_cases
    where course = 'clinical_analysis'
      and metadata ->> 'authorship' = 'llm_candidate'
  ),
  0,
  'P4 authors no clinical analysis case'
);

select is(
  (
    select status::text
    from public.clinical_cases
    where id = '00000000-0000-4000-8000-000000000002'
  ),
  'draft',
  'the P2 schema fixture remains a draft'
);

select ok(
  not exists (
    select 1
    from public.case_steps as case_step
    cross join lateral jsonb_array_elements(case_step.options) as visible_option
    where case_step.case_id = '40000000-0000-4000-8000-000000000002'
      and visible_option ?| array[
        'correct',
        'isCorrect',
        'score',
        'classification',
        'feedback',
        'truth',
        'diagnosis'
      ]
  ),
  'candidate visible options contain only public choice data'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in ('case_truth_models', 'case_step_rules')
  ),
  0,
  'P4 adds no client policy to private scientific tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.case_truth_models', 'select')
  and not has_table_privilege('authenticated', 'public.case_step_rules', 'select'),
  'authenticated keeps no SELECT privilege on truth models or rules'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('51000000-0000-4000-8000-000000000001', 'p4-nursing@test.invalid', '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000002', 'p4-clinical@test.invalid', '{}'::jsonb);

update public.students
set course = 'nursing'
where user_id = '51000000-0000-4000-8000-000000000001';

update public.students
set course = 'clinical_analysis'
where user_id = '51000000-0000-4000-8000-000000000002';

update public.profiles
set role = 'teacher'
where user_id = '51000000-0000-4000-8000-000000000002';

insert into public.patients (id, display_name, metadata)
values (
  '52000000-0000-4000-8000-000000000001',
  'P4 technical fixture patient',
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
    '53000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    'p4-published-nursing-fixture',
    'P4 published nursing fixture',
    'nursing',
    'Technical fixture without clinical content.',
    'published',
    '{"fixture": true, "clinical_content": false}'::jsonb
  ),
  (
    '53000000-0000-4000-8000-000000000002',
    '52000000-0000-4000-8000-000000000001',
    'p4-published-clinical-fixture',
    'P4 published clinical fixture',
    'clinical_analysis',
    'Technical fixture without clinical content.',
    'published',
    '{"fixture": true, "clinical_content": false}'::jsonb
  ),
  (
    '53000000-0000-4000-8000-000000000003',
    '52000000-0000-4000-8000-000000000001',
    'p4-draft-nursing-fixture',
    'P4 draft nursing fixture',
    'nursing',
    'Technical fixture without clinical content.',
    'draft',
    '{"fixture": true, "clinical_content": false}'::jsonb
  );

insert into public.case_steps (
  id,
  case_id,
  position,
  step_key,
  step_type,
  title,
  content,
  options
)
values
  (
    '54000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000001',
    1,
    'p4-nursing-decision',
    'decision',
    'Technical nursing decision',
    '{"fixture": true}'::jsonb,
    '[
      {"id": "selected-option", "label": "Selected visible option"},
      {"id": "other-option", "label": "Other visible option"}
    ]'::jsonb
  ),
  (
    '54000000-0000-4000-8000-000000000002',
    '53000000-0000-4000-8000-000000000001',
    2,
    'p4-nursing-information',
    'information',
    'Technical information step',
    '{"fixture": true}'::jsonb,
    '[]'::jsonb
  ),
  (
    '54000000-0000-4000-8000-000000000005',
    '53000000-0000-4000-8000-000000000001',
    3,
    'p4-nursing-decision-without-rule',
    'decision',
    'Technical decision without rule',
    '{"fixture": true}'::jsonb,
    '[{"id": "selected-option", "label": "Selected visible option"}]'::jsonb
  ),
  (
    '54000000-0000-4000-8000-000000000003',
    '53000000-0000-4000-8000-000000000002',
    1,
    'p4-clinical-decision',
    'decision',
    'Technical clinical decision',
    '{"fixture": true}'::jsonb,
    '[{"id": "selected-option", "label": "Selected visible option"}]'::jsonb
  ),
  (
    '54000000-0000-4000-8000-000000000004',
    '53000000-0000-4000-8000-000000000003',
    1,
    'p4-draft-decision',
    'decision',
    'Technical draft decision',
    '{"fixture": true}'::jsonb,
    '[{"id": "selected-option", "label": "Selected visible option"}]'::jsonb
  );

insert into public.case_step_rules (step_id, rules)
values
  (
    '54000000-0000-4000-8000-000000000001',
    '{
      "private_marker": "RAW_RULE_MUST_NOT_LEAK",
      "options": {
        "selected-option": {
          "classification": "ideal",
          "score_delta": 2,
          "feedback": "Selected feedback only.",
          "consequence": "Selected consequence only.",
          "private_marker": "SELECTED_PRIVATE_MARKER"
        },
        "other-option": {
          "classification": "acceptable",
          "score_delta": 1,
          "feedback": "OTHER_OPTION_SECRET_FEEDBACK",
          "consequence": "OTHER_OPTION_SECRET_CONSEQUENCE"
        }
      }
    }'::jsonb
  ),
  (
    '54000000-0000-4000-8000-000000000003',
    '{"options": {"selected-option": {"classification": "ideal", "score_delta": 2, "feedback": "Clinical fixture feedback."}}}'::jsonb
  ),
  (
    '54000000-0000-4000-8000-000000000004',
    '{"options": {"selected-option": {"classification": "ideal", "score_delta": 2, "feedback": "Draft fixture feedback."}}}'::jsonb
  );

set local role anon;

select throws_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      'selected-option'
    )
  $$,
  '42501',
  null,
  'anon cannot execute the evaluation RPC'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';

select lives_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      'selected-option'
    )
  $$,
  'an authenticated nursing student can evaluate a valid visible option'
);

select throws_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000002',
      '54000000-0000-4000-8000-000000000003',
      'selected-option'
    )
  $$,
  'P0001',
  null,
  'a student cannot evaluate a case from another course'
);

select throws_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000003',
      '54000000-0000-4000-8000-000000000004',
      'selected-option'
    )
  $$,
  'P0001',
  null,
  'a student cannot evaluate a draft case'
);

select throws_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000003',
      'selected-option'
    )
  $$,
  'P0001',
  null,
  'a step from another case is rejected'
);

select throws_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000002',
      'selected-option'
    )
  $$,
  'P0001',
  null,
  'a non-decision step is rejected'
);

select throws_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      'invisible-option'
    )
  $$,
  'P0001',
  null,
  'an option not exposed by the visible step is rejected'
);

select throws_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000005',
      'selected-option'
    )
  $$,
  'P0001',
  null,
  'a decision without a private rule is rejected'
);

set local request.jwt.claim.sub = '51000000-0000-4000-8000-000000000002';

select throws_ok(
  $$
    select *
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000002',
      '54000000-0000-4000-8000-000000000003',
      'selected-option'
    )
  $$,
  '42501',
  null,
  'a non-student profile cannot evaluate a step'
);

set local request.jwt.claim.sub = '51000000-0000-4000-8000-000000000001';

select is(
  (
    select to_jsonb(result)
    from public.evaluate_case_step(
      '53000000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      'selected-option'
    ) as result
  ),
  '{
    "classification": "ideal",
    "score_delta": 2,
    "feedback": "Selected feedback only.",
    "consequence": "Selected consequence only."
  }'::jsonb,
  'the RPC returns only the evaluation for the selected option'
);

select is(
  (
    select count(*)::integer
    from jsonb_object_keys(
      (
        select to_jsonb(result)
        from public.evaluate_case_step(
          '53000000-0000-4000-8000-000000000001',
          '54000000-0000-4000-8000-000000000001',
          'selected-option'
        ) as result
      )
    )
  ),
  4,
  'the response surface has exactly four public fields and no raw rules or truth'
);

select * from finish();
rollback;
