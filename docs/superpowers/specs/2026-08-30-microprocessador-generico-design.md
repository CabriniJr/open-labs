# O microprocessador genérico — desenho

**Data:** 2026-08-30.
**Origem:** o deck *Princípio de Funcionamento de um Microprocessador*, de Prof. Filippo
Valiante Filho (`prof.valiante.info`), 45 slides, usado **com permissão do autor**.

## A tese desta rodada

O Luigi nomeou o alvo: *"quero provar que podemos repensar modelos e profundidade
baseado em modelos pré-existentes."*

Então o entregável não é "mais um lab". É uma prova, e ela tem duas metades:

1. **Reinstanciar.** Um modelo que já existe fora daqui — desenhado à mão por um
   professor, em slides — é reconstruído no nosso motor e roda. A fidelidade é
   verificável contra um documento que não controlamos.
2. **Aprofundar.** Onde o modelo original para, o nosso continua. O deck desenha a ULA
   como duas caixas ("Complementador/Deslocador" e "Somador") e não pode abrir mais,
   porque slide não abre. Nós descemos daquelas caixas até o transistor, reusando o que
   já existe.

Se as duas metades fecharem, a frase "o motor instancia modelos de terceiros e lhes dá
profundidade" deixa de ser promessa e vira demonstração.

## O que o deck tem e o nosso modelo não tem

Medido contra `packages/cpu-domain/src/datapath.ts`:

1. **O ciclo de instrução como tempo.** A primeira linha do nosso datapath diz *"um ciclo
   por tick"*. Uma instrução inteira acontece dentro de um tick, e busca / decodificação /
   execução existem só como profundidade topológica da acomodação. O conceito central da
   disciplina — busca e execução como **momentos distintos** — não existe como tempo no
   nosso modelo. No deck existe: 23 instantes para 4 instruções, e cada instante é uma
   transação de barramento.
2. **MAR e MBR.** No deck, a memória é uma conversa: PC → latch de endereços (A0:15) →
   barramento de endereços → READ → latch de dados (D0:7) → IR. No nosso, o barramento é
   `channel` e a memória responde na hora. O deck ainda **argumenta** quais registradores
   são mínimos e por quê (PC e IR controlam o programa, MAR e MBR falam com a memória, AC
   e um auxiliar alimentam a ULA) — argumento que o nosso lab não faz.
3. **Máquina de acumulador.** Um AC, um temporário, H/L. Cabe na cabeça. RV32I tem 32
   registradores e 6 formatos: certo como ISA viva, caro como primeira máquina.
4. **A tabela de tempo** (slide 43): o programa inteiro em uma página, uma linha por
   instante, colunas de controle, barramentos e registradores.

## Decisões

### D1 — Um segundo mundo, não uma conversão

Nasce `micro` (o microprocessador genérico) **ao lado** do RISC-V, não no lugar dele. O
RV32I não é jogado fora: ele ganha sentido por contraste. Ver o ciclo se desdobrar em
instantes e depois ver a mesma coisa acontecer inteira num tick é o que faz "single-cycle"
querer dizer alguma coisa.

### D2 — Fiel ao genérico, estendido no esquema dele

Os opcodes do deck (`86`, `8B`, `B7`) são **inventados de propósito**: o título é literal,
a máquina é genérica. O 8085 real aparece só no slide 44, como ponte no fim. O professor
separou as duas coisas conscientemente, e nós mantemos a separação.

**Núcleo, fiel ao deck** — palavra de 8 bits, endereço de 16:

| Opcode | Formato | Instrução | Efeito |
| --- | --- | --- | --- |
| `86` | 1 (2 bytes) | `LOAD valor` | AC ← valor |
| `8B` | 1 (2 bytes) | `ADD valor` | AC ← AC + valor |
| `B7` | 2 (3 bytes) | `STORE end` | (end) ← AC |

Formato 1 = opcode + valor. Formato 2 = opcode + endereço alto + endereço baixo. São os
dois formatos do slide 15, e nenhum terceiro nasce.

**Extensão mínima**, nos mesmos dois formatos, ocupando códigos livres (o deck diz que os
8 bits de opcode dão 256 instruções, e é esse espaço que ocupamos):

| Opcode | Formato | Instrução | Por que existe |
| --- | --- | --- | --- |
| `A6` | 2 | `LOAD (end)` | sem carregar da memória não há variável, só constante |
| `C3` | 2 | `JMP end` | sem desvio não há laço |
| `CB` | 2 | `JZ end` | desvio condicional; consome o bit Z do status |

Três instruções, todas no formato 2 que já existe. `SUB` **não** entra: `ADD FF` decrementa
em complemento de dois, e o deck já mostra o complementador na ULA. SP e pilha ficam
**declarados e folha** — o deck os lista entre os registradores e não os usa em nenhum
exemplo; nós fazemos igual, e a ficha diz que estão ali sem instrução que os mova.

Os códigos da extensão são arbitrários, como os do deck. A única regra é não colidir, e um
teste cobra a tabela inteira por injetividade.

### D3 — O tick passa a ser uma transação de barramento

No mundo `micro`, **um tick = um micro-passo**: uma transferência entre registradores, que
é o que cada um dos 22 quadros do deck mostra. A instrução deixa de ser a unidade de tempo.

A tabela de tempo (D6) é a granularidade **mais grossa**: uma linha por transação de
barramento, agregando os micro-passos que aconteceram em volta dela. As duas são projeções
do mesmo run, e é justamente por serem duas que a tese da projeção fica provada aqui — o
deck tem as duas e nós temos que ter as duas a partir de um livro-caixa só.

A unidade de controle passa a ter **estado**: uma máquina de fases, na ordem do slide 19.

### D4 — Nasce `kind: "controller"`

`router` não guarda estado. Fazer a UC virar `store` funcionaria e **mentiria na forma** —
o desenho a mostraria como memória, e ela não é.

A dívida já está escrita no topo de `datapath.ts`: *"a unidade de controle é `router`
porque o catálogo de hoje não tem `kind` da família `controller`"*. Este é o momento em que
ela deixa de ser cosmética: agora a UC **precisa** de estado.

`controller`: guarda estado entre ticks, emite por linha de controle (`sigin:`/eixo de
sinal), **não carrega carga**. `validateWorld` recusa `controller` com aresta de dados na
saída — é a regra que impede a UC de virar caminho de dados por acidente.

Este é o retorno de motor da rodada. O RISC-V também passa a usar `controller` na sua UC:
uma família nova que só um mundo usa é um `kind` disfarçado.

### D5 — A profundidade continua onde o slide para

Níveis do mundo `micro`:

| Nível | O que é | Origem |
| --- | --- | --- |
| 1 | Sistema — memórias, CPU, três barramentos | slide 9, redesenhado |
| 2 | CPU — UC + processador | slide 9 |
| 3 | Processador — AC, T, H/L, latches, barramento interno | slide 9 |
| 4 | ULA — complementador/deslocador + somador | slide 9 (é onde ele para) |
| 5 | Somador — os 8 bits, full-adders | **nosso**, reusado |
| 6 | Porta — XOR/AND/OR compostos de NAND/NOR/NOT | **nosso**, reusado |
| 7 | Transistor — redes PMOS/NMOS | **nosso**, reusado |

Os níveis 5–7 vêm de `gates.ts` e `transistors.ts` **sem código novo de domínio**. Se
precisarem de código novo, o reuso não era reuso, e isso é achado, não contratempo.

O somador de 4 bits vira somador de 8 por composição, não por cópia. Se ele não
generalizar, o defeito é dele.

Registro de cor por nível, no catálogo (Entrega 0 do refino gráfico): nos níveis 1–3,
preta é dado e vermelha é controle; do 5 para baixo, vale o registro do esquemático.

### D6 — A tabela de tempo é uma vista, e é o oráculo

O slide 43 vira uma vista do palco: uma linha por **transação de barramento** (não por
tick), colunas **Controle** (READ/WRITE) |
**Barramentos** (endereço, dados) | **Registradores** (PC, IR, AC, T, H, L), e a coluna de
instrução à direita marcando onde cada instrução começa.

Ela é **projeção do mesmo livro-caixa** — derivada de `WorldState` (`settled` mais o
diferencial entre ticks) —, nunca uma segunda contabilidade. As duas metades do invariante,
como sempre: (⊆) a tabela não inventa célula; (⊇) toda transação de barramento aparece
nela, e nenhum micro-passo que mexeu num registrador some na agregação.

**E ela é o oráculo.** A tabela do slide 43 é transcrita para
`packages/cpu-domain/src/oraculo-slide43.ts` e um teste compara a nossa, célula por célula,
para o programa `LOAD 0A / ADD 05 / ADD 12 / STORE 2000`. Divergência é ou defeito nosso ou
divergência deliberada, e deliberada tem que estar escrita ao lado da célula com o motivo.
É a mesma virtude que a F6b (ATmega) ia buscar num datasheet — um degrau antes e de graça.

### D7 — O handbook passa a se chamar pelo que ele é

O handbook tem `id: "riscv"`, `name: "RISC-V Visual Handbook"` e `model: "cpu.model"`. Uma
máquina genérica pré-RISC-V não cabe num handbook chamado RISC-V, e o `model` já dizia a
verdade antes de nós.

Passa a `id: "cpu"`, `name: "CPU Visual Handbook"`, subject `the CPU`. O RISC-V vira o que
sempre foi: **uma** das máquinas dele. Churn confinado a `/handbooks/riscv/*` e à chave de
progresso do mapa, que ganha `:v2` para não ressuscitar progresso de outro mapa.

### D8 — O mapa: a máquina genérica vem antes

A fase 5 do mapa tem um vazio chamado `control-lines` ("The control lines of one opcode").
A UC multiciclo **é** isso, em tempo — então ela não acrescenta um nó, ela preenche um.

Ordem nova:

- Fase 4 — **The instruction cycle**: `labs/micro`, a máquina genérica multiciclo. Novo.
- Fase 5 — **The datapath, all at once**: `labs/cpu`, o RISC-V single-cycle, movido, com a
  linha explicando que ali o ciclo inteiro cabe num tick.
- Anexo novo, pendurado na fase 4: **Generic ISA** (a tabela de opcodes e os dois formatos).

Nenhum placeholder novo nasce; um morre.

### D9 — Os artigos seguem a ordem do deck

1. Structure of a computer — CPU, memory, I/O, buses
2. Buses and the clock — frequency, period, width, and what 16 address lines buy
3. The registers that a computer cannot do without — e o argumento do slide 12
4. From `total = 10 + 5 + 18` to bits — os três níveis de linguagem, slide 14
5. Instruction formats — os dois formatos, e por que 8 bits de opcode dão 256
6. The instruction cycle — busca e execução como momentos, slide 19
7. One program, twenty-three instants — a leitura da tabela de tempo
8. From the generic machine to the 8085 — a ponte do slide 44

Escritos em inglês, como o resto do handbook.

### D10 — Crédito e regra de conteúdo

Página de crédito no handbook e nota no rodapé do lab: **modelo de referência de Prof.
Filippo Valiante Filho, `prof.valiante.info`, usado com permissão.**

A regra de conteúdo muda em relação ao *Learning OpenTelemetry* — e a diferença é a
permissão. Lá o livro dá **só a ordem**, nunca o conteúdo. Aqui a permissão é explícita, e
o que tomamos é a **ordem e a estrutura do modelo**: registradores, barramentos, opcodes,
o programa exemplo, as fases do ciclo. O texto dos artigos continua sendo nosso, escrito do
zero, e toda afirmação técnica se sustenta sozinha — transcrever a prosa dele seria
plágio ainda com permissão.

## O que fica de fora, e por quê

- **Interrupção (INT)** — a linha é desenhada porque o deck a desenha, e não faz nada. É a
  primeira coisa da F6b (ATmega), onde ela é o assunto e não um enfeite.
- **Pilha** — SP existe, folha, sem instrução. Igual ao deck.
- **`SUB`** — `ADD FF` decrementa.
- **ULA de 8 bits em transistores por inteiro** — a fatia desce por **um** caminho, como no
  lab das portas. Os outros bits ficam com o atalho provado por `shortcutDisagreement`.

## Como saber se deu certo

1. O programa do slide 16 roda e a nossa tabela de tempo bate com a do slide 43 — 11
   linhas, célula por célula, sem exceção não documentada.
2. Um programa com laço roda — soma de 1 a N, usando `LOAD (end)`, `ADD FF`, `JZ`, `JMP`.
3. Do bloco `Somador` do nível 4 dá para descer até um transistor, e o caminho tem sete
   níveis.
4. `check-boundaries.mjs` continua verde: `depth-core` não sabe o que é MAR, fase de busca
   ou acumulador.
5. `kind: "controller"` é usado pelos **dois** mundos.
6. Um teste de mutação: apagar a guarda que recusa `controller` com aresta de dados na
   saída quebra a suíte.
7. O espaguete do lab `micro` fica dentro do teto, com zero sobreposição cega.
