import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import {
  chavesConduzindo,
  DESCRICOES,
  especieDaCarga,
  estadoDoMicro,
  leituraDaCarga,
  microWorld,
  MICRO_VIEWS,
  montarMicro,
  portasAltas,
  ROTULOS_DA_FASE,
  VIEW_MICRO_SISTEMA,
} from "@ovh/cpu-domain";
import type { ErroDeMontagem } from "@ovh/cpu-domain";
import { Explorer } from "./Explorer.js";

/**
 * O genérico: um tick é um micro-passo, e não uma instrução.
 *
 * É a diferença que este lab existe para mostrar, contra `labs/cpu`: lá uma
 * instrução inteira cabe num tick e o ciclo só existe como profundidade da
 * acomodação. Aqui cada transferência entre registradores é o seu próprio
 * instante, e é por isso que a fase muda de um clique para o outro.
 */

const PROGRAMA_INICIAL = `LOAD  03
STORE 2000
LOAD  00
STORE 2001
LOADM 2001
ADD   02
STORE 2001
LOADM 2000
ADD   FF
STORE 2000
JZ    0020
JMP   000A`;

const hex = (n: number, digitos = 2): string => `0x${(n >>> 0).toString(16).padStart(digitos, "0")}`;

export function MicroLab() {
  const [fonte, setFonte] = useState(PROGRAMA_INICIAL);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [erros, setErros] = useState<readonly ErroDeMontagem[]>([]);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [compasso, setCompasso] = useState(500);
  const [viewId, setViewId] = useState(VIEW_MICRO_SISTEMA.id);
  const mundoRef = useRef<World | null>(null);

  const montar = (): void => {
    const r = montarMicro(fonte);
    if (!r.ok) {
      setErros(r.errors);
      setBytes(null);
      mundoRef.current = null;
      setRodando(false);
      setTick(0);
      return;
    }
    setErros([]);
    setBytes(r.bytes);
  };

  useEffect(() => {
    montar();
    // só na montagem: o botão cuida das vezes seguintes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spec = useMemo(() => (bytes === null ? null : microWorld(bytes)), [bytes]);
  const arvore = useMemo(() => (spec === null ? null : indexTree(spec.root)), [spec]);

  // Mundo novo a cada `spec` novo, e no mesmo render — um quadro com a árvore
  // nova e o estado velho pintaria objetos que aquele estado não conhece.
  const mundo = useMemo(() => (spec === null ? null : new World(spec)), [spec]);
  mundoRef.current = mundo;

  useEffect(() => {
    if (mundo === null) return;
    setTick(0);
    setRodando(true);
  }, [mundo]);

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      const agora = mundoRef.current;
      if (agora === null) return;
      agora.advance(1);
      setTick(agora.tick);
    }, compasso);
    return () => window.clearInterval(id);
  }, [rodando, compasso, mundo]);

  const passo = (): void => {
    const m = mundoRef.current;
    if (m === null) return;
    setRodando(false);
    m.advance(1);
    setTick(m.tick);
  };

  const estado: WorldState | null = mundo === null ? null : mundo.state;
  const anterior = mundo?.previousState;
  const microEstado = estado === null ? null : estadoDoMicro(estado);

  const view = MICRO_VIEWS.find((v) => v.id === viewId) ?? VIEW_MICRO_SISTEMA;

  const readouts =
    microEstado === null
      ? undefined
      : {
          pc: hex(microEstado.pc, 4),
          ir: hex(microEstado.ir),
          mar: hex(microEstado.mar, 4),
          mbr: hex(microEstado.mbr),
          ac: hex(microEstado.ac),
          t: hex(microEstado.t),
          h: hex(microEstado.h),
          l: hex(microEstado.l),
          status: microEstado.zero ? "Z" : "—",
          uc: ROTULOS_DA_FASE[microEstado.fase],
          memoria: `${microEstado.memoria.size} cells touched`,
        };

  return (
    <div className="micro-lab">
      <div className="micro-lab__palco">
        {estado !== null && arvore !== null && spec !== null && microEstado !== null ? (
          <Explorer
            key={viewId}
            tree={arvore}
            wires={spec.wires}
            state={estado}
            previous={anterior}
            edgeTicks={spec.edgeTicks ?? 1}
            tickMs={compasso}
            views={MICRO_VIEWS}
            inicial={view.focus}
            readouts={readouts}
            altos={portasAltas(estado, arvore)}
            conduzindo={chavesConduzindo(estado)}
            leituraDaCarga={leituraDaCarga}
            especieDaCarga={especieDaCarga}
            comFicha
            descricoes={DESCRICOES}
          />
        ) : (
          <p className="micro-lab__vazio">
            The program did not assemble. The errors are beside it, with the
            line that caused them.
          </p>
        )}

        <div className="micro-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)} disabled={mundo === null}>
            {rodando ? "Pause" : "Run"}
          </button>
          <button type="button" onClick={passo} disabled={mundo === null}>
            Step
          </button>
          <button type="button" onClick={montar}>
            Assemble and restart
          </button>
          <label className="micro-lab__compasso">
            speed
            <input
              type="range"
              min={140}
              max={1200}
              step={20}
              value={1340 - compasso}
              onChange={(e) => setCompasso(1340 - Number(e.target.value))}
              aria-label="Clock speed"
            />
          </label>
          <span className="micro-lab__tick mono">tick {tick}</span>
          {/*
            A fase é o único estado que a unidade de controle guarda — e é o
            que não existe como tempo no caminho de dados de ciclo único. O
            atributo, e não só o texto, é o que deixa um teste flagrar a
            mudança sem adivinhar a palavra exata que está escrita.
          */}
          <span
            className="micro-lab__fase mono"
            data-fase={microEstado?.fase ?? "parado"}
          >
            {microEstado === null ? "—" : ROTULOS_DA_FASE[microEstado.fase]}
          </span>
          <div className="micro-lab__views" role="group" aria-label="Framing">
            {MICRO_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === viewId}
                onClick={() => setViewId(v.id)}
              >
                {arvore?.byId.get(v.focus)?.label ?? v.id}
              </button>
            ))}
          </div>
        </div>
        <p className="micro-lab__legenda">
          Solid lines carry data; dashed lines carry control. Every red line is
          a bus transaction the control unit lit for this phase — and it is
          exactly what a single-cycle datapath never has to show, because
          there the whole instruction settles inside one tick.
        </p>
      </div>

      <aside className="micro-lab__painel">
        <section>
          <h3>Program</h3>
          <textarea
            className="micro-lab__editor mono"
            value={fonte}
            spellCheck={false}
            rows={12}
            onChange={(e) => setFonte(e.target.value)}
            aria-label="Assembly program"
          />
          {erros.length > 0 ? (
            <ul className="micro-lab__erros">
              {erros.map((erro) => (
                <li key={`${erro.linha}:${erro.message}`}>
                  <span className="mono">{erro.linha}</span> {erro.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="micro-lab__nota">
              One instruction per line: a mnemonic and a hexadecimal operand,
              no prefix. <span className="mono">LOAD</span>,{" "}
              <span className="mono">ADD</span> and{" "}
              <span className="mono">STORE</span> are the deck&rsquo;s own
              three; <span className="mono">LOADM</span>,{" "}
              <span className="mono">JMP</span> and{" "}
              <span className="mono">JZ</span> are the loop this deck never
              writes.
            </p>
          )}
        </section>

        <section>
          <h3>Instruction cycle</h3>
          <p className="micro-lab__agora mono">
            {microEstado === null ? "—" : ROTULOS_DA_FASE[microEstado.fase]}
          </p>
          <p className="micro-lab__nota">
            Every row here is a single bus transaction — the unit this
            program&rsquo;s tick counter never rounds up.
          </p>
        </section>

        <section>
          <h3>Registers</h3>
          <ul className="micro-lab__regs mono">
            {(
              [
                ["PC", microEstado?.pc, 4],
                ["IR", microEstado?.ir, 2],
                ["MAR", microEstado?.mar, 4],
                ["MBR", microEstado?.mbr, 2],
                ["AC", microEstado?.ac, 2],
                ["T", microEstado?.t, 2],
                ["H", microEstado?.h, 2],
                ["L", microEstado?.l, 2],
              ] as const
            ).map(([nome, valor, digitos]) => (
              <li key={nome} data-zero={!valor ? "true" : undefined}>
                <span>{nome}</span>
                <span>{hex(valor ?? 0, digitos)}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
