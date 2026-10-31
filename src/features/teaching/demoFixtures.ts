import type { CaseDraft, PortalIdentity } from './types'

export const demoTeacher: PortalIdentity = {
  userId: '10000000-1111-4000-8000-000000000001',
  email: 'professora@osler.demo',
  displayName: 'Prof.ª Helena Costa',
  role: 'teacher',
}
export const demoStudents: PortalIdentity[] = [
  ['Ana Martins', 'ana@osler.demo'],
  ['Lucas Oliveira', 'lucas@osler.demo'],
  ['Beatriz Souza', 'beatriz@osler.demo'],
  ['Rafael Lima', 'rafael@osler.demo'],
  ['Clara Alves', 'clara@osler.demo'],
  ['João Santos', 'joao@osler.demo'],
].map(([displayName, email], i) => ({
  userId: `10000000-2222-4000-8000-00000000000${i + 1}`,
  email,
  displayName,
  role: 'student',
}))

export function demoNursingCase(): CaseDraft {
  return {
    title: 'Segurança e comunicação no acolhimento',
    course: 'nursing',
    description:
      'Luiza refere tontura ao tentar se levantar. Acompanhe o acolhimento e pratique a comunicação com a equipe.',
    objective:
      'Reconhecer uma situação de risco e comunicar observações de forma objetiva, dentro do papel do estudante.',
    patientName: 'Luiza Ferreira',
    patientAge: 67,
    pronouns: 'ela/dela',
    reference:
      'Conteúdo fictício para testar o software. Requer revisão clínica independente antes do uso educacional.',
    reviewed: false,
    steps: [
      {
        key: 'acolhimento',
        type: 'information',
        title: 'Um primeiro encontro',
        body: 'No ambulatório, Luiza relata tontura ao tentar se levantar. Ela está sentada e acompanhada.',
        observations: [
          'Não houve queda.',
          'Há um enfermeiro responsável disponível.',
        ],
        presentationState: 'stable',
        options: [],
      },
      {
        key: 'seguranca',
        type: 'decision',
        title: 'A primeira conduta',
        body: 'Como você responde à situação?',
        observations: [],
        presentationState: 'warning',
        options: [
          {
            id: 'acompanhar',
            label:
              'Mantenho Luiza sentada e acompanhada e comunico o enfermeiro responsável.',
            classification: 'ideal',
            scoreDelta: 2,
            feedback:
              'A escolha prioriza segurança e comunicação com o profissional responsável.',
            consequence:
              'Luiza permanece acompanhada enquanto aguarda avaliação.',
            presentationState: 'recovery',
            nextStepKey: 'next',
          },
          {
            id: 'avisar',
            label: 'Aciono o enfermeiro e aguardo ao lado de Luiza.',
            classification: 'acceptable',
            scoreDelta: 1,
            feedback:
              'A comunicação é oportuna. Reúna também as observações disponíveis para o relato.',
            consequence: 'O enfermeiro é acionado.',
            presentationState: 'stable',
            nextStepKey: 'next',
          },
          {
            id: 'levantar',
            label:
              'Peço que tente se levantar de novo para observar a tontura.',
            classification: 'unsafe',
            scoreDelta: -1,
            feedback:
              'Uma nova tentativa de levantar pode repetir a exposição ao risco. Preserve a segurança e comunique a equipe.',
            consequence:
              'A tentativa é interrompida e o enfermeiro assume a avaliação.',
            presentationState: 'critical',
            nextStepKey: 'next',
          },
        ],
      },
      {
        key: 'comunicacao',
        type: 'decision',
        title: 'Passagem de informações',
        body: 'O que você relata ao enfermeiro?',
        observations: [],
        presentationState: 'stable',
        options: [
          {
            id: 'objetivo',
            label:
              'Relato a tentativa de levantar, a tontura referida, a ausência de queda e a posição atual.',
            classification: 'ideal',
            scoreDelta: 2,
            feedback:
              'O relato distingue observações de interpretações e ajuda a continuidade do cuidado.',
            consequence: 'A equipe recebe as informações disponíveis.',
            presentationState: 'recovery',
            nextStepKey: 'next',
          },
          {
            id: 'interpretar',
            label: 'Afirmo uma causa para a tontura antes da avaliação.',
            classification: 'needs_improvement',
            scoreDelta: 0,
            feedback:
              'Relate dados observados sem atribuir uma causa não confirmada.',
            consequence: 'A interpretação é revista com o enfermeiro.',
            presentationState: 'warning',
            nextStepKey: 'next',
          },
        ],
      },
      {
        key: 'continuidade',
        type: 'information',
        title: 'Continuidade do cuidado',
        body: 'O enfermeiro assume a avaliação. Reflita sobre a segurança e a comunicação na trajetória que você escolheu.',
        observations: [],
        presentationState: 'recovery',
        options: [],
      },
    ],
  }
}

export function demoLabCase(): CaseDraft {
  const draft = demoNursingCase()
  return {
    ...draft,
    title: 'Identificação e rastreabilidade da amostra',
    course: 'clinical_analysis',
    patientName: 'Alex Silva',
    patientAge: 35,
    pronouns: 'ele/dele',
    description:
      'Uma amostra chega ao laboratório com identificação divergente da solicitação. Pratique a rastreabilidade.',
    objective:
      'Reconhecer uma divergência de identificação e comunicar a ocorrência conforme o protocolo do laboratório.',
    steps: [
      {
        key: 'recepcao',
        type: 'information',
        title: 'Recepção da amostra',
        body: 'Os identificadores no tubo não correspondem aos da solicitação. A amostra ainda não foi processada.',
        observations: ['Existe um protocolo local para não conformidades.'],
        presentationState: 'warning',
        options: [],
      },
      {
        key: 'identificacao',
        type: 'decision',
        title: 'Próximo passo',
        body: 'Como você conduz a divergência?',
        observations: [],
        presentationState: 'warning',
        options: [
          {
            id: 'registrar',
            label:
              'Interrompo o fluxo e comunico a divergência ao responsável, seguindo o protocolo local.',
            classification: 'ideal',
            scoreDelta: 2,
            feedback:
              'A rastreabilidade é preservada ao reconhecer e comunicar a divergência.',
            consequence: 'A ocorrência é encaminhada ao responsável.',
            presentationState: 'recovery',
            nextStepKey: 'next',
          },
          {
            id: 'trocar',
            label: 'Troco a etiqueta por conta própria e sigo o processamento.',
            classification: 'unsafe',
            scoreDelta: -1,
            feedback:
              'Não altere a identificação sem o procedimento autorizado. Comunique a divergência.',
            consequence: 'O fluxo precisa ser revisto.',
            presentationState: 'critical',
            nextStepKey: 'next',
          },
        ],
      },
    ],
  }
}
