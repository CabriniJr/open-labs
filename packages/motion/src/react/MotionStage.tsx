import { useId, type ReactNode } from "react";
import type { Film } from "../choreography.js";
import { frameAt, viewBox, type Frame, type ResolvedEntity } from "../frame.js";
import { pathD, poseAt } from "../geometry.js";
import { contornoD, formaDe } from "../shapes.js";
import type { Animatable, EntitySpec, LaneSpec, LinkSpec, NodeSpec, TokenSpec } from "../scene.js";

/**
 * O palco: desenha um quadro do filme em SVG. Não guarda estado nenhum — o
 * mesmo `t` dá o mesmo desenho — e por isso pode ser usado parado, numa
 * miniatura, num teste ou dentro do player.
 */
export interface MotionStageProps<D> {
  readonly film: Film<D>;
  readonly t: number;
  /** Quadro já calculado, quando quem chama também precisa dele. */
  readonly frame?: Frame<D>;
  readonly label: string;
  readonly className?: string;
  readonly onSelect?: (id: string) => void;
  readonly selected?: string | null;
}

const f = (n: number) => Math.round(n * 100) / 100;

function visible(state: Readonly<Animatable>): number {
  return state.opacity * (1 - 0.72 * state.dim);
}

function Label({ text, sub, y = 0, k = 1 }: { text: string; sub: string; y?: number; k?: number }) {
  if (text === "" && sub === "") return null;
  return (
    <>
      {text !== "" ? (
        <text className="mo-label" y={sub === "" ? y : y - 7 * k} textAnchor="middle" dominantBaseline="central">
          {text}
        </text>
      ) : null}
      {sub !== "" ? (
        <text className="mo-sublabel" y={text === "" ? y : y + 10 * k} textAnchor="middle" dominantBaseline="central">
          {sub}
        </text>
      ) : null}
    </>
  );
}

function shapeOf(shape: NodeSpec["shape"], w: number, h: number, className: string): ReactNode {
  const forma = shape ?? "box";
  if (forma === "cylinder") {
    const e = Math.min(10, h / 5);
    return (
      <path
        className={className}
        d={`M${-w / 2} ${-h / 2 + e} A${w / 2} ${e} 0 0 1 ${w / 2} ${-h / 2 + e} V${h / 2 - e} A${w / 2} ${e} 0 0 1 ${-w / 2} ${h / 2 - e} Z M${-w / 2} ${-h / 2 + e} A${w / 2} ${e} 0 0 0 ${w / 2} ${-h / 2 + e}`}
      />
    );
  }
  if (forma === "stack") {
    // Três lâminas, com o LED de cada uma: lê como equipamento de relance.
    const lamina = (h - 8) / 3;
    return (
      <g className={className === "mo-node__shape" ? "mo-node__stack" : undefined}>
        <rect className={className} x={-w / 2} y={-h / 2} width={w} height={h} rx={6} />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            {/* Ranhuras só nas bordas: atravessando a caixa, a lâmina riscava o rótulo. */}
            {i > 0 ? (
              <>
                <line className="mo-node__blade" x1={-w / 2 + 4} x2={-w / 2 + 16} y1={-h / 2 + 4 + i * lamina} y2={-h / 2 + 4 + i * lamina} />
                <line className="mo-node__blade" x1={w / 2 - 22} x2={w / 2 - 4} y1={-h / 2 + 4 + i * lamina} y2={-h / 2 + 4 + i * lamina} />
              </>
            ) : null}
            <circle className="mo-node__led" cx={w / 2 - 10} cy={-h / 2 + 4 + i * lamina + lamina / 2} r={2} />
          </g>
        ))}
      </g>
    );
  }
  // O resto vem do catálogo de formas: o mesmo contorno que o 3D extruda.
  const f = formaDe(forma, w, h);
  const contorno = <path className={className} d={contornoD(f.contorno)} />;
  if (className !== "mo-node__shape") return contorno;
  return (
    <>
      {contorno}
      {f.detalhes.map((d, i) => (
        <path key={i} className="mo-node__detail" d={contornoD(d, false)} />
      ))}
      {f.circulos.map((c, i) => (
        <circle key={`c${i}`} className="mo-node__detail mo-node__dot" cx={c.x} cy={c.y} r={c.r} />
      ))}
    </>
  );
}

function Body({ spec, state, box, shape, badge }: { spec: EntitySpec; state: Readonly<Animatable>; box: { x: number; y: number; w: number; h: number }; shape?: NodeSpec["shape"]; badge?: string | undefined }) {
  const k = spec.textScale ?? 1;
  const cx = box.x + box.w / 2 + state.dx;
  const cy = box.y + box.h / 2 + state.dy;
  return (
    <g
      className="mo-node"
      data-tone={state.tone}
      data-shape={shape ?? "box"}
      data-lit={state.glow > 0.05 ? "" : undefined}
      transform={`translate(${f(cx)} ${f(cy)}) scale(${f(state.scale)})`}
      style={{ opacity: visible(state), ["--mo-glow" as string]: f(state.glow) }}
    >
      {state.ping > 0 && state.ping < 1 ? (
        <g style={{ opacity: f(1 - state.ping) }} transform={`scale(${f(1 + state.ping * 0.45)})`}>
          {shapeOf(shape, box.w, box.h, "mo-node__ping")}
        </g>
      ) : null}
      {shapeOf(shape, box.w, box.h, "mo-node__shape")}
      {badge !== undefined ? (
        <text className="mo-badge" x={-box.w / 2 + 10 * k} y={-box.h / 2 + 12 * k} dominantBaseline="central">
          {badge}
        </text>
      ) : null}
      <Label text={state.label} sub={state.sublabel} k={k} />
      {spec.title !== undefined ? <title>{spec.title}</title> : null}
    </g>
  );
}

/** Quanto a cabeça de uma raia desce para continuar no quadro. */
function stickyShift(spec: LaneSpec, top: number): number {
  return spec.sticky === true ? Math.max(0, Math.min(top - spec.head.y, spec.bottom - spec.head.y - spec.head.h)) : 0;
}

function Lane({ spec, state, top, part }: { spec: LaneSpec; state: Readonly<Animatable>; top: number; part: "life" | "head" | "all" }) {
  const x = spec.head.x + spec.head.w / 2 + state.dx;
  const y0 = spec.head.y + spec.head.h + state.dy;
  const y1 = y0 + (spec.bottom - y0) * state.progress;
  const shift = stickyShift(spec, top);
  return (
    <g className="mo-lane" data-tone={state.tone} data-stuck={shift > 0 ? "" : undefined} style={{ opacity: visible(state) }}>
      {part !== "head" ? <line className="mo-lane__life" x1={f(x)} x2={f(x)} y1={f(y0)} y2={f(y1)} /> : null}
      {part !== "life" ? <Body spec={spec} state={{ ...state, dim: 0, opacity: 1, dy: state.dy + shift }} box={spec.head} shape="box" /> : null}
    </g>
  );
}

function Link({ spec, state, maskId }: { spec: LinkSpec; state: Readonly<Animatable>; maskId: string }) {
  const k = spec.textScale ?? 1;
  const d = pathD(spec.path);
  const p = state.progress;
  const tip = poseAt(spec.path, p);
  const at = spec.labelAt ?? 0.5;
  const labelPose = poseAt(spec.path, at);
  // O rótulo chega com o traço: aparece no fim do desenho, e não por baixo de quem ainda viaja nele.
  const labelOpacity = Math.min(1, Math.max(0, (p - 0.86) / 0.14));
  return (
    <g
      className="mo-link"
      data-tone={state.tone}
      data-dashed={spec.dashed === true ? "" : undefined}
      data-lit={state.glow > 0.05 ? "" : undefined}
      transform={`translate(${f(state.dx)} ${f(state.dy)})`}
      style={{ opacity: visible(state), ["--mo-glow" as string]: f(state.glow) }}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse">
        <path d={d} pathLength={1} className="mo-link__reveal" strokeDasharray={`${f(p)} 2`} />
      </mask>
      <path d={d} className="mo-link__path" mask={p < 0.999 ? `url(#${maskId})` : undefined} />
      {spec.arrow === true && p > 0.02 ? (
        <path className="mo-link__arrow" d="M0 0 L-9 -4.5 L-9 4.5 Z" transform={`translate(${f(tip.x)} ${f(tip.y)}) rotate(${f(tip.angle)}) scale(${f(k)})`} />
      ) : null}
      {state.label !== "" && labelOpacity > 0 ? (
        <text className="mo-link__label" x={f(labelPose.x)} y={f(labelPose.y - 9 * k)} textAnchor="middle" style={{ opacity: f(labelOpacity) }}>
          {state.label}
        </text>
      ) : null}
      {state.sublabel !== "" && labelOpacity > 0 ? (
        <text className="mo-link__sublabel" x={f(labelPose.x)} y={f(labelPose.y + 15 * k)} textAnchor="middle" style={{ opacity: f(labelOpacity) }}>
          {state.sublabel}
        </text>
      ) : null}
    </g>
  );
}

function Token({ spec, state }: { spec: TokenSpec; state: Readonly<Animatable> }) {
  const o = visible(state);
  if (o < 0.01) return null;
  const r = spec.size ?? 6;
  const pose = poseAt(spec.path, state.progress);
  const trail = spec.trail ?? 6;
  const ghosts = [];
  for (let k = trail; k >= 1; k -= 1) {
    const back = state.progress - k * 0.022;
    if (back <= 0) continue;
    const g = poseAt(spec.path, back);
    ghosts.push(<circle key={k} className="mo-token__ghost" cx={f(g.x)} cy={f(g.y)} r={f(r * (1 - k / (trail + 2)))} style={{ opacity: f(0.5 * (1 - k / (trail + 1))) }} />);
  }
  const label = state.label;
  const sub = state.sublabel;
  const k = spec.textScale ?? 1;
  // Etiqueta de pacote: cabeçalho cheio na cor do tipo, conteúdo embaixo.
  const width = Math.max(28, Math.max(label.length * 6.4, sub.length * 5.6) + 16) * k;
  const alto = (sub === "" ? 20 : 34) * k;
  return (
    <g className="mo-token" data-tone={state.tone} style={{ opacity: o }} transform={`translate(${f(state.dx)} ${f(state.dy)})`}>
      {ghosts}
      <circle className="mo-token__halo" cx={f(pose.x)} cy={f(pose.y)} r={r * 2.4} />
      <circle className="mo-token__core" cx={f(pose.x)} cy={f(pose.y)} r={r * state.scale} />
      {label !== "" ? (
        <g transform={`translate(${f(pose.x)} ${f(pose.y - r - 8 * k - alto / 2)})`}>
          <rect className="mo-token__tag" x={-width / 2} y={-alto / 2} width={width} height={alto} rx={4 * k} />
          {sub !== "" ? <rect className="mo-token__head" x={-width / 2} y={-alto / 2} width={width} height={16 * k} rx={4 * k} /> : null}
          <text className={sub === "" ? "mo-token__text" : "mo-token__text mo-token__text--head"} y={sub === "" ? 0 : -alto / 2 + 8 * k} textAnchor="middle" dominantBaseline="central">
            {label}
          </text>
          {sub !== "" ? (
            <text className="mo-token__sub" y={alto / 2 - 8 * k} textAnchor="middle" dominantBaseline="central">
              {sub}
            </text>
          ) : null}
        </g>
      ) : null}
    </g>
  );
}

function Entity({ entity, maskId, t, top }: { entity: ResolvedEntity; maskId: string; t: number; top: number }) {
  const { spec, state } = entity;
  if (state.opacity < 0.005) return null;
  switch (spec.type) {
    case "node":
      return <Body spec={spec} state={state} box={spec.box} shape={spec.shape ?? "box"} badge={spec.badge} />;
    case "lane":
      return <Lane spec={spec} state={state} top={top} part={spec.sticky === true ? "life" : "all"} />;
    case "link":
      return <Link spec={spec} state={state} maskId={maskId} />;
    case "token":
      return <Token spec={spec} state={state} />;
    case "bar": {
      const { box } = spec;
      const down = (spec.grow ?? "down") === "down";
      const w = down ? box.w : box.w * state.progress;
      const h = down ? box.h * state.progress : box.h;
      return (
        <g className="mo-bar" data-tone={state.tone} data-lit={state.glow > 0.05 ? "" : undefined} style={{ opacity: visible(state), ["--mo-glow" as string]: f(state.glow) }}>
          <rect x={f(box.x + state.dx)} y={f(box.y + state.dy)} width={f(Math.max(0, w))} height={f(Math.max(0, h))} rx={Math.min(4, box.w / 2, box.h / 2)} />
          {state.label !== "" && state.progress > 0.6 ? (
            <text className="mo-bar__label" x={f(box.x + state.dx + (down ? box.w + 6 : 6))} y={f(box.y + state.dy + (down ? 10 : box.h / 2))} dominantBaseline="central">
              {state.label}
            </text>
          ) : null}
        </g>
      );
    }
    case "note": {
      const lines = state.label.split("\n");
      const anchor = spec.align ?? "middle";
      return (
        <g className="mo-note" data-tone={state.tone} style={{ opacity: visible(state) }} transform={`translate(${f(spec.at.x + state.dx)} ${f(spec.at.y + state.dy)}) scale(${f(state.scale)})`}>
          <text textAnchor={anchor}>
            {lines.map((l, i) => (
              <tspan key={i} x={0} dy={i === 0 ? 0 : 15 * (spec.textScale ?? 1)}>
                {l}
              </tspan>
            ))}
          </text>
          {state.sublabel !== "" ? (
            <text className="mo-note__sub" textAnchor={anchor} y={(lines.length * 15 + 2) * (spec.textScale ?? 1)}>
              {state.sublabel}
            </text>
          ) : null}
        </g>
      );
    }
    case "region": {
      const { box } = spec;
      return (
        <g className="mo-region" data-tone={state.tone} data-lit={state.glow > 0.05 ? "" : undefined} style={{ opacity: visible(state), ["--mo-glow" as string]: f(state.glow) }} transform={`translate(${f(state.dx)} ${f(state.dy)})`}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14 * (spec.textScale ?? 1)} />
          {state.label !== "" ? (
            <text className="mo-region__label" x={box.x + 14 * (spec.textScale ?? 1)} y={box.y + 18 * (spec.textScale ?? 1)}>
              {state.label}
            </text>
          ) : null}
        </g>
      );
    }
    case "custom":
      return (
        <g className="mo-custom" style={{ opacity: visible(state) }} transform={`translate(${f(spec.box.x + state.dx)} ${f(spec.box.y + state.dy)})`}>
          {spec.draw(state, t) as ReactNode}
        </g>
      );
  }
}

export function MotionStage<D>({ film, t, frame, label, className, onSelect, selected }: MotionStageProps<D>) {
  const uid = useId().replace(/:/g, "");
  const q = frame ?? frameAt(film, t);
  const vb = viewBox(film, q.camera);
  return (
    <svg
      className={["mo-stage", className].filter(Boolean).join(" ")}
      viewBox={`${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
    >
      <defs>
        {/* O papel quadriculado acompanha o zoom: a 100× ele continua com a
            mesma malha na tela, em vez de virar bolas do tamanho de uma porta. */}
        <pattern id={`${uid}-grid`} width={f(24 / q.camera.zoom)} height={f(24 / q.camera.zoom)} patternUnits="userSpaceOnUse">
          <circle cx={f(1 / q.camera.zoom)} cy={f(1 / q.camera.zoom)} r={f(1 / q.camera.zoom)} className="mo-stage__dot" />
        </pattern>
      </defs>
      <rect className="mo-stage__floor" x={f(vb.x - vb.w)} y={f(vb.y - vb.h)} width={f(vb.w * 3)} height={f(vb.h * 3)} fill={`url(#${uid}-grid)`} />
      {q.entities.map((entity) => (
        <g
          key={entity.spec.id}
          data-entity={entity.spec.id}
          data-selected={selected === entity.spec.id ? "" : undefined}
          style={entity.spec.textScale === undefined ? undefined : { ["--mo-k" as string]: entity.spec.textScale }}
          onClick={onSelect === undefined ? undefined : () => onSelect(entity.spec.id)}
        >
          <Entity entity={entity} maskId={`${uid}-m-${entity.spec.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`} t={t} top={vb.y + 12} />
        </g>
      ))}
      {/* Cabeças que acompanham a câmera vão por cima de tudo, senão uma barra as cobriria. */}
      {q.entities.map(({ spec, state }) =>
        spec.type === "lane" && spec.sticky === true && state.opacity >= 0.005 ? (
          <g key={`head:${spec.id}`} data-entity-head={spec.id}>
            <Lane spec={spec} state={state} top={vb.y + 12} part="head" />
          </g>
        ) : null,
      )}
    </svg>
  );
}
