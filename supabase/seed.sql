insert into public.patients (
  id,
  display_name,
  metadata
)
values (
  '00000000-0000-4000-8000-000000000001',
  'Paciente fictício de demonstração',
  '{"fixture": true, "purpose": "schema-validation", "real_person": false}'::jsonb
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  metadata = excluded.metadata;

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
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'fixture-validacao-schema',
  'Caso estrutural de desenvolvimento',
  'nursing',
  'Fixture técnica sem conteúdo clínico, criada exclusivamente para validar relações do schema.',
  'Validar a estrutura de dados do MVP sem representar conhecimento científico.',
  'draft',
  '{"fixture": true, "clinical_content_validated": false}'::jsonb
)
on conflict (id) do update
set
  patient_id = excluded.patient_id,
  slug = excluded.slug,
  title = excluded.title,
  course = excluded.course,
  description = excluded.description,
  educational_objective = excluded.educational_objective,
  status = excluded.status,
  metadata = excluded.metadata;

insert into public.case_truth_models (
  case_id,
  truth_model,
  initial_state
)
values (
  '00000000-0000-4000-8000-000000000002',
  '{"fixture": true, "purpose": "schema-validation", "clinical_content_validated": false}'::jsonb,
  '{"fixture": true}'::jsonb
)
on conflict (case_id) do update
set
  truth_model = excluded.truth_model,
  initial_state = excluded.initial_state;

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
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000002',
    1,
    'fixture-introduction',
    'information',
    'Etapa técnica de introdução',
    '{"fixture": true, "message": "Placeholder sem informação clínica."}'::jsonb,
    '[]'::jsonb,
    '{"fixture": true}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000002',
    2,
    'fixture-choice',
    'decision',
    'Etapa técnica de decisão',
    '{"fixture": true, "message": "Escolha usada apenas para validar options e actions."}'::jsonb,
    '[{"id": "option-a", "label": "Opção técnica A"}, {"id": "option-b", "label": "Opção técnica B"}]'::jsonb,
    '{"fixture": true}'::jsonb
  )
on conflict (id) do update
set
  case_id = excluded.case_id,
  position = excluded.position,
  step_key = excluded.step_key,
  step_type = excluded.step_type,
  title = excluded.title,
  content = excluded.content,
  options = excluded.options,
  metadata = excluded.metadata;

insert into public.case_step_rules (
  step_id,
  rules
)
values (
  '00000000-0000-4000-8000-000000000004',
  '{"fixture": true, "evaluation_enabled": false}'::jsonb
)
on conflict (step_id) do update
set rules = excluded.rules;
