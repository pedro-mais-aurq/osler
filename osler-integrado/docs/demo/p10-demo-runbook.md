# OSLER P10 — roteiro de preparação e demonstração

Este roteiro permite preparar e repetir o MVP sem apagar histórico. Ele não substitui revisão clínica, não publica casos e não contém credenciais.

## 1. Pré-requisitos e versão esperada

- Node.js `>=22.12.0` e npm compatível com o lockfile.
- Para banco local: Docker em execução e Supabase CLI `2.116.0`.
- Navegador atualizado com DevTools disponível.
- Baseline funcional da P9: `1dca3e207a8392a527ba4968bd4f91d7062b19a8` (apesar da mensagem histórica “P10 MVP”).
- Entrega esperada: commit P10 informado no handoff, README/footer `Parte 10/10`, migration `20260905192513_add_p10_demo_stability.sql` e testes P10 presentes.
- URL local: `http://localhost:5173/`.
- URL esperada do Pages, após deploy autorizado: `https://pedro-mais-aurq.github.io/osler/`.

Antes da demonstração, confirme:

```bash
git status --short
git log -1 --oneline
npm ci
npm audit
npm test
npm run typecheck
npm run build
```

O audit deve mostrar zero vulnerabilidades critical e high. O diretório de trabalho deve estar limpo no commit aprovado.

## 2. Estado esperado do Supabase

O projeto correto precisa ter:

- anonymous sign-ins habilitado;
- migrations P2, P4, P5, P7, P8, P9 e P10 aplicadas;
- `abandon_simulation_session(uuid)` executável apenas por `authenticated`;
- ao menos um caso `published` e humanamente aprovado para cada curso que será demonstrado;
- nenhum `service_role` no frontend.

Validação somente leitura no SQL Editor do projeto correto:

```sql
select
  clinical_case.slug,
  clinical_case.course,
  clinical_case.status,
  clinical_case.metadata ->> 'clinical_content_validated' as validated,
  truth.reviewed_at
from public.clinical_cases as clinical_case
left join public.case_truth_models as truth
  on truth.case_id = clinical_case.id
where clinical_case.course in ('nursing', 'clinical_analysis')
order by clinical_case.course, clinical_case.slug;
```

Não prossiga com uma demonstração clínica pública se o conteúdo necessário continuar `draft` ou sem aprovação humana independente.

## 3. Restauração local reproduzível

Estes comandos são exclusivamente para desenvolvimento local. `db reset` destrói os dados do banco local e nunca deve ser apresentado como comando de produção.

```bash
npx supabase@2.116.0 start
npx supabase@2.116.0 db reset
npx supabase@2.116.0 test db
```

O seed permanece técnico: ele recria uma fixture `draft`, sem conteúdo clínico validado. Para QA local controlado dos candidatos P4/P7, a publicação temporária abaixo é permitida somente no banco local:

```sql
update public.clinical_cases
set status = 'published'
where slug in (
  'seguranca-ao-levantar-no-ambulatorio',
  'rastreabilidade-de-amostra-hemograma'
);
```

Essa operação não constitui revisão científica. Não altere `clinical_content_validated`, `reviewed_at` ou `review_status`. Ao terminar o QA, execute novamente `npx supabase@2.116.0 db reset` para restaurar os drafts.

## 4. Preparação imediata da apresentação

1. Abra a URL e faça um hard refresh.
2. Em DevTools, confirme ausência de 404, warning React e promise rejection.
3. Em Network, filtre por `rpc` e confirme que não aparecem `case_truth_models`, `case_step_rules`, conteúdo de opções não escolhidas ou dados de outro usuário.
4. Teste em `1366x768` primeiro; confirme decisão, feedback e botão Continuar sem sobreposição.
5. Deixe uma segunda aba pronta na entrada para o outro curso, sem iniciar tentativa antecipadamente.

## 5. Enfermagem — caminho adequado

1. Entrada → **Sou aluno**.
2. Escolha **Enfermagem**.
3. Abra **Segurança ao levantar no ambulatório** e inicie o caso.
4. Leia a etapa de acolhimento e continue.
5. Em **Sua primeira ação**, escolha manter Luiza sentada/segura, observar e acionar o enfermeiro.
6. Confirme classificação textual, feedback e consequência; continue.
7. Em **Comunicação com o enfermeiro**, escolha o relato objetivo, sem diagnóstico.
8. Continue até a conclusão e abra `/resultado?session=<uuid>` automaticamente.
9. No debrief, confirme score bruto, `2` decisões, classificações, opções escolhidas, feedback/consequências históricos e referências.

## 6. Enfermagem — caminho não ideal

Repita o caso e escolha ao menos uma alternativa não ideal, por exemplo pedir que Luiza caminhe novamente ou diagnosticar e adiar a comunicação. Confirme que:

- o feedback é textual, não apenas uma cor;
- o fluxo corrige a consequência sem inventar deterioração;
- é possível continuar, concluir e abrir o debrief;
- o debrief reflete exatamente aquela tentativa.

## 7. Análises Clínicas — caminho adequado

1. Volte à entrada e use uma nova sessão anônima se necessário; escolha **Análises Clínicas**.
2. Abra **Rastreabilidade de amostra para hemograma** e inicie.
3. Confira solicitação, amostra e divergência pré-analítica pelas abas progressivamente disponíveis.
4. Escolha interromper o processamento, registrar a não conformidade e solicitar nova coleta.
5. Avance pela nova amostra, análise simplificada e resultado técnico.
6. Encaminhe o registro ao profissional legalmente habilitado para revisão, validação e liberação.
7. Conclua e confirme no debrief score bruto, `2` decisões, opções, classificações, feedback, consequências e referências.

## 8. Análises Clínicas — caminho não ideal

Repita e escolha ao menos uma opção não ideal, como aceitar com nota ou disponibilizar o resultado técnico sem a revisão prevista. Confirme que:

- a decisão inadequada não revela a regra privada nem respostas futuras;
- o processamento segue por correção coerente;
- o estudante não recebe crédito por liberação autônoma;
- conclusão e debrief continuam disponíveis.

## 9. Debrief, refresh e nova tentativa

- Faça refresh no feedback persistido: etapa, escolha, score e feedback devem ser restaurados.
- Faça refresh no debrief: a tentativa concluída deve continuar disponível pelo `session` da URL.
- Use **Refazer este caso**: a sessão concluída permanece histórica e uma nova `simulation_session` é criada ao iniciar.
- Não remova o parâmetro `session` para simular um debrief válido.

## 10. Reinício de tentativa interrompida

1. Inicie qualquer caso e avance ao menos uma decisão.
2. Clique **Reiniciar tentativa**.
3. Confirme: “Reiniciar esta tentativa? O progresso desta tentativa será encerrado e uma nova tentativa será iniciada. O histórico registrado será preservado.”
4. Confirme retorno à primeira etapa em uma nova tentativa.
5. Termine a nova tentativa, abra o debrief e use **Refazer este caso** mais uma vez.

Resultado esperado: a tentativa interrompida fica `abandoned`; score, actions e timestamps históricos permanecem; nenhuma linha é apagada.

## 11. Estados seguros antes da apresentação

| Situação | Resultado esperado |
|---|---|
| `/simulacao` sem autenticação | redireciona para a entrada |
| `/simulacao` sem curso | redireciona para seleção de curso |
| Caso de outro curso ou `draft` | não abre; seleção/estado vazio seguro |
| Nenhum caso `published` | estado vazio claro com troca de curso |
| Falha ao carregar/iniciar/decidir/avançar | mensagem amigável e retry quando seguro |
| `/resultado` sem `session` | resultado indisponível |
| UUID inválido, sessão alheia, `in_progress` ou `abandoned` | mesma indisponibilidade segura |
| Rota inexistente | 404 com retorno à entrada |

Também valide os textos de atividade: **Preparando seu caso**, **Iniciando…**, **Avaliando sua escolha…**, **Carregando próxima etapa…** e **Preparando debriefing**.

## 12. Tela, teclado e acessibilidade

Valide `1366x768`, `1440x900`, `1920x1080` e `390x844`:

- sem overflow horizontal;
- paciente não cobre prancheta;
- decisão, feedback, tabs e amostra legíveis;
- botões acessíveis e foco visível;
- tabs operáveis com Tab, Enter/Espaço, setas, Home e End;
- mobile empilha paciente, prancheta e ações;
- `prefers-reduced-motion` reduz transições.

## 13. Problemas conhecidos e critérios de parada

- Os candidatos P4 e P7 versionados permanecem `draft`, `clinical_content_validated = false` e sem revisão humana. Isso bloqueia uma demonstração clínica hospedada até publicação separada e auditável.
- GitHub Pages não aplica migrations; P10 precisa de deploy de frontend e aplicação de banco separados.
- Anonymous sign-ins precisa estar habilitado no projeto Supabase hospedado correto.
- O projetor físico deve ser validado no local; em desenvolvimento, os quatro viewports acima são o substituto mínimo.

Pare a demonstração se não houver caso aprovado/publicado, se o audit tiver critical, se o debrief expuser dados alheios ou se houver 404 de asset próprio.

## 14. Plano B

1. Antes do evento, prepare e valide um ambiente local com Docker, migrations e somente conteúdo aprovado; não dependa de publicação improvisada no SQL Editor.
2. Leve o commit/ZIP aprovado e o lockfile, mantendo Node 22 disponível.
3. Se a rede falhar, use o ambiente local já validado; não troque chaves nem desabilite RLS durante a apresentação.
4. Se o banco não puder ser restaurado com segurança, mostre o build e o roteiro arquitetural, sem simular aprovação clínica ou editar dados ao vivo.
