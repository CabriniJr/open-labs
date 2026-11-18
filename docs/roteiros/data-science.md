# Roteiro do handbook de ciência de dados

Um roteiro por lab: a pergunta, o erro que ele desfaz, a mídia, o que o showcase conta, o que a simulação deixa quebrar, com quem o lab conversa e o critério de pronto. A forma está em `.claude/skills/openlabs-lab/SKILL.md`. Atualize este arquivo **no mesmo PR** que cria ou muda um lab.

## O que este handbook é

Como um modelo aprende de dados, e como saber se ele aprendeu de verdade. O cenário é o telecentro dos outros handbooks da GS (redes, bancos de dados, algoritmos). Os dados são as sessões de estudo do OpenLabs nele.

## As regras que valem para todo lab daqui

1. **Os mesmos números do notebook.** O lab refaz os modelos em TypeScript (`packages/ds-domain`). Um teste confere métricas e coeficientes contra os do scikit-learn, que o notebook grava em `data-science/dados/referencia_openlabs.json`. Se o notebook mudar, `node packages/ds-domain/gerar.mjs` atualiza o pacote, e o teste falha enquanto isso não for feito.
2. **Avaliado em quem o modelo não viu.** A divisão é por pessoa. O lab mostra o que muda com a divisão por linha, e diz o que muda de verdade: o teste deixa de medir gente nova. Ele não promete que a métrica vai subir, porque com estes modelos ela não sobe.
3. **Toda frase da página é medida.** Os números do "Break it" saem do modelo rodado sobre a base: F1 0,63 → 0,55 sem a caminhada, R² 0,61 → 0,42 sem o showcase, 211 de 420 pessoas nos dois lados na divisão por linha. Se a base mudar, os números da página têm de ser conferidos de novo.
4. **Dado simulado é dito como simulado**, junto com o que é real: a caminhada no OpenStreetMap e o catálogo do OpenLabs.

## Fase 2 — Predicting a number (e a 3, no mesmo lab)

### who-comes-back — *Who comes back to the telecentre? Two regressions, one split* · disponível (filme + livre)

- **Pergunta:** que nota a pessoa vai tirar, e ela vai voltar em 7 dias?
- **Mal-entendidos:** "divisão aleatória sempre serve"; "R² 0,6 = acerta 60%"; "coeficiente = causa"; "corte 0,5 é o certo".
- **Mídia:** filme do `@ovh/motion` em cinco capítulos: os pontos (caminhada × nota), a divisão por pessoa (o treino apaga), a reta (real × previsto), a curva (retorno × caminhada, com o corte) e a matriz de confusão. A simulação é React livre, com tabelas e uma dispersão em SVG.
- **Simulação:** divisão por pessoa ou por linha, as 10 variáveis marcáveis e o corte de 0,05 a 0,95. Mostra a matriz, a precisão, o recall e o F1 de "volta", quantos lembretes saem e quantos deles acertam, o retorno previsto por caminhada e os coeficientes dos dois modelos.
- **Recusa:** nenhuma variável marcada; variáveis colineares (eliminação de Gauss sem pivô).
- **Entrega:** `/labs/who-comes-back/entrega/` é o anexo em PDF da disciplina de Data Science. Ele é gerado por `node data-science/gerar_pdf_openlabs.mjs`, e as tabelas são calculadas no build.

## Correlações

- `shortest-path` → `who-comes-back`: a caminhada da base é o Dijkstra multi-fonte do planejador de PD, nas mesmas ruas.
- `telecentro-database` → `who-comes-back`: as colunas existem em `T_PROGRESSO` e `T_TENTATIVA`.
- `knapsack-session` ↔ `who-comes-back`: o que estudar, e quem volta para estudar.

## Critério de pronto

`pnpm test`, `typecheck`, `boundaries`, `catalogo`, `handbooks`, `locale:check`, o e2e `apps/site/tests/who-comes-back.spec.ts` (desktop e celular) e `pnpm qa:labs --only=labs/who-comes-back/`, com as fotos olhadas.

## Fila

1. Os três artigos marcados como `coming`.
2. Um lab da fase 1, "a split by row leaks", com um modelo que *decora* (k-vizinhos), em que a divisão por linha infla de verdade.
