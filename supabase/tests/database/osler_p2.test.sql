begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(44);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'students', 'students exists');
select has_table('public', 'teachers', 'teachers exists');
select has_table('public', 'admins', 'admins exists');
select has_table('public', 'patients', 'patients exists');
select has_table('public', 'clinical_cases', 'clinical_cases exists');
select has_table('public', 'case_truth_models', 'case_truth_models exists');
select has_table('public', 'case_steps', 'case_steps exists');
select has_table('public', 'case_step_rules', 'case_step_rules exists');
select has_table('public', 'simulation_sessions', 'simulation_sessions exists');
select has_table('public', 'simulation_actions', 'simulation_actions exists');

select is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (
        array[
          'profiles',
          'students',
          'teachers',
          'admins',
          'patients',
          'clinical_cases',
          'case_truth_models',
          'case_steps',
          'case_step_rules',
          'simulation_sessions',
          'simulation_actions'
        ]
      )
      and relation.relrowsecurity
  ),
  11,
  'RLS is enabled on every application table'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'case_truth_models'),
  0,
  'case_truth_models has no client policy'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'case_step_rules'),
  0,
  'case_step_rules has no client policy'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'osler-user-a@test.invalid', '{}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'osler-user-b@test.invalid', '{}'::jsonb);

select is(
  (select role::text from public.profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'student',
  'new auth users receive only the student role'
);

select ok(
  exists (
    select 1 from public.students where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'new auth users receive a student extension with nullable course'
);

select throws_ok(
  $$
    insert into public.case_steps (case_id, position, step_key, step_type)
    values (
      '00000000-0000-4000-8000-000000000002',
      1,
      'another-position-one',
      'information'
    )
  $$,
  '23505',
  null,
  'duplicate position inside one case is rejected'
);

select throws_ok(
  $$
    insert into public.case_steps (case_id, position, step_key, step_type)
    values (
      '00000000-0000-4000-8000-000000000002',
      99,
      'fixture-introduction',
      'information'
    )
  $$,
  '23505',
  null,
  'duplicate step_key inside one case is rejected'
);

select throws_ok(
  $$
    insert into public.clinical_cases (
      patient_id,
      slug,
      title,
      course,
      description
    )
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'invalid-patient-fixture',
      'Invalid patient fixture',
      'nursing',
      'Constraint test only.'
    )
  $$,
  '23503',
  null,
  'a case must reference an existing patient'
);

select throws_ok(
  $$
    insert into public.case_steps (case_id, position, step_key, step_type)
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      1,
      'invalid-case-step',
      'information'
    )
  $$,
  '23503',
  null,
  'a step must reference an existing case'
);

select throws_ok(
  $$
    insert into public.case_truth_models (case_id, truth_model)
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '{"fixture": true}'::jsonb
    )
  $$,
  '23503',
  null,
  'a truth model must reference an existing case'
);

select throws_ok(
  $$
    insert into public.case_step_rules (step_id, rules)
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '{"fixture": true}'::jsonb
    )
  $$,
  '23503',
  null,
  'step rules must reference an existing step'
);

update public.clinical_cases
set status = 'published'
where id = '00000000-0000-4000-8000-000000000002';

insert into public.simulation_sessions (id, user_id, case_id)
values (
  'bbbbbbbb-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '00000000-0000-4000-8000-000000000002'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*)::integer from public.profiles),
  1,
  'an authenticated user sees only their own profile'
);

select lives_ok(
  $$
    update public.students
    set course = 'nursing'
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'a student can update their own course'
);

select is_empty(
  $$
    update public.students
    set course = 'clinical_analysis'
    where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    returning user_id
  $$,
  'a student cannot update another student course'
);

select throws_ok(
  $$
    update public.profiles
    set role = 'admin'
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  '42501',
  null,
  'a common user cannot promote their own role'
);

select throws_ok(
  $$
    update public.clinical_cases
    set title = 'Client-side mutation'
    where id = '00000000-0000-4000-8000-000000000002'
  $$,
  '42501',
  null,
  'students cannot update visible case content'
);

select throws_ok(
  $$select * from public.case_truth_models$$,
  '42501',
  null,
  'students cannot select scientific truth models'
);

select throws_ok(
  $$select * from public.case_step_rules$$,
  '42501',
  null,
  'students cannot select private step rules'
);

select is(
  (
    select count(*)::integer
    from public.simulation_sessions
    where id = 'bbbbbbbb-0000-4000-8000-000000000001'
  ),
  0,
  'a user cannot see another user session'
);

select lives_ok(
  $$
    insert into public.simulation_sessions (user_id, case_id)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  'a user can create a session for themselves and a published case'
);

select is(
  (
    select count(*)::integer
    from public.simulation_sessions
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  1,
  'a user can read their own session'
);

select throws_ok(
  $$
    insert into public.simulation_actions (
      session_id,
      user_id,
      step_id,
      selected_option_id
    )
    values (
      'bbbbbbbb-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '00000000-0000-4000-8000-000000000004',
      'option-a'
    )
  $$,
  '42501',
  null,
  'a user cannot attach an action to another user session'
);

select throws_ok(
  $$
    insert into public.simulation_actions (
      session_id,
      user_id,
      step_id,
      selected_option_id
    )
    select
      id,
      user_id,
      '00000000-0000-4000-8000-000000000004',
      'nonexistent-option'
    from public.simulation_sessions
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    limit 1
  $$,
  '42501',
  null,
  'an action must select an option exposed by its step'
);

select lives_ok(
  $$
    insert into public.simulation_actions (
      session_id,
      user_id,
      step_id,
      selected_option_id
    )
    select
      id,
      user_id,
      '00000000-0000-4000-8000-000000000004',
      'option-a'
    from public.simulation_sessions
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    limit 1
  $$,
  'a user can record a visible option in their own active session'
);

select throws_ok(
  $$
    insert into public.simulation_actions (
      session_id,
      user_id,
      step_id,
      selected_option_id,
      outcome
    )
    select
      id,
      user_id,
      '00000000-0000-4000-8000-000000000004',
      'option-b',
      '{"classification": "ideal"}'::jsonb
    from public.simulation_sessions
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    limit 1
  $$,
  '42501',
  null,
  'the client cannot inject an evaluated outcome'
);

select throws_ok(
  $$
    update public.simulation_sessions
    set score_total = 999
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  '42501',
  null,
  'the client cannot write its own score'
);

reset role;

delete from auth.users
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select count(*)::integer from public.profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'deleting an auth user cascades to profiles'
);

select is(
  (select count(*)::integer from public.students where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'deleting an auth user cascades to students'
);

select is(
  (select count(*)::integer from public.simulation_sessions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'deleting an auth user cascades to sessions'
);

select is(
  (select count(*)::integer from public.simulation_actions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'deleting an auth user leaves no orphan actions'
);

insert into public.patients (id, display_name)
values ('10000000-0000-4000-8000-000000000001', 'Disposable fixture patient');

insert into public.clinical_cases (
  id,
  patient_id,
  slug,
  title,
  course,
  description
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'disposable-cascade-fixture',
  'Disposable cascade fixture',
  'nursing',
  'Constraint test only.'
);

insert into public.case_truth_models (case_id, truth_model)
values (
  '20000000-0000-4000-8000-000000000001',
  '{"fixture": true}'::jsonb
);

insert into public.case_steps (id, case_id, position, step_key, step_type)
values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  1,
  'disposable-step',
  'information'
);

insert into public.case_step_rules (step_id, rules)
values (
  '30000000-0000-4000-8000-000000000001',
  '{"fixture": true}'::jsonb
);

delete from public.clinical_cases
where id = '20000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer from public.case_truth_models where case_id = '20000000-0000-4000-8000-000000000001'),
  0,
  'deleting a case cascades to its truth model'
);

select is(
  (select count(*)::integer from public.case_steps where case_id = '20000000-0000-4000-8000-000000000001'),
  0,
  'deleting a case cascades to its steps'
);

select is(
  (select count(*)::integer from public.case_step_rules where step_id = '30000000-0000-4000-8000-000000000001'),
  0,
  'deleting a case cascades to its step rules'
);

select * from finish();
rollback;
