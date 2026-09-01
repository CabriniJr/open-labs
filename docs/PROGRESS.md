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

---

## Bornes, atalho provado e profundidade navegável

**Data:** 2026-08-29.

**O contêiner ganhou bornes — entrada e saída nomeadas.** Era a lacuna que a fatia vertical
tinha achado, e ela era mais séria do que parecia: sem nome, um objeto com três entradas
distintas (as duas parcelas e o vem-de-trás) precisava de **fiação diferente** aberto e
fechado — e aí as duas versões deixavam de ser o mesmo modelo, e o teste de equivalência do
atalho perdia o sentido. Com `inlets` e `outlets`, a fiação de fora é a mesma, e agora há
property test rodando as cinco portas contra a conta direta em qualquer um dos bits.

`expandPorts` abre esses fios **uma vez, na entrada do tick**: daí para baixo todo fio liga
duas coisas que agem, e nem a ordem topológica nem o livro-caixa precisam saber que existe
contêiner com bornes.

**Três defeitos que só apareceram porque a fiação passou a ser a mesma nos dois casos:**

1. `validateWorld` dizia que um contêiner com atalho "não age" — o atalho **é** o
   comportamento dele
2. o regime de uma porta sem fio próprio agora sobe para o fio do pai, que é por onde a
   emissão de fato sai; antes uma folha dentro de um contêiner era cobrada por um regime que
   não era o dela
3. a expansão precisa acontecer **antes** da ordem topológica, senão o grafo de acomodação
   fica com o contêiner no lugar de quem emite, e a entrega cai numa caixa já processada —
   em silêncio, que é o pior jeito

**Profundidade virou caminho, e não promessa.** `autoView` monta uma vista para qualquer
foco: as desenhadas à mão dão o enquadramento bonito dos lugares que importam, e a montada
na hora cobre todo o resto. Dois cliques entram num objeto; a trilha de migalhas mostra onde
você está e volta. Quem tem interior sai marcado `collapsed` — o mesmo invariante de sempre:
nem inventa, nem esconde calado.

Estado: 363 testes unitários, 68 e2e, typecheck, boundaries e build verdes.

---

## A ULA aberta: a fatia vertical encosta no caminho de dados

**Data:** 2026-08-29. **Código:** `packages/cpu-domain/src/alu.ts`.

A ULA deixou de ser folha. Por dentro dela:

```
ULA
  dispersor            o número vira 32 linhas
  somador de 32 bits   ×32 somadores completos, cada um com 5 portas
  pesos                ×32 — uma linha vale o que a posição dela vale
  coletor              as 32 linhas viram número
  unidade lógica       o que não é soma (ainda folha, e está declarado)
  mux de operação      escolhe, e fala pela ULA inteira
```

**Do sistema até a porta lógica são seis níveis**, e dá para descer todos clicando:
`sistema › CPU › processador › lógica combinacional › ULA › somador de 32 bits › bit7` →
XOR, AND, XOR, AND, OR. Tudo vivo, tudo rodando o programa que está no editor.

**O que isso custou de verdade, e é a coisa mais bonita daqui:** um ciclo da CPU passou de
8 para **75 subpassos**. Não é medida inventada — é a cascata do vai-um de 32 bits, que é
exatamente o motivo de somadores reais não serem em cascata. O modelo agora **cobra** o que
antes só afirmava.

**Duas peças que existem por causa de uma verdade que o desenho esconde:** um barramento de
32 vias **é** 32 linhas. O `dispersor` e o `coletor` são o `/32` do fio dito em voz alta —
não são adaptador de conveniência.

**O diferencial continua passando instrução a instrução** com o somador feito de portas. E
`shortcutDisagreement` prova, dentro da CPU inteira, que o caminho rápido da ULA concorda
com as duzentas peças de dentro dela: o que se compara é o que o mundo **fora** da ULA
enxerga — registradores, pc e memória. O lab roda **aberto**, porque descer até a porta e
encontrar coisa parada seria o mesmo tipo de mentira que o projeto persegue.

Um defeito achado no caminho: a view montada sozinha rebentava com fio para o descarte —
`@drop` é destino e **não** é objeto, e perguntar onde ele está na árvore lança. Foi assim
que a primeira descida até a ULA morreu.

Estado: 370 testes unitários, 72 e2e, typecheck, boundaries e build verdes.

**O que falta da fatia:** o transistor abaixo da porta lógica, e a unidade lógica aberta
(hoje folha, declarado no arquivo). A fatia desce por **um** caminho, e esse caminho é a
soma — que é a operação que a máquina mais faz.


---

## Entrada e saída: dois endereços que não são memória

**Data:** 2026-08-29. **Código:** `packages/cpu-domain/src/datapath.ts`,
`apps/site/src/components/CpuLab.tsx`.

O programa agora **conversa com o mundo**, e sem nenhuma instrução nova. Guardar em
`0x1000` é falar; ler de `0x1004` é ouvir o botão. É a mesma `sw` e a mesma `lw` — o que
muda é que aquele endereço não é memória. É assim que máquina pequena sempre teve teclado e
tela, e cabe em duas linhas de assembly.

**O botão é parâmetro declarado, não recomeço.** `params: { entrada: 0 }` no `WorldSpec`, e
girar chama `setParam` — o programa não reinicia, ele lê outro número na próxima vez que
olhar. Foi isso que decidiu a forma: entrada como *evento no tempo* já era contrato do motor,
e o dispositivo só precisou ler `ctx.params`.

**Guardar no endereço de saída não guarda.** Se guardasse, o `lw` do mesmo endereço
devolveria o eco em vez de zero, e a memória cresceria com números que ninguém escreveu ali
— exatamente a classe de mentira silenciosa que o projeto persegue. O diferencial agora
compara **também a fala**, palavra por palavra, contra a referência.

Três mutantes mortos: apagar a guarda do endereço de saída, apagar a resposta do dispositivo
de entrada, e apagar a emissão para o dispositivo de saída. Os três quebram o diferencial.

**A view pegou o defeito antes de mim.** Ao entrar `entrada` e `saida` na árvore, a
`VIEW_SISTEMA` passou a esconder dois objetos, e `viewDisagreement` derrubou o build com o
nome de quem faltava. O invariante de "nem inventa, nem esconde calado" funcionou como
alarme, e não como documentação.

No lab: um campo para o botão, e um painel com o que o programa já falou. O programa de
partida deixou de somar 1..5 fixo e passa a somar 1..n, com o n vindo do botão.

Estado: 373 testes unitários, 74 e2e (2 novos), typecheck, boundaries e build verdes.

---

## A mensagem passa a carregar o bit, e `not` existe

**Data:** 2026-08-29. **Código:** `packages/cpu-domain/src/gates.ts`,
`packages/depth-core/src/scheduler.ts`, `packages/depth-ui/src/Stage.tsx`.

A codificação mudou: **toda linha carrega o bit dela**, alto ou baixo, no lugar de
"presença é um, ausência é zero". Foi decisão do Luigi, e o motivo é o transistor.

**Por que a codificação bonita não chegava lá.** Uma porta CMOS é uma rede de pull-up
(PMOS, puxa para 1) e uma de pull-down (NMOS, puxa para 0). Sob presença, *puxado para
zero* e *não puxado* são o mesmo estado — a rede de pull-down some, e some justamente a
metade que faz CMOS ser CMOS. O caminho barato era desenhar meia porta e chamar de
transistor; é exatamente a mentira silenciosa que o projeto persegue. `not` — que estava
declarado como preço da codificação antiga — também volta, e com ele NAND e NOR, que são
as portas que o silício tem.

**O que isso cobrou do motor, e é o achado da vez:** a acomodação inteira acontecia e
**desaparecia**. O livro-caixa guardava *quantas* mensagens saíram de cada porta, nunca o
que elas diziam — e com toda porta emitindo todo tick, "emitiu" deixou de distinguir um de
zero. Ler a contagem acenderia o circuito inteiro, sempre. `WorldState.settled` é a
resposta: o que saiu de cada porta neste tick, por `"id.porta"`, o par acomodado do
`flight`. O motor continua sem saber o que é um bit — ele só parou de jogar fora a resposta
que ele mesmo calculou.

**E a tela parou de deduzir.** `alto()` lia o livro-caixa; agora recebe `altos` do domínio,
que é quem sabe ler `data.bit`. Sem `altos`, nada acende — não acender é a resposta honesta
para "não me disseram".

**O que a mudança revelou de verdadeiro:** 0 + 0 antes deixava o circuito morto e
`substeps` em zero. Agora as portas rodam e dizem zero, e o atraso é **o mesmo** de um caso
que acende tudo. É o que um somador em cascata faz: o atraso é da forma dele, não do número
que passa. Virou teste.

Três mutantes mortos em `settled` (gravar também no confronto, nunca gravar, e o resíduo do
tick anterior). O diferencial da CPU passou **sem tocar em nada**: o somador de 32 bits
feito de portas continua conferindo instrução a instrução contra a referência.

Estado: 379 testes unitários, 74 e2e, typecheck, boundaries e build verdes.

---

## O transistor: a porta lógica aberta até o silício

**Data:** 2026-08-29. **Código:** `packages/cpu-domain/src/transistors.ts`,
`packages/depth-core/src/{model,settle,validate,scheduler}.ts`.

NOT, NAND e NOR agora existem como **rede de transistores**, com a tabela-verdade como
atalho provado. Cada uma é o par complementar de sempre: PMOS puxa para 1 em cima, NMOS
puxa para 0 embaixo, e o que separa NAND de NOR é só quem está em série e quem está em
paralelo.

**Duas espécies de linha, e é isso que faz o nível caber sem primitiva nova.** `bit` é
valor lógico e chega no terminal de porta — o terminal que decide e **não conduz**, o que
é verdade no silício. `corrente` é o que atravessa o canal, e carrega o nível junto com um
`conduz`.

**`conduz` é campo, e não ausência de mensagem — de propósito.** Seria mais curto um
transistor cortado não emitir nada. Mas então um nó de saída **flutuando** (rede mal
montada, ninguém puxando) também não rodaria, e o defeito passaria calado: a porta não
emitiria, e o de baixo leria isso como zero. Com o campo, o nó sempre roda e sempre pode
recusar — flutuação e curto, os dois com o nome do nó e o que fazer. É a regra de sempre:
mover a validação para onde a violação vira impossível.

E há um teste que mostra por que isso importa: um NAND com a rede de baixo solta do nó
responde **certo** para três das quatro entradas, e para a quarta ele acertaria zero por
acaso sob a codificação antiga. Acertar por acaso, calado, é o defeito.

**Lacuna do motor que o trilho achou — a quarta desta fase.** Um Vdd não recebe nada e
precisa dirigir a linha **dentro do tick**. A acomodação pulava quem não recebeu, então o
trilho nunca agiria e o circuito ligado nele ficaria morto em silêncio. `ObjectSpec.drives`
é o conceito que faltava: fonte constante da acomodação. Não é a `source` de sempre —
aquela emite no confronto e custa uma borda de relógio. `validateWorld` recusa as duas
maneiras de a promessa ser falsa: declarar `drives` em quem tem entrada acomodada (não
seria constante) e em quem não tem saída acomodada (não dirigiria nada).

Um detalhe que só a fatia acha: um transistor **sem comando nenhum** não é um transistor
cortado, é um que ainda não tem opinião — é o circuito antes da primeira entrada chegar.
Confundir os dois faz o nó acusar flutuação numa porta que está certa.

Três mutantes mortos: ignorar `drives` na acomodação, trocar as redes de NAND e NOR, e o nó
deixar de recusar flutuação.

**O que falta da fatia:** ligar as portas do somador nas redes de transistores (hoje as
duas coisas existem e se provam, mas o somador ainda usa a porta folha), a view do nível de
transistor, e a unidade lógica aberta.

Estado: 390 testes unitários, 74 e2e, typecheck, boundaries e build verdes.

---

## A fatia encosta: o somador roda em transistores

**Data:** 2026-08-29. **Código:** `packages/cpu-domain/src/{transistors,gates,views}.ts`,
`packages/depth-core/src/{model,wiring,validate}.ts`.

As duas metades se tocaram. O lab das portas roda o somador de 4 bits com **cada porta
feita de transistores**: 457 objetos, 433 fios, 43 subpassos. Dá para descer
`circuito › bit0 › XOR › NAND › PMOS` e encontrar silício comutando — **oito níveis**.

XOR, AND e OR não são portas do silício, então elas se compõem das que são:

```
AND = NOT(NAND(a,b))               6 transistores
OR  = NOT(NOR(a,b))                6 transistores
XOR = NAND(NAND(a,g), NAND(b,g))  16 transistores, g = NAND(a,b)
```

Que o XOR custe quase três vezes o AND é metade do motivo de um somador ser caro, e agora
isso aparece sozinho na contagem de subpassos.

**Lacuna do motor, a sexta desta fase: bornes não compunham.** `expandPorts` abria uma
camada e parava, e `entryLeaf` atravessava o contêiner de dentro — um borne apontando para
um filho que também tem bornes entregava no terminal errado, calado. Agora a expansão vai
até o fundo, o borne pode nomear a porta do filho (`{ node, port }`), e `validateWorld`
recusa o nome pelado quando o filho tem bornes. Sem isso a fiação do somador não tinha como
dizer *qual* terminal do XOR ela alimenta.

**Três defeitos que só apareceram porque a porta abriu de verdade:**

1. **O somador nunca acionou o vai-um do primeiro bit.** Sob presença, "ninguém acionou" e
   "zero" eram o mesmo estado, então amarrar em zero era o mesmo que esquecer. Deixaram de
   ser: uma porta que recebe uma linha morta não sabe o que responder, e a rede de
   transistores dela acusou. O fio sempre faltou, e o somador passava em todos os testes por
   ninguém perguntar. Virou `nivelFixo("cin0", 0)`.
2. **O atalho de cada porta respondia pelos transistores.** Eles existiam na árvore e nunca
   rodavam — descer encontraria coisa parada, que é a mentira que o projeto persegue. O
   teste da contagem de subpassos pegou: o "somador de transistores" custava exatamente o
   mesmo que o de portas.
3. **Um PMOS cortado no Vdd relatava nível alto**, e a tela o desenhava aceso justamente por
   não estar conduzindo. Cortado não carrega nível nenhum.

**O nó de saída aprendeu a separar três coisas** que antes se confundiam, e cada uma tem
resposta diferente: rede ainda não acionada (o circuito aquecendo — não responde), **fio
faltando** até o nó (erro, com a contagem de ramos), e rede mal montada (**flutuação** ou
**curto**). Para isso o transistor relata todo tick, com `comandado` como campo: sumir do
relato apagaria a diferença entre "não acordou" e "falta fio".

Cinco mutantes mortos: expansão de bornes de uma volta só, nó ignorando falta de comando, nó
ignorando a contagem de ramos, `cin0` removido, e as redes de NAND e NOR trocadas.

**O que falta:** a unidade lógica aberta (hoje folha, declarado), e o bloco 7 (views da CPU
e acabamento). A ULA da CPU segue com portas-folha de propósito — 32 bits em transistores
são ~1600 deles, e a fatia desce por **um** caminho.

Estado: 402 testes unitários, 76 e2e, typecheck, boundaries e build verdes.

---

## Acabamento: a caixa recolhida, e a codificação provada contra a spec

**Data:** 2026-08-29. **Código:** `packages/depth-ui/src/Stage.tsx`,
`packages/cpu-domain/src/encoding.test.ts`.

**A ULA era desenhada parada com um somador de 32 bits girando lá dentro.** Um contêiner não
emite — quem emite são os filhos —, então o livro-caixa não tinha nada no nome dele e a
caixa recolhida ficava inerte. Neste desenho, parado quer dizer "não fez nada": era o
desenho afirmando o contrário do que o modelo dizia. Agora caixa recolhida responde pelo
interior dela, que é para isso que ela existe. Caixa aberta segue sendo moldura e não se
mexe — ali o leitor vê os filhos agirem, e animar a moldura contaria a mesma coisa duas
vezes. Foi achado olhando o lab, não rodando teste; virou e2e, e o e2e falha sem a correção.

**A segunda pendência declarada da §7 fechou, por outro caminho.** O diferencial confere o
modelo contra o intérprete de referência, e os dois compartilham `isa.ts`: isso prova
execução e não codificação. **Medido:** trocando o `funct7` do `sub`, o diferencial passa nos
dez programas e ninguém percebe.

`encoding.test.ts` é a metade que faltava — as vinte e sete instruções do subconjunto, com a
palavra escrita à mão a partir do layout de campos do RV32I e a conta no comentário. As
vinte tabelas de `isa.ts` bateram de primeira; os dois mutantes de opcode morrem só aqui. Um
teste de cobertura recusa instrução nova que entre sem passar pela tabela.

O que continua descoberto está declarado na §7.1 da spec: a tabela prova a **palavra**, não a
semântica dela. Canto de comportamento que a spec descreve em prosa — estouro em
deslocamento, sinal em `slt`, `jalr` zerando o bit baixo — nós dois podemos ter lido errado
do mesmo jeito, e é isso que um emulador de terceiro daria.

Estado: 484 testes unitários, 78 e2e, typecheck, boundaries e build verdes.

---

## Refino da CPU: o que o leitor vê

**Data:** 2026-08-29. **Código:** `packages/depth-ui/src/Stage.tsx`,
`packages/cpu-domain/src/{views,labels,transistors}.ts`, os dois labs.

Tudo daqui saiu de **olhar as telas**, não de rodar teste. Foram quatro coisas.

**A caixa recolhida era desenhada como moldura.** A correção anterior deu `data-ativo` à ULA
recolhida e eu disse que estava resolvido — não estava: contêiner é moldura, moldura não tem
engrenagem nem gesto, e a ULA continuava parecendo morta com um somador de 32 bits girando
lá dentro. O atributo certo, o desenho errado. Agora **uma caixa recolhida toma a família do
que ela guarda**, porque recolhida ela não é moldura: ela *é* a coisa. O e2e passou a cobrar
o desenho (`data-familia`, engrenagem) e não só o atributo — e o mutante, que antes
sobrevivia, morre.

**A vista da ULA era inútil.** A montada na hora enfileirava as seis peças numa linha só,
cortada no topo, com meia tela vazia embaixo. Virou vista à mão: o somador é a peça larga do
meio porque é a cara, e a unidade lógica corre por baixo — as duas respostas chegam no mesmo
mux e uma custa trinta e duas vezes mais.

**A porta CMOS era desenhada como fila.** Correto e inútil: o que separa NAND de NOR é
**série contra paralelo**, e isso é propriedade da forma, que some quando tudo vira uma
linha. Agora é esquemático — alimentação em cima, terra embaixo, nó no meio, e dois
transistores lado a lado querendo dizer paralelo. Os transistores também passaram a dizer
**qual entrada os comanda**: dois PMOS iguais num NAND fazem coisas diferentes, e sem o nome
o desenho mostrava a forma certa e deixava o leitor sem saber qual é qual. São setenta e seis
vistas, geradas — escrever à mão garantiria uma esquecida sem ninguém notar, e
`viewDisagreement` confere todas.

**Os labs estavam em português num site em inglês.** O leitor lia um parágrafo numa língua e
mexia num painel noutra. Decisão do Luigi: inglês agora, camada de idioma depois — e por
isso todo rótulo de modelo passa por `labels.ts`, um mapa só, para a tradução futura ser
trocar um arquivo em vez de caçar string em vinte. Comentários e identificadores seguem em
português: não são lidos por quem visita o site. Uma guarda por caractere acentuado impede o
português de voltar sozinho num rótulo novo.

Estado: 489 testes unitários, 78 e2e, typecheck, boundaries e build verdes.

---

## O mapa do RISC-V, e três coisas que o site dizia errado

**Data:** 2026-08-29. **Código:** `apps/site/src/data/{roadmap,roadmap-riscv,handbooks}.ts`,
`apps/site/src/components/Roadmap.{tsx,css}`, `packages/depth-core/src/inlets.test.ts`.

**O handbook do RISC-V ganhou o mapa.** Ele não tinha, e o motivo estava escrito no código:
desenhar o caminho antes de o modelo existir seria prometer o que não foi andado. O modelo
existe — executa RV32I e abre até o transistor —, então a razão caiu. O componente do mapa
deixou de conhecer só o do OTel: a espinha, as fases e os anexos viram um `RoadmapMap` que
se passa a ele.

**Três defeitos, e os três da mesma família: a página afirmando o que não é.**

1. **O catálogo anunciava como "coming" um lab que já estava no ar.** Ninguém mentiu de
   propósito — havia duas listas escritas à mão para o mesmo fato, e elas divergiram. A
   correção não foi acertar a lista: foi **juntar as fontes**, e os labs do RISC-V passaram a
   sair do mapa, como os do OTel já saíam. Três testes travam o resto: item pronto tem para
   onde levar, item não escrito não leva a lugar nenhum, e mapa e lista contam a mesma
   história.
2. **Um nó do mapa do OTel estava marcado como pronto com link `#`.** Ele abria como link e
   não levava a nada. A Entrega 2 mudou de rumo e aquele lab nunca foi construído — então ele
   é caminho declarado, como os outros.
3. **A proporção do mapa estava escrita no CSS com a medida do OTel.** Um mapa de outra
   altura fazia o desenho e as coordenadas dos nós escalarem diferente, e as linhas paravam
   longe das caixas: fio ligado a lugar nenhum. A proporção passou a vir do mapa.

**E um quarto, achado por acidente, que é o mais interessante.** A suíte reprovou **uma vez**
num property test dos bornes — o tipo de coisa que se reexecuta e se esquece. Reexecutar
passou quatro vezes seguidas. Mas sorteio que falha raro quer dizer **contraexemplo raro**,
não instabilidade: o teste tirava trinta pares de mil seiscentos e um. A varredura completa
achou o único par que discorda, `a=0, b=0`, e o defeito é a conflação de sempre — o atalho
guardava `a === 0 && b === 0` e devolvia nada, enquanto a composição entregava um zero.
**Não chegar nada é diferente de chegar zero**, e era o atalho que estava errado. O sorteio
virou varredura: o espaço é pequeno o bastante para não sobrar sorte.

Estado: 497 testes unitários, 84 e2e, typecheck, boundaries e build verdes.

---

## Entrega 1 do refino: o que a tela afirma passa a ser verdade

**Data:** 2026-08-30. **Desenho:** `docs/superpowers/specs/2026-08-30-refino-grafico-e-pedagogico-design.md`.
**Código:** `packages/depth-ui/src/{stage.css,Stage.tsx,kinds.ts}`, `packages/depth-core/src/model.ts`,
`packages/cpu-domain/src/{labels.ts,carga.ts,datapath.ts,gates.ts,alu.ts,transistors.ts}`,
`apps/site/src/components/Explorer.tsx`.

Isto saiu de uma **auditoria agêntica em três frentes**: um agente nas telas reais pelo
navegador, um no modelo da CPU, um na ficha do objeto. As três acharam coisas que nenhum
teste pegava, e a primeira delas é a razão de esta entrega existir.

**A porta acesa não existia.** O lab promete por escrito que "uma porta acesa é uma porta
cuja saída é 1". O agente mediu `fill` e `stroke` com `a=b=0` e com `a=6,b=7`: o mesmo valor.
Três causas, e as três da mesma família — **aceso era desenhado como acontecimento, não como
estado**. (a) O aceso vinha inteiro de uma transição cujo primeiro quadro era a tinta do
apagado; com a simulação rodando, a peça reiniciava a transição a cada tick e vivia perto do
quadro zero, saindo mais **escura** que a porta em 0 nos dois temas. (b) O halo que o olho lê
como "acesa" pertencia a `data-ativo` — a quem *rodou*, não a quem *disse um* —, então a porta
em 0 brilhava e a em 1 não. São as duas coisas que a troca de codificação foi feita para
separar, recoladas pelo desenho. (c) Na moldura, `fill-opacity: 0` anulava o preenchimento e o
contorno de acesa tinha a mesma cor do de apagada: sobrava meio pixel.

Agora o repouso já é aceso e a animação só pulsa por cima — parte de **mais** aceso e assenta
no aceso, então nenhum quadro dela mente. O nível alto ganhou token próprio: misturado na cor
do dado, "acesa" caía na mesma tinta de "isto é linha de dado", e a mistura escurecia a
superfície nos dois temas.

**Duas armadilhas de teste caíram junto, e valem mais que o conserto.** A checagem de
permanência trocava o tema e esperava 1,2s, e o site restaurava o tema no meio: a segunda
amostra media outro tema em vez de outro instante. E o laço "nos dois temas" **não trocava
tema nenhum** — nem escrevendo o atributo, nem emulando a preferência do sistema. Passava
medindo o mesmo caso duas vezes. Regra que fica: **teste que varre dois casos prova, no fim,
que os dois casos aconteceram.**

**A ficha sobrevivia ao enquadramento.** Ler a ficha do NAND e voltar ao topo deixava o painel
explicando peça que não está mais desenhada. A correção não é limpar no clique da trilha —
isso é regra sobre um botão, e sobraria todo outro caminho de navegação. A seleção passa a
carregar o enquadramento em que foi feita, e quem lê descarta o que não é dali: não há limpeza
a esquecer. Conferir contra o que o palco desenhou não serve, porque o interior aparece ou não
conforme o nível de detalhe, que é conta do palco.

**Os sinais de controle vazavam em português.** `ler`, `escrever`, `nada`, `ula`, `mem`, `pc4`
iam crus para a linha tracejada de um site em inglês — e nem no idioma certo seriam os nomes
certos: o aluno procura `MemRead`, `MemWrite`, `ALUSrc`, `MemToReg`. A guarda de idioma não
pegou, e não por descuido: ela varre acento, e nenhuma daquelas palavras tem. Quem pega agora é
**cobertura**: todo par campo/valor que a tabela de controle emite, para todo o ISA, tem de ter
tradução — com a tabela rodada de verdade, porque listar os valores à mão seria a segunda
fonte. O mapa é por campo **e** valor: `nada` quer dizer "não acessa memória" num sinal e "não
escreve no banco" noutro. Caiu junto uma duplicação que era a causa de a varredura não fechar:
a tabela dizia `acesso`/`escrita`/`desvio` e o payload dizia `modo`/`fonte`/`tipo`.

**A chave entrou no catálogo do motor.** O transistor era `router`: herdava o trapézio do mux e
a ficha o explicava com o texto do mux. Símbolo errado e explicação errada, no nível mais fundo
do modelo. Uma chave não escolhe entre entradas — deixa passar ou não, e quem manda é o
terminal de porta. É objeto que faltava no catálogo, não remendo de CPU: válvula e relé são o
mesmo objeto. Ela não ganha engrenagem, porque deixar passar não é processar. A guarda de
fronteira pegou a primeira versão, em que eu havia escrito "transistor" nos comentários do
motor — e estava certa.

**Rótulo igual ao id não é rótulo.** Trinta e dois objetos se chamavam `bit0`…`bit31` na tela.
Virou guarda geral.

**E a ULA declara a segunda simplificação:** `sub` também não desce pelo somador. Estava
escrito que a lógica bit a bit fica de fora, e quem lia só isso concluía que o resto desce pelo
silício. Meia declaração é meia mentira.

**Um achado da auditoria NÃO virou conserto.** A ordem "bit1, bit2, bit3 … bit14, bit13, bit12"
no somador da ULA foi lida como bagunça e é **serpentina deliberada** — a linha ímpar volta ao
contrário para o vai-um não pular a largura toda. O defeito ali é outro: a dobra é invisível,
então quem olha lê como desordem. Fica para a entrega do desenho. Vale como método: relatório
de agente é evidência, não veredito.

Estado: 668 testes unitários, 145 e2e, typecheck, boundaries (74 arquivos) e build verdes.

---

## Entrega 2 e a arrumação: a cor diz o que a coisa é, e o espaguete vira número

**Data:** 2026-08-30. **Desenho:** `docs/superpowers/specs/2026-08-30-refino-grafico-e-pedagogico-design.md`.

**O catálogo da linguagem visual.** Cor e forma passam a morar num lugar só, lidos por
**sentido** e nunca por valor, com `scripts/check-catalogo.mjs` reprovando tinta escrita fora
dele. A disciplina já funcionava — os três labs escolheram bem, cada um por sua conta — mas
disciplina não é sistema: nada impedia o quarto lab de escolher diferente, e no dia em que
escolhesse ninguém seria avisado.

Duas tintas, dois registros: no diagrama de blocos preta é dado e vermelha é controle; no
esquemático vermelha é alimentação e preta é terra. Não é ambiguidade — são duas linguagens
de desenho, nunca aparecem no mesmo quadro, e a trilha diz em qual o leitor está. O que era
ambíguo era o sentido ficar implícito. A vista **declara** o registro; adivinhar pelo conteúdo
erraria calado no dia em que um esquemático não tivesse chave nenhuma.

**A guarda achou o que ninguém procurava.** O CSS do MOTOR tinha seletores
`data-kind="instrucao"`, `"escrita"`, `"guardar"` e `"pulso"`. A guarda de fronteira não via
porque só varria TypeScript — uma fronteira que vigia meia linguagem vigia meia fronteira. E a
correção não foi pôr as palavras na lista: **a regra certa é sobre o substantivo.** O `kind` de
uma *mensagem* é palavra do domínio pela definição do próprio motor, então a guarda passou a
perguntar o inverso — *está no vocabulário do motor?* —, lendo a lista do `model.ts` na hora,
porque copiada ela envelheceria em silêncio.

**Um defeito que só a tela pegou.** Separei os trilhos por `source` contra `sink`, e no modelo
os DOIS são `source`: saíram os dois vermelhos. Passou em typecheck, fronteira, catálogo e 149
e2e. O que de fato os separa é o nível que cada um dirige, que é a física da coisa.

**A leitura do somador estava invertida**, e discordava de três coisas ao mesmo tempo: do texto
do lab ("watch the carry climb"), do número escrito — de cima para baixo dava `1011` onde a
caixa dizia `1101` — e do próprio desenho, com o vem-de-trás saltando a figura inteira. Nada
disso quebrava teste.

**Espaguete virou número**, medido nos `path` que a página pintou. Achou 21 sobreposições no
lab da CPU e 56 no das portas, todas com ponta em comum: leque e convergência desenhados como
N linhas empilhadas, que se leem como uma linha só. Daí saíram o **pontinho de junção** (o T
ganha, o X não — e a ausência dele é que diz que dois fios não se falam) e a **memória do
roteador**, que desviava de caixas e ignorava fios.

E os pesos do roteador passaram a ser a hierarquia dos defeitos escrita como número:
atravessar caixa é **mentira** e custa cem, repetir reta é **ambiguidade** e custa um, sair do
centro é **estética** e custa um décimo de milésimo. Na mesma ordem de grandeza, bastavam duas
retas repetidas para ele preferir cortar uma caixa.

**A dívida que a medida expôs se fechou com uma regra.** O somador cruzava 28 contra 16 do
caminho de dados inteiro. Doze eram um leque sem ordem. Agora **a saída mira o destino e a
entrada mira a origem** — regra local com efeito global: duas pontas ordenadas pelo que está do
outro lado não se cruzam, e o feixe abre como pente. Cruzamentos: somador 28 → **4**, caminho
de dados 16 → 15, pilha 4.

**Regra de método que saiu daqui:** teste que varre dois casos prova, no fim, que os dois
aconteceram. Dois testes meus fingiam cobrir dois temas e cobriam um; um terceiro comparava
`.first()` de um conjunto que muda, que não é um elemento — passava sozinho e reprovava na
suíte cheia.

Estado: 687 testes unitários, 155 e2e, typecheck, boundaries (80 arquivos), catálogo e build
verdes.

## 2026-08-30 — O microprocessador genérico

Um modelo que existia fora daqui — desenhado à mão por um professor, em slides — foi
reconstruído no motor, roda, e abre onde o slide não pode abrir. Deck de referência:
*Princípio de Funcionamento de um Microprocessador*, de **Prof. Filippo Valiante Filho**
(`prof.valiante.info`), usado **com permissão dele**.

**O que faltava e agora existe: o ciclo de instrução como tempo.** O caminho de dados do
RISC-V abre dizendo "um ciclo por tick" — a instrução inteira acontece dentro de um tick, e
busca, decodificação e execução existem só como profundidade topológica da acomodação. No
`micro`, **um tick é um micro-passo**: uma transferência entre registradores. Vinte e nove
deles para o programa do slide 16.

**O motor ganhou `kind: "sequencer"`**, o primeiro da família `controller` — que existia
desde o começo e não tinha nenhum. Ele guarda a fase entre ticks e emite só por linha de
controle; `validateWorld` recusa aresta de dado saindo dele, e a mutação da guarda mata
exatamente um teste. `router` não servia porque não lembra do tick passado, `store` mentiria
na forma. A UC do RISC-V também passou a usá-lo: família que só um mundo usa é `kind`
disfarçado.

**A tabela do slide 43 virou oráculo, e as onze linhas bateram célula por célula, na
primeira execução.** É um documento que não controlamos decidindo quando estamos errados.
O deck tem duas granularidades da mesma execução — 22 quadros de animação e 11 transações de
barramento — e nós produzimos as duas **de um livro-caixa só**, que é a tese do projeto
provada num caso que não inventamos.

**A profundidade vai a nove níveis**, dois a mais do que o desenho previa:
`sistema › cpu › processador › ula › somador › bit0 › xor › nand › vdd`, 930 objetos. O deck
desenha a ULA como duas caixas e para ali, porque slide não abre. **E o reuso não custou uma
linha de domínio nova:** `gates.ts` e `transistors.ts` saíram da tarefa sem uma modificação.
A largura da ULA virou argumento com 32 como padrão, e o RISC-V não mudou.

**Três defeitos que só a tela pegou, e dois deles estavam no plano escrito antes:**

1. A tabela preenchia coluna por **diferença**, e o segundo `ADD` recarregava o IR com `8B`,
   o byte que já estava lá — célula vazia, tabela afirmando que a instrução não foi buscada
   naquele ciclo. Transferência real, invisível. Preenche-se por **qual ordem disparou**,
   não pelo delta: reescrever o mesmo valor é evento, e diff não vê evento.
2. Ao vivo, a coluna de instrução mostrava `STORE 0000` antes de os bytes do endereço serem
   buscados — completava com zero o que a máquina ainda não tinha lido. Passava em todos os
   testes, porque o oráculo compara a execução completa. Fica em branco até os bytes
   existirem.
3. A ficha descrevia um objeto só em vocabulário do motor: quem clicava em `MAR` lia o que é
   um `buffer`. Nasceu `DESCRICOES`, por id, com teste bidirecional que tira a lista de ids
   **da própria árvore** — lista à mão é a fonte duplicada de sempre.

**Um erro no material de referência.** O slide 44 dá o código de máquina do 8085 como
`21 20 00` para `LXI H,2000h`. O 8085 guarda imediato de 16 bits com o byte baixo primeiro
(*8080/8085 Assembly Language Programming Manual*), então o correto é `21 00 20` — como
está no deck, o programa escreveria em `0020h`. O artigo da ponte usa a forma certa e faz da
divergência um dos dois pontos em que as duas máquinas discordam.

**O handbook passou a se chamar pelo que é:** `RISC-V Visual Handbook` → **`CPU Visual
Handbook`** (o campo `model` já dizia `cpu.model` antes de nós). O mapa reordenou — o
genérico na fase 4 (*The instruction cycle*), o RISC-V na 5 (*The datapath, all at once*) —
e o vazio "The control lines of one opcode" foi **absorvido, não substituído**: uma UC
multiciclo *é* as linhas de controle de um opcode, desenroladas no tempo. Nenhum placeholder
novo nasceu; um morreu.

**Método:** um agente reportou `pnpm typecheck` limpo quando não estava, e a quebra foi
commitada — `Kind` tem **duas** tabelas exaustivas, a `FAMILY` do motor e a `KINDS` do
`depth-ui`, e é a segunda que impede um `kind` de aparecer na tela sem ninguém saber dizer o
que ele é. Quem pegou foi o agente seguinte, rodando o comando de verdade. Relatório de
agente é evidência, não veredito.

Espaguete do lab novo: **7 cruzamentos, 0 sobreposições cegas**, teto cravado no medido.

Estado: 773 testes unitários, 179 e2e, typecheck, boundaries (81 arquivos), catálogo (10
arquivos) e build (29 páginas) verdes.

---

## Entrega 4 — O lab dos provedores, o primeiro do `otel.model` ✅

**Data:** 2026-08-31/09-01. Branch `main`.
**Spec:** `docs/superpowers/specs/2026-08-31-provedores-otel-design.md`
**Plano:** `docs/superpowers/plans/2026-08-31-lab-provedores-otel.md`
(os dois vieram das PRs `kiro/lab-provedores-otel` e `kiro/curriculo-otel`).

**O que ficou pronto.** `packages/otel-domain/src/providers/` — a árvore
`host → process → {tracer,logger,meter}-provider`, com o `collector` filho do **host**
e não do processo. `labs/providers` no ar, na fase 3 do mapa, pareado com o artigo
`who-owns-the-pipeline`.

**A tese, provada por teste e não por prosa:** o envelope do OTLP é a árvore de objetos
do SDK. `envelope.test.ts` cobra o invariante nas duas metades — (⊆) o envelope não
inventa campo, (⊇) nenhuma placa deixa de aparecer nele — e ele passou por **teste de
mutação**: zerando o recurso sobre o qual o exportador fecha, três testes caem.

**Nenhum `kind` novo nasceu.** O catálogo de onze cobriu o SDK inteiro, e há teste
cobrando isso. O `Resource` é `static` — placa não tem porta e não é fiada, e por isso
ele chega ao envelope porque a fábrica do exportador **fecha** sobre ele, que é o que o
SDK faz.

**O risco nº 1 do plano caiu:** `validateWorld` aceita a linha de controle entre o
`sampler` do `tracer-provider` e o `trace-gate` do `logger-provider`. É a única linha do
lab que cruza fronteira de provider, e é a que ensina que baixar a amostragem de traces
apaga logs.

**Um tick é um segundo neste mundo.** É o que faz os padrões da spec caberem na tela sem
serem reescritos: `scheduledDelayMillis` 5 000 são 5 ticks, `exportIntervalMillis` 60 000
são 60, e o 12× de F4 é `exportInterval / scheduledDelay` — número da spec, não número
escolhido para a demonstração.

**Cinco fenômenos, nenhum roteirizado**, todos `otelWorld` mais um parâmetro. O que vale
guardar de F4: a fila cheia **recusa** e o span morre; o banco de pontos **colapsa** e a
soma é conservada. Mesmo problema — memória finita —, duas mentiras diferentes, e cada
uma tem forma própria no desenho.

### Três defeitos que só a tela pegou

Auditoria visual depois de o lab estar verde em tudo. Nenhum dos três tinha teste que os
pegasse, e o primeiro é da classe que o projeto trata como inaceitável.

1. **O descarte não era desenhado.** `@drop` não está na árvore, então o fio inteiro sumia
   do palco — e isso faz **descarte deliberado e fio esquecido virarem o mesmo desenho**.
   Um amostrador de três saídas aparecia com duas. Consertado no motor (`Stage.tsx`), com
   terminal próprio, sem seta — seta aponta para um destino, e descarte é a ausência de um.
   Nenhum outro domínio fia para `DROP`, então o desenho dos outros três labs não mudou.
2. **A linha de controle entre dois providers contornava o desenho inteiro pela direita.**
   A folga entre as molduras era 8, e o roteador só desce pela borda com **mais** de 8.
   Passou a 16.
3. **Não havia como alternar entre as três views de provider** sem saber clicar duas vezes
   na caixa certa — e a comparação por superposição (R3) é o que entrega F4.

### Mais dois, e os piores: a carga não era desenhada

Achados na segunda auditoria de tela, com o lab já verde em tudo.

4. **Vinte e um fios na tela e zero bolinhas.** O motor entrega na **folha de entrada** de
   um contêiner; o desenho conhece as **caixas da vista**. Ninguém traduzia de um para o
   outro, então a chave do trilho nunca casava e a carga simplesmente não era desenhada.
   Só funcionava em vista cujos objetos são todos folha — que é o caso dos três labs
   antigos, e por isso o defeito viveu escondido. `InFlight` ganhou `port` para o descarte
   saber por qual terminal a carga morre.
5. **A cor por espécie nunca aplicou.** O `data-especie` está no grupo; o seletor pedia o
   atributo na própria carga. As cinco espécies existiam no DOM e o desenho pintava todas
   da mesma cor, calado, desde que a regra nasceu. Testado por mutação: com o seletor
   antigo, o teste de tinta cai.

### A carga muda de forma no caminho

Pedido do Luigi, e ele nomeia o que o lab existe para mostrar: *"a bolinha vai se
modificando no caminho — passa por um batch processor e vira um conjunto de bolinhas,
passa no exporter e vira um file"*.

A forma sai de **três fatos que o motor já tem**, e de nenhum vocabulário de domínio:

| Fato do motor | Forma | O que ela afirma |
|---|---|---|
| o fio declara largura | barra | N vias em paralelo — a notação do esquemático |
| a aresta é um **canal** | documento | o que atravessa um canal sai serializado: é o envelope |
| `weight > 1` | punhado de pontos | várias coisas viajando juntas porque alguém decidiu |
| nada disso | ponto | uma coisa |

Um lote não é um círculo maior — isso diria "um span mais gordo". É **vários pontos**,
que é a lição inteira do processador em lote. E o `×N` ao lado dá a conta exata, porque
sete é o teto do que se lê como punhado.

A espécie foi remapeada pela régua do catálogo, que diz que o número é **proeminência** e
não categoria: o descarte vem primeiro (num lab sobre quem decide o que sai, a carga que
morre é o que não se pode perder de vista), e **span e lote dividem a tinta**, porque um
lote *é* spans e a forma já os separa — a cor que sobra vai para o envelope, que dali para
a frente não é mais spans.

### Um conserto de medida, e não de folga

O espaguete passou a medir **por escopo**. Um interior é um espaço de coordenadas próprio,
então dois fios de caixas diferentes podem ter o mesmo `d` e não se tocarem na tela. As três
views de provider compartilham moldura de propósito — é R3 —, então os interiores saem com
paths idênticos, e a medida sem escopo acusava dezoito sobreposições cegas onde não há uma.
Os quatro tetos antigos foram remedidos com a mudança e **não mexeram** (15, 4, 4, 7). O do
lab novo é **1 cruzamento, 0 sobreposições cegas**, cravado no medido.

### Dois defeitos herdados das PRs do Kiro

Nenhum dos dois era visível enquanto o handbook de OTel não tinha lab publicado — que é o
jeito ruim de achar defeito.

1. `landing.spec.ts` cravava `"0 of 13"` e a trilha cresceu para 18. O total passa a sair do
   próprio mapa: uma fonte só por fato.
2. `OTEL_LABS` não copiava o `href` do mapa. O teste de "item pronto tem para onde levar" só
   tem o que cobrar quando existe um item pronto — é a mesma classe que a lista escrita à mão
   do lado da CPU já tinha tido.

### O que ficou pendente

- **Bloco E — a contraparte real (`labs/providers/` com compose e fixture OTLP).** É o
  princípio 3 da spec do handbook, e sem ele o lab não está *pronto* pela régua do projeto.
  O modelo está honesto contra a spec escrita; falta a prova mecânica contra tráfego real.
- **Task 16 — `docs/authoring.md` continua desatualizado**, mandando escrever `Scenario<S>`,
  que o `depth-core` marca como andaime proibido em código novo.
- **As duas saídas do amostrador que vão para o mesmo destino se desenham por cima.**
  `sampled` e `recorded` entram ambas no `span-processors`, e o roteador dá o mesmo caminho
  para as duas. Não é sobreposição cega (compartilham as duas pontas) e a contagem do painel
  separa as três decisões — mas no desenho a porta do meio só se distingue pelo terminal de
  descarte da terceira. Resolver pede borne nomeado na `pipeline`, ou o roteador sabendo
  separar fios irmãos com o mesmo par de pontas.
- **O LOD tem um teto para três molduras empilhadas**: `min(w/W, h/H)` não passa de ~0,30
  com três caixas na vertical, então o interior delas aparece a ~22% na vista do processo.
  A comparação de verdade é pelos botões de enquadramento.

### A rodada da auditoria visual do Luigi

Ele olhou o lab rodando e a lista que saiu dali é o que este registro existe para guardar.

**A costura API ↔ SDK virou desenho.** O `app` era uma caixa só. Agora há uma moldura
`application` — o código e a **API** que ele chama, os dois do mesmo lado da costura — e
uma moldura `sdk` com os três provedores. A API é `channel`, porque ela transporta e nunca
altera: é literalmente o que ela faz. Trocar tudo o que está à direita não muda uma linha
do que está à esquerda, e é por isso que uma biblioteca pode ser instrumentada sem escolher
o SDK de ninguém — e é a explicação do silêncio de F5: sem SDK, a moldura da direita não
existe, e do lado de cá **ninguém sabe disso**.

**Contrapressão, e ela é uma aresta.** Um parâmetro corta o canal para o Collector. O
exportador exporta um lote por vez e espera; com o outro lado mudo ele não termina, e avisa
a fila por uma linha de **controle que anda contra o fluxo** — a única do lab. A fila para
de entregar, enche, e a partir daí recusa. **A perda começa três peças antes de onde o
problema está**, que é por que ela surpreende. Nem o `ForceFlush` passa por cima. E há a
distinção que o painel mostra com número dos dois lados: o que o exportador segura está
**preso**, não perdido, e volta a andar quando o canal volta; o que a fila recusou não volta.

**A fila enche e esvazia na tela** (`fills`), e o banco de pontos usa a mesma barra contra o
limite de cardinalidade — é ali que o contraste de F4 fica físico: um transborda e recusa, o
outro colapsa.

**A carga de geração é modulável** (spans, logs e medições por segundo), que é o que permite
passar do que o pipeline drena e ver a contrapressão acontecer.

**O descarte virou o terra do esquemático** — três traços que encurtam. É o símbolo mais
universal que existe para "aqui acaba, e não continua em lugar nenhum", que é o que o
descarte é. A palavra fica junto porque isto é material de ensino.

### A porta e o fio, e o preço de dizer a verdade

Achado dele: *"as setas dos fluxos não estão se conectando à entrada deles"*. Estava certo,
e era estrutural: as portas eram distribuídas em alturas iguais pela borda e o roteador
escolhia a altura por conta própria. **O desenho mostrava uma entrada e uma linha que não a
tocava.**

A correção passou por três tentativas, e as duas primeiras ensinam:

1. **desenhar a porta onde o fio chega** — conserta o alinhamento e esconde o defeito de
   baixo: três portas diferentes ligando as mesmas duas caixas miram o mesmo ponto, saem na
   mesma altura, e viram **uma linha só**. O teste de junção do espaguete pegou;
2. **a porta manda no fio** — quebrou o somador (4 → 27 cruzamentos), porque a mira ordena o
   leque e foi ela que levou aquele desenho de 28 para 4. Regra nova não revoga regra que
   pagou;
3. **desvio em torno da mira**, e só quando o par de caixas tem mais de uma porta — que é a
   única situação em que há empate a desfazer. A mira continua mandando na ordem; o desvio
   só separa quem ela empatou.

O somador foi de 4 para **5** cruzamentos, e o número subiu porque o desenho passou a dizer
a verdade: as duas parcelas que entram em cada bit eram desenhadas uma por cima da outra, e
o leitor via uma ligação onde existem duas. Um cruzamento a mais, quatro ligações que
existiam e não podiam ser vistas. Os outros três labs não mexeram (15, 4, 7), e o lab dos
provedores foi para **0**.

### A rodada do fluxo entre níveis, e o que a investigação salvou

Ele disse que os fluxos entre níveis, as animações, as setas e os fios ainda estavam
errados, e autorizou mexer no motor. A investigação veio antes de qualquer conserto, e o
primeiro achado foi um **falso positivo**: medindo na aba de automação, a carga aparecia
congelada em `offset-distance: 0%` com a animação "running" e `currentTime` parado. Parecia
defeito grave. Não era: `requestAnimationFrame` não dispara naquela aba, porque ela não
pinta — a linha do tempo do documento está parada. **Um "conserto" ali teria mexido em
código que funciona.** Screenshot força pintura; medição de tempo naquela aba não vale.

**O defeito real, e ele é da pior espécie do projeto: a vista de fora discordava do próprio
interior.** Medido na tela: uma linha chegava na moldura do SDK em y≈817, e lá dentro
nasciam **três** entradas, em 734, 818 e 902. Duas nasciam do nada, a oitenta e oito
unidades de qualquer linha existente.

A causa era a regra de agregação: duas folhas dentro das mesmas duas caixas viravam uma
aresta só. A regra é certa — trinta e dois filhos idênticos não viram trinta e duas linhas
—, mas a chave dela não distinguia **travessias diferentes**. Confirmado nos dois labs, e o
segundo caso só se prova no modelo: as quatro linhas de controle que entram na lógica
combinacional do caminho de dados pousam em **quatro peças diferentes** (`ula`,
`mux-operando`, `mux-escrita`, `desvio`), e eram desenhadas como uma. Latente, porque
naquele zoom o interior está fechado.

Duas tentativas erradas antes da certa, e as duas ensinam:

1. **pôr a porta na chave** — desagrega os três sinais, e leva o caminho de dados de 15 para
   26 cruzamentos, porque desagrega também o que não precisava;
2. **a porta mandar no fio** (rodada anterior) — quebrou o somador de 4 para 27, porque a
   mira ordena o leque e foi ela que o levou de 28 para 4.

A resposta é deixar o **nível de detalhe** responder, como ele já responde por todo o resto
do palco: com o interior **aberto**, cada travessia é uma linha e pousa na peça em que de
fato entra; com o interior **fechado**, uma linha só, marcada como **feixe de N** — a mesma
notação que o esquemático usa para um barramento. De longe o desenho informa a conta em vez
de esconder a diferença; de perto o feixe se abre nos fios que o compõem. Os quatro labs
antigos não mexeram um cruzamento (15, 5, 4, 7).

E o que fecha a continuidade: **a linha de fora passou a mirar a peça em que ela entra lá
dentro**. Os dois pontos já eram conhecidos — a travessia os usava para continuar a linha —
enquanto o traço de fora era roteado sem saber deles. Duas metades da mesma ligação
desenhadas por dois critérios diferentes. Agora as três linhas terminam exatamente em 734,
818 e 902, que é onde as três entradas do interior começam.

**A seta apontava a cor errada em todo fio de controle.** O conteúdo de um `<marker>` não
herda do elemento que o referencia — ele herda do `<defs>` —, então `currentColor` resolvia
uma tinta só para o desenho inteiro. Toda linha vermelha terminava numa ponta da cor do
dado, e fio aceso não acendia a ponta. `context-stroke` é o mecanismo que o SVG tem para
isso, com `currentColor` antes como reserva.

O invariante virou `apps/site/tests/travessia.spec.ts`, e ele cobra **geometria**: cada
linha que chega numa moldura aberta termina onde uma entrada do interior começa, e as duas
contagens batem. Provado por mutação — voltando a agregar, ele cai dizendo qual moldura e
quantas linhas. E o lab dos provedores é obrigado a ter moldura aberta, senão os dez casos
pulariam e o invariante ficaria sem guarda, calado.

O lab dos provedores foi de 0 para **1** cruzamento: o leque de três precisa cruzar uma vez.
Um cruzamento pelo preço de duas ligações que existiam e não podiam ser vistas.

### O palco cabe o leitor — e o defeito que a mudança criou

Pedido dele: *"o bloco dos fluxos precisa ser redimensionável, possível de abrir em tela
cheia, os textos estão pequenos"*.

O diagnóstico não era o óbvio. O texto do palco é medido em **unidades da vista**, então
ele chega na tela multiplicado pela escala da projeção — e a escala era 0,62 num monitor de
2560, porque o palco estava **preso pela largura**: 744 pixels de desenho espremidos entre a
ficha (320) e o painel do lab (384). Altura sozinha não aumenta texto nenhum.

Pior no caso que importa: num laptop de 1280 o mesmo rótulo chegava com **4,5 pixels**. A
primeira medição foi no monitor grande e teria fechado a questão errado; foi o teste, rodando
no viewport de 1280, que mostrou.

O que entrou: altura própria e redimensionável pelo canto (`resize: vertical`), botão de
**tela cheia** no Explorer inteiro — trilha e ficha vão junto, porque em tela cheia a pessoa
continua precisando saber onde está —, ficha e painel do lab descendo até 96rem em vez de
70rem, e o tipo do rótulo de 11 para 12 unidades. Resultado medido: 4,5 → **8,4px** no
laptop, ~10,4px no monitor grande, e **~19px em tela cheia**.

**E a mudança criou um defeito, que o teste do zoom da CPU pegou na mesma rodada.** Com
altura própria, o `preserveAspectRatio` passa a deixar faixa vazia dos dois lados do desenho
— e as contas do zoom e do arraste mapeavam a caixa **inteira** linearmente para o `viewBox`.
Enquanto a altura saía da proporção, as duas formas eram iguais e a conta estava certa; com
altura própria, deixou de estar, e a roda do mouse passou a ampliar um ponto em que o cursor
não está. O somador da ULA parava em 7% de abertura.

A conta estava escrita **duas vezes** — uma no zoom, outra no arraste — e havia ainda uma
terceira cópia em `noDesenho`, que não era usada por ninguém. Agora é uma só
(`encaixeDoQuadro`), e as três viraram uma.

A legibilidade virou número em `apps/site/tests/palco-legivel.spec.ts`, e o piso é honesto
sobre o que a página entrega sozinha: numa tela de 1280 por 720 uma vista de 1200 por 740
ocupa quase o monitor inteiro, e nenhum arranjo põe o rótulo em nove pixels ali dentro. Oito
é o que a página dá; a tela cheia leva o mesmo rótulo a dezoito.

### O que ficou pendente desta rodada

- **Arrastar processadores para a `pipeline`** e ver a ordem de registro importar. É a
  decisão "parâmetro vs composição" da spec do handbook §4 levada a sério, e é rodada
  própria: mexe no palco (arrastar), no modelo (mundo que muda de forma sem recomeçar) e
  no currículo (a `pipeline` nasce com um filho, e ordem só ensina com dois).
- **A estampa da compressão mudando a forma do item.** A forma hoje sai de três fatos que o
  motor já tem — largura declarada, aresta que é canal, peso maior que um — e nenhum deles
  é compressão. O caminho honesto é uma primitiva nova e neutra: `Message` ganhar **quanto
  ela pesa na linha**, separado de **quantos itens ela leva**. Aí comprimir é o mesmo `×N`
  num pacote menor, e vale para qualquer domínio. Meia medida aqui seria o domínio
  escolhendo forma, que é a porta dos fundos que o catálogo existe para fechar.

Estado: 911 testes unitários, 201 e2e, typecheck, boundaries (81 arquivos), catálogo (12
arquivos) e build (33 páginas) verdes.
