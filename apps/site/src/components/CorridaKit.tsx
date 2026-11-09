import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { som } from "../lib/som";

/**
 * As peças que as corridas de algoritmos dividem: a barra de progresso viva,
 * o pseudocódigo com a linha acesa, o gráfico que cresce, o botão do som, o
 * relógio da corrida e o narrador do showcase. Nenhuma sabe o que é ordenar
 * ou buscar — quem sabe é o lab.
 */

/** O tom de uma pista, pela posição: a pista 0 é a espécie 1, e assim por diante. */
export const tomDaPista = (k: number): string => `kind-${(k % 5) + 1}`;

export function ProgressoVivo({ fracao, fim, lugar, rotulo }: { fracao: number; fim: boolean; lugar?: number | undefined; rotulo: string }) {
  const p = Math.max(0, Math.min(1, fracao));
  return (
    <div className="pv" data-fim={fim ? "" : undefined} role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} style={{ "--p": p.toFixed(4) } as React.CSSProperties}>
      <div className="pv__barra" />
      {fim ? <span className="pv__texto mono">{lugar === undefined ? "done" : `#${lugar} · done`}</span> : <span className="pv__texto mono" translate="no">{`${Math.round(p * 100)}%`}</span>}
    </div>
  );
}

export function Pseudocodigo({ linhas, ativa, titulo }: { linhas: readonly string[]; ativa: number | undefined; titulo: string }) {
  return (
    <figure className="pseudo" aria-label={titulo}>
      <figcaption className="algo-h">{titulo}</figcaption>
      <ol className="pseudo__linhas mono" translate="no">
        {linhas.map((l, k) => {
          const num = /^(\d+)\s/u.exec(l)?.[1];
          const acesa = num !== undefined && Number(num) === ativa;
          return (
            <li key={k} data-acesa={acesa ? "" : undefined} data-cabeca={num === undefined ? "" : undefined}>
              {l}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export interface Serie {
  readonly id: string;
  readonly nome: string;
  readonly tom: string;
  readonly pontos: readonly (readonly [number, number])[];
  readonly tracejada?: boolean;
}

/**
 * Um gráfico de linhas em SVG que cresce conforme os pontos chegam. Escala
 * linear ou logarítmica em cada eixo; a escala acompanha o maior valor já visto.
 */
export function GraficoVivo({ series, titulo, eixoX, eixoY, logX = false, logY = false, marcadorX, xMax, yMax }: { series: readonly Serie[]; titulo: string; eixoX: string; eixoY: string; logX?: boolean; logY?: boolean; marcadorX?: number | undefined; xMax?: number | undefined; yMax?: number | undefined }) {
  const W = 640;
  const H = 260;
  const M = { l: 58, r: 16, t: 26, b: 38 };
  const todos = series.flatMap((s) => s.pontos);
  const xs = todos.map((p) => p[0]);
  const ys = todos.map((p) => p[1]);
  const x0 = logX ? Math.max(1, Math.min(...xs, Number.POSITIVE_INFINITY)) : 0;
  const x1 = Math.max(xMax ?? 0, ...xs, logX ? 2 : 1);
  const y0 = logY ? 1 : 0;
  const y1 = Math.max(yMax ?? 0, ...ys, logY ? 10 : 1);
  const fx = (v: number) => M.l + (logX ? (Math.log(Math.max(v, x0)) - Math.log(x0)) / (Math.log(x1) - Math.log(x0) || 1) : (v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const fy = (v: number) => H - M.b - (logY ? Math.log(Math.max(1, v)) / Math.log(y1) : (v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const marcas = (lo: number, hi: number, log: boolean): number[] => {
    if (log) {
      const r: number[] = [];
      for (let p = Math.floor(Math.log10(Math.max(1, lo))); 10 ** p <= hi * 1.0001; p += 1) r.push(10 ** p);
      return r;
    }
    const passo = 10 ** Math.floor(Math.log10((hi - lo) / 4 || 1));
    const k = [1, 2, 5, 10].find((m) => (hi - lo) / (passo * m) <= 5) ?? 10;
    const r: number[] = [];
    for (let v = 0; v <= hi * 1.0001; v += passo * k) r.push(v);
    return r;
  };
  const fmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k` : `${Math.round(v * 10) / 10}`);
  return (
    <figure className="gv">
      <figcaption className="algo-h">{titulo}</figcaption>
      <svg className="algo-svg algo-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}: ${series.filter((s) => !s.tracejada).map((s) => s.nome).join(", ")}`}>
        {marcas(y0, y1, logY).map((v) => (
          <g key={`y${v}`}>
            <line className="algo-grade" x1={M.l} x2={W - M.r} y1={fy(v)} y2={fy(v)} />
            <text x={M.l - 6} y={fy(v) + 4} textAnchor="end" className="algo-fraco">
              {fmt(v)}
            </text>
          </g>
        ))}
        {marcas(x0, x1, logX).filter((v) => v >= x0 * 0.999).map((v) => (
          <text key={`x${v}`} x={fx(v)} y={H - M.b + 16} textAnchor="middle" className="algo-fraco">
            {fmt(v)}
          </text>
        ))}
        <text x={(W + M.l) / 2} y={H - 4} textAnchor="middle" className="algo-fraco">
          {eixoX}
        </text>
        <text x={M.l} y={14} className="algo-fraco">
          ↑ {eixoY}
        </text>
        {marcadorX !== undefined ? <line className="algo-cursor" x1={fx(marcadorX)} x2={fx(marcadorX)} y1={M.t} y2={H - M.b} /> : null}
        {series.map((s) =>
          s.pontos.length === 0 ? null : (
            <g key={s.id} data-tone={s.tom}>
              <polyline className={s.tracejada ? "algo-ref" : "algo-curva"} points={s.pontos.map((p) => `${fx(p[0]).toFixed(1)},${fy(p[1]).toFixed(1)}`).join(" ")} />
              {s.tracejada ? null : <circle className="algo-ponto" cx={fx(s.pontos.at(-1)![0])} cy={fy(s.pontos.at(-1)![1])} r={3.5} />}
            </g>
          ),
        )}
      </svg>
      <ul className="gv__legenda">
        {series
          .filter((s) => !s.tracejada)
          .map((s) => (
            <li key={s.id} data-tone={s.tom}>
              <span className="algo-chip" aria-hidden="true" />
              {s.nome}
            </li>
          ))}
      </ul>
    </figure>
  );
}

export function BotaoSom() {
  const [ligado, setLigado] = useState(som.ligado);
  useEffect(() => som.ouvir(setLigado), []);
  return (
    <button
      type="button"
      className="algo-btn algo-som"
      aria-pressed={ligado}
      onClick={() => {
        som.acordar();
        som.definir(!ligado);
        if (!ligado) som.chegada(440);
      }}
    >
      <span aria-hidden="true">{ligado ? "🔊" : "🔇"}</span> Sound {ligado ? "on" : "off"}
    </button>
  );
}

export interface Relogio {
  readonly passo: number;
  readonly tocando: boolean;
  readonly ritmo: number;
  tocar(): void;
  pausar(): void;
  ir(p: number): void;
  setRitmo(r: number): void;
}

/**
 * O relógio de uma corrida: `ritmo` passos por quadro, com requestAnimationFrame,
 * parando sozinho em `total`. Pausa quando a página fica oculta (o rAF já para).
 */
export function useRelogio(total: number, ritmoInicial: number, aoTerminar?: () => void): Relogio {
  const [passo, setPassoEstado] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [ritmo, setRitmo] = useState(ritmoInicial);
  // O passo vive numa referência: o laço do quadro lê e escreve nela, e o
  // estado do React só acompanha. Decidir "terminou" dentro de um updater do
  // setState não funciona — o React pode rodá-lo depois.
  const atual = useRef(0);
  const fim = useRef(aoTerminar);
  fim.current = aoTerminar;
  const setPasso = (p: number) => {
    atual.current = p;
    setPassoEstado(p);
  };
  useEffect(() => {
    if (atual.current > total) setPasso(total);
  }, [total]);
  useEffect(() => {
    if (!tocando) return;
    let id = 0;
    const tique = () => {
      const prox = Math.min(total, atual.current + ritmo);
      setPasso(prox);
      if (prox >= total) {
        setTocando(false);
        fim.current?.();
        return;
      }
      id = requestAnimationFrame(tique);
    };
    id = requestAnimationFrame(tique);
    return () => cancelAnimationFrame(id);
  }, [tocando, ritmo, total]);
  const tocar = useCallback(() => {
    som.acordar();
    if (atual.current >= total) setPasso(0);
    setTocando(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);
  return {
    passo,
    tocando,
    ritmo,
    tocar,
    pausar: () => setTocando(false),
    ir: (p: number) => {
      setTocando(false);
      setPasso(Math.max(0, Math.min(total, Math.round(p))));
    },
    setRitmo,
  };
}

export interface CapituloDoShowcase {
  readonly id: string;
  readonly titulo: string;
  readonly texto: string;
  /** O que olhar, em frases curtas. */
  readonly olhe: readonly string[];
}

/**
 * A moldura do showcase: palco à esquerda, capítulos e narração à direita.
 * O palco é do lab; o narrador só sabe trocar de capítulo e avisar.
 */
export function Narrador({ capitulos, atual, irPara, children, rodape }: { capitulos: readonly CapituloDoShowcase[]; atual: number; irPara: (k: number) => void; children: ReactNode; rodape?: ReactNode }) {
  const c = capitulos[atual]!;
  return (
    <div className="narrador">
      <div className="narrador__palco">{children}</div>
      <aside className="narrador__lado">
        <ol className="narrador__caps" aria-label="Chapters">
          {capitulos.map((k, i) => (
            <li key={k.id}>
              <button type="button" aria-current={i === atual ? "step" : undefined} onClick={() => irPara(i)}>
                <span className="mono">{String(i + 1).padStart(2, "0")}</span> {k.titulo}
              </button>
            </li>
          ))}
        </ol>
        <section className="narrador__texto" aria-live="polite">
          <h3>{c.titulo}</h3>
          <p>{c.texto}</p>
          {c.olhe.length > 0 ? (
            <ul>
              {c.olhe.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          ) : null}
        </section>
        {rodape}
      </aside>
    </div>
  );
}
