# QA de performance — labs e profundidade

**Data:** 2026-11-03 · **Método:** build de produção (`astro preview`), Chromium,
CPU limitada a 4× via CDP (`Emulation.setCPUThrottlingRate`), 1366×800. Para cada
lab: 4 s rodando (fps e p95 do intervalo entre quadros por `requestAnimationFrame`,
long tasks por `PerformanceObserver`) e depois 14 cliques de roda de zoom sobre o
palco. As sondas estão descritas no fim; rodá-las de novo é a forma de saber se
uma mudança ajudou.

## Números

| lab | parado antes | parado agora | zoom antes | zoom agora |
|---|---|---|---|---|
| gates | 11,7 fps (p95 433 ms) | 23,4 (p95 167) | 3,9 (p95 1150) | 5,1 (p95 800) |
| cpu | 13,1 (p95 183) | 23,8 (p95 150) | 7,2 (p95 333) | 6,7 (p95 350) |
| micro | 29,0 (p95 133) | 30,9 (p95 100) | 5,8 (p95 517) | 6,4 (p95 433) |
| providers | 45,1 | 43,1 | 13,0 | 11,6 |
| collector-pipeline | 50 | 51 | 31,5 | ~25 |
| hard-context-and-baggage (motion) | 47,7 | 49,2 | — | — |
| pod-lifecycle, cardinality | 60 | 60 | — | — |

**Leitura crítica:** parado melhorou de verdade nos labs fundos (o dobro na CPU e
nas portas). **O zoom em profundidade continua travando** — 5 a 7 fps com CPU a
4× é inaceitável, e é o problema número um do projeto hoje.

## Onde o tempo vai

Medido com `Performance.getMetrics` sem throttling, zoom da CPU: ~1 s de script,
~0,65 s de estilo + layout, e o restante (~2,4 s) em pintura/rasterização do SVG.

1. **Filtros em SVG** (`drop-shadow`) — em quem se move (carga, pulso) e em
   animação de `filter` (`dui-acender`). Cada quadro re-rasterizava desfoques; no
   zoom, a área do filtro cresce com a escala. *Corrigido* (ver abaixo).
2. **`Camada` recomputa tudo a cada render** — roteamento de fios, índices,
   famílias, e o JSX inteiro, para cada interior aberto, a cada evento de roda.
   *Parcialmente corrigido.*
3. **Nada é cortado fora do quadro.** Ampliado 10×, ~99% do desenho está fora do
   `viewBox` e mesmo assim é roteado, criado em React e pintado. *Não corrigido.*

## O que mudou neste commit

- `trabalhou`, `recolhida`, `familia`, `molduras`, `sentidoDaPista`: índices
  montados uma vez por render em vez de varreduras lineares por peça
  (`trabalhou` era a função mais cara do perfil).
- `delta` do livro-caixa em cache por estado (antes, uma vez por camada aninhada).
- `Camada` em `React.memo`, recebendo o zoom em degraus de 25%
  (`DEGRAU_DO_ZOOM`); o esmaecer do interior continua contínuo via CSS
  (`--dui-escala` / `--dui-escala-degrau`).
- Sem filtro em carga e pulso (halo vira disco translúcido); `dui-acender`
  anima espessura, não sombra; `data-movendo` no SVG desliga filtros enquanto a
  câmera anda.
- `useDeferredValue` foi testado e **revertido**: ganhava fps no gesto, mas o
  interior chegava atrasado depois de o gesto parar (pegou em
  `cpu-zoom.spec.ts` e `zoom.spec.ts`). Latência de conteúdo é pior que fps.

## Próximos passos, em ordem de retorno

1. **Corte por quadro (culling)** em `Camada`: não desenhar `place` cuja caixa
   está fora do `viewBox` (com folga), nem rotear fio cujas duas pontas estão
   fora. É o ganho maior, porque no zoom fundo quase tudo está fora.
2. **Memo por peça**: extrair o `<g className="dui-stage__objeto">` para um
   componente memoizado por (place, ativo, alto, aparece, selecionado). Um tick
   deixa de recriar as ~1000 peças da ULA para mudar as dez que agiram.
3. **Roteamento memoizado** pela estrutura (lugares + conjunto de interiores
   abertos), e não pela câmera.
4. **`interiores?.(id)`** é chamado no render; garantir que o domínio devolve a
   mesma `View` (memo) para o memo de `Camada` valer nos filhos.
5. Considerar canvas/WebGL para camadas com milhares de elementos (o transistor),
   mantendo SVG para o que é lido.
6. Pinça (toque) ainda não existe — `zoom.spec.ts` declara a lacuna.

## As sondas

Três scripts Playwright (não versionados; reescrevê-los é rápido):

- **fps/long tasks:** injeta um laço de `requestAnimationFrame` gravando
  intervalos e um `PerformanceObserver({type:"longtask"})`; 4 s parado, depois
  14× `mouse.wheel(0,-120)` com 40 ms entre eles e 14× de volta.
- **métricas:** `Performance.getMetrics` antes/depois (TaskDuration,
  ScriptDuration, RecalcStyleDuration, LayoutDuration).
- **perfil:** `Profiler.start/stop` no dev server (código não minificado),
  somando *self time* por função.

Para isolar o custo dos filtros, a mesma sonda com
`addStyleTag(".dui-stage, .dui-stage * { filter: none !important }")`.
