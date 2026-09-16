# Apostila v1 — a espinha do `otel.model` — desenho

**Data:** 2026-09-08.
**Handbook:** `otel.model`. **Precedência:** `DECISIONS.md`; depois a spec do handbook
(`2026-08-28`); depois o currículo (`2026-08-31-otel-curriculo-design.md`), que este
documento **não** revoga — ele escolhe qual pedaço dele vira v1.
**Fontes primárias:** a spec do OpenTelemetry e as recomendações do W3C. Nenhuma afirmação
vem de blog ou de memória.

---

## 1. A virada, e por que ela acontece agora

Luigi, 08/09/2026: *"precisamos atacar o OpenTelemetry, ele é o foco agora; a CPU era PoC pra
refinamento da engine; precisamos começar a refinar e andar com novos labs para entregarmos
uma apostila v1"*.

A CPU cumpriu o que tinha para cumprir. O critério de reentrada da F6 foi atingido em
29/08/2026 — o motor roda um programa de verdade sem `depth-core` saber o que é um
registrador — e as rodadas de desenho que vieram depois (túnel, planos, vistas fundas, o
leque) foram pagas pela CPU e ficam para o OTel de graça. **O que sobra da CPU é repetição;
o que falta no OTel é o produto.**

O estado que a virada encontra: **1 lab no ar de 18 planejados** e 6 artigos de 14. A fase 3
é a única com chão. Um handbook com uma fase de cinco não é um handbook, é uma demonstração.

## 2. O que é a v1, e o que ela não é

**A v1 é uma espinha: um lab por fase, cada um com o artigo par.** Quatro labs novos:

| Fase | Lab | A pergunta que ele responde |
| --- | --- | --- |
| 1 · The Problem | `three-pillars` | O que cada sinal se **recusa a lembrar**, e por que a recusa é irreversível |
| 2 · The Model | `anatomy-of-a-trace` | Como uma árvore que ninguém possui se monta de partes que só conhecem o pai |
| 3 · The Architecture | `providers` ✅ | Você chamou `startSpan`. Quem decide se aquilo sai do processo? |
| 4 · Instrumentation | `manual-spans` | O que você escreve à mão — e o que o silêncio custa quando falta |
| 5 · Operating at Scale | `head-vs-tail-sampling` | Duas decisões em duas posições de uma via de mão única |

**Por que a espinha e não a profundidade.** Com uma fase completa e quatro vazias, quem
começa termina o primeiro capítulo e bate em `coming`; com a espinha, a pessoa atravessa o
assunto inteiro e volta para aprofundar. E é a espinha que responde a pergunta que a apostila
precisa responder para existir: *o que este handbook cobre?*

**O que a v1 não é:** não é o currículo inteiro (dezoito labs), não é PDF, e não é uma trilha
linear paralela ao mapa — o mapa **é** a trilha, e uma segunda lista da mesma ordem é o
defeito que este repo já teve duas vezes.

## 3. As decisões que valem para os quatro

**D1 — Um estado-verdade por lab, e ele é do modelo.** Nenhum lab tem roteiro: o que a tela
mostra é o run, e as vistas são projeções dele. É a primitiva central do projeto e ela não se
negocia por prazo.

**D2 — Todo lab tem contraparte real em `labs/<id>/`.** Um `compose.yaml` que sobe o mesmo
cenário contra o SDK e o Collector de verdade, e um README que diz **o que não dá para ver
ali** — que é a metade que justifica o lab existir. É o princípio 3 do handbook, e a rodada
dos exercícios provou que ele paga: rodar a contraparte achou três defeitos que nenhum teste
tinha achado.

**D3 — Cada lab desfaz mal-entendidos nomeados.** A tabela `MAL_ENTENDIDOS` com âncora na
spec, como a do lab dos provedores. Escrito para quem já acredita neles.

**D4 — Predição antes da revelação, e exercício onde couber.** As duas peças já existem
(`Predicao`, `Exercicio`) e são de página, não de modelo. O exercício só entra onde há
contraparte real de onde **extrair** o bloco certo.

**D5 — Reuso antes de primitiva nova.** O `otel-domain` já tem span, recurso, escopo,
amostrador, fila, exportador, medição e registro. A régua: um `kind` novo exige dois alvos
pagantes, e nenhum dos quatro labs abaixo precisa de um.

## 4. Os quatro labs

### 4.1 `three-pillars` — o que cada sinal se recusa a lembrar

**O estado-verdade:** N requisições atravessam um serviço. Três gravadores olham as **mesmas**
requisições e guardam coisas diferentes: o tracer guarda o indivíduo (com pai e duração), o
medidor guarda o agregado (contador e histograma), o registrador guarda a frase que o código
escolheu dizer.

**O que se abre:** cada gravador. Dentro do tracer, os spans; dentro do medidor, os baldes do
histograma — e é aqui que o lab ganha o dia: **o balde tem uma contagem, e não os itens**. A
identidade não foi comprimida, foi **descartada**, e abrir o balde mostra isso em vez de
afirmar.

**Os controles:** a taxa de requisições; e um atributo a mais no medidor (`user.id`), que faz
a cardinalidade explodir e o limite recusar — a mesma peça `store` que colapsa em vez de
recusar, e que a fase 5 vai cobrar de novo.

**A pergunta que o lab faz ao leitor:** "quais requisições passaram de 300 ms?" — e então
mostra qual dos três consegue responder. É o artigo `what-a-signal-is` virando run.

**Mal-entendido central:** *"métrica é trace resumido"*. Não é: a métrica nunca soube quem
eram, e por isso nenhum backend pode desfazer o resumo.

### 4.2 `anatomy-of-a-trace` — a árvore que ninguém possui

**O estado-verdade:** uma requisição atravessa quatro processos. Cada um cria um span, carrega
o `traceparent` para o próximo e **exporta por conta própria**. A árvore não existe em lugar
nenhum durante o run: ela é montada na vista agregada, que é exatamente a tese.

**O que se abre:** o `traceparent` no fio (versão, trace-id, parent-id, flags — o formato do
W3C, campo a campo) e o span (o que ele sabe: o próprio id e o do pai, e nada mais).

**Os controles, e cada um é um defeito de campo:**

1. **derrubar o cabeçalho num limite** — o serviço seguinte começa um trace novo. Duas
   árvores completas e plausíveis para uma requisição, e nenhum erro em lugar nenhum;
2. **desinstrumentar um serviço do meio** — os filhos chegam órfãos, e o tempo do salto
   sumido é atribuído a quem está acima. O desenho continua parecendo completo;
3. **ignorar a decisão de amostragem que veio no cabeçalho** — fragmentos: metade da árvore.
   É o que a regra "a decisão viaja" existe para impedir.

**Mal-entendido central:** *"o backend remonta o que faltou"*. Ele não remonta: não existe
quem tenha a lista do que deveria ter chegado.

**Par:** o artigo `a-trace-is-a-tree-nobody-owns`, já escrito.

### 4.3 `manual-spans` — o que você escreve à mão

**O estado-verdade:** um handler instrumentado à mão, com o contexto sendo carregado (ou não)
por três saltos: a chamada síncrona, a tarefa jogada num pool, e a chamada de saída.

**O que se abre:** o **contexto** — a peça que o handbook inteiro trata como o produto — e o
que ele carrega em cada ponto do percurso.

**Os controles, e todos são coisas que se erra de verdade:**

1. **não encerrar o span** — ele nunca chega ao processador; o lab conta quantos ficaram
   abertos, que é o número que ninguém tem em produção;
2. **não tornar o span corrente** — o filho nasce raiz, e o log emitido ali sai sem trace;
3. **rodar sem SDK instalado** — a API responde no-op, tudo "funciona", e nada sai. É o
   defeito nº 1 de "meus spans não aparecem", e aqui ele é **contável**: o provedor no-op
   diz quantos spans terminaram dentro dele.

**Mal-entendido central:** *"se não deu erro, está instrumentado"*.

**Par:** artigo novo `a-library-depends-on-the-api-only` (o no-op é o assunto dele).

### 4.4 `head-vs-tail-sampling` — duas decisões, duas posições

**O estado-verdade:** traces nascem, o serviço raiz decide na cabeça, e um Collector com
buffer decide na cauda depois de esperar a árvore.

**O que se abre:** o buffer do tail — quantos traces ele segura, por quanto tempo, e o que
acontece com o span que chega **depois** da janela.

**Os controles:** a taxa da cabeça; a política da cauda (guardar erro, guardar lento); a
janela de espera; e o atraso de um serviço, que faz o span chegar tarde.

**O que o lab prova, e é o argumento da fase inteira:** a cauda só escolhe entre o que a
cabeça deixou passar. Baixar a cabeça para 1% e ligar "guardar todos os erros" na cauda
**não** guarda todos os erros — guarda 1% deles, e o desenho mostra por quê.

**Mal-entendido central:** *"tail sampling vê tudo"*.

**Par:** artigo novo `sampling-is-a-statement-about-ignorance`.

## 5. O refino que vem junto

Duas pendências declaradas do lab dos provedores entram na v1 porque **as duas mudam o que os
labs novos podem fazer**:

1. **arrastar um processador para a `pipeline`** — a decisão "parâmetro vs composição" da spec
   do handbook §4. Mexe no palco (arrastar), no modelo (um mundo que muda de forma sem
   recomeçar) e no currículo (ordem só ensina com dois). O `manual-spans` quer isso;
2. **o peso da mensagem na linha, separado de quantos itens ela leva** — hoje comprimir não
   tem como aparecer. É primitiva neutra do motor, não de domínio.

Ficam **fora** da v1, declarados: o importador de manifesto, a leitura da configuração nativa
e o contrato de fidelidade no CI.

## 6. A ordem de entrega, e por que ela não é a ordem de leitura

Entrega nesta ordem: **`three-pillars` → `anatomy-of-a-trace` → `head-vs-tail-sampling` →
`manual-spans`**.

A leitura começa na fase 1 e o primeiro lab também — a apostila precisa de um começo. Depois
vem a fase 2, que é onde o artigo par **já está escrito**. A fase 5 vem antes da 4 porque ela
reusa a fila e o amostrador que já existem, e a fase 4 é a que pede o refino do §5.

Cada lab é uma rodada: spec curta se precisar, modelo com testes, vistas, página, contraparte
real, artigo par, e o mapa marcando `available` — que é o teste que já existe cobrando que
nada seja anunciado antes de abrir.

## 7. Como se sabe que a v1 está pronta

- os cinco nós da espinha abrem, e o mapa não mente sobre nenhum (o teste do catálogo já
  cobra os dois lados);
- dez artigos de quatorze, e cada lab da espinha com o seu par;
- cinco contrapartes reais em `labs/`, cada uma rodada à mão pelo menos uma vez;
- a suíte inteira verde, com os tetos de espaguete das vistas novas medidos e travados —
  incluindo as **vistas fundas**, que é a lição da rodada passada;
- e o critério que não é de teste: **dá para estudar do começo ao fim sem bater em `coming`**.
