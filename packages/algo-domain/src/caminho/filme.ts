import { film, line, pt, type Box, type Film } from "@ovh/motion";
import { ICONES_ALGO } from "../icones.js";
import { BUSCAS, buscarNoMapa, FICHAS_DAS_BUSCAS, mapaDaCidade, ruaEntre, type Busca, type Mapa, type Resultado } from "./caminho.js";

/**
 * O filme da busca no mapa, derivado de `buscarNoMapa()`. Cada evento da busca
 * vira um gesto: o lugar que sai da fronteira acende e fica marcado como
 * resolvido; a rua olhada pisca; o vizinho que ganhou um caminho melhor entra
 * na fronteira com o custo novo.
 *
 * No 3D, a altura de um lugar resolvido é o tempo que levou para chegar nele:
 * o mapa vira um relevo de distância, e a rota final é a descida mais suave.
 */
export interface LinhaDoPlacar {
  readonly busca: Busca;
  readonly nome: string;
  readonly custo: number;
  readonly ruas: number;
  readonly expandidos: number;
  readonly otimo: boolean;
}

export interface DetalheDaBusca {
  readonly busca: Busca;
  readonly evento: string;
  readonly fronteira: readonly { readonly lugar: string; readonly prioridade: number; readonly g: number }[];
  readonly resolvidos: readonly string[];
  readonly placar: readonly LinhaDoPlacar[];
}

export const LARGURA_DO_MAPA = 1280;
export const ALTURA_DO_MAPA = 720;
const DX = 150;
const DY = 70;
const R = 30;
/** Altura no 3D por minuto de caminho. */
const ALTURA_POR_MINUTO = 1.6;

export function placarDe(mapa: Mapa): LinhaDoPlacar[] {
  const rs = BUSCAS.map((b) => buscarNoMapa(b, mapa));
  const melhor = Math.min(...rs.map((r) => r.custo));
  return rs.map((r) => ({ busca: r.busca, nome: FICHAS_DAS_BUSCAS[r.busca].nome, custo: r.custo, ruas: r.ruas, expandidos: r.expandidos, otimo: r.custo === melhor }));
}

export function filmeDaBusca(busca: Busca = "dijkstra", mapa: Mapa = mapaDaCidade()): Film<DetalheDaBusca> {
  const r: Resultado = buscarNoMapa(busca, mapa);
  const placar = placarDe(mapa);
  const ficha = FICHAS_DAS_BUSCAS[busca];
  const nome = new Map(mapa.grafo.nos.map((n) => [n.id, n.rotulo]));
  const pos = new Map(mapa.grafo.nos.map((n) => [n.id, { x: n.x + DX, y: n.y + DY }]));
  const caixa = (id: string): Box => ({ x: pos.get(id)!.x - R, y: pos.get(id)!.y - R, w: 2 * R, h: 2 * R });
  const via = (a: string, b: string) => {
    const pa = pos.get(a)!;
    const pb = pos.get(b)!;
    const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const [ux, uy] = [(pb.x - pa.x) / d, (pb.y - pa.y) / d];
    return line(pt(pa.x + ux * (R + 4), pa.y + uy * (R + 4)), pt(pb.x - ux * (R + 4), pb.y - uy * (R + 4)));
  };
  const idDaRua = (a: string, b: string) => {
    const rua = ruaEntre(mapa, a, b)!;
    return `rua:${rua.de}-${rua.para}`;
  };

  const f = film<DetalheDaBusca>({ width: LARGURA_DO_MAPA, height: ALTURA_DO_MAPA, gap: 350, maxZoom: 1.6 });

  for (const rua of mapa.ruas) f.add({ type: "link", id: `rua:${rua.de}-${rua.para}`, path: via(rua.de, rua.para), label: `${rua.peso}′`, labelAt: 0.5, tone: rua.transito >= 3 ? "live" : "muted", ...(rua.transito >= 3 ? { dashed: true } : {}) });
  for (const n of mapa.grafo.nos) {
    const icon = n.id === mapa.origem ? ICONES_ALGO.casa : n.id === mapa.destino ? ICONES_ALGO.porto : ICONES_ALGO.lugar;
    f.add({ type: "node", id: `lugar:${n.id}`, box: caixa(n.id), shape: "circle", label: n.rotulo, sublabel: n.id === mapa.origem ? "start" : n.id === mapa.destino ? "goal" : "", tone: n.id === mapa.destino ? "controller" : "processor", icon, height: 8 });
  }
  r.caminho.slice(1).forEach((id, k) => f.add({ type: "link", id: `rota:${k}`, path: via(r.caminho[k]!, id), tone: "live", hidden: true, arrow: true }));
  // Embaixo à direita: no 3D é a borda da frente do chão, onde não há lugar nem rua.
  f.add({ type: "note", id: "nota", at: pt(900, 690), label: "", tone: "ink", width: 640, hidden: true });

  const resolvidos: string[] = [];
  let fronteira: DetalheDaBusca["fronteira"] = [{ lugar: nome.get(mapa.origem)!, prioridade: 0, g: 0 }];
  const detalhe = (evento: string): DetalheDaBusca => ({ busca, evento, fronteira, resolvidos: [...resolvidos], placar });

  f.chapter(
    { id: "map", title: "The city is a graph", body: `${mapa.grafo.nos.length} places are the points; ${mapa.ruas.length} roads are the edges; the minutes on each road are the weights. The red dashed roads are jammed. From ${nome.get(mapa.origem)} to the ${nome.get(mapa.destino)}, which way is fastest?`, detail: detalhe("the map") },
    (d) => {
      d.camera({ at: { cx: LARGURA_DO_MAPA / 2, cy: ALTURA_DO_MAPA / 2, zoom: 1 } });
      d.stagger(
        mapa.grafo.nos.map((n) => `lugar:${n.id}`),
        60,
        (x, id) => x.ping(id),
      );
      d.wait(1500);
    },
  );

  f.chapter(
    { id: "rule", title: `${ficha.nome}: what “best” means`, body: `Every search here is the same loop — take the best place out of the frontier, look at its roads, put the neighbours in. ${ficha.nome} picks by ${ficha.prioridade}. It promises: ${ficha.otimo}.`, detail: detalhe("Home enters the frontier") },
    (d) => {
      d.set(`lugar:${mapa.origem}`, { tone: "high" }).ping(`lugar:${mapa.origem}`);
      d.show("nota").set("nota", { label: `frontier ordered by ${ficha.prioridade}` }).wait(2000);
    },
  );

  f.chapter(
    { id: "search", title: `Searching — ${r.expandidos} places examined`, body: `Lit places are settled: their time will not change. Highlighted ones are in the frontier with the best time known so far. ${r.relaxamentos} roads were looked at.`, detail: detalhe("start") },
    (d) => {
      for (const e of r.eventos) {
        if (e.tipo === "expand") {
          resolvidos.push(nome.get(e.no)!);
          fronteira = e.fronteira.map((i) => ({ lugar: nome.get(i.no)!, prioridade: Math.round(i.prioridade * 10) / 10, g: i.g }));
          d.beat({ title: `Settle ${nome.get(e.no)} at ${e.g} min`, detail: detalhe(`${nome.get(e.no)} leaves the frontier`) });
          d.set(`lugar:${e.no}`, { tone: "conduit", sublabel: `${e.g} min` });
          d.to(`lugar:${e.no}`, { lift: e.g * ALTURA_POR_MINUTO }, { dur: 380, wait: false });
          d.ping(`lugar:${e.no}`);
          d.set("nota", { label: `settled: ${resolvidos.length} · frontier: ${fronteira.length}` }).wait(520);
        } else {
          const rua = idDaRua(e.de, e.para);
          if (e.melhorou) {
            fronteira = [...fronteira.filter((i) => i.lugar !== nome.get(e.para)), { lugar: nome.get(e.para)!, prioridade: Math.round(e.prioridade * 10) / 10, g: e.g }].sort((a, b) => a.prioridade - b.prioridade);
            d.beat({ title: `${nome.get(e.de)} → ${nome.get(e.para)}: ${e.g} min`, detail: detalhe(`a better way to ${nome.get(e.para)}: ${e.g} min`) });
            d.set(`lugar:${e.para}`, { tone: "high", sublabel: `${e.g} min?` });
          }
          // A rua acende enquanto é olhada e apaga em seguida: aceso = "agora".
          d.glow(rua, e.melhorou ? 1 : 0.4, { dur: 120 }).ping(rua, { dur: 300 });
          d.wait(e.melhorou ? 300 : 160);
          d.glow(rua, 0, { dur: 160, wait: false });
        }
      }
      d.wait(600);
    },
  );

  const linha = placar.find((p) => p.busca === busca)!;
  f.chapter(
    {
      id: "route",
      title: r.caminho.length === 0 ? "No way through" : `${r.custo} minutes, ${r.ruas} roads`,
      body:
        r.caminho.length === 0
          ? "The frontier emptied before the goal was reached: the two places are not connected."
          : `${r.caminho.map((id) => nome.get(id)).join(" → ")}. ${linha.otimo ? "That is the fastest route on this map." : `The fastest route takes ${Math.min(...placar.map((p) => p.custo))} minutes — ${ficha.nome} ${busca === "bfs" ? "counted roads, not minutes" : "trusted how close things looked"}.`}`,
      detail: detalhe("the route"),
    },
    (d) => {
      d.camera({ at: { cx: LARGURA_DO_MAPA / 2, cy: ALTURA_DO_MAPA / 2, zoom: 1 } });
      r.caminho.slice(1).forEach((_, k) => d.draw(`rota:${k}`, { dur: 380 }));
      d.set("nota", { label: `${ficha.nome}: ${r.custo} min · ${r.ruas} roads · ${r.expandidos} places examined` }).wait(1800);
    },
  );

  f.chapter(
    { id: "score", title: "The scoreboard: same map, four rules", body: placar.map((p) => `${p.nome}: ${p.custo} min, ${p.ruas} roads, ${p.expandidos} examined${p.otimo ? " (fastest)" : ""}`).join(" · "), detail: detalhe("all four, on the same map") },
    (d) => {
      d.ping(r.caminho.map((id) => `lugar:${id}`));
      d.wait(2600);
    },
  );
  return f.build();
}
