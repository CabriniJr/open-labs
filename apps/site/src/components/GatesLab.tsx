import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree } from "@ovh/depth-core";
import { leituraDaCarga, portasAltas, somadorWorld, viewsDoSomador } from "@ovh/cpu-domain";
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

  const spec = useMemo(() => somadorWorld(BITS, false, 1, true), []);
  const arvore = useMemo(() => indexTree(spec.root), [spec]);
  const views = useMemo(() => viewsDoSomador(BITS, true), []);
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
          views={views}
          readouts={readouts}
          altos={portasAltas(estado, arvore)}
          leituraDaCarga={leituraDaCarga}
          comFicha
        />
        <p className="gates-lab__legenda">
          A lit gate is a gate whose output is 1 — and a dark one is a gate that
          ran and said zero, not one that sat still: every line here carries its
          own bit. The carry climbs from one adder to the next, and it is what
          costs depth, even when adding zeros.
        </p>
      </div>

      <aside className="gates-lab__painel">
        <section>
          <h3>Inputs</h3>
          <label className="gates-lab__entrada">
            <span>a</span>
            <input
              type="range"
              min={0}
              max={15}
              value={a}
              onChange={(e) => setA(Number(e.target.value))}
              aria-label="First addend"
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
              aria-label="Second addend"
            />
            <span className="mono">
              {b} · {binario(b)}
            </span>
          </label>
        </section>

        <section>
          <h3>Output</h3>
          <p className="gates-lab__resultado mono">
            {binario(soma)}
            {vaium ? " + carry" : ""} · {soma + (vaium ? 16 : 0)}
          </p>
          <p className="gates-lab__nota">
            {a} + {b} = {a + b}. Four bits hold up to 15; anything past that
            leaves through the carry, which is exactly what overflow is.
          </p>
        </section>

        <section>
          <h3>Depth</h3>
          <p className="gates-lab__resultado mono">{estado.substeps} substeps</p>
          <p className="gates-lab__nota">
            The longest combinational path in this tick. Add more bits and it
            grows — propagation delay is literally this.
          </p>
        </section>

        <div className="gates-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRodando(false);
              mundo.advance(1);
              setTick(mundo.tick);
            }}
          >
            One cycle
          </button>
          <label className="gates-lab__compasso">
            speed
            <input
              type="range"
              min={200}
              max={1800}
              step={50}
              value={2000 - compasso}
              onChange={(e) => setCompasso(2000 - Number(e.target.value))}
              aria-label="Clock speed"
            />
          </label>
          <span className="gates-lab__tick mono">tick {tick}</span>
        </div>
      </aside>
    </div>
  );
}
