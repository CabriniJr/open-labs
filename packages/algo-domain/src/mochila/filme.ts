import { film, pt, type Box, type Film } from "@ovh/motion";
import { ICONES_ALGO } from "../icones.js";
import { CATALOGO, CENARIOS_DA_MOCHILA, chamadasSemMemoria, gulosa, itensDoCenario, MAIOR_SESSAO, mochila, PASSO, type CenarioDaMochila } from "./mochila.js";

/**
 * O filme da mochila, derivado de `mochila()` e `gulosa()`. À esquerda, os labs
 * liberados — cada um na altura da linha dele na tabela. À direita, a tabela
 * `T[i][t]` enchendo linha a linha. A gulosa escolhe primeiro, pela densidade;
 * depois a tabela enche; depois a volta pela tabela acende os labs que entram.
 * Mudar o cenário refaz tudo.
 */
export interface DetalheDaMochila {
  readonly cenario: string;
  readonly sessao: number;
  readonly gulosa: { readonly labs: readonly string[]; readonly pontos: number } | null;
  /** Linhas da tabela já preenchidas (0 = só a linha de base). */
  readonly linhas: number;
  readonly totalDeLinhas: number;
  readonly otimo: { readonly labs: readonly string[]; readonly pontos: number } | null;
  readonly contagem: { readonly celulas: number; readonly semMemoria: number; readonly subconjuntos: number } | null;
}

export const LARGURA_DA_MOCHILA = 1280;
export const ALTURA_DA_MOCHILA = 720;

const X_TABELA = 400;
const LARGURA_TABELA = 840;
const Y_TABELA = 120;
const ALTURA_TABELA = 410;

export function filmeDaMochila(idDoCenario = "rafa"): Film<DetalheDaMochila> {
  const cenario: CenarioDaMochila = CENARIOS_DA_MOCHILA.find((c) => c.id === idDoCenario) ?? CENARIOS_DA_MOCHILA[0]!;
  const itens = itensDoCenario(cenario);
  const sessao = cenario.sessao;
  const m = mochila(itens, sessao);
  const g = gulosa(itens, sessao);
  const semMemoria = chamadasSemMemoria(itens, sessao);
  const colunas = sessao / PASSO + 1;
  const linhas = itens.length + 1;
  const f = film<DetalheDaMochila>({ width: LARGURA_DA_MOCHILA, height: ALTURA_DA_MOCHILA, gap: 350, maxZoom: 1.5 });

  // ------------------------------------------------------------ o cenário
  const passoX = LARGURA_TABELA / colunas;
  const passoY = Math.min(64, ALTURA_TABELA / linhas);
  const celula = (i: number, c: number): Box => ({ x: X_TABELA + c * passoX + 2, y: Y_TABELA + i * passoY + 2, w: passoX - 4, h: passoY - 4 });

  f.add({ type: "note", id: "nota", at: pt(LARGURA_DA_MOCHILA / 2, 34), label: `${itens.length} labs unlocked · ${sessao} minutes of computer time`, tone: "ink", width: 1000 });
  f.add({ type: "region", id: "labs", box: { x: 30, y: Y_TABELA - 50, w: 340, h: linhas * passoY + 60 }, label: "labs unlocked today", tone: "container" });
  f.add({ type: "region", id: "tabela", box: { x: X_TABELA - 16, y: Y_TABELA - 50, w: LARGURA_TABELA + 32, h: linhas * passoY + 60 }, label: "T[i][t]: most points with the first i labs and t minutes", tone: "controller", icon: ICONES_ALGO.tabela });
  f.add({ type: "node", id: "lab:0", box: { x: 46, y: Y_TABELA + 2, w: 308, h: passoY - 4 }, label: "(no lab yet)", tone: "muted" });
  itens.forEach((it, k) => {
    f.add({ type: "node", id: `lab:${k + 1}`, box: { x: 46, y: Y_TABELA + (k + 1) * passoY + 2, w: 308, h: passoY - 4 }, label: it.nome, sublabel: `${it.minutos} min · ${it.pontos} pts`, tone: "kind-1" });
  });
  // Cabeçalho das colunas: os minutos. Com muitas colunas, um rótulo a cada 15 min.
  const cada = colunas > 13 ? 3 : 1;
  for (let c = 0; c < colunas; c += cada) {
    f.add({ type: "note", id: `min:${c}`, at: pt(X_TABELA + (c + 0.5) * passoX, Y_TABELA - 14), label: `${c * PASSO}`, tone: "muted", width: passoX * cada });
  }
  for (let i = 0; i < linhas; i += 1) {
    for (let c = 0; c < colunas; c += 1) {
      f.add({ type: "node", id: `c:${i}:${c}`, box: celula(i, c), label: String(m.T[i]![c]), tone: i === 0 ? "muted" : "controller", hidden: true });
    }
  }
  const yRodape = Y_TABELA + linhas * passoY + 36;
  f.add({ type: "note", id: "gulosa", at: pt(X_TABELA, yRodape), label: "", tone: "ink", align: "start", width: LARGURA_TABELA });
  f.add({ type: "note", id: "otimo", at: pt(X_TABELA, yRodape + 30), label: "", tone: "ink", align: "start", width: LARGURA_TABELA });

  // ------------------------------------------------------------ o detalhe, acompanhando
  let detGulosa: DetalheDaMochila["gulosa"] = null;
  let preenchidas = 0;
  let detOtimo: DetalheDaMochila["otimo"] = null;
  let contagem: DetalheDaMochila["contagem"] = null;
  const detalhe = (): DetalheDaMochila => ({ cenario: cenario.nome, sessao, gulosa: detGulosa, linhas: preenchidas, totalDeLinhas: itens.length, otimo: detOtimo, contagem });
  const nomes = (ks: readonly number[]) => ks.map((k) => itens[k]!.nome);

  f.chapter({ id: "ask", title: `${sessao} minutes at the telecentre`, body: `${cenario.nota} Each lab goes in whole or not at all. Which ones add up to the most points without going over ${sessao} minutes?`, detail: detalhe() }, (d) => {
    d.camera({ at: { cx: LARGURA_DA_MOCHILA / 2, cy: ALTURA_DA_MOCHILA / 2, zoom: 1 } });
    d.stagger(itens.map((_, k) => k + 1), 110, (x, k) => x.ping(`lab:${k}`));
    d.wait(1600);
  });

  const porDensidade = itens.map((_, k) => k).sort((a, b) => itens[b]!.pontos / itens[b]!.minutos - itens[a]!.pontos / itens[a]!.minutos || itens[a]!.nome.localeCompare(itens[b]!.nome));
  f.chapter(
    { id: "greedy", title: "Greedy: the most points per minute first", body: `Sort by points per minute and take whatever still fits. One pass, ${itens.length} decisions, never reconsidered.`, detail: detalhe() },
    (d) => {
      let sobra = sessao;
      const tomados: number[] = [];
      for (const k of porDensidade) {
        const it = itens[k]!;
        const cabe = it.minutos <= sobra;
        if (cabe) {
          sobra -= it.minutos;
          tomados.push(k);
        }
        detGulosa = { labs: nomes(tomados), pontos: tomados.reduce((s, j) => s + itens[j]!.pontos, 0) };
        d.beat({ title: `${it.nome}: ${(it.pontos / it.minutos).toFixed(2)} pts/min — ${cabe ? `take it, ${sobra} min left` : `does not fit in ${sobra} min`}`, detail: detalhe() });
        d.set(`lab:${k + 1}`, { tone: cabe ? "processor" : "muted" }).ping(`lab:${k + 1}`).wait(420);
      }
      d.set("gulosa", { label: `greedy: ${g.pontos} pts in ${g.minutos} of ${sessao} min` }).wait(1400);
    },
  );

  f.chapter(
    { id: "table", title: "The table: every smaller session first", body: `Row by row, each cell asks one question about the lab of its row: skip it (the cell above) or take it (its points + the cell above, its minutes to the left)? ${m.celulas} cells, each computed once.`, detail: detalhe() },
    (d) => {
      itens.forEach((_, k) => d.set(`lab:${k + 1}`, { tone: "kind-1" }));
      d.together(...Array.from({ length: colunas }, (_, c) => (x: typeof d) => x.show(`c:0:${c}`, { dur: 160 })));
      const ritmo = Math.max(18, Math.min(110, 3600 / m.celulas));
      for (let i = 1; i < linhas; i += 1) {
        const it = itens[i - 1]!;
        preenchidas = i;
        d.beat({ title: `Row ${i}: with ${it.nome} (${it.minutos} min, ${it.pontos} pts)`, detail: detalhe() });
        d.glow(`lab:${i}`);
        for (let c = 0; c < colunas; c += 1) d.show(`c:${i}:${c}`, { dur: ritmo, wait: false }).wait(ritmo);
      }
      d.glow(`c:${linhas - 1}:${colunas - 1}`).ping(`c:${linhas - 1}:${colunas - 1}`).wait(1200);
    },
  );

  f.chapter(
    { id: "back", title: `Walking back: ${m.pontos} points`, body: `Start at the bottom-right cell. If it differs from the cell above, the lab of that row went in: jump left by its minutes. Otherwise go straight up.`, detail: detalhe() },
    (d) => {
      const tomados: number[] = [];
      for (const [i, c] of m.caminho) {
        if (i === 0) break;
        const entrou = m.T[i]![c] !== m.T[i - 1]![c];
        if (entrou) tomados.unshift(i - 1);
        detOtimo = { labs: nomes(tomados), pontos: tomados.reduce((s, k) => s + itens[k]!.pontos, 0) };
        d.beat({ title: entrou ? `${itens[i - 1]!.nome} goes in` : `${itens[i - 1]!.nome} stays out`, detail: detalhe() });
        d.glow(`c:${i}:${c}`).set(`c:${i}:${c}`, { tone: entrou ? "conduit" : "high" });
        d.set(`lab:${i}`, { tone: entrou ? "conduit" : "muted" }).ping(`lab:${i}`).wait(520);
      }
      d.set("otimo", { label: `the table: ${m.pontos} pts in ${m.minutos} of ${sessao} min${m.pontos > g.pontos ? ` — ${m.pontos - g.pontos} more than greedy` : " — greedy found it too"}` }).wait(1800);
    },
  );

  contagem = { celulas: m.celulas, semMemoria, subconjuntos: 2 ** itens.length };
  // Com poucos labs a diferença é pequena; o catálogo inteiro em três horas mostra o crescimento.
  const todos = { sem: chamadasSemMemoria(CATALOGO, MAIOR_SESSAO), celulas: mochila(CATALOGO, MAIOR_SESSAO).celulas, n: CATALOGO.length };
  f.chapter(
    { id: "memory", title: "Why remembering wins", body: `The same recurrence without the table calls itself ${semMemoria} times here, solving the same (row, minutes) again and again; trying every subset is ${2 ** itens.length}; the table did ${m.celulas}. With all ${todos.n} labs and ${MAIOR_SESSAO} minutes: ${todos.sem} calls, ${2 ** todos.n} subsets, ${todos.celulas} cells. One more lab doubles the first two and adds one row to the table.`, detail: detalhe() },
    (d) => {
      d.set("nota", { label: `without memory: ${semMemoria} calls · every subset: ${2 ** itens.length} · the table: ${m.celulas} cells` }).ping("tabela").wait(2600);
    },
  );
  return f.build();
}
