import { useEffect, useMemo, useRef, useState } from "react";
import { World, indexTree, seguir } from "@ovh/depth-core";
import type { Parada } from "@ovh/depth-core";
import {
  anatomiaWorld,
  estadoDaAnatomia,
  LEITOR_DA_CHAMADA,
  MAL_ENTENDIDOS_DA_ANATOMIA,
  PARAMS_DA_ANATOMIA,
  SERVICOS,
  VIEWS_DA_ANATOMIA,
} from "@ovh/otel-domain";
import type { NoDaArvore } from "@ovh/otel-domain";
import { Explorer } from "./Explorer.js";
import { PainelDaCarga } from "./PainelDaCarga.js";

/**
 * O lab da anatomia de um trace.
 *
 * A tese é geométrica no palco — a chamada anda para frente, o span sai para
 * baixo, ninguém manda árvore para lugar nenhum — e o painel mostra a **árvore
 * que o backend consegue montar** com o que chegou. Ela é uma conclusão, e não
 * um objeto do run: se um span não chegou, a árvore fecha sem ele e continua
 * parecendo uma árvore.
 *
 * Os três controles são defeitos de campo, e nenhum deles produz erro nenhum —
 * que é justamente o que eles ensinam.
 */

const CONTROLES = [
  "requisicoes-por-tick",
  "derrubar-cabecalho-em",
  "sem-instrumentacao",
  "taxa-de-amostragem",
  "ignorar-amostragem",
] as const;

type Controle = (typeof CONTROLES)[number];

const INICIAIS: Record<Controle, number> = {
  "requisicoes-por-tick": PARAMS_DA_ANATOMIA["requisicoes-por-tick"]!,
  "derrubar-cabecalho-em": PARAMS_DA_ANATOMIA["derrubar-cabecalho-em"]!,
  "sem-instrumentacao": PARAMS_DA_ANATOMIA["sem-instrumentacao"]!,
  "taxa-de-amostragem": PARAMS_DA_ANATOMIA["taxa-de-amostragem"]!,
  "ignorar-amostragem": PARAMS_DA_ANATOMIA["ignorar-amostragem"]!,
};

/** Os limites, nomeados como o leitor os vê: quem entrega para quem. */
const FRONTEIRAS = SERVICOS.slice(0, -1).map((servico, i) => ({
  valor: i + 1,
  nome: `${servico} → ${SERVICOS[i + 1]}`,
}));

/** Só o meio: derrubar a instrumentação da ponta é outro assunto. */
const DO_MEIO = SERVICOS.slice(1, -1).map((servico, i) => ({ valor: i + 2, nome: servico }));

function Galho({ no, nivel }: { readonly no: NoDaArvore; readonly nivel: number }) {
  return (
    <>
      <li style={{ marginInlineStart: `${nivel * 1.2}rem` }} data-orfao={no.orfao ? "true" : undefined}>
        <b className="mono">{no.span.servico}</b>{" "}
        <span className="anatomia-lab__id mono">{no.span.spanId.slice(0, 8)}</span>
        {no.orfao ? <em> · parent never arrived</em> : null}
      </li>
      {no.filhos.map((filho) => (
        <Galho key={filho.span.spanId} no={filho} nivel={nivel + 1} />
      ))}
    </>
  );
}

export function AnatomiaLab() {
  const [controles, setControles] = useState<Record<Controle, number>>(INICIAIS);
  const [tick, setTick] = useState(0);
  const [rodando, setRodando] = useState(true);
  /**
   * A carga que o leitor está seguindo, e o trajeto dela.
   *
   * O trajeto é acumulado **enquanto o mundo anda**, e não recalculado: ele é o
   * registro do que aconteceu, que é a única coisa honesta a mostrar. Refazê-lo
   * a partir do estado atual exigiria adivinhar o passado.
   */
  const [seguindo, setSeguindo] = useState<string | undefined>(undefined);
  const [trajeto, setTrajeto] = useState<readonly Parada[]>([]);
  const seguindoRef = useRef<string | undefined>(undefined);
  seguindoRef.current = seguindo;
  const mundoRef = useRef<World | null>(null);

  const spec = useMemo(() => anatomiaWorld(INICIAIS), []);
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
        setTrajeto((antes) => seguir(antes, m.state, chave, LEITOR_DA_CHAMADA));
      }
    }, 700);
    return () => window.clearInterval(id);
  }, [rodando, mundo]);

  const mexer = (nome: Controle, valor: number): void => {
    mundoRef.current?.setParam(nome, valor);
    setControles((c) => ({ ...c, [nome]: valor }));
  };

  const e = estadoDaAnatomia(mundo.state);

  const seguirCarga = (chave: string | undefined): void => {
    setSeguindo(chave);
    // Trajeto novo a cada escolha: misturar o de duas cargas seria o painel
    // afirmando um percurso que ninguém andou.
    setTrajeto(
      chave === undefined ? [] : seguir([], mundo.state, chave, LEITOR_DA_CHAMADA),
    );
  };

  const readouts: Record<string, string> = Object.fromEntries([
    ["edge", `${e.requisicoes}`],
    ["backend", `${e.spansChegados} spans`],
    ...e.porServico.map((s) => [s.servico, `${s.exportados} exported`] as const),
  ]);

  const conteudo = (id: string) => {
    if (id !== "backend") return undefined;
    return e.arvores.flatMap((a) => [
      { chave: `trace ${a.traceId.slice(0, 8)}…`, valor: `${a.spans} spans`, ativo: true },
      ...a.servicos.map((servico) => ({ chave: `  ${servico}`, valor: "" })),
    ]);
  };

  return (
    <div className="anatomia-lab">
      <div className="anatomia-lab__palco">
        <Explorer
          tree={arvore}
          wires={spec.wires}
          state={mundo.state}
          previous={mundo.previousState}
          edgeTicks={spec.edgeTicks ?? 1}
          tickMs={700}
          views={VIEWS_DA_ANATOMIA}
          inicial="sistema"
          readouts={readouts}
          conteudo={conteudo}
          comFicha
          chaveDaCarga={LEITOR_DA_CHAMADA.chave}
          cargaSeguida={seguindo}
          onSeguirCarga={seguirCarga}
          painelDaCarga={
            <PainelDaCarga
              titulo={seguindo ?? ""}
              trajeto={trajeto}
              onFechar={() => seguirCarga(undefined)}
              vazio="This one has already left the system. Click another item on a wire to follow it."
            />
          }
        />

        <div className="anatomia-lab__controles">
          <button type="button" onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pause" : "Run"}
          </button>
          <span className="anatomia-lab__tick mono">t{tick}</span>

          <label className="anatomia-lab__campo">
            <span>drop the header at</span>
            <select
              value={controles["derrubar-cabecalho-em"]}
              onChange={(ev) => mexer("derrubar-cabecalho-em", Number(ev.target.value))}
            >
              <option value={0}>nowhere</option>
              {FRONTEIRAS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="anatomia-lab__campo">
            <span>uninstrumented service</span>
            <select
              value={controles["sem-instrumentacao"]}
              onChange={(ev) => mexer("sem-instrumentacao", Number(ev.target.value))}
            >
              <option value={0}>none</option>
              {DO_MEIO.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="anatomia-lab__campo">
            <span>
              head sampling <b className="mono">{Math.round(controles["taxa-de-amostragem"] * 100)}%</b>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.25}
              value={controles["taxa-de-amostragem"]}
              onChange={(ev) => mexer("taxa-de-amostragem", Number(ev.target.value))}
            />
          </label>

          <label className="anatomia-lab__switch">
            <input
              type="checkbox"
              checked={controles["ignorar-amostragem"] === 1}
              onChange={(ev) => mexer("ignorar-amostragem", ev.target.checked ? 1 : 0)}
            />
            Downstream services decide sampling on their own
          </label>
        </div>
      </div>

      {/*
        A árvore que o backend consegue montar.

        Ela é montada na LEITURA, e é por isso que ela mora aqui e não no palco:
        durante o run ela não existe em lugar nenhum. O contador de árvores é a
        peça que denuncia — uma requisição que produz duas é o cabeçalho perdido,
        e nenhuma das duas se sabe incompleta.
      */}
      <section className="anatomia-lab__arvore" aria-label="The tree the backend can build">
        <h3>
          The tree the backend can build for request{" "}
          <b className="mono">#{e.ultimaRequisicao}</b>
        </h3>
        <p className="anatomia-lab__resumo mono" data-arvores={e.arvores.length}>
          {e.arvores.length === 1
            ? "one trace, as it should be"
            : `${e.arvores.length} traces for one request — and none of them knows it is half of something`}
          {e.orfaos > 0 ? ` · ${e.orfaos} orphaned` : ""}
          {e.saltosSemSpan.length > 0
            ? ` · ${e.saltosSemSpan.join(", ")} handled it and exported nothing`
            : ""}
        </p>
        {e.arvores.map((a) => (
          <ul key={a.traceId} className="anatomia-lab__galhos">
            <li className="anatomia-lab__trace mono">trace {a.traceId.slice(0, 16)}…</li>
            {a.raizes.map((raiz) => (
              <Galho key={raiz.span.spanId} no={raiz} nivel={1} />
            ))}
          </ul>
        ))}
        <p className="anatomia-lab__nota">
          Nothing emits an &ldquo;end of trace&rdquo;. The panel shows a request that has
          been quiet for a couple of ticks — which is the only thing a backend can do:
          wait, and give up.
        </p>
      </section>

      <section className="anatomia-lab__erros" aria-label="What people get wrong">
        <h3>What people get wrong</h3>
        <dl>
          {MAL_ENTENDIDOS_DA_ANATOMIA.map((m) => (
            <div key={m.crenca}>
              <dt>{m.crenca}</dt>
              <dd>
                {m.spec}{" "}
                <a href={m.fonte} rel="noopener">
                  spec&nbsp;→
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
