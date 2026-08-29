import { useEffect, useMemo, useRef, useState } from "react";
import { emissoesPorPorta, familyOf } from "@ovh/depth-core";
import type {
  EmissaoDaPorta,
  Family,
  Message,
  TreeIndex,
  Wire,
  WorldState,
} from "@ovh/depth-core";
import type { NodePlacement, View } from "./view.js";
import { resumoDoKind } from "./kinds.js";
import { PROFUNDIDADE_MAXIMA, ZOOM_MAXIMO, encaixar, quantoAparece } from "./lod.js";

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
  /**
   * Quem está com a saída em alto. Quem sabe é o **domínio**, não o desenho.
   *
   * Já foi derivável daqui: numa codificação em que a presença da mensagem era
   * o nível alto, "acendeu" e "emitiu" eram a mesma coisa, e bastava ler o
   * livro-caixa. Quando a mensagem passou a carregar o bit, toda porta passou a
   * emitir todo tick — e continuar lendo a contagem acenderia o circuito
   * inteiro, sempre. Seria o desenho afirmando algo que o modelo não disse.
   *
   * O motor não sabe o que é um bit, então quem responde é quem sabe: o domínio
   * lê `WorldState.settled` e entrega o conjunto pronto.
   */
  readonly altos?: ReadonlySet<string> | undefined;
  readonly selected?: string | undefined;
  readonly onSelect?: (id: string) => void;
  readonly onOpen?: (id: string) => void;
  /**
   * O interior de uma caixa fechada, quando existe view para ele.
   *
   * É o que liga o zoom contínuo: aproximar uma caixa até ela ficar grande na
   * tela revela o que tem dentro, **dentro dela**, em vez de trocar a tela.
   * Quem responde é o domínio, porque é ele que tem as views.
   *
   * Só vale para caixa `collapsed`: uma caixa aberta já desenha os filhos nesta
   * mesma view, e desenhar o interior por cima contaria a mesma coisa duas
   * vezes. `collapsed` é exatamente "os filhos existem e não estão desenhados".
   */
  readonly interiores?: ((id: string) => View | undefined) | undefined;
  /**
   * O que a carga mostra na esteira: o valor que ela leva, em dois ou três
   * caracteres.
   *
   * Quem lê o dado é o **domínio**. O motor sabe que uma mensagem tem `kind`,
   * `weight` e `data`; o que aquele `data` significa só o modelo sabe, e o
   * desenho não pode adivinhar sem inventar.
   *
   * Sem isto a carga andava pela linha como um ponto anônimo. Ela é o item na
   * esteira: se não dá para ler o que ela leva, não dá para ver a
   * transformação, que é a coisa toda.
   */
  readonly leituraDaCarga?: ((mensagem: Message) => string | undefined) | undefined;
}

interface CamadaProps extends StageProps {
  /**
   * A largura do quadro visível, **nas unidades desta camada**.
   *
   * É daqui que sai o nível de detalhe, e é de propósito que não seja pixel: a
   * pergunta que decide se um interior aparece é "esta caixa ocupa quanto do
   * quadro?", que não depende do tamanho do monitor nem do nível em que a
   * camada está.
   */
  readonly unidadesPorQuadro: number;
  readonly profundidade: number;
  /**
   * O que cada porta emitiu, já com os bornes de saída resolvidos.
   *
   * Vem pronto da casca porque a resolução percorre a árvore inteira: fazê-la
   * dentro de cada camada custaria isso vezes o número de interiores abertos,
   * a cada quadro.
   */
  readonly emissoes: Readonly<Record<string, EmissaoDaPorta>>;
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
interface Retangulo {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const cruzaVertical = (x: number, y1: number, y2: number, r: Retangulo): boolean =>
  x > r.x - 6 && x < r.x + r.w + 6 && Math.max(y1, y2) > r.y - 6 && Math.min(y1, y2) < r.y + r.h + 6;

const cruzaHorizontal = (y: number, x1: number, x2: number, r: Retangulo): boolean =>
  y > r.y - 6 && y < r.y + r.h + 6 && Math.max(x1, x2) > r.x - 6 && Math.min(x1, x2) < r.x + r.w + 6;

/** O primeiro candidato que não passa por cima de ninguém, ou o primeiro. */
function escolher(
  candidatos: readonly number[],
  livre: (valor: number) => boolean,
): number {
  return candidatos.find(livre) ?? candidatos[0] ?? 0;
}

/**
 * O caminho de um fio, em cotovelos retos — é assim que esquemático se desenha,
 * e a diagonal esconderia por onde a linha passa.
 *
 * O cotovelo **desvia de quem estiver no caminho**. Uma linha que atravessa uma
 * caixa parece entrar nela, e o leitor passa a ver uma ligação que não existe —
 * é mentira de desenho, e custa o mesmo tanto que mentira de número.
 */
function caminho(
  de: NodePlacement,
  para: NodePlacement,
  faixa: number,
  obstaculos: readonly Retangulo[],
): string {
  const a = centro(de);
  const b = centro(para);
  const saida = { x: de.x + de.w, y: a.y };
  const outros = obstaculos.filter((r) => r !== de && r !== para);

  // Para a frente: sai pela direita, entra pela esquerda, com um cotovelo no
  // meio. É a leitura natural, e é a maioria dos fios.
  if (para.x >= saida.x + 16) {
    const meio = (saida.x + para.x) / 2;
    const candidatos = [meio, meio - 14, meio + 14, saida.x + 12, para.x - 12];
    const x = escolher(candidatos, (c) =>
      outros.every((r) => !cruzaVertical(c, saida.y, b.y, r)),
    );
    return `M ${saida.x} ${saida.y} H ${x} V ${b.y} H ${para.x}`;
  }

  // Destino claramente abaixo ou acima: **desce (ou sobe) pela borda**, em vez
  // de sair de lado e cruzar tudo na altura do meio. É o barramento indo até a
  // memória, e é assim que a figura de livro desenha.
  const abaixo = para.y > de.y + de.h + 8;
  const acima = para.y + para.h + 8 < de.y;
  if (abaixo || acima) {
    const entre = abaixo
      ? [(de.y + de.h + para.y) / 2, para.y - 16, de.y + de.h + 16]
      : [(para.y + para.h + de.y) / 2, para.y + para.h + 16, de.y - 16];
    const candidatos = entre.flatMap((c) => [c, c - 12, c + 12, c - 24, c + 24]);
    const lane = escolher(candidatos, (c) =>
      outros.every((r) => !cruzaHorizontal(c, a.x, b.x, r)),
    );
    const inicioY = abaixo ? de.y + de.h : de.y;
    const fimY = abaixo ? para.y : para.y + para.h;
    return `M ${a.x} ${inicioY} V ${lane} H ${b.x} V ${fimY}`;
  }

  // Sobrepostos na vertical: a linha precisa PARECER uma volta. Sai pela
  // direita, contorna por baixo dos dois e entra pela borda de baixo.
  const base = Math.max(de.y + de.h, para.y + para.h);
  const lane = escolher(
    [base + faixa, base + faixa + 14, base + faixa + 28, base + faixa - 10],
    (c) => outros.every((r) => !cruzaHorizontal(c, saida.x + 14, b.x, r)),
  );
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


/**
 * O item na esteira.
 *
 * Ele era um ponto anônimo: dava para ver que **alguma coisa** andava na linha,
 * e não o que era nem o que levava. Rastrear a transformação — a coisa que este
 * motor existe para mostrar — exige que a carga tenha identidade na tela: a
 * forma dela (`kind`), o valor que leva, e de onde para onde vai.
 *
 * O `kind` muda quando a carga atravessa quem a transforma, e é por isso que
 * segui-la é entender o sistema: o que entra num bloco com um nome sai com
 * outro, e a linha entre os dois mostra exatamente onde isso aconteceu.
 */
function Carga({
  mensagem,
  leitura,
  raio,
  de,
  para,
}: {
  mensagem: Message;
  leitura: string | undefined;
  raio: number;
  de: string;
  para: string;
}) {
  return (
    <>
      {/* O hover é o mesmo gesto que já responde "o que é esta peça?": bateu a
          dúvida sobre o que está passando, a resposta está sob o cursor. */}
      <title>
        {`${mensagem.kind}${leitura === undefined ? "" : ` · ${leitura}`}\n${de} → ${para}${
          mensagem.weight > 1 ? `\n${mensagem.weight} itens` : ""
        }`}
      </title>
      <circle className="dui-stage__carga" r={raio} />
      {leitura === undefined ? null : (
        // Ao lado, e não em cima: por cima do ponto o valor fica ilegível
        // justamente quando a linha está acesa, que é quando se quer lê-lo.
        <text className="dui-stage__carga-valor" x={raio + 3} y={-raio - 1}>
          {leitura}
        </text>
      )}
      {mensagem.weight > 1 ? (
        <text className="dui-stage__carga-peso" x={0} y={raio + 9} textAnchor="middle">
          {`×${mensagem.weight}`}
        </text>
      ) : null}
    </>
  );
}

function Camada({
  tree,
  wires,
  view,
  state,
  previous,
  edgeTicks = 1,
  tickMs = 700,
  fills,
  readouts,
  altos,
  selected,
  onSelect,
  onOpen,
  interiores,
  leituraDaCarga,
  unidadesPorQuadro,
  profundidade,
  emissoes,
}: CamadaProps) {
  const reduzido = usaMovimentoReduzido();
  const mudou = delta(state, previous);
  const lugares = new Map(view.places.map((p) => [p.id, p]));

  /**
   * O atraso de cada objeto dentro do tick: o subpasso em que ele rodou, dito
   * pelo modelo. É o que faz a acomodação **acontecer na tela** em vez de
   * aparecer pronta — e o que se vê é atraso de propagação, não estilo.
   */
  const passos = Math.max(1, state.substeps);
  const atrasoDe = (id: string): number => {
    const passo = state.substepOf[id];
    return passo === undefined ? 0 : (passo / passos) * tickMs * 0.8;
  };

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
    let base = node === undefined ? "container" : familyOf(node.kind);

    // Uma caixa recolhida não é moldura: ela **é** a coisa que está dentro
    // dela, e é por isso que dá para entrar. Desenhá-la como moldura tira dela
    // a forma e o gesto do que ela representa — a ULA recolhida ficava sem
    // engrenagem, com um somador de trinta e dois bits girando lá dentro.
    if (base === "container" && recolhida(id)) base = familiaDoInterior(id) ?? base;

    if (base !== "processor") return base;
    const saindo = wires.filter((w) => w.from === id);
    if (saindo.length > 0 && saindo.every((w) => (w.line ?? "data") === "control")) {
      return "controller";
    }
    return base;
  };

  /** Esta caixa está desenhada fechada nesta view? */
  const recolhida = (id: string): boolean =>
    view.places.find((p) => p.id === id)?.collapsed === true;

  /**
   * A família do que mora dentro. `processor` ganha de tudo: uma caixa que
   * guarda qualquer coisa que processa é, vista de fora, uma coisa que
   * processa.
   */
  const familiaDoInterior = (id: string): Family | undefined => {
    let achada: Family | undefined;
    for (const filho of tree.byId.get(id)?.children ?? []) {
      const dele = familyOf(filho.kind);
      const fundo = dele === "container" ? familiaDoInterior(filho.id) : dele;
      if (fundo === "processor") return "processor";
      achada ??= fundo;
    }
    return achada;
  };

  /** Trabalhou: recebeu ou emitiu alguma coisa neste tick. */
  const trabalhou = (id: string): boolean =>
    Object.entries(mudou).some(
      ([chave, quanto]) =>
        quanto > 0 &&
        (chave.startsWith(`out:${id}.`) ||
          chave === `in:${id}` ||
          chave.startsWith(`sigin:${id}.`)),
    );

  /** Os ids de tudo que está dentro de um objeto, ele inclusive. */
  const dentroDe = (id: string): readonly string[] => {
    const achados: string[] = [id];
    for (const filho of tree.byId.get(id)?.children ?? []) achados.push(...dentroDe(filho.id));
    return achados;
  };

  /**
   * Trabalhou, contando o que está lá dentro quando a caixa está recolhida.
   *
   * Um contêiner não emite: quem emite são os filhos. Uma caixa recolhida —
   * que existe justamente para **valer pelo interior dela** — seria então
   * desenhada parada enquanto o circuito dentro dela roda, e parada é o que
   * este desenho usa para dizer "não fez nada". A ULA recolhida com o somador
   * de trinta e dois bits girando lá dentro era exatamente isso.
   *
   * Caixa aberta continua sendo moldura e não se mexe: ali o leitor vê os
   * filhos agirem, e animar a moldura junto seria contar a mesma coisa duas
   * vezes.
   */
  const ativo = (id: string): boolean =>
    recolhida(id) ? dentroDe(id).some(trabalhou) : trabalhou(id);

  /**
   * A saída dele está em alto neste tick.
   *
   * Quem responde é o domínio, por `altos`: só ele sabe ler o valor que saiu.
   * Sem `altos`, nada acende — e não acender é a resposta honesta para "não me
   * disseram", que é diferente de acender tudo por causa de uma contagem.
   */
  const alto = (id: string): boolean => altos?.has(id) === true;

  // Contêineres são moldura: uma linha atravessando um deles é normal, e
  // desviar dela empurraria todo fio para fora do desenho.
  const obstaculos = view.places.filter((p) => familia(p.id) !== "container");

  /** Fios desenháveis: os dois pontos precisam estar na view. */
  const arestas = wires
    .map((wire, i) => {
      const de = lugares.get(wire.from);
      const para = typeof wire.to === "string" ? lugares.get(wire.to) : undefined;
      if (de === undefined || para === undefined) return null;
      const linha = wire.line ?? "data";
      const d = caminho(de, para, 18 + (i % 3) * 12, obstaculos);
      const marca = { x: de.x + de.w + 6, y: de.y + de.h / 2 - 6 };
      return {
        marca,
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

  /**
   * A onda de acomodação, encenada.
   *
   * Só o tráfego que atravessa a borda do relógio andava na tela. Só que numa
   * CPU quase tudo é combinacional: o cálculo inteiro — buscar, decodificar,
   * somar, escolher — acontecia **dentro** do tick e **sem nada se mexer**. O
   * desenho mostrava umas poucas bolinhas nas bordas e ficava parado no resto,
   * que é justamente onde está a coisa que se quer entender.
   *
   * A ordem em que as peças agem é do modelo (`substepOf`), e não se inventa
   * aqui. O que é do desenho é o **espaçamento**: os subpassos visíveis são
   * enfileirados e distribuídos pelo tick, senão os setenta e cinco subpassos
   * de um ciclo virariam nove milissegundos cada e ninguém veria nada.
   */
  /** Quem de fato emitiu naquela porta — e é o subpasso dele que vale. */
  const fonteDe = (from: string, port: string): string =>
    emissoes[`${from}.${port}`]?.fonte ?? from;

  const subpassosVisiveis = [
    ...new Set(
      arestas
        .filter((a) => a.timing === "settle")
        .map((a) => state.substepOf[fonteDe(a.from, a.port)])
        .filter((n): n is number => n !== undefined),
    ),
  ].sort((a, b) => a - b);

  const etapas = Math.max(1, subpassosVisiveis.length);
  const duracaoDaEtapa = tickMs / etapas;

  /**
   * Quanto tempo uma carga leva para atravessar o fio dela.
   *
   * Era a duração de uma etapa, e isso apagou a esteira. Num circuito com
   * quarenta e três subpassos por tick, cada etapa dura vinte milissegundos: a
   * carga nascia e morria antes de o olho pegar, e a tela mostrava um piscar
   * sem direção. O item na esteira — a coisa que se quer seguir — tinha sumido.
   *
   * Agora a partida continua sendo a do modelo (`substepOf`, e não se inventa),
   * e só a **travessia** ganha um piso legível. As cargas passam a se
   * sobrepor, e é assim mesmo: numa acomodação real muitos fios carregam ao
   * mesmo tempo. O que se vê é a onda varrendo o circuito, que é o fato.
   */
  const TRAVESSIA_MINIMA = 220;
  const duracaoDaCarga = Math.max(TRAVESSIA_MINIMA, duracaoDaEtapa);

  /** Quando esta emissão parte, em milissegundos dentro do tick. */
  const partidaDe = (from: string, port: string): number => {
    const subpasso = state.substepOf[fonteDe(from, port)];
    if (subpasso === undefined) return 0;
    const posicao = subpassosVisiveis.indexOf(subpasso);
    return (posicao < 0 ? 0 : posicao) * duracaoDaEtapa;
  };

  /** O que a acomodação pôs em cada fio desenhável neste tick. */
  const ondaAcomodada = arestas
    .filter((a) => a.timing === "settle")
    .map((a) => {
      const emissao = emissoes[`${a.from}.${a.port}`];
      if (emissao === undefined || emissao.mensagens.length === 0) return null;
      return { aresta: a, mensagem: emissao.mensagens[0]!, comeca: partidaDe(a.from, a.port) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
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
                  dur={`${Math.max(120, (tickMs * 0.8) / passos)}ms`}
                  begin={`${atrasoDe(fonteDe(aresta.from, aresta.port))}ms`}
                  fill="freeze"
                />
              </path>
            ) : null}
            {aresta.width !== undefined ? (
              // Ao lado da saída, e não sobre o traço: seguindo o caminho, a
              // marca sai de cabeça para baixo em todo fio que volta.
              <text className="dui-stage__largura" x={aresta.marca.x} y={aresta.marca.y}>
                {`/${aresta.width}`}
              </text>
            ) : null}
          </g>
        ))}
      </g>

      {/*
        A acomodação andando: o que se propaga dentro deste tick, na ordem em
        que o modelo diz que se propagou.
      */}
      <g className="dui-stage__onda">
        {reduzido
          ? null
          : ondaAcomodada.map(({ aresta, mensagem, comeca }) => (
              <g
                key={`${aresta.chave}:${state.tick}`}
                className="dui-stage__carga-grupo dui-stage__carga-grupo--acomodada"
                data-carga={aresta.chave}
                data-kind={mensagem.kind}
                data-linha={aresta.linha}
                style={{
                  ["--dui-trilho" as string]: `path("${aresta.d}")`,
                  ["--dui-atraso" as string]: `${comeca}ms`,
                  ["--dui-travessia" as string]: `${duracaoDaCarga}ms`,
                }}
              >
                <Carga
                  mensagem={mensagem}
                  leitura={leituraDaCarga?.(mensagem)}
                  raio={4}
                  de={aresta.from}
                  para={aresta.to}
                />
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
            <g
              key={`${item.id}:${state.tick}`}
              className="dui-stage__carga-grupo dui-stage__carga-grupo--voo"
              data-carga={item.id}
              data-kind={item.message.kind}
              data-sinal={item.signalPort !== undefined ? "true" : undefined}
              style={{
                ["--dui-trilho" as string]: `path("${trilho}")`,
                ["--dui-travessia" as string]: `${tickMs}ms`,
                ["--dui-de" as string]: `${andou * 100}%`,
                ["--dui-ate" as string]: `${Math.min(1, andou + 1 / edgeTicks) * 100}%`,
              }}
            >
              <Carga
                mensagem={item.message}
                leitura={leituraDaCarga?.(item.message)}
                raio={5}
                de={item.from}
                para={String(item.to)}
              />
            </g>
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
          const aceso = alto(place.id);
          // A marca ×N vem do MODELO, não da view: a view não sabe quantos são,
          // e escrevê-la à mão seria um rótulo sem nada por trás.
          const replicas = node?.replicas;
          const atraso = atrasoDe(place.id);

          /*
            O nível de detalhe. Uma caixa fechada revela o interior dela quando
            ocupa parte suficiente do quadro — e a transição é uma rampa, não um
            corte, porque é no meio dela que o leitor vê que um é o dentro do
            outro. Longe do limiar o interior nem existe no desenho: o custo é
            proporcional ao que está grande o bastante para ser lido.
          */
          const interior =
            place.collapsed === true && profundidade < PROFUNDIDADE_MAXIMA
              ? interiores?.(place.id)
              : undefined;
          const aparece =
            interior === undefined ? 0 : quantoAparece(place.w / unidadesPorQuadro);
          // Escala uniforme, pelo lado que aperta: esticar o interior para
          // preencher a caixa distorceria o esquemático, e num esquemático a
          // proporção é informação — uma rede em paralelo esticada deixa de
          // parecer paralela.
          const dentro = interior === undefined ? undefined : encaixar(place, interior);
          return (
            <g
              key={place.id}
              className="dui-stage__objeto"
              data-id={place.id}
              data-familia={fam}
              data-ativo={agindo ? "true" : undefined}
              data-alto={aceso ? "true" : undefined}
              style={{ ["--dui-atraso" as string]: `${atraso}ms` }}
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
              {/*
                O hover nativo do SVG. Bate a dúvida "o que é um mux?" e a
                resposta está debaixo do cursor, sem tirar o leitor da tela —
                que é onde ele consegue relacionar a explicação com a coisa.
              */}
              <title>
                {`${rotulo} · ${node?.kind ?? "?"}\n${
                  node === undefined ? "" : resumoDoKind(node.kind, fam)
                }`}
              </title>
              {replicas !== undefined ? (
                <>
                  <rect
                    className="dui-stage__pilha"
                    x={place.x + 7}
                    y={place.y - 7}
                    width={place.w}
                    height={place.h}
                    rx={8}
                  />
                  <rect
                    className="dui-stage__pilha"
                    x={place.x + 4}
                    y={place.y - 4}
                    width={place.w}
                    height={place.h}
                    rx={8}
                  />
                </>
              ) : null}
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

              {interior !== undefined && aparece > 0 ? (
                <>
                  {/* Recorte de verdade na caixa do pai: nada é pintado fora
                      porque não há regra a esquecer. */}
                  <clipPath id={`dui-dentro-${identificador(place.id)}`}>
                    <rect
                      x={place.x}
                      y={place.y}
                      width={place.w}
                      height={place.h}
                      rx={fam === "container" ? 14 : 8}
                    />
                  </clipPath>
                  {/*
                    O recorte vai num grupo SEM transformação, e a
                    transformação num grupo por dentro.
                    `clip-path` é resolvido no espaço do próprio elemento que o
                    referencia — transformação dele inclusive. Postos juntos, o
                    retângulo de recorte era escalado junto com o interior e
                    caía fora da caixa: o interior existia no DOM, com opacidade
                    1 e tamanho certo, e a tela mostrava uma caixa vazia.
                  */}
                  <g clipPath={`url(#dui-dentro-${identificador(place.id)})`}>
                  <g
                    className="dui-stage__interior"
                    opacity={aparece}
                    transform={`translate(${place.x + (dentro?.dx ?? 0)} ${
                      place.y + (dentro?.dy ?? 0)
                    }) scale(${dentro?.escala ?? 1})`}
                  >
                    <Camada
                      tree={tree}
                      wires={wires}
                      view={interior}
                      state={state}
                      previous={previous}
                      edgeTicks={edgeTicks}
                      tickMs={tickMs}
                      fills={fills}
                      readouts={readouts}
                      altos={altos}
                      selected={selected}
                      interiores={interiores}
                      leituraDaCarga={leituraDaCarga}
                      emissoes={emissoes}
                      unidadesPorQuadro={unidadesPorQuadro / (dentro?.escala ?? 1)}
                      profundidade={profundidade + 1}
                    />
                  </g>
                  </g>
                </>
              ) : null}

              {/*
                O rosto da caixa cede lugar ao interior, e cede **antes** de o
                interior chegar inteiro: um rótulo "more inside" por cima do
                inside já visível diz ao leitor o contrário do que ele está
                vendo. Some na metade da rampa; o interior termina de subir com
                o campo livre.
              */}
              <g className="dui-stage__rosto" opacity={Math.max(0, 1 - aparece * 2)}>
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

              {place.badge ?? (replicas === undefined ? undefined : `×${replicas}`) ? (
                <text
                  className="dui-stage__marca"
                  x={place.x + place.w - 8}
                  y={place.y + place.h - 8}
                  textAnchor="end"
                >
                  {place.badge ?? `×${String(replicas)}`}
                </text>
              ) : null}
              {place.collapsed === true ? (
                <text className="dui-stage__abrir" x={place.x + 10} y={place.y + place.h - 9}>
                  more inside
                </text>
              ) : null}
              </g>
            </g>
          );
        })}
      </g>
    </>
  );
}

/**
 * O palco, com câmera.
 *
 * A descida deixou de ser uma troca de tela e passou a ser uma aproximação: a
 * roda aproxima onde o cursor está, arrastar move o quadro, e quando uma caixa
 * fica grande o bastante o interior dela aparece **dentro dela**, por
 * transparência. Não há corte, e por isso o leitor não perde de vista de que
 * aquele interior é o interior.
 *
 * O que a câmera muda é só o enquadramento. O modelo roda igual esteja ele
 * enquadrado ou não — se dependesse do foco, duas pessoas com o mesmo link
 * veriam execuções diferentes, que é a otimização recusada em `depth.md` §5.1.
 */
export function Stage(props: StageProps) {
  const { view, tickMs = 700, state, tree } = props;

  // Uma vez por tick, e não uma vez por camada aberta: a resolução percorre a
  // árvore até o ponto fixo, e um modelo aberto até o fundo tem milhares de
  // nós.
  const emissoes = useMemo(() => emissoesPorPorta(state, tree), [state, tree]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [camera, setCamera] = useState({
    escala: 1,
    x: view.width / 2,
    y: view.height / 2,
  });

  // Trocar de view é trocar de assunto: manter o enquadramento anterior
  // deixaria o leitor num canto vazio do desenho novo.
  useEffect(() => {
    setCamera({ escala: 1, x: view.width / 2, y: view.height / 2 });
  }, [view.id, view.width, view.height]);

  /**
   * A roda, num ouvinte nativo e **não passivo**.
   *
   * Em React, `onWheel` no JSX vira ouvinte passivo na raiz: `preventDefault`
   * não faz nada, e o gesto de aproximar rola a página junto. O sintoma é
   * bonito de errado — o desenho não se mexe e a página desce — e manda
   * procurar no lugar errado.
   */
  useEffect(() => {
    const alvo = svgRef.current;
    if (alvo === null) return;
    const rodou = (e: WheelEvent) => {
      e.preventDefault();
      const caixa = alvo.getBoundingClientRect();
      setCamera((atual) => {
        const lq = view.width / atual.escala;
        const aq = view.height / atual.escala;
        const escala = Math.max(
          1,
          Math.min(ZOOM_MAXIMO, atual.escala * Math.exp(-e.deltaY / 900)),
        );
        const limitar = (esc: number, x: number, y: number) => {
          const l = view.width / esc;
          const a = view.height / esc;
          return {
            escala: esc,
            x: Math.min(view.width - l / 2, Math.max(l / 2, x)),
            y: Math.min(view.height - a / 2, Math.max(a / 2, y)),
          };
        };
        if (caixa.width === 0 || caixa.height === 0) return limitar(escala, atual.x, atual.y);
        // Aproximar onde o cursor está: o ponto sob ele tem que ficar parado,
        // senão o leitor aponta para uma coisa e recebe outra no meio da tela.
        const alvoX = atual.x - lq / 2 + ((e.clientX - caixa.left) / caixa.width) * lq;
        const alvoY = atual.y - aq / 2 + ((e.clientY - caixa.top) / caixa.height) * aq;
        const k = atual.escala / escala;
        return limitar(escala, alvoX + (atual.x - alvoX) * k, alvoY + (atual.y - alvoY) * k);
      });
    };
    alvo.addEventListener("wheel", rodou, { passive: false });
    return () => alvo.removeEventListener("wheel", rodou);
  }, [view.width, view.height]);

  const larguraDoQuadro = view.width / camera.escala;
  const alturaDoQuadro = view.height / camera.escala;

  /** O quadro nunca sai do desenho: fora dele não há nada para ver. */
  const enquadrar = (escala: number, x: number, y: number) => {
    const limite = Math.max(1, Math.min(ZOOM_MAXIMO, escala));
    const lq = view.width / limite;
    const aq = view.height / limite;
    return {
      escala: limite,
      x: Math.min(view.width - lq / 2, Math.max(lq / 2, x)),
      y: Math.min(view.height - aq / 2, Math.max(aq / 2, y)),
    };
  };

  /** Onde o cursor está, nas coordenadas da view. */
  const noDesenho = (clientX: number, clientY: number) => {
    const caixa = svgRef.current?.getBoundingClientRect();
    if (caixa === undefined || caixa.width === 0 || caixa.height === 0) return undefined;
    return {
      x: camera.x - larguraDoQuadro / 2 + ((clientX - caixa.left) / caixa.width) * larguraDoQuadro,
      y: camera.y - alturaDoQuadro / 2 + ((clientY - caixa.top) / caixa.height) * alturaDoQuadro,
    };
  };

  return (
    <svg
      ref={svgRef}
      className="dui-stage"
      data-zoom={camera.escala > 1 ? "true" : undefined}
      viewBox={`${camera.x - larguraDoQuadro / 2} ${camera.y - alturaDoQuadro / 2} ${larguraDoQuadro} ${alturaDoQuadro}`}
      role="img"
      aria-label={view.title}
      style={{ ["--dui-tick" as string]: `${tickMs}ms` }}
      onPointerDown={(e) => {
        if (e.button !== 0 || camera.escala <= 1) return;
        const alvo = e.currentTarget;
        alvo.setPointerCapture(e.pointerId);
        const partiu = { x: e.clientX, y: e.clientY, camera };
        const arrastar = (ev: PointerEvent) => {
          const caixa = alvo.getBoundingClientRect();
          if (caixa.width === 0) return;
          const dx = ((ev.clientX - partiu.x) / caixa.width) * (view.width / partiu.camera.escala);
          const dy = ((ev.clientY - partiu.y) / caixa.height) * (view.height / partiu.camera.escala);
          setCamera(enquadrar(partiu.camera.escala, partiu.camera.x - dx, partiu.camera.y - dy));
        };
        const soltar = () => {
          alvo.removeEventListener("pointermove", arrastar);
          alvo.removeEventListener("pointerup", soltar);
        };
        alvo.addEventListener("pointermove", arrastar);
        alvo.addEventListener("pointerup", soltar);
      }}
      onDoubleClick={(e) => {
        // O duplo clique continua abrindo — quem quiser trocar de vista ainda
        // troca —, mas no vazio ele volta a câmera para o desenho inteiro.
        if (e.target === e.currentTarget) setCamera(enquadrar(1, view.width / 2, view.height / 2));
      }}
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

      <Camada
        {...props}
        emissoes={emissoes}
        unidadesPorQuadro={larguraDoQuadro}
        profundidade={0}
      />
    </svg>
  );
}
