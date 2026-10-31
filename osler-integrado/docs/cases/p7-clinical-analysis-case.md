# Caso P7 — Rastreabilidade de amostra para hemograma

## Controle do caso

- **Identificador:** `p7-rastreabilidade-hemograma-v1`
- **Slug:** `rastreabilidade-de-amostra-hemograma`
- **Versão:** 1
- **Curso:** Análises Clínicas (`clinical_analysis`)
- **Público:** estudante de curso técnico em Análises Clínicas
- **Papel simulado:** técnico em Análises Clínicas, sob supervisão
- **Status de publicação:** `draft`
- **Conteúdo clínico validado:** `false`
- **Status de revisão:** `pending_independent_clinical_and_pedagogical_review`
- **Revisado em:** não revisado (`reviewed_at = null`)

Este documento é um dossiê de autoria candidata. Pesquisa documental e teste técnico não equivalem a revisão clínica, regulatória ou pedagógica independente.

## Objetivo educacional

Reconhecer uma divergência de identificação entre solicitação e amostra, preservar a rastreabilidade, aplicar o procedimento simulado de não conformidade e encaminhar o resultado técnico ao profissional legalmente habilitado, sem liberação autônoma pelo estudante.

## Cenário e integração assistencial

A paciente fictícia Marina Alves, 36 anos, está vinculada a uma solicitação de hemograma originada de um atendimento ambulatorial simulado. A integração com a área assistencial é representada por dados de origem, identificação, coleta e comunicação de nova coleta. Não há multiplayer, prontuário real, hospital real, CPF, CNS, CNES real ou comunicação em tempo real.

## Exame

- **Exame:** hemograma automatizado.
- **Finalidade neste caso:** contextualizar uma decisão de identificação e rastreabilidade; não ensinar interpretação hematológica.
- **Material:** sangue total.
- **Recipiente/aditivo:** tubo com EDTA, sempre descrito em texto; a cor da tampa não é usada como informação.
- **Valores numéricos:** não modelados.
- **Intervalo de referência ou limite de decisão:** não modelados.
- **Resultado crítico:** não modelado.

O Manual de Orientações do Instituto Evandro Chagas descreve sangue total com anticoagulante EDTA para hemograma e orienta identificação do tubo. O caso não reproduz volume, prazo, temperatura ou método daquele serviço porque esses elementos não influenciam a decisão educacional escolhida.

## Solicitação

Dados visíveis na etapa inicial:

- paciente: Marina Alves;
- identificador educacional: P7-CA-036;
- exame: hemograma automatizado;
- origem: atendimento ambulatorial simulado;
- material solicitado: sangue total;
- recipiente solicitado: tubo com EDTA.

Não há resultado nem estado oculto da amostra no payload desta etapa.

## Amostra inicial e identificação

A amostra inicial apresenta divergências deliberadamente visíveis:

| Campo | Solicitação | Etiqueta da amostra |
|---|---|---|
| Nome | Marina Alves | Marina Alvez |
| Identificador educacional | P7-CA-036 | P7-CA-063 |

O nome e o identificador são fictícios. A RDC Anvisa nº 978/2025, no texto consolidado com a RDC nº 986/2025, exige identificação do material biológico no momento da coleta ou do recebimento, elementos mínimos de identificação e rastreabilidade da data e hora de coleta. A mesma resolução determina que o serviço defina critérios de aceitação, rejeição e identificação.

## Preparo, coleta, transporte e integridade

- **Preparo da paciente:** não modelado; não interfere na decisão.
- **Coleta:** representada apenas por horário fictício e equipe de coleta simulada.
- **Transporte:** não modelado; nenhuma conclusão sobre temperatura, tempo ou embalagem é pontuada.
- **Integridade física:** não há hemólise, lipemia, icterícia, coágulo, volume inadequado ou outra condição visual simulada.
- **Biossegurança:** está fora da interação desta versão e não é usada para pontuação.

## Critério de aceitação e rejeição

### Base normativa

A RDC nº 978/2025 exige rastreabilidade e que o serviço documente seus critérios de aceitação, rejeição e identificação. Ela não é tratada aqui como uma regra federal literal de “toda divergência exige recoleta”.

### Procedimento candidato do serviço simulado

Para este caso educacional, o procedimento interno simulado estabelece que a divergência simultânea de nome e identificador entre solicitação e etiqueta:

1. impede a aceitação para processamento;
2. exige segregação da amostra inicial;
3. exige registro da não conformidade;
4. aciona comunicação com o ponto de coleta;
5. leva a uma nova coleta identificada de modo compatível.

Este procedimento é uma escolha conservadora de design baseada na obrigação de rastreabilidade e permanece **pendente de revisão humana independente**. Uma instituição real deve aplicar seu próprio procedimento documentado, validado e vigente.

## Decisões e alternativas aceitáveis

### Decisão 1 — verificação pré-analítica

- **Ideal:** interromper o processamento, registrar a não conformidade e solicitar nova coleta conforme o procedimento simulado.
- **Aceitável:** segregar a amostra e consultar a supervisão antes de qualquer processamento. Protege a amostra, embora postergue a ação prevista no procedimento apresentado.
- **Precisa melhorar:** aceitar a amostra e apenas registrar uma observação. A nota não restabelece a identidade.
- **Insegura:** substituir a etiqueta com base somente na solicitação. Cria associação não verificada.

O caminho ideal salta a nota explicativa de correção e segue à amostra corrigida. Os demais caminhos passam pela correção e convergem no mesmo fluxo seguro. Nenhum caminho inventa dano à paciente, erro analítico ou falha de equipamento.

### Decisão 2 — validação e liberação

- **Ideal:** conferir o registro técnico e encaminhá-lo ao profissional legalmente habilitado para revisão, validação e liberação conforme o serviço.
- **Aceitável:** manter o resultado bloqueado e solicitar orientação da supervisão.
- **Insegura:** disponibilizar diretamente o resultado sem a revisão prevista.

O perfil formativo do curso técnico prevê processos pré-analíticos e analíticos sob supervisão de profissional responsável de nível superior. A RDC nº 978/2025 exige revisão e liberação de laudos por profissional legalmente habilitado. Como limite conservador, o estudante não assina, não libera e não divulga diretamente o resultado.

## Nova amostra

A nova amostra contém o mesmo nome e identificador educacional da solicitação. A simulação declara apenas a compatibilidade dos dados visíveis; não infere outras condições pré-analíticas não apresentadas.

## Análise simplificada e qualidade

A amostra corrigida é preparada e submetida a uma rodada automatizada simulada dentro do fluxo supervisionado. A interface informa: “Condição de qualidade analítica adequada para esta rodada simulada”.

Não são simulados:

- equipamento ou fabricante real;
- interface de analisador;
- calibração;
- Levey-Jennings;
- regras de Westgard;
- controles comerciais;
- manutenção;
- reagentes;
- resultados quantitativos.

A simplificação reconhece que a gestão da qualidade precede a liberação, sem transformar o MVP em equipamento ou LIS.

## Resultado, validação, liberação e comunicação

O resultado apresentado é exclusivamente um **resultado técnico gerado**, sem valores e sem interpretação diagnóstica. O status visível permanece “aguardando revisão e liberação”. A conclusão segura é o encaminhamento rastreável ao profissional legalmente habilitado.

A necessidade de nova coleta é comunicada narrativamente ao ponto de coleta simulado. Não há resultado crítico, portanto não é necessário modelar comunicação de valor crítico ou confirmação de recebimento nesta versão.

## Fluxo de oito etapas

1. `information` — solicitação recebida;
2. `information` — amostra recebida;
3. `decision` — conduta pré-analítica;
4. `information` — correção de rastreabilidade, somente para caminhos não ideais;
5. `information` — nova amostra conferida;
6. `information` — processamento analítico simplificado;
7. `information` — resultado técnico gerado;
8. `decision` — encaminhamento para revisão/liberação e conclusão.

## Consequências modeladas

As consequências se limitam a rastreabilidade comprometida, bloqueio de processamento, registro de não conformidade, atraso e nova coleta. Não há deterioração clínica, resultado falso, quebra de equipamento ou diagnóstico inventado.

## Simplificações declaradas

- apenas um exame de rotina;
- sem números, unidades ou intervalo de referência;
- sem interpretação diagnóstica;
- sem resultado crítico;
- sem equipamento real;
- sem LIS, HL7, FHIR, middleware ou PDF de laudo;
- sem simulação completa de transporte e biossegurança;
- condição de qualidade analítica declarada sem gráficos;
- procedimento institucional de rejeição candidato e não validado;
- resultado encerrado no encaminhamento, não na liberação pelo estudante.

## Fontes e verificação de vigência

### Norma sanitária

1. **Agência Nacional de Vigilância Sanitária. RDC nº 978, de 6 de junho de 2025 — texto consolidado com alterações da RDC nº 986/2025.** Consultada em 04/09/2026 no AnvisaLegis. Aplicação: definições, rastreabilidade, identificação, critérios de aceitação/rejeição, registro do exame, gestão da qualidade e revisão/liberação por profissional legalmente habilitado.  
   <https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&link=S&tipo=RDC&numeroAto=00000978&seqAto=000&valorAno=2025&orgao=RDC/DC/ANVISA/MS&cod_modulo=134&cod_menu=1696>

2. **Anvisa. Agenda Regulatória 2026–2027 — tema 6.4.** Consultada em 04/09/2026. A página oficial identifica a RDC nº 978/2025 e sua alteração pela RDC nº 986/2025.  
   <https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/agenda-regulatoria/agenda-2026-2027/temas/servicos-de-saude/6-4-requisitos-tecnico-sanitarios-para-servicos-que-executam-as-atividades-relacionadas-aos-exames-de-analises-clinicas-eac>

**Conclusão da verificação normativa:** a RDC nº 978/2025 foi localizada em fonte oficial e estava apresentada em texto consolidado com a alteração pertinente na data da consulta. A pesquisa não constitui parecer jurídico nem certifica conformidade regulatória do OSLER ou de um laboratório real.

### Material, recipiente e identificação

3. **Ministério da Saúde — Instituto Evandro Chagas. Manual de Orientações para Coleta, Acondicionamento e Transporte de Amostras Biológicas, 2023.** Consultado em 04/09/2026. A seção de hemograma descreve sangue total com EDTA e identificação da amostra.  
   <https://www.gov.br/iec/pt-br/assuntos/recebimento-de-materiais-biologicos/manual-de-orientacoes-iec-2023.pdf/@@download/file>

### Papel profissional

4. **Catálogo Nacional de Cursos Técnicos, 4ª edição — Técnico em Análises Clínicas.** Cópia disponibilizada em portal oficial da Secretaria de Estado da Saúde de São Paulo; consultada em 04/09/2026. Aplicação: processos pré-analíticos e analíticos sob supervisão do responsável de nível superior.  
   <https://www.saude.sp.gov.br/resources/crh/gsdrh/supervisao-esc/catalogocursostecnicosatualizadoemnovde2024.pdf>

5. **Conselho Federal de Biologia. Resolução nº 735, de 5 de setembro de 2025.** Consultada em 04/09/2026. Aplicação conservadora quando a supervisão estiver no sistema CFBio: identificação, acondicionamento, transporte e preparação de amostras; veda análise/execução de exames e assinatura de laudos pelo técnico nesse enquadramento.  
   <https://cfbio.gov.br/2025/09/05/resolucao-no-735-de-5-de-setembro-de-2025/>

O escopo profissional pode depender da formação, do conselho competente e do serviço. Por isso o caso evita atribuir habilitação autônoma e exige supervisão e encaminhamento ao profissional legalmente habilitado.

## Pendências para revisão humana

- confirmar a adequação pedagógica das quatro alternativas pré-analíticas;
- validar o procedimento simulado de rejeição/recoleta;
- revisar o enquadramento profissional aplicável ao público real do curso;
- confirmar a redação sobre preparação, processamento automatizado e encaminhamento;
- revisar linguagem, acessibilidade e ausência de pistas indevidas;
- autorizar ou recusar publicação em migration separada e auditável.

Até que essas pendências sejam encerradas por revisores humanos autorizados, o caso deve permanecer `draft`, com `clinical_content_validated = false` e `reviewed_at = null`.
