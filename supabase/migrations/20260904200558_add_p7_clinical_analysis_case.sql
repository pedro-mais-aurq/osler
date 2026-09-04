-- P7 authors a candidate clinical analysis case. It remains a draft until an
-- independent clinical and pedagogical review is recorded by a later migration.
insert into public.patients (
  id,
  display_name,
  age_years,
  sex_or_anatomy_context,
  pronouns,
  metadata
)
values (
  '70000000-0000-4000-8000-000000000001',
  'Marina Alves',
  36,
  'Pessoa adulta vinculada a uma solicitação ambulatorial simulada.',
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
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000001',
  'rastreabilidade-de-amostra-hemograma',
  'Rastreabilidade de amostra para hemograma',
  'clinical_analysis',
  'Acompanhe uma solicitação fictícia de hemograma, da recepção da amostra ao encaminhamento do resultado técnico.',
  'Reconhecer uma divergência de identificação, preservar a rastreabilidade e atuar dentro do papel supervisionado do técnico em análises clínicas.',
  'draft',
  '{
    "authorship": "llm_candidate",
    "clinical_content_validated": false,
    "publication_blocked_pending_review": true,
    "review_status": "pending_independent_clinical_and_pedagogical_review",
    "dossier": "docs/cases/p7-clinical-analysis-case.md"
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
  '70000000-0000-4000-8000-000000000002',
  '{
    "schema_version": 1,
    "candidate_only": true,
    "clinical_content_validated": false,
    "learner": {
      "course": "clinical_analysis",
      "simulated_role": "tecnico_em_analises_clinicas",
      "supervision_required": true
    },
    "objective": "recognize_identification_nonconformity_and_preserve_traceability",
    "request": {
      "exam": "hemograma_automatizado",
      "patient_name": "Marina Alves",
      "educational_identifier": "P7-CA-036",
      "origin": "atendimento_ambulatorial_simulado",
      "requested_material": "sangue_total_com_edta"
    },
    "sample_truth": {
      "initial_sample": {
        "material": "sangue_total",
        "container": "tubo_com_edta",
        "label_patient_name": "Marina Alvez",
        "label_educational_identifier": "P7-CA-063",
        "identification_matches_request": false
      },
      "replacement_sample": {
        "material": "sangue_total",
        "container": "tubo_com_edta",
        "label_patient_name": "Marina Alves",
        "label_educational_identifier": "P7-CA-036",
        "identification_matches_request": true
      }
    },
    "preanalytical_state": {
      "initial_sample_acceptable_under_simulated_service_procedure": false,
      "reason": "patient_name_and_educational_identifier_do_not_match_request",
      "expected_process": [
        "stop_processing",
        "segregate_sample",
        "record_nonconformity",
        "communicate_collection_point",
        "request_new_collection"
      ]
    },
    "analysis_state": {
      "replacement_sample_prepared": true,
      "automated_processing_simulated": true,
      "analytical_quality_condition": "adequate_for_this_simulated_round",
      "numeric_results_modelled": false,
      "critical_result_modelled": false
    },
    "release_authority": {
      "learner_may_prepare_technical_record": true,
      "learner_may_release_report_autonomously": false,
      "required_next_actor": "profissional_legalmente_habilitado",
      "required_action": "review_validate_and_release_under_service_workflow"
    },
    "simplifications": [
      "no_numeric_analyte_result",
      "no_diagnostic_interpretation",
      "no_critical_result",
      "no_real_analyzer_interface",
      "quality_condition_is_stated_without_control_charts",
      "institutional_rejection_procedure_is_simulated_and_requires_human_review"
    ],
    "evidence": [
      {
        "id": "anvisa-rdc-978-2025-consolidated",
        "authority": "Agência Nacional de Vigilância Sanitária",
        "title": "RDC nº 978, de 6 de junho de 2025, texto consolidado com alterações da RDC nº 986/2025",
        "url": "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&link=S&tipo=RDC&numeroAto=00000978&seqAto=000&valorAno=2025&orgao=RDC/DC/ANVISA/MS&cod_modulo=134&cod_menu=1696",
        "verified_on": "2026-09-04",
        "applies_to": [
          "traceability",
          "sample_identification",
          "service_acceptance_and_rejection_criteria",
          "quality_management",
          "report_release_by_legally_qualified_professional"
        ]
      },
      {
        "id": "ms-iec-manual-2023-hemograma",
        "authority": "Ministério da Saúde - Instituto Evandro Chagas",
        "title": "Manual de Orientações para Coleta, Acondicionamento e Transporte de Amostras Biológicas",
        "year": 2023,
        "url": "https://www.gov.br/iec/pt-br/assuntos/recebimento-de-materiais-biologicos/manual-de-orientacoes-iec-2023.pdf/@@download/file",
        "verified_on": "2026-09-04",
        "applies_to": ["hemogram_material", "edta_container", "sample_identification"]
      },
      {
        "id": "cfbio-resolution-735-2025",
        "authority": "Conselho Federal de Biologia",
        "title": "Resolução nº 735, de 5 de setembro de 2025",
        "url": "https://cfbio.gov.br/2025/09/05/resolucao-no-735-de-5-de-setembro-de-2025/",
        "verified_on": "2026-09-04",
        "applies_to": ["conservative_technical_role", "supervision", "no_autonomous_report_release"]
      }
    ]
  }'::jsonb,
  '{
    "request_received": true,
    "initial_sample_received": true,
    "initial_sample_identification_matches_request": false,
    "replacement_sample_received": false,
    "technical_result_generated": false,
    "released": false
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
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    1,
    'request-received',
    'information',
    'Solicitação recebida',
    '{
      "body": "Uma solicitação de hemograma originada de um atendimento ambulatorial simulado chegou à recepção técnica.",
      "observations": [
        "Os dados apresentados são fictícios e existem apenas para esta simulação educacional."
      ],
      "laboratory": {
        "stage": "request",
        "title": "Solicitação do atendimento",
        "fields": [
          {"label": "Paciente", "value": "Marina Alves"},
          {"label": "Identificador educacional", "value": "P7-CA-036"},
          {"label": "Exame", "value": "Hemograma automatizado"},
          {"label": "Origem", "value": "Atendimento ambulatorial simulado"},
          {"label": "Material solicitado", "value": "Sangue total"},
          {"label": "Recipiente solicitado", "value": "Tubo com EDTA"}
        ],
        "notes": [
          "Nenhum resultado está disponível nesta etapa."
        ]
      }
    }'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "stable"}'::jsonb
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    2,
    'sample-received',
    'information',
    'Amostra recebida',
    '{
      "body": "A amostra chegou ao setor técnico. Antes de qualquer processamento, compare a solicitação com a etiqueta do tubo.",
      "observations": [
        "A cor da tampa não é usada como informação nesta simulação.",
        "Material e recipiente estão descritos em texto."
      ],
      "laboratory": {
        "stage": "sample",
        "title": "Conferência de recebimento",
        "fields": [
          {"label": "Nome na solicitação", "value": "Marina Alves"},
          {"label": "Nome na etiqueta", "value": "Marina Alvez"},
          {"label": "ID na solicitação", "value": "P7-CA-036"},
          {"label": "ID na etiqueta", "value": "P7-CA-063"},
          {"label": "Material", "value": "Sangue total"},
          {"label": "Recipiente", "value": "Tubo com EDTA"},
          {"label": "Coleta registrada", "value": "09:12"},
          {"label": "Envio", "value": "Equipe de coleta simulada"}
        ],
        "notes": [
          "Existem divergências visíveis entre a solicitação e a etiqueta."
        ]
      }
    }'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "warning"}'::jsonb
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    '70000000-0000-4000-8000-000000000002',
    3,
    'preanalytical-decision',
    'decision',
    'Defina a conduta pré-analítica',
    '{
      "body": "A solicitação identifica Marina Alves (P7-CA-036), mas a etiqueta identifica Marina Alvez (P7-CA-063). O que você faz antes do processamento?",
      "observations": [
        "Considere o procedimento simulado do serviço: divergências de identificação impedem a aceitação e exigem correção rastreável."
      ],
      "laboratory": {
        "stage": "preanalytical",
        "title": "Divergência de identificação",
        "fields": [
          {"label": "Solicitação", "value": "Marina Alves — P7-CA-036"},
          {"label": "Etiqueta", "value": "Marina Alvez — P7-CA-063"},
          {"label": "Situação", "value": "Conferência pré-analítica pendente"},
          {"label": "Processamento", "value": "Ainda não iniciado"}
        ],
        "notes": [
          "A decisão deve preservar a identidade e a rastreabilidade da amostra."
        ]
      }
    }'::jsonb,
    '[
      {
        "id": "block-and-recollect",
        "label": "Interromper o processamento, registrar a não conformidade e solicitar nova coleta conforme o procedimento simulado."
      },
      {
        "id": "segregate-and-escalate",
        "label": "Segregar a amostra e pedir orientação à supervisão antes de qualquer processamento."
      },
      {
        "id": "accept-with-note",
        "label": "Aceitar a amostra e acrescentar uma observação sobre a divergência."
      },
      {
        "id": "relabel-from-request",
        "label": "Substituir a etiqueta usando apenas os dados da solicitação e prosseguir."
      }
    ]'::jsonb,
    '{"presentation_state": "warning"}'::jsonb
  ),
  (
    '71000000-0000-4000-8000-000000000004',
    '70000000-0000-4000-8000-000000000002',
    4,
    'traceability-correction',
    'information',
    'Fluxo de correção acionado',
    '{
      "body": "A amostra inicial permanece segregada e fora do processamento. A supervisão aplica o procedimento simulado de não conformidade e solicita nova coleta.",
      "observations": [
        "A divergência não é corrigida por reetiquetagem baseada em suposição.",
        "Nenhum resultado foi gerado com a amostra inicial."
      ],
      "laboratory": {
        "stage": "preanalytical",
        "title": "Correção de rastreabilidade",
        "fields": [
          {"label": "Amostra inicial", "value": "Segregada"},
          {"label": "Processamento", "value": "Bloqueado"},
          {"label": "Não conformidade", "value": "Registrada no fluxo simulado"},
          {"label": "Próxima ação", "value": "Nova coleta solicitada"}
        ]
      }
    }'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "warning"}'::jsonb
  ),
  (
    '71000000-0000-4000-8000-000000000005',
    '70000000-0000-4000-8000-000000000002',
    5,
    'replacement-sample-received',
    'information',
    'Nova amostra conferida',
    '{
      "body": "Uma nova amostra foi coletada e recebida. Os identificadores agora correspondem à solicitação fictícia.",
      "observations": [
        "A conferência se limita aos dados visíveis desta etapa."
      ],
      "laboratory": {
        "stage": "sample",
        "title": "Amostra corrigida",
        "fields": [
          {"label": "Nome na solicitação", "value": "Marina Alves"},
          {"label": "Nome na etiqueta", "value": "Marina Alves"},
          {"label": "ID na solicitação", "value": "P7-CA-036"},
          {"label": "ID na etiqueta", "value": "P7-CA-036"},
          {"label": "Material", "value": "Sangue total"},
          {"label": "Recipiente", "value": "Tubo com EDTA"}
        ],
        "notes": [
          "Identificação compatível com a solicitação nesta simulação."
        ]
      }
    }'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "recovery"}'::jsonb
  ),
  (
    '71000000-0000-4000-8000-000000000006',
    '70000000-0000-4000-8000-000000000002',
    6,
    'analysis-simplified',
    'information',
    'Processamento analítico simplificado',
    '{
      "body": "A amostra corrigida foi preparada e submetida a uma rodada analítica automatizada simulada, dentro do fluxo supervisionado.",
      "observations": [
        "A condição de qualidade analítica foi considerada adequada para esta rodada simulada.",
        "Não há interface de equipamento real, calibração ou gráfico de controle nesta etapa."
      ],
      "laboratory": {
        "stage": "analysis",
        "title": "Rodada analítica simulada",
        "fields": [
          {"label": "Exame", "value": "Hemograma automatizado"},
          {"label": "Material", "value": "Sangue total com EDTA"},
          {"label": "Preparação", "value": "Concluída no fluxo simulado"},
          {"label": "Qualidade analítica", "value": "Condição adequada para esta rodada simulada"}
        ],
        "notes": [
          "Nenhuma marca, modelo ou interface de analisador é reproduzida."
        ]
      }
    }'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "stable"}'::jsonb
  ),
  (
    '71000000-0000-4000-8000-000000000007',
    '70000000-0000-4000-8000-000000000002',
    7,
    'technical-result-generated',
    'information',
    'Resultado técnico gerado',
    '{
      "body": "O processamento simulado terminou. Um resultado técnico foi gerado, mas ainda não passou pela revisão e liberação previstas no fluxo do serviço.",
      "observations": [
        "Valores numéricos e interpretação diagnóstica não fazem parte do objetivo deste caso.",
        "Nenhum resultado crítico é simulado."
      ],
      "laboratory": {
        "stage": "result",
        "title": "Registro técnico",
        "fields": [
          {"label": "Status técnico", "value": "Resultado gerado"},
          {"label": "Valores quantitativos", "value": "Não modelados"},
          {"label": "Resultado crítico", "value": "Não modelado"},
          {"label": "Situação", "value": "Aguardando revisão e liberação"}
        ],
        "notes": [
          "Resultado técnico não equivale a laudo liberado."
        ]
      }
    }'::jsonb,
    '[]'::jsonb,
    '{"presentation_state": "stable"}'::jsonb
  ),
  (
    '71000000-0000-4000-8000-000000000008',
    '70000000-0000-4000-8000-000000000002',
    8,
    'release-handoff-decision',
    'decision',
    'Encaminhe o resultado técnico',
    '{
      "body": "Como técnico em análises clínicas nesta simulação, qual é o próximo passo profissional antes que o resultado possa ser disponibilizado?",
      "observations": [
        "Considere os limites do papel simulado e o fluxo de supervisão."
      ],
      "laboratory": {
        "stage": "result",
        "title": "Resultado aguardando encaminhamento",
        "fields": [
          {"label": "Registro", "value": "Resultado técnico gerado"},
          {"label": "Revisão", "value": "Pendente"},
          {"label": "Liberação", "value": "Pendente"},
          {"label": "Disponibilidade ao setor solicitante", "value": "Bloqueada"}
        ]
      }
    }'::jsonb,
    '[
      {
        "id": "forward-qualified-professional",
        "label": "Conferir o registro técnico e encaminhá-lo ao profissional legalmente habilitado para revisão, validação e liberação conforme o serviço."
      },
      {
        "id": "hold-for-supervision",
        "label": "Manter o resultado bloqueado e solicitar orientação da supervisão antes de qualquer disponibilização."
      },
      {
        "id": "disclose-directly",
        "label": "Disponibilizar o resultado técnico diretamente ao setor solicitante sem a revisão prevista."
      }
    ]'::jsonb,
    '{"presentation_state": "stable"}'::jsonb
  );

insert into public.case_step_rules (step_id, rules)
values
  (
    '71000000-0000-4000-8000-000000000003',
    '{
      "schema_version": 1,
      "options": {
        "block-and-recollect": {
          "classification": "ideal",
          "score_delta": 2,
          "feedback": "A conduta preserva a identidade e impede que uma amostra com dados divergentes entre no processamento.",
          "consequence": "A não conformidade é registrada e uma nova coleta é solicitada pelo fluxo simulado.",
          "presentation_state": "recovery",
          "transition": {"type": "step", "step_key": "replacement-sample-received"}
        },
        "segregate-and-escalate": {
          "classification": "acceptable",
          "score_delta": 1,
          "feedback": "Segregar a amostra evita o processamento enquanto a supervisão confirma o procedimento aplicável.",
          "consequence": "A supervisão mantém o bloqueio, registra a não conformidade e solicita nova coleta.",
          "transition": {"type": "step", "step_key": "traceability-correction"}
        },
        "accept-with-note": {
          "classification": "needs_improvement",
          "score_delta": -1,
          "feedback": "Acrescentar uma nota não restabelece a correspondência entre a amostra e a solicitação.",
          "consequence": "O processamento é interrompido e o procedimento simulado de correção é acionado.",
          "transition": {"type": "step", "step_key": "traceability-correction"}
        },
        "relabel-from-request": {
          "classification": "unsafe",
          "score_delta": -2,
          "feedback": "Reetiquetar com base apenas na solicitação cria uma associação não verificada e compromete a rastreabilidade.",
          "consequence": "O fluxo é bloqueado; a amostra permanece segregada e uma nova coleta é solicitada.",
          "presentation_state": "warning",
          "transition": {"type": "step", "step_key": "traceability-correction"}
        }
      }
    }'::jsonb
  ),
  (
    '71000000-0000-4000-8000-000000000008',
    '{
      "schema_version": 1,
      "options": {
        "forward-qualified-professional": {
          "classification": "ideal",
          "score_delta": 2,
          "feedback": "Você distingue o resultado técnico do laudo liberado e realiza o encaminhamento rastreável ao profissional legalmente habilitado.",
          "consequence": "O profissional habilitado assume a revisão, a validação e a liberação conforme o fluxo do serviço.",
          "presentation_state": "recovery",
          "transition": {"type": "complete"}
        },
        "hold-for-supervision": {
          "classification": "acceptable",
          "score_delta": 1,
          "feedback": "Manter o resultado bloqueado protege o fluxo enquanto a supervisão orienta o encaminhamento adequado.",
          "consequence": "O resultado permanece indisponível até seguir para o profissional legalmente habilitado.",
          "transition": {"type": "complete"}
        },
        "disclose-directly": {
          "classification": "unsafe",
          "score_delta": -2,
          "feedback": "O resultado técnico não deve ser disponibilizado diretamente pelo estudante sem a revisão e a liberação previstas.",
          "consequence": "A disponibilização é interrompida; o resultado continua bloqueado e é encaminhado ao profissional legalmente habilitado.",
          "presentation_state": "warning",
          "transition": {"type": "complete"}
        }
      }
    }'::jsonb
  );
