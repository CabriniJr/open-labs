# Quem volta ao telecentro? — Data Science

Entrega da disciplina **Data Science & Statistical Computing** (Global Solution 2026.2 · CitizenTech · Engenharia de Software, 2º ano). Equipe 10, **OpenLabs no Telecentro**. Os nomes e RMs estão em `integrantes.txt`, dentro do ZIP.

## O que a análise responde

| pergunta | alvo | modelo | resultado no teste |
|---|---|---|---|
| Quanto a pessoa vai tirar no checkpoint do lab? | `nota` (0–10) | regressão linear | MAE 0,84 · RMSE 1,07 · R² 0,61 (chutar a média: MAE 1,39, R² ≈ 0) |
| A pessoa vai voltar em até 7 dias? | `voltou_em_7_dias` (0/1) | regressão logística | F1 0,63, precisão 0,74 e recall 0,56 com corte 0,5 (chutar a classe mais comum: F1 0) |

**Recomendações.** São fundamentadas nas previsões, e o notebook traz os limites de cada uma.

1. **Lembrete e reserva para quem tem baixa chance de voltar.** Com corte 0,50, o aviso alcança 83% de quem não ia voltar, e dois em cada três avisos acertam.
2. **Showcase primeiro para quem está começando.** Ele sobe a nota prevista em cerca de 1,3 ponto.
3. **Atenção a quem mora longe.** Quem anda mais de 20 min volta 22% das vezes; quem mora perto volta 53%. O indicador de cobertura do planejador de Programação Dinâmica diz onde abrir um novo ponto.
4. **Sessões noturnas mais curtas**, com a trilha salva no banco.

## Arquivos

| arquivo | o que é |
|---|---|
| `analise.ipynb` | **o notebook executado**: contexto, preparação, divisão treino/teste por pessoa, os dois modelos, métricas, gráficos e recomendações com limitações |
| `dados/sessoes_telecentro.csv` | a base (1 247 sessões de 420 pessoas) |
| `dados/FONTE.md` | **de onde vêm os dados**: base simulada, com a distância a pé real do OpenStreetMap e o catálogo real do OpenLabs |
| `integrantes.txt` | nomes e RMs (gerado pelo `empacotar.py` a partir de `equipe.json`, fora do Git) |
| `gerar_dados.py` | gera o CSV com semente fixa; as regras da simulação estão escritas nele |
| `montar_notebook.py` | monta e executa o notebook a partir de células em Python, para o texto ficar revisável no Git |
| `empacotar.py` | confere tudo e gera `entrega/GS-Data-Science.zip` |

## Como rodar

```
pip install -r requirements.txt
jupyter notebook analise.ipynb        # ou abra no VS Code / Google Colab, com o CSV ao lado
```

Para refazer tudo a partir do repositório do OpenLabs, que tem o mapa e o planejador:

```
python gerar_dados.py          # refaz o CSV (o mesmo, byte a byte)
python montar_notebook.py      # monta e executa o notebook
python empacotar.py            # confere e gera o ZIP
```

## Sem vazamento de dados

- **Divisão por pessoa.** A mesma pessoa tem até 5 sessões, então a divisão é por pessoa (`GroupShuffleSplit` por `id_aluno`). O notebook confere com um `assert` que ninguém está no treino e no teste ao mesmo tempo.
- **Transformações aprendidas só no treino.** Imputação pela mediana, padronização e one-hot ficam dentro de um `Pipeline`, ajustado só no treino.
- **Nada do futuro na nota.** A regressão da nota não usa o retorno, que acontece depois da sessão. A logística usa a nota, que já é conhecida no fim da sessão.

## No OpenLabs

O lab **`/labs/who-comes-back/`**, do handbook *Data Science*, roda os mesmos dois modelos **no navegador**, sobre o mesmo CSV e a mesma divisão por pessoa. Nele dá para trocar as variáveis, mover o corte da logística e ver a matriz de confusão e as métricas mudarem. Ele mostra também o que acontece quando a divisão é feita por linha em vez de por pessoa. Os coeficientes saem iguais aos do scikit-learn (o teste do pacote `ds-domain` confere).

## Uso de IA

O código e o texto foram feitos com apoio do Claude Code. Os pedidos estão em `../programacao-dinamica/prompts.md`. A equipe revisou o material e precisa saber explicar cada linha.
