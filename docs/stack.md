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
| **v86** | BSD-2-Clause | Emulador x86 em WASM; roda Linux de verdade no navegador |
| **Aedes** | MIT | Broker MQTT em JavaScript — roda de fato, não simulado |
| sql.js, DuckDB-WASM | MIT | Bancos embarcáveis para labs de consulta |
| **xterm.js** | MIT | Terminal no navegador, se algum lab tiver linha de comando |
| **Comlink** | Apache-2.0 | Rodar a simulação em web worker sem travar a interface |

**Não usar:** **WebContainers** (StackBlitz) e **CheerpX** são proprietários, com
restrição de uso comercial. Atraentes e fora da premissa de ser tudo open source.

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
| Componente real embarcado | por alvo: PGlite, v86, Aedes | Apache-2.0 / BSD-2 / MIT |

Nenhuma dessas escolhas entra sem um commit que a justifique. Dependência nova em
projeto de ensino é passivo de manutenção, não vitória.
