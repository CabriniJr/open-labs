# A moldura na rampa — desenho

**Data:** 2026-09-02.
**Onde mora:** `packages/depth-ui` — o motor. Não é defeito do `otel.model`; é a gramática
de profundidade do palco, e os dois handbooks a usam.
**Precedência:** `DECISIONS.md` manda; depois a spec do motor composicional
(`2026-08-28-motor-composicional-design.md`), que é quem define profundidade como a árvore
de composição. Este documento não revoga nenhum dos dois.
**Origem:** auditoria visual do Luigi em 02/09/2026, no lab dos provedores. As capturas
que a motivaram estão em `.superpowers/brainstorm/` (não versionado).

---

## 1. O defeito

Com o enquadramento no `OpenTelemetry SDK`, as três caixas de provedor aparecem assim: a
moldura em azul forte, tracejada 8/4, traço 2, acesa com sombra; o interior desenhado
**dentro dela a 10% de opacidade**; e, embaixo, o rótulo `more inside`.

São três marcas na mesma caixa, e **duas contradizem o que o leitor está vendo**. O
interior está lá, aberto e desenhado — e a borda anuncia "fechada" enquanto o texto promete
que há mais dentro. O leitor recebe, ao mesmo tempo, um desenho e a negação dele.

O primeiro a desaparecer nessa mistura é o **canal**. Uma `travessia` já nasce pontilhada a
35% da tinta do dado; multiplicada pelo fade do interior, ela vira nada — e ela é
justamente a linha que responde "isso que entrou aqui vai parar onde lá dentro?". Foi por
isso que o pedido chegou como *"os canais das camadas inferiores estão causando muita
confusão"*: eles são o sintoma mais visível de uma causa que é maior que eles.

### A causa, e ela não é falta de contraste

A rampa move o interior e **não move a moldura**.

`aparece = quantoAparece(fracaoDoQuadro(place, quadro))` é uma grandeza contínua em [0,1],
e hoje ela comanda uma coisa só: a opacidade do grupo `.dui-stage__interior` (e, de tabela,
o sumiço do rosto, a `1 - aparece * 2`). A borda da caixa não a consulta: ela é pintada
categoricamente por `[data-fechado="true"]`, que é um booleano. Metade da ligação anda numa
grandeza contínua, a outra metade é um interruptor.

É o mesmo defeito que a rodada da travessia já corrigiu para as linhas — a linha de fora
era roteada sem saber dos pontos que o interior conhecia, e as duas metades da mesma
ligação eram desenhadas por dois critérios diferentes. Aqui a ligação é **moldura ↔
conteúdo**, e ela ainda tem dois critérios.

### O que `data-fechado` de fato quer dizer

Vale registrar, porque o nome engana. `place.collapsed` é a condição sob a qual o palco
decide **desenhar um interior**:

```ts
const interior =
  place.collapsed === true && profundidade < PROFUNDIDADE_MAXIMA ? interiores?.(place.id) : undefined;
```

Ou seja: "fechada" não quer dizer *sem interior*, quer dizer **o interior mora um nível
abaixo**. O dado está certo e fica — três specs de CPU dependem do atributo. O que está
errado é a **notação** pendurada nele ser categórica quando a coisa que ela descreve virou
uma questão de grau.

## 2. O que é inviolável

**Continuidade sem exceção.** Decisão do Luigi em 02/09/2026, quando perguntado
explicitamente: nada pode pipocar na tela; o conserto acontece **dentro** da rampa. É o
valor central do projeto — zoom contínuo, nunca modal —, e nenhuma das medidas abaixo o
negocia.

Consequência direta, e é ela que descarta a solução óbvia: **um piso de opacidade está
proibido**. Se o interior nunca desce abaixo de 0,4, ele salta de 0 para 0,4 no instante em
que a rampa começa. Um piso é um degrau com outro nome.

## 3. O desenho

### 3.1 A curva, no lugar do piso

`quantoAparece` **não muda**. Ela responde "quanto do quadro esta caixa ocupa", e isso é
medida, não gosto. Mexer nela para melhorar a aparência seria ajustar o instrumento para o
gráfico ficar bonito.

Entra uma função pura nova, no mesmo módulo:

```
tintaDoInterior(aparece) = aparece ** 0.45
```

Contínua nas duas pontas — 0 em 0, 1 em 1 —, monótona, e **sobe rápido**: a rampa passa
pouco tempo na faixa ilegível. O fantasma não é abolido por decreto; ele deixa de ter
platô. O expoente é um número de desenho e mora numa constante nomeada, com o porquê
escrito ao lado.

Testável sem tela, e a afirmação de legibilidade vira número:

- `tinta(0) === 0` e `tinta(1) === 1` — as pontas não mentem;
- monótona não-decrescente na faixa;
- `tinta(0.15) >= 0.4` — no primeiro sexto da rampa o interior já é legível.

### 3.2 A notação de "fechada" se desfaz na mesma rampa

Segunda função pura:

```
notacaoDeFechada(aparece) -> { tracejado, traco, preenchimento }
```

Em `aparece = 0` ela devolve exatamente o que existe hoje: tracejado 8/4, traço 2,
preenchimento cheio. Em `aparece = 1` não resta **nenhuma** marca de fechada — traço
contínuo, espessura 1 (a da caixa comum), preenchimento cedido. Entre as duas pontas ela
interpola de forma contínua.

Aplicada **inline**, e não por CSS: `calc()` dentro de `stroke-dasharray` é terreno
instável entre navegadores, e o repo já prefere função pura com teste a expressão esperta
numa folha de estilo. O CSS continua dono da cor; a função é dona do grau.

### 3.3 O rosto sai antes, e o critério é duro

O rosto (título + `more inside`) hoje sai a `1 - aparece * 2`, o que o faz conviver com um
interior já visível. Ele passa a sair pela mesma curva, com o critério explícito e checável: **o
`more inside` chega a zero em `aparece` menor ou igual ao ponto em que `tinta` cruza 0,4** —
o mesmo 0,4 da §3.1, que é onde o interior passa a ser legível. Uma promessa de que há
algo dentro, sobreposta ao dentro já desenhado, é a tela dizendo o contrário do que mostra.

### 3.4 O canal para de sussurrar

`.dui-stage__travessia` deixa de ser pontilhado a 35% e passa a sólido, ~85% da tinta do
dado, traço 1,25.

Ele continua dizendo "sou a **mesma** ligação vista um nível abaixo" — que é a razão
correta do desenho atual — mas passa a dizer isso por ser **mais fino** que o trilho de
fora (1,25 contra 1,6), e não por estar apagado. Fininho é notação; apagado é sumiço, e
some junto com a informação.

## 4. O invariante

Um property test sobre a faixa inteira, e ele é o que impede o defeito de voltar:

> Para todo `aparece` em [0,1], a tinta do interior **sobe** enquanto a marca de fechada
> **cai**; as duas saem do mesmo número; e nas pontas não há contradição — em 0 o interior
> não tem tinta nenhuma, em 1 não resta marca de fechada nenhuma.

Cobrado por mutação: repinar o tracejado numa constante, ou desligar a curva, derruba o
teste — e a mensagem tem de nomear qual das duas metades divergiu, senão o teste vira
alarme sem endereço.

Um teste de tela complementa o que só a tela responde: no enquadramento do SDK, a caixa de
um provedor com interior visível **não** exibe `more inside`.

## 5. Alcance, e o que quebra

Isto vive em `depth-ui`, então os dois handbooks mudam. A validação é nos dois:

- `labs/providers` — o caso que originou o pedido;
- `labs/gates`, `labs/cpu`, `labs/micro` — onde o aninhamento de três níveis existe de
  verdade, e onde a regressão apareceria primeiro.

`data-fechado` **permanece** como atributo, com o mesmo significado, então os seletores de
`micro-lab.spec.ts`, `cpu-lab.spec.ts` e `gates-lab.spec.ts` continuam válidos. O que deve
mexer são asserções de e2e que hoje fotografam o estado antigo do traço ou da opacidade.

## 6. O que este desenho deliberadamente não faz

- **Profundidade por tom de papel** (cada nível com um fundo mais fundo). Era a alternativa
  C, e foi recusada nesta rodada: briga com o "aceso", que também pinta fundo, e o ganho só
  aparece em três níveis. Fica registrada, não construída.
- **O título que cai no meio da caixa.** É defeito real e visível nas capturas, mas pode
  ser consequência de a moldura gritar; conserta-se depois, se continuar atrapalhando com a
  moldura calada. Consertar os dois juntos esconderia qual dos dois era a causa.
- **Piso de opacidade.** Recusado pela §2, e o motivo está lá.
