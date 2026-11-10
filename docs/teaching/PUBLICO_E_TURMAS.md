# Participação e visibilidade dos casos

Depois do acesso de aluno e da escolha de formação, o painel `/participacao` oferece **Entrar em uma turma** e **Praticar sem turma**. A escolha pode ser refeita sem apagar matrículas ou tentativas. No modo conectado, ambos os caminhos usam a identidade Google confirmada.

## Turmas

O professor encontra o código em **Turmas → detalhe da turma**. O aluno o informa no painel de participação; o vínculo usa a própria identidade confirmada, e o curso passa a ser o da turma. Repetir o código não duplica a matrícula. Turmas arquivadas e matrículas revogadas não aceitam entrada por código. O cadastro docente por e-mail continua disponível e não envia mensagens.

## Visibilidade no editor

| Estado e visibilidade | Prática sem turma | Atividade da turma |
| --- | --- | --- |
| Rascunho privado ou público | Indisponível | Indisponível |
| Publicado privado (padrão) | Indisponível | Só para aluno com vínculo ativo, na atividade aberta |
| Publicado público | Qualquer aluno autenticado, sem matrícula | Exige o mesmo vínculo ativo e atividade aberta |
| Arquivado | Sem novas tentativas ou retomadas | Sem novas tentativas ou retomadas |

A visibilidade é escolhida antes da publicação. Uma versão publicada fica preservada; para alterar conteúdo ou visibilidade, o professor duplica o caso, que começa como privado. Casos docentes existentes sem o campo continuam privados. Publicados legados sem autor são preservados como públicos pela migration.

## Tentativas e histórico

O catálogo `/casos-publicos` filtra a formação selecionada e mostra apenas metadados dos casos publicados e públicos. O caminho `/simulacao?case=ID&modo=publico` cria uma sessão sem atividade. O aluno pode concluir, refazer e reabrir seu debriefing. Cada aluno vê apenas seu próprio histórico individual.

Uma atividade usa `/simulacao?case=ID&atividade=ID`, com tentativas próprias e acompanhamento do professor responsável. Praticar publicamente um caso já usado em uma turma cria um contexto separado: a tentativa individual não aparece no painel nem aceita devolutiva docente. Arquivar o caso ou revogar o acesso não apaga debriefings concluídos; uma tentativa ativa bloqueada ainda pode ser abandonada pelo titular.

## Demonstração e implantação

Na demonstração local, cada curso tem quatro casos públicos, incluindo três roteiros de 12 etapas e nove decisões. Um e-mail fictício novo permite testar o caminho sem turma. As contas de aluno já existentes mantêm seus vínculos. Os roteiros aparecem em **Professor → Casos clínicos → Roteiros para adaptar** e passam por revisão docente antes da publicação no ambiente conectado.

A migration `20261030231749_public_cases_and_optional_classrooms.sql`, após a de gestão docente, acrescenta o campo de visibilidade, os códigos privados, as RPCs de catálogo e entrada e as restrições nas sessões e decisões. O frontend não aplica migrations. Nenhum banco online foi alterado nesta entrega.

`npm run test:db:offline` aplica a sequência completa em PostgreSQL isolado e testa acesso sem turma, privacidade, publicação, códigos, revogação, conclusão e histórico. Os testes de interface também percorrem a prática individual e a entrada por código.
