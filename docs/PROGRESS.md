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
de entrada e drill-down até a porta lógica, virando a fase **F6b** do `roadmap.md`. Ela tem
público (material para as aulas do pai do Luigi), e já nomeou três lacunas reais do motor:
linha de controle sem semântica, ler sem consumir, e combinacional contra registrado. Nenhuma
se resolve com um `kind` novo. A ordem dela contra o Kafka está em aberto, e é decisão do
Luigi.

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
