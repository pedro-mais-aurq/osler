begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_function(
  'public',
  'get_simulation_debrief',
  array['uuid'],
  'P9 exposes the dedicated debrief RPC'
);

select is(
  (
    select routine.prosecdef
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'get_simulation_debrief'
      and routine.proargtypes = '2950'::oidvector
  ),
  true,
  'P9 debrief RPC is security definer'
);

select ok(
  exists (
    select 1
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'get_simulation_debrief'
      and routine.proargtypes = '2950'::oidvector
      and routine.proconfig[1] in ('search_path=', 'search_path=""')
  ),
  'P9 debrief RPC pins an empty search_path'
);

select ok(
  not exists (
    select 1
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    cross join lateral aclexplode(
      coalesce(routine.proacl, acldefault('f', routine.proowner))
    ) as privilege
    where namespace.nspname = 'public'
      and routine.proname = 'get_simulation_debrief'
      and routine.proargtypes = '2950'::oidvector
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute the P9 debrief RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_simulation_debrief(uuid)',
    'execute'
  ),
  'anon cannot execute the P9 debrief RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_simulation_debrief(uuid)',
    'execute'
  ),
  'authenticated has explicit execute privilege on the P9 debrief RPC'
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
  'P9 does not reopen direct writes revoked by P8'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'p9-owner@test.invalid',
    '{}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'p9-other@test.invalid',
    '{}'::jsonb
  );

update public.students
set course = 'nursing'
where user_id in (
  'b1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002'
);

insert into public.patients (id, display_name, metadata)
values (
  'b2000000-0000-4000-8000-000000000001',
  'P9 technical fixture',
  '{"fixture": true, "clinical_content": false}'::jsonb
);

insert into public.clinical_cases (
  id,
  patient_id,
  slug,
  title,
  course,
  description,
  educational_objective,
  status,
  metadata
)
values (
  'b3000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'p9-historical-debrief-fixture',
  'P9 historical debrief fixture',
  'nursing',
  'Technical fixture without clinical content.',
  'Review the exact historical decisions of one completed attempt.',
  'published',
  '{"fixture": true, "clinical_content": false}'::jsonb
);

insert into public.case_truth_models (case_id, truth_model)
values (
  'b3000000-0000-4000-8000-000000000001',
  '{
    "private_marker": "P9_TRUTH_MUST_NOT_LEAK",
    "diagnosis": "P9_HIDDEN_DIAGNOSIS",
    "evidence": [
      {
        "id": "p9-source-one",
        "authority": "P9 public authority",
        "title": "P9 public reference",
        "year": 2026,
        "url": "https://example.org/p9-reference",
        "verified_on": "2026-09-05",
        "private_note": "P9_REFERENCE_PRIVATE_NOTE"
      },
      {
        "id": "p9-source-two",
        "authority": "P9 second authority",
        "title": "P9 reference without optional public metadata",
        "url": "javascript:alert(1)",
        "internal_grade": "P9_INTERNAL_GRADE"
      },
      {
        "id": "p9-invalid-source",
        "title": "Missing authority and must be filtered"
      }
    ]
  }'::jsonb
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
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    1,
    'p9-decision-one',
    'decision',
    'P9 first historical decision',
    '{"body": "Technical decision one."}'::jsonb,
    '[
      {"id": "one-selected", "label": "Current visible label one"},
      {"id": "one-other", "label": "P9_OTHER_OPTION_LABEL"}
    ]'::jsonb,
    '{}'::jsonb
  ),
  (
    'b4000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000001',
    2,
    'p9-decision-two',
    'decision',
    'P9 second historical decision',
    '{"body": "Technical decision two."}'::jsonb,
    '[{"id": "two-selected", "label": "Current visible label two"}]'::jsonb,
    '{}'::jsonb
  ),
  (
    'b4000000-0000-4000-8000-000000000003',
    'b3000000-0000-4000-8000-000000000001',
    3,
    'p9-decision-three',
    'decision',
    null,
    '{"body": "Technical decision three."}'::jsonb,
    '[{"id": "three-selected", "label": "Current visible label three"}]'::jsonb,
    '{}'::jsonb
  ),
  (
    'b4000000-0000-4000-8000-000000000004',
    'b3000000-0000-4000-8000-000000000001',
    4,
    'p9-decision-four',
    'decision',
    'P9 fourth historical decision',
    '{"body": "Technical decision four."}'::jsonb,
    '[{"id": "four-selected", "label": "Current visible label four"}]'::jsonb,
    '{}'::jsonb
  );

-- These are deliberately different from the stored P8 outcomes. If the P9 RPC
-- recalculates current rules, the assertions below will expose the regression.
insert into public.case_step_rules (step_id, rules)
values
  (
    'b4000000-0000-4000-8000-000000000001',
    '{
      "private_marker": "P9_RULES_MUST_NOT_LEAK",
      "options": {
        "one-selected": {
          "classification": "unsafe",
          "score_delta": -999,
          "feedback": "P9_NEW_RULE_FEEDBACK_MUST_NOT_APPEAR",
          "consequence": "P9_NEW_RULE_CONSEQUENCE_MUST_NOT_APPEAR",
          "transition": {"type": "complete"}
        },
        "one-other": {
          "classification": "ideal",
          "score_delta": 999,
          "feedback": "P9_OTHER_OPTION_FEEDBACK_MUST_NOT_APPEAR",
          "transition": {"type": "complete"}
        }
      }
    }'::jsonb
  );

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
    'b5000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'completed',
    'b4000000-0000-4000-8000-000000000004',
    -1,
    '2026-09-05 10:00:00+00',
    '2026-09-05 10:08:00+00'
  ),
  (
    'b5000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000001',
    'completed',
    'b4000000-0000-4000-8000-000000000001',
    7,
    '2026-09-05 10:00:00+00',
    '2026-09-05 10:02:00+00'
  ),
  (
    'b5000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'in_progress',
    'b4000000-0000-4000-8000-000000000001',
    0,
    '2026-09-05 11:00:00+00',
    null
  ),
  (
    'b5000000-0000-4000-8000-000000000004',
    'b1000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'abandoned',
    'b4000000-0000-4000-8000-000000000001',
    0,
    '2026-09-05 09:00:00+00',
    null
  ),
  (
    'b5000000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'completed',
    'b4000000-0000-4000-8000-000000000001',
    0,
    '2026-09-05 08:00:00+00',
    '2026-09-05 08:01:00+00'
  ),
  (
    'b5000000-0000-4000-8000-000000000006',
    'b1000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'completed',
    'b4000000-0000-4000-8000-000000000001',
    1,
    '2026-09-05 07:00:00+00',
    '2026-09-05 07:01:00+00'
  );

insert into public.simulation_actions (
  id,
  session_id,
  user_id,
  step_id,
  selected_option_id,
  outcome,
  score_delta,
  created_at
)
values
  (
    'b6000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'one-selected',
    '{
      "schema_version": 1,
      "selected_option_label": "P9 historical label one",
      "classification": "ideal",
      "feedback": "P9 historical feedback one",
      "consequence": null,
      "next_step_key": "p9-decision-two",
      "completed": false,
      "presentation_state": "stable"
    }'::jsonb,
    2,
    '2026-09-05 10:02:00+00'
  ),
  (
    'b6000000-0000-4000-8000-000000000002',
    'b5000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000002',
    'two-selected',
    '{
      "schema_version": 1,
      "selected_option_label": "P9 historical label two",
      "classification": "acceptable",
      "feedback": "P9 historical feedback two",
      "consequence": "P9 historical consequence two",
      "next_step_key": "p9-decision-three",
      "completed": false,
      "presentation_state": "recovery"
    }'::jsonb,
    1,
    '2026-09-05 10:02:00+00'
  ),
  (
    'b6000000-0000-4000-8000-000000000003',
    'b5000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000003',
    'three-selected',
    '{
      "schema_version": 1,
      "selected_option_label": "P9 historical label three",
      "classification": "needs_improvement",
      "feedback": "P9 historical feedback three",
      "consequence": null,
      "next_step_key": "p9-decision-four",
      "completed": false,
      "presentation_state": "warning"
    }'::jsonb,
    0,
    '2026-09-05 10:03:00+00'
  ),
  (
    'b6000000-0000-4000-8000-000000000004',
    'b5000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000004',
    'four-selected',
    '{
      "schema_version": 1,
      "selected_option_label": "P9 historical label four",
      "classification": "unsafe",
      "feedback": "P9 historical feedback four",
      "consequence": "P9 historical consequence four",
      "next_step_key": null,
      "completed": true,
      "presentation_state": "critical"
    }'::jsonb,
    -4,
    '2026-09-05 10:04:00+00'
  ),
  (
    'b6000000-0000-4000-8000-000000000005',
    'b5000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'b4000000-0000-4000-8000-000000000001',
    'one-selected',
    '{
      "schema_version": 1,
      "selected_option_label": "P9 other user historical label",
      "classification": "ideal",
      "feedback": "P9_OTHER_USER_FEEDBACK_MUST_NOT_LEAK",
      "consequence": null,
      "next_step_key": null,
      "completed": true,
      "presentation_state": "stable"
    }'::jsonb,
    7,
    '2026-09-05 10:01:00+00'
  ),
  (
    'b6000000-0000-4000-8000-000000000006',
    'b5000000-0000-4000-8000-000000000006',
    'b1000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'one-selected',
    '{
      "schema_version": 1,
      "classification": "ideal",
      "feedback": "Legacy snapshot without the selected label",
      "consequence": null,
      "next_step_key": null,
      "completed": true,
      "presentation_state": "stable"
    }'::jsonb,
    1,
    '2026-09-05 07:00:30+00'
  );

-- Historical debriefs remain readable after publication ends.
update public.clinical_cases
set status = 'archived'
where id = 'b3000000-0000-4000-8000-000000000001';

set local role anon;
set local request.jwt.claim.role = 'anon';

select throws_ok(
  $$
    select public.get_simulation_debrief(
      'b5000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  null,
  'anonymous callers cannot read a debrief'
);

reset role;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-000000000001';

create temporary table p9_debrief as
select public.get_simulation_debrief(
  'b5000000-0000-4000-8000-000000000001'
) as payload;

select is(
  (select payload ->> 'schema_version' from p9_debrief),
  '1',
  'debrief exposes the versioned P9 contract'
);

select is(
  (select payload #>> '{case,title}' from p9_debrief),
  'P9 historical debrief fixture',
  'completed attempt remains readable after its case is archived'
);

select is(
  (select payload #>> '{session,status}' from p9_debrief),
  'completed',
  'debrief is explicitly tied to a completed session'
);

select is(
  (select (payload #>> '{session,score_total}')::integer from p9_debrief),
  -1,
  'raw negative score is preserved without normalization'
);

select is(
  (select (payload #>> '{session,decision_count}')::integer from p9_debrief),
  4,
  'decision count comes from persisted P8 actions'
);

select is(
  (
    select array_agg(decision ->> 'action_id' order by ordinal)
    from p9_debrief
    cross join lateral jsonb_array_elements(payload -> 'decisions')
      with ordinality as trajectory(decision, ordinal)
  ),
  array[
    'b6000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000002',
    'b6000000-0000-4000-8000-000000000003',
    'b6000000-0000-4000-8000-000000000004'
  ]::text[],
  'trajectory order is stable by created_at and action id'
);

select is(
  (select payload #>> '{decisions,0,selected_option_label}' from p9_debrief),
  'P9 historical label one',
  'selected label comes from the P8 historical snapshot'
);

select is(
  (select payload #>> '{decisions,0,classification}' from p9_debrief),
  'ideal',
  'classification is not recalculated from the current private rule'
);

select is(
  (select payload #>> '{decisions,0,feedback}' from p9_debrief),
  'P9 historical feedback one',
  'feedback is not recalculated from the current private rule'
);

select is(
  (select payload #>> '{decisions,1,consequence}' from p9_debrief),
  'P9 historical consequence two',
  'historical consequence is exposed separately from feedback'
);

select is(
  (
    select array_agg(decision ->> 'classification' order by ordinal)
    from p9_debrief
    cross join lateral jsonb_array_elements(payload -> 'decisions')
      with ordinality as trajectory(decision, ordinal)
  ),
  array['ideal', 'acceptable', 'needs_improvement', 'unsafe']::text[],
  'all four P5 classifications remain distinguishable'
);

select is(
  (
    select array_agg(key order by key)
    from p9_debrief
    cross join lateral jsonb_object_keys(payload) as root_keys(key)
  ),
  array['case', 'decisions', 'references', 'schema_version', 'session']::text[],
  'debrief root has a strict public whitelist'
);

select is(
  (
    select array_agg(key order by key)
    from p9_debrief
    cross join lateral jsonb_object_keys(payload -> 'session') as session_keys(key)
  ),
  array[
    'completed_at',
    'decision_count',
    'id',
    'score_total',
    'started_at',
    'status'
  ]::text[],
  'session projection omits ownership and private execution fields'
);

select is(
  (
    select array_agg(key order by key)
    from p9_debrief
    cross join lateral jsonb_array_elements(payload -> 'decisions')
      as trajectory(decision)
    cross join lateral jsonb_object_keys(trajectory.decision) as decision_keys(key)
    where trajectory.decision ->> 'action_id' =
      'b6000000-0000-4000-8000-000000000001'
  ),
  array[
    'action_id',
    'classification',
    'consequence',
    'created_at',
    'feedback',
    'position',
    'score_delta',
    'selected_option_id',
    'selected_option_label',
    'step_id',
    'step_key',
    'step_title'
  ]::text[],
  'decision projection has no rule, truth or future-transition fields'
);

select is(
  (select jsonb_array_length(payload -> 'references') from p9_debrief),
  2,
  'only evidence with required public bibliographic fields is projected'
);

select is(
  (
    select array_agg(key order by key)
    from p9_debrief
    cross join lateral jsonb_object_keys(
      payload #> '{references,0}'
    ) as reference_keys(key)
  ),
  array['authority', 'id', 'title', 'url', 'verified_on', 'year']::text[],
  'complete bibliography entry uses only the approved whitelist'
);

select is(
  (
    select array_agg(key order by key)
    from p9_debrief
    cross join lateral jsonb_object_keys(
      payload #> '{references,1}'
    ) as reference_keys(key)
  ),
  array['authority', 'id', 'title']::text[],
  'invalid optional URL and private evidence metadata are omitted'
);

select ok(
  (
    select position('P9_TRUTH_MUST_NOT_LEAK' in payload::text) = 0
      and position('P9_HIDDEN_DIAGNOSIS' in payload::text) = 0
      and position('P9_RULES_MUST_NOT_LEAK' in payload::text) = 0
      and position('P9_NEW_RULE_FEEDBACK_MUST_NOT_APPEAR' in payload::text) = 0
      and position('P9_OTHER_OPTION_LABEL' in payload::text) = 0
      and position('P9_OTHER_OPTION_FEEDBACK_MUST_NOT_APPEAR' in payload::text) = 0
      and position('P9_OTHER_USER_FEEDBACK_MUST_NOT_LEAK' in payload::text) = 0
      and position('P9_REFERENCE_PRIVATE_NOTE' in payload::text) = 0
      and position('P9_INTERNAL_GRADE' in payload::text) = 0
    from p9_debrief
  ),
  'truth, current rules, other options, other users and private evidence do not leak'
);

select is(
  (
    select count(*)::integer
    from public.simulation_sessions
    where user_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  0,
  'existing P8 RLS still hides other users sessions'
);

select is(
  (
    select count(*)::integer
    from public.simulation_actions
    where user_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  0,
  'existing P8 RLS still hides other users actions'
);

select throws_ok(
  $$
    select public.get_simulation_debrief(
      'b5000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  'Este resultado não está disponível.',
  'foreign completed session is indistinguishable from unavailable'
);

select throws_ok(
  $$
    select public.get_simulation_debrief(
      'b5000000-0000-4000-8000-000000000003'
    )
  $$,
  'P0001',
  'Este resultado não está disponível.',
  'in-progress own session is unavailable'
);

select throws_ok(
  $$
    select public.get_simulation_debrief(
      'b5000000-0000-4000-8000-000000000004'
    )
  $$,
  'P0001',
  'Este resultado não está disponível.',
  'abandoned own session is unavailable'
);

select throws_ok(
  $$
    select public.get_simulation_debrief(
      'b5000000-0000-4000-8000-000000000099'
    )
  $$,
  'P0001',
  'Este resultado não está disponível.',
  'nonexistent session shares the safe unavailable response'
);

select throws_ok(
  $$
    select public.get_simulation_debrief(
      'b5000000-0000-4000-8000-000000000006'
    )
  $$,
  '22023',
  'Não foi possível carregar este debrief.',
  'legacy action without a valid P8 snapshot fails closed'
);

create temporary table p9_zero_decision as
select public.get_simulation_debrief(
  'b5000000-0000-4000-8000-000000000005'
) as payload;

select is(
  (
    select (payload #>> '{session,decision_count}')::integer
    from p9_zero_decision
  ),
  0,
  'completed session may honestly contain zero decisions'
);

select is(
  (select payload -> 'decisions' from p9_zero_decision),
  '[]'::jsonb,
  'zero-decision trajectory is an empty array rather than fabricated content'
);

reset role;

select * from finish();
rollback;
