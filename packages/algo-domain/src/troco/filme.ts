import { connect, film, pt, type Box, type Film } from "@ovh/motion";
import { ICONES_ALGO } from "../icones.js";
import { guloso, otimo, SISTEMAS, type SistemaDeMoedas } from "./troco.js";

/**
 * O filme do troco, derivado de `guloso()` e `otimo()`. As moedas saem da
 * bandeja uma a uma: em cima, a escolha gulosa (a maior que cabe); no meio, a
 * tabela da programação dinâmica enchendo de 0 até o valor; embaixo, a
 * resposta que a tabela lembra. Mudar o sistema de moedas refaz tudo.
 */
export interface DetalheDoTroco {
  readonly sistema: string;
  readonly moedas: readonly number[];
  readonly valor: number;
  readonly gulosas: readonly number[];
  readonly restante: number;
  /** As células da tabela já preenchidas: `minimo[v]`, ou `null` = impossível. */
  readonly tabela: readonly (number | null)[];
  readonly otimas: readonly number[] | null;
  readonly veredito: string;
}

export const LARGURA_DO_TROCO = 1280;
export const ALTURA_DO_TROCO = 720;

/** O valor que cada sistema conta melhor. */
export const VALOR_DO_SISTEMA: Readonly<Record<string, number>> = { brl: 68, "pre-decimal": 48, toy: 6, "no-one": 10 };

const COLUNAS = 13;
const X_LINHA = 330;
const PASSO_MOEDA = 74;
const R_MOEDA = 28;

export function filmeDoTroco(idDoSistema = "toy", valor = VALOR_DO_SISTEMA[idDoSistema] ?? 6): Film<DetalheDoTroco> {
  const sistema: SistemaDeMoedas = SISTEMAS.find((s) => s.id === idDoSistema) ?? SISTEMAS[0]!;
  const g = guloso(sistema.moedas, valor);
  const o = otimo(sistema.moedas, valor);
  const desc = [...sistema.moedas].sort((a, b) => b - a);
  const f = film<DetalheDoTroco>({ width: LARGURA_DO_TROCO, height: ALTURA_DO_TROCO, gap: 350, maxZoom: 1.5 });

  // ------------------------------------------------------------ o cenário
  f.add({ type: "region", id: "bandeja", box: { x: 40, y: 90, w: 220, h: 600 }, label: "coins available", tone: "container", icon: ICONES_ALGO.moeda });
  const passoBandeja = Math.min(90, 540 / desc.length);
  const caixaDaMoeda = (k: number): Box => ({ x: 150 - R_MOEDA, y: 140 + k * passoBandeja, w: 2 * R_MOEDA, h: 2 * R_MOEDA });
  desc.forEach((m, k) => f.add({ type: "node", id: `tipo:${m}`, box: caixaDaMoeda(k), shape: "circle", label: String(m), tone: "kind-3" }));

  f.add({ type: "region", id: "linha:guloso", box: { x: X_LINHA - 20, y: 90, w: 920, h: 130 }, label: "greedy: always the biggest coin that fits", tone: "processor" });
  f.add({ type: "region", id: "tabela", box: { x: X_LINHA - 20, y: 245, w: 920, h: 270 }, label: "the table: fewest coins for every amount from 0 up", tone: "controller", icon: ICONES_ALGO.tabela });
  f.add({ type: "region", id: "linha:otimo", box: { x: X_LINHA - 20, y: 540, w: 920, h: 150 }, label: "what the table remembers: the optimal change", tone: "conduit" });
  f.add({ type: "note", id: "nota", at: pt(LARGURA_DO_TROCO / 2, 40), label: `change for ${valor} with coins {${sistema.moedas.join(", ")}}`, tone: "ink", width: 900 });

  const slot = (linha: "guloso" | "otimo", k: number): Box => ({ x: X_LINHA + k * PASSO_MOEDA, y: linha === "guloso" ? 140 : 600, w: 2 * R_MOEDA, h: 2 * R_MOEDA });
  g.historia.forEach((p, k) => {
    f.add({ type: "node", id: `g:${k}`, box: slot("guloso", k), shape: "circle", label: String(p.moeda), tone: "processor", hidden: true });
    f.add({ type: "token", id: `gt:${k}`, path: connect(caixaDaMoeda(desc.indexOf(p.moeda)), slot("guloso", k), 2), label: String(p.moeda), tone: "processor", hidden: true, size: 5 });
  });
  (o.moedas ?? []).forEach((m, k) => {
    f.add({ type: "node", id: `o:${k}`, box: slot("otimo", k), shape: "circle", label: String(m), tone: "conduit", hidden: true });
    f.add({ type: "token", id: `ot:${k}`, path: connect(caixaDaMoeda(desc.indexOf(m)), slot("otimo", k), 2), label: String(m), tone: "conduit", hidden: true, size: 5 });
  });

  const celulas = valor + 1;
  const largura = Math.min(64, 880 / Math.min(celulas, COLUNAS));
  const linhas = Math.ceil(celulas / COLUNAS);
  const alturaCelula = Math.min(58, 220 / linhas);
  const minimo = o.tabela.minimo;
  for (let v = 0; v <= valor; v += 1) {
    const box = { x: X_LINHA + (v % COLUNAS) * (largura + 4), y: 280 + Math.floor(v / COLUNAS) * (alturaCelula + 4), w: largura, h: alturaCelula };
    const m = minimo[v]!;
    f.add({ type: "node", id: `celula:${v}`, box, label: Number.isFinite(m) ? String(m) : "✕", sublabel: String(v), tone: Number.isFinite(m) ? "controller" : "muted", hidden: true });
  }

  // ------------------------------------------------------------ o detalhe, acompanhando
  const gulosas: number[] = [];
  let restante = valor;
  const preenchidas: (number | null)[] = [];
  let otimas: number[] | null = null;
  let veredito = "";
  const detalhe = (): DetalheDoTroco => ({ sistema: sistema.nome, moedas: sistema.moedas, valor, gulosas: [...gulosas], restante, tabela: [...preenchidas], otimas: otimas === null ? null : [...otimas], veredito });

  f.chapter({ id: "ask", title: `Change for ${valor}`, body: `${sistema.nome}: coins of ${sistema.moedas.join(", ")}. Pay ${valor} with as few coins as possible. ${sistema.nota}`, detail: detalhe() }, (d) => {
    d.camera({ at: { cx: LARGURA_DO_TROCO / 2, cy: ALTURA_DO_TROCO / 2, zoom: 1 } });
    d.stagger(desc, 120, (x, m) => x.ping(`tipo:${m}`));
    d.wait(1600);
  });

  f.chapter(
    { id: "greedy", title: "Greedy: the biggest coin that fits, again and again", body: `It looks at each coin value once, biggest first, and never reconsiders. ${g.passos} decisions.`, detail: detalhe() },
    (d) => {
      g.historia.forEach((p, k) => {
        gulosas.push(p.moeda);
        restante = p.restante;
        d.beat({ title: `Take ${p.moeda} — ${p.restante} left`, detail: detalhe() });
        d.ping(`tipo:${p.moeda}`);
        d.send(`gt:${k}`, { dur: 520 }).show(`g:${k}`, { dur: 120 }).ping(`g:${k}`);
        d.set("nota", { label: `greedy: ${gulosas.join(" + ")}${restante > 0 ? ` · ${restante} left` : ""}` });
      });
      if (g.moedas === null) {
        d.beat({ title: `Stuck with ${g.sobra} left`, detail: detalhe() });
        d.set("nota", { label: `greedy is stuck: ${g.sobra} left and no coin fits` }).ping("linha:guloso");
      }
      d.wait(1400);
    },
  );

  f.chapter(
    { id: "table", title: "The table: solve every smaller amount first", body: `For each amount v from 1 to ${valor}, try every coin c and look up the answer for v − c — already in the table. ${o.passos} steps, and no amount is solved twice.`, detail: detalhe() },
    (d) => {
      const ritmo = Math.max(28, Math.min(160, 2600 / celulas));
      for (let v = 0; v <= valor; v += 1) {
        preenchidas.push(Number.isFinite(minimo[v]!) ? minimo[v]! : null);
        if (v === 0 || v === valor || v % Math.ceil(celulas / 8) === 0) d.beat({ title: `Amount ${v}: ${Number.isFinite(minimo[v]!) ? `${minimo[v]} coins` : "impossible"}`, detail: detalhe() });
        d.show(`celula:${v}`, { dur: ritmo, wait: false }).wait(ritmo);
      }
      d.glow(`celula:${valor}`).ping(`celula:${valor}`);
      d.wait(1200);
    },
  );

  otimas = o.moedas === null ? null : [];
  const gCount = g.moedas?.length;
  const oCount = o.moedas?.length;
  veredito =
    o.moedas === null
      ? `${valor} cannot be paid with these coins at all.`
      : g.moedas === null
        ? `Greedy got stuck; the table pays ${valor} with ${oCount} coins.`
        : gCount! > oCount!
          ? `Greedy used ${gCount} coins; the optimum is ${oCount}. Taking the biggest coin first was wrong here.`
          : `Greedy and the table agree: ${oCount} coins. For this coin system greedy is right.`;
  f.chapter(
    { id: "optimal", title: oCount === undefined ? "No change is possible" : `The table remembers: ${oCount} coins`, body: `Walk back from ${valor}: each cell says which coin it used last. ${veredito}`, detail: detalhe() },
    (d) => {
      (o.moedas ?? []).forEach((m, k) => {
        otimas!.push(m);
        d.beat({ title: `Take ${m}`, detail: detalhe() });
        d.send(`ot:${k}`, { dur: 480 }).show(`o:${k}`, { dur: 120 }).ping(`o:${k}`);
      });
      d.set("nota", { label: veredito }).wait(2200);
    },
  );
  return f.build();
}
