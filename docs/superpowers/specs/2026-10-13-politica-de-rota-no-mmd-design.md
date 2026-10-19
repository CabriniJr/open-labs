# Política de rota no `.mmd` — Design

**Data:** 2026-10-13
**Status:** proposta, **com recomendação de NÃO implementar agora**. Nada implementado.
**Depende de:** `2026-09-16-mermaid-como-esqueleto-design.md` (§3, §4.3, §6), `kinds.md` (§2, §3)
**Pergunta que ela responde:** o formato deve ganhar sintaxe para declarar política de rota,
para que `router`/`switch`/`store`/`sequencer` deixem de depender de `overrides`?

**Resposta curta: não, e a medição é o argumento.** A sintaxe difícil seria construída para
**zero** nós deste repositório. O orçamento de desenho de linguagem rende muito mais em
`transform`, da onda 1 — que é o que 155 nós estão fingindo não ser.

---

## 0. Por que esta pergunta apareceu

O compilador de Mermaid monta `source`, `buffer`, `sink` e `static`. Os outros caem numa tabela
de recusa, e a razão escrita é sempre a mesma forma:

> `router` escolhe uma porta segundo uma política, e o formato ainda não tem como declarar
> política de rota

Isso lê como lacuna a fechar, e a §4.3 da spec do esqueleto reforça: ela já põe **nomes de
porta** nos rótulos das arestas (`router -- "req:pago" --> aprovado`), o que parece estar a um
passo de declarar a rota inteira. O passo que falta seria dizer **quem decide** por qual porta
cada carga sai.

Antes de desenhar essa sintaxe, a pergunta anterior: **quantos `router` deste repositório
ganhariam algo com ela?**

---

## 1. A medição

Contados nos mundos construídos, e não no código-fonte: para cada nó de `kind: "router"`, as
portas distintas que aparecem em `wires` com ele como origem.

| Mundo | `router` | Grau de saída |
|---|---|---|
| `anatomia` | 4 | 2, 2, 2, 1 |
| `heroi` | 1 | 1 |
| `pilares` | 1 | 3 |
| `providers` | 1 | 4 |
| `rpn` | 2 | 2, 2 |
| CPU (`cpu`, `somador4`, `micro`) | 343 | 186 com grau 0, 155 com grau 1, um com 16, um com 65 |

Os três mundos de CPU são distintos, e o mesmo código de porta lógica aparece em mais de um — a
contagem é de nós instanciados, não de trechos de código.

**Os 186 de grau zero não são nós soltos.** São folhas dentro de composto — `bit0-xor2` dentro
do composto `bit0` — cujo fio de saída é declarado no **pai**, e que o motor resolve subindo
pelo arquétipo (`resolveTargets` sobe para o fio do pai quando a porta não tem fio próprio). É o
mesmo mecanismo que, na rodada anterior, fez 67 de 68 fios parecerem mortos numa conta ingênua
de tráfego por porta.

Somando: **de 352 nós `router` no repositório, 343 têm no máximo uma porta de saída.** Os dois
de grau alto (16 e 65) são o mesmo código: o `dispersor` que espalha uma palavra em bits.

### 1.1 Grau de saída não é a medida certa para seletor, e isso mudou a conclusão

Um `mux` escolhe entre **entradas**, não entre saídas. Valia checar antes de concluir qualquer
coisa, e o que se lê nos três "mux" da CPU é o seguinte:

- **`mux-operando`** recebe *uma* mensagem com todos os candidatos (`a`, `b`, `imm`), lê
  `ctx.signals["selb"]` e escolhe um **campo**. Emite em `out`, a única porta.
- **`mux-escrita`** faz o mesmo com `selwb` entre `lido`, `pc+4` e `resultado`. Emite em
  `escrita`, a única porta.
- **`desvio`** lê `ctx.signals["cond"]`, **calcula** o próximo PC comparando operandos, e emite
  o valor calculado.

Nenhum dos três escolhe porta. Os três são `transform` guiados por sinal de controle — o sinal
seleciona um campo ou governa uma conta, e a carga sai pelo caminho único que existe.

**Consequência direta: nenhum nó do repositório escolhe a porta de saída a partir de um sinal de
controle.** A forma que precisaria da sintaxe difícil não existe aqui.

---

## 2. As quatro formas que existem

Lendo os comportamentos, as políticas reais caem em quatro formas. A coluna que importa é a
última.

### A. Leque mecânico — N portas, todas, sempre

`micro/dispersor` e `cpu/dispersor`: recebem uma palavra e espalham bit a bit, `a0..a31`,
`b0..b31`. `pilares/service` recebe uma requisição e entrega **a mesma** aos três gravadores — o
docblock é explícito: *"Ele não decide nada sobre o conteúdo"*.

Não há política. A decisão é "emita em cada porta declarada", e as portas declaradas já estão no
`.mmd`: a §4.3 põe o nome da porta no rótulo, e a rodada de 13/10/2026 acrescentou o kind da
mensagem no mesmo rótulo (`trace:span`, `metric:measurement`, `log:record`) — com uma guarda
cobrando que o rótulo não minta sobre o kind que viaja.

**Precisa de sintaxe nova: não.** Precisa de uma **decisão**, e é a tensão da §3 do design do
esqueleto, que diz que comportamento vive em TS. Um leque mecânico sintetizado pelo compilador
seria comportamento nascido do desenho. É pouco comportamento — "para cada porta declarada,
emita o que chegou com o kind declarado" — e ainda assim é a primeira vez que o formato
produziria lógica em vez de estrutura.

### B. Escolha pelo `kind` do que chegou

`rpn/despachante`: carga de kind `operador` sai pela porta `op`, de kind `numero` pela porta
`valor`.

O rótulo já casa porta com kind. A política é a identidade: *a carga de kind `k` sai pela porta
cujo rótulo declara `k`*. É um nó no repositório.

**Precisa de sintaxe nova: quase não** — precisa de um marcador dizendo que **esta** é a
política daquele nó, porque a mesma anotação de rótulo serve para A e para B, e as duas divergem
quando duas portas declaram o mesmo kind.

### C. Política de domínio

`providers/sampler` escolhe entre `sampled`, `recorded` e `dropped` por `amostradorDe(ctx.params)`
— é `TraceIdRatioBased` com o decorador que rebaixa `DROP` a `RECORD_ONLY`. `rpn/operador` escolhe
entre `out` e `erro` por divisão por zero. Os serviços da `anatomia` emitem em `call` e em
`export`, e **se** emitem depende de amostragem, de instrumentação ausente e de cabeçalho
derrubado.

Isto não é rota: é o assunto do lab. Declarar `TraceIdRatioBased` em rótulo de Mermaid seria
mover domínio para dentro do formato — exatamente o que a guarda de fronteira
(`check-boundaries.mjs`) existe para impedir do outro lado.

**Precisa de sintaxe nova: não, e não deve ter.** Fica em TS, por `overrides`, para sempre.

### D. Não é `router` nenhum

`gates` (AND/OR/XOR), `alu/coletor`, `alu/unidade-logica`, `cpu/decodificadorDeEndereco`,
`heroi/processor`, `transistors/noDeSaida`, e os três "mux" da §1.1: uma saída, e uma conta no
meio.

São `transform` e `merge` — da onda 1 do `kinds.md` — vestidos de `router` porque esses kinds não
existem. O `kinds.md` §3 já diz isso de `transform` a respeito de `sink`: *"hoje consome e
opcionalmente transforma; transformar sai para `transform`"*. O mesmo empréstimo aconteceu com
`router`, e em escala muito maior.

**É a forma de quase todos os 343 nós de no máximo uma porta.**

---

## 3. A recomendação

**Não desenhar sintaxe de política de rota agora.** Três razões, em ordem de peso.

1. **A sintaxe difícil seria para zero nós.** O que exigiria um mapa de "valor de sinal → porta"
   é a forma que a §1.1 mostrou não existir: os seletores do repositório escolhem campo, não
   porta. Desenhar a parte cara da linguagem para nenhum caso é o pior negócio disponível.

2. **`transform` paga muito mais.** Os 343 nós de no máximo uma porta não precisam de política —
   precisam do **kind certo**. Enquanto `transform` não existe, o catálogo mente sobre eles, e a
   forma do desenho afirma leque onde não há: o `kinds.md` §2 registra que *"sem leque, não há
   trapézio"*, e hoje o leitor vê trapézio de seletor em cima de uma porta AND. Isso é dívida
   pedagógica visível na tela, e nenhuma linha de Mermaid a conserta.

3. **A forma A pode ser resolvida sem sintaxe, e é uma decisão de uma pergunta.** Leque mecânico
   cobre os dois `dispersor` e o `pilares/service`, e tudo que ele precisa já está declarado no
   `.mmd`.

### O que fazer em vez disso, em ordem

1. **`transform` (onda 1).** Dá o kind certo a centenas de nós, conserta a forma do desenho em
   todos, e **não toca no formato** — é trabalho de motor e de catálogo.
2. **Decidir a forma A.** Uma pergunta de sim ou não: o compilador pode sintetizar leque mecânico
   a partir do que o rótulo já declara? Se sim, três nós saem de `overrides` sem sintaxe nova, e
   `merge` da onda 1 ganha o mesmo argumento pelo lado da entrada.
3. **Deixar B e C onde estão.** B tem um nó, e um marcador de política para um nó não se paga. C
   nunca sai de TS, por princípio de fronteira.

---

## 4. Se um dia o seletor por sinal aparecer

Registrado para não ser redescoberto, e **não** como aprovação. Se um lab futuro precisar de um
`router` que escolha a porta por sinal — a §1.1 mostra que nenhum precisa hoje —, rótulo de
aresta é o lugar errado: um seletor de 32 entradas geraria 32 arestas rotuladas à mão, que é o
risco que a §7 do design do esqueleto já nomeou.

O lugar seria o front-matter, que a §0 daquele design já reserva para "o que sobra" enquanto a
gramática do Mermaid não embarcar:

```yaml
---
id: exemplo-hipotetico
routes:
  seletor:
    by: control:sel                      # qual sinal decide
    cases: { 0: caminho-a, 1: caminho-b } # valor → porta
---
```

Isto é **esboço**, não proposta fechada: não diz o que acontece com valor fora de `cases`, nem
como um seletor de 32 bits se escreve sem 32 linhas. Essas duas perguntas é que decidiriam se a
sintaxe vale, e ficam abertas de propósito.

---

## 5. O que esta spec não mediu

- **`store`, `switch` e `sequencer`.** A recusa deles fala de política de retenção e de porta de
  controle, e a medição acima é só de `router`. `store` tem dois nós no repositório
  (`anatomia/backend`, `pilares/trace-store`), os dois por `overrides`; `switch` e `sequencer`
  têm zero — nenhum lab usa esses kinds hoje. A conclusão da §3 provavelmente vale igual ou
  mais, e não foi medida.
- **Quantos dos 343 são exatamente a forma D.** A amostra foi lida, não enumerada: `ledger` tem
  uma porta e é forma C (o export depende de amostragem), então a forma D não cobre os 343
  inteiros. A ordem de grandeza é o que decide a recomendação, e essa está medida.
- **Labs que ainda não existem.** A medição é do que está escrito. Um lab de Kafka (onda 2 do
  `kinds.md`) com partição por chave mudaria o peso — `partition` é §9.6 do catálogo justamente
  por isso. A recomendação vale para o repositório de hoje, e deve ser remedida quando a onda 2
  chegar.
