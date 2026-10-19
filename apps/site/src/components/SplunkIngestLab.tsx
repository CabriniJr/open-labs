import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree, seguir } from "@ovh/depth-core";
import type { Parada } from "@ovh/depth-core";
import {
  aQuebraVale,
  BYTES_DO_BLOCO,
  estadoDaIngestao,
  ingestaoWorld,
  LEITOR_DA_CARGA,
  LUGARES_DO_PROPS,
  NOME_DA_MAQUINA,
  ondeEstaOProps,
  PARAMS_DA_INGESTAO,
  quemParseia,
  VIEWS_DA_INGESTAO,
} from "@ovh/splunk-domain";
import { Explorer } from "./Explorer.js";
import { PainelDaCarga } from "./PainelDaCarga.js";

/**
 * O lab da ingestão do Splunk.
 *
 * A pergunta da página é a da segunda semana de um ambiente novo:
 *
 * > O stack trace que a aplicação escreveu está pesquisável como um evento?
 *
 * O placar responde com três números e uma frase. Os números são do run; a
 * frase é a tabela-verdade resolvida para a configuração atual — onde o
 * `props.conf` está, quem executa a fase, e se o arquivo tem efeito. Ela é o
 * centro da tela de propósito: todo o resto do lab existe para mostrar que
 * essa frase pode dizer "nenhum efeito" sem que nada mais na tela mude.
 *
 * Todo controle é parâmetro: mexer num deles mantém o tick e o acumulado, então
 * o leitor vê a transição entre dois regimes em vez de dois runs separados.
 */

const CONTROLES = [
  "registros-por-tick",
  "linhas-do-registro",
  "multilinha-a-cada",
  "meio-cozinha",
  "props-em",
] as const;

type Controle = (typeof CONTROLES)[number];

const INICIAIS = Object.fromEntries(
  CONTROLES.map((nome) => [nome, PARAMS_DA_INGESTAO[nome] ?? 0]),
) as Record<Controle, number>;

const numero = (n: number): string => n.toLocaleString("en-US");

const kib = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KiB`;

export function SplunkIngestLab() {
  const [controles, setControles] = useState<Record<Controle, number>>(INICIAIS);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  const [seguindo, setSeguindo] = useState<string | undefined>(undefined);
  const [trajeto, setTrajeto] = useState<readonly Parada[]>([]);
  const seguindoRef = useRef<string | undefined>(undefined);
  seguindoRef.current = seguindo;
  const mundoRef = useRef<World | null>(null);

  const spec = useMemo(() => ingestaoWorld(INICIAIS), []);
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
        setTrajeto((antes) => seguir(antes, m.state, chave, LEITOR_DA_CARGA));
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [rodando, mundo]);

  const mexer = (nome: Controle, valor: number): void => {
    mundoRef.current?.setParam(nome, valor);
    setControles((c) => ({ ...c, [nome]: valor }));
  };

  const e = estadoDaIngestao(mundo.state);

  // A tabela-verdade resolvida, e ela sai das MESMAS funções que os testes
  // cobram — a tela não tem uma segunda cópia da regra.
  const props = ondeEstaOProps(controles);
  const cozinha = quemParseia(controles);
  const vale = aQuebraVale(controles);
  const heavy = controles["meio-cozinha"] === 1;

  const seguirCarga = (chave: string | undefined): void => {
    setSeguindo(chave);
    setTrajeto(chave === undefined ? [] : seguir([], mundo.state, chave, LEITOR_DA_CARGA));
  };

  /** O que cada caixa guarda. A fase que cada uma executa vem primeiro. */
  const conteudo = (id: string) => {
    if (id === "app") {
      return [
        { chave: "records written", valor: numero(e.registrosEscritos) },
        { chave: "of them multi-line", valor: numero(e.multilinhasEscritos) },
        { chave: "lines in the file", valor: numero(e.linhasEscritas) },
      ];
    }
    if (id === "uf") {
      return [
        { chave: "phase", valor: "input" },
        { chave: "blocks sent", valor: numero(e.blocosEnviados) },
        { chave: "buffer", valor: `${kib(e.bytesNaFila)} of ${kib(BYTES_DO_BLOCO)}` },
        ...(props === "uf"
          ? [{ chave: "props.conf here", valor: "no effect", ativo: true as const }]
          : []),
      ];
    }
    if (id === "meio") {
      return heavy
        ? [
            { chave: "phase", valor: "parsing", ativo: true as const },
            { chave: "events produced", valor: numero(e.eventosDoMeio) },
            { chave: "role", valor: "heavy forwarder" },
          ]
        : [
            { chave: "phase", valor: "none — it just forwards" },
            { chave: "blocks passed on", valor: numero(e.blocosRepassados) },
            { chave: "role", valor: "intermediate universal forwarder" },
          ];
    }
    if (id === "idx") {
      return [
        {
          chave: "phase",
          valor: heavy ? "indexing only" : "parsing + indexing",
          ...(heavy ? {} : { ativo: true as const }),
        },
        { chave: "events written", valor: numero(e.eventosGravados) },
        ...(heavy
          ? [{ chave: "arrived already parsed", valor: numero(e.eventosJaProntos) }]
          : []),
        ...(props === "idx" && heavy
          ? [{ chave: "props.conf here", valor: "no effect", ativo: true as const }]
          : []),
      ];
    }
    if (id === "indice") {
      return [
        { chave: "events", valor: numero(e.eventosNoIndice) },
        { chave: "stack traces · whole", valor: numero(e.inteiros) },
        {
          chave: "stack traces · in pieces",
          valor: numero(e.partidos),
          ...(e.partidos > 0 ? { ativo: true as const } : {}),
        },
      ];
    }
    return undefined;
  };

  const readouts: Record<string, string> = {
    app: `${numero(e.registrosEscritos)} records · ${numero(e.multilinhasEscritos)} multi-line`,
    uf: `${numero(e.blocosEnviados)} blocks of 64 KiB`,
    meio: heavy ? "heavy forwarder · parses" : "forwards blocks · parses nothing",
    idx: heavy ? "indexing only" : "parsing + indexing",
    indice: `${numero(e.eventosNoIndice)} events`,
  };

  /** O enchimento do bloco: a barra de sempre, e a razão do atraso. */
  const fills: Record<string, number> = { uf: e.enchimentoDoBloco };

  return (
    <div className="splunk-ingest">
      <div className="splunk-ingest__palco">
        <Explorer
          tree={arvore}
          wires={spec.wires}
          state={mundo.state}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={600}
          views={VIEWS_DA_INGESTAO}
          inicial="ingestao"
          readouts={readouts}
          fills={fills}
          conteudo={conteudo}
          comFicha
          chaveDaCarga={LEITOR_DA_CARGA.chave}
          cargaSeguida={seguindo}
          onSeguirCarga={seguirCarga}
          painelDaCarga={
            <PainelDaCarga
              titulo={seguindo ?? ""}
              trajeto={trajeto}
              onFechar={() => seguirCarga(undefined)}
              vazio="This record has already landed. Click another block on a wire to follow it — and watch the moment it stops being a block and starts being events."
            />
          }
        />

        <div className="splunk-ingest__placar">
          <p className="splunk-ingest__pergunta">
            The application wrote a {controles["linhas-do-registro"]}-line stack trace. Is it one
            event in the index?
          </p>

          {/* A tabela-verdade resolvida. É a frase, e ela é o lab. */}
          <p className="splunk-ingest__veredito" data-vale={vale ? "sim" : "nao"}>
            <span>
              <code>props.conf</code> is installed on the <b>{NOME_DA_MAQUINA[props]}</b>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              the parsing phase runs on the <b>{NOME_DA_MAQUINA[cozinha]}</b>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              so the line breaking <b>{vale ? "takes effect" : "has no effect at all"}</b>
            </span>
          </p>

          <div className="splunk-ingest__respostas">
            <div className="splunk-ingest__resposta">
              <span className="splunk-ingest__rotulo">stack traces · searchable as one</span>
              <b className="mono">{numero(e.inteiros)}</b>
              <span className="splunk-ingest__nota">
                of {numero(e.multilinhasEscritos)} the application wrote
              </span>
            </div>
            <div
              className="splunk-ingest__resposta"
              data-destaque={e.partidos > 0 ? "quebrado" : undefined}
            >
              <span className="splunk-ingest__rotulo">stack traces · in pieces</span>
              <b className="mono">{numero(e.partidos)}</b>
              <span className="splunk-ingest__nota">
                {e.partidos > 0
                  ? "in the index, one event per line, and nothing reports it"
                  : "the line breaking is on the machine that runs the phase"}
              </span>
            </div>
            <div
              className="splunk-ingest__resposta"
              data-destaque={e.eventosPorRegistroPartido > 1 ? "true" : undefined}
            >
              <span className="splunk-ingest__rotulo">events per stack trace</span>
              <b className="mono">
                {e.partidos === 0 ? (e.inteiros > 0 ? "1" : "—") : e.eventosPorRegistroPartido}
              </b>
              <span className="splunk-ingest__nota">
                {e.eventosPorRegistroPartido > 1
                  ? "the licence pays for every one of them"
                  : "one record, one event"}
              </span>
            </div>
          </div>
        </div>

        <div className="splunk-ingest__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <span className="splunk-ingest__tick mono">t{tick}</span>

          <label className="splunk-ingest__switch">
            <input
              type="checkbox"
              checked={heavy}
              onChange={(ev) => mexer("meio-cozinha", ev.target.checked ? 1 : 0)}
            />
            the middle tier is a <b>heavy forwarder</b>
          </label>

          <fieldset className="splunk-ingest__escolha">
            <legend>
              <code>props.conf</code> for this source type is installed on
            </legend>
            {LUGARES_DO_PROPS.map((lugar, i) => (
              <label key={lugar}>
                <input
                  type="radio"
                  name="props-em"
                  checked={controles["props-em"] === i}
                  onChange={() => mexer("props-em", i)}
                />
                {NOME_DA_MAQUINA[lugar]}
              </label>
            ))}
          </fieldset>

          <label className="splunk-ingest__campo">
            <span>
              records per second <b className="mono">{controles["registros-por-tick"]}</b>
            </span>
            <input
              type="range"
              min={0}
              max={120}
              step={10}
              value={controles["registros-por-tick"]}
              onChange={(ev) => mexer("registros-por-tick", Number(ev.target.value))}
            />
          </label>

          <label className="splunk-ingest__campo">
            <span>
              lines in a stack trace <b className="mono">{controles["linhas-do-registro"]}</b>
            </span>
            <input
              type="range"
              min={2}
              max={40}
              step={1}
              value={controles["linhas-do-registro"]}
              onChange={(ev) => mexer("linhas-do-registro", Number(ev.target.value))}
            />
          </label>

          <label className="splunk-ingest__campo">
            <span>
              one record in <b className="mono">{controles["multilinha-a-cada"]}</b> is multi-line
            </span>
            <input
              type="range"
              min={2}
              max={60}
              step={1}
              value={controles["multilinha-a-cada"]}
              onChange={(ev) => mexer("multilinha-a-cada", Number(ev.target.value))}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
