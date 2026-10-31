import type { DebriefReference } from '../debrief/types'
import type { AuthorOption, AuthorStep, CaseDraft } from './types'

export const extendedDemoPack = 'osler-two-complete-cases-v1'

function information(key: string, title: string, body: string, observations: string[]): AuthorStep {
  return { key, title, body, observations, type: 'information', presentationState: 'stable', options: [] }
}

function decision(key: string, title: string, body: string, observations: string[], options: AuthorOption[]): AuthorStep {
  return { key, title, body, observations, options, type: 'decision', presentationState: 'warning' }
}

function option(id: string, label: string, classification: AuthorOption['classification'], feedback: string, consequence: string): AuthorOption {
  return {
    id, label, classification, feedback, consequence,
    scoreDelta: { ideal: 2, acceptable: 1, needs_improvement: 0, unsafe: -1 }[classification],
    presentationState: classification === 'ideal' ? 'recovery' : classification === 'unsafe' ? 'critical' : 'warning',
    nextStepKey: 'next',
  }
}

const nursingReferences: DebriefReference[] = [
  {
    id: 'ms-medication-safety-2013', authority: 'Ministério da Saúde / Anvisa',
    title: 'Protocolo de segurança na prescrição, uso e administração de medicamentos', year: 2013,
    url: 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/publicacoes/protocolo-de-seguranca-na-prescricao-uso-e-administracao-de-medicamentos', verifiedOn: '2026-10-30',
  },
  {
    id: 'ms-patient-identification-2013', authority: 'Ministério da Saúde / Anvisa',
    title: 'Protocolo de identificação do paciente', year: 2013,
    url: 'https://www.gov.br/saude/pt-br/composicao/saes/seguranca-do-paciente/publicacoes/protocolos-de-seguranca-do-paciente/protocolo-de-identificacao-do-paciente/view', verifiedOn: '2026-10-30',
  },
]

const laboratoryReferences: DebriefReference[] = [
  {
    id: 'eflm-hemolysis-2018', authority: 'EFLM Working Group for Preanalytical Phase',
    title: 'Practical recommendations for managing hemolyzed samples in clinical chemistry testing', year: 2018,
    url: 'https://pubmed.ncbi.nlm.nih.gov/29373316/', verifiedOn: '2026-10-30',
  },
  {
    id: 'aacb-rcpa-hemolysis-2016', authority: 'AACB / RCPA',
    title: 'Consensus Statement for the Management and Reporting of Haemolysed Specimens', year: 2016,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5242477/', verifiedOn: '2026-10-30',
  },
]

function referenceText(references: DebriefReference[]): string {
  return 'Roteiro fictício de demonstração. Revisão clínica e pedagógica independente pendente.\n' + references.map(reference => `${reference.authority}. ${reference.title} (${reference.year}). ${reference.url}`).join('\n')
}

export function medicationSafetyCase(): CaseDraft {
  return {
    title: 'Medicação segura: identificação e alergias', course: 'nursing',
    description: 'Marina está prestes a receber uma medicação e relata uma reação anterior. Em sete etapas, acompanhe a identificação, a pausa de segurança e a comunicação com a equipe.',
    objective: 'Praticar cinco decisões sobre identificação, relato de alergia, comunicação, conferência da prescrição e registro, mantendo a atuação do estudante sob supervisão.',
    patientName: 'Marina Duarte', patientAge: 54, pronouns: 'ela/dela',
    reference: referenceText(nursingReferences), reviewed: false,
    steps: [
      information('contexto', 'Antes da primeira dose',
        'São 8h10 em uma unidade de internação fictícia. Você acompanha a enfermeira preceptora na conferência de uma medicação prescrita para Marina. O preparo ainda não começou. Marina está conversando e não refere sintomas atuais.',
        ['Atuação do estudante: observar, conferir informações e comunicar dúvidas à preceptora.', 'A pulseira, a prescrição vigente e o prontuário estão disponíveis.', 'O caso não envolve escolha de medicamento, dose ou via por conta própria.']),
      decision('identificacao', 'Quem vai receber o cuidado?',
        'Há duas pessoas com o primeiro nome Marina no corredor. Sua preceptora pede que você demonstre como conferir a pessoa a quem a prescrição se destina.',
        ['Os leitos mudaram durante a passagem de plantão.', 'A pulseira contém nome completo e data de nascimento.'], [
          option('dois-identificadores', 'Peço nome completo e data de nascimento e comparo com a pulseira e a prescrição.', 'ideal',
            'Dois identificadores concordantes vinculam a pessoa ao documento conferido; a localização do leito, sozinha, não cumpre essa função.', 'A equipe confirma a correspondência antes de continuar.'),
          option('apoio-identificacao', 'Peço ajuda à enfermeira e mantenho o processo pausado até completar a identificação.', 'acceptable',
            'Pedir apoio evita seguir com uma dúvida. Participe também da conferência dos identificadores com a preceptora.', 'A enfermeira conduz a identificação com você.'),
          option('usar-leito', 'Uso o número do leito e sigo, porque a medicação já estava separada para esse quarto.', 'unsafe',
            'Uma mudança de leito pode associar o preparo à pessoa errada. A conferência precisa alcançar a identidade.', 'A preceptora intercepta a tentativa e refaz a identificação antes de qualquer preparo.'),
        ]),
      decision('relato-alergia', 'Uma informação muda o caminho',
        'Depois da identificação conferida com a preceptora, Marina comenta: “Esse nome me lembra um remédio que me deu falta de ar, mas não sei dizer qual era.” O campo de alergias está sem informação. Não há manifestação atual de reação.',
        ['Nenhuma medicação foi administrada neste atendimento.', 'O relato ainda precisa ser esclarecido pela equipe responsável.'], [
          option('pausar-comunicar', 'Mantenho o preparo suspenso, escuto o relato e aviso a enfermeira sobre a possível reação anterior.', 'ideal',
            'A dúvida sobre uma reação prévia deve chegar à equipe antes da administração; ausência de registro não equivale a ausência de alergia.', 'O processo fica suspenso enquanto a enfermeira esclarece o histórico com a equipe.'),
          option('chamar-sem-relato', 'Chamo a enfermeira e aguardo, sem explorar melhor o que Marina lembra.', 'acceptable',
            'A pausa e o pedido de ajuda são adequados. As informações que a pessoa consegue relatar também ajudam a esclarecer a situação.', 'A preceptora assume a conversa e a conferência do histórico.'),
          option('seguir-sem-registro', 'Desconsidero o relato porque o prontuário não lista alergias e proponho continuar.', 'unsafe',
            'A falta de anotação não invalida uma informação nova trazida pela pessoa. Prosseguir sem esclarecer a dúvida cria um risco evitável.', 'A enfermeira interrompe a proposta; o medicamento permanece sem administração.'),
        ]),
      decision('comunicacao', 'Passar a informação sem inventar uma conclusão',
        'A enfermeira mantém o processo suspenso e pede que você organize o relato para a equipe responsável pela revisão da prescrição. Você tem a identidade conferida, a fala de Marina e a informação de que nada foi administrado.',
        ['Alergia não foi confirmada nem descartada.', 'Marina continua sem sintomas atuais.'], [
          option('relato-objetivo', 'Relato a identidade conferida, a fala de Marina, a lacuna no prontuário e a suspensão antes da administração.', 'ideal',
            'O relato separa fatos conhecidos, dúvida pendente e ação já tomada, permitindo que a equipe avalie a situação.', 'A equipe recebe um resumo preciso e assume a revisão.'),
          option('relato-vago', 'Digo apenas que Marina “talvez tenha alergia”, sem contar o que ela relatou ou o que já foi feito.', 'needs_improvement',
            'Uma mensagem vaga exige novas perguntas. Inclua o relato concreto e a situação do processo.', 'A enfermeira solicita os dados que faltaram antes de encaminhar a informação.'),
          option('diagnostico-sem-confirmacao', 'Anuncio uma alergia confirmada e uma reação atual, embora esses dados não estejam estabelecidos.', 'unsafe',
            'Registrar ou comunicar conclusões não verificadas pode desorientar a equipe. Uma suspeita e uma reação atual não são a mesma informação.', 'A preceptora corrige o relato antes de a equipe decidir a conduta.'),
        ]),
      decision('nova-prescricao', 'Uma nova prescrição pede nova conferência',
        'Após avaliação, a equipe responsável documenta o relato e define outra prescrição. A enfermeira explica a nova conduta a Marina e pede que você acompanhe a conferência antes de qualquer administração.',
        ['A prescrição anterior não deve orientar o novo preparo.', 'A administração permanece sob responsabilidade do profissional habilitado.'], [
          option('reconferir', 'Acompanho a conferência da prescrição vigente, da identidade e do histórico atualizado e esclareço dúvidas com a preceptora.', 'ideal',
            'A mudança de conduta exige retomar a verificação com os documentos atuais, sem reaproveitar automaticamente a conferência anterior.', 'A enfermeira valida o processo atualizado antes de prosseguir.'),
          option('pedir-acompanhamento', 'Peço que a enfermeira demonstre novamente a conferência porque ainda tenho dúvidas.', 'acceptable',
            'Explicitar uma dúvida permite supervisão antes da ação. Use o momento para acompanhar cada verificação.', 'A preceptora revisa o processo com você.'),
          option('reaproveitar-preparo', 'Sugiro aproveitar a medicação que estava separada, para não atrasar a rotina.', 'unsafe',
            'Um preparo vinculado à conduta anterior não substitui a conferência da prescrição que passou a valer.', 'A proposta é interrompida; a enfermeira mantém a nova conferência.'),
        ]),
      decision('registro', 'O que fica para o próximo profissional?',
        'A preceptora pede que você prepare, para revisão dela, o registro do que observou. Marina também pergunta por que a equipe fez uma pausa.',
        ['O registro deve distinguir relato da paciente, ação observada e avaliação da equipe.', 'A pausa ocorreu antes de qualquer administração da medicação inicialmente conferida.'], [
          option('registrar-fatos', 'Registro os fatos e horários observados para revisão da preceptora e explico a Marina que a pausa permitiu esclarecer uma informação importante.', 'ideal',
            'Um registro factual preserva a continuidade e uma explicação compreensível inclui a pessoa no cuidado.', 'A enfermeira revisa o registro e completa a orientação à paciente.'),
          option('pedir-revisao-registro', 'Peço ajuda à enfermeira para registrar a ocorrência e conversar com Marina, antes de finalizar qualquer anotação.', 'acceptable',
            'A supervisão protege a qualidade do registro. Retome com a preceptora quais fatos precisam permanecer documentados.', 'O registro e a orientação são concluídos com acompanhamento.'),
          option('ocultar-pausa', 'Omito a pausa e o relato de Marina para que a anotação pareça uma rotina sem intercorrências.', 'unsafe',
            'Omitir informações relevantes prejudica a continuidade. O registro deve representar o que ocorreu.', 'A preceptora solicita a correção da anotação antes de validá-la.'),
        ]),
      information('fechamento', 'A segurança foi construída em equipe',
        'A revisão supervisionada preservou a identificação, o relato de Marina e a rastreabilidade da conduta. A avaliação clínica e a prescrição ficaram com os profissionais responsáveis. Agora, reveja as cinco decisões que você tomou e os feedbacks que recebeu.',
        ['Qual informação exigiu pausar o processo?', 'Em que momento um relato virou uma conclusão não confirmada?', 'A pontuação resume escolhas desta tentativa, sem definir competência profissional.']),
    ],
  }
}

export function hemolysisCase(): CaseDraft {
  return {
    title: 'Amostra hemolisada: qualidade antes do resultado', course: 'clinical_analysis',
    description: 'Um alerta de hemólise coloca a liberação de potássio em revisão. Em sete etapas, pratique a avaliação da amostra, a comunicação e a rastreabilidade de uma nova coleta.',
    objective: 'Praticar cinco decisões sobre qualidade pré-analítica, aplicação de critérios do método, comunicação de impedimentos, rastreabilidade e validação supervisionada.',
    patientName: 'Rafael Mendes', patientAge: 45, pronouns: 'ele/dele',
    reference: referenceText(laboratoryReferences), reviewed: false,
    steps: [
      information('recebimento', 'Um alerta antes da liberação',
        'Você acompanha a analista responsável em um laboratório fictício. Uma amostra de soro vinculada a Rafael tem alerta instrumental de hemólise. Há solicitação de potássio e a equipe assistencial aguarda o resultado. Nenhum laudo foi liberado.',
        ['A identificação e a qualidade da amostra precisam ser conferidas.', 'O procedimento operacional e os critérios validados para o método estão disponíveis.', 'O estudante atua com supervisão; não autoriza laudos por conta própria.']),
      decision('conferencia', 'Entender o material recebido',
        'O tubo está na bancada de revisão. Qual é seu primeiro passo ao avaliar o alerta com a analista?',
        ['O resultado numérico isolado não resolve a avaliação da qualidade.', 'Ainda não foi identificada a origem da hemólise.'], [
          option('revisar-rastreabilidade', 'Confiro identificadores, registros de coleta e transporte, condições da amostra e alerta do equipamento com a analista.', 'ideal',
            'Reunir identificação e dados do processo dá contexto à avaliação. Um alerta não estabelece, sozinho, sua causa.', 'A revisão confirma o vínculo da amostra à solicitação e reúne os dados disponíveis.'),
          option('encaminhar-revisao', 'Mantenho a amostra em revisão e peço ajuda à analista, sem completar todas as conferências.', 'acceptable',
            'Encaminhar a dúvida evita uma liberação apressada. Acompanhe também a verificação dos registros.', 'A analista conduz as conferências com você.'),
          option('ignorar-alerta', 'Ignoro o alerta porque o pedido é urgente e proponho liberar o número exibido.', 'unsafe',
            'A urgência não demonstra que um resultado com interferência seja confiável.', 'A analista intercepta a proposta e mantém o resultado em revisão.'),
        ]),
      decision('criterio-metodo', 'O critério pertence ao método',
        'A identificação foi conferida. No procedimento fictício fornecido para este ensaio, o índice de hemólise medido ultrapassa o limite validado para potássio e a interferência é clinicamente relevante. O procedimento determina não liberar esse resultado e comunicar a ocorrência.',
        ['Não há um valor de corte universal fornecido neste cenário.', 'Outros exames, se existirem, exigem avaliação própria.'], [
          option('aplicar-pop', 'Mantenho o potássio bloqueado conforme o procedimento, registro o motivo e encaminho a ocorrência à analista.', 'ideal',
            'A decisão usa o critério declarado para este método e registra o impedimento, sem generalizar a regra a todos os exames.', 'O resultado afetado não é liberado e a ocorrência fica documentada.'),
          option('solicitar-confirmacao', 'Peço à analista que confirme a aplicação do procedimento antes de qualquer liberação.', 'acceptable',
            'Confirmar uma interpretação com o responsável preserva a supervisão. Identifique também o critério que motivou a dúvida.', 'A analista revisa o critério e mantém a retenção do resultado afetado.'),
          option('corrigir-numero', 'Proponho alterar matematicamente o valor para compensar a hemólise e remover o alerta.', 'unsafe',
            'Uma correção improvisada não transforma a medição comprometida em um resultado validado.', 'A proposta é recusada; nenhum valor ajustado é reportado.'),
        ]),
      decision('comunicacao-urgencia', 'A equipe precisa de uma resposta',
        'A equipe assistencial telefona perguntando pelo potássio. A analista pede que você organize a mensagem, que ela acompanhará. O resultado afetado continua sem liberação.',
        ['A necessidade assistencial deve chegar ao profissional responsável.', 'A interferência laboratorial não permite concluir o estado clínico de Rafael.'], [
          option('comunicar-impedimento', 'Explico o impedimento, confirmo a urgência com a equipe e encaminho à analista a definição de nova amostra ou alternativa validada.', 'ideal',
            'A mensagem informa a limitação e abre um plano supervisionado de continuidade, em vez de apresentar um dado comprometido como confiável.', 'A equipe e a analista combinam o encaminhamento e sua prioridade.'),
          option('mensagem-incompleta', 'Digo apenas que o exame está atrasado, sem explicar o impedimento ou encaminhar a urgência.', 'needs_improvement',
            'Uma previsão vaga não ajuda a decidir o próximo passo. Informe o motivo e envolva o responsável.', 'A analista complementa a comunicação e verifica a necessidade da equipe.'),
          option('interpretar-paciente', 'Afirmo que Rafael está bem porque a alteração deve ser apenas da amostra.', 'unsafe',
            'A avaliação da amostra não substitui a avaliação clínica, e a interferência não permite assegurar um resultado normal.', 'A analista corrige a mensagem e esclarece o limite da informação disponível.'),
        ]),
      decision('nova-amostra', 'Uma nova coleta, o mesmo vínculo',
        'A analista e a equipe definem uma nova coleta conforme o procedimento local. Você acompanha a abertura da ocorrência e a organização da solicitação, sem executar o procedimento de coleta sozinho.',
        ['A amostra anterior permanece rastreável conforme a rotina do laboratório.', 'Os novos registros precisam estar vinculados à pessoa e à solicitação corretas.'], [
          option('rastrear-recoleta', 'Registro a não conformidade e o encaminhamento, confiro os identificadores e acompanho o vínculo da nova coleta à solicitação.', 'ideal',
            'A nova coleta precisa manter o vínculo com o atendimento e o motivo da repetição, sem apagar a primeira ocorrência.', 'A solicitação e os registros ficam disponíveis às equipes envolvidas.'),
          option('pedir-apoio-recoleta', 'Peço que a analista acompanhe comigo a organização da solicitação e do registro da nova coleta.', 'acceptable',
            'Buscar supervisão permite esclarecer como documentar e vincular cada etapa.', 'A organização da nova coleta é concluída com acompanhamento.'),
          option('reaproveitar-rotulo', 'Sugiro reutilizar a etiqueta e o registro da amostra anterior, sem documentar uma nova coleta.', 'unsafe',
            'Substituir o material sem registrar a mudança rompe a rastreabilidade do que foi efetivamente analisado.', 'A equipe impede a substituição sem registro e mantém as ocorrências separadas.'),
        ]),
      decision('validacao', 'Conferir novamente antes de seguir',
        'Uma nova amostra chega com identificação concordante. A analista confirma que os critérios de qualidade da amostra, os controles e as verificações do método foram atendidos. Ela pede que você explique o próximo encaminhamento.',
        ['A primeira medição continua identificada como não liberada.', 'A autorização do laudo cabe ao profissional habilitado.'], [
          option('validacao-supervisionada', 'Acompanho a revisão do novo resultado e dos registros e encaminho a autorização à analista responsável.', 'ideal',
            'A nova amostra exige seu próprio processo de verificação. O laudo segue o resultado validado e preserva o histórico.', 'A profissional responsável conclui a análise e a comunicação conforme a rotina.'),
          option('revisao-final', 'Peço à analista uma revisão final das verificações antes de encerrar o acompanhamento.', 'acceptable',
            'Reconhecer a necessidade de revisão é compatível com o papel do estudante. Identifique os pontos que ainda geram dúvida.', 'A analista retoma as verificações com você antes da autorização.'),
          option('copiar-primeiro-resultado', 'Sugiro copiar o primeiro valor para o novo registro para acelerar a liberação.', 'unsafe',
            'Copiar uma medição de outra amostra compromete a integridade do laudo e não representa a análise atual.', 'A proposta é interceptada; a autorização permanece vinculada à medição validada.'),
        ]),
      information('fechamento', 'Qualidade também é comunicar o limite',
        'O percurso acompanhou o alerta, a revisão pelo método, a comunicação com a equipe e a nova coleta rastreável. Nenhuma conclusão sobre o diagnóstico de Rafael foi feita a partir da hemólise. No debriefing, observe como suas cinco decisões preservaram ou ameaçaram esse processo.',
        ['Qual diferença existe entre avaliar a amostra e interpretar o estado da pessoa?', 'Como a urgência foi encaminhada sem liberar um dado comprometido?', 'Quais registros permitem reconstruir a trajetória das duas amostras?']),
    ],
  }
}

export const extendedDemoCaseDefinitions = [
  { caseId: '7c701001-2026-4000-8000-000000000001', assignmentId: '7c701002-2026-4000-8000-000000000001', assignmentTitle: '02 · Medicação segura', createDraft: medicationSafetyCase, references: nursingReferences },
  { caseId: '7c701003-2026-4000-8000-000000000001', assignmentId: '7c701004-2026-4000-8000-000000000001', assignmentTitle: '02 · Qualidade da amostra', createDraft: hemolysisCase, references: laboratoryReferences },
] as const
