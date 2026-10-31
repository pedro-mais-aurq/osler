# Dois novos casos completos

Os roteiros abaixo foram acrescentados à demonstração integrada, sem substituir os dois cenários anteriores. Cada novo caso possui sete etapas, cinco decisões com três alternativas, feedback e consequência para cada escolha, persistência da tentativa e debriefing de aluno e professor.

## Enfermagem — Medicação segura: identificação e alergias

Paciente fictícia: Marina Duarte, 54 anos. O estudante acompanha uma enfermeira preceptora na conferência de uma medicação. Um relato de reação anterior exige uma pausa, esclarecimento pela equipe e continuidade documentada.

| Etapa | Tipo | Foco |
| --- | --- | --- |
| Antes da primeira dose | Informação | Contexto, documentos e papel do estudante |
| Quem vai receber o cuidado? | Decisão | Conferência da identidade |
| Uma informação muda o caminho | Decisão | Relato de reação anterior e comunicação |
| Passar a informação sem inventar uma conclusão | Decisão | Separação entre fatos, suspeitas e ações |
| Uma nova prescrição pede nova conferência | Decisão | Verificação supervisionada da conduta atual |
| O que fica para o próximo profissional? | Decisão | Registro e explicação à paciente |
| A segurança foi construída em equipe | Informação | Fechamento e perguntas para reflexão |

## Análises Clínicas — Amostra hemolisada: qualidade antes do resultado

Paciente fictício: Rafael Mendes, 45 anos. A amostra tem alerta de hemólise e um resultado de potássio ainda não liberado. O roteiro fornece um procedimento fictício com um impedimento já estabelecido para aquele ensaio; não estabelece pontos de corte universais.

| Etapa | Tipo | Foco |
| --- | --- | --- |
| Um alerta antes da liberação | Informação | Contexto laboratorial e supervisão |
| Entender o material recebido | Decisão | Identificação e registros disponíveis |
| O critério pertence ao método | Decisão | Aplicação do procedimento apresentado |
| A equipe precisa de uma resposta | Decisão | Comunicação do impedimento e da urgência |
| Uma nova coleta, o mesmo vínculo | Decisão | Registro e rastreabilidade |
| Conferir novamente antes de seguir | Decisão | Verificação e autorização supervisionadas |
| Qualidade também é comunicar o limite | Informação | Fechamento e perguntas para reflexão |

## Utilização

Após escolher a formação, o aluno pode selecionar um dos casos disponíveis. As mesmas atividades aparecem em **Meu espaço → Minhas atividades**. Os novos cenários são acrescentados uma única vez ao armazenamento local já existente: sessões, matrículas, casos anteriores e devolutivas permanecem preservados. Arquivar um novo caso ou encerrar sua atividade não é desfeito ao reabrir a aplicação.

Em **Professor → Casos clínicos → Roteiros para adaptar**, as duas opções abrem uma cópia no editor em qualquer modo da aplicação, inclusive no ambiente conectado. O professor pode salvar o rascunho, adaptar o conteúdo e passar pelo processo de revisão já existente antes de publicar e disponibilizar para uma turma. O campo `reviewed` permanece `false`; não é uma declaração de validação clínica independente. Nenhuma migration adicional é necessária e o banco online não é alterado pelo deploy.

Cada decisão atribui +2 à alternativa ideal, +1 à aceitável, 0 à que precisa melhorar e −1 à insegura. O máximo de cada novo cenário é 10 pontos brutos. A equipe supervisora intercepta as propostas inadequadas descritas nas consequências, mantendo a coerência da etapa seguinte. A pontuação descreve somente a tentativa.

## Referências consultadas

Os roteiros, personagens e procedimentos do cenário são uma criação educacional original. As referências abaixo fundamentam os temas de segurança e qualidade e aparecem como links no debriefing. Consulta em 30/10/2026.

- Ministério da Saúde / Anvisa. [Protocolo de segurança na prescrição, uso e administração de medicamentos](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/publicacoes/protocolo-de-seguranca-na-prescricao-uso-e-administracao-de-medicamentos), 2013.
- Ministério da Saúde / Anvisa. [Protocolo de identificação do paciente](https://www.gov.br/saude/pt-br/composicao/saes/seguranca-do-paciente/publicacoes/protocolos-de-seguranca-do-paciente/protocolo-de-identificacao-do-paciente/view), 2013.
- Lippi G. e colaboradores / EFLM WG-PRE. [Practical recommendations for managing hemolyzed samples in clinical chemistry testing](https://pubmed.ncbi.nlm.nih.gov/29373316/), 2018. DOI: 10.1515/cclm-2017-1104.
- Badrick T. e colaboradores / AACB e RCPA. [Consensus Statement for the Management and Reporting of Haemolysed Specimens](https://pmc.ncbi.nlm.nih.gov/articles/PMC5242477/), 2016.
