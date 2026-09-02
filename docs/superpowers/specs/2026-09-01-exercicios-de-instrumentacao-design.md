# Exercícios de instrumentação — desenho

**Data:** 2026-09-01.
**Handbook:** `otel.model`, fase 3 — o lab dos provedores.
**Precedência:** `DECISIONS.md` manda; depois a spec do handbook
(`2026-08-28-otel-visual-handbook-design.md`); depois a do lab dos provedores
(`2026-08-31-provedores-otel-design.md`). Este documento não revoga nenhum dos três.
**Fontes primárias:** spec do OpenTelemetry e o SDK Java na versão fixada no `pom.xml` da
contraparte real. Nenhuma afirmação vem de blog ou de memória.

---

## 1. A tese

O handbook mostra o mecanismo rodando e conta a teoria ao lado. As duas coisas são
**receptivas**: a pessoa olha e lê. Falta a terceira, e ela é a que fixa — **a pessoa
decidir, e descobrir que estava errada.**

A peça de predição (`Predicao`, entregue em 31/08/2026) já é isso em miniatura, e o
`DECISIONS.md` §8.1 registra por quê: predizer antes de rodar é o achado mais replicado da
pesquisa em simulação didática. O que ela não faz é pedir **a decisão que a pessoa vai
tomar no trabalho**, que não é "o que vai acontecer?" e sim "**o que eu escrevo aqui?**".

Daí a forma:

> Uma aplicação Java de verdade, com uma linha faltando. Três blocos candidatos. Um deles
> é a linha que roda; os outros dois são mal-entendidos que existem em produção.

## 2. Por que não é um quiz

Um quiz pergunta sobre o assunto. Este exercício pede **a mesma decisão que o assunto
exige**, no meio do código em que ela é tomada. A diferença aparece no que a pessoa tem de
fazer para acertar: num quiz, lembrar; aqui, ler o código em volta e reconhecer de onde o
`Tracer` pode vir.

E o distrator é onde o ensino mora. Cada bloco errado é **um mal-entendido nomeado** — a
mesma tabela `MAL_ENTENDIDOS` que o lab dos provedores já tem, e que o `DECISIONS.md` §8.2
pede. Escolher o errado não devolve "errado": devolve *por que* aquilo parece certo e o que
a spec diz.

---

## 3. Onde vive

**Uma seção `Instrument it` na página do lab**, depois de *Break it*. Nenhum nó novo no
mapa, nenhuma anatomia nova.

A anatomia do handbook é **roadmap · artigos · labs**, e ela é a mesma nos dois handbooks
(memória do projeto, 29/08/2026). Um quarto tipo de item mudaria os dois de uma vez, para
um ganho que a seção já entrega: herdar o mapa, o progresso, o pareamento com o artigo e a
navegação, de graça.

E o momento é melhor. A pessoa chega no exercício **tendo acabado de ver o mecanismo
rodar** — o amostrador com três saídas, a fila recusando, o envelope atravessando o canal.
Um exercício em página própria começa do zero.

**Consequência aceita:** exercício só existe onde existe lab. Hoje, um.

---

## 4. A âncora — e é ela que sustenta o resto

O veredito é **escrito à mão** (decisão do Luigi, §D1). Sozinha, essa escolha põe uma
segunda fonte da verdade ao lado da spec — que é o tipo de coisa que este repo já teve de
consertar duas vezes. O desenho abaixo existe para tirar dela tudo o que der.

### 4.1 O bloco certo não é escrito: ele é extraído

O arquivo Java da contraparte real carrega marcadores:

```java
// <handbook:trecho id="tracer-do-provider">
OpenTelemetry otel = GlobalOpenTelemetry.get();
// <handbook:lacuna>
Tracer tracer = otel.getTracer("checkout.http");
// </handbook:lacuna>
Span span = tracer.spanBuilder("GET /checkout").startSpan();
// </handbook:trecho>
```

No **build** (frontmatter do Astro, que roda em Node), o trecho é lido do arquivo. O que
está entre `<handbook:lacuna>` e `</handbook:lacuna>` **vira o bloco certo** — uma linha ou
mais de uma, tomadas como estão, com a indentação removida por igual —, e o resto vira o
código exibido com a lacuna aberta. Os distratores têm de ter a mesma forma: um distrator de
uma linha contra um certo de três entrega a resposta pelo tamanho.

Portanto: **a definição do exercício não declara a resposta certa.** Ela declara só o
arquivo, o marcador e os **distratores**. Não existe como escrever a resposta certa errada,
e não existe como ela envelhecer em silêncio — mude o arquivo e o exercício muda junto.

O que continua sendo autoral: os distratores, e as explicações dos três blocos. São
explicação, não veredito.

### 4.2 A versão é fixada

O `pom.xml` de `labs/providers/` fixa a versão do SDK Java. Nada de `-alpha`, nada de
incubador: o exercício só usa API estável para traces. A versão aparece na página, ao lado
do código.

---

## 5. A mecânica

Lacuna com distratores. Três blocos: um certo, dois errados e plausíveis.

1. a pessoa lê o cenário (uma frase: o que a aplicação faz, o que já existe);
2. lê o trecho, com a lacuna aberta;
3. **escolhe um bloco** — arrastando, ou pelo teclado (§8);
4. o bloco entra na lacuna e o veredito aparece, com o porquê e a âncora na spec;
5. a escolha **não se refaz**. Vale a mesma razão da predição: o compromisso é o mecanismo.

Errar não trava nada. Depois do veredito, os três blocos ficam visíveis com a explicação de
cada um — inclusive a dos que a pessoa não escolheu, porque o mal-entendido que ela **não**
tinha também ensina.

---

## 6. O placar

Guarda, por exercício, se o acerto foi **de primeira**. O nó do mapa passa a mostrar
`3/4 first try` ao lado do progresso.

A métrica é escolhida, e o motivo é o mesmo da §5: **premia prever, não tentar até ficar
verde.** Uma contagem de acertos totais recompensaria a segunda tentativa, que é
exatamente o hábito que este handbook não quer ensinar.

Chave nova: `ovh:placar:v1`, `Record<exercicioId, "primeira" | "depois">`. **Não encosta em
`ovh:progress:v1`** — mudar aquela apagaria o progresso de quem já leu, e está escrito no
próprio arquivo que não se mexe nela.

O nó do mapa só mostra o placar **onde há exercício** — num nó sem exercício não há `0/0`,
porque zero de zero se lê como "você não fez", e a pessoa não deixou de fazer nada.

Quantos exercícios um lab tem sai da **lista de exercícios**, e de nenhum outro lugar. Uma
segunda lista escrita à mão é o defeito que este repo já teve duas vezes (o catálogo de
labs, e o `href` do mapa).

---

## 7. Decisões

### D1 — O veredito é escrito à mão, e o desenho tira disso o que der

Decisão do Luigi. A alternativa recusada era o modelo rodar a instrumentação montada e o
palco ser o corretor.

O que se perde: um exercício que o modelo corrige não pode discordar do que o lab mostra,
porque é o mesmo run. O que se ganha: alcance — dá para exercitar o que o modelo não
representa, e a autoria é ordens de grandeza mais barata.

As mitigações são a §4 inteira: **a resposta certa é extraída, não escrita**; todo bloco
carrega `fonte` obrigatória na spec; e a versão do SDK é fixada. Sobra de risco declarado:
as *explicações* podem envelhecer sem ninguém ser avisado. Aceito.

### D2 — Java, e o recorte é um método

Decisão do Luigi, contra a minha recomendação de Python. O argumento dele é bom: Java é
onde a dúvida "manual ou zero-code?" é real.

O custo que eu levantei — cerimônia por conceito — é resolvido pelo recorte: **o exercício
mostra um método, não a classe.** Os imports, o `pom.xml` e a construção do provider
existem no arquivo e são alcançáveis por "ver o arquivo inteiro"; o que fica na tela é a
decisão.

### D3 — A contraparte real é pré-requisito, e não consequência

`labs/providers/` (bloco E do plano de 31/08) vem **antes**. Sem ela não há arquivo de onde
extrair, e o exercício nasceria com a fraqueza que a §4 existe para remover.

É a decisão mais cara deste desenho, e está escrita como decisão para que ninguém a inverta
por pressa depois.

**E ela é entrega própria.** No plano de implementação a contraparte é o primeiro bloco, e
ela fecha sozinha: `labs/providers/` com compose, app e fixture OTLP já era pendência
declarada do round anterior, e vale por si — é o princípio 3 do handbook, "todo lab tem
contraparte real". Se o exercício for adiado, aquilo continua tendo valor; o contrário não.

### D4 — A peça é neutra de domínio, e mora em `apps/site`

Como a `Predicao`. Não é primitiva de modelo, é pedagogia de página, e os dois handbooks a
alcançam de lá. A fronteira do CI não se pronuncia sobre isso — por isso está escrito.

### D5 — Os blocos são embaralhados por semente, e não por sorteio

A ordem sai do id do exercício. Sorteio real quebraria o SSG: o servidor renderiza uma
ordem, o cliente hidrata com outra, e o React reclama — além de o desenho mudar entre dois
carregamentos da mesma página.

---

## 8. Acessibilidade, e ela não é opcional

Arrastar é o gesto bonito, **não o único**. Cada bloco é um `<button>`: clicar o bloco o
seleciona, clicar a lacuna o encaixa. O arraste é uma camada por cima disso, e some sem
prejuízo.

A `Predicao` já nasceu botão puro, e esta nasce igual. Duas regras herdadas dela:

- **a revelação não existe no DOM antes da resposta.** Escondê-la com CSS a deixaria legível
  no inspetor e, pior, para quem usa leitor de tela — que é justamente o leitor a quem o
  compromisso mais serve;
- o veredito é **atributo**, e não só cor: `data-veredito` em `certo`/`errado`/`outro`.

---

## 9. As peças

| Arquivo | Responsabilidade |
| --- | --- |
| `labs/providers/` | **pré-requisito**: app Java + Collector, versão fixada, marcadores no código |
| `packages/otel-domain/src/exercicios/tipos.ts` | `DefinicaoDeExercicio` e `Distrator` |
| `packages/otel-domain/src/exercicios/providers.ts` | os dois exercícios do lab, como dado |
| `apps/site/src/lib/exercicios.ts` | **build-time**: lê o arquivo, extrai trecho e lacuna, monta os blocos |
| `apps/site/src/components/Exercicio.tsx` + `.css` | a peça, neutra de domínio |
| `apps/site/src/lib/placar.ts` | `ovh:placar:v1` |
| `apps/site/src/components/Roadmap.tsx` | o `n/m first try` no nó |

O tipo, e note o que **não** está nele:

```ts
interface DefinicaoDeExercicio {
  readonly id: string;
  readonly lab: string;          // a que lab pertence
  readonly cenario: string;      // a frase da aplicação
  readonly arquivo: string;      // caminho em labs/<slug>/
  readonly trecho: string;       // o id do marcador
  readonly porqueCerto: string;  // a explicação do bloco certo
  readonly fonteCerto: string;   // a âncora na spec
  readonly distratores: readonly Distrator[];
}
```

Não há campo para o código certo. Ele vem do arquivo.

---

## 10. Os testes

Além dos de sempre:

1. **o marcador existe** — o arquivo referenciado existe, e `<handbook:trecho id="…">` e
   `<handbook:lacuna>` estão lá. Some o marcador, cai o teste;
2. **o bloco certo é o arquivo** — o código do bloco certo é, caractere por caractere, a
   linha entre os marcadores de lacuna. É o teste que impede a §4.1 de virar promessa;
3. **nenhum distrator é igual ao certo** — um distrator que casa com a resposta transforma
   o exercício numa moeda;
4. **todo bloco tem `fonte`** com `https://opentelemetry.io/` ou `https://www.w3.org/`, e
   toda `fonte` de distrator aponta para o trecho da spec que o desfaz. Mesma regra do
   `MAL_ENTENDIDOS`, mesmo teste;
5. **todo exercício aponta para um lab que existe** no mapa, e o `n/m` do nó sai da lista;
6. **e2e**: a explicação não está no DOM antes da resposta; escolher marca `data-veredito`;
   a segunda escolha não muda o placar; e o caminho **por teclado** encaixa o bloco sem
   arraste nenhum.

O último item é o que impede a acessibilidade de virar intenção: sem ele, o caminho por
teclado existe no código e ninguém percebe no dia em que ele parar de funcionar.

---

## 11. Primeira rodada

Dois exercícios, ambos no lab dos provedores, praticando o que a fase 3 do roadmap ensina.

**E1 — De onde vem o `Tracer`.**
Distratores: instanciar o tracer diretamente; e pegar de um `TracerProvider` construído na
hora, ao lado do que o SDK registrou. O segundo é o mal-entendido caro — nada falha, e os
spans saem com outro `Resource`, que é o F1 do lab.

**E2 — Onde mora o `service.name`.**
Distratores: `span.setAttribute("service.name", …)`; e pôr no nome do escopo do tracer.
É o primeiro mal-entendido da tabela do lab, e o que a tese do envelope desfaz.

Dois é pouco para "gamificação", e é deliberado: a mecânica e a autoria têm de provar que
funcionam antes de escalar. O custo de acrescentar o terceiro é linear.

---

## 12. O que fica de fora, e por quê

- **Montar do zero** e **achar o erro** — duas mecânicas a mais para julgar com gabarito
  escrito à mão, e nenhuma delas ensina algo que a lacuna não ensine na primeira rodada;
- **XP, streak e badges** — é o vocabulário visual que a direção do projeto recusa por
  escrito ("não parecer feito por IA"), e streak entre dias exige guardar data, o que muda
  o que o site sabe sobre quem lê;
- **Python** — a segunda linguagem duplica a contraparte real. Entra quando a primeira
  estiver de pé, e aí o mesmo cenário nas duas prova que a decisão é do OTel e não da
  linguagem;
- **Exercício sem lab** — precisaria do quarto tipo de nó, que a §3 recusou;
- **Correção pelo modelo** — D1.
