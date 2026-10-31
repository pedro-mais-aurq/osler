# OSLER P4 — dossiê do caso candidato de Enfermagem

## Estado editorial

**CASO PRONTO PARA REVISÃO, NÃO PUBLICADO.**

- Autoria inicial: candidato produzido por LLM para a validação técnica da P4.
- Identificador: `40000000-0000-4000-8000-000000000002`.
- Slug: `seguranca-ao-levantar-no-ambulatorio`.
- Versão do modelo de verdade: 1.
- Estado no banco: `clinical_cases.status = 'draft'`.
- Validação clínica: `clinical_content_validated = false`.
- Revisão independente: pendente; `case_truth_models.reviewed_at = null`.
- Público-alvo proposto: estudante de curso técnico de Enfermagem.
- Papel simulado: Técnico em Enfermagem, sob orientação e supervisão de Enfermeiro.
- Escopo: resposta inicial segura a relato de tontura ao tentar levantar em ambiente ambulatorial.
- Fora do escopo: diagnóstico, prescrição, definição de conduta clínica, deterioração fisiológica simulada e substituição de protocolo institucional.

Este arquivo documenta a fundamentação do candidato. Ele não representa revisão humana nem autoriza publicação.

## Objetivos educacionais propostos

Objetivo primário: priorizar a segurança da pessoa, observar e relatar dados objetivos e comunicar o enfermeiro responsável em tempo oportuno, sem formular diagnóstico ou prescrição.

Objetivos secundários:

- distinguir observação de interpretação diagnóstica;
- reconhecer uma nova tentativa de deambulação sem apoio como exposição evitável a risco;
- manter a continuidade do cuidado sob orientação do enfermeiro.

## Personagem e situação

Luiza Ferreira, 54 anos, é uma personagem totalmente fictícia. O cenário de prática é um acolhimento ambulatorial. Ela relata tontura ao tentar se levantar para buscar água. Não houve queda, e a queixa diminui ao sentar novamente. O enfermeiro responsável está no posto próximo.

## Estado clínico modelado e informação progressiva

- Condição verdadeira para fins do cenário: há um sintoma relatado ao tentar levantar; a causa não é definida e nenhuma hipótese diagnóstica deve ser presumida.
- Estado inicial: Luiza está sentada, consciente, comunicando-se e relata melhora nessa posição; não ocorreu queda.
- Informação inicialmente disponível: tentativa de levantar, relato de tontura, ausência de queda, melhora sentada e proximidade do enfermeiro.
- Informação oculta: as regras de classificação/pontuação e seus fundamentos. Não existe diagnóstico oculto utilizado para julgar o estudante.
- Fases: contexto inicial, resposta inicial, observação focal, comunicação e transferência da condução ao enfermeiro.

## Modelo de verdade privado

O modelo privado registra apenas os limites pedagógicos necessários para avaliar as escolhas:

- prevenir nova exposição a risco de queda enquanto a pessoa refere tontura ao levantar;
- manter a pessoa sentada, segura e acompanhada durante a resposta inicial;
- observar e comunicar sinais, sintomas e contexto sem rotular diagnóstico;
- atuar sob orientação e supervisão do enfermeiro;
- não adiar a comunicação com o enfermeiro responsável.

O cliente não recebe esse modelo, os identificadores de evidência ou o conjunto bruto de regras.

## Sequência visível proposta

1. Informação: apresentação do acolhimento e do relato de tontura.
2. Decisão: primeira ação de segurança.
3. Informação: dados objetivos disponíveis para observação.
4. Decisão: comunicação com o enfermeiro.
5. Informação: continuidade do cuidado sob condução do enfermeiro.

## Matriz privada de avaliação

| Etapa | Opção resumida | Classificação | Pontos | Fundamento |
|---|---|---:|---:|---|
| Primeira ação | Manter sentada/segura, observar e avisar o enfermeiro | `ideal` | +2 | Segurança, observação e supervisão |
| Primeira ação | Avisar prontamente e manter sentada/segura | `acceptable` | +1 | Resposta segura, com relato inicial menos completo |
| Primeira ação | Pedir nova tentativa de levantar | `unsafe` | -1 | Nova exposição evitável ao risco de queda |
| Comunicação | Relato objetivo e continuidade sob orientação | `ideal` | +2 | Dados observáveis, sem diagnóstico, sob supervisão |
| Comunicação | Aviso breve imediato, completado quando solicitado | `acceptable` | +1 | Comunicação oportuna, porém menos estruturada |
| Comunicação | Atribuir “queda de pressão” e aguardar | `needs_improvement` | 0 | Hipótese tratada como diagnóstico e comunicação adiada |

As alternativas `acceptable` recebem crédito parcial por permanecerem defensáveis, embora sejam menos completas. Os erros críticos modelados são pedir uma nova tentativa de levantar sem apoio e adiar a comunicação com base em uma causa não confirmada. Nenhum caminho fabrica piora fisiológica.

## Consequências, mecanismo e simplificações

- Mecanismo das escolhas seguras: reduzir nova exposição durante o sintoma, manter acompanhamento e entregar dados objetivos ao enfermeiro.
- Mecanismo das escolhas não ideais: a ação é interrompida ou corrigida, a comunicação acontece sem nova espera e a pontuação diferencia a qualidade da resposta.
- Latência: as consequências são imediatas e processuais; não há progressão fisiológica simulada.
- Simplificações deliberadas: não há diagnóstico definido, limiares de sinais vitais, medicação, prescrição, queda consumada ou deterioração; o enfermeiro está imediatamente disponível.

## Referências oficiais consultadas

1. Brasil. **Lei nº 7.498, de 25 de junho de 1986**, especialmente arts. 12 e 15. Define atividades do Técnico de Enfermagem, exclui as privativas do Enfermeiro e exige orientação e supervisão de Enfermeiro. Presidência da República: <https://www.planalto.gov.br/ccivil_03/leis/l7498.htm>.
2. Brasil. **Decreto nº 94.406, de 8 de junho de 1987**, especialmente arts. 10 e 13. Regulamenta a atuação do Técnico de Enfermagem e determina supervisão, orientação e direção de Enfermeiro. Presidência da República: <https://www.planalto.gov.br/ccivil_03/decreto/1980-1989/d94406.htm>.
3. Ministério da Saúde; Anvisa; Fiocruz. **Protocolo de Prevenção de Quedas** (2013). Estabelece como finalidade reduzir quedas e danos por avaliação de risco, cuidado multiprofissional e ambiente seguro. Biblioteca Digital da Anvisa: <http://bibliotecadigital.anvisa.gov.br/jspui/handle/anvisa/1777>.

## Questões obrigatórias para a revisão independente

- O cenário e cada alternativa respeitam o nível de formação pretendido e protocolos locais?
- A comunicação proposta reflete a prática pedagógica adotada pela instituição?
- Há ambiguidade clínica que possa tornar mais de uma classificação defensável?
- Os feedbacks evitam inferir diagnóstico e mantêm linguagem não punitiva?
- O caso precisa de informações adicionais para não induzir conduta inadequada?
- A pontuação é proporcional ao objetivo educacional e não premia mera memorização?

Somente após uma revisão clínica e pedagógica independente, registrada no fluxo autorizado, o conteúdo poderá receber `clinical_content_validated = true`, `reviewed_at` e ser considerado para publicação.
