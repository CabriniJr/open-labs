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

/**
 * Constante, e não `[]` no parâmetro: um array novo a cada render mudava a
 * dependência do efeito do relógio, que reiniciava a cada quadro com dt = 0 — e
 * o tempo nunca andava para quem não passava `marks` (a hero, por exemplo).
 */
const SEM_MARCOS: readonly number[] = [];

export function useClock({ duration, marks = SEM_MARCOS, autoplay = false, loop = false }: ClockOptions): Clock {
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
      // Limite de 250 ms, não de 64: num aparelho que desenha a 4 quadros por
      // segundo, 64 fazia o filme andar 4× mais devagar que o relógio. O limite
      // ainda existe para a volta de uma aba em segundo plano não pular capítulos.
      const dt = last === null ? 0 : Math.min(250, now - last);
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
