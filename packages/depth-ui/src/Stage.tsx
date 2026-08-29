import { useEffect, useState } from "react";
import { familyOf } from "@ovh/depth-core";
import type { Family, TreeIndex, Wire, WorldState } from "@ovh/depth-core";
import type { NodePlacement, View } from "./view.js";

/**
 * O palco: uma view desenhada, com o estado do mundo por cima.
 *
 * Nada aqui inventa nada. As caixas vêm da view, as linhas vêm dos fios, e o
 * movimento vem do livro-caixa — **a diferença entre o tick anterior e este**.
 * Uma animação que rodasse por conta própria seria enfeite bonito mentindo
 * sobre o que aconteceu, que é exatamente o que este projeto não faz.
 *
 * A família escolhe a forma e o gesto: `processor` tem engrenagem e ela só gira
 * quando ele agiu; `container` é moldura e nunca se mexe; `controller` fica na
 * cor do sinal e as linhas dele são tracejadas.
 */

export interface StageProps {
  readonly tree: TreeIndex;
  readonly wires: readonly Wire[];
  readonly view: View;
  readonly state: WorldState;
  /** O tick anterior. Sem ele não há movimento — só uma foto. */
  readonly previous?: WorldState | undefined;
  readonly edgeTicks?: number;
  /** Duração de um tick na tela, em ms. É o compasso de toda animação. */
  readonly tickMs?: number;
  /** Quanto cada objeto está cheio, de 0 a 1. Quem sabe é o modelo. */
  readonly fills?: Readonly<Record<string, number>> | undefined;
  /** O valor que cada objeto mostra agora. Quem sabe é o modelo. */
  readonly readouts?: Readonly<Record<string, string>> | undefined;
  readonly selected?: string | undefined;
  readonly onSelect?: (id: string) => void;
  readonly onOpen?: (id: string) => void;
}

interface Ponto {
  readonly x: number;
  readonly y: number;
}

const centro = (p: NodePlacement): Ponto => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });

/**
 * O caminho de um fio, em cotovelos retos — é assim que esquemático se desenha,
 * e a diagonal esconderia por onde a linha passa.
 *
 * Quando o destino está atrás da origem, a linha desce para uma faixa livre e
 * volta por baixo: é a realimentação, e ela precisa **parecer** uma volta.
 */
function caminho(de: NodePlacement, para: NodePlacement, faixa: number): string {
  const a = centro(de);
  const b = centro(para);
  const saida = { x: de.x + de.w, y: a.y };

  // Para a frente: sai pela direita, entra pela esquerda, com um cotovelo no
  // meio. É a leitura natural, e é a maioria dos fios.
  if (para.x >= saida.x + 16) {
    const meio = (saida.x + para.x) / 2;
    return `M ${saida.x} ${saida.y} H ${meio} V ${b.y} H ${para.x}`;
  }

  // Destino claramente abaixo ou acima: **desce (ou sobe) pela borda de baixo**,
  // em vez de sair de lado e cruzar tudo na altura do meio. É o barramento indo
  // até a memória, e é assim que a figura de livro desenha.
  const abaixo = para.y > de.y + de.h + 8;
  const acima = para.y + para.h + 8 < de.y;
  if (abaixo || acima) {
    const lane = abaixo
      ? (de.y + de.h + para.y) / 2 + (faixa % 24) - 12
      : (para.y + para.h + de.y) / 2 + (faixa % 24) - 12;
    const inicioY = abaixo ? de.y + de.h : de.y;
    const fimY = abaixo ? para.y : para.y + para.h;
    return `M ${a.x} ${inicioY} V ${lane} H ${b.x} V ${fimY}`;
  }

  // Sobrepostos na vertical: a linha precisa PARECER uma volta. Sai pela
  // direita, contorna por baixo dos dois e entra pela borda de baixo.
  const lane = Math.max(de.y + de.h, para.y + para.h) + faixa;
  return `M ${saida.x} ${saida.y} H ${saida.x + 14} V ${lane} H ${b.x} V ${para.y + para.h}`;
}

/** O que mudou no livro-caixa entre dois estados. É a fonte de todo movimento. */
function delta(
  state: WorldState,
  previous: WorldState | undefined,
): Readonly<Record<string, number>> {
  const antes = previous?.ledger ?? {};
  const saida: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(state.ledger)) {
    const diferenca = valor - (antes[chave] ?? 0);
    if (diferenca !== 0) saida[chave] = diferenca;
  }
  return saida;
}

function usaMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzido(consulta.matches);
    const ouvir = (e: MediaQueryListEvent): void => setReduzido(e.matches);
    consulta.addEventListener("change", ouvir);
    return () => consulta.removeEventListener("change", ouvir);
  }, []);
  return reduzido;
}

/** A engrenagem: oito dentes, e só gira quando o objeto agiu neste tick. */
function Engrenagem({ x, y, r }: { x: number; y: number; r: number }) {
  const dentes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return (
      <rect
        key={i}
        className="dui-stage__dente"
        x={-r * 0.16}
        y={-r * 1.34}
        width={r * 0.32}
        height={r * 0.42}
        rx={r * 0.08}
        transform={`rotate(${(a * 180) / Math.PI})`}
      />
    );
  });
  return (
    <g className="dui-stage__engrenagem" transform={`translate(${x} ${y})`}>
      <g className="dui-stage__gira">
        {dentes}
        <circle r={r} />
        <circle className="dui-stage__eixo" r={r * 0.38} />
      </g>
    </g>
  );
}

export function Stage({
  tree,
  wires,
  view,
  state,
  previous,
  edgeTicks = 1,
  tickMs = 700,
  fills,
  readouts,
  selected,
  onSelect,
  onOpen,
}: StageProps) {
  const reduzido = usaMovimentoReduzido();
  const mudou = delta(state, previous);
  const lugares = new Map(view.places.map((p) => [p.id, p]));

  // Contêineres primeiro: eles são moldura, e moldura desenhada por cima
  // esconderia o que ela emoldura.
  const ordenados = [...view.places].sort((a, b) => b.w * b.h - a.w * a.h);

  /**
   * A família de cada objeto — e uma correção que vem do modelo, não da view:
   * quem só emite por linha de controle **é** controlador, tenha o `kind` que
   * tiver. Enquanto o catálogo não tem um `kind` dessa família, é o desenho que
   * lê o fato onde ele está escrito: nos fios.
   */
  const familia = (id: string): Family => {
    const node = tree.byId.get(id);
    const base = node === undefined ? "container" : familyOf(node.kind);
    if (base !== "processor") return base;
    const saindo = wires.filter((w) => w.from === id);
    if (saindo.length > 0 && saindo.every((w) => (w.line ?? "data") === "control")) {
      return "controller";
    }
    return base;
  };

  const ativo = (id: string): boolean =>
    Object.entries(mudou).some(
      ([chave, quanto]) =>
        quanto > 0 &&
        (chave.startsWith(`out:${id}.`) ||
          chave === `in:${id}` ||
          chave.startsWith(`sigin:${id}.`)),
    );

  /** Fios desenháveis: os dois pontos precisam estar na view. */
  const arestas = wires
    .map((wire, i) => {
      const de = lugares.get(wire.from);
      const para = typeof wire.to === "string" ? lugares.get(wire.to) : undefined;
      if (de === undefined || para === undefined) return null;
      const linha = wire.line ?? "data";
      const d = caminho(de, para, 18 + (i % 3) * 12);
      return {
        chave: `${wire.from}.${wire.port}->${String(wire.to)}`,
        to: String(wire.to),
        d,
        linha,
        timing: wire.timing ?? "clocked",
        width: wire.width,
        // Uma emissão na porta acende todos os fios que saem dela: é o leque,
        // e mostrar só o primeiro seria voltar a mentir sobre o percurso.
        acesa: (mudou[`out:${wire.from}.${wire.port}`] ?? 0) > 0,
        from: wire.from,
        port: wire.port,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // A carga em voo só sabe de onde veio e para onde vai; o fio que a leva é o
  // primeiro que liga os dois. Com leque, as cópias são itens distintos, cada
  // uma com o seu destino, então nenhuma some no caminho de outra.
  const trilhoEntre = new Map<string, string>();
  for (const aresta of arestas) {
    const chave = `${aresta.from}->${aresta.to}`;
    if (!trilhoEntre.has(chave)) trilhoEntre.set(chave, aresta.d);
  }

  const identificador = (chave: string): string =>
    `dui-fio-${chave.replace(/[^a-zA-Z0-9-]/g, "_")}`;

  return (
    <svg
      className="dui-stage"
      viewBox={`0 0 ${view.width} ${view.height}`}
      role="img"
      aria-label={view.title}
      style={{ ["--dui-tick" as string]: `${tickMs}ms` }}
    >
      <defs>
        <marker
          id="dui-seta"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L8 4 L0 8 z" />
        </marker>
      </defs>

      <g className="dui-stage__fios">
        {arestas.map((aresta) => (
          <g
            key={aresta.chave}
            className="dui-stage__fio"
            data-linha={aresta.linha}
            data-timing={aresta.timing}
            data-acesa={aresta.acesa ? "true" : undefined}
          >
            <path
              id={identificador(aresta.chave)}
              className="dui-stage__trilho"
              d={aresta.d}
              markerEnd="url(#dui-seta)"
            />
            {aresta.acesa && !reduzido ? (
              <path key={`p${state.tick}`} className="dui-stage__pulso" d={aresta.d}>
                <animate
                  attributeName="stroke-dashoffset"
                  from="120"
                  to="-40"
                  dur={`${tickMs * 0.7}ms`}
                  fill="freeze"
                />
              </path>
            ) : null}
            {aresta.width !== undefined ? (
              <text className="dui-stage__largura" dy="-4">
                <textPath href={`#${identificador(aresta.chave)}`} startOffset="50%">
                  {`/${aresta.width}`}
                </textPath>
              </text>
            ) : null}
          </g>
        ))}
      </g>

      {/* a carga em voo: cada item é uma coisa, e viaja pelo fio que o leva */}
      <g className="dui-stage__cargas">
        {state.flight.map((item) => {
          const trilho = trilhoEntre.get(`${item.from}->${String(item.to)}`);
          if (trilho === undefined) return null;
          const andou = (state.tick - item.sent) / edgeTicks;
          return (
            <circle
              key={`${item.id}:${state.tick}`}
              className="dui-stage__carga"
              data-kind={item.message.kind}
              data-sinal={item.signalPort !== undefined ? "true" : undefined}
              r={5}
            >
              {reduzido ? null : (
                <animateMotion
                  dur={`${tickMs}ms`}
                  path={trilho}
                  keyPoints={`${andou};${Math.min(1, andou + 1 / edgeTicks)}`}
                  keyTimes="0;1"
                  calcMode="linear"
                  fill="freeze"
                />
              )}
            </circle>
          );
        })}
      </g>

      <g className="dui-stage__objetos">
        {ordenados.map((place) => {
          const node = tree.byId.get(place.id);
          const fam = familia(place.id);
          const cheio = fills?.[place.id];
          const leitura = readouts?.[place.id];
          const rotulo = place.label ?? node?.label ?? place.id;
          const agindo = ativo(place.id);
          return (
            <g
              key={place.id}
              className="dui-stage__objeto"
              data-familia={fam}
              data-ativo={agindo ? "true" : undefined}
              data-fechado={place.collapsed === true ? "true" : undefined}
              data-selecionado={place.id === selected ? "true" : undefined}
              tabIndex={0}
              role="button"
              aria-label={`${rotulo}${leitura === undefined ? "" : `: ${leitura}`}`}
              onClick={() => onSelect?.(place.id)}
              onDoubleClick={() => onOpen?.(place.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen?.(place.id);
                if (e.key === " ") onSelect?.(place.id);
              }}
            >
              <rect
                className="dui-stage__caixa"
                x={place.x}
                y={place.y}
                width={place.w}
                height={place.h}
                rx={fam === "container" ? 14 : 8}
              />
              {cheio !== undefined ? (
                <rect
                  className="dui-stage__nivel"
                  x={place.x + 2}
                  y={place.y + place.h - 2 - (place.h - 4) * Math.max(0, Math.min(1, cheio))}
                  width={place.w - 4}
                  height={(place.h - 4) * Math.max(0, Math.min(1, cheio))}
                  rx={6}
                />
              ) : null}

              {fam === "container" ? (
                <text className="dui-stage__titulo" x={place.x + 12} y={place.y + 18}>
                  {rotulo}
                </text>
              ) : (
                <>
                  {fam === "processor" && place.h >= 34 ? (
                    <Engrenagem x={place.x + place.w - 16} y={place.y + 16} r={6} />
                  ) : null}
                  <text
                    className="dui-stage__rotulo"
                    x={place.x + place.w / 2}
                    y={place.y + (leitura === undefined ? place.h / 2 + 4 : place.h / 2 - 3)}
                    textAnchor="middle"
                  >
                    {rotulo}
                  </text>
                  {leitura !== undefined ? (
                    <text
                      className="dui-stage__leitura"
                      x={place.x + place.w / 2}
                      y={place.y + place.h / 2 + 13}
                      textAnchor="middle"
                    >
                      {leitura}
                    </text>
                  ) : null}
                </>
              )}

              {place.badge !== undefined ? (
                <text className="dui-stage__marca" x={place.x + place.w - 8} y={place.y + place.h - 8} textAnchor="end">
                  {place.badge}
                </text>
              ) : null}
              {place.collapsed === true ? (
                <text className="dui-stage__abrir" x={place.x + 10} y={place.y + place.h - 9}>
                  há mais aqui dentro
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
