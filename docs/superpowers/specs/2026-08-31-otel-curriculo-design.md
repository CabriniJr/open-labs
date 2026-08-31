# O currículo do `otel.model` — a trilha e os artigos

**Data:** 2026-08-31.
**Handbook:** `otel.model`.
**Precedência:** a spec do handbook
(`superpowers/specs/2026-08-28-otel-visual-handbook-design.md`) manda no currículo e no
conteúdo. Este documento a **completa**, não a substitui: as cinco fases, a ordem que vem
do livro e as regras de fonte continuam valendo palavra por palavra.
**Irmão:** `2026-08-31-provedores-otel-design.md`, que desenha o primeiro lab. Ele nasceu
antes deste e é a razão de o nó `providers` existir na trilha.

---

## 1. O que estava faltando

Medido em 31/08/2026, antes deste round:

| | tinha | e isso significava |
| --- | --- | --- |
| labs | 13 títulos, todos `coming` | a trilha existia |
| artigos | 5 títulos, um por fase, todos `coming` | **a teoria não existia** |
| anexos | 3 de 5 planejados na spec §5 | o acervo estava pela metade |

Cinco títulos não são um currículo. Um artigo por fase quer dizer que os quatro ou cinco
conceitos independentes de uma fase caberiam num texto só — e o texto que tenta isso é o
que ninguém termina. O handbook tem três partes por definição (roadmap · artigos · labs) e
uma delas era uma promessa de uma linha.

E a trilha tinha três buracos de conteúdo, não de quantidade:

1. **A fase 2 modelava um sinal só.** Três nós de trace, zero de métrica, zero de log. A
   fase 1 promete que os três soltos não são observabilidade; a fase seguinte então
   modelava exatamente um deles. O currículo repetia o erro que o handbook existe para
   desfazer.
2. **A fase 3 começava no Collector.** Perguntar "o que o Collector muda?" antes de o
   leitor saber quem decidiu o que sai do processo é perguntar na ordem errada. O nó
   `providers` preenche isso, e é o assunto da spec irmã.
3. **A fase 4 não propagava por fila.** Contexto atravessa HTTP porque alguém escreveu o
   cabeçalho; atravessa fila porque alguém escreveu o cabeçalho **e** decidiu entre pai e
   link. É a lacuna que mais aparece em produção — o trace morre no `send` e reaparece
   órfão no `consume` — e não tinha nó.
4. **A fase 5 falava de custo e não tinha nó de custo.** A pergunta da fase, na spec §3,
   inclui custo literalmente. Cardinalidade é onde o custo mora, e ela é decisão de
   atributo: toma-se na instrumentação e paga-se na fatura, meses depois.

---

## 2. A trilha completa

Dezoito labs, cinco anexos. Todos `coming` — nenhum lab do OTel está no ar, e anunciar o
contrário é o defeito que o teste do catálogo mata.

### Fase 1 — The Problem

| Lab | A pergunta que ele responde |
| --- | --- |
| `three-pillars` | O que cada sinal se recusa a lembrar, e por que a recusa é irreversível |
| `disconnected-signals` | Quanto custa uma costura: o gráfico sobe e não há caminho dele até uma requisição |

### Fase 2 — The Model

| Lab | A pergunta |
| --- | --- |
| `anatomy-of-a-trace` | Como uma árvore que ninguém possui se monta a partir de partes que só conhecem o pai |
| `hard-context-and-baggage` | O que atravessa a fronteira por obrigação e o que atravessa por escolha |
| `reading-an-otlp-payload` | Onde cada campo mora, e o que a posição dele diz sobre quem o possui |
| **`the-shape-of-a-metric`** *(novo)* | Instrumento, agregação, temporalidade — e por que delta e cumulativo não são a mesma série com outro nome |
| **`a-log-that-knows-its-trace`** *(novo)* | O que um registro carrega para deixar de ser uma linha solta |

### Fase 3 — The Architecture

| Lab | A pergunta |
| --- | --- |
| **`providers`** *(novo)* | Você chamou `startSpan`. Quem decide se aquilo sai do processo? |
| `collector-pipeline` | O que um componente fora do processo pode mudar no que já foi enviado |
| `agent-or-gateway` | Onde ele roda, e qual é o raio de explosão de cada resposta |

`providers` está sozinho na primeira fileira: os dois abaixo dependem dele.

### Fase 4 — Instrumentation

| Lab | A pergunta |
| --- | --- |
| `manual-spans` | O que você escreve à mão, e o que nunca deveria escrever à mão |
| `zero-code-instrumentation` | O que aparece sem você pedir, e o que isso lhe custa em controle |
| **`propagating-through-a-queue`** *(novo)* | Produtor e consumidor não compartilham pilha. Pai ou link? |
| `host-and-kubernetes-signals` | De onde vem o sinal que nenhuma aplicação emitiu |

### Fase 5 — Operating at Scale

| Lab | A pergunta |
| --- | --- |
| `head-vs-tail-sampling` | Duas decisões em duas posições de uma via de mão única |
| `backpressure-and-drops` | O que acontece quando a saída fecha e a fila não |
| **`cardinality-and-the-bill`** *(novo)* | Um atributo a mais, e a conta de um ano |
| `the-rollout` | Como isto entra numa organização sem acordar ninguém |

### O acervo The Wire

Cinco anexos. Anexo **não é etapa**: é referência que vários labs puxam, e pendura por
aresta tracejada em vez de entrar na espinha.

| Anexo | Puxado por | Por que é anexo e não lab |
| --- | --- | --- |
| `w3c-trace-context` | anatomy, propagação, sampling | o cabeçalho reaparece em quatro fases |
| `otlp` | payload, collector, exportação | o envelope é referência, não etapa |
| **`protobuf-encoding`** *(novo)* | payload, wire, collector | responde "por que o `tcpdump` não mostra nada disso" |
| `grpc-http2` | collector, backpressure | o transporte é o mesmo em três labs |
| **`semantic-conventions`** *(novo)* | toda a fase 4, e a fase 5 inteira | é o vocabulário que toda instrumentação usa. Nenhum lab é *sobre* ele, e todos dependem dele — que é a definição de anexo |

**`otlp-http-vs-grpc` não nasce como anexo separado**, contra a lista da spec §5. Ele é uma
seção do anexo `otlp`: a escolha entre os dois transportes não tem mecanismo próprio, tem
consequência própria. Anexo que só existe para comparar dois outros é índice, não peça.

### A régua do mapa, escrita para não ser adivinhada

O `y` de cada nó não é gosto. A aritmética está no `roadmap.ts` e é cobrada:

- a primeira fileira de uma fase fica em `fase.y + 66`
- cada fileira seguinte, `+56`
- a fase seguinte começa `+68` depois da última fileira da anterior
- a altura do mapa é a última fileira `+56`

Sem a régua escrita, o próximo nó entra num `y` plausível e o mapa passa a ter dois
espaçamentos — o defeito que ninguém vê e ninguém conserta. `MAP_HEIGHT` foi de 870 para
982 e `spineBottom` de 814 para 926, porque a fase 2 ganhou uma fileira e a 3, a 4 e a 5
desceram.

---

## 3. Os artigos

Quatorze, e a regra de pareamento é a que decide se um artigo entra:

> **Um artigo é a teoria de um lab, ou é o degrau que dois labs pisam.**

Artigo sem nenhuma das duas coisas é ensaio solto. É o que impede a camada de teoria de
crescer sozinha até virar um blog pendurado num handbook.

### Fase 1

| Artigo | A tese em uma linha |
| --- | --- |
| **`what-a-signal-is`** ✅ escrito | Um sinal não é um tipo de dado: é a decisão sobre o que jogar fora na escrita, e o que se joga fora ali é o que não se pode pedir depois |
| `the-seam-between-signals` | A dificuldade não está em nenhum dos três — está na junta, e junta não é coisa que diagrama mostre |

### Fase 2

| Artigo | A tese |
| --- | --- |
| `a-trace-is-a-tree-nobody-owns` | Nenhum componente tem a árvore inteira; ela existe porque cada parte carrega o pai. Logo o trace é uma afirmação sobre causalidade, e ninguém é dono dela |
| `context-is-the-product` | O que o OpenTelemetry entrega não é span nem métrica: é a única coisa que é a mesma nos três |
| `what-a-metric-remembers` | Um ponto é uma afirmação sobre um intervalo, e qual intervalo é tem de vir com ele ou o número não quer dizer nada |
| **`the-envelope-is-the-object-graph`** ✅ escrito | `ResourceSpans → ScopeSpans → Span` é `provider → tracer → span`. Onde o campo mora diz quem o possui, e quem o possui diz onde ir mudá-lo |

### Fase 3

| Artigo | A tese |
| --- | --- |
| **`who-owns-the-pipeline`** ✅ escrito | Três donos, e uma regra: informação se remove para baixo e nunca se restaura. Quase todo incidente é uma mudança feita no dono errado |
| `agent-or-gateway-is-a-blast-radius` | A pergunta não é qual é melhor: é o que cai junto quando cai |

### Fase 4

| Artigo | A tese |
| --- | --- |
| `instrumenting-what-you-did-not-write` | A instrumentação que escala é a que ninguém escreve, e o preço dela é controle |
| `a-library-depends-on-the-api-only` | Uma biblioteca que escolhe exportador escolhe pela aplicação que a importa. Por isso a API existe separada, e por isso o padrão é no-op |
| `context-does-not-cross-a-queue` | Produtor e consumidor não compartilham pilha nem tempo. Pai ou link é uma decisão semântica, não de implementação |

### Fase 5

| Artigo | A tese |
| --- | --- |
| `the-cost-of-keeping-everything` | O custo não é do volume: é da cardinalidade, e ela se decide num atributo |
| `sampling-is-a-statement-about-ignorance` | Escolher uma taxa é declarar o que você aceita não saber. A pergunta certa é qual pergunta você não vai poder responder |
| `the-rollout-nobody-noticed` | Instrumentar é mudança organizacional disfarçada de mudança técnica |

### Os três escritos, e por que estes três

- **`what-a-signal-is`** é a porta de entrada. Sem ele o handbook começa no meio, e a
  definição que ele dá — sinal como decisão de descarte — é a que sustenta a regra de mão
  única que a fase 3 usa e a régua de cardinalidade que a fase 5 usa.
- **`the-envelope-is-the-object-graph`** carrega a tese da spec do lab dos provedores. Ela
  precisa existir em prosa **antes** do lab, porque é a afirmação que o lab prova.
- **`who-owns-the-pipeline`** é o par do primeiro lab desenhado. Escrever a teoria da fase
  cujo lab já tem desenho é o único jeito de descobrir se o desenho responde à pergunta que
  a fase faz.

Os onze restantes estão especificados acima e ficam `coming`. Publicar fase por fase,
conforme o autor estuda, é decisão da spec do handbook §3 — não é atraso.

### O que os três já respeitam, e vale registrar

- **Fonte primária, e as duas metades cobradas.** Toda fonte listada é citada no corpo, e
  toda citação aponta para fonte listada. Há teste dos dois lados, e ele pega tanto o
  enfeite bibliográfico quanto a âncora morta
- **`url` só quando o endereço é estável.** Dapper e X-Trace entram sem link, com a
  referência bibliográfica completa e a nota dizendo o que procurar. Inventar URL é pior que
  não ter: quem confere descobre que o link mente. O schema permite omitir de propósito
- **O livro não aparece em nenhuma lista de fontes.** Ele dá a ordem das fases; a verdade
  técnica vem da spec, do W3C e dos artigos originais
- **Nenhum artigo do OTel declara `lab`.** A página renderiza o campo como
  *"open the lab →"*, e nenhum lab do OTel está no ar. O primeiro lab publicado leva o
  campo consigo — até lá o link seria morto

---

## 4. Decisões

### D1 — A fase 2 passa a modelar os três sinais

É a correção mais importante deste round, e não é de quantidade. Uma fase chamada *The
Model* que modela só trace ensina, por omissão, que os outros dois são acessórios. Nascem
`the-shape-of-a-metric` e `a-log-that-knows-its-trace`.

E há retorno de motor de graça nisso: o `store` que uma métrica exige e o `buffer` que um
lote exige são peças diferentes do catálogo, e é a assimetria que a spec do lab dos
provedores §5 usa como fenômeno F4. Modelar métrica não é mais um lab — é o segundo alvo de
uma peça do motor.

### D2 — Convenção semântica é anexo, não lab

Tentação natural: um lab sobre nomes de atributo. Mas nenhum lab é *sobre* convenção — todo
lab a **usa**, e é exatamente essa relação que a spec §5 chama de anexo. Um lab sobre
convenção seria uma tabela com controles.

### D3 — Um artigo por conceito, não um por fase

Cinco artigos para cinco fases não é economia, é um índice. Quatorze é o número que sai da
regra de pareamento aplicada aos dezoito labs; se der doze ou dezesseis quando os labs
existirem, o número muda e a regra não.

### D4 — Nada fica `available` sem arquivo, e nada escrito fica `coming`

As duas metades, e o teste do repo cobra as duas. A primeira evita link morto em produção; a
segunda evita artigo escrito e invisível. Já aconteceu no handbook da CPU, com duas listas
escritas à mão para o mesmo fato.

### D5 — A régua do mapa é aritmética declarada

Ver §2. Está escrita no `roadmap.ts` como comentário, e não só aqui, porque é lá que a
próxima pessoa vai escolher um `y`.

---

## 5. Verificação

`pnpm` não existe nesta máquina e vitest não roda. Então as asserções dos dois testes que
este round toca — `apps/site/src/lib/articles.test.ts` e
`apps/site/src/data/handbooks.test.ts` — foram **replicadas num script node avulso** e
rodadas contra o que está no disco:

| Checagem | Resultado |
| --- | --- |
| 5 fases, 18 labs, 5 anexos, 14 artigos, parse limpo | ✅ |
| id de item único; toda fase existe; nenhuma fase vazia | ✅ |
| `available` tem `href`, `coming` não tem — artigos e labs | ✅ |
| toda fonte listada é citada; toda citação existe na lista | ✅ (3 artigos novos + 4 da CPU) |
| todo `url` é `https://` | ✅ |
| todo artigo tem degrau `[!deeper]`, com linha em branco e corpo | ✅ |
| título e fase do frontmatter batem com o catálogo | ✅ |
| todo link relativo resolve para rota que existe | ✅ |
| nenhum artigo declara `lab` inexistente | ✅ |
| **geometria: nenhuma das 28 caixas do mapa se sobrepõe** | ✅ |
| a régua +66/+56/+68 vale em todas as fases | ✅ |
| todo anexo alinha com um lab da esquerda e aponta `afterLab` que existe | ✅ |

O que **não** foi verificado, e é honesto dizer: `tsc -b`, o schema da coleção de conteúdo
do Astro, o `pnpm build` e o Playwright. O frontmatter foi escrito contra o schema lido em
`content.config.ts`, campo por campo, mas ninguém o compilou.

A checagem geométrica é mais forte que a do repo: **não existe teste de sobreposição do
mapa** hoje — só do espaguete dos labs. Se o Luigi quiser, ela vira teste de verdade em
`apps/site/src/data/roadmap.test.ts`, e é barata: são vinte linhas e o mapa deixa de poder
se quebrar em silêncio.

---

## 6. Correção ao plano irmão

O plano `2026-08-31-lab-provedores-otel.md`, na Task 13, manda modificar `docs/roadmap.md`
para a fase 3 ganhar o lab. **Está errado e sai**: `docs/roadmap.md` é o roadmap do
**motor** (F0–F8), em português, e não enumera lab de handbook nenhum. A trilha do handbook
vive só em `apps/site/src/data/roadmap.ts`. Medido em 31/08/2026.

O resto da Task 13 deste round já está feito — o nó `providers` está na trilha, com os
números recalculados pela régua.
