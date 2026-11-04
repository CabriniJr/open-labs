import { film, pt, type Box, type Film } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { ATRIBUTOS_DA_CARDINALIDADE } from "./labels.js";
import { calcular, type Atributo } from "./modelo.js";

/**
 * O showcase da cardinalidade: o cubo de séries, montado um atributo de cada vez.
 *
 * Cada passo é `calcular` com um atributo a mais — a mesma conta do lab. Rota
 * vira uma fileira, status vira uma grade, método vira altura (no 3D, cada
 * célula ganha andares), e o id do cliente não cabe em desenho nenhum: o cubo
 * inteiro se repete uma vez por cliente. No fim, o que cada ponto carrega no
 * fio: a chave de cada atributo, inteira, em todo ponto.
 */

export interface OpcoesDaVitrineDaCardinalidade {
  /** O `enduser.id` entra na métrica. */
  readonly comCliente: boolean;
}

export const OPCOES_DA_VITRINE_DA_CARDINALIDADE: OpcoesDaVitrineDaCardinalidade = { comCliente: true };

/** Os mesmos padrões da simulação: histograma de 11 baldes, 4 exportações por minuto. */
export const BALDES_DA_VITRINE = 11;
export const EXPORTACOES_DA_VITRINE = 4;

const porId = (id: string): Atributo => ATRIBUTOS_DA_CARDINALIDADE.find((a) => a.id === id)!;

export interface EtapaDoCubo {
  readonly atributo: Atributo | null;
  readonly series: number;
  readonly pontosPorMinuto: number;
}

export function etapasDoCubo(opcoes: OpcoesDaVitrineDaCardinalidade = OPCOES_DA_VITRINE_DA_CARDINALIDADE): EtapaDoCubo[] {
  const ordem = ["route", "status", "method", ...(opcoes.comCliente ? ["customer"] : [])].map(porId);
  const etapas: EtapaDoCubo[] = [];
  for (let i = 0; i <= ordem.length; i += 1) {
    const escolhidos = ordem.slice(0, i);
    const c = calcular(escolhidos, "histogram", BALDES_DA_VITRINE, EXPORTACOES_DA_VITRINE, Number.MAX_SAFE_INTEGER);
    etapas.push({ atributo: i === 0 ? null : ordem[i - 1]!, series: c.series, pontosPorMinuto: c.pontosPorMinuto });
  }
  return etapas;
}

/**
 * Os bytes que só as chaves dos atributos ocupam num ponto: UTF-8 de cada
 * nome, que o protobuf escreve inteiro em todo `KeyValue` de todo ponto.
 * Não é o ponto inteiro — é a parte que ninguém lembra que paga.
 */
export function bytesDasChaves(atributos: readonly Atributo[]): number {
  return atributos.reduce((n, a) => n + new TextEncoder().encode(a.nome).length, 0);
}

export interface DetalheDaVitrineDaCardinalidade {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const mil = (n: number) => n.toLocaleString("en-US").replaceAll(",", " ");

export const LARGURA_DA_CARDINALIDADE = 1280;
export const ALTURA_DA_CARDINALIDADE = 720;

export function filmeDaVitrineDaCardinalidade(opcoes: OpcoesDaVitrineDaCardinalidade = OPCOES_DA_VITRINE_DA_CARDINALIDADE): Film<DetalheDaVitrineDaCardinalidade> {
  const etapas = etapasDoCubo(opcoes);
  const [, eRota, eStatus, eMetodo, eCliente] = etapas;
  const rota = eRota!.atributo!;
  const status = eStatus!.atributo!;
  const metodo = eMetodo!.atributo!;
  const f = film<DetalheDaVitrineDaCardinalidade>({ width: LARGURA_DA_CARDINALIDADE, height: ALTURA_DA_CARDINALIDADE, maxZoom: 1.9 });

  f.add({ type: "node", id: "metrica", box: B(40, 60, 230, 90), label: "http.server.request.duration", sublabel: `histogram · ${BALDES_DA_VITRINE} buckets`, tone: "kind-4", icon: I.metric });
  f.add({ type: "node", id: "contador", box: B(40, 190, 230, 110), label: "1", sublabel: "series", tone: "container" });
  f.add({ type: "node", id: "volume", box: B(40, 330, 230, 90), label: mil(etapas[0]!.pontosPorMinuto), sublabel: "data points / minute", tone: "container" });
  const CUBO = B(300, 40, 940, 520);
  f.add({ type: "region", id: "cubo", box: CUBO, label: "one cell is one attribute set — one series", tone: "kind-4" });

  const W = 56;
  const H = 40;
  const X0 = 340;
  const Y0 = 110;
  const celula = (r: number, s: number) => B(X0 + r * (W + 8), Y0 + s * (H + 8), W, H);
  f.add({ type: "node", id: "unica", box: celula(0, 0), label: "", tone: "kind-4", hidden: true, height: 6 });
  for (let r = 0; r < rota.valores; r += 1) {
    for (let s = 0; s < status.valores; s += 1) {
      f.add({ type: "node", id: `c:${r}:${s}`, box: celula(r, s), label: "", tone: "kind-4", hidden: true, height: 6 });
      // A mesma célula com os andares do método: no 3D, altura = valores do método.
      f.add({ type: "node", id: `m:${r}:${s}`, box: celula(r, s), label: "", tone: "kind-4", hidden: true, height: 6 * metodo.valores });
    }
  }
  f.add({ type: "note", id: "n:rota", at: pt(X0, Y0 - 22), label: `${rota.nome} · ${rota.valores} values →`, tone: "muted", align: "start", hidden: true });
  // À direita, na linha da rota: à esquerda da grade ficam o contador e o volume.
  f.add({ type: "note", id: "n:status", at: pt(X0 + rota.valores * (W + 8) - 8, Y0 - 22), label: `↓ ${status.nome} · ${status.valores} values`, tone: "muted", align: "end", hidden: true });
  f.add({ type: "note", id: "n:metodo", at: pt(X0, Y0 + status.valores * (H + 8) + 18), label: `× ${metodo.nome} · ${metodo.valores} values: each cell is ${metodo.valores} series tall`, tone: "muted", align: "start", hidden: true });
  const fantasmas = eCliente === undefined ? 0 : Math.min(8, eCliente.atributo!.valores);
  for (let k = 1; k <= fantasmas; k += 1) {
    f.add({ type: "region", id: `g:${k}`, box: B(X0 + k * 14, Y0 + k * 12, rota.valores * (W + 8) - 8, status.valores * (H + 8) - 8), label: k === fantasmas ? `… one cube per ${eCliente!.atributo!.nome}` : "", tone: "live", hidden: true, elevation: 6 * metodo.valores + k * 8 });
  }

  // O ponto no fio: as chaves de cada atributo, inteiras.
  const escolhidos = etapas.slice(1).map((e) => e.atributo!);
  const chaves = bytesDasChaves(escolhidos);
  const final = etapas.at(-1)!;
  f.add({ type: "node", id: "ponto", box: B(40, 600, 1200, 90), label: escolhidos.map((a) => `${a.nome}=…`).join("   "), sublabel: `the keys alone: ${chaves} B in every point · × ${mil(final.pontosPorMinuto)} points/min`, tone: "conduit", hidden: true, icon: I.bytes });

  const passo = (e: EtapaDoCubo) => (d: Parameters<Parameters<typeof f.chapter>[1]>[0]) => {
    d.set("contador", { label: mil(e.series) }).ping("contador");
    d.set("volume", { label: mil(e.pontosPorMinuto) }).ping("volume");
  };
  f.chapter(
    { id: "one", title: "No attributes, one series", body: "A histogram with no attributes is one series: every request lands in the same set of buckets.", detail: { nivel: 0, linhas: [["attributes", "none"], ["series", "1"]] } },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      d.show("unica", { dur: 400 }).ping("unica");
      d.wait(900);
    },
  );
  f.chapter(
    { id: "route", title: `+ ${rota.nome}: a row`, body: `Each distinct route is its own attribute set, so its own series: ${rota.valores} cells in a row.`, detail: { nivel: 1, linhas: [["attributes", rota.nome], ["series", mil(eRota!.series)]] } },
    (d) => {
      d.hide("unica", { dur: 200 });
      d.show("n:rota", { dur: 300 });
      d.stagger(Array.from({ length: rota.valores }, (_, r) => r), 70, (x, r) => {
        x.show(`c:${r}:0`, { dur: 250 });
      });
      passo(eRota!)(d);
      d.wait(700);
    },
  );
  f.chapter(
    { id: "status", title: `× ${status.nome}: a grid`, body: `Not ${rota.valores} + ${status.valores}: every route meets every status code. ${rota.valores} × ${status.valores} = ${eStatus!.series} cells.`, detail: { nivel: 1, linhas: [["attributes", `${rota.nome}, ${status.nome}`], ["series", mil(eStatus!.series)]] } },
    (d) => {
      d.show("n:status", { dur: 300 });
      d.stagger(Array.from({ length: status.valores - 1 }, (_, s) => s + 1), 140, (x, s) => {
        x.show(Array.from({ length: rota.valores }, (_, r) => `c:${r}:${s}`), { dur: 250 });
      });
      passo(eStatus!)(d);
      d.wait(700);
    },
  );
  f.chapter(
    { id: "method", title: `× ${metodo.nome}: a cube`, body: `Each cell splits again by method. In the isometric view the grid grows up: ${eStatus!.series} × ${metodo.valores} = ${eMetodo!.series} series.`, detail: { nivel: 2, linhas: [["attributes", `+ ${metodo.nome}`], ["series", mil(eMetodo!.series)], ["points / min", mil(eMetodo!.pontosPorMinuto)]] } },
    (d) => {
      d.show("n:metodo", { dur: 300 });
      d.together(
        (x) => x.hide(Array.from({ length: rota.valores * status.valores }, (_, i) => `c:${i % rota.valores}:${Math.floor(i / rota.valores)}`), { dur: 300 }),
        (x) => x.show(Array.from({ length: rota.valores * status.valores }, (_, i) => `m:${i % rota.valores}:${Math.floor(i / rota.valores)}`), { dur: 500 }),
      );
      passo(eMetodo!)(d);
      d.wait(900);
    },
  );
  if (eCliente !== undefined) {
    const c = eCliente.atributo!;
    f.chapter(
      {
        id: "customer",
        title: `× ${c.nome}: the cube, ${mil(c.valores)} times`,
        body: `One line of code adds ${c.nome}. Every one of the ${eMetodo!.series} series now exists once per customer: ${mil(eCliente.series)}. Nothing warned you, because nothing was wrong.`,
        detail: { nivel: 2, linhas: [["attributes", `+ ${c.nome}`], ["series", mil(eCliente.series)], ["points / min", mil(eCliente.pontosPorMinuto)]] },
      },
      (d) => {
        d.stagger(Array.from({ length: fantasmas }, (_, k) => k + 1), 160, (x, k) => {
          x.show(`g:${k}`, { dur: 300 });
        });
        d.set("contador", { tone: "live" });
        passo(eCliente)(d);
        d.wait(1400);
      },
    );
  }
  f.chapter(
    {
      id: "wire",
      title: "Down: every point carries every key",
      body: `On the wire, each data point repeats each attribute's key in full — ${chaves} bytes of names alone, before any value, in every one of ${mil(final.pontosPorMinuto)} points a minute.`,
      detail: { nivel: 3, linhas: [["series", mil(final.series)], ["points / min", mil(final.pontosPorMinuto)], ["key bytes / point", String(chaves)], ["key bytes / min", mil(chaves * final.pontosPorMinuto)]] },
    },
    (d) => {
      d.camera({ box: B(20, 560, 1240, 150) }, { dur: 1300 });
      d.show("ponto", { dur: 400 }).ping("ponto").wait(2000);
    },
  );
  return f.build();
}
