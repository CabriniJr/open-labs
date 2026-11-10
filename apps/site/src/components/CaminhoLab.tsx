import {
  buscarNaCidade,
  BUSCAS_REAIS,
  carregarSaoPaulo,
  CENARIOS,
  MAIS_PARADAS,
  melhorOrdem,
  rodarCenario,
  rotaComParadas,
  type Cenario,
  type ResultadoDoCenario,
  CLASSES_DE_BUSCA,
  FICHAS_REAIS,
  maisPerto,
  tempoEmTexto,
  trabalhoPorDistancia,
  type BuscaReal,
  type Cidade,
  type ClasseDeBusca,
  type ResultadoReal,
} from "@ovh/algo-domain";
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { som, tomDe } from "../lib/som";
import { css, misturar, rampa, usePaleta, type Paleta, type Rgb } from "../lib/tinta";
import { desenharBase, fonteDe, paraTela, rotular, tempos, tracar, type Visao } from "../lib/mapa-desenho";
import { BotaoSom, GraficoVivo, Narrador, ProgressoVivo, Pseudocodigo, tomDaPista, useRelogio, type CapituloDoShowcase, type Serie } from "./CorridaKit";
import { comoResultado, MapaCompartilhado, type Parada } from "./MapaCompartilhado";
import { ModosDoLab } from "./ModosDoLab";

/** O mapa de São Paulo, carregado só quando o lab abre (260 KB, ~100 KB comprimido). */
function useCidade(): Cidade | null {
  const [c, setC] = useState<Cidade | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarSaoPaulo().then((cidade) => {
      if (vivo) setC(cidade);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return c;
}

interface PropsDaPista {
  readonly cidade: Cidade;
  readonly paleta: Paleta;
  readonly r: ResultadoReal;
  readonly k: number;
  readonly rotulo: string;
  readonly destaque: readonly number[];
  readonly onClique?: ((x: number, y: number) => void) | undefined;
}

/**
 * Uma pista: o mapa com a busca pintada até o passo `k`, em três canvas
 * empilhados — a BASE (as ruas, refeita só com o tamanho ou o tema), a PINTURA
 * (incremental: só os passos novos; voltar no tempo limpa e repinta) e a
 * SOBREPOSIÇÃO (o rastro, o pulso, a rota e as pontas, limpa a cada quadro).
 * Nenhuma cópia de tela cheia acontece por quadro.
 */
const PistaDoMapa = memo(function PistaDoMapa({ cidade: c, paleta: p, r, k, rotulo, destaque, onClique }: PropsDaPista) {
  const caixa = useRef<HTMLDivElement>(null);
  const telaBase = useRef<HTMLCanvasElement>(null);
  const telaPintura = useRef<HTMLCanvasElement>(null);
  const telaTopo = useRef<HTMLCanvasElement>(null);
  const [largura, setLargura] = useState(0);
  const feito = useRef(0);
  const chaveDaPintura = useRef("");
  const t = useMemo(() => tempos(r, c.n), [r, c.n]);
  const [rotaVista, setRotaVista] = useState(0);
  // O canvas não entende var(): a família da fonte mono do tema, lida uma vez.
  const fonte = useRef("monospace");
  useEffect(() => {
    if (caixa.current !== null) fonte.current = getComputedStyle(caixa.current).getPropertyValue("--font-mono").trim() || "monospace";
  }, []);

  useEffect(() => {
    const el = caixa.current;
    if (el === null) return;
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

  // A base muda só com o tamanho e o tema.
  useEffect(() => {
    const cv = telaBase.current;
    if (cv === null || v === null) return;
    tamanho(cv);
    const pronta = desenharBase(c, v, p, dpr, fonte.current);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(pronta, 0, 0);
    chaveDaPintura.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura, p, c]);

  // A rota aparece animada quando a busca termina.
  const terminou = k >= r.passos.length;
  useEffect(() => {
    if (!terminou) {
      setRotaVista(0);
      return;
    }
    let id = 0;
    const t0 = performance.now();
    const passo = (agora: number) => {
      const f = Math.min(1, (agora - t0) / 900);
      setRotaVista(f);
      if (f < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [terminou, r]);

  useEffect(() => {
    const pt = telaPintura.current;
    const topo = telaTopo.current;
    if (pt === null || topo === null || v === null) return;
    const largo = Math.max(1.4, v.escala * 9);

    // ------------------------------------------------ a pintura, incremental
    const mudou = tamanho(pt);
    const chave = `${largura}|${p.fundo.join()}|${r.busca}|${r.origem}|${r.destino}|${r.passos.length}`;
    const pc = pt.getContext("2d")!;
    if (mudou || chaveDaPintura.current !== chave || k < feito.current) {
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.clearRect(0, 0, pt.width, pt.height);
      chaveDaPintura.current = chave;
      feito.current = 0;
    }
    pc.setTransform(dpr, 0, 0, dpr, 0, 0);
    pc.lineCap = "round";
    for (let i = feito.current; i < k && i < r.passos.length; i += 1) {
      const q = r.passos[i]!;
      if (q.t !== "scan") continue;
      const origemDaRua = q.lado === 0 ? c.de[q.aresta]! : c.para[q.aresta]!;
      const f = Math.max(0, t.d[origemDaRua]!) / t.max;
      const cor: Rgb = q.lado === 0 ? rampa(p, f) : misturar(p.especies[4]!, p.especies[3]!, f);
      pc.beginPath();
      tracar(pc, c, v, q.aresta);
      pc.strokeStyle = css(cor, q.melhorou ? 0.92 : 0.38);
      pc.lineWidth = q.melhorou ? largo : largo * 0.6;
      pc.stroke();
    }
    feito.current = Math.min(k, r.passos.length);

    // ------------------------------------------------ a sobreposição, limpa a cada quadro
    tamanho(topo);
    const ctx = topo.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, topo.width, topo.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (!terminou) {
      // O rastro: as últimas ruas olhadas brilham, somando luz.
      ctx.globalCompositeOperation = "lighter";
      let vistos = 0;
      for (let i = Math.min(k, r.passos.length) - 1; i >= 0 && vistos < 28; i -= 1) {
        const q = r.passos[i]!;
        if (q.t !== "scan") continue;
        vistos += 1;
        ctx.beginPath();
        tracar(ctx, c, v, q.aresta);
        ctx.strokeStyle = css(p.claro, 0.5 * (1 - vistos / 30));
        ctx.lineWidth = largo * 2.2;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      // O cruzamento sendo resolvido agora: um disco que pulsa.
      for (let i = Math.min(k, r.passos.length) - 1; i >= 0; i -= 1) {
        const q = r.passos[i]!;
        if (q.t !== "settle") continue;
        const [x, y] = paraTela(c, v, c.x[q.no]!, c.y[q.no]!);
        const pulso = 4 + 3 * Math.sin(performance.now() / 90);
        ctx.beginPath();
        ctx.arc(x, y, pulso + 3, 0, Math.PI * 2);
        ctx.fillStyle = css(p.claro, 0.25);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = css(p.claro, 0.95);
        ctx.fill();
        break;
      }
    }

    // A rota: halo largo e traço vivo, desenhada da origem ao destino.
    if (terminou && r.arestas.length > 0 && rotaVista > 0) {
      const ate = Math.ceil(r.arestas.length * rotaVista);
      for (const [cor, w] of [
        [css(p.viva, 0.28), largo * 5.5],
        [css(p.claro, 0.95), largo * 3],
        [css(p.viva, 1), largo * 1.9],
      ] as const) {
        ctx.beginPath();
        for (let i = 0; i < ate; i += 1) tracar(ctx, c, v, r.arestas[i]!);
        ctx.strokeStyle = cor;
        ctx.lineWidth = w;
        ctx.stroke();
      }
    }

    // Os pontos de interesse destacados (os comuns já estão na base) e as duas pontas.
    ctx.font = fonteDe(v, fonte.current);
    ctx.textBaseline = "middle";
    for (const poi of c.pois) {
      if (!(destaque.includes(poi.no) || poi.no === r.origem || poi.no === r.destino)) continue;
      const [x, y] = paraTela(c, v, poi.x, poi.y);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = css(p.alto);
      ctx.fill();
      rotular(ctx, v, p, poi.nome, x, y, true);
    }
    for (const [no, cor] of [
      [r.origem, p.ok],
      [r.destino, p.viva],
    ] as const) {
      const [x, y] = paraTela(c, v, c.x[no]!, c.y[no]!);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = css(cor, 0.3);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = css(cor);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = css(p.claro);
      ctx.stroke();
    }
  });

  const clicar = (e: PointerEvent<HTMLCanvasElement>) => {
    if (onClique === undefined || v === null) return;
    const rc = e.currentTarget.getBoundingClientRect();
    onClique(((e.clientX - rc.left) / rc.width) * c.largura - c.largura / 2, ((e.clientY - rc.top) / rc.height) * c.altura - c.altura / 2);
  };

  const alto = v?.h ?? 0;
  return (
    <div ref={caixa} className="mapa-pista" style={{ height: alto }}>
      <canvas ref={telaBase} className="mapa-tela" style={{ height: alto }} aria-hidden="true" />
      <canvas ref={telaPintura} className="mapa-tela" style={{ height: alto }} aria-hidden="true" />
      <canvas ref={telaTopo} className="mapa-tela" style={{ height: alto }} role="img" aria-label={rotulo} onPointerDown={clicar} data-clicavel={onClique === undefined ? undefined : ""} />
    </div>
  );
});

interface EstadoDaPista {
  readonly r: ResultadoReal;
  readonly resolvidos: number;
  readonly examinadas: number;
  readonly linha: number | undefined;
}

function estadoEm(r: ResultadoReal, k: number): EstadoDaPista {
  let resolvidos = 0;
  let examinadas = 0;
  const ate = Math.min(k, r.passos.length);
  for (let i = 0; i < ate; i += 1) {
    if (r.passos[i]!.t === "settle") resolvidos += 1;
    else examinadas += 1;
  }
  return { r, resolvidos, examinadas, linha: ate === 0 ? 4 : r.passos[ate - 1]!.linha };
}

/** O lugar de cada busca: quem termina primeiro (menos passos) ganha; a rota mais lenta não muda o lugar, muda o veredito. */
function lugares(rs: readonly ResultadoReal[]): Map<BuscaReal, number> {
  const ord = [...rs].sort((a, b) => a.passos.length - b.passos.length);
  return new Map(ord.map((r, k) => [r.busca, k + 1]));
}

/** As pistas lado a lado, com o som e as barras. Usado pelo showcase e pela simulação. */
function Corrida({ cidade, paleta, rs, passo, onClique, destaque }: { cidade: Cidade; paleta: Paleta; rs: readonly ResultadoReal[]; passo: number; onClique?: (x: number, y: number) => void; destaque: readonly number[] }) {
  const lug = useMemo(() => lugares(rs), [rs]);
  const otimo = Math.min(...rs.map((r) => r.tempo));
  const antes = useRef<number[]>([]);
  // O som: a nota do último cruzamento resolvido de cada pista, no tom da distância já percorrida.
  useEffect(() => {
    rs.forEach((r, i) => {
      const k0 = antes.current[i] ?? 0;
      const k1 = Math.min(passo, r.passos.length);
      if (k1 <= k0) return;
      const pan = rs.length === 1 ? 0 : -0.8 + (1.6 * i) / (rs.length - 1);
      for (let j = k1 - 1; j >= k0; j -= 1) {
        const q = r.passos[j]!;
        if (q.t === "settle") {
          som.nota(tomDe(q.d / Math.max(1, r.tempo)), { pista: `mapa${i}`, pan, onda: "triangle", ganho: 0.07, dur: 0.06 });
          break;
        }
      }
      if (k1 >= r.passos.length && k0 < r.passos.length) som.chegada(392 * 2 ** ((lug.get(r.busca)! === 1 ? 4 : 0) / 12), pan);
    });
    antes.current = rs.map((r) => Math.min(passo, r.passos.length));
  }, [passo, rs, lug]);

  return (
    <div className="mapa-pistas" data-n={rs.length}>
      {rs.map((r, i) => {
        const e = estadoEm(r, passo);
        const fim = passo >= r.passos.length;
        const f = FICHAS_REAIS[r.busca];
        return (
          <section key={`${r.busca}-${i}`} className="mapa-cartao" data-tone={tomDaPista(i)} data-fim={fim ? "" : undefined} aria-label={`${f.nome} lane`}>
            <header>
              <b>{f.nome}</b>
              <small className="mono">{CLASSES_DE_BUSCA[f.classe].nome.split(":")[0]}</small>
            </header>
            <PistaDoMapa cidade={cidade} paleta={paleta} r={r} k={passo} rotulo={fim ? `${f.nome}: finished, route ${tempoEmTexto(r.tempo)}, ${r.resolvidos} intersections settled` : `${f.nome}: searching the map`} destaque={destaque} onClique={onClique} />
            <ProgressoVivo fracao={r.passos.length === 0 ? 1 : Math.min(passo, r.passos.length) / r.passos.length} fim={fim} lugar={lug.get(r.busca)} rotulo={`${f.nome} progress`} />
            <dl className="mapa-numeros mono">
              <div>
                <dt>settled</dt>
                <dd translate="no">{e.resolvidos}</dd>
              </div>
              <div>
                <dt>roads looked at</dt>
                <dd translate="no">{e.examinadas}</dd>
              </div>
              <div>
                <dt>route</dt>
                <dd translate="no">{fim ? `${tempoEmTexto(r.tempo)} · ${(r.metros / 1000).toFixed(2)} km` : "…"}</dd>
              </div>
              <div>
                <dt>vs. fastest</dt>
                <dd data-ruim={fim && r.tempo > otimo + 1e-6 ? "" : undefined}>{fim ? (r.tempo <= otimo + 1e-6 ? "fastest ✓" : `+${tempoEmTexto(r.tempo - otimo)}`) : "…"}</dd>
              </div>
            </dl>
          </section>
        );
      })}
    </div>
  );
}

const ritmoPara = (rs: readonly ResultadoReal[], segundos: number) => Math.max(1, Math.ceil(Math.max(1, ...rs.map((r) => r.passos.length)) / (segundos * 60)));

// ---------------------------------------------------------------------------------------- showcase

interface CapituloDoMapa extends CapituloDoShowcase {
  readonly de: string;
  readonly para: string;
  readonly buscas: readonly BuscaReal[];
}

const CAPITULOS: readonly CapituloDoMapa[] = [
  {
    id: "wave",
    titulo: "Dijkstra: a wave of equal time",
    texto: "From MASP on Avenida Paulista to the Mercadão. Dijkstra settles every intersection in order of travel time, so the paint spreads like a ripple: blue is close, red is far. It cannot know where the Mercadão is — it only stops when the wave reaches it.",
    olhe: ["The colour is the time it took to get there.", "The pitch rises with the distance already travelled.", "Count the intersections it had to settle."],
    de: "masp",
    para: "mercadao",
    buscas: ["dijkstra"],
  },
  {
    id: "aimed",
    titulo: "A*: the same answer, aimed",
    texto: "Hospital Sírio-Libanês to Estação da Luz. A* adds a guess — the straight line at the top speed of any street — so it prefers intersections that are also getting closer. Same route, to the decisecond, after a fraction of the work.",
    olhe: ["Both routes are identical.", "A* paints a corridor; Dijkstra paints a disc.", "Compare the settled counts when both finish."],
    de: "hospital-sirio-libanes",
    para: "estacao-da-luz",
    buscas: ["dijkstra", "astar"],
  },
  {
    id: "meet",
    titulo: "Two waves that meet in the middle",
    texto: "Bixiga to the Mosteiro de São Bento. Bidirectional Dijkstra grows one wave from each end — the second one on the map with every one-way street reversed — and stops when the two can no longer beat the best meeting point. Two small discs cost less than one big one.",
    olhe: ["Warm paint is the wave from the start; cool paint, from the goal.", "All three exact searches agree on the time.", "Here the two-ended search beats even A*."],
    de: "bixiga",
    para: "mosteiro-de-sao-bento",
    buscas: ["dijkstra", "astar", "bidirectional"],
  },
  {
    id: "greedy",
    titulo: "Greedy: fast, confident and wrong",
    texto: "Back to Sírio-Libanês → Luz. Greedy best-first only asks “which intersection looks closest to the goal?” and never counts the minutes already spent. It finishes first, by far — with a route almost twice as slow.",
    olhe: ["Greedy settles a few dozen intersections.", "Its route detours where the straight line lied.", "The scoreboard marks the minutes it lost."],
    de: "hospital-sirio-libanes",
    para: "estacao-da-luz",
    buscas: ["astar", "greedy"],
  },
  {
    id: "hurry",
    titulo: "A* in a hurry",
    texto: "Copan to Liberdade. Weighted A* doubles the guess: it trusts the straight line twice as much as the clock. It looks at about half as much of the city and promises a route at most twice the best — here it is two metres longer and the same to the second.",
    olhe: ["Two members of the same family, one with a bolder guess.", "Fewer settled intersections, nearly the same route."],
    de: "copan",
    para: "liberdade",
    buscas: ["astar", "weighted"],
  },
  {
    id: "corners",
    titulo: "Counting corners is not counting minutes",
    texto: "Mackenzie to the Catedral da Sé. Breadth-first search finds the route with the fewest intersections — and ignores that some streets are slower than others. Fewer corners, more minutes.",
    olhe: ["BFS paints in rings of corners, not of time.", "Its route has fewer intersections and takes longer."],
    de: "mackenzie",
    para: "catedral-da-se",
    buscas: ["bfs", "dijkstra"],
  },
];

function Vitrine({ cidade, paleta }: { cidade: Cidade; paleta: Paleta }) {
  const [cap, setCap] = useState(0);
  const [auto, setAuto] = useState(true);
  const c = CAPITULOS[cap]!;
  const poi = (id: string) => cidade.pois.find((p) => p.id === id)!.no;
  const rs = useMemo(() => c.buscas.map((b) => buscarNaCidade(cidade, b, poi(c.de), poi(c.para))), [cap, cidade]);
  const total = Math.max(...rs.map((r) => r.passos.length));
  const prox = useRef<number | null>(null);
  const relogio = useRelogio(total, ritmoPara(rs, 9), () => {
    if (!auto) return;
    prox.current = window.setTimeout(() => setCap((k) => (k + 1) % CAPITULOS.length), 3200);
  });
  const [comecou, setComecou] = useState(false);
  useEffect(() => {
    relogio.ir(0);
    relogio.setRitmo(ritmoPara(rs, 9));
    if (comecou) relogio.tocar();
    return () => {
      if (prox.current !== null) clearTimeout(prox.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap]);
  const lider = rs.length > 0 ? FICHAS_REAIS[rs[0]!.busca] : undefined;
  return (
    <div className="algo mapa" data-testid="path-showcase">
      <Narrador
        capitulos={CAPITULOS}
        atual={cap}
        irPara={(k) => {
          setComecou(true);
          setCap(k);
        }}
        rodape={
          lider === undefined ? null : (
            <Pseudocodigo linhas={FICHAS_REAIS[rs.at(-1)!.busca].pseudo} ativa={estadoEm(rs.at(-1)!, relogio.passo).linha} titulo={`${FICHAS_REAIS[rs.at(-1)!.busca].nome}, line by line`} />
          )
        }
      >
        <div className="algo-transporte">
          <button
            type="button"
            className="algo-btn algo-btn--grande"
            onClick={() => {
              setComecou(true);
              relogio.tocando ? relogio.pausar() : relogio.tocar();
            }}
          >
            {relogio.tocando ? "Pause" : comecou ? "Play" : "▶ Play the showcase"}
          </button>
          <BotaoSom />
          <label className="ctxlab-switch" htmlFor="mapa-auto">
            <input id="mapa-auto" type="checkbox" role="switch" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            <span className="ctxlab-switch__track" aria-hidden="true">
              <span />
            </span>
            <span>Next chapter by itself</span>
          </label>
          <output className="mono">
            {cidade.pois.find((p) => p.no === rs[0]?.origem)?.nome} → {cidade.pois.find((p) => p.no === rs[0]?.destino)?.nome}
          </output>
        </div>
        <Corrida cidade={cidade} paleta={paleta} rs={rs} passo={relogio.passo} destaque={[poi(c.de), poi(c.para)]} />
      </Narrador>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- simulação

const MAIS_PISTAS = 4;
/** A cor de cada boneco: tons que não são os das pistas, para parada e busca nunca se confundirem. */
const TONS_DAS_PARADAS = ["live", "high", "conduit", "processor"] as const;

interface ParadaEscolhida {
  readonly id: number;
  readonly no: number;
}

/** O nome de um cruzamento: o ponto de interesse dele, ou o mais perto ("perto do Copan"). */
function nomeDoCruzamento(c: Cidade, no: number): string {
  const exato = c.pois.find((p) => p.no === no);
  if (exato !== undefined) return exato.nome;
  let melhor = c.pois[0]!;
  let d = Number.POSITIVE_INFINITY;
  for (const p of c.pois) {
    const dd = Math.hypot(p.x - c.x[no]!, p.y - c.y[no]!);
    if (dd < d) {
      d = dd;
      melhor = p;
    }
  }
  return `${Math.round(d / 10) * 10} m from ${melhor.nome}`;
}

/** Quem vence onde: todas as buscas em todos os cenários, calculado aos poucos depois de pintar. */
function QuemVenceOnde({ cidade, aoEscolher }: { cidade: Cidade; aoEscolher: (c: Cenario) => void }) {
  const [linhas, setLinhas] = useState<ResultadoDoCenario[]>([]);
  useEffect(() => {
    let vivo = true;
    let k = 0;
    const saida: ResultadoDoCenario[] = [];
    const proximo = () => {
      if (!vivo || k >= CENARIOS.length) return;
      saida.push(rodarCenario(cidade, CENARIOS[k]!));
      k += 1;
      setLinhas([...saida]);
      window.setTimeout(proximo, 30);
    };
    const id = window.setTimeout(proximo, 600);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [cidade]);
  return (
    <div className="algo-tabela">
      <table>
        <caption>Who wins where: every search on every scenario — intersections settled, and minutes lost against the fastest route. ★ least work among the exact searches; ⚡ finished first overall.</caption>
        <thead>
          <tr>
            <th scope="col">Scenario</th>
            {BUSCAS_REAIS.map((b) => (
              <th key={b} scope="col" className="num">
                {FICHAS_REAIS[b].curto}
              </th>
            ))}
            <th scope="col">
              <span className="sr-only">Load</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((r) => (
            <tr key={r.cenario.id}>
              <th scope="row">
                {r.cenario.nome}
                <br />
                <small>{r.cenario.paradas.length} stops</small>
              </th>
              {r.linhas.map((l) => (
                <td key={l.busca} className="num" data-melhor={l.busca === r.melhorExata ? "" : undefined}>
                  <span translate="no">{l.resolvidos}</span>
                  {l.busca === r.melhorExata ? " ★" : ""}
                  {l.busca === r.maisRapida ? " ⚡" : ""}
                  <br />
                  <small data-ruim={l.excesso > 1e-6 ? "" : undefined}>{l.excesso <= 1e-6 ? "fastest" : l.excesso < 10 ? "+<1 s" : `+${tempoEmTexto(l.excesso)}`}</small>
                </td>
              ))}
              <td>
                <button type="button" className="algo-btn" onClick={() => aoEscolher(r.cenario)}>
                  Race it
                </button>
              </td>
            </tr>
          ))}
          {linhas.length < CENARIOS.length ? (
            <tr>
              <td colSpan={BUSCAS_REAIS.length + 2} className="algo-nota">
                Racing every search on {CENARIOS.length} scenarios… {linhas.length}/{CENARIOS.length}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Simulacao({ cidade, paleta }: { cidade: Cidade; paleta: Paleta }) {
  const poi = (id: string) => cidade.pois.find((p) => p.id === id)!.no;
  const proximoId = useRef(3);
  const [paradas, setParadas] = useState<readonly ParadaEscolhida[]>(() => [
    { id: 1, no: poi("masp") },
    { id: 2, no: poi("mercadao") },
  ]);
  const [fixarFim, setFixarFim] = useState(false);
  const [modo, setModo] = useState<"unico" | "lado">("unico");
  const [buscas, setBuscas] = useState<readonly BuscaReal[]>(CLASSES_DE_BUSCA.exact.buscas);
  const [focada, setFocada] = useState(0);

  const nos = paradas.map((p) => p.no);
  const ordem = useMemo(() => (nos.length >= 2 ? melhorOrdem(cidade, nos, fixarFim).ordem : nos), [nos.join(","), fixarFim, cidade]);
  const rs = useMemo(() => buscas.map((b) => comoResultado(rotaComParadas(cidade, b, ordem))), [buscas, ordem.join(","), cidade]);
  const total = Math.max(1, ...rs.map((r) => r.passos.length));
  const relogio = useRelogio(total, ritmoPara(rs, 10));
  useEffect(() => {
    relogio.ir(0);
    relogio.setRitmo(ritmoPara(rs, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rs]);

  const visitaDe = (no: number) => ordem.indexOf(no) + 1;
  const paradasNoMapa: Parada[] = paradas.map((p, k) => ({
    id: p.id,
    no: p.no,
    tom: TONS_DAS_PARADAS[k % TONS_DAS_PARADAS.length]!,
    numero: visitaDe(p.no),
    rotulo: `Stop ${visitaDe(p.no)}: ${nomeDoCruzamento(cidade, p.no)}. Drag it, or use the arrow keys to move it.`,
  }));
  const moverPara = (id: number, no: number) => setParadas((ps) => ps.map((p) => (p.id === id ? { ...p, no } : p)));
  const soltar = (id: number, x: number, y: number) => moverPara(id, maisPerto(cidade, x, y));
  // Setas: um passo de 150 m na direção, e de volta para o cruzamento mais perto.
  const mover = (id: number, dx: number, dy: number) => {
    const p = paradas.find((q) => q.id === id);
    if (p === undefined) return;
    moverPara(id, maisPerto(cidade, cidade.x[p.no]! + dx * 150, cidade.y[p.no]! + dy * 150));
  };
  const acrescentar = () => {
    if (paradas.length >= MAIS_PARADAS) return;
    const usados = new Set(paradas.map((p) => p.no));
    const livre = cidade.pois.find((p) => !usados.has(p.no)) ?? cidade.pois[0]!;
    som.acordar();
    setParadas([...paradas, { id: proximoId.current++, no: livre.no }]);
  };
  const tirar = (id: number) => {
    if (paradas.length > 2) setParadas(paradas.filter((p) => p.id !== id));
  };
  const carregar = (cen: Cenario) => {
    setParadas(cen.paradas.map((idPoi) => ({ id: proximoId.current++, no: poi(idPoi) })));
    setFixarFim(false);
  };

  // O gráfico ao vivo: quanto da rota (em tempo) cada busca já alcançou.
  const ao_vivo: Serie[] = useMemo(() => {
    const amostra = Math.max(1, Math.floor(total / 120));
    return rs.map((r, i) => {
      const pts: [number, number][] = [[0, 0]];
      const ate = Math.min(relogio.passo, r.passos.length);
      let feito = 0;
      for (let k = 0; k < ate; k += 1) {
        if (r.passos[k]!.t === "settle") feito += 1;
        if ((k + 1) % amostra === 0 || k === ate - 1) pts.push([k + 1, Math.min(100, (100 * feito) / Math.max(1, r.resolvidos))]);
      }
      return { id: r.busca, nome: FICHAS_REAIS[r.busca].nome, tom: tomDaPista(i), pontos: pts };
    });
  }, [rs, relogio.passo, total]);

  // O Big-O do mapa: trabalho contra distância, para as buscas da corrida.
  const [bigO, setBigO] = useState<{ chave: string; pontos: ReturnType<typeof trabalhoPorDistancia> } | null>(null);
  const chaveBigO = buscas.join(",");
  useEffect(() => {
    let vivo = true;
    const id = window.setTimeout(() => {
      const pontos = trabalhoPorDistancia(cidade, buscas, 48);
      if (vivo) setBigO({ chave: chaveBigO, pontos });
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [chaveBigO, cidade, buscas]);
  const seriesBigO: Serie[] = useMemo(() => {
    if (bigO === null || bigO.chave !== chaveBigO) return [];
    return buscas.map((b, i) => {
      const faixas = new Map<number, number[]>();
      for (const pt of bigO.pontos) {
        const f = Math.round(pt.distancia / 400) * 0.4;
        faixas.set(f, [...(faixas.get(f) ?? []), pt.resolvidos[b]!]);
      }
      const pontos = [...faixas.entries()].sort((a, b2) => a[0] - b2[0]).map(([km, vs]) => [km, vs.reduce((s2, x) => s2 + x, 0) / vs.length] as const);
      return { id: b, nome: FICHAS_REAIS[b].nome, tom: tomDaPista(i), pontos };
    });
  }, [bigO, chaveBigO, buscas]);

  const alternar = (b: BuscaReal) => {
    if (buscas.includes(b)) {
      if (buscas.length > 1) setBuscas(buscas.filter((x) => x !== b));
    } else if (buscas.length < MAIS_PISTAS) setBuscas([...buscas, b]);
  };
  const f = Math.min(focada, rs.length - 1);
  const otimo = Math.min(...rs.map((r) => r.tempo));
  const trajeto = ordem.map((no) => nomeDoCruzamento(cidade, no)).join(" → ");

  return (
    <div className="algo mapa" data-testid="path-sim">
      <div className="algo-controles">
        <div className="algo-seg" role="group" aria-label="Scenario">
          {CENARIOS.map((cen) => (
            <button key={cen.id} type="button" aria-pressed={false} onClick={() => carregar(cen)} title={cen.pergunta}>
              {cen.nome}
            </button>
          ))}
        </div>
        <div className="algo-seg" role="group" aria-label="Race a class">
          {(Object.keys(CLASSES_DE_BUSCA) as ClasseDeBusca[]).map((k) => (
            <button key={k} type="button" aria-pressed={CLASSES_DE_BUSCA[k].buscas.join() === buscas.join()} onClick={() => setBuscas(CLASSES_DE_BUSCA[k].buscas)}>
              {CLASSES_DE_BUSCA[k].nome}
            </button>
          ))}
        </div>
        <fieldset>
          <legend>Racing (up to {MAIS_PISTAS})</legend>
          {BUSCAS_REAIS.map((b) => (
            <label key={b}>
              <input type="checkbox" checked={buscas.includes(b)} onChange={() => alternar(b)} disabled={!buscas.includes(b) && buscas.length >= MAIS_PISTAS} />
              {FICHAS_REAIS[b].curto}
            </label>
          ))}
        </fieldset>
        <div className="algo-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={modo === "unico"} onClick={() => setModo("unico")}>
            All on one map
          </button>
          <button type="button" aria-pressed={modo === "lado"} onClick={() => setModo("lado")}>
            Side by side
          </button>
        </div>
      </div>

      <section className="paradas" aria-label="Stops">
        <ol className="paradas__lista">
          {paradas.map((pa, k) => (
            <li key={pa.id} data-tone={TONS_DAS_PARADAS[k % TONS_DAS_PARADAS.length]}>
              <span className="paradas__num mono">{visitaDe(pa.no)}</span>
              <select aria-label={`Stop ${k + 1}`} value={cidade.pois.some((p) => p.no === pa.no) ? pa.no : ""} onChange={(e) => moverPara(pa.id, Number(e.target.value))}>
                {cidade.pois.some((p) => p.no === pa.no) ? null : <option value="">{nomeDoCruzamento(cidade, pa.no)}</option>}
                {cidade.pois.map((p) => (
                  <option key={p.id} value={p.no}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <button type="button" className="paradas__tirar" onClick={() => tirar(pa.id)} disabled={paradas.length <= 2} aria-label={`Remove stop ${k + 1}`}>
                ×
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="algo-btn" onClick={acrescentar} disabled={paradas.length >= MAIS_PARADAS}>
          + Add a stop
        </button>
        <label className="ctxlab-switch" htmlFor="fixar-fim">
          <input id="fixar-fim" type="checkbox" role="switch" checked={fixarFim} onChange={(e) => setFixarFim(e.target.checked)} disabled={paradas.length < 3} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>The last stop is the destination</span>
        </label>
        <p className="algo-nota">
          Shortest order: <b>{trajeto}</b>
          {paradas.length > 2 ? " — chosen by trying every order of the middle stops with exact times." : "."} Drag a figure onto any street to move a stop.
        </p>
      </section>

      <div className="algo-transporte">
        <button type="button" className="algo-btn algo-btn--grande" onClick={() => (relogio.tocando ? relogio.pausar() : relogio.tocar())}>
          {relogio.tocando ? "Pause" : relogio.passo >= total ? "Race again" : relogio.passo === 0 ? "▶ Start the race" : "Resume"}
        </button>
        <BotaoSom />
        <label className="algo-nota">
          Speed{" "}
          <select aria-label="Speed" value={relogio.ritmo} onChange={(e) => relogio.setRitmo(Number(e.target.value))}>
            {[...new Set([1, 3, 8, 20, 50, ritmoPara(rs, 10)])]
              .sort((a, b) => a - b)
              .map((r) => (
                <option key={r} value={r}>
                  {r} steps per frame
                </option>
              ))}
          </select>
        </label>
        <input type="range" min={0} max={total} value={relogio.passo} aria-label="Race clock, in steps" onChange={(e) => relogio.ir(Number(e.target.value))} />
        <output className="mono">
          step <span translate="no">{relogio.passo}</span> of {total}
        </output>
      </div>

      {modo === "unico" ? (
        <MapaCompartilhado cidade={cidade} paleta={paleta} rs={rs} passo={relogio.passo} paradas={paradasNoMapa} onSoltar={soltar} onMover={mover} />
      ) : (
        <Corrida cidade={cidade} paleta={paleta} rs={rs} passo={relogio.passo} destaque={ordem} />
      )}

      <div className="mapa-baixo">
        <div>
          <div className="algo-seg" role="group" aria-label="Pseudocode of">
            {rs.map((r, i) => (
              <button key={r.busca} type="button" aria-pressed={i === f} onClick={() => setFocada(i)}>
                {FICHAS_REAIS[r.busca].curto}
              </button>
            ))}
          </div>
          <Pseudocodigo linhas={FICHAS_REAIS[rs[f]!.busca].pseudo} ativa={estadoEm(rs[f]!, relogio.passo).linha} titulo={`${FICHAS_REAIS[rs[f]!.busca].nome} — the line running now`} />
          <dl className="algo-linhas mono">
            <div>
              <dt>priority</dt>
              <dd>{FICHAS_REAIS[rs[f]!.busca].chave}</dd>
            </div>
            <div>
              <dt>guarantees</dt>
              <dd>{FICHAS_REAIS[rs[f]!.busca].garante}</dd>
            </div>
            <div>
              <dt>cost</dt>
              <dd>{FICHAS_REAIS[rs[f]!.busca].custo}</dd>
            </div>
          </dl>
        </div>
        <div>
          <GraficoVivo series={ao_vivo} titulo="Work done so far, as % of each search's total" eixoX="race clock (steps)" eixoY="% of its work" xMax={total} yMax={100} />
          <GraficoVivo
            series={seriesBigO}
            titulo={seriesBigO.length === 0 ? "Big-O on a real map — measuring 48 trips…" : "Big-O on a real map: work against distance (48 random trips)"}
            eixoX="straight-line distance (km)"
            eixoY="settled"
          />
        </div>
      </div>

      <div className="algo-tabela">
        <table>
          <caption>The scoreboard: {trajeto}</caption>
          <thead>
            <tr>
              <th scope="col">Search</th>
              <th scope="col">Class</th>
              <th scope="col" className="num">
                Route time
              </th>
              <th scope="col" className="num">
                Distance
              </th>
              <th scope="col" className="num">
                Intersections settled
              </th>
              <th scope="col" className="num">
                Steps
              </th>
              <th scope="col">Fastest route?</th>
            </tr>
          </thead>
          <tbody>
            {[...rs]
              .sort((a, b) => a.passos.length - b.passos.length)
              .map((r) => (
                <tr key={r.busca}>
                  <td>{FICHAS_REAIS[r.busca].nome}</td>
                  <td>{CLASSES_DE_BUSCA[FICHAS_REAIS[r.busca].classe].nome}</td>
                  <td className="num">{tempoEmTexto(r.tempo)}</td>
                  <td className="num">{(r.metros / 1000).toFixed(2)} km</td>
                  <td className="num">{r.resolvidos}</td>
                  <td className="num">{r.passos.length}</td>
                  <td>{r.tempo <= otimo + 1e-6 ? "yes" : `no, +${tempoEmTexto(r.tempo - otimo)}`}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <QuemVenceOnde cidade={cidade} aoEscolher={carregar} />

      <p className="algo-nota">
        Streets: {cidade.credito} — <a href={cidade.licenca}>openstreetmap.org/copyright</a>. Travel times use a typical speed per kind of street (30 km/h on residential streets up to 70 km/h on expressways), with every one-way street respected.
      </p>
    </div>
  );
}

function ComCidade({ filho }: { filho: (c: Cidade, p: Paleta) => React.ReactNode }) {
  const cidade = useCidade();
  const ref = useRef<HTMLDivElement>(null);
  const paleta = usePaleta(ref);
  return (
    <div ref={ref}>
      {cidade === null || paleta === null ? (
        <p className="algo-nota" aria-busy="true">
          Loading the streets of São Paulo…
        </p>
      ) : (
        filho(cidade, paleta)
      )}
    </div>
  );
}

export function CaminhoModos() {
  return <ModosDoLab showcase={() => <ComCidade filho={(c, p) => <Vitrine cidade={c} paleta={p} />} />} simulation={() => <ComCidade filho={(c, p) => <Simulacao cidade={c} paleta={p} />} />} inicial="showcase" />;
}
