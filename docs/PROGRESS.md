# Progresso

Registro do que já foi feito, sessão a sessão. **Atualize este arquivo ao fechar cada
sessão**, antes do último commit — é daqui que a próxima sessão descobre onde parou,
sem reler o histórico do git.

Formato de cada linha: o que ficou pronto, o que ficou pendente, e o que a próxima
sessão precisa saber que não está óbvio no código.

---

## Entrega 1 — Fundação e landing ✅

**Plano:** `docs/superpowers/plans/2026-08-28-entrega-1-fundacao-e-landing.md`
**Spec:** `docs/superpowers/specs/2026-08-28-otel-visual-handbook-design.md`

Monorepo pnpm (`depth-core`, `otel-domain`, `depth-ui`, `apps/site`), design system
derivado do canvas, landing com o herói rodando simulação de verdade, guarda de
fronteira motor↔domínio no CI, CI e deploy para GitHub Pages.

Estado: 58 testes unitários, 12 smoke Playwright, build verde. **Empurrada e
mergeada na `main`.**

---

## Marco — as cinco PRs de desenho paralelo, aceitas ✅

**Data:** 2026-08-28. Merge `d3900c0` na `main`. PRs #1–#5 (`kiro/visao-e-stack`,
`kiro/catalogo-de-kinds`, `kiro/consolidado`, `kiro/posicionamento`,
`kiro/formato-do-modelo`), encadeadas — a #3 continha as outras quatro, então um merge
fechou as cinco. 2924 linhas, só `docs/`, zero conflito com código.

Entraram: `DECISIONS.md` (ponto de entrada — leia primeiro), `VISION.md`, `kinds.md`
(catálogo de 19 arquétipos em três ondas), `depth.md`, `model-format.md`,
`why-simulate.md`, `roadmap.md`, `stack.md`.

**Elas contradizem a spec do motor em três pontos, e vencem nos três.** A reconciliação
está registrada na §17 da spec, com a precedência declarada:
`docs/DECISIONS.md` → spec do motor → plano da sessão. Resumo:

1. **A forma da carga muda só na saída de um `transform`** (substitui a §2.3, que
   espalhava a transformação pela fronteira de qualquer objeto). Vira property test:
   com ele verde, o modelo não *consegue* mentir sobre onde a transformação acontece.
   `sink` e `channel` perdem a transformação. → pousa na S2.
2. **Cinco famílias, não três.** Entra `controller` (relógio, árbitro, supervisor,
   sonda — não ficam no caminho do dado) e `container` (`pipeline`/`composite`
   organizam, não processam). → pousa na S1, Task 1c.
3. **Duas espécies de linha**: dado (traço grosso) e controle (tracejado fino). A
   pergunta "por onde o dado passa?" passa a se responder olhando só as grossas.
   → `Wire.line` na S1, Task 1c; a fiação a respeita na Task 2.

O catálogo de 19 `kind`s cresce em ondas (onda 1 na S2: `transform`, `tee`, `merge`,
`batch`, `clock`, `arbiter`). A trava de entrada é a régua deles: **arquétipo entra
pagando em dois alvos.** O que a S1 garante é que acrescentar `kind` seja aditivo —
`familyOf` é um `Record<Kind, Family>`, então esquecer a família de um `kind` novo não
compila.

Dívida que as PRs abriram e ainda não foi paga: predição antes da revelação, o campo
"mal-entendido que este lab desfaz" no `teaches`, e `docs/authoring.md` como interface
pública do projeto.

---

## Marco — licenciamento ✅

**Data:** 2026-08-28. Commit `3b75968`. Era a urgência nº 1 de `DECISIONS.md`:
repositório público sem licença é *todos os direitos reservados*, e até então nada aqui
podia ser reusado por ninguém — o oposto do projeto.

`LICENSE` Apache-2.0 (código), `LICENSE-content` CC BY-SA 4.0 (conteúdo editorial: tudo
em `docs/`, mais prosa, rótulos e `teaches` dos labs), seção no README, campo `license`
nos cinco `package.json`. Duas licenças porque o motor existe para ser reusado como
biblioteca e o material didático para ser reusado como material didático.

---

## Entrega 2 — Motor composicional 🚧

**Spec:** `docs/superpowers/specs/2026-08-28-motor-composicional-design.md` (leia a §17:
é onde ela se reconcilia com as PRs aceitas).

Substitui o modelo de quatro níveis fixos por uma árvore de objetos composta de baixo
para cima. Sessões planejadas (detalhe na §9 da spec):

- [x] **S1 — Motor composicional.** `model`, `tree`, `wiring`, `scheduler`, `world` com
      eventos de parâmetro, `meters` + superfície pública, tudo testado. O modelo antigo
      (`types.ts`, `engine.ts`) segue exportado como andaime até a S5 migrar a landing —
      não usar em código novo. **Plano:**
      `docs/superpowers/plans/2026-08-28-s1-motor-composicional.md`.
      - [x] Task 1 — `model.ts` e `tree.ts` (`c20806a`)
      - [x] Task 1b — retrabalho da revisão de qualidade (`3c9c192`)
      - [x] Task 1b Step 10 — quatro achados da segunda revisão (`564d47c`): fronteira `entry`/
            `exit` validada na **indexação**, não no percurso; `isOpenable` e `entryLeaf`
            param no mesmo predicado; válvulas do invariante cobertas por teste de
            mutação; `byId` tipado como `AnyObject`. 84 testes.
      - [x] Task 1c — cinco famílias e `Wire.line` (`1d92259`)
      - [x] Task 2 — fiação com encadeamento implícito de `pipeline` (`52edf0e`)
      - [x] Task 3 — `stepWorld`: um tick como função pura (`a98c192`)
      - [x] Task 3b — sorteio endereçável (`randomAt`, `pure-rand`), property tests
            (`fast-check`) e fio esquecido separado do descarte (`dbb76e3`)
      - [x] Task 4 — `World` com `seek` exato e parâmetro como evento no tempo (`29c8249`)
      - [x] Task 5 — medidores de porta e travessias de fronteira, com property test de
            que a vista agregada nunca inventa (`b78fafb`, `813d59f`)
      - [x] Task 6 — superfície pública em `index.ts` e guarda de fronteira ampliada a
            protocolo (`d273049`)
      - [x] Task 8 — três críticos da revisão final (`3b8f652`): mensagem entregue a quem
            não age não some mais, `behavior` em placa é recusado, `World` indexa os canais
      - [x] Task 9 — os três achados que sobreviveram (`c9e7b38`). A propriedade da vista
            agregada vira **igualdade**, não inclusão: provava que ela não inventa travessia
            e não provava que ela não esconde nenhuma, e dois mutantes passavam em 128
            testes — um deles jogava fora todo o L0. O rótulo é recalculado dentro do teste,
            porque teste que chama a mesma função do código erra junto com ela. `setParam`
            passa a valer do tick seguinte. A guarda de fronteira falha quando lê zero
            arquivo. E a regra do destino que não age muda de substantivo: vive no **fio**,
            não no nó, senão recusaria agrupamento decorativo. **160 testes.**
- [x] **S1b — Formato do modelo em código** (`@ovh/model-format`). `docs/model-format.md`
      deixa de ser só prosa: schema, validação do documento inteiro e compilador para
      `WorldSpec`. Detalhe na seção "Entrega 2 · S1b" no fim deste arquivo. **Plano:**
      `docs/superpowers/plans/2026-08-28-s1b-formato-do-modelo.md`.
- [ ] **S2 — Arquétipos.** Os oito de hoje **mais a onda 1** de `kinds.md`
      (`transform`, `tee`, `merge`, `batch`, `clock`, `arbiter`): comportamento em
      `depth-core`, contrato visual em `depth-ui`. Aqui também entram o property test
      do invariante do `transform` e os três encolhimentos (`channel` e `sink` perdem a
      transformação, `buffer` perde o agrupamento).
- [ ] **S3 — Palco e navegação.** Foco por caminho, breadcrumb, selecionar vs abrir,
      inspector, deep link.
- [ ] **S4 — Domínio TracerProvider.** Árvore fiel, transformações de mensagem, textos
      ancorados na spec oficial. Teste 6.
- [ ] **S5 — Migração e limpeza.** Herói da landing no modelo novo, modelo antigo
      deletado, guarda de fronteira ampliada.
- [ ] **S6 — Acabamento.** Modelo estrito de desenho (moldura com recorte, faixas,
      portas), regime nomeado + log de eventos, perturbações, canal-como-aresta
      abrível, smoke.

---

## Marco — teoria do motor ✅

**Data:** 2026-08-29. Commits `4cdd962` e seguinte. `docs/theory.md`: o motor descrito nos
formalismos de que ele é instância, e o que cada um cobra em teste.

Grafo hierárquico com duas espécies de aresta; profundidade é contração, e a vista de
fronteira é a imagem do run sob essa contração. Redes de Petri coloridas são o parente mais
próximo (`kind` é a cor; `edgeTicks` é o carimbo de CPN temporizada; o invariante do
`transform` é preservação de cor em expressão de arco) — com o preço declarado: **simulamos,
não verificamos.** Markov na ordem certa: para semente fixa o mundo é trajetória
determinística, e é isso que torna o `seek` exato; a cadeia aparece ao quantificar sobre a
semente. Rede de Markov entra como **fronteira, não promessa**.

A §5 é a mais importante: o que o motor NÃO é. Em primeiro lugar o **relógio global**, que
ensina de graça uma coisa falsa sobre sistema distribuído. Ou um lab ataca isso de frente, ou
o texto declara o limite em voz alta.

E a §7 abriu uma frente: **a CPU como prova de genericidade** — caminho de dados com assembly
de entrada e drill-down até a porta lógica, virando a fase **F6** do `roadmap.md`. Ela tem
público (material para as aulas do pai do Luigi), e já nomeou três lacunas reais do motor:
linha de controle sem semântica, ler sem consumir, e combinacional contra registrado. Nenhuma
se resolve com um `kind` novo.

**Decidido em 29/08/2026: a CPU passa na frente do Kafka e também do OTel.** Ordem nova:
F1 núcleo → F3 palco → F2 piloto → F2b arquétipos → **F6 CPU → F6b ATmega** → F4 otel →
F5 handbook → F7 kafka → F8 extração. Os identificadores de fase são nomes, não sequência.

Dois argumentos. Contra o Kafka: ele é vizinho do OTel, então reuso entre os dois quase não
prova nada, e extrair o motor tendo visto só mensageria produziria um motor de mensageria com
outro nome. Contra o OTel: o que falta lá é sobretudo **editorial** — currículo, texto,
procedência — e esse trabalho consome tempo sem pressionar o motor; a CPU é o oposto, quase
sem texto e com verdade de campo dura. Ela amadurece o motor por unidade de esforço, e motor
maduro é pré-requisito de o OTel ficar bom.

**O risco está declarado junto com a trava.** O projeto se chama OTel Visual Handbook e acaba
de adiar o OTel; se a CPU virar o produto, trocou de identidade sem decidir trocar. Por isso a
F6 carrega um **critério de reentrada**: ela termina quando as cinco mudanças da F1 fecharem e
o `cpu-domain` rodar um programa de verdade sem `depth-core` ter ganhado uma linha que saiba o
que é um registrador. A hora de parar é a hora em que a próxima tarefa da CPU não ensina mais
nada ao motor — e isso virou linha na tabela de sinais do roadmap.

**Duas mudanças migraram da F6 para a F1**, porque são de contrato: semântica da linha de
controle (muda a assinatura de `Behavior`) e **fases do tick** (muda o significado de "um
passo" para todo arquétipo já escrito). A F1 sempre disse ser "a fase que pode revelar que o
tick único não aguenta"; a CPU revelou antes de ela começar, e a resposta já é conhecida —
acomodação até o ponto fixo, depois entrega do que atravessa aresta registrada, com laço
combinacional recusado na construção do mundo.

**Depois da CPU genérica vem um ATmega** (F6b), e não é repetição: a CPU testa mecanismo, o
ATmega testa fidelidade contra um datasheet que não controlamos. Ele traz **interrupção** —
controle assíncrono que preempta o fluxo —, que é o primeiro fenômeno da lista que talvez não
caiba nas primitivas atuais, e por isso o mais valioso de tentar.

---

## Entrega 2b — site, documentação navegável e Vercel 🚧

**Plano:** `docs/superpowers/plans/2026-08-28-e2b-site-docs-e-vercel.md`

- [x] Task 1 — caminho-base configurável e `vercel.json` (`b078197`). A Vercel serve na raiz,
      o Pages num subdiretório: quem chama o build declara onde vai servir.
- [x] Task 2 — documentação como coleção do Astro lendo `../../docs`, com taxonomia num
      manifesto (`src/data/docs-index.ts`). Os documentos **não ganham frontmatter**: eles
      também são lidos no repositório. O teste tem as duas direções — capítulo do índice que
      não existe, e documento que existe e não está em tema nenhum.
- [x] Task 3 — páginas de documentação: índice à esquerda, sumário à direita, tempo de
      leitura com código pesando mais que prosa, anterior/próximo, editar no GitHub.
- [x] Task 4 — busca estática com Pagefind, indexando só o conteúdo (a navegação leva
      `data-pagefind-ignore`, e isso está verificado no índice construído).
- [ ] Task 5 — landing com navegação, os quatro níveis como peça visual, a documentação no
      roteiro com estado real, moldura bilíngue. **Falta a verificação**: e2e verde e a
      auditoria de contraste nos dois temas.

Armadilhas do Astro que custaram tempo e não estão em lugar nenhum da documentação dele:
**literal de expressão regular dentro de expressão no template quebra o parser** (a barra
fecha a tag — por isso `src/lib/urls.ts` existe), e **função de seta com corpo em bloco
devolvendo marcação também**. As duas dão o mesmo erro inútil: `Syntax error "a"`.

Depois da Entrega 2:

- **E3 — Cenários, encaixe tipado e manifesto** (spec §14–15). Manifesto é config real
  (env vars do SDK / config declarativa), com contrato de fidelidade obrigatório.
  Faseado: exportação de mão única primeiro, manifesto como fonte da verdade depois.
- **E4 — Meter e Logger provider**, reaproveitando os `Kind`s.

**Protótipo navegável** (validado com o Luigi em 2026-08-28):
`claude.ai/code/artifact/fc302e68-488b-4e8e-9037-74a0a0352e17`. Fonte em scratchpad,
descartável — é maquete de decisão, não código de produção. Serve como referência
visual e de interação para S2, S3 e S6.

### O que a Entrega 2 quebra de propósito

`LevelId`, `Scenario` e `StepContext.inputs` como estão hoje. O modelo antigo pode
coexistir dentro de `depth-core` enquanto a reescrita acontece, para manter `main`
verde — mas precisa estar **deletado** antes de a entrega fechar. Coexistência é
andaime, não arquitetura.

### Decisões desta entrega que não estão no código

Todas na spec, mas as que mais custam se forem esquecidas:

- **Só folhas têm comportamento.** Objeto composto nunca tem comportamento próprio.
- **Mudar parâmetro não zera o tick.** O mundo reage de onde está.
- **Medidor só lê tráfego de porta**, nunca estado interno. Não existe caminho de
  `meters.ts` para `state.nodes` — a assinatura das funções nem recebe o que precisaria
  para espiar.
- **A vista agregada é projeção de fronteira do mesmo run**, nunca autorada à parte.
  `scheduler.property.test.ts` prova, com property test, que ela nunca inventa
  travessia que não aconteceu.
- **Fio esquecido é contado em `.unwired`**, separado do descarte deliberado
  (`@drop`). Silêncio de fiação e decisão de descartar são coisas diferentes, e o
  livro-caixa não pode confundir uma com a outra.
- **Sorteio é endereçável** por `(seed, tick, salt)`, nunca um fluxo com estado
  escondido. É isso que torna o `seek` do `World` exato em vez de aproximado: rebobinar
  é reler, não reexecutar do tick 0.
- **Visual pertence ao `Kind`, nunca ao objeto.** Sem essa trava, nada termina.
- **A chamada da API não é filha do TracerProvider**, e `BatchSpanProcessor` *é* um
  `SpanProcessor`. Fidelidade da árvore é o produto.
- **`composite` ≠ `pipeline`.** O TracerProvider é `composite` (contêiner sem ordem
  imposta); só a lista de SpanProcessors é `pipeline`, porque só ali a ordem importa.
- **Canal é a LINHA, não um bloco.** Bloco é processador (age sobre o dado); linha é o
  que carrega. Desenhar canal como caixa ensina errado.
- **Vocabulário do motor nunca é conteúdo.** `kind`, `composite`, "tráfego de porta"
  vivem atrás do modo autor. Se vazam, o handbook explica a si mesmo.
- **Contenção é estrutural.** Moldura com `clipPath` real — não uma checagem que alguém
  pode esquecer de escrever.
- **O histórico do `World` é ilimitado, e isso é dívida declarada.** Guardar todo
  estado desde o tick 0 é o que torna o `seek` exato; um limite qualquer transformaria
  "exato" em "exato dentro de uma janela", em silêncio. A saída certa quando doer é
  checkpoint mais re-simulação até o alvo — preserva a exatidão e limita a memória.
  Não invente um teto antes disso.
- **Controlador não fica no caminho do dado.** Árbitro, relógio e supervisor
  influenciam quem está no caminho, mas não recebem a carga. Tratá-los como processador
  obrigaria a inventar um fluxo que não existe — o mesmo erro que a placa evita.
- **Escala de tempo declarada** (1 tick = 100 ms) e valor real ao lado de todo controle.
  Tick abstrato é pior: o leitor inventa a correspondência e a gente não pode corrigir.

---

## Entrega 2 · S1b — Formato do modelo em código ✅

**Data:** 2026-08-29. **Plano:** `docs/superpowers/plans/2026-08-28-s1b-formato-do-modelo.md`

Pacote novo `@ovh/model-format`, entre o motor e o conteúdo. Ele conhece `kind`, porta,
fio e parâmetro — vocabulário do motor — e por isso **entrou na guarda de fronteira**
junto com `depth-core` e `depth-ui`.

- `schema.ts` — porta, parâmetro e fio em Zod, todos `.strict()`.
- `modelet.ts` — `parseModelet`: YAML → `Modelet` validado, com as regras que só valem
  olhando o documento inteiro.
- `compile.ts` — `compileModelet`/`compileSource`: `Modelet` → `WorldSpec` que o `World`
  roda.
- `behaviors.ts` — o comportamento mínimo de `source`, `buffer` e `sink`, que é o que
  falta para um `WorldSpec` compilado ser executável.

**42 testes** no pacote (216 no repositório).

### Decisões desta sessão que não estão óbvias no código

- **O compilador recusa `kind` de onda futura em vez de fingir**, dizendo em que onda ele
  chega (`clock` → onda 1). Um lab que roda errado é pior que um lab que não roda. `kind`
  fora do catálogo é erro de digitação, e a mensagem lista os disponíveis.
- **Porta órfã e parâmetro morto são erro, não aviso.** Porta declarada que nenhum fio usa
  aparece no desenho sem fazer nada; parâmetro que nenhum filho referencia vira controle
  que não controla.
- **As regras são de igualdade, não de inclusão.** Todo fio aponta para porta que existe
  *e* toda porta é usada; todo `{ param: x }` cita parâmetro que existe *e* todo parâmetro
  é citado. Provar só um lado deixaria passar metade dos desenhos que mentem.
- **As pontas dos fios saem do parse já resolvidas** (`Endpoint` discriminado). Depois do
  parse ninguém parte `"queue.out"` em dois, então ninguém pode partir errado — e o nome
  recusa `.` e `:` no próprio nome, não em quem o usa.
- **A tabela `CONTRATOS` é o coração do compilador**: por `kind`, as portas de entrada, as
  de saída e os argumentos que ele de fato implementa. Emissão numa porta que ninguém
  entrega e argumento que o autor configura sem nada ler são a mesma mentira silenciosa,
  vista de dois lados; a tabela torna as duas impossíveis.
- **Parâmetro `enum` não entra em `WorldSpec.params`.** Params do motor são números, e um
  nome não tem número honesto — indexar a lista inventaria uma correspondência que ninguém
  declarou. Fica em `ParamInfo`, com os valores. Duração vira milissegundos, com a unidade
  ao lado.
- **A fronteira é alimentada por contorno** (`model-format.md` §1.2): porta de entrada
  ganha fonte sintética, porta de saída ganha consumo sintético, porta de descarte vai
  para `DROP`. Os nós de contorno usam o prefixo `@`, que nenhum nome do formato pode ter.

### O que ficou de fora, e por quê

- **Cinco dos oito `kind`s de hoje não compilam como filho**, cada um com a sua mensagem:
  `composite`/`pipeline` (contêiner não é folha), `channel` (canal é aresta), `router`
  (precisa de política de rota, que o formato não declara) e `static` (precisa de conteúdo,
  que o formato não declara). Compilam: `source`, `buffer`, `sink`.
- **Fio de controle que toca um filho é recusado.** Nenhum `kind` de hoje tem porta de
  controle — `clock` e `arbiter` chegam na onda 1. Fio de controle entre portas da
  fronteira vale, chega ao `WorldSpec` com `line: "control"` e a fiação de dado o ignora.
  **Dívida:** o escalonador não entrega nada por linha de controle; hoje ela é declaração,
  não caminho. Quando o `clock` chegar, isso precisa mudar junto.
- **Duas linhas de dado saindo da mesma porta são recusadas** — `resolveTarget` segue só a
  primeira, então a segunda seria desenho sem percurso. Replicar carga é o `tee`, da onda 1.
- **`modelet` aninhado dentro de `modelet` não existe**, e o `.model` (a camada de cima,
  §4 de `model-format.md`) não foi tocado. O compilador só monta um `modelet` isolado.
- **A posição do erro no YAML não é usada.** O pacote `yaml` preserva linha e coluna, e as
  mensagens ainda apontam para o caminho do campo, não para a linha do autor.

---

## Sessão — OpenLabs: o projeto passa a ser a casa dos handbooks

**Data:** 2026-08-29. **Decisão:** `docs/DECISIONS.md`, seção "O enquadramento: OpenLabs".

O projeto vira **OpenLabs**; o handbook de OTel e o da CPU viram dois `.model` sobre o
mesmo motor. No site: catálogo em `apps/site/src/data/handbooks.ts`, cartão
(`HandbookCard.astro`), índice em `/handbooks/` e página por handbook em
`/handbooks/[id]/` com a anatomia **roadmap · artigos · labs**. O mapa interativo saiu
da landing e foi para a página do handbook de OTel — é dele, não da capa; o do RISC-V
ainda não tem mapa, e a página diz isso em vez de desenhar um caminho não andado.

Estado: 253 testes unitários (11 novos, do catálogo), 46 e2e (5 novos), build,
typecheck e guarda de fronteira verdes.

**Pendente e não óbvio:** o plano do Bloco 1 da CPU
(`docs/superpowers/plans/2026-08-29-f6-b1-fases-do-tick-e-controle.md`) está escrito e
ainda não executado — é a próxima coisa a fazer. E as fases do RISC-V no catálogo são
desenho editorial, não a spec: quando o `cpu.model` existir, os labs de lá viram
`available` um a um.

---

## Bloco 1 da CPU — as duas fases do tick e a linha de controle

**Data:** 2026-08-29. **Plano:**
`docs/superpowers/plans/2026-08-29-f6-b1-fases-do-tick-e-controle.md`.
**Commit do coração:** `8b0c662` (as duas fases em `stepWorld`).

O motor ganhou o que a CPU exige e o OTel não pedia — e nenhum arquivo do motor
menciona o assunto:

- **Duas fases por tick:** acomodação (propaga dentro do tick) e confronto (onde o
  estado muda e nascem as mensagens que custam tick). `ctx.phase` diz em qual delas
  o comportamento está rodando
- **O padrão da aresta é `clocked`**, então nenhum mundo escrito antes mudou de
  comportamento — foi o que manteve os 242 testes anteriores verdes
- **A acomodação percorre um DAG em ordem topológica _porque_ o laço combinacional é
  recusado na construção.** Some a iteração e some o teto de rodadas: cada ator roda
  uma vez só, com o conjunto completo das entradas dele. A alternativa (teto de
  iterações) transformaria "não converge" em "converge errado", em silêncio
- **A profundidade topológica é o atraso de propagação**, e virou
  `WorldState.substeps`. Conta o nível de quem *recebeu*, não o de quem emitiu: o
  último elo de um caminho combinacional costuma ser um elemento de memória, que na
  acomodação não emite nada
- **Quem acomoda não guarda:** o `state` devolvido na fase de acomodação nem chega a
  ser lido. A diferença entre lógica combinacional e elemento de memória virou
  estrutural, não disciplina
- **Emitir na fase errada lança**, dizendo qual fase aquela porta espera. Uma porta é
  de um regime só, e isso é recusado na validação
- **O eixo `sigin:` é separado de `in:`/`out:`** porque o medidor de porta lê só os
  eixos de carga — ele portanto **não consegue** enxergar sinal, e a pergunta "quanto
  dado passou aqui?" continua tendo resposta
- **A guarda de fronteira passou a vigiar dois domínios**, com duas listas e um só
  mecanismo de busca. Ela já pegou três comentários meus que diziam "registrador"

Estado: 291 testes unitários, typecheck, boundaries e build verdes.

**Pendente e não óbvio:** desenhar os subpassos na tela é do Bloco 3 (`depth-ui`);
fan-out de dado, multiplicidade e atalho com equivalência provada são o Bloco 2. Duas
correções que fiz contra o plano escrito, e que valem para quem for reler: `substeps`
conta receptores (o plano contava emissores e o próprio teste dele exigia o contrário),
e a asserção do eixo de carga em `control.test.ts` fecha por conservação
(chegou + em voo == emitido) em vez de ignorar o atraso da aresta.

---

## Bloco 2 da CPU — fan-out, multiplicidade e atalho provado

**Data:** 2026-08-29. **Plano:**
`docs/superpowers/plans/2026-08-29-f6-b2-fanout-multiplicidade-atalho.md`.

Fecha o contrato do motor. Continua sem uma linha de CPU em lugar nenhum:

- **Leque de carga é nativo da porta.** `n` fios entregam `n` cópias; `out:` conta **uma**
  emissão e cada destino conta o seu `in:`, e as duas divergirem é informação — é quanto a
  saída se espalhou. `resolveTarget` virou `resolveTargets(...)[0]`, um mecanismo só. Há
  teste provando que o leque é igual nas duas fases: a acomodação já percorria todos os
  fios, e mudar só o confronto faria o mesmo desenho entregar diferente conforme o regime
  da porta
- **Caiu a recusa de `f281ece`**, no motor e no compilador — ela existia porque o motor
  percorria só o primeiro fio
- **`tee` saiu do catálogo** (`docs/kinds.md`), riscado com o motivo em vez de apagado, e
  com a dívida que ele levou junto: **política de falha parcial** ("exige todas, ou basta
  uma") pertence ao regime da aresta, e volta com backpressure
- **`×N` e `/N` existem e são validadas.** `replicas: N` exige N filhos de fluxo do mesmo
  kind — a marca diz "desenhe um destes N" e os N existem de verdade. `width: N` é marca de
  desenho e **não conta nada**: há teste comparando o livro-caixa inteiro com e sem ela
- **`ObjectSpec.shortcut`**: o contêiner age e a subárvore dele não roda. Roda **sempre**,
  nunca "quando ninguém está olhando" — condicioná-lo ao que o leitor abriu faria a resposta
  do modelo depender da navegação
- **A prova**, em `shortcut.ts`: `shortcutDisagreement` roda os dois caminhos e compara a
  **projeção de fronteira** (estado e livro-caixa de quem está de fora), não o interior nem
  os ids de mensagem — os emissores são outros por construção, e exigir id igual reprovaria
  um atalho correto

Estado: 308 testes unitários, typecheck, boundaries e build verdes.

**Achado que vale para quem for escrever atalho:** um atalho só empata com a composição se a
cadeia interna **acomodar**. Com aresta cronometrada por dentro, a composição responde um
tick depois, e o atalho estaria mentindo sobre latência mesmo acertando o valor. A fixture
de teste mostra isso — e é o caso real, porque atalho existe para cadeia que fecha dentro
do ciclo.

**Pendente:** desenhar `×N`, `/N` e os subpassos é o Bloco 3 (views, em `depth-ui`).
Expandir réplicas automaticamente a partir de um modelet continua fora: quem instancia os N
é quem escreve o modelo, e o motor cobra que eles existam.

---

## Blocos 4 e 5 da CPU — o caminho de dados executa programas de verdade

**Data:** 2026-08-29. **Pacote novo:** `packages/cpu-domain` (`@ovh/cpu-domain`) — o único
lugar do repositório que pode saber o que é um registrador.

O que existe e roda:

- **`isa.ts`** — a tabela do subconjunto RV32I, e o **único** lugar que sabe como uma
  instrução vira 32 bits. Montador e caminho de dados leem dela; duas tabelas fariam um erro
  de codificação aparecer como erro de execução, no lugar errado. Palavra fora do
  subconjunto decodifica para `null`, nunca para "a mais parecida"
- **`assembler.ts`** — assembly com rótulos e comentários, erro com **linha e coluna** em
  português. Acusa rótulo inexistente, rótulo repetido, deslocamento fora de 0–31, forma
  errada de acesso à memória e instrução fora do subconjunto
- **`reference.ts`** — intérprete direto, sem motor nenhum, para discordar do modelo
- **`datapath.ts`** — o caminho de dados como composição no motor: relógio, PC, memória de
  instruções, decodificador, unidade de controle, banco, mux de operando, ULA, memória
  principal, mux de escrita e unidade de desvio

**Uma instrução por tick, e as duas fases do tick são o relógio.** Busca, decodificação,
leitura, ULA e memória fecham na **acomodação**; PC, banco e memória escrevem no
**confronto**. O que atravessa a borda de relógio viaja em aresta `clocked`, e **a mensagem
em voo é o valor esperando o flanco** — é por isso que o laço `pc → … → pc` não é laço
combinacional. Trocar essa aresta para acomodada faz o motor recusar o mundo na construção,
e há teste sobre isso.

O bloco 2 apareceu inteiro sem ser forçado: a saída da ULA alimenta **dois** destinos pelo
leque nativo, e as cinco linhas de controle são contadas em `sigin:`, fora da conta de carga.

**O diferencial roda instrução a instrução** e compara `x0`–`x31`, o `pc` e a memória tocada:
aritmética com estouro, lógica e deslocamentos com e sem sinal, desvio tomado e não tomado,
`lw`/`sw` com deslocamento, `jal`/`jalr`, `jalr` com alvo ímpar, `x0` como destino, e um laço
que termina. Verificado por mutação — tirar a guarda de `x0` mata 2 testes, trocar `sub` por
`add` mata 1, e tirar o zeramento do bit 0 do `jalr` **não matava nenhum** até o programa de
alvo ímpar entrar.

Estado: 327 testes, typecheck, boundaries e build verdes.

**Pendências declaradas, que não são detalhe:**

1. **O emulador de terceiro ainda não entrou.** O intérprete de referência é meu, e
   compartilha `isa.ts` com o modelo: isto prova **execução**, não codificação, e um
   mal-entendido meu sobre o que uma instrução faz apareceria igual dos dois lados. A spec
   §7 pede um emulador independente com licença permissiva verificada — continua pendente,
   e está escrito dentro de `reference.ts` para ninguém confundir com feito
2. **A unidade de controle é `kind: "router"`** porque o catálogo não tem `kind` da família
   `controller` — `clock` e `arbiter` são onda 1. A família está certa no papel
3. **Código automodificável diverge**: a memória de instruções é lida da imagem inicial e a
   principal é outro objeto. Está em `§9 o que não é modelado`
4. **Falta a fatia vertical** (bloco 6: somador aberto → somador completo → portas →
   transistores) e as **views** (bloco 3). O que existe hoje roda e é conferível; ainda não
   é bonito

---

## Bloco 3 e 7 — as views, e o caminho de dados na tela

**Data:** 2026-08-29. **Página:** `/labs/cpu/`.

**O mecanismo (`depth-ui`):**

- **`view.ts`** — uma view é a **disposição inicial** dos objetos para um foco. O invariante:
  ela decide **onde** e **como**, nunca **o que existe** nem **o que se liga a quê**. O teste
  é igualdade: `viewDisagreement` recusa view que inventa objeto, que desenha alguém de fora
  do foco, que repete um objeto, que dá área zero, que corta na moldura — e, principalmente,
  que **esconde sem declarar `collapsed`**. Esconder é legítimo; esconder calado não é
- **`Stage.tsx`** — a view desenhada com o estado por cima. **Nada se move sozinho:** toda
  animação é disparada por uma diferença no livro-caixa entre dois ticks, então um objeto
  parado na tela é um objeto que de fato não fez nada naquele tick. As caixas vêm da view, as
  linhas vêm dos fios, o movimento vem do livro-caixa
- **A família escolhe a forma e o gesto**: `processor` tem engrenagem, e ela só gira quando
  ele agiu; `container` é moldura e nunca se mexe; `controller` fica na cor do sinal. E uma
  correção que vem do modelo e não da view: **quem só emite por linha de controle é
  controlador**, tenha o `kind` que tiver — enquanto o catálogo não tem `kind` dessa família,
  o desenho lê o fato onde ele está escrito, nos fios
- O pulso ao longo do fio acende **todos** os fios que saem da porta, porque o leque é
  nativo; mostrar só o primeiro seria voltar a mentir sobre o percurso

**O lab (`/labs/cpu/`):** editor de assembly, montar-e-reiniciar (programa não é parâmetro:
programa novo é mundo novo), rodar/pausar, um ciclo por clique, compasso do relógio,
duas views (`sistema` e `processador`), painel de registradores e a instrução atual.

Estado: 345 testes unitários, 56 e2e, typecheck, boundaries e build verdes.

**O que ficou para a próxima iteração** (o Luigi já disse que vamos iterar):

- **Roteamento dos fios** é ortogonal simples e ainda cruza caixa quando o caminho é longo.
  Falta desviar de obstáculo
- **Portas lógicas acendendo** com a combinação certa depende do bloco 6 (a fatia vertical
  até o transistor) — hoje não há porta nenhuma modelada
- **A esteira transformando a carga** aparece por cor de `kind`; falta a forma mudar
- **`×N` e `/N`** são marcas de canto; falta o contorno empilhado e o feixe desenhado
- `substeps` já é contado e mostrado em número; falta **andar dentro do tick**, que é o
  que transforma o atraso de propagação em algo que se vê

---

## Bloco 6 — a fatia vertical: o somador aberto até a porta lógica

**Data:** 2026-08-29. **Página:** `/labs/gates/`. **Código:** `packages/cpu-domain/src/gates.ts`.

**A codificação que faz uma porta lógica caber no motor sem primitiva nova:**

> **A presença da mensagem é o bit em alto. Não chegar nada é zero.**

Uma porta que recebe só zeros não roda — e não rodar é exatamente o que uma porta faz
quando a saída dela é zero: nada acontece na linha. Por isso **a porta acesa na tela não é
um efeito**: é a saída dela, lida do livro-caixa (`data-alto` = emitiu neste tick).

A consequência honesta, escrita no arquivo: **`not` não é expressável assim** e por isso não
existe ali. Com entrada zero ela nunca rodaria e precisaria emitir um. XOR, AND e OR bastam
para um somador completo, então a fatia fecha; no dia em que precisar de `not`, a codificação
é que muda.

**O que existe:** `porta` (xor/and/or), `somadorCompleto` (5 portas), `somadorWorld(bits)` —
cascata de vai-um com `replicas: bits` **de verdade** (os N somadores existem; a marca só diz
que são iguais). Property test: soma todo par de 4 bits com vai-um, e a profundidade de um
somador de 8 bits é maior que a de 2 — atraso de propagação medido, não afirmado.

**Achado que vale registrar:** o somador completo **não** declara atalho, e o motivo é uma
lacuna real do motor. Um atalho substitui o interior, e quem entrega passa a entregar ao
contêiner — que tem **uma** folha de entrada. Um somador completo tem três entradas
distintas (a, b, vai-um) que caem em portas diferentes. Enquanto a fronteira de um contêiner
não tiver porta nomeada como a linha de controle tem, atalho e composição não aceitam a
mesma fiação — e declarar um ali seria escrever código que nenhum teste de equivalência
consegue exercitar.

## O que mais entrou nesta rodada

- **`WorldState.substepOf`** — em que subpasso cada objeto rodou. Fica no **estado**, não na
  tela, porque é resposta do modelo: sem isso, mostrar a acomodação acontecendo dentro do
  tick exigiria que o desenho adivinhasse a ordem, que é o mesmo que inventá-la. É ele que
  escalona a animação, e é por isso que a onda atravessa o desenho na ordem em que o sinal
  atravessa o circuito
- **Roteamento que desvia de obstáculo** — uma linha que atravessa uma caixa parece entrar
  nela, e o leitor passa a ver uma ligação que não existe. Mentira de desenho custa o mesmo
  que mentira de número
- **`×N` desenhado** como contorno empilhado, e a marca vem do **modelo** (`ObjectSpec.replicas`),
  não da view — escrevê-la à mão seria um rótulo sem nada por trás. As marcas `×32` e `/32`
  que eu tinha posto na view da CPU **eram exatamente isso e foram removidas**; em troca, os
  fios de dado do caminho de dados agora declaram `width: 32`, que é verdade
- **`/N` desenhado** ao longo do fio

Estado: 355 testes unitários, 66 e2e, typecheck, boundaries e build verdes.

