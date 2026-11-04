import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree, seguir } from "@ovh/depth-core";
import type { Parada } from "@ovh/depth-core";
import {
  baldesWorld,
  estadoDosBaldes,
  LEITOR_DO_BALDE,
  PARAMS_DOS_BALDES,
  VIEWS_DOS_BALDES,
} from "@ovh/splunk-domain";
import { Explorer } from "./Explorer.js";
import { PainelDaCarga } from "./PainelDaCarga.js";

/**
 * O lab dos baldes.
 *
 * A pergunta da página é a que aparece quando alguém pede o log de três meses
 * atrás:
 *
 * > Até onde dá para pesquisar?
 *
 * E o placar a responde com dois números lado a lado: a **janela real**, que
 * sai do run, e a **retenção configurada**, que é a que todo mundo cita. A
 * distância entre os dois é o lab.
 *
 * Os controles são os quatro limites do `indexes.conf` e o volume diário. O
 * volume é o único que não está em arquivo nenhum — e é o que decide.
 */

const CONTROLES = [
  "gb-por-dia",
  "horas-por-tick",
  "max-data-size-mb",
  "max-warm",
  "max-total-gb",
  "retencao-dias",
  "arquivar",
] as const;

type Controle = (typeof CONTROLES)[number];

const INICIAIS = Object.fromEntries(
  CONTROLES.map((nome) => [nome, PARAMS_DOS_BALDES[nome] ?? 0]),
) as Record<Controle, number>;

/**
 * Os valores de retenção que a tela oferece, e por que é uma lista e não uma
 * barra: entre uma semana e seis anos não há uma escala linear útil, e os
 * números que importam são os que as pessoas de fato escrevem.
 */
const RETENCOES: readonly { readonly dias: number; readonly rotulo: string }[] = [
  { dias: 7, rotulo: "7 days" },
  { dias: 30, rotulo: "30 days" },
  { dias: 90, rotulo: "90 days" },
  { dias: 365, rotulo: "1 year" },
  { dias: 2184, rotulo: "6 years — the default" },
];

const numero = (n: number): string => n.toLocaleString("en-US");

const gb = (mb: number): string =>
  mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;

export function SplunkBucketsLab() {
  const [controles, setControles] = useState<Record<Controle, number>>(INICIAIS);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  const [seguindo, setSeguindo] = useState<string | undefined>(undefined);
  const [trajeto, setTrajeto] = useState<readonly Parada[]>([]);
  const seguindoRef = useRef<string | undefined>(undefined);
  seguindoRef.current = seguindo;
  const mundoRef = useRef<World | null>(null);

  const spec = useMemo(() => baldesWorld(INICIAIS), []);
  const arvore = useMemo(() => indexTree(spec.root, spec.channels), [spec]);
  const mundo = useMemo(() => new World(spec), [spec]);
  mundoRef.current = mundo;

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      const m = mundoRef.current;
      if (m === null) return;
      m.advance(1);
      setTick(m.tick);
      const chave = seguindoRef.current;
      if (chave !== undefined) {
        setTrajeto((antes) => seguir(antes, m.state, chave, LEITOR_DO_BALDE));
      }
    }, 300);
    return () => window.clearInterval(id);
  }, [rodando, mundo]);

  const mexer = (nome: Controle, valor: number): void => {
    mundoRef.current?.setParam(nome, valor);
    setControles((c) => ({ ...c, [nome]: valor }));
  };

  const e = estadoDosBaldes(mundo.state, controles);
  const arquivando = controles["arquivar"] === 1;
  /** Os dias que o run já simulou: o contexto para ler "ainda nada congelou". */
  const diasSimulados = Math.round(tick * e.diasPorTick);

  const seguirCarga = (chave: string | undefined): void => {
    setSeguindo(chave);
    setTrajeto(chave === undefined ? [] : seguir([], mundo.state, chave, LEITOR_DO_BALDE));
  };

  /** O que cada caixa guarda. O estado de cada nível, e o que o limita. */
  const conteudo = (id: string) => {
    if (id === "eventos") {
      return [
        { chave: "on disk per day", valor: `${numero(controles["gb-por-dia"])} GB` },
        { chave: "written so far", valor: gb(e.mbEscritos) },
        { chave: "one tick is", valor: `${controles["horas-por-tick"]}h` },
      ];
    }
    if (id === "quente") {
      return [
        { chave: "open bucket", valor: gb(e.mbAberto) },
        { chave: "closes at", valor: gb(controles["max-data-size-mb"]) },
        { chave: "buckets closed", valor: numero(e.baldesFechados) },
      ];
    }
    if (id === "morno") {
      return [
        { chave: "buckets", valor: `${numero(e.mornos)} of ${numero(controles["max-warm"])}` },
        { chave: "on disk", valor: gb(e.mbMorno) },
        { chave: "limit is", valor: "a count, not a size" },
      ];
    }
    if (id === "frio") {
      return [
        { chave: "buckets", valor: numero(e.frios) },
        { chave: "index on disk", valor: `${gb(e.mbNoDisco)} of ${controles["max-total-gb"]} GB` },
        {
          chave: "frozen · by size",
          valor: numero(e.porTamanho),
          ...(e.porTamanho > 0 ? { ativo: true as const } : {}),
        },
        { chave: "frozen · by age", valor: numero(e.porIdade) },
      ];
    }
    if (id === "congelado") {
      return [
        { chave: "buckets", valor: numero(e.congelados) },
        {
          chave: arquivando ? "archived" : "deleted",
          valor: gb(e.mbCongelado),
          ...(arquivando ? {} : { ativo: true as const }),
        },
        { chave: "coldToFrozenDir", valor: arquivando ? "set" : "not set" },
      ];
    }
    return undefined;
  };

  const readouts: Record<string, string> = {
    eventos: `${numero(controles["gb-por-dia"])} GB/day`,
    quente: `${gb(e.mbAberto)} open`,
    morno: `${numero(e.mornos)} buckets`,
    frio: `${gb(e.mbNoDisco)} on disk`,
    congelado: arquivando
      ? `${numero(e.arquivados)} archived`
      : `${numero(e.apagados)} deleted`,
  };

  /** As duas barras que explicam o que vai acontecer antes de acontecer. */
  const fills: Record<string, number> = {
    quente: e.enchimentoDoQuente,
    frio: e.enchimentoDoIndice,
  };

  return (
    <div className="splunk-baldes">
      <div className="splunk-baldes__palco">
        <Explorer
          tree={arvore}
          wires={spec.wires}
          state={mundo.state}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={300}
          views={VIEWS_DOS_BALDES}
          inicial="baldes"
          readouts={readouts}
          fills={fills}
          conteudo={conteudo}
          comFicha
          chaveDaCarga={LEITOR_DO_BALDE.chave}
          cargaSeguida={seguindo}
          onSeguirCarga={seguirCarga}
          painelDaCarga={
            <PainelDaCarga
              titulo={seguindo ?? ""}
              trajeto={trajeto}
              onFechar={() => seguirCarga(undefined)}
              vazio="This bucket has already left the index. Click another one on a wire to follow it — the same bucket goes through all four states, and the last step is the one with no way back."
            />
          }
        />

        <div className="splunk-baldes__placar">
          <p className="splunk-baldes__pergunta">
            Somebody asks for a log from three months ago. How far back can you search?
          </p>

          {e.configuracaoIncoerente ? (
            <p className="splunk-baldes__aviso">
              <b>This configuration is incoherent, and the model says so instead of guessing.</b>{" "}
              {numero(controles["max-warm"])} warm buckets of{" "}
              {gb(controles["max-data-size-mb"])} hold{" "}
              {gb(controles["max-warm"] * controles["max-data-size-mb"])} on their own, which is
              more than the {controles["max-total-gb"]} GB you gave the whole index. Real Splunk
              freezes the oldest bucket of the index wherever it is, including a warm one; this
              model only freezes from cold, so the window below would be wrong. Lower{" "}
              <code>maxWarmDBCount</code> or raise the index size.
            </p>
          ) : null}

          <div className="splunk-baldes__respostas">
            <div
              className="splunk-baldes__resposta"
              data-destaque={e.janelaEmDias !== undefined ? "true" : undefined}
            >
              <span className="splunk-baldes__rotulo">searchable window · measured</span>
              <b className="mono">
                {e.janelaEmDias === undefined ? "—" : `${numero(e.janelaEmDias)} days`}
              </b>
              <span className="splunk-baldes__nota">
                {e.janelaEmDias === undefined
                  ? `nothing has been frozen in ${numero(diasSimulados)} simulated days — the index is still filling`
                  : "the oldest data still on disk. No file contains this number"}
              </span>
            </div>
            <div className="splunk-baldes__resposta">
              <span className="splunk-baldes__rotulo">retention · configured</span>
              <b className="mono">{numero(e.retencaoEmDias)} days</b>
              <span className="splunk-baldes__nota">
                <code>frozenTimePeriodInSecs</code> — the number people quote
              </span>
            </div>
            <div
              className="splunk-baldes__resposta"
              data-destaque={e.porTamanho > 0 ? "quebrado" : undefined}
            >
              <span className="splunk-baldes__rotulo">which limit froze the data</span>
              <b className="mono">
                {e.congelados === 0 ? "—" : e.porTamanho > e.porIdade ? "size" : "age"}
              </b>
              <span className="splunk-baldes__nota">
                {e.congelados === 0
                  ? "nothing frozen yet"
                  : e.porTamanho > e.porIdade
                    ? "the size limit came first, and it always will at this volume"
                    : "the age limit came first — this is the configuration doing what it says"}
              </span>
            </div>
            <div
              className="splunk-baldes__resposta"
              data-destaque={!arquivando && e.apagados > 0 ? "quebrado" : undefined}
            >
              <span className="splunk-baldes__rotulo">
                {arquivando ? "archived" : "deleted"}
              </span>
              <b className="mono">{gb(e.mbCongelado)}</b>
              <span className="splunk-baldes__nota">
                {arquivando
                  ? "written to coldToFrozenDir, raw data only"
                  : "gone. Freezing means removing it from the index"}
              </span>
            </div>
          </div>
        </div>

        <div className="splunk-baldes__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <span className="splunk-baldes__tick mono">
            t{tick} · {numero(diasSimulados)}d simulated
          </span>

          <label className="splunk-baldes__switch">
            <input
              type="checkbox"
              checked={arquivando}
              onChange={(ev) => mexer("arquivar", ev.target.checked ? 1 : 0)}
            />
            <code>coldToFrozenDir</code> is set
          </label>

          <label className="splunk-baldes__campo">
            <span>
              on disk per day <b className="mono">{controles["gb-por-dia"]} GB</b>
            </span>
            <input
              type="range"
              min={0}
              max={200}
              step={10}
              value={controles["gb-por-dia"]}
              onChange={(ev) => mexer("gb-por-dia", Number(ev.target.value))}
            />
          </label>

          <label className="splunk-baldes__campo">
            <span>
              <code>maxTotalDataSizeMB</code>{" "}
              <b className="mono">{numero(controles["max-total-gb"] * 1024)}</b>
            </span>
            <input
              type="range"
              min={50}
              max={1000}
              step={50}
              value={controles["max-total-gb"]}
              onChange={(ev) => mexer("max-total-gb", Number(ev.target.value))}
            />
          </label>

          <label className="splunk-baldes__campo">
            <span>
              <code>frozenTimePeriodInSecs</code>
            </span>
            <select
              value={controles["retencao-dias"]}
              onChange={(ev) => mexer("retencao-dias", Number(ev.target.value))}
            >
              {RETENCOES.map((r) => (
                <option key={r.dias} value={r.dias}>
                  {r.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="splunk-baldes__campo">
            <span>
              <code>maxWarmDBCount</code> <b className="mono">{controles["max-warm"]}</b>
            </span>
            <input
              type="range"
              min={2}
              max={400}
              step={2}
              value={controles["max-warm"]}
              onChange={(ev) => mexer("max-warm", Number(ev.target.value))}
            />
          </label>

          <label className="splunk-baldes__campo">
            <span>
              <code>maxDataSize</code> <b className="mono">{controles["max-data-size-mb"]} MB</b>
            </span>
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={controles["max-data-size-mb"]}
              onChange={(ev) => mexer("max-data-size-mb", Number(ev.target.value))}
            />
          </label>

          <label className="splunk-baldes__campo">
            <span>
              one tick is <b className="mono">{controles["horas-por-tick"]}h</b>
            </span>
            <input
              type="range"
              min={1}
              max={48}
              step={1}
              value={controles["horas-por-tick"]}
              onChange={(ev) => mexer("horas-por-tick", Number(ev.target.value))}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
