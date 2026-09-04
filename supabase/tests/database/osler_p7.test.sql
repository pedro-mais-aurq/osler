begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

select is(
  (
    select status::text
    from public.clinical_cases
    where id = '70000000-0000-4000-8000-000000000002'
  ),
  'draft',
  'the P7 clinical analysis candidate remains a draft'
);

select ok(
  (
    select
      clinical_case.metadata ->> 'clinical_content_validated' = 'false'
      and clinical_case.metadata ->> 'review_status' =
        'pending_independent_clinical_and_pedagogical_review'
      and truth_model.reviewed_at is null
      and truth_model.truth_model ->> 'clinical_content_validated' = 'false'
    from public.clinical_cases as clinical_case
    join public.case_truth_models as truth_model
      on truth_model.case_id = clinical_case.id
    where clinical_case.id = '70000000-0000-4000-8000-000000000002'
  ),
  'the P7 candidate is explicitly unvalidated and unreviewed'
);

select is(
  (
    select course::text
    from public.clinical_cases
    where id = '70000000-0000-4000-8000-000000000002'
  ),
  'clinical_analysis',
  'the P7 case belongs to clinical analysis'
);

select is(
  (
    select count(*)::integer
    from public.case_steps
    where case_id = '70000000-0000-4000-8000-000000000002'
  ),
  8,
  'the P7 case stays within the eight-step target'
);

select ok(
  not exists (
    select 1
    from public.case_steps
    where case_id = '70000000-0000-4000-8000-000000000002'
      and step_type not in ('information', 'decision')
  ),
  'the P7 case uses only the generic information and decision types'
);

select ok(
  not exists (
    select 1
    from public.case_steps as case_step
    cross join lateral jsonb_object_keys(case_step.content -> 'laboratory') as laboratory_key
    where case_step.case_id = '70000000-0000-4000-8000-000000000002'
      and jsonb_typeof(case_step.content -> 'laboratory') = 'object'
      and laboratory_key not in ('stage', 'title', 'fields', 'notes')
  )
  and not exists (
    select 1
    from public.case_steps as case_step
    cross join lateral jsonb_array_elements(case_step.content -> 'laboratory' -> 'fields') as field
    cross join lateral jsonb_object_keys(field) as field_key
    where case_step.case_id = '70000000-0000-4000-8000-000000000002'
      and field_key not in ('label', 'value')
  ),
  'laboratory payloads contain only the visible presentation contract'
);

select ok(
  not exists (
    select 1
    from public.case_steps as case_step
    cross join lateral jsonb_array_elements(case_step.options) as visible_option
    where case_step.case_id = '70000000-0000-4000-8000-000000000002'
      and visible_option ?| array[
        'correct',
        'expected',
        'shouldReject',
        'score',
        'classification',
        'feedback',
        'truth',
        'nextStep',
        'rule'
      ]
  ),
  'visible P7 options contain no private evaluation data'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in ('case_truth_models', 'case_step_rules')
  ),
  0,
  'P7 adds no client policy to private scientific tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.case_truth_models', 'select')
  and not has_table_privilege('authenticated', 'public.case_step_rules', 'select'),
  'authenticated keeps no SELECT privilege on truth models or rules'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('72000000-0000-4000-8000-000000000001', 'p7-clinical@test.invalid', '{}'::jsonb),
  ('72000000-0000-4000-8000-000000000002', 'p7-nursing@test.invalid', '{}'::jsonb);

update public.students
set course = 'clinical_analysis'
where user_id = '72000000-0000-4000-8000-000000000001';

update public.students
set course = 'nursing'
where user_id = '72000000-0000-4000-8000-000000000002';

create temporary table p7_write_counts as
select
  (select count(*) from public.simulation_sessions) as sessions,
  (select count(*) from public.simulation_actions) as actions;

set local role authenticated;
set local request.jwt.claim.sub = '72000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';

select throws_ok(
  $$select * from public.case_truth_models$$,
  '42501',
  null,
  'a clinical analysis student cannot select truth models'
);

select throws_ok(
  $$select * from public.case_step_rules$$,
  '42501',
  null,
  'a clinical analysis student cannot select private rules'
);

select is(
  (
    select count(*)::integer
    from public.clinical_cases
    where id = '70000000-0000-4000-8000-000000000002'
  ),
  0,
  'the draft P7 candidate is not visible to the student'
);

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000001',
      null
    )
  $$,
  'P0001',
  null,
  'the P5 RPC does not resolve the draft P7 candidate'
);

reset role;

-- Transaction-only publication for architectural QA. Rollback at the end keeps
-- the authored candidate in draft and does not represent scientific approval.
update public.clinical_cases
set status = 'published'
where id = '70000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub = '72000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';

select is(
  (
    select count(*)::integer
    from public.clinical_cases
    where id = '70000000-0000-4000-8000-000000000002'
      and course = 'clinical_analysis'
  ),
  1,
  'a clinical analysis student can access the transactionally published case'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000001',
      null
    )
  ),
  'sample-received',
  'the request information advances through the P5 RPC'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000002',
      null
    )
  ),
  'preanalytical-decision',
  'the sample information advances linearly without a new engine'
);

select is(
  (
    select classification
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000003',
      'block-and-recollect'
    )
  ),
  'ideal',
  'the P5 RPC evaluates the significant preanalytical decision'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000003',
      'block-and-recollect'
    )
  ),
  'replacement-sample-received',
  'the ideal option branches directly to the replacement sample'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000003',
      'accept-with-note'
    )
  ),
  'traceability-correction',
  'a nonideal option branches through the correction step'
);

select ok(
  position(
    'O resultado técnico não deve ser disponibilizado diretamente' in (
      select row_to_json(transition_result)::text
      from public.resolve_simulation_transition(
        '70000000-0000-4000-8000-000000000002',
        '71000000-0000-4000-8000-000000000008',
        'forward-qualified-professional'
      ) as transition_result
    )
  ) = 0,
  'feedback for a non-selected release option does not leak'
);

select ok(
  position(
    'initial_sample_acceptable_under_simulated_service_procedure' in (
      select row_to_json(transition_result)::text
      from public.resolve_simulation_transition(
        '70000000-0000-4000-8000-000000000002',
        '71000000-0000-4000-8000-000000000003',
        'block-and-recollect'
      ) as transition_result
    )
  ) = 0,
  'the transition response contains no P7 truth model data'
);

select is(
  (
    select completed
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000008',
      'forward-qualified-professional'
    )
  ),
  true,
  'the same P5 RPC completes the laboratory case'
);

select is(
  (
    select next_step_key
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000008',
      'forward-qualified-professional'
    )
  ),
  null,
  'completion returns no next step'
);

set local request.jwt.claim.sub = '72000000-0000-4000-8000-000000000002';

select throws_ok(
  $$
    select *
    from public.resolve_simulation_transition(
      '70000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000001',
      null
    )
  $$,
  'P0001',
  null,
  'a nursing student cannot resolve the clinical analysis case'
);

reset role;

select is(
  (select count(*) from public.simulation_sessions),
  (select sessions from p7_write_counts),
  'P7 transition tests write no simulation session'
);

select is(
  (select count(*) from public.simulation_actions),
  (select actions from p7_write_counts),
  'P7 transition tests write no simulation action'
);

update public.clinical_cases
set status = 'draft'
where id = '70000000-0000-4000-8000-000000000002';

select is(
  (
    select status::text
    from public.clinical_cases
    where id = '70000000-0000-4000-8000-000000000002'
  ),
  'draft',
  'transactional QA restores the P7 candidate to draft before rollback'
);

select * from finish();
rollback;
