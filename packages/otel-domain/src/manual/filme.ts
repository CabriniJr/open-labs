import { connect, film, pt, type Box, type Film } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { noBackend, nomeDeAltaCardinalidade, OPCOES_MANUAIS, rodarManual, type EstadoManual, type OpcoesManuais, type SpanManual } from "./modelo.js";

/**
 * O filme do lab "Manual spans", derivado de `rodarManual`.
 *
 * À esquerda, o código: cada linha acende quando roda, e a linha comentada fica
 * apagada. No meio, o que o SDK tem na memória: os spans abertos e encerrados,
 * com os atributos que grudaram. À direita, o backend; embaixo, o que ele
 * recebeu. Esquecer o `end()` e pôr o id no nome são escolhas do leitor.
 */
export interface DetalheManual {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const curto = (id: string) => `${id.slice(0, 4)}…`;
const atributos = (s: SpanManual) => {
  const pares = Object.entries(s.atributos).map(([k, v]) => `${k}=${v}`);
  return pares.length === 0 ? "no attributes" : pares.join(" · ");
};
const estadoDoSpan = (s: SpanManual) => `${s.fim === undefined ? "open" : `ended · ${s.fim - s.inicio} ms`} · ${atributos(s)}`;

export const LARGURA_MANUAL = 1280;
export const ALTURA_MANUAL = 720;

export function filmeManual(opcoes: OpcoesManuais = OPCOES_MANUAIS): Film<DetalheManual> {
  const corrida = rodarManual(opcoes);
  const fim = corrida.at(-1)!.estado;
  const backend = noBackend(fim);
  const f = film<DetalheManual>({ width: LARGURA_MANUAL, height: ALTURA_MANUAL, maxZoom: 1.9 });

  // ── o código ──
  const CODE = B(30, 40, 520, 420);
  f.add({ type: "region", id: "code", box: CODE, label: "checkout handler", tone: "muted" });
  const LINHA = (i: number) => B(50, 82 + i * 52, 480, 40);
  corrida.forEach((r) =>
    f.add({ type: "node", id: `ln:${r.linha}`, box: LINHA(r.linha), label: r.comentada ? `// ${r.instrucao.codigo}` : r.instrucao.codigo, sublabel: "", tone: r.comentada ? "muted" : "ink", height: 4 }),
  );

  // ── a memória do SDK ──
  const SDK = B(590, 40, 380, 420);
  f.add({ type: "region", id: "sdk", box: SDK, label: "SDK · spans in memory", tone: "processor" });
  const profundidade = (s: SpanManual): number => (s.parentId === undefined ? 0 : 1 + profundidade(fim.spans.find((x) => x.id === s.parentId)!));
  const CARTAO = (s: SpanManual) => B(610, 92 + profundidade(s) * 150, 340, 108);
  for (const s of fim.spans) {
    f.add({ type: "node", id: `sp:${s.id}`, box: CARTAO(s), label: s.nome, sublabel: "open · no attributes", tone: "kind-1", hidden: true, icon: I.trace, elevation: profundidade(s) * 10 });
    if (nomeDeAltaCardinalidade(s.nome)) f.add({ type: "note", id: `card:${s.id}`, at: pt(CARTAO(s).x + 10, CARTAO(s).y - 10), label: "an id in the name: every order is a new operation", tone: "live", align: "start", hidden: true });
    if (s.ignorados.length > 0) f.add({ type: "note", id: `ign:${s.id}`, at: pt(CARTAO(s).x + 10, CARTAO(s).y + CARTAO(s).h + 18), label: `${s.ignorados.join(", ")} dropped: the span had ended`, tone: "live", align: "start", hidden: true });
  }
  const BACK = B(1030, 170, 210, 110);
  f.add({ type: "node", id: "backend", box: BACK, label: "backend", sublabel: "traces", tone: "container", shape: "cylinder", icon: I.backend });
  for (const id of fim.exportados) {
    const s = fim.spans.find((x) => x.id === id)!;
    f.add({ type: "token", id: `exp:${id}`, path: connect(CARTAO(s), BACK, 6), label: "SPAN", sublabel: s.nome, tone: "kind-1", hidden: true, size: 5, icon: I.trace });
  }

  // ── o que o backend recebeu ──
  const BK = B(30, 490, 1220, 210);
  f.add({ type: "region", id: "bk", box: BK, label: "backend · what arrived", tone: "container" });
  backend.recebidos.forEach((r, k) =>
    f.add({ type: "node", id: `rec:${r.span.id}`, box: B(70 + k * 400, 540, 360, 64), label: r.span.nome, sublabel: r.orfao ? `orphan · parent ${curto(r.span.parentId!)} never arrived` : r.span.parentId === undefined ? `root · ${atributos(r.span)}` : `child of ${curto(r.span.parentId)}`, tone: r.orfao ? "live" : "kind-1", hidden: true, shape: "pill", icon: I.trace }),
  );
  backend.nuncaChegaram.forEach((s, k) =>
    f.add({ type: "note", id: `nunca:${s.id}`, at: pt(BK.x + BK.w - 30, 560 + k * 30), label: `${s.nome}: never ended, never exported`, tone: "live", align: "end", hidden: true }),
  );

  // ── os capítulos: trechos do programa ──
  const raiz = fim.spans[0]!;
  const esquecido = opcoes.esquecerEnd;
  const trechos = [
    { id: "start", title: "startSpan: the clock starts", body: "The handler starts a span. Nothing leaves the process: the span is an open record in the SDK's memory, with a start time and whatever attributes the code sets while it is open.", de: 0, ate: 2 },
    { id: "child", title: "A child, started and ended", body: "A second span started while the first is active becomes its child. When the child ends, the processor hands it to the exporter at once — it leaves before its parent, which is still open.", de: 2, ate: 5 },
    {
      id: "end",
      title: esquecido ? "The end() that never ran" : "end(): now it leaves",
      body: esquecido
        ? "The line that ends the request span is commented out. No error, no warning: the span just stays open in memory, and the exporter never sees it."
        : "The request span ends, gets its duration, and is exported. Only now does the backend have both spans of the trace.",
      de: 5,
      ate: 6,
    },
    {
      id: "after",
      title: esquecido ? "Still open, still in memory" : "After end(), nothing sticks",
      body: esquecido
        ? "The attribute set at the end does stick — to a span that will never be exported. Open spans are memory that does not come back."
        : "Setting order.total after end() does nothing. The span was already sent; the SDK ignores the call.",
      de: 6,
      ate: 7,
    },
  ];
  const linhasDe = (e: EstadoManual): (readonly [string, string])[] => [
    ["open spans", String(e.pilha.length)],
    ["exported", String(e.exportados.length)],
    ...e.spans.map((s) => [s.nome, s.fim === undefined ? "open" : "ended"] as const),
  ];
  for (const tr of trechos) {
    const fatia = corrida.slice(tr.de, tr.ate);
    f.chapter({ id: tr.id, title: tr.title, body: tr.body, detail: { nivel: 0, linhas: linhasDe(corrida[tr.ate - 1]!.estado) } }, (d) => {
      if (tr.id === "start") d.camera({ box: B(20, 20, 1240, 460) }, { dur: 1 });
      fatia.forEach((r) => {
        d.glow(`ln:${r.linha}`, 1).ping(`ln:${r.linha}`);
        if (r.comentada) {
          d.wait(900).glow(`ln:${r.linha}`, 0);
          return;
        }
        const i = r.instrucao;
        const e = r.estado;
        if (i.op === "start") {
          const s = e.spans.at(-1)!;
          d.show(`sp:${s.id}`, { dur: 350 }).ping(`sp:${s.id}`);
          if (nomeDeAltaCardinalidade(s.nome)) d.show(`card:${s.id}`, { dur: 300 });
        } else {
          const s = [...e.spans].reverse().find((x) => x.nome === i.alvo)!;
          d.set(`sp:${s.id}`, { sublabel: estadoDoSpan(s), ...(s.fim === undefined ? {} : { tone: "container" }) }).ping(`sp:${s.id}`);
          if (i.op === "end") {
            d.send(`exp:${s.id}`, { dur: 900 }).ping("backend");
            d.packet({ tag: "SPAN", tone: "kind-1", from: "SDK", to: "backend", protocol: "OTLP", payload: `${s.nome} · ${s.parentId === undefined ? "root" : `parent ${curto(s.parentId)}`} · ${atributos(s)}` });
          }
          if (i.op === "attr" && s.ignorados.includes(i.chave)) d.show(`ign:${s.id}`, { dur: 300 });
        }
        d.wait(450).glow(`ln:${r.linha}`, 0);
      });
      d.wait(500);
    });
  }
  f.chapter(
    {
      id: "backend",
      title: "Down: what the backend got",
      body: esquecido
        ? `One span arrived, and it names a parent that never will. The backend draws charge card as an orphan root, and the request it belonged to — ${raiz.nome} — is not there at all.`
        : "Two spans, parent and child, with the attributes they had when they ended. The order id lives in an attribute, where it can be searched without making every order its own operation.",
      detail: { nivel: 1, linhas: [["received", String(backend.recebidos.length)], ["orphans", String(backend.recebidos.filter((r) => r.orfao).length)], ["never exported", backend.nuncaChegaram.map((s) => s.nome).join(", ") || "—"]] },
    },
    (d) => {
      d.camera({ box: BK }, { dur: 1400 });
      d.stagger([...backend.recebidos], 300, (x, r) => {
        x.show(`rec:${r.span.id}`, { dur: 350 });
      });
      backend.nuncaChegaram.forEach((s) => d.show(`nunca:${s.id}`, { dur: 350 }));
      d.wait(2000);
    },
  );
  return f.build();
}
