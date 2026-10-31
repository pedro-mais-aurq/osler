create or replace function public.evaluate_case_step(
  p_case_id uuid,
  p_step_id uuid,
  p_option_id text
)
returns table (
  classification text,
  score_delta integer,
  feedback text,
  consequence text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_course public.course_code;
  v_rules jsonb;
  v_selected_rule jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticação de estudante necessária.' using errcode = '42501';
  end if;

  select student.course
  into v_student_course
  from public.profiles as profile
  join public.students as student
    on student.user_id = profile.user_id
  where profile.user_id = auth.uid()
    and profile.role = 'student'::public.app_role;

  if not found then
    raise exception 'Esta operação está disponível apenas para estudantes.'
      using errcode = '42501';
  end if;

  if v_student_course is null then
    raise exception 'Selecione um curso antes de iniciar a simulação.'
      using errcode = '42501';
  end if;

  perform 1
  from public.clinical_cases as clinical_case
  where clinical_case.id = p_case_id
    and clinical_case.status = 'published'::public.case_status
    and clinical_case.course = v_student_course;

  if not found then
    raise exception 'Caso publicado indisponível para o curso do estudante.'
      using errcode = 'P0001';
  end if;

  perform 1
  from public.case_steps as case_step
  where case_step.id = p_step_id
    and case_step.case_id = p_case_id
    and case_step.step_type = 'decision';

  if not found then
    raise exception 'Etapa de decisão inválida para este caso.'
      using errcode = 'P0001';
  end if;

  if p_option_id is null or btrim(p_option_id) = '' or not exists (
    select 1
    from public.case_steps as visible_step
    cross join lateral jsonb_array_elements(visible_step.options) as visible_option
    where visible_step.id = p_step_id
      and visible_step.case_id = p_case_id
      and visible_option ->> 'id' = p_option_id
  ) then
    raise exception 'Opção inválida para esta etapa.' using errcode = 'P0001';
  end if;

  select step_rule.rules
  into v_rules
  from public.case_step_rules as step_rule
  where step_rule.step_id = p_step_id;

  if not found then
    raise exception 'Regra de avaliação indisponível para esta etapa.'
      using errcode = 'P0001';
  end if;

  v_selected_rule := v_rules -> 'options' -> p_option_id;

  if v_selected_rule is null
    or jsonb_typeof(v_selected_rule) <> 'object'
    or v_selected_rule ->> 'classification' not in (
      'ideal',
      'acceptable',
      'needs_improvement',
      'unsafe'
    )
    or jsonb_typeof(v_selected_rule -> 'score_delta') <> 'number'
    or (v_selected_rule ->> 'score_delta') !~ '^-?[0-9]+$'
    or nullif(btrim(v_selected_rule ->> 'feedback'), '') is null
  then
    raise exception 'Regra de avaliação indisponível para esta opção.'
      using errcode = 'P0001';
  end if;

  return query
  select
    v_selected_rule ->> 'classification',
    (v_selected_rule ->> 'score_delta')::integer,
    v_selected_rule ->> 'feedback',
    nullif(btrim(v_selected_rule ->> 'consequence'), '');
end;
$$;

revoke all on function public.evaluate_case_step(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.evaluate_case_step(uuid, uuid, text)
to authenticated;

comment on function public.evaluate_case_step(uuid, uuid, text) is
  'P4: evaluates one visible decision option server-side without exposing private rules or truth models.';

-- Candidate authored for P4. It intentionally remains a draft until independent
-- clinical and pedagogical review is recorded in a later, authorized workflow.
insert into public.patients (
  id,
  display_name,
  age_years,
  sex_or_anatomy_context,
  pronouns,
  metadata
)
values (
  '40000000-0000-4000-8000-000000000001',
  'Luiza Ferreira',
  54,
  'Pessoa adulta em atendimento ambulatorial; personagem totalmente fictícia.',
  'ela/dela',
  '{
    "fictional": true,
    "clinical_content_validated": false,
    "publication_blocked_pending_review": true
  }'::jsonb
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
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001',
  'seguranca-ao-levantar-no-ambulatorio',
  'Segurança ao levantar no ambulatório',
  'nursing',
  'Durante o acolhimento ambulatorial, uma pessoa relata tontura ao tentar se levantar. Conduza ações iniciais de segurança e comunicação dentro do papel do técnico de enfermagem.',
  'Priorizar segurança, observação e comunicação oportuna com o enfermeiro, sem formular diagnóstico ou prescrição.',
  'draft',
  '{
    "authorship": "llm_candidate",
    "clinical_content_validated": false,
    "publication_blocked_pending_review": true,
    "review_status": "pending_independent_clinical_and_pedagogical_review",
    "dossier": "docs/cases/p4-nursing-case.md"
  }'::jsonb
);

insert into public.case_truth_models (
  case_id,
  truth_model,
  initial_state,
  version,
  reviewed_at
)
values (
  '40000000-0000-4000-8000-000000000002',
  '{
    "schema_version": 1,
    "candidate_only": true,
    "clinical_content_validated": false,
    "learner": {
      "course": "nursing",
      "simulated_role": "tecnico_de_enfermagem"
    },
    "setting": "acolhimento_ambulatorial",
    "true_condition": {
      "reported_symptom": "tontura_ao_tentar_levantar",
      "cause_established": false,
      "fall_occurred": false
    },
    "baseline_state": {
      "position": "seated",
      "conscious_and_communicating": true,
      "reports_improvement_while_seated": true
    },
    "hidden_information": {
      "diagnosis": "not_defined_for_this_scenario",
      "evaluation_rules_are_private": true
    },
    "learning_targets": [
      "prevent_fall_while_symptomatic",
      "observe_and_report_without_diagnosing",
      "work_under_nurse_supervision"
    ],
    "safety_boundaries": [
      "do_not_encourage_unsupported_ambulation",
      "do_not_label_a_diagnosis",
      "do_not_delay_communication_with_responsible_nurse"
    ],
    "expected_course": {
      "progression": "linear",
      "end_state": "responsible_nurse_assumes_evaluation_while_patient_remains_safe"
    },
    "simplifications": [
      "no_diagnosis_or_cause_is_defined",
      "no_vital_sign_threshold_drives_scoring",
      "no_physiological_deterioration_is_simulated",
      "responsible_nurse_is_immediately_available"
    ],
    "evidence": [
      {
        "id": "br-law-7498-1986-art-12-15",
        "authority": "Presidência da República",
        "title": "Lei nº 7.498, de 25 de junho de 1986",
        "year": 1986,
        "url": "https://www.planalto.gov.br/ccivil_03/leis/l7498.htm",
        "applies_to": ["technical_nursing_scope", "nurse_supervision"]
      },
      {
        "id": "br-decree-94406-1987-art-10-13",
        "authority": "Presidência da República",
        "title": "Decreto nº 94.406, de 8 de junho de 1987",
        "year": 1987,
        "url": "https://www.planalto.gov.br/ccivil_03/decreto/1980-1989/d94406.htm",
        "applies_to": ["technical_nursing_scope", "harm_prevention", "nurse_supervision"]
      },
      {
        "id": "ms-anvisa-fiocruz-fall-prevention-2013",
        "authority": "Ministério da Saúde, Anvisa e Fiocruz",
        "title": "Protocolo de Prevenção de Quedas",
        "year": 2013,
        "url": "http://bibliotecadigital.anvisa.gov.br/jspui/handle/anvisa/1777",
        "applies_to": ["fall_prevention", "safe_environment", "multiprofessional_care"]
      }
    ]
  }'::jsonb,
  '{
    "patient_position": "seated",
    "reported_symptom": "tontura_ao_tentar_levantar",
    "fall_occurred": false,
    "responsible_nurse_notified": false
  }'::jsonb,
  1,
  null
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
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000002',
    1,
    'arrival',
    'information',
    'Acolhimento',
    '{
      "phase": "initial_context",
      "body": "Luiza está sentada após relatar que sentiu tontura quando tentou se levantar para buscar água. Ela não caiu e diz que a tontura diminuiu ao se sentar novamente.",
      "observations": [
        "Ela está consciente e consegue conversar.",
        "O enfermeiro responsável está no posto próximo."
      ]
    }'::jsonb,
    '[]'::jsonb,
    '{"clinical_content_validated": false}'::jsonb
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000002',
    2,
    'initial-safety',
    'decision',
    'Sua primeira ação',
    '{"phase": "initial_response", "body": "O que você faz primeiro?"}'::jsonb,
    '[
      {
        "id": "keep-seated-observe-notify",
        "label": "Mantenho Luiza sentada e segura, permaneço por perto, observo o que ela relata e aciono o enfermeiro responsável."
      },
      {
        "id": "notify-while-safe",
        "label": "Aciono imediatamente o enfermeiro responsável, mantendo Luiza sentada e segura enquanto aguardo."
      },
      {
        "id": "test-walking",
        "label": "Peço que Luiza se levante novamente para verificar se a tontura persiste."
      }
    ]'::jsonb,
    '{"clinical_content_validated": false}'::jsonb
  ),
  (
    '40000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000002',
    3,
    'focused-observation',
    'information',
    'Informações disponíveis',
    '{
      "phase": "focused_observation",
      "body": "Enquanto Luiza permanece sentada, você pode reunir informações relevantes e comunicar a situação sem atribuir uma causa diagnóstica.",
      "observations": [
        "A queixa surgiu ao tentar se levantar.",
        "Não houve queda.",
        "Luiza continua referindo melhora enquanto está sentada."
      ]
    }'::jsonb,
    '[]'::jsonb,
    '{"clinical_content_validated": false}'::jsonb
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000002',
    4,
    'nurse-communication',
    'decision',
    'Comunicação com o enfermeiro',
    '{"phase": "communication", "body": "Como você comunica a situação ao enfermeiro responsável?"}'::jsonb,
    '[
      {
        "id": "objective-report",
        "label": "Relato objetivamente a tentativa de levantar, a tontura referida, a ausência de queda e a melhora sentada, mantendo-a segura e seguindo as orientações do enfermeiro."
      },
      {
        "id": "prompt-brief-report",
        "label": "Aviso prontamente que Luiza teve tontura ao tentar levantar e está sentada em segurança; complemento as informações solicitadas pelo enfermeiro."
      },
      {
        "id": "diagnose-and-delay",
        "label": "Informo que é uma queda de pressão e aguardo para ver se passa antes de pedir orientação."
      }
    ]'::jsonb,
    '{"clinical_content_validated": false}'::jsonb
  ),
  (
    '40000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000002',
    5,
    'handover',
    'information',
    'Continuidade do cuidado',
    '{
      "phase": "handover",
      "body": "O enfermeiro assume a avaliação e orienta a continuidade do atendimento. Luiza permanece acompanhada e em posição segura.",
      "observations": [
        "Você não precisou definir um diagnóstico.",
        "A segurança e a comunicação fizeram parte da resposta inicial."
      ]
    }'::jsonb,
    '[]'::jsonb,
    '{"clinical_content_validated": false}'::jsonb
  );

insert into public.case_step_rules (step_id, rules)
values
  (
    '40000000-0000-4000-8000-000000000004',
    '{
      "options": {
        "keep-seated-observe-notify": {
          "classification": "ideal",
          "score_delta": 2,
          "feedback": "Você priorizou a segurança, permaneceu disponível para observar e comunicou o enfermeiro responsável.",
          "consequence": "Luiza permanece sentada, acompanhada e sem nova exposição ao risco de queda.",
          "evidence_ids": ["ms-anvisa-fiocruz-fall-prevention-2013", "br-law-7498-1986-art-12-15"]
        },
        "notify-while-safe": {
          "classification": "acceptable",
          "score_delta": 1,
          "feedback": "Acionar prontamente o enfermeiro e manter a pessoa segura é adequado; uma observação objetiva inicial pode tornar a comunicação mais completa.",
          "consequence": "O enfermeiro é acionado enquanto Luiza permanece sentada e acompanhada.",
          "evidence_ids": ["ms-anvisa-fiocruz-fall-prevention-2013", "br-decree-94406-1987-art-10-13"]
        },
        "test-walking": {
          "classification": "unsafe",
          "score_delta": -1,
          "feedback": "Pedir nova tentativa de levantar expõe Luiza novamente ao risco. Primeiro mantenha-a em segurança e comunique o enfermeiro.",
          "consequence": "A tentativa é interrompida; Luiza volta a permanecer sentada e acompanhada.",
          "evidence_ids": ["ms-anvisa-fiocruz-fall-prevention-2013"]
        }
      }
    }'::jsonb
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '{
      "options": {
        "objective-report": {
          "classification": "ideal",
          "score_delta": 2,
          "feedback": "A comunicação foi objetiva, separou observações de interpretações e manteve o cuidado sob orientação do enfermeiro.",
          "consequence": "O enfermeiro recebe informações úteis para conduzir a avaliação e orientar a equipe.",
          "evidence_ids": ["br-law-7498-1986-art-12-15", "br-decree-94406-1987-art-10-13"]
        },
        "prompt-brief-report": {
          "classification": "acceptable",
          "score_delta": 1,
          "feedback": "A comunicação foi rápida e não atribuiu diagnóstico. Organizar os dados já disponíveis deixaria o relato inicial mais completo.",
          "consequence": "O enfermeiro é avisado e solicita as informações necessárias para continuar o atendimento.",
          "evidence_ids": ["br-law-7498-1986-art-12-15", "br-decree-94406-1987-art-10-13"]
        },
        "diagnose-and-delay": {
          "classification": "needs_improvement",
          "score_delta": 0,
          "feedback": "Evite definir uma causa diagnóstica e não adie a comunicação. Relate sinais, sintomas e contexto observados ao enfermeiro responsável.",
          "consequence": "A conclusão não confirmada é corrigida e o enfermeiro é comunicado sem nova espera.",
          "evidence_ids": ["br-law-7498-1986-art-12-15", "br-decree-94406-1987-art-10-13"]
        }
      }
    }'::jsonb
  );
