import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clamp, DEFAULT_CAMERA, projector, type Point3, type SpatialCamera, type SpatialMode, type SpatialScene } from "./spatial.js";

export interface SceneViewportProps {
  readonly scene: SpatialScene | (() => SpatialScene); readonly label: string; readonly children: ReactNode;
  readonly selected?: string | null | undefined; readonly onSelect?: ((id: string) => void) | undefined;
  readonly onOpen?: ((id: string) => void) | undefined;
  readonly onSelectMarker?: ((id: string) => void) | undefined;
  readonly canvasClassName?: string | undefined;
  readonly allowFullscreen?: boolean | undefined;
}

/** SVG remains the accessible default. Spatial views project the very same state,
 * with orthographic or perspective cameras and solid, depth-sorted geometry. */
export function SceneViewport({ scene: source, label, children, selected, onSelect, onOpen, onSelectMarker, canvasClassName, allowFullscreen = true }: SceneViewportProps) {
  const [mode, setMode] = useState<SpatialMode>("2d");
  const [camera, setCamera] = useState<SpatialCamera>(DEFAULT_CAMERA);
  const [help, setHelp] = useState(false);
  const [full, setFull] = useState(false);
  const [notice, setNotice] = useState("");
  const [contents, setContents] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const markerElements = useRef(new Map<string, SVGGElement>());
  const gesture = useRef<{ x: number; y: number; camera: SpatialCamera; pan: boolean; moved: boolean } | null>(null);
  useEffect(() => {
    const changed = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const update = (patch: Partial<SpatialCamera>) => setCamera(c => ({ ...c, ...patch }));
  const scene = useMemo<SpatialScene>(() => mode === "2d" ? { width: 1, height: 1, nodes: [], paths: [], markers: [] } : typeof source === "function" ? source() : source, [source, mode]);
  const project = projector(scene.width, scene.height, camera, mode === "3d");
  const points = (ps: readonly Point3[]) => ps.map(p => { const q = project(p); return `${q.x},${q.y}`; }).join(" ");
  const reset = () => setCamera(DEFAULT_CAMERA);
  const spatial = mode !== "2d";
  const grid = Array.from({ length: 13 }, (_, i) => i / 12);
  useEffect(() => {
    if (!spatial) return;
    try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch { /* Embedded hosts can omit matchMedia. */ }
    const moving = scene.markers?.filter(m => m.next && (m.duration ?? 0) > 0) ?? [];
    if (!moving.length) return;
    const started = scene.startedAt ?? performance.now();
    let request = 0;
    const draw = (now: number) => {
      let unfinished = false;
      for (const marker of moving) {
        const p = clamp((now - started) / marker.duration!, 0, 1);
        unfinished ||= p < 1;
        const to = marker.next!;
        const origin = project(marker);
        const current = project({ x: marker.x + (to.x - marker.x) * p, y: marker.y + (to.y - marker.y) * p, z: (marker.z ?? 0) + ((to.z ?? 0) - (marker.z ?? 0)) * p });
        markerElements.current.get(marker.id)?.setAttribute("transform", `translate(${current.x - origin.x} ${current.y - origin.y})`);
      }
      if (unfinished) request = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(request);
  }, [scene, camera, mode]);
  return (
    <div className="scene-viewport" ref={root} data-mode={mode}>
      <div className="scene-toolbar">
        <div className="scene-modes" role="group" aria-label="View mode">
          {([['2d', '2D'], ['isometric', 'Isometric'], ['3d', '3D']] as const).map(([value, text]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); reset(); }}>{text}</button>)}
        </div>
        <span className="scene-toolbar__label mono">{spatial ? "SPATIAL VIEW" : "DIAGRAM VIEW"}</span>
        <div className="scene-tools">
          {spatial && <><button type="button" aria-label="Zoom out" onClick={() => update({ zoom: clamp(camera.zoom / 1.2, .5, 4) })}>−</button><button type="button" aria-label="Zoom in" onClick={() => update({ zoom: clamp(camera.zoom * 1.2, .5, 4) })}>+</button><button type="button" onClick={reset}>Reset view</button></>}
          <button type="button" aria-label="View instructions" aria-expanded={help} onClick={() => setHelp(!help)}>?</button>
          {allowFullscreen && <button type="button" aria-label={full ? "Exit viewport full screen" : "Viewport full screen"} onClick={async () => {
            try { if (document.fullscreenElement === root.current) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else setNotice("Full screen is unavailable in this browser."); } catch { setNotice("Full screen is unavailable in this browser."); }
          }}>⛶</button>}
        </div>
      </div>
      {help && <div className="scene-help">{spatial ? "Drag to orbit in 3D or pan in Isometric. Shift + drag pans. Use + / − to zoom, arrow keys to move the camera, and 0 to reset. Select a part to inspect it; double-click or press Enter to open it." : "Select a part to inspect it. Double-click to open it. Scroll over the diagram to zoom and drag to pan. Switch to Isometric or 3D to explore the same state in space."}</div>}
      {notice && <p className="scene-help" role="status">{notice}</p>}
      <div className={["scene-canvas", canvasClassName].filter(Boolean).join(" ")}>
      <div className="scene-planar" hidden={spatial}>{children}</div>
      {spatial && <svg className="scene-spatial" viewBox="0 0 1000 600" role="img" aria-label={label} tabIndex={0}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
          if (e.key === "0") reset();
          if (e.key === "+" || e.key === "=") update({ zoom: clamp(camera.zoom * 1.2, .5, 4) });
          if (e.key === "-") update({ zoom: clamp(camera.zoom / 1.2, .5, 4) });
          if (e.key === "ArrowLeft") update(mode === "3d" ? { yaw: camera.yaw - .12 } : { panX: camera.panX - 25 });
          if (e.key === "ArrowRight") update(mode === "3d" ? { yaw: camera.yaw + .12 } : { panX: camera.panX + 25 });
          if (e.key === "ArrowUp") update(mode === "3d" ? { tilt: clamp(camera.tilt + .08, .15, 1.35) } : { panY: camera.panY - 25 });
          if (e.key === "ArrowDown") update(mode === "3d" ? { tilt: clamp(camera.tilt - .08, .15, 1.35) } : { panY: camera.panY + 25 });
        }}
        onPointerDown={e => { if (e.button !== 0) return; dragged.current = false; gesture.current = { x: e.clientX, y: e.clientY, camera, pan: e.shiftKey || mode === "isometric", moved: false }; }}
        onPointerMove={e => {
          const g = gesture.current; if (!g) return;
          const dx = e.clientX - g.x, dy = e.clientY - g.y;
          if (Math.hypot(dx, dy) < 4 && !g.moved) return;
          g.moved = true; e.currentTarget.setPointerCapture(e.pointerId);
          const ratio = 1000 / Math.max(1, e.currentTarget.getBoundingClientRect().width);
          setCamera({ ...g.camera, ...(g.pan ? { panX: g.camera.panX + dx * ratio, panY: g.camera.panY + dy * ratio } : { yaw: g.camera.yaw + dx * .008, tilt: clamp(g.camera.tilt + dy * .006, .15, 1.35) }) });
        }}
        onPointerUp={e => { dragged.current = gesture.current?.moved ?? false; gesture.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={() => { gesture.current = null; dragged.current = false; }}
        onClickCapture={e => { if (dragged.current && e.detail > 0) { e.stopPropagation(); e.preventDefault(); } dragged.current = false; }}>
        <polygon className="scene-floor" points={points([{ x: 0, y: 0 }, { x: scene.width, y: 0 }, { x: scene.width, y: scene.height }, { x: 0, y: scene.height }])} />
        <g className="scene-grid">{grid.map(v => <g key={v}><polyline points={points([{ x: scene.width * v, y: 0 }, { x: scene.width * v, y: scene.height }])} /><polyline points={points([{ x: 0, y: scene.height * v }, { x: scene.width, y: scene.height * v }])} /></g>)}</g>
        {scene.paths.map(path => {
          const tip = path.points.at(-1), previous = path.points.at(-2);
          const end = tip && project(tip), before = previous && project(previous);
          const angle = end && before ? Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI : 0;
          return <g key={path.id} data-tone={path.tone} className="scene-path" opacity={path.opacity ?? 1}>
            <polyline points={points(path.points)} strokeDasharray={path.dashed ? "5 5" : undefined} />
            {path.arrow && end && before && Math.hypot(end.x - before.x, end.y - before.y) > .01 && <path className="scene-path__arrow" d="M0 0 L-8 -4 L-8 4 Z" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} />}
            {path.label && path.points.length > 0 && (() => { const p = project(path.points[Math.floor(path.points.length / 2)]!); return <text x={p.x} y={p.y - 7}>{path.label}</text>; })()}
          </g>;
        })}
        {[...scene.nodes].sort((a, b) => Number(!!b.frame) - Number(!!a.frame) || project(b).depth - project(a).depth).map(node => {
          const z = node.elevation ?? Math.max(12, Math.min(36, node.h * .35));
          const base = [{ x: node.x, y: node.y }, { x: node.x + node.w, y: node.y }, { x: node.x + node.w, y: node.y + node.h }, { x: node.x, y: node.y + node.h }];
          const top = base.map(p => ({ ...p, z }));
          const center = project({ x: node.x + node.w / 2, y: node.y + (node.frame ? 10 : node.h / 2), z });
          return <g key={node.id} className="scene-node" data-id={node.id} data-tone={node.tone} data-frame={node.frame || undefined} data-active={node.active || undefined} data-selected={selected === node.id || undefined} opacity={node.opacity ?? 1}
            role={onSelect || onOpen ? "button" : undefined} tabIndex={onSelect || onOpen ? 0 : undefined} aria-label={node.sublabel ? `${node.label}: ${node.sublabel}` : node.label}
            onClick={() => onSelect?.(node.id)} onDoubleClick={() => onOpen?.(node.id)} onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (e.key === "Enter" && onOpen) onOpen(node.id); else onSelect?.(node.id); } }}>
            <title>{node.label}{node.sublabel ? ` · ${node.sublabel}` : ""}</title>
            {!node.frame && base.map((p, i) => [Math.cos(camera.yaw), -Math.sin(camera.yaw), -Math.cos(camera.yaw), Math.sin(camera.yaw)][i]! > 0 ? <polygon key={i} className="scene-node__side" points={points([p, base[(i + 1) % 4]!, top[(i + 1) % 4]!, top[i]!])} /> : null)}
            <polygon className="scene-node__top" points={points(top)} />
            <text className="scene-node__label" x={center.x} y={center.y - (node.sublabel ? 5 : 0)}>{node.label}</text>
            {node.sublabel && <text className="scene-node__sub" x={center.x} y={center.y + 12}>{node.sublabel}</text>}
          </g>;
        })}
        {scene.markers?.map(m => { const p = project(m); return <g key={m.id} ref={element => { if (element) markerElements.current.set(m.id, element); else markerElements.current.delete(m.id); }} className="scene-marker" data-tone={m.tone} opacity={m.opacity ?? 1} role={onSelectMarker ? "button" : undefined} tabIndex={onSelectMarker ? 0 : undefined} aria-label={onSelectMarker ? `Follow ${m.label || "item"}` : undefined} onClick={() => onSelectMarker?.(m.id)} onKeyDown={e => { if (onSelectMarker && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); onSelectMarker(m.id); } }}><circle className="scene-marker__hit" cx={p.x} cy={p.y} r={20} /><circle className="scene-marker__halo" cx={p.x} cy={p.y} r={12} /><circle cx={p.x} cy={p.y} r={5} />{m.label && <text x={p.x} y={p.y - 17}>{m.label}</text>}</g>; })}
      </svg>}
      </div>
      {spatial && <><div className="scene-status mono"><span>{mode === "3d" ? "Perspective · drag to orbit" : "Orthographic · drag to pan"}</span><span>{Math.round(camera.zoom * 100)}% · same model, same state</span><button type="button" aria-expanded={contents} onClick={() => setContents(!contents)}>Scene contents {contents ? "−" : "+"}</button></div>{contents && <div className="scene-contents" aria-label="Scene contents">{scene.nodes.map(n => <div key={n.id}><button type="button" aria-pressed={selected === n.id} onClick={() => onSelect?.(n.id)} disabled={!onSelect}>{n.label || "Part"}{n.sublabel && <span>{n.sublabel}</span>}</button>{onOpen && <button type="button" aria-label={`Open ${n.label}`} onClick={() => onOpen(n.id)}>↗</button>}</div>)}</div>}</>}
    </div>
  );
}
