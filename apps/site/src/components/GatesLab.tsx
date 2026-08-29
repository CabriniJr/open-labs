import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree } from "@ovh/depth-core";
import { portasAltas, somadorWorld, viewSomador } from "@ovh/cpu-domain";
import { Explorer } from "./Explorer.js";

/**
 * A fatia vertical: o somador aberto até a porta lógica.
 *
 * Uma porta acesa não é enfeite: é **o valor que saiu dela**, lido do que a
 * acomodação emitiu neste tick. Toda linha do circuito carrega o bit dela, alto
 * ou baixo, então uma porta escura é uma porta que rodou e disse zero — e não
 * uma porta que ficou parada.
 *
 * O vai-um subindo de um somador para o próximo é o que cobra profundidade, e
 * ele cobra a mesma coisa somando zeros: o atraso é do caminho, não do número.
 */

const BITS = 4;

const binario = (n: number): string => (n & 0b1111).toString(2).padStart(BITS, "0");

export function GatesLab() {
  const [a, setA] = useState(6);
  const [b, setB] = useState(7);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  const [compasso, setCompasso] = useState(900);

  const spec = useMemo(() => somadorWorld(BITS), []);
  const arvore = useMemo(() => indexTree(spec.root), [spec]);
  const view = useMemo(() => viewSomador(BITS), []);
  const mundoRef = useRef<World | null>(null);
  if (mundoRef.current === null) mundoRef.current = new World(spec);

  // Entrada é parâmetro, e parâmetro é evento no tempo: mudar A não recomeça o
  // circuito, ele reage de onde está — que é o que um circuito faz.
  useEffect(() => {
    mundoRef.current?.setParam("a", a);
  }, [a]);
  useEffect(() => {
    mundoRef.current?.setParam("b", b);
  }, [b]);

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      const mundo = mundoRef.current;
      if (mundo === null) return;
      mundo.advance(1);
      setTick(mundo.tick);
    }, compasso);
    return () => window.clearInterval(id);
  }, [rodando, compasso]);

  const mundo = mundoRef.current;
  const estado = mundo?.state;
  if (mundo === null || estado === undefined) return null;

  const bit = (id: string): boolean => (estado.nodes[id] as { alto?: boolean })?.alto === true;
  const soma = Array.from({ length: BITS }, (_, i) => (bit(`soma${i}`) ? 1 << i : 0)).reduce(
    (x, y) => x + y,
    0,
  );
  const vaium = bit("vaium");

  const readouts: Record<string, string> = {
    entradas: `a=${binario(a)} b=${binario(b)}`,
    ...Object.fromEntries(
      Array.from({ length: BITS }, (_, i) => [`soma${i}`, bit(`soma${i}`) ? "1" : "0"]),
    ),
    vaium: vaium ? "1" : "0",
  };

  return (
    <div className="gates-lab">
      <div className="gates-lab__palco">
        <Explorer
          tree={arvore}
          wires={spec.wires}
          state={estado}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={compasso}
          views={[view]}
          readouts={readouts}
          altos={portasAltas(estado)}
        />
        <p className="gates-lab__legenda">
          Uma porta acesa é uma porta cuja saída é 1 — e uma escura é uma porta
          que rodou e disse zero, não uma parada: toda linha aqui carrega o bit
          dela. O vai-um sobe de um somador para o próximo, e é ele que cobra
          profundidade, mesmo somando zeros.
        </p>
      </div>

      <aside className="gates-lab__painel">
        <section>
          <h3>Entradas</h3>
          <label className="gates-lab__entrada">
            <span>a</span>
            <input
              type="range"
              min={0}
              max={15}
              value={a}
              onChange={(e) => setA(Number(e.target.value))}
              aria-label="Primeira parcela"
            />
            <span className="mono">
              {a} · {binario(a)}
            </span>
          </label>
          <label className="gates-lab__entrada">
            <span>b</span>
            <input
              type="range"
              min={0}
              max={15}
              value={b}
              onChange={(e) => setB(Number(e.target.value))}
              aria-label="Segunda parcela"
            />
            <span className="mono">
              {b} · {binario(b)}
            </span>
          </label>
        </section>

        <section>
          <h3>Saída</h3>
          <p className="gates-lab__resultado mono">
            {binario(soma)}
            {vaium ? " + vai-um" : ""} · {soma + (vaium ? 16 : 0)}
          </p>
          <p className="gates-lab__nota">
            {a} + {b} = {a + b}. Quatro bits guardam até 15; o que passa disso sai
            pelo vai-um, e é a mesma coisa que estouro.
          </p>
        </section>

        <section>
          <h3>Profundidade</h3>
          <p className="gates-lab__resultado mono">{estado.substeps} subpassos</p>
          <p className="gates-lab__nota">
            É o caminho combinacional mais longo deste tick. Some mais bits e ele
            cresce — atraso de propagação é literalmente isto.
          </p>
        </section>

        <div className="gates-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pausar" : "Rodar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRodando(false);
              mundo.advance(1);
              setTick(mundo.tick);
            }}
          >
            Um ciclo
          </button>
          <label className="gates-lab__compasso">
            compasso
            <input
              type="range"
              min={200}
              max={1800}
              step={50}
              value={2000 - compasso}
              onChange={(e) => setCompasso(2000 - Number(e.target.value))}
              aria-label="Velocidade do relógio"
            />
          </label>
          <span className="gates-lab__tick mono">tick {tick}</span>
        </div>
      </aside>
    </div>
  );
}
