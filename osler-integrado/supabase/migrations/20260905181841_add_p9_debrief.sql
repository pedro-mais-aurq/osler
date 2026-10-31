-- P9 exposes one completed, owned attempt as a stable pedagogical debrief.
-- Decision feedback comes exclusively from the P8 historical snapshot. The
-- private truth model is read only to project a strict bibliographic whitelist.

create or replace function public.get_simulation_debrief(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.simulation_sessions%rowtype;
  v_case public.clinical_cases%rowtype;
  v_decision_count integer;
  v_decisions jsonb;
  v_references jsonb;
begin
  if v_user_id is null then
    raise exception 'Este resultado não está disponível.' using errcode = '42501';
  end if;

  select simulation_session.*
  into v_session
  from public.simulation_sessions as simulation_session
  where simulation_session.id = p_session_id
    and simulation_session.user_id = v_user_id
    and simulation_session.status = 'completed'::public.simulation_status;

  if not found or v_session.completed_at is null then
    raise exception 'Este resultado não está disponível.' using errcode = 'P0001';
  end if;

  -- Historical ownership is sufficient. A completed result remains available
  -- when its case is archived, so this lookup intentionally has no status gate.
  select clinical_case.*
  into v_case
  from public.clinical_cases as clinical_case
  where clinical_case.id = v_session.case_id;

  if not found then
    raise exception 'Este resultado não está disponível.' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_decision_count
  from public.simulation_actions as simulation_action
  where simulation_action.session_id = v_session.id
    and simulation_action.user_id = v_user_id;

  if exists (
    select 1
    from public.simulation_actions as simulation_action
    left join public.case_steps as case_step
      on case_step.id = simulation_action.step_id
      and case_step.case_id = v_session.case_id
    where simulation_action.session_id = v_session.id
      and simulation_action.user_id = v_user_id
      and (
        case_step.id is null
        or case_step.step_type <> 'decision'
        or simulation_action.outcome is null
        or jsonb_typeof(simulation_action.outcome) is distinct from 'object'
        or simulation_action.outcome ->> 'schema_version' is distinct from '1'
        or not (simulation_action.outcome ? 'selected_option_label')
        or jsonb_typeof(
          simulation_action.outcome -> 'selected_option_label'
        ) is distinct from 'string'
        or nullif(
          btrim(simulation_action.outcome ->> 'selected_option_label'),
          ''
        ) is null
        or not (simulation_action.outcome ? 'classification')
        or simulation_action.outcome ->> 'classification' not in (
          'ideal',
          'acceptable',
          'needs_improvement',
          'unsafe'
        )
        or not (simulation_action.outcome ? 'feedback')
        or jsonb_typeof(
          simulation_action.outcome -> 'feedback'
        ) is distinct from 'string'
        or nullif(btrim(simulation_action.outcome ->> 'feedback'), '') is null
        or not (simulation_action.outcome ? 'consequence')
        or jsonb_typeof(
          simulation_action.outcome -> 'consequence'
        ) not in ('string', 'null')
        or (
          jsonb_typeof(simulation_action.outcome -> 'consequence') = 'string'
          and nullif(
            btrim(simulation_action.outcome ->> 'consequence'),
            ''
          ) is null
        )
      )
  ) then
    raise exception 'Não foi possível carregar este debrief.'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'action_id', simulation_action.id,
        'step_id', case_step.id,
        'step_key', case_step.step_key,
        'step_title', case_step.title,
        'position', case_step.position,
        'selected_option_id', simulation_action.selected_option_id,
        'selected_option_label',
          simulation_action.outcome ->> 'selected_option_label',
        'classification', simulation_action.outcome ->> 'classification',
        'score_delta', simulation_action.score_delta,
        'feedback', simulation_action.outcome ->> 'feedback',
        'consequence',
          case
            when jsonb_typeof(
              simulation_action.outcome -> 'consequence'
            ) = 'string'
              then simulation_action.outcome ->> 'consequence'
            else null
          end,
        'created_at', simulation_action.created_at
      )
      order by simulation_action.created_at, simulation_action.id
    ),
    '[]'::jsonb
  )
  into v_decisions
  from public.simulation_actions as simulation_action
  join public.case_steps as case_step
    on case_step.id = simulation_action.step_id
    and case_step.case_id = v_session.case_id
  where simulation_action.session_id = v_session.id
    and simulation_action.user_id = v_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', evidence_item.item ->> 'id',
          'authority', evidence_item.item ->> 'authority',
          'title', evidence_item.item ->> 'title',
          'year',
            case
              when jsonb_typeof(evidence_item.item -> 'year') = 'number'
                and evidence_item.item ->> 'year' ~ '^[0-9]{4}$'
                then (evidence_item.item ->> 'year')::integer
              else null
            end,
          'url',
            case
              when jsonb_typeof(evidence_item.item -> 'url') = 'string'
                and evidence_item.item ->> 'url' ~* '^https?://'
                then evidence_item.item ->> 'url'
              else null
            end,
          'verified_on',
            case
              when jsonb_typeof(evidence_item.item -> 'verified_on') = 'string'
                and evidence_item.item ->> 'verified_on'
                  ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                then evidence_item.item ->> 'verified_on'
              else null
            end
        )
      )
      order by evidence_item.ordinal
    ),
    '[]'::jsonb
  )
  into v_references
  from public.case_truth_models as truth_model
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(truth_model.truth_model -> 'evidence') = 'array'
        then truth_model.truth_model -> 'evidence'
      else '[]'::jsonb
    end
  ) with ordinality as evidence_item(item, ordinal)
  where truth_model.case_id = v_session.case_id
    and jsonb_typeof(evidence_item.item) = 'object'
    and jsonb_typeof(evidence_item.item -> 'id') = 'string'
    and nullif(btrim(evidence_item.item ->> 'id'), '') is not null
    and jsonb_typeof(evidence_item.item -> 'authority') = 'string'
    and nullif(btrim(evidence_item.item ->> 'authority'), '') is not null
    and jsonb_typeof(evidence_item.item -> 'title') = 'string'
    and nullif(btrim(evidence_item.item ->> 'title'), '') is not null;

  return jsonb_build_object(
    'schema_version', 1,
    'session', jsonb_build_object(
      'id', v_session.id,
      'status', v_session.status,
      'score_total', v_session.score_total,
      'decision_count', v_decision_count,
      'started_at', v_session.started_at,
      'completed_at', v_session.completed_at
    ),
    'case', jsonb_build_object(
      'id', v_case.id,
      'title', v_case.title,
      'educational_objective', nullif(btrim(v_case.educational_objective), '')
    ),
    'decisions', v_decisions,
    'references', v_references
  );
end;
$$;

revoke all on function public.get_simulation_debrief(uuid)
  from public, anon, authenticated;
grant execute on function public.get_simulation_debrief(uuid)
  to authenticated;

comment on function public.get_simulation_debrief(uuid) is
  'P9 RPC: returns an owned completed attempt using P8 decision snapshots and a sanitized case-reference projection.';
