import { frameAt, type Film, type Frame } from "@ovh/motion";
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { IsoScene, type IsoOptions } from "./IsoScene.js";

export interface IsoStageProps<D> {
  readonly film: Film<D>;
  readonly t: number;
  readonly frame?: Frame<D>;
  readonly label: string;
  readonly className?: string;
  readonly options?: IsoOptions;
}

/** Câmera manual sobre a câmera do filme: trocar capítulo preserva a exploração. */
export function IsoStage<D>({ film, t, frame, label, className, options }: IsoStageProps<D>) {
  const host = useRef<HTMLDivElement | null>(null);
  const cena = useRef<IsoScene | null>(null);
  const pontos = useRef(new Map<number, { x: number; y: number }>());
  const [modo, setModo] = useState<"orbit" | "pan">("orbit");
  const [falhou, setFalhou] = useState<string | null>(null);

  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    try {
      cena.current = new IsoScene(el, options);
    } catch (e) {
      setFalhou(e instanceof Error ? e.message : String(e));
      return;
    }
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cena.current?.ampliar(Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.002));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => {
      el.removeEventListener("wheel", roda);
      cena.current?.dispose();
      cena.current = null;
    };
    // As opções valem para a vida da cena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cena.current?.setFilm(film as Film<unknown>); }, [film]);
  useEffect(() => { cena.current?.update((frame ?? frameAt(film, t)) as Frame<unknown>); }, [film, t, frame]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") !== null || (e.button !== 0 && e.button !== 1)) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    pontos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const antes = pontos.current.get(e.pointerId);
    if (antes === undefined) return;
    const dx = e.clientX - antes.x;
    const dy = e.clientY - antes.y;
    const outro = [...pontos.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
    if (outro !== undefined) {
      const d0 = Math.hypot(antes.x - outro.x, antes.y - outro.y);
      const d1 = Math.hypot(e.clientX - outro.x, e.clientY - outro.y);
      if (d0 > 4) cena.current?.ampliar(d1 / d0);
      cena.current?.deslocar(dx / 2, dy / 2);
    } else if (modo === "pan" || e.shiftKey || e.buttons === 4) cena.current?.deslocar(dx, dy);
    else cena.current?.orbitar(-dx * 0.006, dy * 0.004);
    pontos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const soltar = (e: PointerEvent<HTMLDivElement>) => { pontos.current.delete(e.pointerId); };
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const setas: Record<string, [number, number]> = { ArrowLeft: [24, 0], ArrowRight: [-24, 0], ArrowUp: [0, 24], ArrowDown: [0, -24] };
    const d = setas[e.key];
    if (d !== undefined) {
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) cena.current?.orbitar(d[0] * 0.006, d[1] * 0.004);
      else cena.current?.deslocar(...d);
    } else if (["+", "=", "-", "0"].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "0") cena.current?.reenquadrar();
      else cena.current?.ampliar(e.key === "-" ? 1 / 1.2 : 1.2);
    }
  };

  return (
    <div className="iso-view">
    <div ref={host} className={["iso-stage", className].filter(Boolean).join(" ")} role="group" tabIndex={0}
      aria-label={`${label} (3D view; drag to orbit, shift-drag to pan, scroll to zoom; arrow keys pan, shift-arrows orbit, plus/minus zoom, 0 resets)`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={soltar} onPointerCancel={soltar} onLostPointerCapture={soltar}
      onKeyDown={teclado} onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button")) cena.current?.reenquadrar(); }} data-falhou={falhou === null ? undefined : ""}>
      {falhou !== null ? <p className="iso-stage__falha">3D view unavailable in this browser ({falhou}). Use the flat view.</p> : null}
    </div>
    <div className="iso-stage__footer">
      <p className="iso-stage__hint mono" aria-hidden="true">{modo === "pan" ? "drag to pan" : "drag to orbit"} · scroll / pinch to zoom</p>
      <div className="iso-stage__tools" role="group" aria-label="3D camera">
        <button type="button" aria-pressed={modo === "orbit"} onClick={() => setModo("orbit")}>Orbit</button>
        <button type="button" aria-pressed={modo === "pan"} onClick={() => setModo("pan")}>Pan</button>
        <span aria-hidden="true" />
        <button type="button" aria-label="Zoom out" onClick={() => cena.current?.ampliar(1 / 1.25)}>−</button>
        <button type="button" aria-label="Zoom in" onClick={() => cena.current?.ampliar(1.25)}>+</button>
        <button type="button" aria-label="Reset 3D camera" onClick={() => cena.current?.reenquadrar()}>Reset</button>
      </div>
    </div>
    </div>
  );
}
