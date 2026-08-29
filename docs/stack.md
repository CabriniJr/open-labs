# Stack: o que reaproveitar

**Status:** levantamento para decisão. Nada aqui está adotado.
**Data:** 2026-08-28

Critério: reaproveitar tudo que é **infraestrutura** — desenho, layout, parsing,
animação, teste. Escrever à mão só o que é o ativo do projeto.

Tudo nesta página é open source, com a licença anotada. Onde a licença **não** é
permissiva, ou onde o projeto não é open source, está marcado explicitamente.

> **Sobre a confiança de cada linha.** As licenças de React Flow, elkjs, LikeC4, tldraw,
> PGlite, PhET e Compose Specification foram verificadas na fonte em 2026-08-28. As
> demais vêm de conhecimento geral e devem ser confirmadas no arquivo de licença antes
> da adoção — o projeto é público e a licença é do repositório, não do resumo.

---

## 1. Palco: canvas, nós, portas

| Biblioteca | Licença | Por que |
|---|---|---|
| **`@xyflow/react`** (React Flow) | MIT | A escolha. Nó aninhado com `parentId`, `extent: "parent"` para prender o filho na moldura, nó de grupo que se dimensiona pelos filhos, *handles* como portas nomeadas. É o clamp e a porta de descarte da spec, prontos |
| Cytoscape.js | MIT | Alternativa com bom suporte a nó composto; menos idiomático em React |
| Rete.js, litegraph.js | MIT | Editores de grafo por nó; feitos para fiação livre, que aqui é justamente o que não se quer |
| Konva, PixiJS | MIT | Se a contagem de objetos animados exigir canvas ou WebGL em vez de DOM. Não antecipar |

**Não usar:** **tldraw** deixou de ser open source no SDK 4.0 — licença própria, marca
d'água obrigatória na versão hobby, licença comercial em produção. **Excalidraw** é MIT e
livre, mas é canvas de desenho livre; aqui o canvas é gerado do modelo.

**Cuidado:** React Flow é MIT, mas **React Flow Pro** é proprietário e proíbe
redistribuição. Consumir apenas exemplos marcados como MIT.

## 2. Layout

| Biblioteca | Licença | Por que |
|---|---|---|
| **dagre** (`@dagrejs/dagre`) | MIT | Começar aqui. Sem atrito de licença, e é o que o LikeC4 usa em produção |
| **elkjs** | **EPL-2.0 OU GPL-3.0-or-later** | Melhor tecnicamente: feito para grafo composto com **portas como âncoras explícitas**, que descreve este modelo com precisão. Trocar para ele se o roteamento por porta virar limitante |
| **`@lume/kiwi`** | MIT | Solver Cassowary. Candidato para as faixas reservadas e o clamp na moldura |
| d3-hierarchy | ISC | Se a navegação precisar de árvore desenhada |

**Cuidado com o elkjs:** copyleft fraco. Consumir como dependência é tranquilo;
modificar ou embutir cria obrigação. Se o projeto adotar Apache-2.0, registrar a decisão
por escrito antes de depender dele.

## 3. Estado, regime e navegação

| Biblioteca | Licença | Por que |
|---|---|---|
| **XState** | MIT | Dois usos: navegação (foco, selecionar contra abrir) e **regime nomeado por arquétipo**, que é literalmente um statechart. É o que o LikeC4 usa para o estado do diagrama |
| immer | MIT | Estado imutável sem verbosidade; combina com motor puro |
| nanostores ou Zustand | MIT | Estado de UI leve, fora do motor |
| fast-equals, remeda | MIT | Comparação e utilitários |

## 4. Determinismo

O núcleo do motor depende de aleatoriedade **semeada**. Não usar `Math.random`.

| Biblioteca | Licença | Por que |
|---|---|---|
| **pure-rand** | MIT | PRNG determinístico e portátil, com estado explícito. Do mesmo autor do fast-check |
| seedrandom | MIT | Alternativa mais antiga e conhecida |

Isso não é detalhe de implementação: é o que sustenta `seek` exato, deep link e
comparação honesta de parâmetro.

## 5. Animação

| Biblioteca | Licença | Por que |
|---|---|---|
| **`motion`** (Framer Motion) | MIT | Transição e animação diegética dos arquétipos. Já validado pelo LikeC4 |
| Web Animations API | nativa | Para animação simples, sem dependência |
| anime.js | MIT | Alternativa leve |

**Cuidado:** GSAP é excelente e **não** é licença permissiva padrão — verificar termos
atuais antes de considerar.

## 6. Ler o manifesto

Parser de `compose` não deve custar nada: o formato tem especificação aberta e schema
oficial.

| Peça | Licença | Por que |
|---|---|---|
| **Compose Specification** (`compose-spec/compose-spec`) | aberta | Fonte da verdade. Tem `schema/compose-spec.json` |
| **`compose-spec-schema`** (npm) | MIT | Tipos TypeScript e JSON Schema gerados do spec |
| **`yaml`** (eemeli) | ISC | Preserva comentários e posição — importante se um dia o manifesto virar fonte de verdade editável |
| js-yaml | MIT | Mais simples, se preservar formatação não importar |
| **Ajv** | MIT | Validar o manifesto contra o schema oficial e recusar com mensagem clara |
| `compose-go` | Apache-2.0 | Implementação de referência em Go. Serve como consulta de semântica, não como dependência |

## 7. Validar pacote de modelo

| Biblioteca | Licença | Por que |
|---|---|---|
| **Zod** | MIT | Schema e tipo na mesma declaração; bom para pacote de terceiro |
| Valibot | MIT | Alternativa menor |
| Ajv + JSON Schema | MIT | Se o pacote precisar ser validável fora de TypeScript |

## 8. Testes

O que sustenta a promessa de que o modelo não mente.

| Biblioteca | Licença | Por que |
|---|---|---|
| **Vitest** | MIT | Já em uso |
| **fast-check** | MIT | **Property testing.** A propriedade central — vista agregada é exatamente o tráfego que cruzou as portas — só se testa assim, para qualquer objeto e qualquer tick |
| **Playwright** | Apache-2.0 | Smoke de navegação: abrir, descer, selecionar, avançar |
| `@testing-library/react` | MIT | Já em uso |

## 9. Embarcar o componente real

Quando o real roda no navegador, embarcar é mais fiel e mais barato de manter que
modelar. Ver a decisão em `VISION.md` §8.

| Peça | Licença | O que resolve |
|---|---|---|
| **PGlite** | Apache-2.0 | Postgres compilado para WASM, ~3 MB, roda no navegador. Verificado. Roda em conexão única: réplica e WAL continuam modelo |
| **v86** | BSD-2-Clause | Emulador x86 em WASM; roda Linux de verdade no navegador. **Fora de escopo agora** — a camada de plataforma saiu (`VISION.md` §7.2). Registrado para quando a decisão for revista |
| **Aedes** | MIT | Broker MQTT em JavaScript — roda de fato, não simulado |
| sql.js, DuckDB-WASM | MIT | Bancos embarcáveis para labs de consulta |
| **xterm.js** | MIT | Terminal no navegador, se algum lab tiver linha de comando |
| **Comlink** | Apache-2.0 | Rodar a simulação em web worker sem travar a interface |

**Não usar:** **WebContainers** (StackBlitz) e **CheerpX** são proprietários, com
restrição de uso comercial. Atraentes e fora da premissa de ser tudo open source.

## 9.5 L2 e L3: as ferramentas que faltavam neste levantamento

**Acrescentado em 28/08/2026.** Este documento foi escrito antes de o diferencial ser
precisado em L2 (Wire) e L3 (Payload) — `DECISIONS.md` §6. E são justamente os dois níveis com
exigência técnica própria, que nenhuma linha acima cobria.

### L3 · Payload: protobuf de verdade, não ilustração

O princípio 1 da spec do handbook proíbe ilustração decorativa, e a §4 é explícita: *o JSON
não é mock ilustrativo, é o mesmo dado que produzia a animação no nível de cima*. Isso exige
codificar e decodificar OTLP no browser.

| Peça | Escolha | Licença | Nota |
|---|---|---|---|
| Runtime protobuf | **`@bufbuild/protobuf`** | Apache-2.0 AND BSD-3-Clause | Conformante nos testes oficiais; ESM e TypeScript de primeira classe |
| Alternativa | `protobufjs` | BSD-3-Clause | Maduro e sem `protoc`; API mais antiga |
| Schemas OTLP | **`opentelemetry-proto`** | Apache-2.0 | Os `.proto` oficiais. **Domínio: vive em `otel-domain`, nunca em `depth-core`** |
| Visão de bytes | Componente próprio | — | Grade hexadecimal com destaque de campo. Simples, e ninguém tem exatamente isto |

Cuidado de fronteira: o runtime de protobuf é agnóstico e pode viver no motor; **os schemas
OTLP não**. `scripts/check-boundaries.mjs` pega isso, e é bom que pegue.

### L2 · Wire: enquadramento, e a decisão de modelar contra capturar

Frames HTTP/2 têm duas fontes possíveis, e a escolha é de fidelidade.

| Caminho | O que dá | Custo |
|---|---|---|
| **Modelar** o enquadramento como `modelet` | Roda em qualquer tick, responde a parâmetro, é reprodutível | Precisa ser fiel à RFC 9113 |
| **Capturar** do `labs/<slug>/` real e usar como fixture | Fidelidade sem discussão | Não responde a parâmetro; é gravação |

Recomendação: **modelar, com fixture capturada como teste**. Assim o L2 reage a parâmetro — que
é o requisito do princípio 1 — e a fixture serve de oráculo no CI, provando que o modelo
concorda com o que o Collector real produziu.

Ferramentas de **autoria** para capturar a fixture, fora do bundle:

| Necessidade | Ferramenta | Nota |
|---|---|---|
| Capturar OTLP real | `debug` e `file` exporters do próprio Collector | Sem dependência nova; sai do `compose` do lab |
| Inspecionar frames | `tcpdump` mais Wireshark, ou `nghttp` | Só na autoria, não no produto |
| Gerar telemetria de teste | `telemetrygen` (repositório do Collector) | Alvo controlado |

Nada disso entra no site publicado. É bancada, não produto.

### Playground: o que ele exige além do palco

Nada novo, e é a razão de ele ser barato (`why-simulate.md` §10):

| Necessidade | De onde vem |
|---|---|
| Recusar ligação inválida | `isValidConnection` do React Flow |
| Paleta arrastável | Arraste nativo mais `onDrop` do React Flow |
| Porta tipada | Handles com `id` e tipo, já necessários para as portas |
| Validar rascunho | O mesmo Zod do pacote de modelo, com procedência **não** exigida |

---

## 10. Site, conteúdo e medidores

| Peça | Licença | Por que |
|---|---|---|
| **Astro** | MIT | Já em uso |
| Starlight | MIT | Se a trilha crescer e precisar de estrutura de documentação |
| MDX, remark, rehype | MIT | Conteúdo com componente interativo embutido |
| Shiki | MIT | Realce de sintaxe para os manifestos exibidos |
| **uPlot** | MIT | Gráfico de medidor: leve e rápido, adequado a série que atualiza por tick |
| Observable Plot | ISC | Alternativa mais expressiva |
| Simple Icons | CC0 | Logos das ferramentas modeladas — **conferir a política de marca de cada projeto**, licença de ícone não é permissão de marca |
| Tabler Icons | MIT | Ícones de interface |

## 11. Compartilhar e colaborar

| Peça | Licença | Por que |
|---|---|---|
| **lz-string** ou **fflate** | MIT | Comprimir o estado na URL — semente, foco, tick, parâmetros |
| Yjs | MIT | Colaboração em tempo real, se um dia |

## 12. Onde não reaproveitar

Três peças precisam ser do projeto, e é importante saber por quê:

- **O motor de simulação.** Existem bibliotecas de simulação de eventos discretos, mas
  nenhuma entrega o conjunto que é o diferencial: determinismo por `(seed, tick)`,
  histórico com `seek` exato, parâmetro como evento no tempo, e as três regras de
  honestidade — só folha tem comportamento, vista agregada é projeção de fronteira,
  medidor só lê tráfego de porta. Adotar motor de terceiro custaria essas garantias
- **O catálogo de arquétipos e o resolvedor de imagem para pacote.** É o conhecimento de
  domínio destilado; nenhuma biblioteca tem isso
- **O contrato de fidelidade.** Ligar cada parâmetro ao ajuste real documentado, com
  falha de CI, é específico da tese deste projeto

## 13. Referências de método, não de código

| Projeto | Licença | Uso permitido aqui |
|---|---|---|
| **PhET** | Código GPL-3; simulações relicenciadas para **CC BY-NC** | O **método** é livre para adotar: nenhum controle sem medidor que responda a ele na mesma tela. **Importar código ou asset não é** — GPL-3 é incompatível com Apache-2.0 no mesmo binário, e NC exclui uso comercial |
| **Cisco Packet Tracer** | **Proprietário** | Referência de sensação de uso. Nunca código nem asset |
| **containerlab** | open source | O análogo aberto do Packet Tracer: topologia declarada em YAML virando lab em containers. Mesma premissa de entrada deste projeto, já provada em redes |
| **Wokwi** | `wokwi-elements` MIT (só apresentação); motor **fechado**; docs CC BY 4.0 | Referência de produto. A divisão dele — desenho aberto, motor fechado — é o inverso da intenção deste projeto |
| **Logisim Evolution** | GPL-3 | Prova de que abrir o bloco ensina. Referência conceitual |
| **Ptolemy II** | permissiva, estilo BSD | O conceito de *director* por nível hierárquico. Vale estudar o vocabulário |
| **LikeC4** | MIT | Vista como projeção do modelo, e a stack que ele já validou em produção |

## 14. Resumo da decisão proposta

| Área | Escolha | Licença |
|---|---|---|
| Palco | `@xyflow/react` | MIT |
| Layout | dagre agora, elkjs se necessário | MIT / EPL-2.0 ou GPL-3 |
| Estado e regime | XState | MIT |
| Aleatoriedade | pure-rand | MIT |
| Animação | `motion` | MIT |
| Manifesto | `yaml` + Ajv + `compose-spec-schema` | ISC / MIT |
| Pacote de modelo | Zod | MIT |
| Testes | Vitest + fast-check + Playwright | MIT / Apache-2.0 |
| Medidores | uPlot | MIT |
| **Payload (L3)** | **`@bufbuild/protobuf` + `opentelemetry-proto`** | **Apache-2.0 AND BSD-3-Clause / Apache-2.0** |
| Componente real embarcado | por alvo: PGlite, v86, Aedes | Apache-2.0 / BSD-2 / MIT |

Nenhuma dessas escolhas entra sem um commit que a justifique. Dependência nova em
projeto de ensino é passivo de manutenção, não vitória.

## 15. Lista de compras, por fase

O que instalar quando, para não carregar dependência antes da hora.

| Fase (`roadmap.md`) | Entra |
|---|---|
| **F1 · Núcleo** | `pure-rand`. Nada mais — o motor é TypeScript puro, sem I/O |
| **F3 · Palco** | `@xyflow/react`, `dagre`, `xstate`, `motion`, `uplot` |
| **F2 · Piloto** | `@bufbuild/protobuf`, `opentelemetry-proto` (em `otel-domain`), `zod` |
| **F4 · Importador** | `yaml`, `ajv`, `compose-spec-schema` |
| **Testes, desde F1** | `vitest`, `fast-check`; `playwright` a partir de F3 |
| **Autoria, fora do bundle** | Nada novo: exporters `debug` e `file` do Collector, mais `telemetrygen` |
| **Nunca** | tldraw, WebContainers, CheerpX — licença |

Contagem: **onze dependências de runtime** para a v0 completa, e três delas só aparecem no
importador. `elkjs` e `@lume/kiwi` ficam de reserva, entrando apenas se dagre e o clamp do
React Flow se mostrarem insuficientes — e nesse caso `elkjs` exige checar EPL-2.0 contra a
licença escolhida para o projeto.

## Deploy: Vercel lê a branch — 2026-08-29

**`main` é produção; `dev` é onde o trabalho acontece.** Toda branch que não é `main` ganha
uma URL de preview própria no Vercel, e é isso que "atualizar sozinho" quer dizer aqui: o
push é o gatilho, e não existe passo manual de publicar.

O que se encontrou ao montar isto, e vale registrado porque nada disso aparecia:

- **O Vercel nunca esteve ligado a uma conta.** O que havia era um deploy anônimo temporário
  (`.vercel/anonymous.json`, com URL de claim e prazo). O token dele nunca foi commitado —
  `.vercel` está no `.gitignore`, e a busca no histórico não achou nada.
- **Quem publicava era o GitHub Pages**, no push para `main` — e a `main` estava **82 commits
  atrás** da branch de trabalho. Nada da Entrega 2 estava no ar.
- **O CI só rodava em `main`.** Os mesmos 82 commits nunca passaram por ele. Agora ele roda em
  toda branch, que é quando o conserto ainda é barato.
- **A branch padrão do repositório apontava para `entrega-1`**, o que também decide o palpite
  de produção do Vercel.

**`engines.node` no `package.json` existe por um motivo específico:** a Vercel **não lê o
`.nvmrc`**. O CI lê, a máquina lê, e a Vercel não — sem o campo, o deploy roda numa versão de
Node diferente das outras duas, e a divergência só aparece no build que quebra. Mantenha os
dois em dia juntos.

**Pendência declarada:** o workflow do GitHub Pages continua ativo e publica no push para
`main`. Com o Vercel em produção são dois publicadores para o mesmo repositório, com caminhos
de base diferentes (`/<repo>/` contra a raiz). A ordem certa é ligar o Vercel, conferir, e só
então aposentar o Pages — desligar antes deixaria o projeto sem nada no ar.

## O servidor de dev quebrava sozinho — 2026-08-29

**Sintoma:** toda página `/docs/*` respondia 500 no `pnpm dev`, com a mensagem
`capítulo "DECISIONS" está no índice e não existe na coleção — ids disponíveis:` (a lista
vazia). O `pnpm build` gerava as dezenove páginas sem reclamar.

**Causa:** o digest de configuração do Astro inclui a **porta do servidor de dev**. Subindo
numa porta diferente da corrida anterior, ele conclui que a configuração mudou, **limpa o
armazém de conteúdo** — e não o repopula naquela mesma corrida. A coleção `docs` vem vazia,
e a página de capítulo morre dizendo que o capítulo não existe.

A mensagem não menciona porta nenhuma, e aponta para o índice e para a coleção. Quem a lê
vai conferir o manifesto, o loader, o caminho do `base` — tudo lugar errado. Provado com
duas corridas: porta nova → coleção vazia; mesma porta de novo → duzentos.

**Correção:** a porta do dev é fixa em `astro.config.mjs` (4321), então o digest não muda
entre corridas e o armazém sobrevive. Precisando de outra porta, a **primeira** subida
depois da troca vem sem os docs — reinicie uma vez e passa.

E o e2e ganhou porta própria (4399). Ele dividia a 4321 com o dev, e a corrida ou pegava o
servidor de dev — que serve outra coisa — ou não subia; nos dois casos a falha aparecia
como asserção estranha, longe da causa. Ele também passou a falar por **IP** e não por
`localhost`: o Chrome resolve `localhost` para IPv6 primeiro, e qualquer processo em
`[::1]` naquela porta sequestra a corrida inteira. Foi o que aconteceu aqui, com um
servidor de dev esquecido — e por um bom tempo eu culpei o lugar errado.
