import { useCallback, useEffect, useRef, useState } from "react";

/**
 * O relógio do filme. Guarda o instante e anda com `requestAnimationFrame`
 * enquanto toca; parar, pular e mudar de velocidade não perdem a posição.
 *
 * Com movimento reduzido, o relógio não anima entre instantes: tocar salta
 * direto para o próximo marco (fim do capítulo), e o filme vira uma sequência
 * de quadros parados — a informação inteira, sem o deslocamento.
 */
export interface Clock {
  readonly t: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly reduced: boolean;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(t: number): void;
  setSpeed(speed: number): void;
}

export interface ClockOptions {
  readonly duration: number;
  /** Onde o relógio para por conta própria ao tocar com movimento reduzido. */
  readonly marks?: readonly number[];
  readonly autoplay?: boolean;
  readonly loop?: boolean;
}

function prefersReduced(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function useClock({ duration, marks = [], autoplay = false, loop = false }: ClockOptions): Clock {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(false);
  const tRef = useRef(0);
  tRef.current = t;

  useEffect(() => {
    setReduced(prefersReduced());
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (reduced) {
      const next = marks.find((m) => m > tRef.current + 1) ?? duration;
      setT(next);
      setPlaying(false);
      return;
    }
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last === null ? 0 : Math.min(64, now - last);
      last = now;
      let next = tRef.current + dt * speed;
      if (next >= duration) {
        if (loop) next = 0;
        else {
          setT(duration);
          setPlaying(false);
          return;
        }
      }
      tRef.current = next;
      setT(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, duration, loop, reduced, marks]);

  const seek = useCallback((to: number) => setT(Math.min(Math.max(to, 0), duration)), [duration]);
  const play = useCallback(() => {
    if (tRef.current >= duration) setT(0);
    setPlaying(true);
  }, [duration]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, play, pause]);

  return { t, playing, speed, reduced, play, pause, toggle, seek, setSpeed };
}
