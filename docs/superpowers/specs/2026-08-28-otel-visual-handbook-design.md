# OTel Visual Handbook — Design

**Data:** 2026-08-28
**Repositório:** https://github.com/CabriniJr/otel-visual-handbook
**Status:** aprovado, aguardando plano de implementação

---

## 1. O que é

Um handbook em inglês onde cada conceito de OpenTelemetry tem um **modelo visual
manipulável** e um **anexo executável**. O leitor não olha um diagrama: ele mexe
em controles, provoca falhas, e desce da vista externa até os bytes reais que
produziram aquela vista.

Referência de formato: k8s.info (currículo em fases, simulações no browser).
Referência de pedagogia: Cisco Packet Tracer — ver o protocolo funcionando,
camada por camada. Referência de acabamento: manual de engenharia impresso.

**Público:** engenheiros de plataforma e devs que precisam operar OpenTelemetry
de verdade, não só instalar o SDK. Inglês, alcance global.

**Espinha dorsal de longo prazo.** O motor de profundidade não é específico de
OpenTelemetry: é uma forma de ensinar qualquer teoria técnica mostrando-a
funcionar camada por camada. OTel é a primeira aplicação dele, não a dona dele.
Isso **não é escopo do MVP** — não haverá plugin system, API pública, pacote npm
nem segunda aplicação agora. É uma única restrição de fronteiras, imposta no CI,
que custa quase nada hoje e evita reescrita depois. Ver §8.

---

## 2. Princípios

Estes cinco decidem discussões futuras. Quando houver dúvida de escopo ou de
implementação, a resposta sai daqui.

1. **Nada é ilustração decorativa.** Toda simulação modela um mecanismo real e
   responde a input. Figura que não reage é diagrama estático: vive no texto,
   não vira lab.

2. **O livro dá a ordem, as docs dão a verdade.** A sequência didática vem de
   *Learning OpenTelemetry* (Parker & Young, O'Reilly 2024), porque a ordem em
   que os conceitos se sustentam ali está correta. Nenhum texto do livro é
   copiado, parafraseado de perto, ou usado como fonte factual. Toda afirmação
   técnica é ancorada na spec/documentação oficial do OpenTelemetry, com link.

3. **Todo lab tem contraparte real.** Simulação na página + `labs/<slug>/` com
   compose que roda de verdade. A simulação ensina o modelo mental; o compose
   prova que o modelo é verdade.

4. **UX de leitura antes de UX de brinquedo.** Página carrega instantânea, prosa
   legível, simulação hidrata só ao entrar em viewport. Ninguém aprende
   esperando bundle.

5. **O motor não conhece o domínio.** Nada em `depth-core` ou `depth-ui` pode
   mencionar span, trace, OTLP ou Collector. Todo conhecimento de OpenTelemetry
   vive no adaptador de domínio. Regra verificada automaticamente, não por
   disciplina.

---

## 3. Arquitetura de informação

Cinco fases, mapeadas dos capítulos do livro, nomeadas pela pergunta que
respondem e não pelo índice:

| Fase | Capítulos | Pergunta que responde |
|---|---|---|
| **1. The Problem** | 1–2 | Por que logs + métricas + traces soltos não são observabilidade |
| **2. The Model** | 3 | Signals, hard/soft context, baggage, OTLP, semantic conventions |
| **3. The Architecture** | 4 | API vs SDK vs Collector — quem faz o quê e onde roda |
| **4. Instrumentation** | 5–7 | App, bibliotecas, infraestrutura: de onde a telemetria nasce |
| **5. Operating at Scale** | 8–9 | Pipelines, sampling, custo, rollout organizacional |

O site publica **fase por fase, conforme o autor estuda**. A landing exibe as
cinco desde o dia 1, com as futuras marcadas como *coming* — o mapa completo do
conhecimento fica visível mesmo antes de existir, e ele é parte do valor.

Um lab não depende do anterior estar perfeito. Ordem de publicação segue o
estudo, não a completude.

---

## 4. Profundidade: a primitiva central

**A regra que sustenta o projeto:** um lab tem um único estado-verdade, e cada
nível de zoom é uma projeção dele — nunca uma animação separada.

Concretamente: quando o serviço A chama o B, o motor não guarda "uma bolinha
andando na tela". Ele guarda um `ExportTraceServiceRequest` real, um header
`traceparent` real, frames HTTP/2 reais. A bolinha é *renderização* desses
bytes. Por isso, ao adentrar, o JSON não é mock ilustrativo — é o mesmo dado que
estava produzindo a animação no nível de cima.

### Os quatro níveis

Cada lab **declara quais níveis possui**. Nem todo lab precisa dos quatro; um
lab de rollout organizacional pode ter só L0.

| Nível | O que mostra | Exemplo (Anatomy of a Trace) |
|---|---|---|
| **L0 · Flow** | Topologia, serviços, telemetria fluindo | 4 serviços, requisição atravessando, trace se montando |
| **L1 · Mechanism** | Engrenagens dentro de um componente | Dentro do SDK: span processor → fila → batch → exporter |
| **L2 · Wire** | O protocolo carregando aquilo | gRPC sobre HTTP/2: HEADERS, DATA, length-prefix, stream id |
| **L3 · Payload** | O dado, campo a campo | OTLP em JSON/protobuf, bytes recém-alterados destacados |

### Três mecânicas obrigatórias

- **Zoom contínuo, não modal.** Adentrar é o mesmo elemento crescendo e
  revelando o interior; o contexto do nível de cima permanece na periferia.
  Nunca se "sai e volta" — se desce. Modal quebraria a metáfora inteira.

- **Mutação destacada.** Quando um processor injeta `resource.attributes`,
  quando o `traceparent` troca o `parent-id` no próximo hop, quando o batch
  funde 5 spans em 1 request: o campo alterado pisca e fica marcado por alguns
  segundos. O aprendizado está no delta, não no estado final.

- **Linha do tempo com scrub.** Pausar, passo-a-passo, rebobinar. A barra de
  tempo é compartilhada por todos os níveis: para-se no instante exato, desce a
  L3, lê os bytes, sobe. Sem isso o L3 passa rápido demais para ser lido.

### Responsividade

Desktop: níveis adjacentes convivem lado a lado (L0 + inspector de L3).
Mobile: pilha vertical com o nível ativo expandido — mesma metáfora de descida,
eixo diferente. Nenhum nível é cortado no mobile; o que muda é o arranjo.

---

## 5. Anexos reutilizáveis — "The Wire"

O modelo de gRPC não pertence a um lab: ele reaparece em exportação, Collector e
backpressure. Anexos são peças de primeira classe, num acervo próprio,
incorporáveis inline por qualquer lab.

Acervo inicial planejado:

- **gRPC over HTTP/2** — streams, frames, multiplexing, por que OTLP escolheu isso
- **Protobuf encoding** — varint, field tags, por que o payload é opaco no tcpdump
- **W3C Trace Context** — o header, seus campos, o que quebra quando um proxy o remove
- **OTLP** — schema das três requisições, resource/scope/record
- **OTLP/HTTP vs gRPC** — quando cada um, o que muda no wire

Um lab incorpora o anexo em vez de reexplicar. É o que impede o handbook de
virar trinta explicações rasas repetidas.

---

## 6. Anatomia de uma página de lab

Sempre a mesma espinha, para o leitor aprender a forma uma vez só:

1. **The question** — a pergunta concreta que o lab responde
2. **The model** — a simulação: controles à esquerda, visualização dominante, estado inspecionável
3. **Break it** — cenários de falha pré-armados, com o sintoma aparecendo no visual
4. **Why it works this way** — a prosa, ancorada na spec, com links
5. **Run it for real** — o `labs/<slug>/` correspondente e o que observar nele
6. **Check yourself** — 2–3 perguntas de verificação, resposta revelável

---

## 7. Direção visual

**Editorial técnico.** Referência: manual de engenharia bem impresso.

O que evitamos, explicitamente, porque é o que faz um site *parecer* gerado por
IA: dark com gradiente roxo/azul, cards de vidro, cantos arredondados uniformes
em tudo, ícones de biblioteca genérica, hero centralizado com pílula de badge,
densidade uniforme sem hierarquia tipográfica.

O que fazemos:

- **Fundo claro por padrão**, dark como opção real (não como afterthought)
- **Grid editorial** com margem larga e notas laterais
- **Serifada de verdade** nos títulos, mono para dados e código, sem-serifa para prosa
- **Uma única cor de acento ganha**; o resto é tinta e papel
- **Cor saturada só nos diagramas.** A página emoldura; o modelo brilha
- **Linguagem de diagrama desenhada por nós**, não montada de biblioteca de ícones

Tokens e componentes nascem de um canvas no Claude Design, e o design system do
site é derivado dele — não o contrário.

### Tema por tecnologia

O handbook deve poder vestir a identidade da tecnologia que está ensinando: tema
e logo do OpenTelemetry aqui, do Kafka num handbook futuro. Isso é **futuro**,
mas impõe uma camada agora, pela mesma lógica do §8 — barato hoje, reescrita
depois.

Os tokens vivem em duas camadas:

- **Cromo editorial (neutro)** — tipografia, escala, ritmo, tinta e papel, réguas.
  Não muda entre tecnologias. É o que dá ao handbook uma voz própria em vez de
  virar um site de marca.
- **Tema de domínio** — a cor de acento, as cores de sinal dos diagramas e o
  logo. Trocável por `data-domain` no elemento raiz.

Hoje existe **um** tema (`otel`), derivado da identidade do OpenTelemetry. A
regra que protege a direção editorial: o tema de domínio pinta acento, sinal e
logo — nunca o fundo, nunca a tipografia. Uma tecnologia de marca berrante não
pode transformar a página num banner.

---

## 8. Arquitetura técnica

### Stack

Astro com ilhas React. Conteúdo em MDX, zero JS por padrão, hidratação apenas
da simulação da página. TypeScript estrito. pnpm workspaces.

Build e deploy por GitHub Actions para **GitHub Pages** — o repositório já vive
no GitHub, não exige conta nem serviço adicional, e o site é inteiramente
estático. Domínio próprio é troca de DNS, decisão independente e reversível.

### Layout do monorepo

```
otel-visual-handbook/
├─ apps/site/              Astro: MDX do conteúdo, páginas, navegação
│  └─ src/labs/<slug>/     o cenário declarativo de cada lab
├─ packages/depth-core/    motor agnóstico: estado-verdade, clock, projeções
├─ packages/depth-ui/      primitivas visuais agnósticas: DepthShell, Timeline, Inspector
├─ packages/otel-domain/   adaptador OTel: tipos e codecs fiéis à spec
├─ labs/<slug>/            o compose que roda de verdade
└─ docs/                   specs, ADRs, guia de autoria
```

### Motor agnóstico e adaptador de domínio

A divisão que preserva o reuso futuro sem custar escopo hoje:

- **`depth-core`** — o motor, sem domínio. Mantém um estado-verdade opaco,
  avança por ticks determinísticos com seed, expõe projeções por nível, calcula
  o diff entre ticks (que alimenta a mecânica de mutação destacada) e mantém
  histórico rebobinável. Não renderiza, não importa React, e **não sabe o que é
  um span**.
  *Depende de: nada.*

- **`depth-ui`** — primitivas visuais React sobre as projeções do `depth-core`.
  `DepthShell` (o zoom contínuo), `Timeline`, `Inspector`, `ControlPanel`,
  `Node`, `Wire`, `Bar`. É onde vive a coerência visual entre labs. Também
  agnóstica: recebe rótulos e formas, não conceitos de telemetria.
  *Depende de: `depth-core`, tokens do design system.*

- **`otel-domain`** — o adaptador, e o único lugar onde OpenTelemetry existe.
  Tipos fiéis à spec (`Span`, `TraceContext`, `Resource`,
  `ExportTraceServiceRequest`), serialização OTLP/JSON, parse e format de
  `traceparent`, encode protobuf, e a definição de como esses dados se projetam
  em cada um dos quatro níveis.
  *Depende de: `depth-core` (só para implementar o contrato).*

- **`apps/site`** — Astro, conteúdo, navegação, e um *cenário* por lab
  (topologia, controles expostos, falhas armadas, níveis declarados).
  *Depende de: `depth-ui`, `otel-domain`.*

**A regra é imposta pelo CI**, não pela disciplina: uma checagem de dependências
falha o build se `depth-core` ou `depth-ui` importarem `otel-domain`, e um lint
falha se os termos do domínio aparecerem nesses pacotes. É o mecanismo inteiro —
nenhuma abstração especulativa além disso. A segunda aplicação é que vai revelar
qual API é a certa; projetá-la agora, com um único consumidor, seria adivinhação.

Um lab novo é **conteúdo + cenário**. Se um lab exigir código novo em
`depth-core` ou `depth-ui`, isso é sinal de primitiva faltando — e a primitiva é
adicionada lá, não no lab.

### Estratégia de testes

- **`otel-domain`**: validado contra **fixtures OTLP reais capturadas dos
  `labs/`**. O compose que ensina também gera os dados que provam que a
  simulação não mente. Se a spec mudar, o teste quebra. Esta é a garantia
  mecânica do princípio 2.
- **`depth-core`**: testes de determinismo — mesmo seed, mesmo estado no tick N.
  Cenários de falha verificados por asserção sobre o estado, não sobre pixels.
- **`depth-ui` / site**: Playwright para smoke — a página carrega, a simulação
  hidrata, o zoom entre níveis funciona, o mobile empilha.
- **Fronteira do framework**: checagem de dependências e lint de vocabulário no
  CI, conforme §8.

### Tratamento de erro

Simulação é código de browser sobre dados locais; não há rede nem backend. Os
modos de falha reais são: cenário malformado, e simulação que trava por bug.
Cada ilha de simulação fica atrás de um error boundary que degrada para o
diagrama estático do nível L0 e uma mensagem discreta — a prosa da página
continua legível e o leitor não perde o conteúdo. Erros de cenário são pegos em
build: cenários são validados por schema no CI, então um cenário quebrado falha
o deploy em vez de chegar ao leitor.

### Persistência

Progresso de leitura e preferência de tema em `localStorage`. Sem contas, sem
backend, sem coleta de dados pessoais. Se progresso em nuvem virar necessidade,
é decisão nova e spec nova.

---

## 9. Fluxo de autoria

O ritmo pretendido, dado que o autor está estudando o assunto em paralelo:

1. Estuda um trecho do livro
2. Abre issue com **a pergunta que o lab responde**
3. Reúne as fontes oficiais (spec, docs, RFCs) que respondem a ela
4. Com o Claude, destila fonte → **cenário** (topologia, níveis, falhas armadas)
   e → rascunho do texto do lab
5. Revisa contra as fontes, escreve o MDX final
6. PR, revisão, publica

O autor estudando enquanto constrói é a defesa contra o vício mais comum deste
tipo de material: quem domina o assunto esquece onde ele confunde.

### Claude no fluxo de autoria

É aqui que "powered by Claude" é concreto: Claude lê a documentação oficial e
ajuda a produzir o cenário e o texto; **o site publicado é estático**. Nenhuma
chamada de modelo acontece no browser do leitor — sem backend, sem chave de API,
sem custo por visitante, e sem conteúdo não-verificado servido num handbook cujo
princípio é fidelidade à spec. O que o Claude produz passa por revisão humana
contra a fonte antes de virar página.

O pipeline "documentação oficial → modelo didático" é documentado em
`docs/authoring.md` e é o que torna trinta labs viável em vez de aspiracional.

---

## 10. Escopo das entregas

### Entrega 1 — Fundação e landing

- Monorepo, TypeScript, pnpm workspaces, CI, deploy contínuo
- Canvas de design no Claude Design; tokens e componentes derivados dele
- Landing page completa: proposta, as 5 fases (com *coming*), o que é um lab
- **Mini-simulação real embutida no hero** — roda sobre `depth-core` +
  `otel-domain` de verdade, não é GIF nem vídeo. É o primeiro teste do motor
- Guia de autoria em `docs/`

A landing não fica refém do motor completo, e o hero já prova o conceito para
quem chega.

### Entrega 2 — Lab piloto

- *Anatomy of a Trace* com os quatro níveis
- Anexo **W3C Trace Context** no acervo The Wire
- `labs/anatomy-of-a-trace/` com compose real e fixtures OTLP capturadas dele
- O molde de página de lab consolidado e documentado

O piloto é quem prova o motor de profundidade. Ele nasce com os quatro níveis
justamente porque uma prova parcial não prova nada.

### Fora de escopo agora

Tradução pt-BR, contas de usuário, progresso em nuvem, busca full-text,
newsletter, comentários, Claude ao vivo na página.

**Explicitamente fora de escopo, apesar de §1:** extrair o framework para repo
ou pacote npm, projetar API pública, plugin system, ou qualquer segunda
aplicação de domínio. O foco é um MVP bem trabalhado. Do reuso futuro, a única
coisa que existe hoje é a fronteira do §8 — e ela existe porque é barata agora e
cara depois.

---

## 11. Riscos assumidos

- **`depth-core` + `otel-domain` fiéis à spec desde o dia 1.** Construir sobre
  estado de animação e "adicionar realismo depois" significaria reescrever tudo.
  Aceita-se ser mais lento no início.
- **Quatro níveis por lab é caro.** Mitigado por cada lab declarar seus níveis e
  pelo reuso dos anexos. Se o custo por lab não cair até o terceiro lab, as
  primitivas estão erradas e isso vira revisão de arquitetura.
- **Escrever em inglês enquanto estuda em português** adiciona atrito. Aceito
  em troca de alcance.
- **A fronteira agnóstica pode estar no lugar errado.** Com um único domínio,
  não há como saber. Aceita-se: o custo de mover a fronteira depois é pequeno
  justamente porque não há API pública a manter. O que não se aceita é dissolver
  a fronteira.
