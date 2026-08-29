import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import type { View } from "@ovh/depth-ui";
import { Explorer } from "./Explorer.js";
import {
  assemble,
  cpuWorld,
  decode,
  VIEW_PROCESSADOR,
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

const PROGRAMA_INICIAL = `# soma 1 + 2 + ... + n, e fala o resultado
        lui  t3, 1          # 0x1000: fala aqui, ouve em 0x1004
        lw   t2, 4(t3)      # n vem do botão de entrada
        addi t2, t2, 1      # limite
        addi t0, x0, 0      # soma
        addi t1, x0, 1      # i
laco:   add  t0, t0, t1
        addi t1, t1, 1
        blt  t1, t2, laco
        sw   t0, 0(t3)      # fala a soma
`;

const NOMES = [
  "zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2",
  "s0", "s1", "a0", "a1", "a2", "a3", "a4", "a5",
  "a6", "a7", "s2", "s3", "s4", "s5", "s6", "s7",
  "s8", "s9", "s10", "s11", "t3", "t4", "t5", "t6",
] as const;

const VIEWS: readonly View[] = [VIEW_SISTEMA, VIEW_PROCESSADOR];

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
    imem: `${montado?.words.length ?? 0} palavras`,
    memoria: `${Math.max(0, (memoria?.mem.size ?? 0) - (montado?.words.length ?? 0))} escritas`,
    banco: `${ocupados}/32 em uso`,
    ula: instrucao?.mnemonic ?? "—",
    controle: instrucao?.mnemonic ?? "parado",
    entrada: String(entrada),
    saida: falado.length === 0 ? "calada" : String(falado[falado.length - 1]),
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
          />
        ) : (
          <p className="cpu-lab__vazio">
            O programa não montou. Os erros estão ao lado, com linha e coluna.
          </p>
        )}

        <div className="cpu-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)} disabled={mundo === null}>
            {rodando ? "Pausar" : "Rodar"}
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
            Um ciclo
          </button>
          <button type="button" onClick={montar}>
            Montar e reiniciar
          </button>
          <label className="cpu-lab__compasso">
            compasso
            <input
              type="range"
              min={160}
              max={1600}
              step={20}
              value={1760 - compasso}
              onChange={(e) => setCompasso(1760 - Number(e.target.value))}
              aria-label="Velocidade do relógio"
            />
          </label>
          <label className="cpu-lab__entrada">
            entrada
            <input
              type="number"
              value={entrada}
              onChange={(e) => girar(Number(e.target.value) | 0)}
              aria-label="Valor do dispositivo de entrada"
            />
          </label>
          <span className="cpu-lab__tick mono">tick {tick}</span>
          <span className="cpu-lab__tick mono">
            {estado === null ? "" : `${estado.substeps} subpassos`}
          </span>
          <div className="cpu-lab__views" role="group" aria-label="Enquadramento">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === viewId}
                onClick={() => setViewId(v.id)}
              >
                {v.id}
              </button>
            ))}
          </div>
        </div>
        <p className="cpu-lab__legenda">
          Linha cheia é dado; tracejada é controle. O traço fino fecha dentro do
          mesmo ciclo — o grosso atravessa a borda do relógio, e a bolinha nele é
          o valor esperando o flanco.
        </p>
      </div>

      <aside className="cpu-lab__painel">
        <section>
          <h3>Programa</h3>
          <textarea
            className="cpu-lab__editor mono"
            value={fonte}
            spellCheck={false}
            rows={12}
            onChange={(e) => setFonte(e.target.value)}
            aria-label="Programa em assembly"
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
          <h3>Executando</h3>
          <p className="cpu-lab__agora mono">
            {hex(pcAtual)} · {instrucao === null ? "nada (o programa acabou)" : instrucao.mnemonic}
            {linhaAtual === undefined ? "" : ` · linha ${linhaAtual}`}
          </p>
        </section>

        <section>
          <h3>O que o programa falou</h3>
          <p className="cpu-lab__falou mono">
            {falado.length === 0 ? "nada ainda" : falado.join(" · ")}
          </p>
          <p className="cpu-lab__nota">
            Guardar em <span className="mono">0x1000</span> é falar; ler de{" "}
            <span className="mono">0x1004</span> é ouvir o botão. Não há
            instrução nova — é a mesma <span className="mono">sw</span> e a
            mesma <span className="mono">lw</span> num endereço que não é
            memória.
          </p>
        </section>

        <section>
          <h3>Registradores</h3>
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
