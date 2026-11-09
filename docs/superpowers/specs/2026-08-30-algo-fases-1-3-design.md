# Handbook de algoritmos: fases 1 e 3

> **Recuperado em 2026-11-09.** Este arquivo foi escrito em 2026-08-30 numa sessão local
> (commit `2f3bff8`, branch `algo-fases-1-3`, worktree `~/projetos/ovh-algo`) que nunca foi
> enviada ao GitHub. O texto abaixo é o original, reconstituído do transcript da sessão.
> Nada do que ele descreve (labs `fifo`, `hash`, `sorting`) foi implementado no `main` ainda.

**Status:** aprovado no brainstorm de 2026-08-30.
**Depende de:** `kinds.md`, `depth.md`, e o `algo.model` já no ar (`rpn`).
**Entrega:** três labs (`fifo`, `hash`, `sorting`) e três artigos.

O terceiro handbook tem uma fase pronta pela metade: a pilha roda no lab `rpn`, e o
resto do caminho está declarado e vazio. Esta spec fecha **a fase 1** (o que guarda o
dado) e **a fase 3** (ordenação). As fases 4 e 5 continuam declaradas e não andadas.

---

## 1. O princípio que ordenou todas as decisões abaixo

**Domínios compartilham `kind`. O que muda de um para o outro é a instância e a
configuração — nunca o contrato.**

É isso que faz o motor não saber qual é o assunto, e é por isso que o mesmo `router`
serve o datapath do RISC-V e a função hash daqui. O erro que esta spec evita não é
reusar arquétipo: é **esticar** um. Um `transform` afirma que a carga muda de forma na
saída dele (§7.4 da visão, e o property test do §1.2 de `kinds.md`); usar `transform`
onde a carga não muda faz o teste passar mentindo, porque ele confere contra o kind
declarado.

A primeira versão deste desenho tinha quatro atribuições esticadas. Ficam registradas
porque redescobri-las custa caro:

| Peça | O que eu tinha escrito | Por que não passa |
|---|---|---|
| A fila | `store` | O catálogo separa três verbos: buffer é **consumido**, log é **percorrido**, store é **consultado**. FIFO é consumida. `store` entrou por ser o kind novo |
| A função hash | `transform` | Ela não muda a chave — a chave chega inteira no balde. Ela escolhe um **destino** |
| O comparador | `router` | Um router encaminha a carga; ele emitiria um veredito, que é sinal. Não é peça: comparar é o que o controlador faz com a resposta da consulta |
| O permutador e o descarte | caixas | Trocar é **escrita** no store, e descartar é a **porta de descarte** que a família Processador já define. Duas caixas que eram portas |

---

## 2. Fase 1, lab `fifo` — a fila

**Tese:** uma fila não é uma estrutura, é uma política — e a política só aparece quando
ela enche.

| Peça | `kind` | Papel |
|---|---|---|
| `gerador` | `source` | Emite itens num ritmo que o leitor ajusta |
| `fila` | `buffer` | Retém o que ainda não foi consumido. Capacidade e política de recusa como parâmetros. O que ela recusa sai pela **porta de descarte** |
| `consumidor` | `sink` | Consome num ritmo que o leitor ajusta |
| `medidor` | `static` | Ocupação, recusados, e o mais antigo ainda dentro |

**Duas manoplas:** ritmo de entrada e ritmo de saída. **Um seletor:** a política —
bloqueia, descarta o novo, descarta o velho.

**A ocupação é peso, não contagem.** `Message.weight` existe no motor e nunca foi
usado; a fila é o lugar natural dele. É o que separa "dez itens" de "dez megabytes",
e é a diferença que faz alguém dimensionar uma fila errado na vida real.

## 3. Fase 1, lab `hash` — a tabela

**Tese:** a tabela não procura rápido. Ela calcula onde já era.

| Peça | `kind` | Papel |
|---|---|---|
| `chaves` | `store` | A fita de chaves a inserir. Anda quando pedem, como a `fita` do `rpn` |
| `esteira` | `channel` | Transporta e não altera |
| `funcao` | `router` | **Uma entrada, N saídas.** A chave entra inteira e sai inteira; o que a função decide é **por qual saída** |
| `balde-0..N` | `store` | Uma caixa por balde. O que cada uma guarda aparece dentro dela |
| `visor` | `sink` | O que foi inserido, e onde |

**A manopla:** quantos baldes (4 ou 8). Reduzir os baldes com a mesma carga faz a
corrente crescer **dentro das caixas** — fator de carga na tela, sem parágrafo. A
colisão não precisa de peça: é um balde com mais de uma chave.

`partition` (§9.6 de `kinds.md`, "a mesma chave sempre na mesma saída") seria o nome
exato, e não está no motor. `router` com N saídas cumpre o contrato sem esticá-lo, e
`partition` continua na onda 4 como estava.

## 4. Fase 3, lab `sorting` — a ordenação

**Tese:** o que separa dois algoritmos de ordenação não é a operação. É **quem decide o
próximo par**.

| Peça | `kind` | Papel |
|---|---|---|
| `estante` | `store` | O vetor. Lido sem retirar; escrito pela porta de escrita. O par em foco fica marcado |
| `controlador` | `router` | Decide o próximo par a partir do que voltou. **É a única peça que troca** |
| `auxiliar` | `store` | Vazia em tudo menos no merge |
| `contador` | `static` | Comparações e trocas |

**Quatro configurações do mesmo controlador:** bolha, inserção, seleção, merge. A vista
é uma só, e o algoritmo é um seletor — a comparação é o que se aprende aqui, e ela se
perde se cada algoritmo tiver a sua página.

**A fita auxiliar fica vazia e visível nos três primeiros, e enche no merge.** O leitor
vê o merge comprando tempo com espaço sem que ninguém escreva isso num parágrafo.

**Folga declarada.** Nenhum dos oito arquétipos descreve "decide o próximo par". O
controlador recebe carga (os valores lidos) e emite carga (a escrita), então é
Processador de fluxo, e `router` é a aproximação menos ruim entre os oito. Fica escrito
aqui onde ela aperta, como o catálogo faz com as próprias lacunas. Se um quarto
domínio pedir a mesma peça, aí há evidência para propor arquétipo — um caso não é
evidência.

## 5. O compasso

O mesmo do `rpn`, e de propósito: **a peça pede o próximo trabalho quando termina o
anterior.** Nada de `setTimeout`; o ritmo sai do trabalho.

Na ordenação: o controlador consulta a estante → a estante responde no `settle` (ler
não consome nem custa ciclo) → o controlador decide → a escrita volta em `clocked`, que
é o que impede o laço estante → controlador → estante de ser combinacional. O pedido do
próximo par é **linha de controle**: sinal, não carga, e por isso não entra no
livro-caixa. É o que mantém o contador de trocas honesto sozinho.

## 6. Recusas

O padrão do `lerExpressao`: recusar **onde a violação deixa de ser possível**, e não
onde ela trava a máquina calada. Um travamento silencioso é a pior coisa que este
projeto pode produzir.

| Lab | Recusado na leitura | Mensagem diz |
|---|---|---|
| `fifo` | capacidade zero; ritmo zero nos dois lados | o que ficaria impossível |
| `hash` | chave vazia; chave repetida | a posição, contando de 1 |
| `sorting` | vetor vazio; item não numérico; vetor maior do que a vista comporta | a posição e o limite |

Descarte na fila **não é erro**: é resultado legítimo da política, e aparece no medidor.

## 7. Testes

**Diferencial contra a conta escrita de um jeito só** — o que sustenta o `rpn` sustenta
estes:

- `fifo`: contra uma simulação direta da fila, para cada política
- `hash`: contra um `Map`, mais a distribuição pelos baldes
- `sorting`: cada configuração contra `[...v].sort()`, mais a contagem contra caso
  conhecido — bolha em vetor já ordenado dá n−1 comparações e zero trocas, e o pior
  caso dá o que a fórmula diz

**Property test de permutação:** a estante, em **qualquer** tick, é uma permutação da
entrada. É a invariante capaz de pegar erro de compasso — a armadilha desta família, e
a que sai errada em silêncio.

**`viewDisagreement`** nas vistas novas, como nas setenta e seis do RISC-V.

**e2e:** as três rotas entram na constante `LABS` de `apps/site/tests/desenho.spec.ts`,
que confere a invariante *um fio só toca as duas caixas que ele liga*. Se ela reprovar,
é o desenho que está mentindo, não o teste.

## 8. O que muda fora do `algo-domain`

Só o site, e só acrescentando:

- `apps/site/src/data/handbooks.ts`: `fifo` e `sorting` passam de `coming` para
  `available` com `href`; entra o lab `hash` e o artigo dele. **A entrada do handbook
  não é recriada** — ela já existe
- três páginas em `apps/site/src/pages/labs/`, três componentes, três artigos
- specs novas em `apps/site/tests/`

**Nada em `depth-core` nem em `depth-ui`.** Os dois estão sendo mexidos por outra
sessão, e nenhuma decisão acima precisa deles.

## 9. Idioma

Rótulo de modelo passa por `labels.ts`, em inglês, com a guarda por caractere acentuado.
Comentário e identificador seguem em português: não são lidos por quem visita o site.
