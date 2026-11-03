import type { Film, Frame } from "@ovh/motion";
import { MotionPlayer, MotionStage, type MotionView, type Clock } from "@ovh/motion/react";
import { filmeDoContexto, OPCOES_PADRAO, type DetalheDoContexto, type Foco, type SpanGerado, type Propagacao, formatTraceparent } from "@ovh/otel-domain";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

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
      id: "topology",
      label: "Topology",
      render: ({ t, label }) => <MotionStage film={topologia} t={t} label={`${label} — service topology`} />,
    },
    {
      id: "iso",
      label: "Iso",
      render: ({ t, label }) => (
        <Suspense fallback={<div className="iso-stage" aria-busy="true" />}>
          <IsoStage film={topologia} t={t} label={`${label} — service topology`} />
        </Suspense>
      ),
    },
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
            : `${c.para} ${detalhe.spans.some((s) => s.spanId === c.span?.spanId) ? "created" : "will create"} span ${c.span.spanId.slice(0, 8)}…, child of ${extraido.spanId.slice(0, 8)}….`}
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

/** O pacote em trânsito e o painel compartilham o instante, inclusive antes da chegada. */
function detalheEm(frame: Frame<DetalheDoContexto>, propagacao: Propagacao): DetalheDoContexto | undefined {
  const d = frame.detail;
  if (d === undefined || d.exportados || frame.packet?.protocol !== "HTTP") return d;
  const chamada = propagacao.chamadas.find((c) => c.de === frame.packet?.from && c.para === frame.packet.to);
  return chamada === undefined ? d : { ...d, chamada, foco: d.chamada === chamada ? d.foco : null };
}

function CabecalhoVivo({ detalhe, propagacao }: { detalhe: DetalheDoContexto; propagacao: Propagacao }) {
  const c = detalhe.chamada;
  const raiz = propagacao.raiz;
  const valor = c === null ? formatTraceparent({ traceId: raiz.traceId, spanId: raiz.spanId, sampled: raiz.amostrado }) : c.headers.traceparent;
  const partes = valor?.split("-");
  return (
    <section className="ctxlab-live" aria-label="Live trace context" data-testid="live-context">
      <div className="ctxlab-live__title">
        <span className="ctxlab-live__mark" aria-hidden="true"><IconeDoModo modo="inspector" /></span>
        <div><p className="ctxlab-h mono">{detalhe.exportados ? "Collected spans" : c === null ? "Root context" : "Request on the wire"}</p>
          <b>{detalhe.exportados ? "Services → Collector → backend" : c === null ? "Browser · click checkout" : `${c.de} → ${c.para}`}</b></div>
        <span className="ctxlab-live__count mono">{detalhe.spans.length} {detalhe.spans.length === 1 ? "span" : "spans"} {detalhe.exportados ? "processed" : "created"}</span>
      </div>
      <div className="ctxlab-live__fields mono">
        {CAMPOS.map((campo, i) => <div key={campo.foco} data-field={campo.foco} data-on={detalhe.foco === campo.foco ? "" : undefined}>
          <span>{campo.nome}</span><code>{partes?.[i] ?? "—"}</code>
        </div>)}
      </div>
      <p className="ctxlab-live__note mono" data-lost={valor === undefined ? "" : undefined}>
        {valor === undefined ? "No traceparent arrived. This receiver starts a new trace." : "trace-id connects the request · parent-id identifies the caller"}
      </p>
    </section>
  );
}

function IconeDoModo({ modo }: { modo: "showcase" | "simulation" | "inspector" }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {modo === "showcase" ? <path d="m8 4 12 8-12 8z" /> : modo === "simulation" ? <><path d="M4 7h6m4 0h6M4 17h10m4 0h2" /><circle cx="12" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></> : <><path d="M6 7v10h5m-5-5h11" /><rect x="3" y="3" width="6" height="4" rx="1" /><rect x="17" y="10" width="5" height="4" rx="1" /><rect x="11" y="15" width="7" height="4" rx="1" /></>}
  </svg>;
}

function Saltos({ filme, propagacao, detalhe, clock }: { filme: Film<DetalheDoContexto>; propagacao: Propagacao; detalhe: DetalheDoContexto; clock: Clock }) {
  return <nav className="ctxlab-hops" aria-label="Inspect a request hop">
    <span className="ctxlab-h mono">Follow the request</span>
    <div>{propagacao.chamadas.map((c, i) => {
      const pacote = filme.packets.find((p) => p.protocol === "HTTP" && p.from === c.de && p.to === c.para);
      return <button type="button" key={i} aria-label={`Inspect hop ${i + 1}: ${c.de} to ${c.para}`} aria-pressed={detalhe.chamada === c} onClick={() => { clock.pause(); clock.seek((pacote?.t ?? 0) + 10); }}>
        <span className="mono">0{i + 1}</span> {c.de} <span aria-hidden="true">→</span> {c.para}
      </button>;
    })}</div>
  </nav>;
}

function Inspetor({ detalhe }: { detalhe: DetalheDoContexto }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const spans = detalhe.exportados ? detalhe.spans.filter((s) => s.amostrado) : detalhe.spans;
  const porId = new Map(spans.map((s) => [s.spanId, s]));
  const span = spans.find((s) => s.spanId === selecionado) ?? spans.at(-1);
  const profundidade = (s: SpanGerado) => {
    let d = 0; let pai = s.parentId;
    while (pai !== null && porId.has(pai)) { d += 1; pai = porId.get(pai)!.parentId; }
    return d;
  };
  return <section className="ctxlab-inspector" aria-label="Trace inspector">
    <div className="ctxlab-inspector__tree">
      <p className="ctxlab-h mono">{detalhe.exportados ? "Exported span tree" : "Spans created so far"}</p>
      <h3>One request, seen from every service.</h3>
      <p className="ctxlab-note">Select a span to inspect its identity and parent. Rows show creation order, not measured duration.</p>
      <div className="ctxlab-spanlist" role="group" aria-label="Select a span">
        {spans.map((s, i) => <button type="button" key={s.spanId} aria-pressed={span?.spanId === s.spanId} onClick={() => setSelecionado(s.spanId)} data-orphan={s.parentId === null && i > 0 ? "" : undefined} style={{ ["--depth" as string]: profundidade(s) }}>
          <span className="ctxlab-spanlist__order mono">{String(i + 1).padStart(2, "0")}</span>
          <span className="ctxlab-spanlist__name"><b>{s.servico}</b><small className="mono">{s.nome}</small></span>
          <span className="ctxlab-spanlist__relation mono">{s.parentId === null ? i > 0 ? "new root" : "root" : "child"}</span>
        </button>)}
      </div>
      {spans.length === 0 ? <p className="ctxlab-note">No spans exported. Context still propagated with sampled = 0.</p> : null}
      <p className="ctxlab-inspector__foot mono">The proxy has no SDK. It never creates a span.</p>
    </div>
    <div className="ctxlab-inspector__properties">
      {span !== undefined ? <>
        <p className="ctxlab-h mono">Selected span</p><h3>{span.servico} <span className="mono">/ {span.nome}</span></h3>
        <dl className="ctxlab-properties mono">
          <dt>trace-id</dt><dd>{span.traceId}</dd>
          <dt>span-id</dt><dd>{span.spanId}</dd>
          <dt>parent-id</dt><dd>{span.parentId ?? "none · root span"}</dd>
          <dt>sampled</dt><dd>{span.amostrado ? "01 · yes" : "00 · no"}</dd>
        </dl>
        <p className="ctxlab-h mono">Context this span can inject</p>
        <div className="ctxlab-injected mono"><Traceparent valor={formatTraceparent({ traceId: span.traceId, spanId: span.spanId, sampled: span.amostrado })} foco={null} /></div>
        <p className="ctxlab-note">The outgoing parent-id is this span's own id. The receiver uses it to connect its child span.</p>
      </> : null}
      <Fio detalhe={detalhe} />
    </div>
  </section>;
}

export function ContextoLab() {
  const [modo, setModo] = useState<"showcase" | "simulation" | "inspector">("simulation");
  const escolherModo = (novo: typeof modo) => {
    setModo(novo);
    try { history.replaceState(null, "", `#${novo}`); } catch { /* A escolha também funciona sem histórico. */ }
  };
  useEffect(() => {
    const ler = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "showcase" || hash === "inspector" || hash === "simulation") setModo(hash);
    };
    ler(); window.addEventListener("hashchange", ler);
    return () => window.removeEventListener("hashchange", ler);
  }, []);
  const [proxyRepassa, setProxyRepassa] = useState(true);
  const [amostrado, setAmostrado] = useState(true);
  const { filme, propagacao } = useMemo(() => filmeDoContexto({ ...OPCOES_PADRAO, proxyRepassa, amostrado }), [proxyRepassa, amostrado]);
  const views = useMemo(() => vistas(filmeDoContexto({ ...OPCOES_PADRAO, proxyRepassa, amostrado }, "topology").filme), [proxyRepassa, amostrado]);
  const inteiro = propagacao.traces.length === 1;

  return (
    <div className="ctxlab" data-testid="context-lab" data-mode={modo}>
      <div className="ctxlab-modes" role="tablist" aria-label="Context lab mode">
        {([
          ["showcase", "Showcase", "Watch context travel"],
          ["simulation", "Simulation", "Change the experiment"],
          ["inspector", "Trace inspector", "Read spans and headers"],
        ] as const).map(([id, title, description]) => <button key={id} id={`ctx-mode-${id}`} type="button" role="tab" aria-selected={modo === id} aria-controls="ctx-workspace" tabIndex={modo === id ? 0 : -1} onClick={() => escolherModo(id)} onKeyDown={(e) => {
          const ids = ["showcase", "simulation", "inspector"] as const;
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault(); e.stopPropagation();
          const next = e.key === "Home" ? 0 : e.key === "End" ? 2 : (ids.indexOf(modo) + (e.key === "ArrowRight" ? 1 : 2)) % 3;
          escolherModo(ids[next]!); document.getElementById(`ctx-mode-${ids[next]}`)?.focus();
        }}><span className="ctxlab-modes__icon"><IconeDoModo modo={id} /></span><span><b>{title}</b><small>{description}</small></span></button>)}
      </div>
      <div id="ctx-workspace" role="tabpanel" aria-labelledby={`ctx-mode-${modo}`}>

      <MotionPlayer
        className={modo === "inspector" ? "ctxlab-player--inspector" : ""}
        film={filme}
        views={views}
        flatLabel="Sequence"
        packetLegend={[
          { label: "first trace", tone: "kind-1" },
          ...(propagacao.traces.length > 1 ? [{ label: "orphan trace", tone: "kind-3" as const }] : []),
          ...(propagacao.chamadas.some((c) => c.headers.traceparent === undefined) ? [{ label: "no context", tone: "live" as const }] : []),
          ...(amostrado ? [] : [{ label: "not sampled", tone: "muted" as const }]),
        ]}
        label="Sequence diagram: a checkout request crossing six services, carrying traceparent and baggage headers on each hop."
        renderHeader={(frame, clock) => {
          const d = detalheEm(frame, propagacao);
          if (d === undefined) return null;
          return <><CabecalhoVivo detalhe={d} propagacao={propagacao} />{modo !== "showcase" ? <Saltos filme={filme} propagacao={propagacao} detalhe={d} clock={clock} /> : null}</>;
        }}
        renderScreen={modo === "inspector" ? (frame) => {
          const d = detalheEm(frame, propagacao);
          return d === undefined ? null : <Inspetor detalhe={d} />;
        } : undefined}
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
          const d = detalheEm(frame, propagacao);
          if (d === undefined || modo === "inspector") return null;
          return (
            <div className="ctxlab-detail">
              <Fio detalhe={d} />
              <Arvore spans={d.spans} exportados={d.exportados} />
            </div>
          );
        }}
      />
      </div>
    </div>
  );
}
