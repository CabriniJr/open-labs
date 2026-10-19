import { localeReady } from "../lib/i18n.js";
import { useEffect, useRef, useState } from "react";
import { InteractiveSession } from "@ovh/interactive-core";
import {
  AVAILABLE_IMAGES, clusterSummary, DEPLOYMENT_MANIFEST, EXPERIMENTS,
  nodeResources, parseManifest, POD_LIFECYCLE_MODEL,
} from "@ovh/kubernetes-domain";
import type { ClusterAction, ClusterState, Pod } from "@ovh/kubernetes-domain";

function newSession() {
  const session = new InteractiveSession(POD_LIFECYCLE_MODEL, 600);
  const parsed = parseManifest(DEPLOYMENT_MANIFEST);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  session.dispatch({ type: "apply", workload: parsed.value, source: DEPLOYMENT_MANIFEST });
  for (let i = 0; i < 3; i += 1) session.dispatch({ type: "tick" });
  return session;
}

function Gauge({ label, reserved, total, unit }: { label: string; reserved: number; total: number; unit: string }) {
  return <div className="podlab-gauge">
    <div><span>{label}</span><b>{total - reserved}<small> / {total} {unit} free</small></b></div>
    <meter aria-label={`${label} reserved`} min={0} max={total} value={reserved} />
    <p>{reserved} {unit} reserved by requests</p>
  </div>;
}

const stateClass = (pod: Pod): string => pod.deletionAt !== null ? "terminating" : pod.ready ? "ready" : pod.reason === "CrashLoopBackOff" || pod.reason === "ImagePullBackOff" || pod.phase === "Failed" ? "error" : "pending";

/** Relações de propriedade/alocação. Nenhuma aresta é um fluxo de mensagens. */
function ResourceTree({ state, selected, onSelect }: { state: Readonly<ClusterState>; selected: string | null; onSelect: (id: string) => void }) {
  const w = state.workload;
  if (!w) return <div className="podlab-empty">Apply a manifest to create the first resource.</div>;
  const h = Math.max(280, state.pods.length * 91 + 36);
  const revisions = [...new Set([state.revision, ...state.pods.map((p) => p.revision)])];
  const center = (revision: number) => {
    const indexes = state.pods.map((p, i) => p.revision === revision ? i : -1).filter((i) => i >= 0);
    return indexes.length ? 54 + ((indexes[0]! + indexes.at(-1)!) / 2) * 91 : 54;
  };
  return <div className="podlab-tree-scroll" tabIndex={0} aria-label="Resource ownership graph">
    <div className="podlab-tree" style={{ height: h }}>
      <svg className="podlab-edges" viewBox={`0 0 850 ${h}`} aria-hidden="true">
        {w.kind === "Deployment" && revisions.map((r) => <path key={`owner-${r}`} d={`M 195 110 H 217 V ${center(r)} H 245`} />)}
        {state.pods.map((p, i) => <path key={p.uid} d={w.kind === "Deployment" ? `M 425 ${center(p.revision)} H 455 V ${54 + i * 91} H 490` : `M 195 110 H 330 V ${54 + i * 91} H 490`} />)}
      </svg>
      <div className="podlab-resource podlab-owner" style={{ left: 15, top: 70 }}>
        <span className="podlab-resource-icon">{w.kind === "Deployment" ? "D" : "Y"}</span>
        <div><small>{w.kind === "Deployment" ? "Deployment" : "Applied manifest"}</small><strong>{w.name}</strong><span>{w.kind === "Deployment" ? `${w.replicas} desired · Recreate` : "Pod · no controller"}</span></div>
      </div>
      {w.kind === "Deployment" && revisions.map((r) => <div key={r} className="podlab-resource podlab-replicaset" style={{ left: 245, top: center(r) - 40 }}>
        <span className="podlab-resource-icon">RS</span><div><small>ReplicaSet</small><strong>{w.name}-r{r}</strong><span>{r === state.revision ? "current revision" : "retiring revision"}</span></div>
      </div>)}
      {state.pods.map((p, i) => <button key={p.uid} type="button" className="podlab-resource podlab-pod" data-status={stateClass(p)} data-selected={selected === p.uid} data-pod={p.uid} style={{ left: 490, top: 14 + i * 91 }} onClick={() => onSelect(p.uid)}>
        <span className="podlab-resource-icon">{p.ready ? "✓" : p.reason === "CrashLoopBackOff" ? "↻" : "◇"}</span>
        <span><small>Pod <span className="podlab-node-tag">{p.node ?? "unassigned"}</span></small><strong>{p.name}</strong><span className="podlab-status">{p.reason} <span>· {p.ready ? "1/1" : "0/1"} ready</span></span></span>
      </button>)}
      {state.pods.length === 0 && <div className="podlab-no-pods">{w.replicas === 0 ? "Scaled to zero. No Pods requested." : state.standaloneDeleted ? "Pod deleted. No controller will replace it." : "Waiting for the next reconciliation step."}</div>}
    </div>
  </div>;
}

export function PodLifecycleLab() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [session] = useState(newSession);
  const [state, setState] = useState<Readonly<ClusterState>>(session.state);
  const [source, setSource] = useState(DEPLOYMENT_MANIFEST);
  const [playing, setPlaying] = useState(false);
  const [experiment, setExperiment] = useState("healthy");
  const [selected, setSelected] = useState<string | null>(null);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [message, setMessage] = useState("Two replicas are ready. Change the manifest, then apply it.");
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const dispatch = (event: ClusterAction) => {
    try { setState(session.dispatch(event)); setErrors([]); }
    catch (e) { setErrors([e instanceof Error ? e.message : "Transition failed."]); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      try { setState(session.dispatch({ type: "tick" })); }
      catch (e) { setPlaying(false); setErrors([e instanceof Error ? e.message : "Experiment stopped."]); }
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, session]);

  const apply = () => {
    const result = parseManifest(source);
    if (!result.ok) { setErrors(result.errors); setMessage("Manifest rejected. The running experiment is unchanged."); return; }
    try {
      setState(session.dispatch({ type: "apply", workload: result.value, source }));
      setErrors([]); setMessage("Desired state applied. Run or step to watch reconciliation.");
    } catch (e) { setErrors([e instanceof Error ? e.message : "Apply failed."]); }
  };

  const load = () => {
    const example = EXPERIMENTS.find((x) => x.id === experiment)!;
    const result = parseManifest(example.manifest);
    if (!result.ok) return;
    session.reset();
    setState(session.dispatch({ type: "apply", workload: result.value, source: example.manifest }));
    setSource(example.manifest); setPlaying(false); setSelected(null); setErrors([]);
    setMessage(`${example.hint} Run or step to start this new experiment.`);
  };

  const seek = (position: number) => {
    const snapshot = session.seek(position);
    setState(snapshot); setSource(snapshot.source || DEPLOYMENT_MANIFEST); setPlaying(false); setErrors([]);
    setMessage("Historical snapshot. Editing here starts a new experiment branch.");
  };

  const download = () => {
    const link = downloadRef.current;
    if (!link) return;
    const uri = URL.createObjectURL(new Blob([source], { type: "text/yaml" }));
    link.href = uri; link.download = "pod-lifecycle.yaml"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(uri), 0);
  };

  const summary = clusterSummary(state);
  const nodes = nodeResources(state);
  const pod = state.pods.find((p) => p.uid === selected) ?? state.pods[0];
  const dirty = source !== state.source;
  const degraded = state.pods.some((p) => p.reason === "CrashLoopBackOff" || p.reason === "ImagePullBackOff" || p.phase === "Failed");
  const settled = state.workload !== null && summary.ready === summary.desired && state.pods.every((p) => p.deletionAt === null);
  const health = degraded ? "Degraded" : settled ? "Healthy" : "Progressing";

  return <div ref={localeReady} className="podlab" data-testid="pod-lifecycle-lab" data-hydrated={hydrated}>
    <div className="podlab-topbar">
      <div className="podlab-brand"><span className="podlab-kube" aria-hidden="true">⎈</span><div><strong>Pod lifecycle</strong><small>LOCAL SANDBOX / DEFAULT NAMESPACE</small></div></div>
      <div className="podlab-badges"><span data-health={health} className="podlab-health">● {health}</span><span className="podlab-sync">{dirty ? "Unapplied changes" : "Manifest applied"}</span></div>
    </div>
    <div className="podlab-toolbar">
      <div><label htmlFor="pod-experiment" className="sr-only">Experiment</label><select id="pod-experiment" value={experiment} onChange={(e) => setExperiment(e.target.value)}>{EXPERIMENTS.map((x) => <option value={x.id} key={x.id}>{x.title}</option>)}</select><button onClick={load}>Load experiment</button></div>
      <div><span className="podlab-clock mono" data-testid="simulation-time">t = {state.tick}s</span><button onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pause" : "Run"}</button><button onClick={() => dispatch({ type: "tick" })}>Next step</button></div>
    </div>
    <div className="podlab-workspace">
      <section className="podlab-editor" aria-label="Manifest editor">
        <div className="podlab-panel-title"><span className="mono">pod-lifecycle.yaml</span><span>DESIRED</span></div>
        <label className="sr-only" htmlFor="pod-manifest">Kubernetes manifest</label>
        <textarea id="pod-manifest" spellCheck={false} value={source} onChange={(e) => setSource(e.target.value)} wrap="off" />
        <div className="podlab-editor-actions"><button className="podlab-primary" onClick={apply}>Apply manifest</button><button onClick={download}>Download YAML</button><a ref={downloadRef} hidden aria-hidden="true" /></div>
        <p className="podlab-editor-note">Edit <code>replicas</code>, <code>requests</code>, <code>limits</code> or <code>image</code>. Changes take effect after Apply.</p>
      </section>
      <div className="podlab-observed">
        <div className="podlab-stats">
          <div><small>Ready / desired</small><strong data-testid="ready-count">{summary.ready}<span> / {summary.desired}</span></strong></div>
          <div><small>Pending</small><strong data-testid="pending-count">{summary.pending}</strong></div>
          <div><small>CPU available</small><strong data-testid="cpu-available">{summary.cpuAvailable}<span> m</span></strong></div>
          <div><small>Memory available</small><strong>{summary.memoryAvailable}<span> Mi</span></strong></div>
        </div>
        <section className="podlab-graph-panel" aria-label="Observed resources">
          <div className="podlab-panel-title"><span>Resource tree</span><span>OBSERVED</span></div>
          <ResourceTree state={state} selected={pod?.uid ?? null} onSelect={setSelected} />
          <p className="podlab-graph-key"><span>─ ownership</span><span>Node badge = scheduling assignment</span><span>Click a Pod to inspect it</span></p>
        </section>
        <div className="podlab-node-grid">
          {nodes.map((n) => <section key={n.id} className="podlab-node" aria-label={n.id}>
            <div className="podlab-panel-title"><strong>▣ {n.id}</strong><span>ALLOCATABLE</span></div>
            <Gauge label="CPU" reserved={n.cpuReserved} total={n.cpu} unit="m" />
            <Gauge label="Memory" reserved={n.memoryReserved} total={n.memory} unit="Mi" />
          </section>)}
        </div>
      </div>
    </div>
    {errors.length > 0 && <div className="podlab-errors" role="alert"><strong>Cannot apply this change</strong><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
    <p className="podlab-message" role="status">{message}</p>
    <div className="podlab-details">
      <section className="podlab-inspector" aria-label="Pod inspector">
        <div className="podlab-panel-title"><span>Pod details</span><span>{pod?.uid ?? "NO POD"}</span></div>
        {pod ? <>
          <h3>{pod.name}</h3>
          <dl><div><dt>API phase</dt><dd>{pod.phase}</dd></div><div><dt>Display status</dt><dd>{pod.reason}</dd></div><div><dt>Node</dt><dd>{pod.node ?? "Not scheduled"}</dd></div><div><dt>Container restarts</dt><dd data-testid="restart-count">{pod.restarts}</dd></div><div><dt>Last termination</dt><dd>{pod.lastTermination ?? "None"}</dd></div><div><dt>Requests</dt><dd>{pod.spec.cpuRequest}m / {pod.spec.memoryRequest}Mi</dd></div><div><dt>Limits</dt><dd>{pod.spec.cpuLimit === null ? "none" : `${pod.spec.cpuLimit}m`} / {pod.spec.memoryLimit === null ? "none" : `${pod.spec.memoryLimit}Mi`}</dd></div></dl>
          <p className="podlab-inspector-note">{pod.reason === "Unschedulable" ? "Requests must fit on one node. Free capacity on different nodes cannot be combined." : pod.reason === "CrashLoopBackOff" ? "The container failed. The Pod keeps its UID, its node and its reservation during restart backoff." : pod.reason === "ImagePullBackOff" ? "Scheduled does not mean Running. The container image is unavailable in this simulated catalog." : state.workload?.kind === "Pod" ? "No owner: deleting this Pod will not create a replacement." : "Its ReplicaSet replaces a deleted Pod with a new UID. A container restart keeps the existing UID."}</p>
          <button disabled={pod.deletionAt !== null} onClick={() => dispatch({ type: "delete-pod", uid: pod.uid })}>Delete selected Pod</button>
        </> : <p>No Pod exists in this snapshot.</p>}
      </section>
      <section className="podlab-events" aria-label="Cluster events">
        <div className="podlab-panel-title"><span>Events</span><span>FROM THE MODEL</span></div>
        <div className="podlab-event-list">{[...state.events].reverse().map((e, i) => <div className="podlab-event" key={`${e.tick}-${i}`}><time className="mono">{e.tick}s</time><div><strong>{e.reason}</strong><small>{e.resource}</small><p>{e.detail}</p></div></div>)}</div>
      </section>
    </div>
    <div className="podlab-bottom">
      <section className="podlab-load" aria-label="Synthetic workload">
        <h3>Synthetic workload <small>per running container</small></h3>
        <label>CPU demand <output>{state.cpuDemand}m</output><input aria-label="CPU demand" type="range" min="0" max="2000" step="50" value={state.cpuDemand} onChange={(e) => dispatch({ type: "load", cpu: Number(e.target.value), memory: state.memoryDemand })} /></label>
        <label>Memory working set <output>{state.memoryDemand} Mi</output><input aria-label="Memory working set" type="range" min="64" max="1024" step="32" value={state.memoryDemand} onChange={(e) => dispatch({ type: "load", cpu: state.cpuDemand, memory: Number(e.target.value) })} /></label>
        <p>{pod && pod.spec.cpuLimit !== null && state.cpuDemand > pod.spec.cpuLimit ? "CPU demand exceeds the limit: throttled, not killed." : "CPU under the limit. Requests reserve capacity; limits constrain runtime."}</p>
      </section>
      <section className="podlab-history" aria-label="Experiment history"><h3>Replay the experiment</h3><label>History step <output>{session.cursor} / {session.length}</output><input aria-label="History step" type="range" min="0" max={session.length} value={session.cursor} onChange={(e) => seek(Number(e.target.value))} /></label><p>Each clock tick advances one simulated second. History also includes edits. Rewind preserves UIDs, events and applied manifests. The timings are didactic.</p></section>
    </div>
    <p className="podlab-limits">Local simulation · no cluster connected. Two fixed 2-CPU / 2-Gi nodes; first-fit placement. Image catalog: {AVAILABLE_IMAGES.join(", ")}. Recreate strategy, one container per Pod. No HPA, node autoscaling, probes, networking or node-pressure eviction.</p>
  </div>;
}
