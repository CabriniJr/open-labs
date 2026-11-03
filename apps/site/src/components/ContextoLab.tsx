import type { Film } from "@ovh/motion";
import { MotionPlayer, MotionStage, type MotionView } from "@ovh/motion/react";
import { filmeDoContexto, OPCOES_PADRAO, type DetalheDoContexto, type Foco, type SpanGerado } from "@ovh/otel-domain";
import { lazy, Suspense, useMemo, useState } from "react";

/*
 * O three.js só desce quando o leitor escolhe a vista isométrica: quem fica no
 * palco plano não paga meio megabyte de WebGL.
 */
const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

/**
 * As vistas além do diagrama de sequência. As duas desenham a TOPOLOGIA — o
 * mesmo modelo, a mesma história, outro layout — no relógio do player: o
 * filme principal manda no tempo e no painel, e estas só desenham.
 */
function vistas(topologia: Film<DetalheDoContexto>): readonly MotionView<DetalheDoContexto>[] {
  return [
    {
      id: "topology", label: "Topology", film: topologia,
      render: ({ film, t, frame, label, selected, onSelect }) => <MotionStage film={film} t={t} frame={frame} label={`${label} — service topology`} selected={selected} onSelect={onSelect} spatialControls={false} />,
    },
    ...([['iso', 'Iso', 'orthographic'], ['3d', '3D', 'perspective']] as const).map(([id, label, projection]): MotionView<DetalheDoContexto> => ({
      id, label, film: topologia,
      render: ({ film, t, frame, label, selected, onSelect }) => <Suspense fallback={<div className="iso-stage" aria-busy="true" />}><IsoStage film={film} t={t} frame={frame} label={`${label} — service topology`} projection={projection} selected={selected} onSelect={onSelect} /></Suspense>,
    })),
  ];
}

/**
 * O lab "Hard context and baggage": o palco animado sobre o modelo de
 * propagação. As duas chaves do topo mudam o modelo, e o filme é recalculado
 * dele — no mesmo instante em que o leitor estava.
 */

const CAMPOS: readonly { foco: Foco; nome: string }[] = [
  { foco: "version", nome: "version" },
  { foco: "trace-id", nome: "trace-id" },
  { foco: "parent-id", nome: "parent-id" },
  { foco: "flags", nome: "flags" },
];

const TONS = ["kind-1", "kind-3", "kind-4"] as const;

function Traceparent({ valor, foco }: { valor: string | undefined; foco: Foco | null }) {
  if (valor === undefined) {
    return (
      <span className="ctxlab-missing" data-tone="live">
        — not present
      </span>
    );
  }
  const partes = valor.split("-");
  return (
    <span className="ctxlab-tp" data-focus={foco ?? undefined}>
      {partes.map((parte, i) => (
        <span key={i}>
          {i > 0 ? <span className="ctxlab-dash">-</span> : null}
          <span className="ctxlab-field" data-field={CAMPOS[i]?.foco} data-on={foco === CAMPOS[i]?.foco ? "" : undefined}>
            {parte}
          </span>
        </span>
      ))}
    </span>
  );
}

function Fio({ detalhe }: { detalhe: DetalheDoContexto }) {
  const c = detalhe.chamada;
  if (c === null) {
    const raiz = detalhe.spans[0];
    return (
      <div className="ctxlab-wire">
        <p className="ctxlab-h mono">{detalhe.exportados ? "In the backend" : "Active context"}</p>
        {raiz !== undefined && !detalhe.exportados ? (
          <dl className="ctxlab-kv mono">
            <dt>trace-id</dt>
            <dd>{raiz.traceId}</dd>
            <dt>span-id</dt>
            <dd>{raiz.spanId}</dd>
            <dt>sampled</dt>
            <dd>{raiz.amostrado ? "true" : "false"}</dd>
          </dl>
        ) : (
          <p className="ctxlab-note">The trace view below is what a backend can rebuild from the exported spans.</p>
        )}
      </div>
    );
  }
  const extraido = c.extraido;
  return (
    <div className="ctxlab-wire">
      <p className="ctxlab-h mono">
        On the wire · {c.de} → {c.para}
      </p>
      <pre className="ctxlab-req mono">
        <span className="ctxlab-line">{c.rota} HTTP/1.1</span>
        <span className="ctxlab-line">
          <span className="ctxlab-hname">traceparent: </span>
          <Traceparent valor={c.headers.traceparent} foco={detalhe.foco} />
        </span>
        <span className="ctxlab-line" data-on={detalhe.foco === "baggage" ? "" : undefined}>
          <span className="ctxlab-hname">baggage: </span>
          {c.headers.baggage !== undefined ? <span className="ctxlab-bag">{c.headers.baggage}</span> : <span className="ctxlab-missing" data-tone="live">— not present</span>}
        </span>
      </pre>
      <ol className="ctxlab-legend mono" aria-label="traceparent fields">
        {CAMPOS.map((campo) => (
          <li key={campo.foco} data-on={detalhe.foco === campo.foco ? "" : undefined}>
            {campo.nome}
          </li>
        ))}
      </ol>
      <p className="ctxlab-note">
        {c.span === null
          ? `${c.para} has no SDK: nothing is extracted and no span is created.`
          : extraido === null
            ? `${c.para} found no valid context, so it starts a new root span.`
            : `${c.para} extracts the context and creates span ${c.span.spanId.slice(0, 8)}…, child of ${extraido.spanId.slice(0, 8)}….`}
      </p>
    </div>
  );
}

function Arvore({ spans, exportados }: { spans: readonly SpanGerado[]; exportados: boolean }) {
  const traces = useMemo(() => {
    const ids = [...new Set(spans.map((s) => s.traceId))];
    return ids.map((id) => ({ id, spans: spans.filter((s) => s.traceId === id) }));
  }, [spans]);
  const profundidade = (s: SpanGerado): number => {
    let d = 0;
    let atual: SpanGerado | undefined = s;
    while (atual?.parentId != null) {
      const pai: SpanGerado | undefined = spans.find((x) => x.spanId === atual!.parentId);
      if (pai === undefined) break;
      d += 1;
      atual = pai;
    }
    return d;
  };
  const visiveis = exportados ? traces.map((t) => ({ ...t, spans: t.spans.filter((s) => s.amostrado) })).filter((t) => t.spans.length > 0) : traces;
  return (
    <div className="ctxlab-tree">
      <p className="ctxlab-h mono">{exportados ? "Trace view · backend" : "Spans in memory"}</p>
      {visiveis.length === 0 ? <p className="ctxlab-note" data-tone="live">No spans were exported. sampled = 0 travelled with the context.</p> : null}
      {visiveis.map((t, ti) => (
        <div key={t.id} className="ctxlab-trace" data-tone={t.spans[0]?.amostrado === false ? "muted" : TONS[ti] ?? "kind-5"}>
          <p className="ctxlab-trace__id mono">
            trace {t.id.slice(0, 8)}… {ti > 0 ? <em data-tone="live">orphan — no parent context</em> : null}
          </p>
          <ul>
            {t.spans.map((s, i) => (
              <li key={s.spanId} style={{ ["--d" as string]: profundidade(s), ["--i" as string]: i }}>
                <span className="ctxlab-bar" />
                <span className="ctxlab-span mono">
                  <b>{s.servico}</b> {s.nome}
                </span>
                {Object.keys(s.baggage).length > 0 ? <span className="ctxlab-chip mono">{Object.entries(s.baggage).map(([k, v]) => `${k}=${v}`).join(" ")}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Chave({ id, rotulo, ligado, onChange, dica }: { id: string; rotulo: string; ligado: boolean; onChange: (v: boolean) => void; dica: string }) {
  return (
    <label className="ctxlab-switch" htmlFor={id} title={dica}>
      <input id={id} type="checkbox" role="switch" checked={ligado} onChange={(e) => onChange(e.target.checked)} />
      <span className="ctxlab-switch__track" aria-hidden="true">
        <span />
      </span>
      <span>{rotulo}</span>
    </label>
  );
}

export function ContextoLab() {
  const [proxyRepassa, setProxyRepassa] = useState(true);
  const [amostrado, setAmostrado] = useState(true);
  const { filme, propagacao } = useMemo(() => filmeDoContexto({ ...OPCOES_PADRAO, proxyRepassa, amostrado }), [proxyRepassa, amostrado]);
  const views = useMemo(() => vistas(filmeDoContexto({ ...OPCOES_PADRAO, proxyRepassa, amostrado }, "topology").filme), [proxyRepassa, amostrado]);
  const inteiro = propagacao.traces.length === 1;

  return (
    <div className="ctxlab" data-testid="context-lab">
      <MotionPlayer
        film={filme}
        views={views}
        flatLabel="Sequence"
        label="Sequence diagram: a checkout request crossing six services, carrying traceparent and baggage headers on each hop."
        controls={
          <>
            <Chave id="ctx-proxy" rotulo="Proxy forwards headers" ligado={proxyRepassa} onChange={setProxyRepassa} dica="An uninstrumented proxy either forwards unknown headers or rebuilds the request without them." />
            <Chave id="ctx-sampled" rotulo="Root sampled" ligado={amostrado} onChange={setAmostrado} dica="The sampling decision at the root, carried downstream in trace-flags." />
            <output className="ctxlab-status mono" data-tone={inteiro ? "conduit" : "live"} aria-live="polite">
              {inteiro ? "1 request · 1 trace" : `1 request · ${propagacao.traces.length} traces`}
            </output>
          </>
        }
        renderDetail={(frame) => {
          const d = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="ctxlab-detail">
              <Fio detalhe={d} />
              <Arvore spans={d.spans} exportados={d.exportados} />
            </div>
          );
        }}
      />
    </div>
  );
}
