import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import type { View } from "@ovh/depth-ui";
import { Explorer } from "./Explorer.js";
import {
  assemble,
  cpuWorld,
  CPU_VIEWS,
  decode,
  portasAltas,
  VIEW_SISTEMA,
} from "@ovh/cpu-domain";
import type {
  AssemblyError,
  EstadoBanco,
  EstadoMemoria,
  EstadoPc,
  EstadoSaida,
} from "@ovh/cpu-domain";

/**
 * O lab: você escreve o programa, e o processador o executa na sua frente.
 *
 * Nada na tela é roteirizado. O que se move, se move porque o livro-caixa do
 * motor mudou entre um tick e o outro — e é por isso que parar no meio e olhar
 * responde de verdade.
 */

const PROGRAMA_INICIAL = `# adds 1 + 2 + ... + n, then says the result
        lui  t3, 1          # 0x1000: speak here, listen at 0x1004
        lw   t2, 4(t3)      # n comes from the input dial
        addi t2, t2, 1      # limit
        addi t0, x0, 0      # sum
        addi t1, x0, 1      # i
loop:   add  t0, t0, t1
        addi t1, t1, 1
        blt  t1, t2, loop
        sw   t0, 0(t3)      # say the sum
`;

const NOMES = [
  "zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2",
  "s0", "s1", "a0", "a1", "a2", "a3", "a4", "a5",
  "a6", "a7", "s2", "s3", "s4", "s5", "s6", "s7",
  "s8", "s9", "s10", "s11", "t3", "t4", "t5", "t6",
] as const;

const VIEWS: readonly View[] = CPU_VIEWS;

const hex = (n: number): string => `0x${(n >>> 0).toString(16).padStart(2, "0")}`;

interface Montado {
  readonly words: readonly number[];
  readonly lineOf: readonly number[];
}

export function CpuLab() {
  const [fonte, setFonte] = useState(PROGRAMA_INICIAL);
  const [montado, setMontado] = useState<Montado | null>(null);
  const [erros, setErros] = useState<readonly AssemblyError[]>([]);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [compasso, setCompasso] = useState(700);
  const [viewId, setViewId] = useState(VIEW_SISTEMA.id);
  const [entrada, setEntrada] = useState(5);
  const mundoRef = useRef<World | null>(null);

  // Programa não é parâmetro: um programa novo é um mundo novo, começando no
  // tick 0. Tratá-lo como parâmetro faria rebobinar atravessar uma fronteira
  // que não existe — antes do tick 0 daquele programa não há passado.
  const montar = (): void => {
    const r = assemble(fonte);
    if (!r.ok) {
      setErros(r.errors);
      setMontado(null);
      mundoRef.current = null;
      setRodando(false);
      setTick(0);
      return;
    }
    setErros([]);
    setMontado({ words: r.image.words, lineOf: r.image.lineOf });
    const novo = new World(cpuWorld(r.image.words));
    // O botão vale desde o começo deste programa: o mundo nasce no tick 0 e a
    // primeira leitura da entrada só acontece bem depois.
    novo.setParam("entrada", entrada);
    mundoRef.current = novo;
    setTick(0);
    setRodando(true);
  };

  useEffect(() => {
    montar();
    // só na montagem: o botão cuida das vezes seguintes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Girar o botão **não** reinicia: é evento no tempo. O programa lê outro
  // número na próxima vez que olhar para o endereço de entrada.
  const girar = (valor: number): void => {
    setEntrada(valor);
    mundoRef.current?.setParam("entrada", valor);
  };

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      const mundo = mundoRef.current;
      if (mundo === null) return;
      mundo.advance(1);
      setTick(mundo.tick);
    }, compasso);
    return () => window.clearInterval(id);
  }, [rodando, compasso, montado]);

  const mundo = mundoRef.current;
  const estado: WorldState | null = mundo === null ? null : mundo.state;
  const anterior = mundo?.previousState;

  const arvore = useMemo(
    () => (montado === null ? null : indexTree(cpuWorld(montado.words).root)),
    [montado],
  );
  const spec = useMemo(() => (montado === null ? null : cpuWorld(montado.words)), [montado]);

  const view = VIEWS.find((v) => v.id === viewId) ?? VIEW_SISTEMA;

  const banco = estado?.nodes.banco as EstadoBanco | undefined;
  const contador = estado?.nodes.pc as EstadoPc | undefined;
  const memoria = estado?.nodes.memoria as EstadoMemoria | undefined;
  const falado = (estado?.nodes.saida as EstadoSaida | undefined)?.palavras ?? [];

  const pcAtual = contador?.pc ?? 0;
  const palavraAtual = montado?.words[pcAtual / 4];
  const instrucao = palavraAtual === undefined ? null : decode(palavraAtual);
  const linhaAtual = montado?.lineOf[pcAtual / 4];

  const ocupados = banco === undefined ? 0 : banco.regs.filter((v) => v !== 0).length;

  const fills =
    banco === undefined
      ? undefined
      : { banco: ocupados / 32, memoria: Math.min(1, ((memoria?.mem.size ?? 0) - (montado?.words.length ?? 0)) / 8) };

  const readouts = {
    pc: hex(pcAtual),
    imem: `${montado?.words.length ?? 0} words`,
    memoria: `${Math.max(0, (memoria?.mem.size ?? 0) - (montado?.words.length ?? 0))} writes`,
    banco: `${ocupados}/32 in use`,
    ula: instrucao?.mnemonic ?? "—",
    controle: instrucao?.mnemonic ?? "idle",
    entrada: String(entrada),
    saida: falado.length === 0 ? "silent" : String(falado[falado.length - 1]),
  };

  return (
    <div className="cpu-lab">
      <div className="cpu-lab__palco">
        {estado !== null && arvore !== null && spec !== null ? (
          <Explorer
            key={viewId}
            tree={arvore}
            wires={spec.wires}
            state={estado}
            previous={anterior}
            edgeTicks={spec.edgeTicks ?? 1}
            tickMs={compasso}
            views={VIEWS}
            inicial={view.focus}
            fills={fills}
            readouts={readouts}
            altos={portasAltas(estado, arvore)}
            comFicha
          />
        ) : (
          <p className="cpu-lab__vazio">
            The program did not assemble. The errors are beside it, with line
            and column.
          </p>
        )}

        <div className="cpu-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)} disabled={mundo === null}>
            {rodando ? "Pause" : "Run"}
          </button>
          <button
            type="button"
            onClick={() => {
              const m = mundoRef.current;
              if (m === null) return;
              setRodando(false);
              m.advance(1);
              setTick(m.tick);
            }}
            disabled={mundo === null}
          >
            One cycle
          </button>
          <button type="button" onClick={montar}>
            Assemble and restart
          </button>
          <label className="cpu-lab__compasso">
            speed
            <input
              type="range"
              min={160}
              max={1600}
              step={20}
              value={1760 - compasso}
              onChange={(e) => setCompasso(1760 - Number(e.target.value))}
              aria-label="Clock speed"
            />
          </label>
          <label className="cpu-lab__entrada">
            input
            <input
              type="number"
              value={entrada}
              onChange={(e) => girar(Number(e.target.value) | 0)}
              aria-label="Input device value"
            />
          </label>
          <span className="cpu-lab__tick mono">tick {tick}</span>
          <span className="cpu-lab__tick mono">
            {estado === null ? "" : `${estado.substeps} substeps`}
          </span>
          <div className="cpu-lab__views" role="group" aria-label="Framing">
            {VIEWS.map((v) => (
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
        <p className="cpu-lab__legenda">
          Solid lines carry data; dashed lines carry control. Thin ones settle
          inside the same cycle — thick ones cross the clock edge, and the dot
          travelling on them is the value waiting for the flank.
        </p>
      </div>

      <aside className="cpu-lab__painel">
        <section>
          <h3>Program</h3>
          <textarea
            className="cpu-lab__editor mono"
            value={fonte}
            spellCheck={false}
            rows={12}
            onChange={(e) => setFonte(e.target.value)}
            aria-label="Assembly program"
          />
          {erros.length > 0 ? (
            <ul className="cpu-lab__erros">
              {erros.map((erro) => (
                <li key={`${erro.line}:${erro.column}:${erro.message}`}>
                  <span className="mono">
                    {erro.line}:{erro.column}
                  </span>{" "}
                  {erro.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section>
          <h3>Running</h3>
          <p className="cpu-lab__agora mono">
            {hex(pcAtual)} · {instrucao === null ? "nothing (the program ended)" : instrucao.mnemonic}
            {linhaAtual === undefined ? "" : ` · line ${linhaAtual}`}
          </p>
        </section>

        <section>
          <h3>What the program said</h3>
          <p className="cpu-lab__falou mono">
            {falado.length === 0 ? "nothing yet" : falado.join(" · ")}
          </p>
          <p className="cpu-lab__nota">
            Storing to <span className="mono">0x1000</span> is speaking; loading
            from <span className="mono">0x1004</span> is listening to the dial.
            No new instruction — the same <span className="mono">sw</span> and
            the same <span className="mono">lw</span>, at an address that is not
            memory.
          </p>
        </section>

        <section>
          <h3>Registers</h3>
          <ul className="cpu-lab__regs mono">
            {NOMES.map((nome, i) => {
              const valor = banco?.regs[i] ?? 0;
              return (
                <li key={nome} data-zero={valor === 0 ? "true" : undefined}>
                  <span>{nome}</span>
                  <span>{valor}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
