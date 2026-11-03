import { frameAt, type Film, type Frame } from "@ovh/motion";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { IsoScene, type IsoOptions } from "./IsoScene.js";

export interface IsoStageProps<D> {
  readonly film: Film<D>;
  readonly t: number;
  readonly frame?: Frame<D>;
  readonly label: string;
  readonly className?: string;
  readonly options?: IsoOptions;
  readonly projection?: "orthographic" | "perspective";
  readonly selected?: string | null;
  readonly onSelect?: (id: string) => void;
  readonly selectableIds?: ReadonlySet<string>;
}

/** One model frame, two lenses. The renderer stays lazy and draws on demand. */
export function IsoStage<D>({ film, t, frame, label, className, options, projection = "orthographic", selected = null, onSelect, selectableIds }: IsoStageProps<D>) {
  const host = useRef<HTMLDivElement | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const scene = useRef<IsoScene | null>(null);
  const gesture = useRef<{ x: number; y: number; previousX: number; previousY: number; moved: boolean; pan: boolean } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [contents, setContents] = useState(false);
  const [full, setFull] = useState(false);
  const current = useMemo(() => frame ?? frameAt(film, t), [film, t, frame]);
  const parts = current.entities.filter(e => e.state.opacity > .05 && e.spec.type !== "custom" && (e.state.label || e.spec.title) && (!selectableIds || selectableIds.has(e.spec.id)));

  useEffect(() => {
    if (!host.current) return;
    try { scene.current = new IsoScene(host.current, options); setReady(true); }
    catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
    return () => { scene.current?.dispose(); scene.current = null; };
    // Options define the lifetime of the renderer, not the current model frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { scene.current?.setFilm(film as Film<unknown>); }, [film]);
  useEffect(() => { scene.current?.update(current as Frame<unknown>); }, [current]);
  useEffect(() => { scene.current?.projetar(projection); }, [projection]);
  useEffect(() => { scene.current?.selecionar(selected); }, [selected, film]);
  useEffect(() => {
    const change = () => setFull(document.fullscreenElement === viewport.current);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);

  const reset = () => { scene.current?.reenquadrar(); setZoom(1); };
  const scale = (factor: number) => setZoom(scene.current?.aproximar(factor) ?? 1);
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0", "Home"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "0" || event.key === "Home") reset();
    if (event.key === "+" || event.key === "=") scale(1.2);
    if (event.key === "-") scale(1 / 1.2);
    const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (event.shiftKey) scene.current?.deslocar(dx * 24, dy * 24);
    else scene.current?.orbitar(dx * .12, -dy * .08);
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, previousX: event.clientX, previousY: event.clientY, moved: false, pan: event.shiftKey };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return <div className="iso-viewport" ref={viewport}>
    <div className="iso-toolbar" role="group" aria-label="3D camera controls">
      <span className="mono">{projection === "perspective" ? "PERSPECTIVE" : "ISOMETRIC"}</span>
      <output aria-label="Camera zoom" className="mono">{Math.round(zoom * 100)}%</output>
      <button type="button" aria-label="Zoom out in 3D" disabled={!ready} onClick={() => scale(1 / 1.2)}>−</button>
      <button type="button" aria-label="Zoom in 3D" disabled={!ready} onClick={() => scale(1.2)}>+</button>
      <button type="button" disabled={!ready} onClick={reset}>Reset camera</button>
      <button type="button" aria-label={full ? "Exit 3D full screen" : "3D full screen"} aria-pressed={full} onClick={async () => {
        try { if (document.fullscreenElement === viewport.current) await document.exitFullscreen(); else if (viewport.current?.requestFullscreen) await viewport.current.requestFullscreen(); else setFailure("Full screen is unavailable. The scene remains interactive."); }
        catch { setFailure("Full screen is unavailable. The scene remains interactive."); }
      }}>⛶</button>
    </div>
    <div ref={host} className={["iso-stage", className].filter(Boolean).join(" ")} role="img" tabIndex={0}
      aria-label={`${label} (${projection === "perspective" ? "3D perspective" : "isometric view"}; drag to rotate, shift-drag to pan, double-click to reset)`}
      data-projection={projection} data-ready={ready} data-falhou={!ready && failure ? "" : undefined} onKeyDown={key} onPointerDown={down}
      onPointerMove={event => {
        const g = gesture.current; if (!g) return;
        if (!g.moved && Math.hypot(event.clientX - g.x, event.clientY - g.y) < 4) return;
        g.moved = true;
        const dx = event.clientX - g.previousX, dy = event.clientY - g.previousY;
        if (g.pan) scene.current?.deslocar(dx, dy); else scene.current?.orbitar(-dx * .006, dy * .004);
        g.previousX = event.clientX; g.previousY = event.clientY;
      }}
      onPointerUp={event => {
        const g = gesture.current; gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (g && !g.moved) { const id = scene.current?.escolher(event.clientX, event.clientY, selectableIds); if (id) onSelect?.(id); }
      }}
      onPointerCancel={() => { gesture.current = null; }} onDoubleClick={reset} />
    {failure && <p className="iso-feedback" role="status">{ready ? failure : `3D view unavailable in this browser. Use the flat view. ${failure}`}</p>}
    <div className="iso-status"><span>Drag to orbit · Shift + drag to pan · + / − zoom · 0 reset</span>{onSelect && <button type="button" aria-expanded={contents} onClick={() => setContents(!contents)}>Inspect scene</button>}</div>
    {contents && onSelect && <div className="iso-contents" aria-label="3D scene resources">{parts.map(({ spec, state }) => <button key={spec.id} type="button" aria-label={spec.title || undefined} title={spec.title} aria-pressed={selected === spec.id} onClick={() => onSelect(spec.id)}><strong>{state.label || spec.title}</strong>{state.sublabel && <span>{state.sublabel}</span>}</button>)}</div>}
  </div>;
}
