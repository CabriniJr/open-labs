import { CAIXAS, O_QUE_E, type DetalheDaRede, type DispId } from "@ovh/network-domain";
import { poseAt, viewBox, type Film, type Frame, type ResolvedEntity, type Tone } from "@ovh/motion";
import { memo, type ReactNode } from "react";

/**
 * Duas vistas do filme da rede, e o painel que diz o que é cada aparelho.
 *
 * **Rede.** Cada aparelho desenhado com a cara que ele tem — o notebook, o
 * ponto de acesso, o switch com as portas, o roteador com as antenas, o rack do
 * servidor, a nuvem do provedor —, em traço isométrico, com o papel, o nome e o
 * endereço embaixo. As posições, os fios e os pacotes vêm do mesmo filme: a
 * ficha anda pelo caminho que o modelo decidiu, no mesmo relógio das outras
 * vistas. Nada aqui decide rota.
 *
 * **Sequência.** As mesmas mensagens como diagrama de sequência: uma linha de
 * vida por aparelho e uma seta por pacote, acesa a que acabou de sair.
 *
 * Os desenhos são SVG puro, sem three.js e sem filtro: um bloco isométrico é
 * três polígonos. A cor é a do tom de cada peça (`data-tone`), lida do catálogo.
 */

const K = 0.866;
type P = readonly [number, number];
/** Um canto do bloco: `a` ao longo da largura, `b` da profundidade, `z` a altura. */
const C = (cx: number, cy: number, a: number, b: number, z: number): P => [cx + (a - b) * K, cy + (a + b) * 0.5 - z];
const pts = (lista: readonly P[]) => lista.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** Um bloco isométrico assentado em (cx, cy): topo, lado direito e frente. */
function Bloco({ cx = 0, cy = 0, w, d, h }: { cx?: number; cy?: number; w: number; d: number; h: number }) {
  const [a, b] = [w / 2, d / 2];
  return (
    <g>
      <polygon className="rv-frente" points={pts([C(cx, cy, -a, b, h), C(cx, cy, a, b, h), C(cx, cy, a, b, 0), C(cx, cy, -a, b, 0)])} />
      <polygon className="rv-lado" points={pts([C(cx, cy, a, -b, h), C(cx, cy, a, b, h), C(cx, cy, a, b, 0), C(cx, cy, a, -b, 0)])} />
      <polygon className="rv-topo" points={pts([C(cx, cy, -a, -b, h), C(cx, cy, a, -b, h), C(cx, cy, a, b, h), C(cx, cy, -a, b, h)])} />
    </g>
  );
}

/** Um retângulo de pé num plano de profundidade fixa (`b`): tela, painel. */
const Placa = ({ b, a0, a1, z0, z1, className }: { b: number; a0: number; a1: number; z0: number; z1: number; className: string }) => (
  <polygon className={className} points={pts([C(0, 0, a0, b, z0), C(0, 0, a1, b, z0), C(0, 0, a1, b, z1), C(0, 0, a0, b, z1)])} />
);

const Linha = ({ de, para }: { de: P; para: P }) => <line className="rv-traco" x1={de[0]} y1={de[1]} x2={para[0]} y2={para[1]} />;

/** O desenho de cada aparelho, com a base no (0, 0). */
export const DESENHOS: Readonly<Record<DispId, () => ReactNode>> = {
  r1: Roteador,
  isp: Provedor,
  sw1: () => (
    <g>
      <Bloco w={92} d={38} h={13} />
      {Array.from({ length: 8 }, (_, i) => -40 + i * 10.5).map((a) => (
        <polygon key={a} className="rv-detalhe" points={pts([C(0, 0, a, 19, 3), C(0, 0, a + 6.5, 19, 3), C(0, 0, a + 6.5, 19, 9), C(0, 0, a, 19, 9)])} />
      ))}
    </g>
  ),
  ap: () => (
    <g>
      <Bloco w={34} d={34} h={6} />
      {[9, 15, 21].map((r, i) => (
        <path key={r} className="rv-traco rv-onda" d={`M ${-r} ${-14 - i * 5} A ${r} ${r} 0 0 1 ${r} ${-14 - i * 5}`} />
      ))}
      <circle className="rv-led" cx={0} cy={-11} r={2.4} />
    </g>
  ),
  laptop: () => (
    <g>
      <Placa className="rv-tela-moldura" b={-22} a0={-32} a1={32} z0={4} z1={46} />
      <Placa className="rv-tela" b={-22} a0={-27} a1={27} z0={9} z1={41} />
      <Bloco w={64} d={44} h={4} />
      {[-10, -2, 6].map((b) => (
        <Linha key={b} de={C(0, 0, -24, b, 4)} para={C(0, 0, 24, b, 4)} />
      ))}
    </g>
  ),
  pc: () => (
    <g>
      <Bloco cx={-6} cy={4} w={22} d={16} h={3} />
      <Linha de={C(-6, 4, 0, 0, 3)} para={C(-6, 4, 0, 0, 14)} />
      <g transform="translate(-6 4)">
        <Placa className="rv-tela-moldura" b={0} a0={-28} a1={28} z0={14} z1={50} />
        <Placa className="rv-tela" b={0} a0={-24} a1={24} z0={18} z1={46} />
      </g>
      <Bloco cx={40} cy={18} w={16} d={34} h={46} />
    </g>
  ),
  srv: () => <Rack andares={3} />,
  web: () => (
    <g>
      <Rack andares={2} />
      <g transform="translate(30 -52)">
        <circle className="rv-selo" r={13} />
        <path className="rv-traco" d="M -13 0 H 13 M 0 -13 C 6 -7 6 7 0 13 M 0 -13 C -6 -7 -6 7 0 13" />
      </g>
    </g>
  ),
};

function Roteador() {
  return (
    <g>
      <Linha de={C(0, 0, -22, -16, 16)} para={[C(0, 0, -22, -16, 16)[0], C(0, 0, -22, -16, 16)[1] - 26]} />
      <Linha de={C(0, 0, 22, -16, 16)} para={[C(0, 0, 22, -16, 16)[0], C(0, 0, 22, -16, 16)[1] - 26]} />
      <Bloco w={62} d={42} h={16} />
      {[-18, -8, 2].map((a) => {
        const [x, y] = C(0, 0, a, 21, 8);
        return <circle key={a} className="rv-led" cx={x} cy={y} r={2.2} />;
      })}
    </g>
  );
}

function Rack({ andares }: { andares: number }) {
  return (
    <g>
      {Array.from({ length: andares }, (_, i) => (
        <g key={i} transform={`translate(0 ${-i * 15})`}>
          <Bloco w={50} d={50} h={15} />
          <Linha de={C(0, 0, -18, 25, 7.5)} para={C(0, 0, 10, 25, 7.5)} />
          <circle className="rv-led" cx={C(0, 0, 18, 25, 7.5)[0]} cy={C(0, 0, 18, 25, 7.5)[1]} r={2} />
        </g>
      ))}
    </g>
  );
}

function Provedor() {
  return (
    <g>
      <path className="rv-nuvem" d="M -46 -8 A 18 18 0 0 1 -30 -36 A 26 26 0 0 1 18 -44 A 20 20 0 0 1 48 -22 A 15 15 0 0 1 40 4 H -40 A 12 12 0 0 1 -46 -8 Z" />
      <g transform="translate(0 -18) scale(0.55)">
        <Roteador />
      </g>
    </g>
  );
}

// ------------------------------------------------------------------ a vista Rede

const porId = (frame: Frame<DetalheDaRede>) => {
  const m = new Map<string, ResolvedEntity>();
  for (const e of frame.entities) m.set(e.spec.id, e);
  return m;
};

const TOM_DO_APARELHO: Readonly<Record<DispId, Tone>> = { r1: "controller", isp: "controller", sw1: "conduit", ap: "conduit", srv: "container", web: "container", laptop: "processor", pc: "processor" };
const centro = (id: DispId): P => [CAIXAS[id].x + CAIXAS[id].w / 2, CAIXAS[id].y + CAIXAS[id].h / 2];

/** O cenário que não anda: grade, regiões e cabos. Memorizado, porque só o filme o muda. */
const Cenario = memo(function Cenario({ film, traduzir }: { film: Film<DetalheDaRede>; traduzir: (s: string) => string }) {
  return (
    <g>
      {film.entities.map((e) => {
        if (e.type === "region") {
          return (
            <g key={e.id} data-tone={e.tone ?? "muted"} className="rv-regiao">
              <rect x={e.box.x} y={e.box.y} width={e.box.w} height={e.box.h} rx={18} />
              <text x={e.box.x + 14} y={e.box.y + 22}>{e.label === undefined ? undefined : traduzir(e.label)}</text>
            </g>
          );
        }
        if (e.type === "link" && e.id.startsWith("fio:")) {
          const [de, para] = e.id.slice(4).split("-") as [DispId, DispId];
          const [a, b] = [centro(de), centro(para)];
          // O rótulo do cabo fica a 40% do caminho, ao lado da linha: no meio ele
          // caía em cima da etiqueta do aparelho de cima.
          // Os cabos de acesso não levam rótulo aqui: a porta e a VLAN já estão no
          // título da sala, e quatro rótulos convergindo no switch se atropelavam.
          // O trunk leva o dele logo acima do switch, abaixo da etiqueta do roteador.
          const rotulo = para === "sw1" ? null : e.label;
          const f = de === "sw1" ? 0.3 : 0.4;
          const [mx, my] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
          const empe = Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]);
          return (
            <g key={e.id} className="rv-cabo" data-sem-fio={e.dashed === true ? "" : undefined}>
              <line x1={a[0]} y1={a[1] + 6} x2={b[0]} y2={b[1] + 6} />
              {rotulo ? <text x={empe ? mx + 10 : mx} y={empe ? my : my - 8} style={{ textAnchor: empe ? "start" : "middle" }}>{rotulo}</text> : null}
            </g>
          );
        }
        return null;
      })}
    </g>
  );
});

/**
 * `traduzir` só serve a quem renderiza fora da tradução do site (a página de
 * entrega em português, que é `translate="no"`); no lab, o próprio site traduz.
 */
export function VistaRede({ film, frame, label, traduzir = (s) => s }: { film: Film<DetalheDaRede>; frame: Frame<DetalheDaRede>; label: string; traduzir?: (s: string) => string }) {
  const vb = viewBox(film, frame.camera);
  const m = porId(frame);
  return (
    <svg className="rv rv-stage" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={label}>
      <defs>
        <pattern id="rv-grade" width={46} height={26.56} patternUnits="userSpaceOnUse">
          <path className="rv-grade" d="M 0 0 L 46 26.56 M 46 0 L 0 26.56" />
        </pattern>
      </defs>
      <rect x={-200} y={-200} width={film.width + 400} height={film.height + 400} fill="url(#rv-grade)" />
      <Cenario film={film} traduzir={traduzir} />
      {(Object.keys(CAIXAS) as DispId[]).map((id) => {
        const s = m.get(id)?.state;
        if (s === undefined) return null;
        const [x, y] = centro(id);
        const tone = s.tone === "live" ? "live" : TOM_DO_APARELHO[id];
        return (
          <g key={id} className="rv-aparelho" data-tone={tone} data-aceso={s.glow > 0.05 ? "" : undefined} transform={`translate(${x} ${y + 4})`} opacity={s.opacity}>
            {s.ping > 0 && s.ping < 1 ? <ellipse className="rv-ping" rx={46 + s.ping * 40} ry={(46 + s.ping * 40) / 2} opacity={1 - s.ping} /> : null}
            {DESENHOS[id]()}
            {/* Três linhas curtas, e não uma comprida: o que é, como se chama, onde mora. */}
            <text className="rv-papel" y={34}>{traduzir(O_QUE_E[id].papel)}</text>
            <text className="rv-nome" y={50}>{s.label}</text>
            {s.sublabel ? <text className="rv-nome rv-ip" y={65}>{s.sublabel}</text> : null}
          </g>
        );
      })}
      {frame.entities.map(({ spec, state }) => {
        if (state.opacity < 0.02) return null;
        if (spec.type === "token") {
          const p = poseAt(spec.path, state.progress);
          return (
            <g key={spec.id} className="rv-pacote" data-tone={state.tone} transform={`translate(${p.x} ${p.y})`} opacity={state.opacity}>
              <rect x={-52} y={-13} width={104} height={20} rx={10} />
              <text y={1}>{state.label}</text>
              {state.sublabel ? <text className="rv-pacote-sub" y={20}>{state.sublabel}</text> : null}
            </g>
          );
        }
        if (spec.type === "note" && state.label) {
          return (
            <g key={spec.id} className="rv-nota" data-tone={state.tone} opacity={state.opacity}>
              <text x={spec.at.x} y={spec.at.y}>{state.label}</text>
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ a vista Sequência

export function VistaSequencia({ film, frame, label }: { film: Film<DetalheDaRede>; frame: Frame<DetalheDaRede>; label: string }) {
  const nomes = [...new Set(film.packets.flatMap((p) => [p.from, p.to]))];
  const ordem = ["LAPTOP-CIDADAO", "PC-MONITOR", "R1", "SRV-OPENLABS", "WEB-INTERNET"];
  nomes.sort((a, b) => (ordem.indexOf(a) + 99) % 99 - (ordem.indexOf(b) + 99) % 99);
  const W = film.width;
  const x = (nome: string) => 150 + (nomes.indexOf(nome) * (W - 300)) / Math.max(1, nomes.length - 1);
  // O cabeçalho começa abaixo do seletor de vistas, que flutua no alto do palco.
  const topo = 190;
  const passo = (film.height - topo - 30) / Math.max(1, film.packets.length);
  const idDoNome = new Map((Object.keys(CAIXAS) as DispId[]).map((id) => [frame.entities.find((e) => e.spec.id === id)?.state.label ?? id, id]));
  return (
    <svg className="rv rv-stage rv-seq" viewBox={`0 0 ${W} ${film.height}`} role="img" aria-label={label}>
      {nomes.map((n) => {
        const id = idDoNome.get(n);
        return (
          <g key={n} data-tone={id === undefined ? "muted" : TOM_DO_APARELHO[id]}>
            <line className="rv-vida" x1={x(n)} y1={topo - 16} x2={x(n)} y2={film.height - 16} />
            <text className="rv-papel" x={x(n)} y={120}>{id === undefined ? n : O_QUE_E[id].papel}</text>
            <text className="rv-nome" x={x(n)} y={146}>{n}</text>
          </g>
        );
      })}
      {film.packets.map((p, i) => {
        const y = topo + passo * (i + 0.5);
        const [a, b] = [x(p.from), x(p.to)];
        const dir = b >= a ? 1 : -1;
        const estado = i < frame.sent - 1 ? "passado" : i === frame.sent - 1 ? "agora" : "futuro";
        return (
          <g key={i} className="rv-msg" data-tone={p.tone} data-estado={estado}>
            <title>{p.payload}</title>
            <line x1={a} y1={y} x2={b - dir * 14} y2={y} />
            <path d={`M ${b} ${y} l ${-dir * 16} -8 l 0 16 z`} />
            <text x={(a + b) / 2} y={y - 6}>{p.tag === p.protocol ? p.tag : `${p.tag} · ${p.protocol}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ o que é o quê

export function OQueE() {
  return (
    <section className="rv rv-oque" aria-labelledby="rv-oque-titulo">
      <h3 id="rv-oque-titulo" className="redelab-h">What is what</h3>
      <ul>
        {(["laptop", "ap", "sw1", "r1", "srv", "pc", "isp", "web"] as const).map((id) => (
          <li key={id} data-tone={TOM_DO_APARELHO[id]}>
            <svg viewBox="-70 -86 140 104" aria-hidden="true" className="rv-mini">
              {DESENHOS[id]()}
            </svg>
            <div>
              <b>{O_QUE_E[id].papel}</b>
              <p>{O_QUE_E[id].faz}</p>
              <p className="rv-aqui">{O_QUE_E[id].aqui}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
