import { FICHAS_REAIS, tempoEmTexto, type Cidade, type ResultadoReal, type RotaComParadas } from "@ovh/algo-domain";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { desenharBase, paraTela, tracar, type Visao } from "../lib/mapa-desenho";
import { som, tomDe } from "../lib/som";
import { css, type Paleta } from "../lib/tinta";
import { Boneco } from "./Bonecos";
import { ProgressoVivo, tomDaPista } from "./CorridaKit";

/** Uma rota com paradas vista como um resultado de busca só (a fita das pernas em sequência). */
export function comoResultado(r: RotaComParadas): ResultadoReal {
  let examinadas = 0;
  for (const p of r.passos) if (p.passo.t === "scan") examinadas += 1;
  return {
    busca: r.busca,
    origem: r.ordem[0]!,
    destino: r.ordem.at(-1)!,
    rota: [],
    arestas: r.arestas,
    tempo: r.tempo,
    metros: r.metros,
    resolvidos: r.resolvidos,
    examinadas,
    passos: r.passos.map((p) => p.passo),
  };
}

export interface Parada {
  readonly id: number;
  readonly no: number;
  readonly tom: string;
  /** A ordem de visita (1 = de onde se sai). */
  readonly numero: number;
  readonly rotulo: string;
}

/** O som do mapa compartilhado: cada busca toca a distância já percorrida, do seu lado do estéreo. */
function useSomDoMapa(rs: readonly ResultadoReal[], passo: number) {
  const antes = useRef<number[]>([]);
  // O tom é a distância do cruzamento sobre a maior distância daquela busca (por perna, numa rota com paradas).
  const maior = useMemo(() => rs.map((r) => Math.max(1, ...r.passos.map((q) => (q.t === "settle" ? q.d : 0)))), [rs]);
  useEffect(() => {
    rs.forEach((r, i) => {
      const k0 = antes.current[i] ?? 0;
      const k1 = Math.min(passo, r.passos.length);
      if (k1 <= k0) return;
      const pan = rs.length === 1 ? 0 : -0.8 + (1.6 * i) / (rs.length - 1);
      for (let j = k1 - 1; j >= k0; j -= 1) {
        const q = r.passos[j]!;
        if (q.t === "settle") {
          som.nota(tomDe(q.d / maior[i]!), { pista: `unico${i}`, pan, onda: "triangle", ganho: 0.06, dur: 0.06 });
          break;
        }
      }
      if (k1 >= r.passos.length && k0 < r.passos.length) som.chegada(392 * 2 ** (i / 12), pan);
    });
    antes.current = rs.map((r) => Math.min(passo, r.passos.length));
  }, [passo, rs, maior]);
}

interface PropsDoMapa {
  readonly cidade: Cidade;
  readonly paleta: Paleta;
  readonly rs: readonly ResultadoReal[];
  readonly passo: number;
  readonly paradas: readonly Parada[];
  readonly onSoltar: (id: number, xMapa: number, yMapa: number) => void;
  readonly onMover: (id: number, dx: number, dy: number) => void;
}

/**
 * Um mapa só, com todas as buscas pintando ao mesmo tempo, cada uma na cor da
 * sua pista. Onde duas exploraram, as cores se sobrepõem; no fim, as rotas
 * aparecem como faixas concêntricas (a primeira busca por baixo, mais larga),
 * para todas ficarem visíveis mesmo quando passam pela mesma rua.
 */
export const MapaCompartilhado = memo(function MapaCompartilhado({ cidade: c, paleta: p, rs, passo, paradas, onSoltar, onMover }: PropsDoMapa) {
  const caixa = useRef<HTMLDivElement>(null);
  const telaBase = useRef<HTMLCanvasElement>(null);
  const telaPintura = useRef<HTMLCanvasElement>(null);
  const telaTopo = useRef<HTMLCanvasElement>(null);
  const [largura, setLargura] = useState(0);
  const feito = useRef<number[]>([]);
  const chave = useRef("");
  const fonte = useRef("monospace");
  const [rotaVista, setRotaVista] = useState(0);
  useSomDoMapa(rs, passo);

  useEffect(() => {
    const el = caixa.current;
    if (el === null) return;
    fonte.current = getComputedStyle(el).getPropertyValue("--font-mono").trim() || "monospace";
    const ro = new ResizeObserver(([e]) => setLargura(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const v: Visao | null = largura === 0 ? null : { escala: largura / c.largura, w: largura, h: Math.round((largura * c.altura) / c.largura) };
  const tamanho = (cv: HTMLCanvasElement | null) => {
    if (cv === null || v === null) return false;
    const w = Math.round(v.w * dpr);
    const h = Math.round(v.h * dpr);
    if (cv.width === w && cv.height === h) return false;
    cv.width = w;
    cv.height = h;
    return true;
  };

  useEffect(() => {
    const cv = telaBase.current;
    if (cv === null || v === null) return;
    tamanho(cv);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(desenharBase(c, v, p, dpr, fonte.current), 0, 0);
    chave.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura, p, c]);

  const total = Math.max(0, ...rs.map((r) => r.passos.length));
  const todosTerminaram = passo >= total && total > 0;
  useEffect(() => {
    if (!todosTerminaram) {
      setRotaVista(0);
      return;
    }
    let id = 0;
    const t0 = performance.now();
    const quadro = (agora: number) => {
      const f = Math.min(1, (agora - t0) / 1000);
      setRotaVista(f);
      if (f < 1) id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  }, [todosTerminaram, rs]);

  useEffect(() => {
    const pt = telaPintura.current;
    const topo = telaTopo.current;
    if (pt === null || topo === null || v === null) return;
    const largo = Math.max(1.3, v.escala * 8);
    const cores = rs.map((_, i) => p.especies[i % 5]!);

    // ------------------------------------------------ pintura: incremental, por busca
    const mudou = tamanho(pt);
    const k = `${largura}|${p.fundo.join()}|${rs.map((r) => `${r.busca}:${r.passos.length}:${r.origem}:${r.destino}`).join(";")}`;
    const pc = pt.getContext("2d")!;
    const voltou = rs.some((r, i) => Math.min(passo, r.passos.length) < (feito.current[i] ?? 0));
    if (mudou || chave.current !== k || voltou) {
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.clearRect(0, 0, pt.width, pt.height);
      chave.current = k;
      feito.current = rs.map(() => 0);
    }
    pc.setTransform(dpr, 0, 0, dpr, 0, 0);
    pc.lineCap = "round";
    rs.forEach((r, i) => {
      const ate = Math.min(passo, r.passos.length);
      for (let j = feito.current[i] ?? 0; j < ate; j += 1) {
        const q = r.passos[j]!;
        if (q.t !== "scan") continue;
        pc.beginPath();
        tracar(pc, c, v, q.aresta);
        pc.strokeStyle = css(cores[i]!, q.melhorou ? 0.72 : 0.28);
        pc.lineWidth = q.melhorou ? largo : largo * 0.55;
        pc.stroke();
      }
      feito.current[i] = ate;
    });

    // ------------------------------------------------ sobreposição
    tamanho(topo);
    const ctx = topo.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, topo.width, topo.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    rs.forEach((r, i) => {
      const ate = Math.min(passo, r.passos.length);
      if (ate >= r.passos.length) return;
      // Rastro curto na cor da busca, e o cruzamento de agora pulsando.
      ctx.globalCompositeOperation = "lighter";
      let vistos = 0;
      for (let j = ate - 1; j >= 0 && vistos < 14; j -= 1) {
        const q = r.passos[j]!;
        if (q.t !== "scan") continue;
        vistos += 1;
        ctx.beginPath();
        tracar(ctx, c, v, q.aresta);
        ctx.strokeStyle = css(cores[i]!, 0.6 * (1 - vistos / 15));
        ctx.lineWidth = largo * 2.4;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      for (let j = ate - 1; j >= 0; j -= 1) {
        const q = r.passos[j]!;
        if (q.t !== "settle") continue;
        const [x, y] = paraTela(c, v, c.x[q.no]!, c.y[q.no]!);
        const pulso = 4 + 2.5 * Math.sin(performance.now() / 80 + i);
        ctx.beginPath();
        ctx.arc(x, y, pulso + 3, 0, Math.PI * 2);
        ctx.fillStyle = css(cores[i]!, 0.3);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = css(p.claro);
        ctx.fill();
        break;
      }
    });
    // As rotas de quem terminou: faixas concêntricas — a primeira busca por baixo e mais
    // larga, cada uma inteira na sua cor, com um vão escuro fino entre uma e a seguinte.
    const n = rs.length;
    const larg = (i: number) => Math.max(3, largo * (1.6 + 2.4 * (n - 1 - i)));
    rs.forEach((r, i) => {
      if (Math.min(passo, r.passos.length) < r.passos.length || r.arestas.length === 0) return;
      const fr = todosTerminaram ? rotaVista : 1;
      const ate = Math.ceil(r.arestas.length * fr);
      ctx.beginPath();
      for (let j = 0; j < ate; j += 1) tracar(ctx, c, v, r.arestas[j]!);
      if (i === 0) {
        ctx.strokeStyle = css(p.fundo, 0.9);
        ctx.lineWidth = larg(0) + 3;
        ctx.stroke();
      }
      ctx.strokeStyle = css(cores[i]!, 1);
      ctx.lineWidth = larg(i);
      ctx.stroke();
      // O vão só onde a próxima rota passa pela mesma rua: onde ela não passa, esta fica inteira.
      const proxima = rs[i + 1];
      if (proxima !== undefined && Math.min(passo, proxima.passos.length) >= proxima.passos.length) {
        const dela = new Set(proxima.arestas);
        ctx.beginPath();
        for (let j = 0; j < ate; j += 1) if (dela.has(r.arestas[j]!)) tracar(ctx, c, v, r.arestas[j]!);
        ctx.strokeStyle = css(p.fundo, 0.95);
        ctx.lineWidth = larg(i + 1) + 2;
        ctx.stroke();
      }
    });
  });

  const soltar = (id: number, x: number, y: number) => {
    if (v === null) return;
    onSoltar(id, x / v.escala - c.largura / 2, y / v.escala - c.altura / 2);
  };
  const alto = v?.h ?? 0;
  const otimo = Math.min(...rs.map((r) => r.tempo));
  return (
    <div className="mapa-unico">
      <div ref={caixa} className="mapa-pista" style={{ height: alto }}>
        <canvas ref={telaBase} className="mapa-tela" style={{ height: alto }} aria-hidden="true" />
        <canvas ref={telaPintura} className="mapa-tela" style={{ height: alto }} aria-hidden="true" />
        <canvas
          ref={telaTopo}
          className="mapa-tela"
          style={{ height: alto }}
          role="img"
          aria-label={`São Paulo street map. ${rs.map((r) => FICHAS_REAIS[r.busca].nome).join(", ")} ${todosTerminaram ? "have finished" : "are searching"}. Drag the figures to move the stops.`}
        />
        {v === null ? null : (
          <svg className="bonecos" viewBox={`0 0 ${v.w} ${v.h}`} width={v.w} height={alto} aria-label="Stops">
            {paradas.map((pa) => {
              const [x, y] = paraTela(c, v, c.x[pa.no]!, c.y[pa.no]!);
              return <Boneco key={pa.id} id={pa.id} x={x} y={y} tom={pa.tom} numero={pa.numero} rotulo={pa.rotulo} largura={v.w} altura={v.h} onSoltar={soltar} onMover={onMover} />;
            })}
          </svg>
        )}
      </div>
      <ul className="mapa-legenda">
        {rs.map((r, i) => {
          const fim = passo >= r.passos.length;
          let resolvidos = 0;
          const ate = Math.min(passo, r.passos.length);
          for (let j = 0; j < ate; j += 1) if (r.passos[j]!.t === "settle") resolvidos += 1;
          return (
            <li key={`${r.busca}-${i}`} data-tone={tomDaPista(i)} data-fim={fim ? "" : undefined}>
              <span className="algo-chip" aria-hidden="true" />
              <b>{FICHAS_REAIS[r.busca].nome}</b>
              <ProgressoVivo fracao={r.passos.length === 0 ? 1 : ate / r.passos.length} fim={fim} rotulo={`${FICHAS_REAIS[r.busca].nome} progress`} />
              <span className="mono">
                <span translate="no">{resolvidos}</span> settled
              </span>
              <span className="mono" data-ruim={fim && r.tempo > otimo + 1e-6 ? "" : undefined}>
                {fim ? (r.tempo <= otimo + 1e-6 ? `${tempoEmTexto(r.tempo)} ✓` : `${tempoEmTexto(r.tempo)} (+${tempoEmTexto(r.tempo - otimo)})`) : "…"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
