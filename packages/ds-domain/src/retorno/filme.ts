import { film, pt, type Box, type Film } from "@ovh/motion";
import { analisar, metricasDeClassificacao, retornoPorCaminhada, type Base, type Sessao } from "./modelo.js";

/**
 * O filme de "quem volta ao telecentro", derivado de `analisar()`. À esquerda,
 * uma amostra das sessões: minutos de caminhada × nota, verde para quem voltou.
 * A divisão por pessoa apaga o treino; a linear põe as notas previstas contra as
 * reais; a logística desenha o retorno previsto contra a caminhada, com o corte;
 * a matriz de confusão fecha. Todo número vem do modelo rodado sobre a base.
 */
export interface DetalheDoRetorno {
  readonly sessoes: number;
  readonly pessoas: number;
  readonly treino: { readonly sessoes: number; readonly pessoas: number } | null;
  readonly teste: { readonly sessoes: number; readonly pessoas: number } | null;
  readonly regressao: { readonly MAE: number; readonly RMSE: number; readonly R2: number; readonly R2DaMedia: number } | null;
  readonly classificacao: { readonly corte: number; readonly vp: number; readonly fp: number; readonly fn: number; readonly vn: number; readonly precisao: number; readonly recall: number; readonly F1: number } | null;
  readonly curva: readonly { readonly minutos: number; readonly retorno: number }[] | null;
}

export const LARGURA_DO_RETORNO = 1280;
export const ALTURA_DO_RETORNO = 720;

const ESQ: Box = { x: 70, y: 120, w: 520, h: 480 };
const DIR: Box = { x: 690, y: 120, w: 520, h: 480 };
const MAX_MIN = 40;
const AMOSTRA = 140;
const R = 6;

const ponto = (p: Box, fx: number, fy: number): Box => ({ x: p.x + fx * p.w - R, y: p.y + (1 - fy) * p.h - R, w: 2 * R, h: 2 * R });

export function filmeDoRetorno(base: Base): Film<DetalheDoRetorno> {
  const a = analisar(base);
  const { treino, teste } = a.partes;
  const todas: Sessao[] = [...treino, ...teste];
  const ehTeste = new Set(teste);
  const passo = Math.max(1, Math.floor(todas.length / AMOSTRA));
  // A amostra mistura treino e teste na proporção da base, sempre as mesmas sessões.
  const ordenadas = [...todas].sort((x, y) => x.id_aluno - y.id_aluno || x.minutos_caminhada - y.minutos_caminhada);
  const amostra = ordenadas.filter((_, i) => i % passo === 0).slice(0, AMOSTRA);
  const indiceNoTeste = new Map(teste.map((s, i) => [s, i]));

  const f = film<DetalheDoRetorno>({ width: LARGURA_DO_RETORNO, height: ALTURA_DO_RETORNO, gap: 350, maxZoom: 1.5 });
  f.add({ type: "note", id: "nota", at: pt(LARGURA_DO_RETORNO / 2, 40), label: `${todas.length} study sessions · ${new Set(todas.map((s) => s.id_aluno)).size} people`, tone: "ink", width: 1100 });
  f.add({ type: "region", id: "esq", box: { x: ESQ.x - 30, y: ESQ.y - 40, w: ESQ.w + 60, h: ESQ.h + 80 }, label: "each dot is a session: minutes walking × grade", tone: "container" });
  f.add({ type: "region", id: "dir", box: { x: DIR.x - 30, y: DIR.y - 40, w: DIR.w + 60, h: DIR.h + 80 }, label: "", tone: "controller", hidden: true });
  for (const m of [0, 10, 20, 30, 40]) f.add({ type: "note", id: `ex:${m}`, at: pt(ESQ.x + (m / MAX_MIN) * ESQ.w, ESQ.y + ESQ.h + 22), label: `${m} min`, tone: "muted", width: 70 });
  for (const n of [0, 5, 10]) f.add({ type: "note", id: `ey:${n}`, at: pt(ESQ.x - 22, ESQ.y + (1 - n / 10) * ESQ.h), label: String(n), tone: "muted", width: 30 });

  amostra.forEach((s, k) => {
    f.add({ type: "node", id: `s:${k}`, box: ponto(ESQ, Math.min(s.minutos_caminhada / MAX_MIN, 1), s.nota / 10), shape: "circle", label: "", tone: s.voltou_em_7_dias ? "conduit" : "muted", hidden: true });
  });

  // Eixos da direita: um par por capítulo, para não haver legenda velha na tela.
  const eixo = (id: string, x: number, y: number, label: string) => f.add({ type: "note", id, at: pt(x, y), label, tone: "muted", width: 120, hidden: true });
  eixo("r3x", DIR.x + DIR.w / 2, DIR.y + DIR.h + 22, "real grade →");
  eixo("r3y", DIR.x + 40, DIR.y - 14, "↑ predicted");
  eixo("r4x0", DIR.x, DIR.y + DIR.h + 22, "0 min");
  eixo("r4x1", DIR.x + DIR.w, DIR.y + DIR.h + 22, "40 min");
  eixo("r4y0", DIR.x - 22, DIR.y + DIR.h, "0%");
  eixo("r4y5", DIR.x - 26, DIR.y + DIR.h / 2, "50%");
  eixo("r4y1", DIR.x - 28, DIR.y, "100%");
  // Direita, capítulo 3: nota real × prevista das sessões de teste da amostra.
  const daAmostraNoTeste = amostra.map((s, k) => [s, k] as const).filter(([s]) => ehTeste.has(s));
  daAmostraNoTeste.forEach(([s, k]) => {
    const prev = a.notaPrevista[indiceNoTeste.get(s)!]!;
    f.add({ type: "node", id: `p:${k}`, box: ponto(DIR, s.nota / 10, Math.min(Math.max(prev, 0), 10) / 10), shape: "circle", label: "", tone: "kind-2", hidden: true });
  });
  for (let k = 0; k <= 10; k += 1) f.add({ type: "node", id: `diag:${k}`, box: ponto(DIR, k / 10, k / 10), shape: "circle", label: "", tone: "muted", hidden: true });

  // Direita, capítulo 4: o retorno previsto contra a caminhada.
  const minutos = Array.from({ length: 21 }, (_, i) => i * 2);
  const retorno = retornoPorCaminhada(a, minutos);
  minutos.forEach((m, i) => f.add({ type: "node", id: `c:${i}`, box: ponto(DIR, m / MAX_MIN, retorno[i]!), shape: "circle", label: "", tone: "processor", hidden: true }));
  for (let k = 0; k <= 10; k += 1) f.add({ type: "node", id: `corte:${k}`, box: ponto(DIR, k / 10, 0.5), shape: "circle", label: "", tone: "high", hidden: true });

  // Direita, capítulo 5: a matriz de confusão.
  const corte = 0.5;
  const m = metricasDeClassificacao(teste.map((s) => s.voltou_em_7_dias), a.probabilidade, corte);
  const celula = (i: number, j: number): Box => ({ x: DIR.x + 90 + j * 210, y: DIR.y + 60 + i * 170, w: 190, h: 150 });
  const quadros = [
    { id: "vn", i: 0, j: 0, n: m.vn, txt: "stays away · predicted away", tone: "conduit" as const },
    { id: "fp", i: 0, j: 1, n: m.fp, txt: "stays away · predicted back", tone: "live" as const },
    { id: "fn", i: 1, j: 0, n: m.fn, txt: "comes back · predicted away", tone: "high" as const },
    { id: "vp", i: 1, j: 1, n: m.vp, txt: "comes back · predicted back", tone: "conduit" as const },
  ];
  quadros.forEach((q) => f.add({ type: "node", id: `m:${q.id}`, box: celula(q.i, q.j), label: String(q.n), sublabel: q.txt, tone: q.tone, hidden: true }));

  // ------------------------------------------------------------ o detalhe
  const pessoas = (ss: readonly Sessao[]) => new Set(ss.map((s) => s.id_aluno)).size;
  let det: DetalheDoRetorno = { sessoes: todas.length, pessoas: pessoas(todas), treino: null, teste: null, regressao: null, classificacao: null, curva: null };
  const ids = amostra.map((_, k) => `s:${k}`);

  f.chapter({ id: "data", title: "Who comes back to the telecentre?", body: `Each dot is one study session. Further right, a longer walk from home to the telecentre; higher, a better grade on the lab's checkpoint. Green: the person came back within 7 days. Two questions: what grade will they get, and will they come back?`, detail: det }, (d) => {
    d.camera({ at: { cx: LARGURA_DO_RETORNO / 2, cy: ALTURA_DO_RETORNO / 2, zoom: 1 } });
    d.stagger(ids, 8, (x, id) => x.show(id, { dur: 200 }));
    d.wait(1800);
  });

  det = { ...det, treino: { sessoes: treino.length, pessoas: pessoas(treino) }, teste: { sessoes: teste.length, pessoas: pessoas(teste) } };
  f.chapter({ id: "split", title: "Split by person, not by row", body: `The same person has up to five sessions. If some land in training and others in the test, the model is graded on people it already knows. So ${pessoas(teste)} people — all their sessions — are kept out of training.`, detail: det }, (d) => {
    const doTreino = amostra.map((s, k) => [s, k] as const).filter(([s]) => !ehTeste.has(s)).map(([, k]) => `s:${k}`);
    d.dim(doTreino, 0.75, { dur: 600 });
    d.set("nota", { label: `training: ${treino.length} sessions of ${pessoas(treino)} people · test: ${teste.length} sessions of ${pessoas(teste)} people, never seen` });
    d.wait(2200);
  });

  det = { ...det, regressao: { MAE: a.regressao.MAE, RMSE: a.regressao.RMSE, R2: a.regressao.R2, R2DaMedia: a.linhaDeBase.R2 } };
  f.chapter({ id: "line", title: "Linear regression: the grade", body: `Fitted on training only, then asked about the test people. On the right, each test session: real grade across, predicted grade up. On the diagonal, a perfect guess. Mean error ${a.regressao.MAE.toFixed(2)} points; R² ${a.regressao.R2.toFixed(2)}, where guessing the average gives ${a.linhaDeBase.R2.toFixed(2)}.`, detail: det }, (d) => {
    d.set("dir", { label: "test sessions: real grade × predicted grade" }).show("dir", { dur: 300 });
    d.together((x) => x.show("r3x", { dur: 200 }), (x) => x.show("r3y", { dur: 200 }));
    d.stagger(Array.from({ length: 11 }, (_, k) => `diag:${k}`), 30, (x, id) => x.show(id, { dur: 150 }));
    d.stagger(daAmostraNoTeste.map(([, k]) => `p:${k}`), 25, (x, id) => x.show(id, { dur: 200 }));
    d.set("nota", { label: `linear regression · MAE ${a.regressao.MAE.toFixed(2)} · RMSE ${a.regressao.RMSE.toFixed(2)} · R² ${a.regressao.R2.toFixed(2)}` });
    d.wait(2400);
  });

  det = { ...det, curva: minutos.map((mm, i) => ({ minutos: mm, retorno: retorno[i]! })) };
  f.chapter({ id: "curve", title: "Logistic regression: will they come back?", body: `The same test people, with only the walk changed: at 0 minutes the model expects ${(retorno[0]! * 100).toFixed(0)}% to come back; at 20, ${(retorno[10]! * 100).toFixed(0)}%; at 40, ${(retorno[20]! * 100).toFixed(0)}%. The yellow line is the cut-off: below it, the model says "will not come back".`, detail: det }, (d) => {
    d.together(
      ...daAmostraNoTeste.map(([, k]) => (x: typeof d) => x.hide(`p:${k}`, { dur: 300 })),
      ...Array.from({ length: 11 }, (_, k) => (x: typeof d) => x.hide(`diag:${k}`, { dur: 300 })),
    );
    d.together((x) => x.hide("r3x", { dur: 200 }), (x) => x.hide("r3y", { dur: 200 }), ...["r4x0", "r4x1", "r4y0", "r4y5", "r4y1"].map((id) => (x: typeof d) => x.show(id, { dur: 200 })));
    d.set("dir", { label: "predicted chance of coming back × minutes walking" });
    d.set("nota", { label: `logistic regression · walk 0 min → ${(retorno[0]! * 100).toFixed(0)}% · 20 min → ${(retorno[10]! * 100).toFixed(0)}% · 40 min → ${(retorno[20]! * 100).toFixed(0)}% come back` });
    d.stagger(minutos.map((_, i) => `c:${i}`), 70, (x, id) => x.show(id, { dur: 200 }).ping(id));
    d.stagger(Array.from({ length: 11 }, (_, k) => `corte:${k}`), 25, (x, id) => x.show(id, { dur: 150 }));
    d.wait(2200);
  });

  det = { ...det, classificacao: { corte, vp: m.vp, fp: m.fp, fn: m.fn, vn: m.vn, precisao: m.precisao, recall: m.recall, F1: m.F1 } };
  f.chapter({ id: "matrix", title: "Who to remind", body: `On the ${teste.length} test sessions, at cut-off ${corte}: precision ${m.precisao.toFixed(2)}, recall ${m.recall.toFixed(2)}, F1 ${m.F1.toFixed(2)}. A reminder costs little, so the telecentre cares most about the people who will stay away — the top row.`, detail: det }, (d) => {
    d.together(...minutos.map((_, i) => (x: typeof d) => x.hide(`c:${i}`, { dur: 300 })), ...Array.from({ length: 11 }, (_, k) => (x: typeof d) => x.hide(`corte:${k}`, { dur: 300 })));
    d.together(...["r4x0", "r4x1", "r4y0", "r4y5", "r4y1"].map((id) => (x: typeof d) => x.hide(id, { dur: 200 })));
    d.set("dir", { label: `confusion matrix · test · cut-off ${corte}` });
    d.stagger(quadros.map((q) => `m:${q.id}`), 260, (x, id) => x.show(id, { dur: 260 }).ping(id));
    d.set("nota", { label: `logistic regression · precision ${m.precisao.toFixed(2)} · recall ${m.recall.toFixed(2)} · F1 ${m.F1.toFixed(2)}` });
    d.wait(2600);
  });
  return f.build();
}
