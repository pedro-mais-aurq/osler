# Validação da sala de aula — 30/10/2026

- Frontend: **210 testes aprovados em 23 arquivos**.
- TypeScript: verificação concluída pelo build, sem erros.
- Build conectado (`npm run build`): aprovado.
- Build local e HTML autossuficiente (`npm run package:local`): aprovados.
- Banco offline (`npm run test:db:offline`): as nove migrations foram aplicadas e os cenários de gestão e autorização foram aprovados em PostgreSQL/WASM isolado.

Os cenários incluem identidade Google verificada, bloqueio de promoção por metadados editáveis, lista privada de professores, isolamento entre autores, cadastro atômico por e-mail, rascunhos incompletos, publicação com revisão, versões publicadas preservadas, atividades por turma, tentativas independentes do mesmo caso, idempotência, encerramento e reabertura, privacidade de regras, bloqueio das APIs legadas para consultar gabaritos de casos docentes, debriefing histórico, devolutiva, remoção de acesso e mudança de e-mail. Também cobrem visibilidade pública ou privada, casos públicos sem matrícula, rascunhos ocultos, entrada por código sem duplicar matrícula, bloqueio de acesso revogado, separação das tentativas individuais, privacidade do histórico e arquivamento de casos públicos.

A prévia foi conferida no navegador: publicação de um caso de teste, criação de turma, cadastro de aluno por e-mail, disponibilização de atividade, retomada após recarregar e execução até o debriefing. O HTML independente também foi aberto e executado no navegador. Nesta atualização, o caminho de um aluno sem turma foi conferido até o início de uma tentativa pública, incluindo o novo painel de participação. Os testes automatizados percorrem esse caminho até a conclusão e reabertura do debriefing, além da entrada por código e da seleção de visibilidade no editor.

O teste de banco usa primitivas Auth simuladas e dispensa Docker. O login OAuth real exige credenciais do Google/Supabase; não foi executado nesta entrega. Os testes pgTAP que dependem do Supabase completo não foram executados, pois Docker não estava disponível. **Nenhuma migration foi aplicada ao banco online.**
