import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { som, tomDe } from "../lib/som";

/**
 * Os bonecos que marcam as paradas no mapa: um personagem próprio do lab
 * (chapéu de explorador na cor da parada, alvo no chão onde ele pisa).
 *
 * A física é de mola, quadro a quadro, escrita direto no DOM (sem render do
 * React por quadro):
 * - **segurado**, ele pendura pela cabeça e balança como um pêndulo — o ângulo
 *   persegue a velocidade horizontal do ponteiro; braços e pernas são molas
 *   mais frouxas, atrasadas (ragdoll);
 * - **solto**, cai até o cruzamento mais próximo com gravidade, amassa e quica;
 * - **mudado de lugar** (lista ou teclado), dá um pulo em arco até o novo ponto;
 * - **parado**, respira, pisca e acena — animações de CSS, defasadas por boneco.
 */
export interface PropsDoBoneco {
  readonly id: number;
  /** Onde os pés estão, em px do mapa (o cruzamento escolhido). */
  readonly x: number;
  readonly y: number;
  /** O tom do catálogo: a cor do chapéu, do corpo e do alvo. */
  readonly tom: string;
  /** O número na plaquinha: a ordem de visita. */
  readonly numero: number;
  readonly rotulo: string;
  readonly largura: number;
  readonly altura: number;
  /** Soltou em (x, y) da tela do mapa. */
  readonly onSoltar: (id: number, x: number, y: number) => void;
  /** Setas do teclado: mover o boneco nessa direção. */
  readonly onMover: (id: number, dx: number, dy: number) => void;
}

type Modo = "parado" | "arrastando" | "caindo" | "pulando";

const ALTURA = 66;

export function Boneco({ id, x, y, tom, numero, rotulo, largura, altura, onSoltar, onMover }: PropsDoBoneco) {
  const raiz = useRef<SVGGElement>(null);
  const corpo = useRef<SVGGElement>(null);
  const bracoE = useRef<SVGGElement>(null);
  const bracoD = useRef<SVGGElement>(null);
  const pernaE = useRef<SVGLineElement>(null);
  const pernaD = useRef<SVGLineElement>(null);
  const sombra = useRef<SVGEllipseElement>(null);
  const f = useRef({
    modo: "parado" as Modo,
    // Âncora: no chão são os pés; segurado, é o topo da cabeça (onde a mão pega).
    ax: x,
    ay: y,
    ang: 0,
    vAng: 0,
    braco: 0,
    vBraco: 0,
    perna: 0,
    vPerna: 0,
    amasso: 1,
    vAmasso: 0,
    alto: 0,
    vx: 0,
    /** Instante do último movimento do ponteiro (para a velocidade). */
    tPonteiro: 0,
    ultimoT: 0,
    // Queda e pulo: de onde, para onde, quando começou.
    deX: x,
    deY: y,
    paraX: x,
    paraY: y,
    t0: 0,
    id: 0,
  });

  const desenhar = () => {
    const s = f.current;
    const g = raiz.current;
    if (g === null) return;
    const graus = (s.ang * 180) / Math.PI;
    if (s.modo === "arrastando") {
      // Pendurado: gira em torno do topo da cabeça, o corpo embaixo da mão.
      g.setAttribute("transform", `translate(${s.ax.toFixed(1)} ${s.ay.toFixed(1)}) rotate(${graus.toFixed(2)}) translate(0 ${ALTURA})`);
    } else {
      g.setAttribute("transform", `translate(${s.ax.toFixed(1)} ${(s.ay - s.alto).toFixed(1)}) rotate(${graus.toFixed(2)}) scale(${(2 - s.amasso).toFixed(3)} ${s.amasso.toFixed(3)})`);
    }
    bracoE.current?.setAttribute("transform", `rotate(${(s.braco * 57 + 18).toFixed(1)} -9 -40)`);
    bracoD.current?.setAttribute("transform", `rotate(${(s.braco * 57 - 18).toFixed(1)} 9 -40)`);
    pernaE.current?.setAttribute("x2", (-5 + Math.sin(s.perna) * 10).toFixed(1));
    pernaD.current?.setAttribute("x2", (5 + Math.sin(-s.perna * 0.8) * 10).toFixed(1));
    if (sombra.current !== null) {
      // A sombra fica no chão, sob os pés: some quanto mais alto ele está.
      const pesX = s.modo === "arrastando" ? s.ax - Math.sin(s.ang) * ALTURA : s.ax;
      const pesY = s.modo === "arrastando" ? s.ay + Math.cos(s.ang) * ALTURA + 14 : s.ay;
      const longe = s.modo === "arrastando" ? 1 : Math.min(1, s.alto / 60);
      sombra.current.setAttribute("cx", pesX.toFixed(1));
      sombra.current.setAttribute("cy", pesY.toFixed(1));
      sombra.current.setAttribute("opacity", (0.35 * (1 - longe * 0.75)).toFixed(2));
    }
  };

  const animar = () => {
    const s = f.current;
    cancelAnimationFrame(s.id);
    const passo = (t: number) => {
      const dt = Math.min(0.033, (t - (s.ultimoT || t)) / 1000 || 0.016);
      s.ultimoT = t;
      // Molas: o corpo persegue a velocidade do ponteiro; braços e pernas, o corpo.
      const alvo = s.modo === "arrastando" ? Math.max(-1.2, Math.min(1.2, -s.vx * 0.0028)) : 0;
      s.vAng += (-38 * (s.ang - alvo) - 5.5 * s.vAng) * dt;
      s.ang += s.vAng * dt;
      s.vBraco += (-22 * (s.braco - s.ang * 1.6 - (s.modo === "arrastando" ? 0.9 : 0)) - 3 * s.vBraco) * dt;
      s.braco += s.vBraco * dt;
      s.vPerna += (-18 * (s.perna + s.ang * 1.3) - 2.6 * s.vPerna) * dt;
      s.perna += s.vPerna * dt;
      s.vAmasso += (-240 * (s.amasso - 1) - 14 * s.vAmasso) * dt;
      s.amasso += s.vAmasso * dt;
      s.vx *= 0.86;
      if (s.modo === "caindo" || s.modo === "pulando") {
        const dur = s.modo === "caindo" ? 260 : 420;
        const k = Math.min(1, (t - s.t0) / dur);
        const e = s.modo === "caindo" ? k * k : k;
        s.ax = s.deX + (s.paraX - s.deX) * e;
        s.ay = s.deY + (s.paraY - s.deY) * e;
        s.alto = s.modo === "pulando" ? Math.sin(Math.PI * k) * 46 : 0;
        if (k >= 1) {
          s.modo = "parado";
          s.alto = 0;
          s.ax = s.paraX;
          s.ay = s.paraY;
          s.vAmasso = -5.5; // o tranco do pouso
          som.nota(tomDe(0.12 + numero * 0.08), { dur: 0.12, onda: "sine", ganho: 0.12, pista: `boneco${id}` });
        }
      }
      desenhar();
      const quieto = s.modo === "parado" && Math.abs(s.vAng) + Math.abs(s.ang) + Math.abs(s.vAmasso) + Math.abs(s.amasso - 1) + Math.abs(s.vBraco) < 0.004;
      if (!quieto) s.id = requestAnimationFrame(passo);
      else {
        s.ultimoT = 0;
        corpo.current?.classList.remove("boneco--ativo");
      }
    };
    corpo.current?.classList.add("boneco--ativo");
    s.id = requestAnimationFrame(passo);
  };

  // Mudou de lugar por fora (lista, teclado, cenário): pula até lá.
  useEffect(() => {
    const s = f.current;
    if (s.modo === "arrastando") return;
    if (Math.abs(s.paraX - x) < 0.5 && Math.abs(s.paraY - y) < 0.5 && s.modo === "parado") {
      s.ax = x;
      s.ay = y;
      desenhar();
      return;
    }
    s.deX = s.ax;
    s.deY = s.ay;
    s.paraX = x;
    s.paraY = y;
    s.t0 = performance.now();
    s.modo = s.modo === "caindo" ? "caindo" : "pulando";
    animar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y]);
  useEffect(() => () => cancelAnimationFrame(f.current.id), []);

  const pegar = (e: PointerEvent<SVGGElement>) => {
    e.preventDefault();
    som.acordar();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const s = f.current;
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement!;
    const r = svg.getBoundingClientRect();
    s.modo = "arrastando";
    s.ax = ((e.clientX - r.left) / r.width) * largura;
    s.ay = ((e.clientY - r.top) / r.height) * altura;
    s.tPonteiro = performance.now();
    s.ultimoT = 0;
    s.vBraco = 6;
    som.nota(tomDe(0.55 + numero * 0.06), { dur: 0.08, onda: "triangle", ganho: 0.1, pista: `boneco${id}` });
    animar();
  };
  const mover = (e: PointerEvent<SVGGElement>) => {
    const s = f.current;
    if (s.modo !== "arrastando") return;
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement!;
    const r = svg.getBoundingClientRect();
    const nx = Math.max(0, Math.min(largura, ((e.clientX - r.left) / r.width) * largura));
    const ny = Math.max(0, Math.min(altura, ((e.clientY - r.top) / r.height) * altura));
    // Velocidade horizontal em px/s, suavizada: é ela que balança o boneco.
    const agora = performance.now();
    s.vx = s.vx * 0.6 + ((nx - s.ax) / Math.max(8, agora - (s.tPonteiro || agora))) * 1000 * 0.4;
    s.tPonteiro = agora;
    s.ax = nx;
    s.ay = ny;
  };
  const soltar = (e: PointerEvent<SVGGElement>) => {
    const s = f.current;
    if (s.modo !== "arrastando") return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    // Os pés estão ALTURA abaixo da mão, girados pelo ângulo do balanço.
    const pesX = s.ax - Math.sin(s.ang) * ALTURA;
    const pesY = s.ay + Math.cos(s.ang) * ALTURA;
    s.modo = "caindo";
    s.ax = pesX;
    s.ay = pesY;
    s.deX = pesX;
    s.deY = pesY;
    s.paraX = pesX;
    s.paraY = pesY;
    s.t0 = performance.now();
    onSoltar(id, Math.max(0, Math.min(largura, pesX)), Math.max(0, Math.min(altura, pesY)));
  };
  const tecla = (e: KeyboardEvent<SVGGElement>) => {
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const v = d[e.key];
    if (v === undefined) return;
    e.preventDefault();
    som.acordar();
    onMover(id, v[0], v[1]);
  };

  return (
    <g className="boneco" data-tone={tom} data-numero={numero} style={{ "--atraso": `${-(id * 1.37) % 5}s` } as React.CSSProperties}>
      <ellipse ref={sombra} className="boneco__sombra" cx={x} cy={y} rx={13} ry={3.6} opacity={0.35} />
      <g ref={raiz} transform={`translate(${x} ${y})`}>
        <g
          ref={corpo}
          className="boneco__corpo"
          role="button"
          tabIndex={0}
          aria-label={rotulo}
          onPointerDown={pegar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onKeyDown={tecla}
        >
          {/* uma área de toque maior que o desenho */}
          <rect x={-18} y={-80} width={36} height={86} fill="transparent" />
          <circle className="boneco__alvo" cx={0} cy={0} r={7} />
          <g className="boneco__respira">
            <line ref={pernaE} className="boneco__perna" x1={-3} y1={-22} x2={-5} y2={0} />
            <line ref={pernaD} className="boneco__perna" x1={3} y1={-22} x2={5} y2={0} />
            <g ref={bracoE}>
              <line className="boneco__braco" x1={-9} y1={-40} x2={-12} y2={-26} />
            </g>
            <g ref={bracoD}>
              <g className="boneco__aceno">
                <line className="boneco__braco" x1={9} y1={-40} x2={12} y2={-26} />
              </g>
            </g>
            <rect className="boneco__tronco" x={-10} y={-46} width={20} height={26} rx={9} />
            <circle className="boneco__cabeca" cx={0} cy={-55} r={10} />
            <g className="boneco__olhos">
              <circle cx={-3.6} cy={-55} r={1.5} />
              <circle cx={3.6} cy={-55} r={1.5} />
            </g>
            <path className="boneco__chapeu" d="M-11 -59 Q0 -74 11 -59 Z M-15 -59 H15" />
            <g className="boneco__placa" transform="translate(0 -79)">
              <circle r={8} />
              <text textAnchor="middle" dominantBaseline="central">
                {numero}
              </text>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}
