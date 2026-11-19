# Prompts usados (IA como copiloto)

Os combinados da GS pedem que a equipe registre os prompts usados com IA. Este arquivo registra os desta parte. A ferramenta foi o Claude Code, assistente de programação da Anthropic, usado dentro do repositório do OpenLabs. Os prompts da parte de Programação Dinâmica estão em `programacao-dinamica/prompts.md`, no repositório.

## 18/11/2026: a análise e o lab

**Pedido da equipe:**

> faça as entregas, [...] coloque o nome do time [...], preciso dos entregaveis de datascience também, integração e representação no open labs para anexar junto, preciso de tudo correto no openlabs ta

A IA leu o enunciado da disciplina e propôs uma pergunta ligada à mesma CitizenTech: quem volta ao telecentro e que nota tira. A base usa a caminhada calculada pelo planejador de Programação Dinâmica.

**O que a IA fez:**

- escreveu `gerar_dados.py` (a base simulada, com semente fixa), `montar_notebook.py` (que monta e executa `analise.ipynb`) e `empacotar.py`;
- escreveu o texto do notebook, o `README.md` e o `dados/FONTE.md`;
- refez os dois modelos em TypeScript para o lab *Who comes back* do OpenLabs, com um teste que confere os coeficientes contra os do scikit-learn.

**Correções que a revisão pegou:**

- o texto dizia que a divisão por linha "infla" as métricas; medido, ela as baixa um pouco. O notebook e o lab passaram a dizer o que muda de verdade: o teste deixa de medir gente nova;
- o intercepto da logística diferia do lab na 3ª casa; o notebook passou a usar `tol=1e-8`.

## 18/11/2026: a avaliação

**Pedido da equipe:**

> examine 3 vezes e faça 3 rodadas como um avaliador do projeto baseado na ata que eu passei

A IA conferiu cada entregável contra os critérios do enunciado. Desta parte, ela corrigiu a falta deste arquivo no ZIP e deixou explícito, no notebook, por que o mapa é o do centro, se o telecentro da ficha fica no Jardim Ângela.

## O que a equipe precisa conferir e saber explicar

- [ ] por que a divisão é por pessoa (`GroupShuffleSplit`), e o que o `assert` da célula da divisão garante;
- [ ] por que a imputação e a padronização ficam dentro do `Pipeline` (aprendidas só no treino);
- [ ] o que MAE, RMSE e R² dizem sobre a regressão linear, e por que o "chute da média" é a linha de base;
- [ ] a matriz de confusão, e por que o recall da classe "não volta" pesa mais que a precisão;
- [ ] por que o corte 0,50 é uma decisão de política, e o que muda com 0,30 ou 0,55;
- [ ] por que o coeficiente do showcase não prova causa (a variável `engajamento`, escondida);
- [ ] as regras de `gerar_dados.py`, que são escolhas da equipe, e o que é real (as ruas e o catálogo) e o que é simulado.
