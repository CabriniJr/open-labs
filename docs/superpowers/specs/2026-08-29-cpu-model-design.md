# O `.model` da CPU — desenho

**Data:** 2026-08-29
**Fase:** F6 do `roadmap.md` — a fase em que o motor amadurece.
**Depende de:** `theory.md` §7 (por que a CPU), `DECISIONS.md` (famílias e linhas),
`kinds.md` (catálogo), `model-format.md` (o formato), `depth.md` (profundidade).
**Precedência:** `docs/DECISIONS.md` → spec do motor composicional → **esta spec** → planos.

Uma CPU RISC-V RV32I de ciclo único, programável em assembly na própria página, com
profundidade em oito níveis e descida completa até o transistor por uma fatia vertical.
Conferida instrução a instrução contra um emulador independente.

Ela existe por dois motivos, nesta ordem: **amadurecer o motor** — é o alvo mais distante
que ainda cabe nas primitivas, e por isso o que mais pressiona a abstração — e **servir de
material de aula** para as turmas de arquitetura de computadores do pai do Luigi.

---

## 1. Escopo

**Está aqui:** caminho de dados de ciclo único; subconjunto de RV32I; unidade de controle
como `controller`; banco de registradores; ULA; memória; montador de assembly na página;
oito níveis de profundidade com uma fatia descendo até o transistor; **views**; teste
diferencial contra emulador de terceiro.

**Não está aqui, e é declarado:** pipeline, múltiplos ciclos, cache, interrupção,
periférico, ATmega. O **pipeline** fica declarado como segunda etapa da F6 — o desenho de
agora não pode fechar a porta dele, porque ele é barato depois (registrador de estágio é
`buffer` de capacidade 1, e stall é backpressure, que já existirão).

### 1.1 Decisões tomadas antes de escrever

Cada uma com a alternativa recusada, porque decisão sem alternativa é preferência
disfarçada.

| Decisão | Alternativa recusada, e por quê |
|---|---|
| **RV32I** | ISA inventada por nós — a verdade de campo voltaria a ser nós mesmos. AVR — irregular, e some o contraste von Neumann × Harvard que a F6b ganha de graça. MIPS — especificação não é abertamente licenciada |
| **Ciclo único** | Múltiplos ciclos e pipeline exigiriam FSM ou hazard antes de as fases do tick estarem provadas. E ciclo único é o caso mais puro das fases: quase tudo é acomodação, só registrador e memória são confronto |
| **Fatia vertical** | Oito níveis em tudo é uma ordem de grandeza a mais de desenho, quase todo cópia. Parar na ULA perderia o nível que explica por que combinacional não é instantâneo |
| **Teste diferencial** | Traços escritos por nós — modelo que só concorda consigo não pode ser contrariado |
| **View híbrida** | Layout 100% autorado deixa nível novo sem desenho; 100% automático não produz nada parecido com um diagrama de arquitetura de verdade |

---

## 2. Arquitetura e fronteira

Um pacote novo, `packages/cpu-domain` (`@ovh/cpu-domain`): o `.model`, os modelets, as
views e o montador. **É o único lugar do repositório que pode saber o que é um
registrador.**

Ele consome `depth-core`, `depth-ui` e `@ovh/model-format` e **não os altera por motivo de
CPU**. Mudança no motor entra só se for expressável sem vocabulário de domínio — e as cinco
da §3 são todas assim.

**A guarda de fronteira ganha uma segunda lista.** Hoje `scripts/check-boundaries.mjs`
proíbe vocabulário de OpenTelemetry e de protocolo dentro do motor. Passa a proibir também
vocabulário de CPU: `registrador`/`register`, `opcode`, `ula`/`alu`, `instrução`, `assembly`,
`transistor`, `riscv`. Sem isso, "o motor é agnóstico" volta a ser disciplina em vez de
fato — e agora há dois domínios para provar que não é.

Lembrete que já custou caro: **a guarda é literal e não entende negação.** Um comentário
dizendo "o motor não sabe o que é um registrador" quebra a guarda.

---

## 3. As cinco mudanças de contrato do motor

Todas em `depth-core`/`depth-ui`, sem uma linha de vocabulário de CPU, e **todas antes dos
modelets**. É assim que o risco de escopo se paga: não por spec separada, mas por ordem.
Descobrir a terceira mudança de contrato com vinte modelets escritos é o retrabalho que a
F1 existe para evitar.

### 3.1 Linha de controle com semântica

Hoje `Wire.line: "control"` existe e `resolveTarget` a ignora: a linha é desenho. No
diagrama de referência da CPU, **metade das setas é vermelha** — é a unidade de controle
mandando em todo mundo.

- Um ator passa a receber, além da caixa de carga, os **sinais** que chegaram nas linhas de
  controle **naquele tick**.
- Sinal é contado no livro-caixa em chave própria (`sig:${id}.${porta}`), **nunca** somado
  ao tráfego de carga. Se as duas contagens se misturassem, a pergunta "quanto dado passou
  aqui?" deixaria de ter resposta.
- Sinal **não** entra em `boundaryCrossings` como carga. A vista agregada continua sendo
  sobre carga; controle é uma camada visual própria (traço fino), que se pode acender e
  apagar.
- `resolveTarget` continua ignorando controle. A entrega de sinal é um caminho separado,
  de propósito: misturar os dois faria "por onde a carga passa?" deixar de se responder
  olhando o desenho.

### 3.2 Fases do tick

Um tick passa a ter duas fases:

1. **Acomodação.** As arestas marcadas como combinacionais propagam repetidamente até o
   **ponto fixo** — nenhum valor muda mais. Não custa tick.
2. **Confronto.** O que atravessa aresta registrada é entregue, e o tick fecha.

`Wire` ganha `timing: "settle" | "clocked"`, com `"clocked"` como padrão — mundo que existe
hoje não muda de comportamento.

Quatro obrigações que fazem parte do desenho, não são descobertas depois:

- **Laço combinacional é recusado em `validateWorld`, nomeando o ciclo.** Em hardware é erro
  de projeto; aqui seria ponto fixo que não converge. Um teto de iterações seria a mentira
  silenciosa de novo — validar onde a violação vira impossível, não improvável.
- **A acomodação acontece dentro de `stepWorld`.** Se vazasse, o `seek` deixaria de ser
  exato, que é o preço que este projeto não paga.
- **O ponto fixo não depende da ordem.** Property test: acomodar os atores em ordem
  sorteada dá o mesmo estado final. Sem isso, dois runs com a mesma semente divergem.
- **A acomodação é visível como subpassos dentro do tick.** O mínimo de `edgeTicks: 1`
  existe porque travessia de custo zero sumiria da tela; com fases, o que sumiria é a
  acomodação, e a resposta é mostrá-la, não escondê-la. É um **eixo de profundidade no
  tempo**, irmão do eixo no espaço — e é o que nenhum diagrama de CPU consegue mostrar.

### 3.3 Fan-out nativo na porta, e o fim do `tee`

Hoje `resolveTarget` devolve o primeiro fio que casa com `(from, port)`; desde `f281ece`,
um segundo fio é **recusado** em vez de silenciosamente ignorado. Numa CPU isso não se
sustenta: a saída de um registrador alimenta a ULA *e* o comparador de desvio, e um sinal
de controle aciona vários muxes.

Fan-out passa a ser **nativo**: `n` fios saindo de uma porta entregam `n` cópias, cada uma
um item em trânsito com id próprio. Contabilidade: `out:` conta **uma emissão**; cada
destino conta o seu `in:`. As duas contagens divergirem é o esperado, e é informação — é
quanto a saída se espalhou.

**Consequência: o `tee` sai do catálogo de arquétipos.** Ele seria um segundo mecanismo
para o mesmo fenômeno, e a F1 diz explicitamente para não ter dois. Num esquemático,
desenhar um bloco em cada junção de fio destruiria o desenho. A régua do projeto —
arquétipo entra pagando em dois alvos — o reprova: ele não paga em nenhum agora que a
junção é nativa. `kinds.md` registra a remoção com este motivo.

### 3.4 Multiplicidade

Duas grandezas distintas, que o desenho de circuito separa há décadas e que ensinam coisas
diferentes:

| Marca | O que é | Onde |
|---|---|---|
| **`×N`** | N objetos idênticos, um desenhado. Contorno empilhado com o número | `ObjectSpec.replicas` |
| **`/N`** | Uma linha que carrega N vias em paralelo | `Wire.width` |

Réplica ensina que hardware é cópia; largura ensina que uma "linha" no desenho é um feixe.
Um leitor que vê `/32` entrando num bloco `×32` entendeu, sem texto, por que somar dois
números de 32 bits custa 32 vezes um somador de 1 bit.

**Isto não é atalho de modelagem.** Os N são modelados de verdade, todos iguais porque são
o mesmo modelet instanciado N vezes. O que a "fatia vertical" corta é **quanto se desenha
aberto** — e abrir é navegação, não modelagem. A marca existe para dizer isso ao leitor em
vez de deixá-lo deduzir.

Não é vocabulário de CPU: em OpenTelemetry a mesma marca diz `×N` exportadores, `/N`
pipelines paralelos.

### 3.5 Atalho com equivalência provada

Uma cadeia de 32 somadores completos, cada um com cinco portas, é ~200 folhas por somador —
e a acomodação de uma cadeia de vai-um de 32 bits é o pior caso possível do ponto fixo.

Um objeto composto pode declarar um **atalho de execução**: uma função que produz o mesmo
resultado que rodar os filhos. Quando ninguém está olhando dentro, roda o atalho.

O que impede a mentira **não** é boa intenção:

> **Um atalho só é legítimo se existir um teste que prove que ele concorda com a
> composição.** O teste roda os dois — atalho e filhos — sobre entradas sorteadas
> (`fast-check`) e compara saída **e** tráfego de porta na fronteira. Sem esse teste, o
> objeto não compila com atalho.

Foi recusada a alternativa óbvia — "só simula o que está aberto" —, e vale registrar por
quê: ela faria a resposta do modelo depender do que o leitor abriu. A vista deixaria de ser
projeção do mesmo run e passaria a ser **outro run**, que é a violação central deste
projeto.

---

## 4. Views

**Uma view é um objeto que guarda a disposição inicial dos objetos de um foco.** Inicial: o
leitor arrasta o que quiser depois, e isso é estado dele (`localStorage`), não do modelo.

Ela existe porque o diferencial do produto é ser **explorável e funcionando em tempo real**
com a densidade e a legibilidade de um diagrama de arquitetura de verdade — grupos coloridos
aninhados, larguras rotuladas, canais nomeados, cem caixas ainda legíveis. Layout automático
não produz isso: ele não sabe que a ULA fica no meio nem que as linhas de controle descem da
unidade de controle.

### 4.1 O invariante que impede a view de mentir

Esta é a parte perigosa da spec. A regra central do projeto é que o desenho é projeção do
run e não consegue mentir; **uma view autorada é exatamente por onde a mentira entraria** —
uma caixa a mais, um fio esquecido, e o diagrama fica lindo e falso.

> **A view decide onde as coisas ficam e como parecem. Nunca o que existe, nem o que liga
> em quê.**

E vira teste, com igualdade e não inclusão — a lição que já custou caro duas vezes aqui:

- **A view não inventa:** todo nó e todo fio citado na view existe no modelo, naquele foco.
- **A view não esconde:** todo nó e todo fio do foco aparece na view **ou** está declarado
  `collapsed`. Declarado, não omitido — silêncio e decisão são coisas diferentes, como
  `.unwired` e `@drop`.

O segundo é o que de fato pega erro, e é o que faltaria numa implementação apressada.

### 4.2 O que uma view carrega

| Campo | O que faz |
|---|---|
| `focus` | O objeto cujo interior esta view arruma |
| `nodes[id]` | Posição inicial, tamanho, e `collapsed` |
| `groups` | Agrupamentos visuais com rótulo e cor de família — as caixas coloridas aninhadas |
| `edges[id]` | Rota preferida, lado de saída e de chegada, rótulo (`32B`, `QPI`) |
| `channels` | Nome e tipo do canal na aresta |
| `density` | Quanto rótulo mostrar. Cem caixas legíveis é design, não sorte |

Tudo é opcional: **quem não sobrepõe nada já tem um diagrama que funciona**, vindo do dagre.
Com oito níveis vezes muitos blocos, view obrigatória seria a dívida que trava a fase.

### 4.3 Onde a view vive

O **mecanismo** de view é agnóstico e mora em `depth-ui`; as views **da CPU** moram em
`cpu-domain`. Cor de família e vocabulário de forma continuam pertencendo ao `Kind`, nunca
ao objeto — a view escolhe o tom do grupo, não inventa uma linguagem visual nova por
diagrama.

### 4.4 Risco de motor gráfico

`@xyflow/react` (já escolhido em `stack.md`) tem nós aninhados e dá conta da densidade das
imagens de referência. **O nível do transistor pode não caber nele** — dezenas de elementos
minúsculos com animação contínua. Se não couber, aquele nível desce para canvas, com a mesma
interface de foco. Decidir isso medindo, e não antes.

---

## 5. A árvore

```
sistema                    entrada · saída · CPU · memória principal
  CPU                      unidade de controle (controller) · decodificador · processador
    processador            PC · banco de registradores · lógica combinacional
      lógica combinacional ULA · muxes de operando · extensor de imediato
        ULA                somador de 32 bits · unidade lógica · deslocador · mux de operação
          somador          cadeia de somadores completos            ×32
            somador completo  2 XOR · 2 AND · 1 OR        ← a fatia desce por um deles
              XOR             transistores
```

Três escolhas de modelagem que não são óbvias:

- **O banco de registradores é ator que responde a pedido de leitura.** É assim que "ler sem
  consumir" se resolve sem nenhum ator espiar o estado de outro — a regra estrutural
  sobrevive intacta. Com fases do tick, a leitura acontece na acomodação e não custa ciclo,
  que é o comportamento real.
- **A unidade de controle é `controller` puro.** Manda em todo mundo pelas linhas de
  controle e nunca recebe carga. É o caso mais puro da família que existe.
- **A memória principal está fora da CPU**, como no diagrama de referência. Ela é ator
  endereçado; disputa de acesso é `arbiter` quando houver mais de um pedinte — hoje não há.

---

## 6. A entrada: assembly

Editor de assembly na página → montador em JavaScript → imagem de memória → **mundo novo no
tick 0**.

**Programa não é parâmetro.** Mudar um parâmetro é evento no tempo e o mundo reage de onde
está; mudar o programa é outro mundo. Tratá-lo como parâmetro faria o `seek` para trás
atravessar uma fronteira que não existe — antes do tick 0 daquele programa não há passado.

O montador aceita o subconjunto: `add sub and or xor sll srl sra slt`, `addi andi ori xori
slli srli srai slti`, `lw sw`, `beq bne blt bge`, `jal jalr`, `lui auipc`. Rótulos e
comentários. Erro de montagem aponta **linha e coluna**, com a mensagem em português.

Simetria que vale registrar: **assembly está para o lab da CPU como a configuração do SDK
está para o lab de OpenTelemetry** — configuração real e verificável como fonte da verdade,
e o modelo é a compilação dela. Que a mesma forma apareça em dois domínios sem combinação
prévia é o melhor indício de que ela é a forma certa. Valida a E3 de fora.

---

## 7. Fidelidade

Teste diferencial contra um emulador RV32I independente. O mesmo programa nos dois e, depois
de **cada instrução**, comparam-se `x0`–`x31`, o `pc` e a memória tocada. Divergiu, o teste
diz em que instrução, em que registrador, e o que cada lado achava.

Requisitos duros:

- **Licença permissiva verificada antes de entrar**, e registrada em `stack.md`, como todas
  as outras dependências.
- O emulador é **dependência de teste**, nunca de runtime. Ele não vai para o navegador.
- Os programas do diferencial incluem, no mínimo: aritmética com estouro, desvio tomado e
  não tomado, `lw`/`sw` com deslocamento, `jal`/`jalr`, `x0` como destino (que descarta), e
  um laço que termina.

`x0` merece nota: escrever nele é legal e não tem efeito. É a única instrução do subconjunto
cujo comportamento correto **é** não fazer nada, e por isso o primeiro lugar onde um modelo
apressado erra.

---

## 8. Testes e critério de saída

| O que | Como |
|---|---|
| Fases do tick | Ponto fixo independe da ordem (property test); laço combinacional recusado com o ciclo nomeado |
| Linha de controle | Sinal muda a decisão no mesmo tick e aparece no livro-caixa, sem nunca contar como carga |
| Fan-out | `n` fios entregam `n` cópias; `out:` conta uma emissão e cada destino conta o seu `in:` |
| Atalho | Concorda com a composição sobre entradas sorteadas, em saída **e** tráfego de fronteira |
| View | Não inventa **e** não esconde: igualdade contra o modelo, com `collapsed` declarado |
| CPU | Diferencial instrução a instrução contra emulador independente |
| Fronteira | `pnpm boundaries` com as duas listas, e falhando se ler zero arquivo |

**Critério de saída da F6**, que é também o critério de reentrada do OTel:

> As cinco mudanças da §3 fechadas, **e** `cpu-domain` executando um programa de verdade,
> conferido contra o emulador, **sem que `depth-core` tenha ganhado uma linha que saiba o
> que é um registrador**.

Commits em `depth-core` fechando as cinco lacunas contam a favor. Vocabulário de CPU dentro
dele reprova. E a hora de parar é a hora em que a próxima tarefa da CPU não ensina mais nada
ao motor — isso é sinal na tabela do `roadmap.md`, não força de vontade.

---

## 9. O que não é modelado, declarado

Cache. Exceção, trap e `ecall`. CSR e níveis de privilégio. Multiplicação e divisão (a
extensão M). Atômicos. Acesso desalinhado. Tempo real de porta — só atraso lógico contado em
passos de acomodação. Eletrônica analógica: **transistor conduz ou corta**, sem curva
característica, sem corrente, sem temperatura.

O nível do transistor ensina construção de porta lógica e ensina atraso. Não ensina projeto
de circuito, e o texto diz isso onde o leitor chega, não num rodapé.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **A CPU vira o produto** e o projeto troca de identidade sem decidir trocar | O critério de reentrada da §8, e o sinal "tarefa que não ensina nada ao motor" no roadmap |
| Acomodação até ponto fixo numa cadeia de vai-um de 32 bits fica lenta | O atalho provado da §3.5 existe exatamente para isso; e ele é medido, não presumido |
| Fan-out nativo quebra a contabilidade dos medidores | `out:` conta emissão, `in:` conta entrega. A divergência entre as duas é informação, e tem teste |
| Nível do transistor não cabe no motor gráfico | §4.4: aquele nível desce para canvas, com a mesma interface de foco |
| View autorada desatualiza quando o modelo muda | O teste de igualdade da §4.1 quebra o build. É por isso que ele é de igualdade |
| Matar o `tee` se mostrar errado num alvo futuro | Ele volta pagando em dois alvos, como qualquer arquétipo. A remoção fica registrada com o motivo, não apagada |

---

## 11. Ordem de construção

Cada bloco vira um plano seu, e cada um entrega software funcionando:

1. **Motor: fases do tick e linha de controle.** As duas mudanças mais profundas, com a
   validação de laço combinacional. Nenhuma linha de CPU.
2. **Motor: fan-out, multiplicidade e atalho provado.** Fecha o contrato. `tee` sai do
   catálogo.
3. **Views.** Mecanismo em `depth-ui`, com o teste de igualdade contra o modelo.
4. **CPU: caminho de dados até a ULA.** Os quatro primeiros níveis, executando `add` e
   `addi`. Já dá para o diferencial começar.
5. **CPU: montador e o subconjunto inteiro.** Diferencial completo.
6. **CPU: a fatia vertical.** Somador aberto, somador completo, portas, transistores.
7. **Views da CPU e acabamento.** A densidade e a beleza das imagens de referência.

Os três primeiros são o motor amadurecendo, que é o motivo declarado desta fase. Do quarto
em diante é domínio — e se o motor estiver certo, essa parte é composição, não invenção.
