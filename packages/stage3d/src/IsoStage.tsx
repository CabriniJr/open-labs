import { frameAt, type Film, type Frame } from "@ovh/motion";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { IsoScene, type IsoOptions } from "./IsoScene.js";

/**
 * O palco isométrico: o mesmo `Film` do palco plano, desenhado em 3D.
 *
 * Arrastar gira a vista; duplo clique volta à isometria. Sem WebGL, o
 * componente diz isso em vez de ficar em branco — e quem o usa decide voltar
 * para o palco plano.
 */
export interface IsoStageProps<D> {
  readonly film: Film<D>;
  readonly t: number;
  readonly frame?: Frame<D>;
  readonly label: string;
  readonly className?: string;
  readonly options?: IsoOptions;
}

export function IsoStage<D>({ film, t, frame, label, className, options }: IsoStageProps<D>) {
  const host = useRef<HTMLDivElement | null>(null);
  const cena = useRef<IsoScene | null>(null);
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
    return () => {
      cena.current?.dispose();
      cena.current = null;
    };
    // As opções valem para a vida da cena; trocar opção é montar outra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cena.current?.setFilm(film as Film<unknown>);
  }, [film]);

  useEffect(() => {
    cena.current?.update((frame ?? frameAt(film, t)) as Frame<unknown>);
  }, [film, t, frame]);

  // Girar com o ponteiro. Pointer capture para o gesto não escapar do palco.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const alvo = e.currentTarget;
    alvo.setPointerCapture(e.pointerId);
    let x = e.clientX;
    let y = e.clientY;
    const mover = (ev: globalThis.PointerEvent) => {
      cena.current?.orbitar(-(ev.clientX - x) * 0.006, (ev.clientY - y) * 0.004);
      x = ev.clientX;
      y = ev.clientY;
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  };

  return (
    <div
      ref={host}
      className={["iso-stage", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={`${label} (isometric view; drag to rotate, double-click to reset)`}
      onPointerDown={onPointerDown}
      onDoubleClick={() => cena.current?.reenquadrar()}
      data-falhou={falhou === null ? undefined : ""}
    >
      {falhou !== null ? <p className="iso-stage__falha">3D view unavailable in this browser ({falhou}). Use the flat view.</p> : null}
    </div>
  );
}
