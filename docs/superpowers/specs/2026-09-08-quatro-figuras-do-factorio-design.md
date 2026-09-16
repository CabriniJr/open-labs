# Quatro figuras do Factorio — desenho

**Data:** 2026-09-08 (mesma sessão dos túneis, que são a primeira delas).
**Alcance:** o palco (`packages/depth-ui`), e portanto os dois handbooks.
**Precedência:** `DECISIONS.md` §1 (a gramática de Factorio) manda; depois o refino gráfico
(`2026-08-30`), de onde vêm o catálogo e a medida; depois os túneis (`2026-09-08`).

---

## 1. O pedido, e a régua

Luigi, 08/09/2026: *"podemos nos aproveitar do máximo que Factorio pode oferecer
graficamente para nosso modelo de grafos dinâmicos — grande parte da atratividade do nosso
projeto é a visão gráfica e bonita que por sua natureza ensina"*, e *"quero investir bastante
tempo para que seja o mais coerente, dinâmico, funcional e bonito"*.

A régua que impede isso de virar enfeite é a que o projeto já tem escrita: **nada se move
sozinho, toda animação sai de uma diferença no livro-caixa**. Estendida:

> **Toda figura tem de sair de um fato que o modelo já tem.** Uma figura sem fato por trás
> ensina errado com a autoridade de quem parece ter medido.

As quatro abaixo passam nessa régua hoje. Nenhuma delas precisa de `kind` novo, e nenhuma
delas deixa o domínio escolher forma — o domínio entrega **números**, o desenho decide o que
fazer com eles, exatamente como já acontece com `especieDaCarga` e `conteudo`.

## 2. F1 — A camada de circuito

**O fato:** `Wire.linha` já distingue `data` de `control`, e o `validateWorld` já recusa
aresta de dado saindo de um `sequencer`. Metade do diagrama de blocos da CPU é vermelha.

**Hoje:** as duas espécies são desenhadas no mesmo plano, e se distinguem por cor e traço.
No `micro`, a linha de controle corre por baixo das caixas junto com os fios de dado, e a
diferença fica por conta da cor — que é o único canal, e o pior deles para quem tem
dificuldade com vermelho e preto.

**A figura:** o Factorio tem duas redes na mesma fábrica — as esteiras, que carregam coisa, e
os fios de circuito, que carregam **número**. Os fios ficam num plano acima, finos, e ninguém
os confunde com esteira. Aqui: toda aresta de controle sai do laço das arestas de dado e vai
para um grupo próprio, **desenhado depois de tudo**, com espessura menor.

**A consequência que não pode passar calada:** cruzamento entre plano diferente deixa de
precisar de túnel — dois planos que se cruzam não se confundem, e é assim que o Factorio
resolve. Então o invariante "nenhum cruzamento fica nu" passa a valer **entre iguais**
(dado×dado, controle×controle). O que **não** muda é a contagem: `meada()` continua contando
todos os cruzamentos, e os tetos por lab continuam onde estão. Um cruzamento entre planos
continua sendo um cruzamento — ele só não é uma ambiguidade.

## 3. F2 — A carga enfileirada na esteira

**O fato:** `Message.weight` — quantos itens aquela mensagem leva. Já existe e já é desenhado.

**Hoje:** peso maior que um vira um **feixe**: até cinco bolinhas agrupadas numa roseta, no
mesmo ponto do fio. Ele diz "são vários", e não diz o que o Factorio diz de graça: que eles
vão **em fila pela esteira**, um atrás do outro, e que a esteira tem comprimento.

**A figura:** os itens do feixe passam a ser desenhados **ao longo da direção de viagem**,
espaçados, como um trenzinho. A roseta some. O `×N` continua para quando N passa do que
cabe, e o teto do que cabe deixa de ser um número mágico: é o comprimento que a esteira
oferece.

**Por que vale:** é a leitura de lote. Cinco spans saindo juntos deixam de ser "uma marca com
×5" e passam a ser cinco coisas na linha — que é o que o lab dos provedores passa a rodada
inteira tentando ensinar.

## 4. F3 — A esteira entupida

**O fato:** a fila é `kind: "buffer"` — a espécie que **recusa quando enche** —, e o quanto
ela tem dentro é estado dela. O que falta é o motor **não** poder ler esse estado, porque ele
é do domínio (`nodes[id]` é `unknown`, e tem de continuar sendo).

**A seam, e ela já existe:** o mesmo padrão de `conteudo` e `especieDaCarga`. Uma propriedade
nova e neutra:

```ts
readonly ocupacao?: ((id: string) => { readonly usado: number; readonly capacidade: number } | undefined) | undefined;
```

Números, sem vocabulário. Quem sabe ler `EstadoFila` é o domínio; o desenho só recebe dois
inteiros e decide o que fazer com eles.

**A figura:** o objeto que declara ocupação ganha **células** — uma fileira de casinhas, as
cheias marcadas —, e um estado `data-cheia` quando `usado === capacidade`. Cheia, a entrada
dele acende como recusa: é a esteira parada encostando na máquina.

**O que isso mata:** o lab diz por escrito que a fila enchendo é o que o terminal **não**
mostra. Hoje o palco também não mostra: mostra o descarte saindo pela porta lateral, que é o
resultado, e não a causa. A célula é a causa.

## 5. F4 — O alerta na máquina

**O fato:** o descarte já é aresta própria no palco (`aresta.descarte`), e o livro-caixa diz
quanto saiu por ela neste tick.

**Hoje:** o descarte sai por uma porta lateral discreta. Quem não estiver olhando para
aquele canto não vê perda de dado acontecendo.

**A figura:** o Factorio põe um ícone de alerta sobre a máquina que parou, e um alerta no
minimapa. Aqui: o objeto que descartou **neste tick** ganha uma marca de alerta no canto —
figura, não cor —, e ela some no tick em que ele para de descartar. Sai do mesmo lugar da
animação: a diferença do livro-caixa entre dois ticks.

**A regra que ela obedece:** alerta é sobre **agora**. Um alerta que fica depois que o
problema passou é o mesmo defeito da porta acesa por causa de um valor que já foi.

## 6. O que fica de fora

- **Soltar os pesos do roteador.** Continua sendo a rodada seguinte. A razão não mudou: com
  o túnel entrando sozinho e os tetos parados, dá para ver o que cada mudança fez;
- **Ícone por espécie de carga.** O Factorio desenha o item; nós não temos item, temos
  espécie — e espécie já é `especieDaCarga`, que é número de propósito. Um ícone escolhido
  pelo domínio é o domínio escolhendo forma, que é a porta dos fundos que o catálogo fecha;
- **Minimapa de alertas.** Precisa de uma vista que ainda não existe, e o alerta na máquina
  já responde a pergunta que importa.

## 7. Os testes

1. **a camada de circuito existe e está por cima** — toda aresta de controle está no grupo
   do circuito, e nenhuma aresta de dado está; o grupo vem depois no documento;
2. **o túnel vale entre iguais** — cruzamento dado×dado e controle×controle continua coberto;
   cruzamento entre planos não exige boca, e continua contado no teto;
3. **o feixe anda em fila** — os itens de um feixe têm coordenadas distintas ao longo de um
   eixo só, e o eixo é o da viagem;
4. **a ocupação sai do modelo** — com `ocupacao` ausente não há célula nenhuma; com ela, o
   número de células cheias é o que a função devolveu, e `data-cheia` aparece só no limite;
5. **o alerta é do tick** — ele aparece no tick em que o descarte acontece e some no
   seguinte. Property test: para todo tick, alerta ⇔ diferença de descarte positiva;
6. **os tetos de cruzamento não mudam**, e a sobreposição cega continua zero.
