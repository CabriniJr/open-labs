# Teoria: o que o motor é, formalmente

**Data:** 2026-08-29
**Papel deste documento:** dar nome às coisas. O motor foi desenhado por pressão de
problema — cada peça entrou resolvendo um jeito específico de mentir. Este documento
faz o caminho inverso: pega o que existe e pergunta *de que formalismo isso é uma
instância*.

Não é ornamento acadêmico. Um formalismo bem escolhido paga em três moedas:

1. **Vocabulário.** "A vista agregada é uma projeção de fronteira" é uma frase nossa.
   "É a imagem do run sob o homomorfismo de contração" é uma frase que outra pessoa
   já provou coisas sobre.
2. **Propriedades checáveis.** Cada formalismo abaixo entrega pelo menos um property
   test que a gente não teria pensado sozinho. A tabela da §6 lista quais.
3. **Fronteira honesta.** Saber de que formalismo somos instância é saber de quais
   **não** somos — e a §5 é a parte mais importante deste arquivo, porque é a lista
   do que o motor não pode dizer.

Precedência: este documento **descreve**, nunca decide. Se ele contradiz
`DECISIONS.md` ou a spec do motor, ele está errado.

---

## 1. O objeto base: grafo hierárquico com fluxos

O modelo é um grafo dirigido `G = (V, E)` com duas coisas que um grafo dirigido puro
não tem.

**Primeira: `V` não é um conjunto, é uma árvore.** Todo objeto tem no máximo um pai
(`tree.parent`), e as folhas são as únicas que agem. Isso não é um grafo com metadado
de agrupamento — é um **grafo hierárquico**, e a hierarquia é semântica: abrir um
objeto revela um subgrafo que roda de verdade.

A referência certa aqui não é a teoria de grafos, é o **modelo de atores hierárquico**
do Ptolemy II: atores compostos que contêm subatores, com o regime de execução
declarado por nível. `DECISIONS.md` §1.1 já apontava para lá pelo lado do drill-down;
o ponto formal é o mesmo.

**Segunda: `E` tem duas espécies.** `Wire.line ∈ {data, control}`. O subgrafo de dado
`G_d = (V, E_d)` é onde a carga anda; o de controle `G_c` é onde a influência anda,
sem carga. `resolveTarget` ignora `E_c` — a separação é estrutural, não uma convenção
de desenho.

E uma terceira coisa que **não** está em `V`: o canal é a **aresta**, nunca um nó.
`WorldSpec.channels` é indexado mas nunca aparece em `flowChildren`. Desenhar canal
como caixa faria o leitor procurar um processador onde há um meio.

### 1.1 Profundidade é contração de arestas

Focar num objeto `f` define um mapa `π_f : V → {filhos de f} ∪ {f, outside, @drop}`
que colapsa cada subárvore num rótulo só. A vista agregada é a **imagem do grafo sob
`π_f`** — em linguagem de grafos, uma contração; em linguagem de álgebra, um quociente.

Isso dá uma frase precisa para a tese do projeto inteiro:

> A vista de qualquer nível é `π_f` aplicada ao **mesmo** run. Nunca há um segundo
> modelo, mais grosso, autorado à parte.

E dá o teste. `scheduler.property.test.ts` prova, para todo foco possível da árvore e
todo tick até 30, a **igualdade**

```
boundaryCrossings(tree, state, f)  ==  { m ∈ state.flight : π_f(m.from) ≠ π_f(m.to) }
```

Igualdade, não inclusão. Metade da tese é "a vista não inventa travessia" (`⊆`); a
outra metade é "a vista não esconde travessia" (`⊇`), e é a metade que sustenta o
produto. Enquanto só o `⊆` estava provado, dois mutantes passavam em 128 testes —
inclusive um que jogava fora toda travessia com um lado `outside`, ou seja, o L0
inteiro. O rótulo é recalculado dentro do teste a partir de `tree.parent`: um teste
que chama a mesma função do código erra junto com ela e não prova nada.

---

## 2. Redes de Petri coloridas: o parente mais próximo

De todos os formalismos clássicos, **CPN** (Jensen) é o que mais se parece com o que o
motor faz. O mapeamento é quase direto:

| CPN | Motor | Onde vive |
|---|---|---|
| Token | Mensagem | `Message` |
| **Conjunto de cores** | `Message.kind` | o `kind` é a cor, literalmente |
| Marcação (multiconjunto de tokens) | `state.flight` + as caixas de entrada | `WorldState` |
| Transição | `behavior` de uma folha | `ObjectSpec.behavior` |
| Lugar | o estado local da folha | `state.nodes[id]` |
| Expressão de arco | o que o `emit` devolve | `ctx.emit(kind, weight, data)` |
| Rede hierárquica (transição de substituição) | contêiner que abre | `entry` / `exit` |
| CPN **temporizada** (`@+d`) | `edgeTicks` no fio | atraso de aresta |

Três consequências que valem mais que a tabela.

**A cor explica o invariante do `transform`.** "A forma da carga muda exclusivamente na
saída de um `transform`" (`DECISIONS.md` §2.1) é, em CPN, uma propriedade de
**preservação de cor nas expressões de arco**: para toda aresta, a cor do token é a
mesma nas duas pontas, exceto saindo de uma transição marcada. Deixa de ser uma regra
de etiqueta e passa a ser um invariante com forma conhecida.

**O tempo do motor é o tempo de CPN temporizada.** `edgeTicks` é o carimbo de tempo do
token: ele existe, está no `flight`, e ainda não está disponível para consumo. Não
inventamos um regime — instanciamos um que já tem literatura.

**`fragment`/`reassemble` é cor composta.** Um token cuja cor carrega uma lista, e uma
transição que só dispara quando o multiconjunto de entrada completa a lista. É
exatamente a construção que CPN usa para montagem, e é por isso que o par entrou no
catálogo junto (`kinds.md` §9): separá-los daria um formalismo pela metade.

### 2.1 Onde divergimos de CPN, e o preço

Duas divergências, ambas deliberadas.

**Lugar e transição estão fundidos no mesmo objeto.** Em CPN, lugares e transições são
nós distintos de um grafo bipartido. Aqui, uma folha é as duas coisas: tem estado
(lugar) e tem comportamento (transição). Ganhamos um desenho que o leitor entende sem
tutorial — uma caixa é uma coisa, não duas alternadas. Perdemos a bipartição, que é o
que boa parte das provas de CPN assume.

**A habilitação é procedural, não declarativa.** Em CPN, uma transição dispara quando
uma **guarda** — uma expressão sobre a marcação de entrada — é verdadeira, e é isso que
torna a rede analisável. Aqui, `behavior` é uma função TypeScript arbitrária.

O preço é preciso e vale dito em voz alta: **não temos análise de CPN.** Nada de grafo
de alcançabilidade, invariantes de lugar, prova de ausência de deadlock. O motor
*simula*; ele não *verifica*. Quem quiser essas garantias precisa de uma ferramenta
CPN de verdade — e isso é uma fronteira permanente, não uma dívida a pagar.

---

## 3. Cadeias de Markov: onde o acaso mora

### 3.1 O run é determinístico; a cadeia é sobre a semente

Primeiro a afirmação precisa, porque é fácil errar aqui.

`stepWorld(spec, tree, state, params)` é uma **função pura**, e o único acaso vem de
`randomAt(seed, tick, salt)` — endereçável, sem estado escondido. Como `tick` faz parte
do estado, temos, para uma semente fixa:

```
X_{t+1} = f(X_t, params_t)          — determinístico
```

Ou seja: **para uma semente fixa, o mundo não é estocástico; é uma trajetória
determinística.** É exatamente isso que torna o `seek` exato em vez de aproximado —
rebobinar é reler, não reexecutar torcendo para dar igual.

A cadeia de Markov aparece quando se **quantifica sobre a semente**. O processo
`{X_t}` com `seed ~ Uniforme` é uma cadeia de Markov de tempo discreto: a distribuição
de `X_{t+1}` depende de `X_t` e de mais nada do passado, porque `f` não tem memória
fora do estado. A propriedade de Markov vale **globalmente e por construção** — é
consequência da pureza de `stepWorld`, não de uma escolha de modelagem.

Vale a ressalva técnica: como o sorteio é endereçado por `tick`, o processo é
formalmente não-homogêneo no tempo. Estatisticamente o fluxo `randomAt` é i.i.d., então
a não-homogeneidade não é observável — mas ela é a razão de o mesmo mundo, rodado do
tick 5 em diante, não repetir o que fez do tick 0 em diante.

### 3.2 A cadeia útil é pequena, e é a do nível visível

A cadeia global tem espaço de estados absurdo (todo `nodes`, todo `flight`, todo
`ledger`). Enumerá-la não ensina nada. O que ensina é a cadeia **de um nível**:

Um `router` com pesos `w₁…wₖ` nas portas de saída define uma distribuição categórica
sobre os fios que dele saem. Uma mensagem caminhando por uma rede de routers **sem
estado interno** é, literalmente, uma cadeia de Markov de tempo discreto sobre o grafo
de portas, com matriz de transição

```
P[i][j] = w_j / Σ w   se existe fio da porta j de i
```

E isso é imediatamente checável: a distribuição estacionária dessa cadeia tem forma
fechada, dá para calculá-la analiticamente e comparar com a contagem do livro-caixa
depois de 10⁵ ticks. **É o property test mais forte que o amostrador pode receber** —
não "o sampler devolve algo plausível", e sim "a frequência empírica converge para a
estacionária que a álgebra prevê". Fica reservado para a S2, quando `router` ganhar
pesos de verdade.

### 3.3 Onde deixa de ser cadeia simples e vira rede de filas

Basta um `buffer` para o estado deixar de ser "onde a mensagem está" e passar a ser
"onde a mensagem está **e** quanto tem em cada fila". A cadeia continua existindo — o
espaço é que explode.

O nome disso é **rede de filas**; com hipóteses fortes (chegadas de Poisson,
serviço exponencial, capacidade infinita) é uma **rede de Jackson**, que tem solução em
forma produto. As hipóteses da rede de Jackson **não valem aqui**: nossas filas têm
capacidade finita, e é justamente a capacidade finita que produz o fenômeno que o
handbook precisa ensinar — **backpressure**. Fila que transborda é o assunto, não o
caso patológico.

Então a posição honesta é: a rede de filas dá o vocabulário (utilização, taxa de
chegada, taxa de serviço, lei de Little) e **não** dá a fórmula fechada. Quem quiser o
número exato simula. Que é o que o motor faz.

### 3.4 Redes de Markov (campos aleatórios): a pergunta de configuração

Cadeia de Markov é dirigida e no tempo: "de onde eu venho, para onde eu vou". **Rede de
Markov** (campo aleatório de Markov) é não-dirigida e sem tempo: "que combinações de
valores são coerentes entre si". A distribuição fatora sobre os cliques do grafo:

```
P(x) = (1/Z) · Π_c φ_c(x_c)
```

Essa é a forma da pergunta que o projeto ainda **não** responde, mas que já apontou
com o dedo: **dada uma configuração real, quais combinações de parâmetros são
coerentes?** Amostragem de cabeça e amostragem de cauda interagem; tamanho de lote
interage com timeout de exportação; nenhuma dessas relações tem direção natural.

**Estado: não implementado, e declarado como fronteira, não como promessa.** Escrever
`P(x)` aqui é dizer qual é a forma da coisa quando a E3 chegar no manifesto —
`model-format.md` hoje valida coerência com regras escritas à mão, o que é a versão
crua e determinística da mesma pergunta. Nada no motor faz inferência em MRF, e este
documento não deve ser lido como se fizesse.

---

## 4. Um tick é um passo síncrono, e isso é uma escolha

Todo ator de um tick lê o estado que existia no começo do tick e escreve um estado
novo. A ordem em que o laço de `stepWorld` percorre os atores **não muda o resultado**,
e não por disciplina: `behavior` recebe `nodes[node.id]` e mais nada, então um ator não
tem como ler o estado de outro — nem o antigo, nem o recém-escrito. A assinatura não
oferece o argumento que seria preciso para espiar.

É o mesmo padrão do medidor, que só recebe tráfego de porta e nunca `state.nodes`: a
violação não é improvável, é **impossível de escrever**.

Formalmente: o tick é um passo **síncrono e paralelo**, como um autômato celular ou um
circuito síncrono, e não um entrelaçamento de eventos discretos. As mensagens emitidas
num tick saem todas com o mesmo `sent`, e o `edgeTicks` as entrega juntas.

Isso é uma perda declarada, e é a mais séria da lista. Vem na §5.

---

## 5. O que o motor deliberadamente NÃO é

Esta seção existe para ser citada quando alguém — inclusive nós — for tentado a usar o
motor para algo que ele não faz.

**Não há relógio global em sistema distribuído; aqui há.** Todo objeto compartilha o
mesmo `tick`, e o leitor vê um "agora" único para o mundo inteiro. Sistemas
distribuídos reais não têm isso: têm ordem parcial, relógios que discordam, e é dessa
ausência que nasce metade da razão de existir de rastreamento distribuído. **Este é o
risco pedagógico número um do projeto**, porque o motor ensina, de graça e sem dizer,
uma coisa falsa. Ou algum lab passa a atacar isso de frente (relógios desalinhados como
perturbação, ordem parcial como assunto), ou o texto declara o limite em voz alta.
Fingir que não existe é o defeito da mentira silenciosa com outro nome.

**Não há concorrência de verdade.** Passo síncrono, sem entrelaçamento, sem condição de
corrida, sem não-determinismo de escalonamento. Quem quiser ensinar corrida precisa
modelá-la como assunto explícito, não esperar que ela emerja.

**Não há tempo contínuo.** Um tick vale **100 ms declarados**, e todo controle mostra o
valor real ao lado. Tick abstrato é pior: o leitor inventa a correspondência sozinho e
a gente não tem como corrigir. Nada de eventos entre ticks.

**Não há verificação.** Simulação não é prova (§2.1). Rodar 10⁵ ticks sem deadlock não
é ausência de deadlock.

**Não há rigor estatístico de dimensionamento.** Sem intervalo de confiança, sem
tratamento de eventos raros, sem análise de transiente. O motor é instrumento de
ensino; ninguém deve dimensionar um coletor com ele.

**Não há custo de rede.** `edgeTicks` é constante por mundo. Sem jitter, sem perda, sem
reordenação — a não ser que um `kind` futuro os modele explicitamente como assunto.

---

## 6. O que cada formalismo cobra em teste

Um formalismo que não vira teste é decoração. O que cada um entrega:

| Formalismo | Propriedade | Estado |
|---|---|---|
| Grafo hierárquico | vista de fronteira == contração do run, para todo foco | ✅ `scheduler.property.test.ts` |
| CPN — preservação de cor | `kind` igual nas duas pontas de todo fio, exceto saindo de `transform` | ⏳ S2 |
| CPN — conservação | toda mensagem emitida está em trânsito, entregue, descartada ou em `.unwired` | ✅ livro-caixa fecha |
| CPN temporizada | atraso de aresta uniforme: nada chega antes de `edgeTicks` | ✅ `scheduler.test.ts` |
| Markov (determinismo) | mesma semente ⇒ mesma trajetória; `seek` exato | ✅ `world.test.ts` |
| Markov (estacionária) | frequência empírica do `router` converge para a analítica | ⏳ S2 |
| Rede de filas | lei de Little no `buffer`: `L = λ·W` | ⏳ S2 |
| Rede de Markov | coerência de configuração como fatoração | ❌ fronteira, não dívida |

---

## 7. A prova de genericidade: uma CPU

O motor se declara agnóstico e o CI defende essa fronteira
(`scripts/check-boundaries.mjs`). Mas uma fronteira defendida por guarda é
**disciplina**; ela só vira **fato** quando um segundo domínio, radicalmente diferente
do primeiro, é instanciado sem tocar em `depth-core`.

O segundo domínio escolhido é o **caminho de dados de uma CPU**, com drill-down até o
nível de porta lógica e com **assembly como entrada**.

Ele não é só prova: **tem destinatário.** É material para as aulas de arquitetura de
computadores do pai do Luigi — um modelo que se programa, não um diagrama que se olha.
Isso muda o padrão de qualidade da fase: um instrumento didático usado por outra pessoa
não pode ter a parte que "quase funciona", que é justamente a tentação de uma prova de
conceito.

### 7.1 O L0 já está desenhado, e já usa as nossas duas linhas

O Luigi apontou o alvo com um diagrama de blocos clássico de arquitetura de computadores:
entrada e saída nas pontas; uma caixa **CPU** contendo a **unidade de controle** e o
**processador**, que por sua vez contém **registradores** e **lógica combinacional**; a
**memória principal** embaixo; e a palavra "instruções" entrando na unidade de controle.

O detalhe que importa não é a topologia, é a **tinta**. Nesse diagrama as setas pretas
carregam dado e as setas vermelhas saem todas da unidade de controle e não carregam nada
— são sinal. Isto é, um desenho canônico de livro-texto, feito muito antes deste projeto
existir, já separa exatamente as duas espécies de linha que a §1 chama de `E_d` e `E_c`.
Não adaptamos o domínio à nossa gramática; a gramática já estava lá.

O mapeamento do L0, então, é direto:

| No diagrama | No motor | Família |
|---|---|---|
| Entrada, Saída | `source`, `sink` | processador |
| CPU (a caixa externa) | `composite` — contém, não processa | contêiner |
| Processador (a caixa amarela) | `composite` | contêiner |
| Registradores | ator que responde a leitura e escrita | processador |
| Lógica combinacional | onde a carga muda de forma: `transform` | processador |
| Memória principal | ator endereçado, com `arbiter` quando disputada | processador |
| **Unidade de controle** | **`controller`** — não recebe carga | controlador |
| Setas pretas | `Wire.line: "data"` | — |
| **Setas vermelhas** | **`Wire.line: "control"`** | — |

A família `controller` entrou no catálogo (`DECISIONS.md` §2.2) porque árbitro, relógio e
supervisor não ficam no caminho do dado. A unidade de controle é o caso mais puro que
existe dela: ela decide o que todo mundo faz e **não toca no dado**. Tratá-la como
processador obrigaria a inventar um fluxo que o diagrama, corretamente, não desenha.

E é aqui que a lacuna L1 da §7.5 deixa de ser abstrata: hoje as setas vermelhas seriam
desenhadas e ignoradas. Metade desse diagrama é vermelha.

### 7.2 A descida

Cada nível abre no de baixo, e todos são projeções (§1.1) do mesmo run:

| Nível | O que se vê | Carga |
|---|---|---|
| Sistema | entrada, saída, CPU, memória principal | palavras |
| CPU aberta | unidade de controle, processador, barramentos | instrução |
| Processador aberto | registradores, lógica combinacional, muxes de operando | operandos |
| Lógica combinacional aberta | ULA, deslocador, mux de operação | palavras de 32 bits |
| ULA aberta | somador, unidade lógica | bits e vai-um |
| Somador aberto | cadeia de somadores completos | um bit e o vai-um |
| Somador completo aberto | XOR, AND, OR | **um bit** |
| Porta aberta | rede de transistores em série e paralelo | **nível de tensão** |

Oito níveis, e o último é o que fecha o argumento pedagógico: **a porta lógica deixa de ser
o átomo.** Quem abre um XOR e vê transistores conduzindo ou cortando entende por que a porta
custa o que custa, por que existe atraso de propagação, e por que "combinacional" não quer
dizer "instantâneo" — que é exatamente a lacuna L3 da §7.5 vista de baixo.

É mais fundo que o domínio de OpenTelemetry, e é de propósito: se a profundidade aguenta
oito níveis num domínio onde cada nível é uma abstração de verdade — não um agrupamento
visual —, ela aguenta o handbook.

Uma ressalva de fidelidade, para não prometer o que não vamos entregar: o nível do transistor
é **chaveamento digital**, não eletrônica analógica. Transistor conduz ou corta; não há curva
característica, nem corrente, nem temperatura. Isso ensina construção de porta lógica e
ensina atraso; não ensina projeto de circuito. Como sempre neste projeto, o que não é
modelado é dito em voz alta em vez de ficar implícito no desenho.

### 7.3 Assembly é o manifesto

O leitor escreve instruções; um montador (ferramenta de **autoria**, fora do motor)
produz palavras; as palavras são o estado inicial da memória; o run é a execução
daquele programa.

Vale registrar a simetria, porque ela valida uma decisão que até agora tinha um caso de
uso só:

> **Assembly está para o lab da CPU como a configuração do SDK está para o lab de
> OpenTelemetry.** Nos dois, uma configuração real e verificável é a fonte da verdade,
> e o modelo é a compilação dela — nunca uma ilustração escrita à mão ao lado.

É exatamente a E3 (`roadmap.md`), com o contrato de fidelidade obrigatório. Que a mesma
forma apareça em dois domínios sem combinação prévia é o melhor indício de que ela é a
forma certa.

### 7.4 O que o motor já dá

| Necessidade da CPU | O que já existe |
|---|---|
| Ciclo de clock | o tick síncrono (§4) **é** um ciclo: todo mundo lê o estado do começo e escreve o do fim |
| Estágio de pipeline | `pipeline` — contêiner ordenado |
| Registrador entre estágios | `buffer` de capacidade 1 |
| Bolha / stall | backpressure (F1): o buffer que recusa **é** o hazard |
| Seleção de operando | `mux` / `demux` (onda 4 do catálogo) |
| Realimentação do PC | ciclo no grafo — já suportado, porque a entrega é atrasada e nenhum tick recorre |
| Barramento disputado | `arbiter` (onda 1) — recurso como porta, §2.3 do `DECISIONS.md` |
| Determinismo | é o caso de semente fixa (§3.1); a CPU simplesmente não sorteia |

Que `mux`/`demux` e `arbiter` tenham entrado no catálogo pensando em gRPC e em memória,
e sirvam intactos aqui, é o segundo indício de que o catálogo não é OpenTelemetry
disfarçado.

### 7.5 O que falta, nomeado

Três lacunas reais. Nenhuma é "adicionar um `kind`".

**L1 — Linha de controle não tem semântica.** `Wire.line: "control"` existe e
`resolveTarget` a ignora: hoje ela é desenho. Numa CPU, o sinal da unidade de controle
**é** o modelo — é ele que escolhe a entrada do mux e habilita a escrita no
registrador. Precisa de: sinal entregue a um ator muda o que ele faz naquele ciclo,
contado no livro-caixa como tráfego, e nunca confundido com carga. É a maior das três,
e é pré-requisito das outras duas.

**L2 — Ler sem consumir.** `add r1, r2, r3` lê `r2` e `r3` e não os destrói. Mensagem,
por definição, é consumida. Em CPN isso é um **arco de leitura** (laço lugar↔transição).
A saída compatível com o motor é o banco de registradores como **ator** que responde a
pedidos de leitura — nenhum ator espia o estado de outro, e a regra estrutural da §4
sobrevive intacta. Mas isso cobra um tick por leitura, o que nos leva à terceira.

**L3 — Caminho combinacional contra caminho registrado.** Esta é a funda. Hoje toda
aresta custa `edgeTicks ≥ 1`, e o mínimo é 1 porque uma travessia de custo zero
desapareceria da tela — `validateWorld` recusa `edgeTicks: 0` exatamente por
isso. Só que uma CPU **depende** da distinção: ler um registrador, somar e voltar
acontece *dentro* de um ciclo (combinacional); atravessar um registrador de pipeline
custa *um* ciclo (registrado). Sem os dois regimes, o modelo ou mente sobre o que cabe
num ciclo ou desenha um pipeline de 40 estágios que não existe.

**Desenho escolhido (Luigi, 29/08/2026): fases no tick.** Não abandonamos o mínimo de um
tick por aresta; damos duas fases a cada tick.

1. **Acomodação.** As arestas marcadas como combinacionais propagam repetidamente até o
   **ponto fixo** — nenhum valor muda mais. Não custa tick.
2. **Confronto.** O que atravessa aresta registrada é entregue, e o tick fecha.

É como simulador de lógica síncrona já funciona (os *delta cycles* de VHDL e Verilog), e
é a distinção que CPN faz entre transição imediata e transição temporizada. De novo: um
formalismo já resolveu isso, e a gente instancia em vez de inventar.

Quatro consequências que precisam ser tratadas como parte do desenho, e não descobertas
depois:

- **Laço combinacional trava.** Um ciclo no subgrafo combinacional é ponto fixo que pode
  não convergir. Em hardware isso é erro de projeto, e aqui também: `validateWorld`
  recusa o mundo na construção, **nomeando o ciclo**. É a regra da §5 outra vez — mover a
  validação para onde a violação vira impossível, em vez de pôr um teto de iterações e
  torcer.
- **A pureza tem que sobreviver.** `stepWorld` continua sendo função pura de
  `(estado, params)`; a acomodação acontece **dentro** dela. Se vazasse para fora, o
  `seek` deixaria de ser exato — que é o preço que este projeto não paga.
- **Determinismo do ponto fixo.** A ordem em que os atores acomodam não pode mudar o
  resultado, senão dois runs com a mesma semente divergem. É property test, não
  comentário: acomodar em ordem aleatória dá o mesmo estado final.
- **A travessia continua visível.** O mínimo de `edgeTicks: 1` existe porque uma
  travessia de custo zero sumiria da tela. Com fases, o que sumiria da tela é a
  acomodação — e a resposta é mostrá-la como **subpassos dentro do tick**, não escondê-la.

E aí vem um bônus que não é pequeno: a acomodação combinacional, mostrada como subpassos,
é **um eixo de profundidade no tempo**, irmão do eixo de profundidade no espaço que o
projeto já tem. Sem ela, "o que acontece dentro de um ciclo" é justamente o que nenhum
diagrama de CPU consegue mostrar — e passa a ser algo que só este instrumento mostra.

**Onde isso pousa:** na F1 do `roadmap.md`, não na F6. Fases do tick mudam o significado
de "um passo" para todo arquétipo já escrito, e semântica de controle muda a assinatura
de `Behavior`. As duas são mudanças de contrato, que é exatamente o critério da F1.

Uma quarta, menor: **escala de tempo é do mundo, não do motor.** Um tick vale 100 ms
declarados no domínio de OpenTelemetry e ~0,3 ns num domínio de CPU. A constante
precisa virar propriedade do `WorldSpec`, com a unidade junto — o valor real ao lado do
controle continua obrigatório nos dois casos.

### 7.6 Depois da CPU genérica: um ATmega

O Luigi pediu, para depois de a CPU estar bem feita, um **ATmega** — AVR de 8 bits, do
qual o 328P (o do Arduino Uno) é o candidato natural: datasheet público e detalhado, e é
o chip que mais gente já viu por dentro.

Não é "a mesma coisa de novo". Os dois alvos testam eixos diferentes: a CPU genérica
testa **mecanismo** (o motor consegue expressar isto?), e o ATmega testa **fidelidade**
(o modelo bate com um chip real, num nível em que discordar é objetivo?). No primeiro, a
verdade de campo é uma ISA que nós escolhemos; no segundo, é um datasheet que não
controlamos — e é aí que `not_modeled` deixa de ser higiene e vira a parte honesta do
produto.

E ele traz um fenômeno que a CPU didática não tem e que talvez **não caiba** nas
primitivas de hoje: **interrupção**. Controle assíncrono que preempta o que está
acontecendo. Nada no motor hoje interrompe coisa alguma — todo tick roda até o fim. Por
isso é o item mais valioso da lista: é o mais provável de revelar a próxima lacuna real.
Junto vêm periférico mapeado em memória (escrever num endereço faz algo acontecer no
mundo), arquitetura Harvard, e pinos como fronteira de verdade do chip.

### 7.7 O critério de saída

A prova só conta se for verificável, então ela tem forma de teste, não de intenção:

> Um pacote `cpu-domain` que importa **exclusivamente** `depth-core` e `depth-ui`,
> monta um caminho de dados que executa um programa em assembly de verdade, e abre até
> a porta lógica — **sem um commit em `depth-core` feito para atender a CPU**.

Commits em `depth-core` que resolvam L1, L2 e L3 são legítimos e esperados: são lacunas
do motor, encontradas por pressão de um segundo domínio, e é para isso que a pressão
serve. O que reprova a prova é `depth-core` ganhar algo que saiba o que é um
registrador.

Se passar, a fronteira motor↔domínio deixa de ser uma regra que um script defende e
passa a ser um fato demonstrado — e o handbook de OpenTelemetry vira o primeiro
instanciamento de um motor, em vez de um motor que só sabe uma coisa.

---

## 8. Leitura

Dentro do repositório: `DECISIONS.md` (o que foi decidido), `depth.md` (profundidade
como produto), `kinds.md` (o catálogo), `why-simulate.md` (por que simular em vez de
animar), `roadmap.md` (a ordem em que isso é construído).

Fora: Jensen & Kristensen, *Coloured Petri Nets*, para a §2. Ptolemy II (Lee et al.),
para atores hierárquicos e regime de execução por nível — é a referência mais próxima
do que o motor faz de fato. Norris, *Markov Chains*, para a §3. Nenhuma dessas é
pré-requisito para ler o handbook: o handbook ensina OpenTelemetry, não teoria de
simulação. Elas são pré-requisito para **discordar deste documento**, que é uma coisa
diferente.
