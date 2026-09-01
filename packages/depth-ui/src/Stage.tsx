import { useEffect, useMemo, useRef, useState } from "react";
import {
  borneNode,
  bornePort,
  DROP,
  emissoesPorPorta,
  entryLeaf,
  familyOf,
  visibleChild,
} from "@ovh/depth-core";
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
import {
  ALTURA_DA_LINHA,
  PROFUNDIDADE_MAXIMA,
  ZOOM_MAXIMO,
  encaixar,
  fracaoDoQuadro,
  quantoAparece,
  tabelaLegivel,
} from "./lod.js";
import { caminho, retasDe } from "./roteador.js";
import type { Ponto } from "./roteador.js";
import { travessia } from "./travessia.js";
import { juncoes } from "./espaguete.js";
import { portasDaCaixa, posicaoDaPorta } from "./portas.js";
import { dilatarPara, relogioDaCamada } from "./tempo.js";

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
  /**
   * Quem, neste tick, está **deixando passar**.
   *
   * É o par de `altos` para o registro esquemático: `altos` diz que valor saiu,
   * isto diz se o caminho está aberto. As duas coisas são diferentes e o
   * desenho as confundia — sete objetos do mesmo azul, e a pergunta que aquele
   * nível existe para responder (*por que esta porta deu 1?*) só se respondia
   * lendo número pequeno.
   *
   * Quem responde é o domínio: só ele sabe ler o que passou. Sem isto, nada
   * conduz — e não conduzir é a resposta honesta para "não me disseram".
   */
  readonly conduzindo?: ReadonlySet<string> | undefined;
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
  /**
   * A **espécie** de uma carga, para o desenho poder distingui-la das outras.
   *
   * A carga muda de cara ao atravessar quem a transforma — uma palavra vira
   * campos, campos viram operandos, operandos viram resultado —, e essa
   * transformação é a coisa que se está ensinando. Para desenhá-la, o palco
   * precisa saber que duas cargas são de espécies diferentes; **o que cada
   * espécie é, ele não pode saber**.
   *
   * Isto existia e estava do lado errado da fronteira: o CSS do motor tinha
   * seletores `data-kind="instrucao"`, `"escrita"`, `"guardar"` — vocabulário
   * de CPU dentro do palco. A guarda de fronteira não viu porque só varre
   * TypeScript, e a do catálogo só achou porque a tinta estava escrita ali.
   *
   * O número não tem significado nenhum e não deve ter: ele só precisa ser
   * estável e diferente. Quem lhe dá sentido é o domínio, do lado de lá.
   */
  readonly especieDaCarga?: ((mensagem: Message) => number | undefined) | undefined;
  /**
   * O que um objeto **guarda** agora, linha a linha.
   *
   * Um objeto que acumula, desenhado como caixa lisa, é a caixa fechada do
   * armazém: o leitor sabe que tem coisa lá dentro e não vê nenhuma. Abrir e
   * ver as entradas — chave e valor, linha a linha — é o que transforma um
   * nome em coisa.
   *
   * Não é interior inventado: são as linhas do **estado**, entregues pelo
   * domínio, que é quem sabe ler aquele estado. O desenho só decide quando há
   * espaço para mostrá-las.
   */
  readonly conteudo?:
    | ((id: string) => readonly { readonly chave: string; readonly valor: string; readonly ativo?: boolean }[] | undefined)
    | undefined;
  /**
   * O retângulo que a câmera deve enquadrar, animando até lá.
   *
   * É o zoom como **transição**, e não como habilidade: entrar num objeto
   * deixa de ser um corte e vira a câmera indo até ele, com o interior já
   * aparecendo pela aproximação. Quando ela chega, `onEnquadrado` avisa e quem
   * chamou troca a vista — na escala em que o leitor já está olhando, então a
   * troca não se vê.
   */
  readonly alvoDeCamera?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | undefined;
  /** De onde a câmera parte ao entrar nesta vista. É o zoom de saída. */
  readonly partirDe?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | undefined;
  readonly onEnquadrado?: (() => void) | undefined;
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
   * Quanto o tempo desta camada está esticado em relação ao da superfície.
   *
   * Uma dimensão fraciona o tempo: o que aqui é uma sequência, um nível acima
   * coube num instante. A dilatação é a lente que torna essa sequência
   * observável, e o fator vem da geometria — não é gosto.
   */
  readonly dilatacao: number;
  /**
   * O que cada porta emitiu, já com os bornes de saída resolvidos.
   *
   * Vem pronto da casca porque a resolução percorre a árvore inteira: fazê-la
   * dentro de cada camada custaria isso vezes o número de interiores abertos,
   * a cada quadro.
   */
  readonly emissoes: Readonly<Record<string, EmissaoDaPorta>>;
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

/**
 * A chave: um caminho com uma quebra, e algo comandando a quebra.
 *
 * É o símbolo que separa "deixar passar ou não" de "escolher qual entrada
 * responde". Uma chave desenhada com o trapézio do seletor — que é a notação de
 * uma escolha — empurra o modelo mental errado, e empurra justamente onde o
 * leitor está mais fundo e menos seguro. Aqui os dois terminais são o caminho,
 * a lâmina é a quebra, e o traço que chega de baixo é quem comanda: desenhado
 * na linguagem da linha de controle porque **é** uma linha de controle, e não
 * parte do caminho.
 *
 * A lâmina está aberta, e por enquanto sempre: fechá-la quando a chave conduz é
 * a entrega da cor, onde conduzir e cortar ganham leitura de relance.
 */
function Chave({ x, y, r, fechada }: { x: number; y: number; r: number; fechada: boolean }) {
  return (
    <g
      className="dui-stage__chave"
      data-fechada={fechada ? "true" : "false"}
      transform={`translate(${x} ${y})`}
    >
      <line className="dui-stage__chave-via" x1={-r * 1.4} y1={0} x2={-r * 0.5} y2={0} />
      <line className="dui-stage__chave-via" x1={r * 0.5} y1={0} x2={r * 1.4} y2={0} />
      {/* Fechada, a lâmina deita e encosta no outro terminal: o caminho está
          inteiro. Aberta, ela levanta e o caminho tem um buraco. É o mesmo
          desenho que um esquemático usa, e ele se lê sem legenda. */}
      <line
        className="dui-stage__chave-lamina"
        x1={-r * 0.5}
        y1={0}
        x2={fechada ? r * 0.5 : r * 0.45}
        y2={fechada ? 0 : -r * 0.9}
      />
      <line className="dui-stage__chave-comando" x1={0} y1={r * 1.3} x2={0} y2={r * 0.3} />
      <circle className="dui-stage__chave-eixo" cx={-r * 0.5} cy={0} r={r * 0.18} />
    </g>
  );
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
/**
 * A largura de uma carga, em unidades de desenho.
 *
 * **A forma vem da largura do fio**, que o modelo declara. Um fio de uma via
 * leva um ponto; um barramento de trinta e duas leva uma barra. É a notação de
 * qualquer esquemático — o traço grosso com a barra e o `/32` — e é ela que faz
 * a transformação aparecer: a palavra sai da memória como barra larga, o
 * decodificador a devolve em campos estreitos, os operandos entram na ULA como
 * barras e o vai-um de um bit é um ponto. Antes disso tudo era o mesmo círculo,
 * e a transformação acontecia dentro da caixa, invisível.
 *
 * Cresce pelo logaritmo porque a diferença que interessa é de ORDEM: entre 1 e
 * 8 há uma lição, entre 24 e 32 não há nenhuma, e linear faria a carga de 32
 * atravessar a tela inteira.
 */
export function comprimentoDaCarga(largura: number | undefined, raio: number): number {
  if (largura === undefined || largura <= 1) return 0;
  return Math.min(raio * 5, raio * Math.log2(largura));
}

function Carga({
  mensagem,
  leitura,
  raio,
  largura,
  de,
  para,
}: {
  mensagem: Message;
  leitura: string | undefined;
  raio: number;
  largura?: number | undefined;
  de: string;
  para: string;
}) {
  const comprimento = comprimentoDaCarga(largura, raio);
  return (
    <>
      {/* O hover é o mesmo gesto que já responde "o que é esta peça?": bateu a
          dúvida sobre o que está passando, a resposta está sob o cursor. */}
      <title>
        {`${mensagem.kind}${leitura === undefined ? "" : ` · ${leitura}`}\n${de} → ${para}${
          mensagem.weight > 1 ? `\n${mensagem.weight} itens` : ""
        }`}
      </title>
      {comprimento > 0 ? (
        <rect
          className="dui-stage__carga"
          x={-comprimento}
          y={-raio}
          width={comprimento * 2}
          height={raio * 2}
          rx={raio}
        />
      ) : (
        <circle className="dui-stage__carga" r={raio} />
      )}
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
  conduzindo,
  selected,
  onSelect,
  onOpen,
  interiores,
  leituraDaCarga,
  especieDaCarga,
  conteudo,
  unidadesPorQuadro,
  profundidade,
  dilatacao,
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
  const passa = (id: string): boolean => conduzindo?.has(id) === true;

  // Contêineres são moldura: uma linha atravessando um deles é normal, e
  // desviar dela empurraria todo fio para fora do desenho.
  const obstaculos = view.places.filter((p) => familia(p.id) !== "container");

  /**
   * O interior visível de cada caixa, e o quanto dele está na tela.
   *
   * Calculado antes dos fios porque é ele que decide se um fio **entra** na
   * caixa ou para na borda dela.
   */
  // O quadro em unidades da vista: a largura vem da câmera, e a altura sai da
  // proporção da própria vista — a câmera enquadra sem distorcer, então a
  // proporção do quadro é a da vista.
  const quadro = {
    largura: unidadesPorQuadro,
    altura: (unidadesPorQuadro * view.height) / view.width,
  };

  /**
   * As caixas que contêm outra caixa desenhada: **elas são moldura**.
   *
   * Não é o `kind` que decide, é o desenho. Um barramento com as pistas à
   * vista é a moldura das pistas, e desenhá-lo como esteira o transformava
   * numa barra verde chapada com as pistas boiando dentro. A regra é a mesma
   * que separa contêiner de peça: quem tem gente dentro é moldura.
   */
  const molduras = new Set<string>(
    view.places
      .filter((place) =>
        view.places.some((outro) => {
          if (outro.id === place.id) return false;
          let cursor = tree.parent.get(outro.id);
          while (cursor !== undefined) {
            if (cursor === place.id) return true;
            cursor = tree.parent.get(cursor);
          }
          return false;
        }),
      )
      .map((place) => place.id),
  );

  /**
   * Para que lado uma pista anda.
   *
   * Sai da geometria do próprio modelo: se quem recebe daquela pista está à
   * **esquerda** de quem a alimenta, ela anda para a esquerda. Num barramento
   * é o que separa a pista de ida da de volta — e sem isso as duas apontavam
   * para o mesmo lado, que é o contrário do que um barramento é.
   */
  const sentidoDaPista = (id: string): 1 | -1 => {
    const meu = lugares.get(id);
    if (meu === undefined) return 1;
    const alvos = wires
      .filter((w) => w.from === id && typeof w.to === "string")
      .map((w) => ondeCai(String(w.to)))
      .filter((p): p is NodePlacement => p !== undefined && p !== FORA);
    if (alvos.length === 0) return 1;
    const media = alvos.reduce((t, p) => t + p.x + p.w / 2, 0) / alvos.length;
    return media < meu.x + meu.w / 2 ? -1 : 1;
  };

  const dentroDe2 = new Map<string, { readonly interior: View; readonly aparece: number }>();
  for (const place of view.places) {
    if (place.collapsed !== true || profundidade >= PROFUNDIDADE_MAXIMA) continue;
    const interior = interiores?.(place.id);
    if (interior === undefined) continue;
    const aparece = quantoAparece(fracaoDoQuadro(place, quadro));
    if (aparece > 0) dentroDe2.set(place.id, { interior, aparece });
  }

  /**
   * O ponto, nas coordenadas desta camada, de um objeto que mora dentro de uma
   * caixa aberta.
   *
   * É o que permite ao canal atravessar a fronteira em vez de morrer na borda.
   * O alvo pode estar vários níveis abaixo — `visibleChild` diz qual filho
   * direto o contém, que é quem a vista de dentro desenha.
   */
  const pontoDentro = (place: NodePlacement, alvo: string): Ponto | undefined => {
    const aberto = dentroDe2.get(place.id);
    if (aberto === undefined) return undefined;
    const quem = visibleChild(tree, place.id, alvo);
    const id = quem.at === "child" ? quem.id : undefined;
    if (id === undefined) return undefined;
    const lugar = aberto.interior.places.find((p) => p.id === id);
    if (lugar === undefined) return undefined;
    const encaixe = encaixar(place, aberto.interior);
    return {
      x: place.x + encaixe.dx + encaixe.escala * (lugar.x + lugar.w / 2),
      y: place.y + encaixe.dy + encaixe.escala * (lugar.y + lugar.h / 2),
    };
  };

  /**
   * Em quem, lá dentro, um fio entrega.
   *
   * Sinal tem destinatário nomeado, e o borne de entrada diz qual peça de
   * dentro atende aquela porta. Carga não nomeia porta: o motor acha a folha de
   * entrada, e é ela que o desenho segue — a mesma regra, não uma escolha nova.
   */
  const borneDeEntrada = (destino: string, porta: string | undefined): string | undefined => {
    const node = tree.byId.get(destino);
    if (node === undefined) return undefined;
    if (porta !== undefined) {
      const bornes = node.inlets?.[porta];
      const primeiro = bornes?.[0];
      return primeiro === undefined ? undefined : borneNode(primeiro);
    }
    return (node.children ?? []).length === 0 ? undefined : entryLeaf(tree, destino);
  };

  /**
   * Onde uma ponta de fio cai nesta vista.
   *
   * Três respostas, e as três importam:
   *
   * - **numa caixa desenhada** — direto, ou porque a caixa contém aquele
   *   objeto lá no fundo. Sem isso, subir um nível apagava as ligações: o fio
   *   ia de uma folha para outra, nenhuma das duas estava na vista, e o
   *   desenho ficava com caixas soltas. Era o "zoom out desconectando os
   *   diagramas";
   * - **fora do foco** — o outro lado da ligação acontece longe daqui. O fio
   *   não some nem flutua: ele nasce (ou morre) **na margem da moldura**, com
   *   uma âncora de ENTRA ou SAI. É o que amarra um nível ao de cima;
   * - **em lugar nenhum** — a ponta não existe na árvore, e aí não há o que
   *   desenhar.
   */
  const ANCORA_ENTRA = "__entra";
  const ANCORA_SAI = "__sai";
  const FORA = "__fora" as const;

  /**
   * A caixa desenhada **mais funda** que contém este objeto.
   *
   * Subir pela árvore até achar quem está na vista, e não perguntar qual filho
   * do foco o contém. A diferença parece de detalhe e é a causa da bagunça: uma
   * vista desenha caixas aninhadas — a moldura de fora, a de dentro, e a peça
   * fechada dentro dela — e nenhuma das duas últimas é filha direta do foco.
   * Perguntando pelo filho do foco, TODO fio que nascia lá no fundo era
   * desenhado saindo da moldura de fora: a linha atravessava a máquina inteira
   * para chegar na caixa vizinha, e o desenho dizia que a peça está ligada a
   * quem ela não está.
   */
  const caixaQueContem = (id: string): NodePlacement | undefined => {
    let cursor = tree.parent.get(id);
    while (cursor !== undefined) {
      const caixa = lugares.get(cursor);
      if (caixa !== undefined) return caixa;
      cursor = tree.parent.get(cursor);
    }
    return undefined;
  };

  const ondeCai = (id: string): NodePlacement | typeof FORA | undefined => {
    const direto = lugares.get(id);
    if (direto !== undefined) return direto;
    if (!tree.byId.has(id)) return undefined;
    const dentro = caixaQueContem(id);
    if (dentro !== undefined) return dentro;
    // O próprio foco: a ligação atravessa a moldura. Quem responde por ela lá
    // dentro é resolvido logo abaixo — aqui só se diz que ela vem de fora.
    const quem = visibleChild(tree, view.focus, id);
    return quem.at === "self" || quem.at === "outside" ? FORA : undefined;
  };

  /** A caixa desta vista que contém aquele objeto, se alguma contiver. */
  const dentroDoFoco = (id: string): NodePlacement | undefined =>
    lugares.get(id) ?? caixaQueContem(id);

  /**
   * Quem, **nesta vista**, responde por uma ligação que atravessa a moldura.
   *
   * É o que faltava para a granularidade fina fazer sentido. Dentro de uma
   * NAND, `a` e `b` chegam num fio cujo destino declarado é a porta lá em cima,
   * três níveis acima: nenhuma das duas pontas era caixa desenhada, o fio
   * sumia, e o leitor via um esquemático flutuando — sem saber por onde o dado
   * entra nem para onde a resposta vai.
   *
   * O caminho é o mesmo que o motor percorre para entregar: seguir os bornes de
   * entrada até cair dentro desta vista. Se nenhum cair, a ligação de fato
   * acontece longe daqui, e a margem é a resposta honesta.
   */
  const entradaNoFoco = (destino: string, porta: string | undefined): NodePlacement | undefined => {
    const visitados = new Set<string>();
    const anda = (id: string, p: string | undefined): NodePlacement | undefined => {
      const aqui = dentroDoFoco(id);
      if (aqui !== undefined) return aqui;
      const chave = `${id}.${p ?? "*"}`;
      if (visitados.has(chave)) return undefined;
      visitados.add(chave);
      const inlets = tree.byId.get(id)?.inlets;
      if (inlets === undefined) return undefined;
      const bornes = p === undefined ? Object.values(inlets).flat() : (inlets[p] ?? []);
      for (const borne of bornes) {
        const achou = anda(borneNode(borne), bornePort(borne) ?? p);
        if (achou !== undefined) return achou;
      }
      return undefined;
    };
    return anda(destino, porta);
  };

  /**
   * O descarte, desenhado.
   *
   * Ele não era desenhado: `@drop` não está na árvore, então o fio inteiro
   * sumia do palco. E o que isso produz na tela é a pior coisa que este projeto
   * pode produzir — **descarte deliberado e fio esquecido viram o mesmo
   * desenho**. Um amostrador com três saídas aparecia com duas; uma fila que
   * recusa aparecia como uma fila que não recusa; e o leitor não tinha como
   * saber que faltava alguma coisa.
   *
   * O descarte não é objeto e não vira um: ele é a **ausência de destino, dita
   * em voz alta**, e por isso é um terminal curto ao lado de quem descarta, com
   * o traço de fim que um esquemático usa para uma linha que não vai a lugar
   * nenhum. Dois descartes da mesma caixa recebem alturas diferentes — são dois
   * motivos diferentes de a carga morrer, e empilhá-los diria que é um só.
   */
  const descartesPorFonte = new Map<string, number>();
  const terminalDeDescarte = (vizinho: NodePlacement): NodePlacement => {
    const n = descartesPorFonte.get(vizinho.id) ?? 0;
    descartesPorFonte.set(vizinho.id, n + 1);
    return {
      id: `__descarte-${vizinho.id}-${n}`,
      x: Math.min(view.width - 3, vizinho.x + vizinho.w + 46),
      y: vizinho.y + vizinho.h * 0.62 + n * 24,
      w: 2,
      h: 16,
    };
  };

  /** A margem da moldura, na altura de quem ela serve. */
  const margem = (lado: "entra" | "sai", vizinho: NodePlacement): NodePlacement => ({
    id: lado === "entra" ? ANCORA_ENTRA : ANCORA_SAI,
    x: lado === "entra" ? -1 : view.width + 1,
    y: vizinho.y + vizinho.h / 2 - 9,
    w: 1,
    h: 18,
  });

  const vistos = new Set<string>();
  // As retas já usadas por fios anteriores, para o roteador não empilhar dois
  // fios na mesma coluna. Acumula na ordem das arestas, que é estável.
  const ocupadas = new Set<string>();

  /** Fios desenháveis: cada ponta cai numa caixa da vista ou na margem dela. */
  const arestas = wires
    .map((wire, i) => {
      const paraODescarte = String(wire.to) === DROP;
      const destino = paraODescarte ? undefined : typeof wire.to === "string" ? String(wire.to) : undefined;

      // Fora do foco, ainda pode ser desta vista: quem emitiu de verdade pode
      // morar aqui dentro, e quem vai receber também.
      const bruto = ondeCai(wire.from);
      const fonte = emissoes[`${wire.from}.${wire.port}`]?.fonte;
      const a =
        bruto === FORA && fonte !== undefined ? (dentroDoFoco(fonte) ?? FORA) : bruto;

      if (paraODescarte) {
        if (a === undefined || a === FORA) return null;
        // O descarte é desenhado onde quem descarta está desenhado. Vindo de
        // dentro de uma caixa fechada, ele é **interior** — e pendurá-lo na
        // borda da moldura diria que a moldura inteira descarta, quando quem
        // descarta é uma peça lá dentro que este enquadramento não mostra.
        if (lugares.get(wire.from) !== a) return null;
        const fim = terminalDeDescarte(a);
        const trilho = caminho(a, fim, 18 + (i % 3) * 12, obstaculos, ocupadas);
        for (const reta of retasDe(trilho)) ocupadas.add(reta);
        return {
          marca: { x: a.x + a.w + 6, y: a.y + a.h / 2 - 6 },
          chave: `${a.id}.${wire.port}->drop${fim.id}`,
          to: fim.id,
          d: trilho,
          traco: trilho,
          linha: (wire.line ?? "data") as typeof wire.line extends undefined ? "data" : NonNullable<typeof wire.line>,
          timing: wire.timing ?? "clocked",
          width: wire.width,
          acesa: (mudou[`out:${wire.from}.${wire.port}`] ?? 0) > 0,
          from: a.id,
          deLugar: a,
          paraLugar: fim,
          ancora: undefined,
          descarte: true as const,
          port: wire.port,
        };
      }

      const brutoDestino = destino === undefined ? undefined : ondeCai(destino);
      const b =
        brutoDestino === FORA && destino !== undefined
          ? (entradaNoFoco(destino, wire.toPort) ?? FORA)
          : brutoDestino;
      if (a === undefined || b === undefined) return null;
      // Os dois lados fora do foco: a ligação inteira acontece longe daqui, e
      // desenhá-la seria pôr no palco uma coisa que não é deste palco.
      if (a === FORA && b === FORA) return null;

      const para = b === FORA ? margem("sai", a as NodePlacement) : b;
      const de = a === FORA ? margem("entra", para) : a;

      /*
        Ligação que começa e termina na mesma caixa desenhada, sem ser um
        laço de verdade: é **interior**, e desenhá-la é desenhar por fora o que
        acontece por dentro. A ULA falando com a unidade de desvio virava uma
        alça saindo da lógica combinacional e voltando nela — uma volta que o
        leitor lê como realimentação e que não é nenhuma.

        Um laço de verdade — o objeto que escreve nele mesmo — continua sendo
        desenhado, porque ali as duas pontas do fio SÃO o mesmo objeto, e é isso
        que a alça diz.
      */
      if (de.id === para.id && wire.from !== String(wire.to)) return null;

      // Duas folhas dentro das mesmas duas caixas produzem a mesma aresta
      // agregada. Desenhá-la trinta e duas vezes engrossa a linha sem dizer
      // nada — a multiplicidade quem conta é a marca de réplicas.
      const chaveVisual = `${de.id}>${para.id}>${wire.line ?? "data"}`;
      if (de.id !== wire.from || para.id !== String(wire.to)) {
        if (vistos.has(chaveVisual)) return null;
        vistos.add(chaveVisual);
      }
      const linha = wire.line ?? "data";
      /*
        O roteador lembra por onde os fios anteriores passaram.

        Sem isso ele desviava de caixas e ignorava fios: dois sem nada em comum
        escolhiam a MESMA coluna de cotovelo, porque o desempate era a
        proximidade do centro e os dois queriam o centro. Desenhados um por
        cima do outro, eles se leem como um só.

        A ordem importa e é a das arestas, que é estável: o primeiro fio fica
        com a coluna mais central, e quem vem depois se afasta. Um sorteio aqui
        faria o desenho mudar entre dois carregamentos da mesma página.
      */
      const traco = caminho(de, para, 18 + (i % 3) * 12, obstaculos, ocupadas);
      for (const reta of retasDe(traco)) ocupadas.add(reta);

      /*
        A travessia da fronteira.

        Um canal que morre na borda da caixa conta uma meia-verdade: o dado
        entrou ali e o leitor não vê onde. Com o interior aberto, o caminho
        segue **até a peça de dentro que de fato recebe** — e sai de dentro da
        peça que de fato emitiu. É o item pulando de dimensão, que é o que faz
        a descida por zoom ter sentido lógico em vez de ser só uma câmera.

        Quem recebe é dito pelos bornes de entrada; quem emite, pela resolução
        das emissões. Nada é escolhido pelo desenho.
      */
      const emissao = emissoes[`${wire.from}.${wire.port}`];
      const saiDe = emissao === undefined ? undefined : pontoDentro(de, emissao.fonte);
      const alvo = borneDeEntrada(String(wire.to), wire.toPort);
      const chegaEm = alvo === undefined ? undefined : pontoDentro(para, alvo);
      const d = travessia(traco, saiDe, chegaEm);
      const marca = { x: de.x + de.w + 6, y: de.y + de.h / 2 - 6 };
      return {
        marca,
        chave: `${de.id}.${wire.port}->${para.id}`,
        to: para.id,
        d,
        // O traço fica na borda; a travessia é desenhada por cima das caixas,
        // senão ela some atrás justamente da caixa que ela atravessa.
        traco,
        linha,
        timing: wire.timing ?? "clocked",
        width: wire.width,
        // Uma emissão na porta acende todos os fios que saem dela: é o leque,
        // e mostrar só o primeiro seria voltar a mentir sobre o percurso.
        acesa: (mudou[`out:${wire.from}.${wire.port}`] ?? 0) > 0,
        from: de.id,
        deLugar: de,
        paraLugar: para,
        // A âncora não é objeto: ela é a moldura dizendo que a ligação
        // continua fora daqui.
        ancora: de.id === ANCORA_ENTRA ? ("entra" as const) : para.id === ANCORA_SAI ? ("sai" as const) : undefined,
        descarte: false as const,
        port: wire.port,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // A carga em voo só sabe de onde veio e para onde vai; o fio que a leva é o
  // primeiro que liga os dois. Com leque, as cópias são itens distintos, cada
  // uma com o seu destino, então nenhuma some no caminho de outra.
  const trilhoEntre = new Map<string, string>();
  // A largura declarada do fio, para a carga em voo poder tomar a forma dele.
  const larguraEntre = new Map<string, number>();
  for (const aresta of arestas) {
    const chave = `${aresta.from}->${aresta.to}`;
    if (!trilhoEntre.has(chave)) trilhoEntre.set(chave, aresta.d);
    if (aresta.width !== undefined && !larguraEntre.has(chave)) {
      larguraEntre.set(chave, aresta.width);
    }
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
  const { etapaMs: duracaoDaEtapa, travessiaMs: duracaoDaCarga } = relogioDaCamada(
    tickMs,
    etapas,
    dilatacao,
  );



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
            /* As duas pontas, nomeadas: é o que permite conferir de fora que
               nenhum fio atravessa uma caixa que não é ponta dele. */
            data-de={aresta.from}
            data-para={aresta.to}
            data-linha={aresta.linha}
            data-timing={aresta.timing}
            data-acesa={aresta.acesa ? "true" : undefined}
            data-descarte={aresta.descarte ? "true" : undefined}
          >
            {/*
              O canal é uma esteira, e não um risco.

              O leito largo e apagado é o corpo dela; o trilho fino e forte por
              cima é por onde o item anda. Um traço só some no meio de um
              circuito denso — e era o que estava acontecendo dentro do somador,
              onde o fluxo interno existia e não dava para acompanhar.
            */}
            <path className="dui-stage__leito" d={aresta.traco} />
            <path
              id={identificador(aresta.chave)}
              className="dui-stage__trilho"
              d={aresta.traco}
              markerEnd="url(#dui-seta)"
            />
            {/* As marcas de direção: dizem para que lado a esteira anda mesmo
                quando nada está passando nela. */}
            <path className="dui-stage__marcha" d={aresta.traco} />
            {aresta.acesa && !reduzido ? (
              <path key={`p${state.tick}`} className="dui-stage__pulso" d={aresta.traco}>
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
            {aresta.descarte ? (
              // O terminal: a barra de fim, e a palavra. Sem a palavra, um
              // traço curto pareceria um fio cortado pela moldura — que é
              // acidente, e descarte é decisão.
              <g className="dui-stage__descarte">
                <path
                  d={`M ${aresta.paraLugar.x} ${aresta.paraLugar.y} V ${aresta.paraLugar.y + aresta.paraLugar.h}`}
                />
                <text x={aresta.paraLugar.x + 6} y={aresta.paraLugar.y + aresta.paraLugar.h / 2 + 3}>
                  drop
                </text>
              </g>
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
        As junções.

        A convenção mais antiga do esquemático, e a mais barata: o T ganha
        pontinho e o X não ganha. Sem ela não há como saber se duas linhas que
        se tocam estão ligadas ou só passam uma pela outra — e um leque saindo
        da mesma porta era desenhado como três linhas empilhadas, que se leem
        como uma linha só. O leitor via uma ligação onde existem três.

        Sai da geometria do que foi desenhado, e não de saber o que é leque:
        junção é a ponta de um fio caindo no meio do trecho de outro.
      */}
      <g className="dui-stage__juncoes">
        {juncoes(arestas.map((a) => a.traco)).map((ponto) => (
          <circle
            key={`${ponto.x},${ponto.y}`}
            className="dui-stage__juncao"
            cx={ponto.x}
            cy={ponto.y}
            r={2.6}
          />
        ))}
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
            interior === undefined ? 0 : quantoAparece(fracaoDoQuadro(place, quadro));
          // Escala uniforme, pelo lado que aperta: esticar o interior para
          // preencher a caixa distorceria o esquemático, e num esquemático a
          // proporção é informação — uma rede em paralelo esticada deixa de
          // parecer paralela.
          const dentro = interior === undefined ? undefined : encaixar(place, interior);
          const portas = portasDaCaixa(tree, wires, place.id);
          return (
            <g
              key={place.id}
              className="dui-stage__objeto"
              data-id={place.id}
              data-familia={fam}
              data-kind={node?.kind}
              // O registro é da VISTA, e vai no objeto porque uma camada de
              // dentro pode estar noutro registro que a de fora: descendo, o
              // diagrama de blocos vira esquemático em algum degrau, e os dois
              // aparecem no mesmo SVG durante a transição.
              data-registro={view.registro ?? "blocos"}
              data-ativo={agindo ? "true" : undefined}
              data-alto={aceso ? "true" : undefined}
              data-conduz={node?.kind === "switch" ? (passa(place.id) ? "true" : "false") : undefined}
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
              {/*
                A forma vem da família, e a família vem do kind.

                Um `conduit` é uma **esteira**, não uma caixa: pontas
                arredondadas, corpo baixo, e o nome fora dele. Desenhá-lo como
                retângulo o faz parecer uma peça que processa, e a diferença
                entre transportar e transformar é a primeira coisa que este
                desenho precisa deixar clara.
              */}
              {molduras.has(place.id) ? (
                // Moldura: contorno e nada mais. O que ela guarda está
                // desenhado por cima dela, e um preenchimento forte aqui
                // apagaria justamente isso.
                <rect
                  className="dui-stage__caixa dui-stage__moldura"
                  x={place.x}
                  y={place.y}
                  width={place.w}
                  height={place.h}
                  rx={14}
                />
              ) : fam === "conduit" ? (
                /*
                  Um conduíte é uma **pista**, não uma caixa.

                  Desenhado como retângulo vazado ele virava uma barra chapada:
                  o leitor via um lugar, e o que ele precisa ver é um caminho. A
                  pista é o leito largo e apagado com o trilho fino por cima —
                  a mesma linguagem do fio, porque é a mesma coisa: transporte.
                  E é o que faz um barramento aberto parecer o que é, uma
                  auto-estrada de pistas paralelas.
                */
                (() => {
                  const meio = place.y + place.h / 2;
                  const paraDireita = sentidoDaPista(place.id) === 1;
                  const inicio = paraDireita ? place.x : place.x + place.w;
                  const fim = paraDireita ? place.x + place.w : place.x;
                  return (
                    <>
                      <line
                        className="dui-stage__pista-leito"
                        x1={place.x}
                        y1={meio}
                        x2={place.x + place.w}
                        y2={meio}
                      />
                      <line
                        className="dui-stage__pista"
                        x1={inicio}
                        y1={meio}
                        x2={fim}
                        y2={meio}
                      />
                      {/*
                        A ponta da pista é desenhada aqui, e não com o marcador
                        do fio: o marcador é dimensionado para um traço de
                        espessura fixa, e sobre uma pista ele vinha do tamanho
                        de uma peça — uma seta preta gigante no meio do
                        barramento, gritando mais alto que o barramento.
                      */}
                      <path
                        className="dui-stage__ponta"
                        d={`M ${fim} ${meio} L ${fim - (paraDireita ? 9 : -9)} ${meio - 5} L ${
                          fim - (paraDireita ? 9 : -9)
                        } ${meio + 5} Z`}
                      />
                    </>
                  );
                })()
              ) : node?.kind === "store" ? (
                // Um banco não é uma caixa: é uma **estante**. A faixa de topo
                // é a etiqueta da prateleira, e o que vem abaixo dela são as
                // linhas do estado. Desenhado como retângulo liso ele fica
                // igual a quem processa — e a diferença entre "guarda" e
                // "transforma" é justamente a que este desenho precisa dizer.
                <>
                  <rect
                    className="dui-stage__caixa"
                    x={place.x}
                    y={place.y}
                    width={place.w}
                    height={place.h}
                    rx={4}
                  />
                  <line
                    className="dui-stage__prateleira"
                    x1={place.x}
                    y1={place.y + 18}
                    x2={place.x + place.w}
                    y2={place.y + 18}
                  />
                </>
              ) : node?.kind === "router" && fam !== "controller" ? (
                // O trapézio é a notação de um seletor, e ela é universal:
                // largo do lado das entradas, estreito do lado da saída. Só
                // vale para quem está NO caminho: quem só manda sinal não
                // seleciona nada, e um trapézio deitado sobre a largura do
                // desenho vira uma seta gigante apontando para lugar nenhum.
                //
                // A forma **é** a explicação — muitas entram, uma sai —, e um
                // retângulo a esconde atrás de um rótulo que ninguém lê.
                <path
                  className="dui-stage__caixa"
                  d={`M ${place.x} ${place.y} L ${place.x + place.w} ${place.y + place.h * 0.2} L ${
                    place.x + place.w
                  } ${place.y + place.h * 0.8} L ${place.x} ${place.y + place.h} Z`}
                />
              ) : (
                <rect
                  className="dui-stage__caixa"
                  x={place.x}
                  y={place.y}
                  width={place.w}
                  height={place.h}
                  rx={fam === "container" ? 14 : 8}
                />
              )}
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
                      conduzindo={conduzindo}
                      selected={selected}
                      interiores={interiores}
                      leituraDaCarga={leituraDaCarga}
                      especieDaCarga={especieDaCarga}
                      conteudo={conteudo}
                      emissoes={emissoes}
                      unidadesPorQuadro={unidadesPorQuadro / (dentro?.escala ?? 1)}
                      profundidade={profundidade + 1}
                      dilatacao={dilatarPara(dilatacao, dentro?.escala ?? 1)}
                    />
                  </g>
                  </g>
                </>
              ) : null}

              {/*
                O que a caixa guarda, quando há espaço para mostrar.

                O limiar é o mesmo do interior de um contêiner, e pela mesma
                razão: de longe, uma tabela de doze linhas é doze borrões. O que
                muda é que aqui não há um nível abaixo — o conteúdo **é** o
                objeto, e por isso ele aparece dentro dele, sem moldura nova.
              */}
              {(() => {
                const linhas = conteudo?.(place.id);
                if (linhas === undefined || linhas.length === 0) return null;
                if (!tabelaLegivel(unidadesPorQuadro)) return null;
                const alturaDaLinha = ALTURA_DA_LINHA;
                const cabem = Math.max(0, Math.floor((place.h - 26) / alturaDaLinha));
                if (cabem < 1) return null;
                const mostradas = linhas.slice(0, cabem);
                return (
                  <g className="dui-stage__conteudo">
                    {mostradas.map((linha, i) => (
                      <g key={linha.chave} data-ativo={linha.ativo === true ? "true" : undefined}>
                        <rect
                          className="dui-stage__linha"
                          x={place.x + 6}
                          y={place.y + 20 + i * alturaDaLinha}
                          width={place.w - 12}
                          height={alturaDaLinha - 2}
                          rx={2}
                        />
                        <text
                          className="dui-stage__linha-chave"
                          x={place.x + 11}
                          y={place.y + 30 + i * alturaDaLinha}
                        >
                          {linha.chave}
                        </text>
                        <text
                          className="dui-stage__linha-valor"
                          x={place.x + place.w - 11}
                          y={place.y + 30 + i * alturaDaLinha}
                          textAnchor="end"
                        >
                          {linha.valor}
                        </text>
                      </g>
                    ))}
                    {linhas.length > mostradas.length ? (
                      // Dizer quantas ficaram de fora é diferente de cortar em
                      // silêncio: o leitor sabe que a caixa tem mais.
                      <text
                        className="dui-stage__linha-resto"
                        x={place.x + place.w / 2}
                        y={place.y + place.h - 6}
                        textAnchor="middle"
                      >
                        {`+${linhas.length - mostradas.length}`}
                      </text>
                    ) : null}
                  </g>
                );
              })()}

              {/*
                As portas da caixa: por onde entra, por onde sai.

                Elas **não** somem quando o interior aparece — pelo contrário,
                é aí que servem mais. Com o interior aberto, a borda da caixa
                vira a margem do desenho de dentro, e a porta é a única pista
                de qual pedaço daquela margem era a entrada. Sem ela o leitor vê
                um circuito flutuando, sem saber de onde a coisa veio.
              */}
              <g className="dui-stage__portas">
                {portas.entradas.map((porta, i) => {
                  const cy = place.y + place.h * posicaoDaPorta(i, portas.entradas.length);
                  return (
                    <g key={`e${porta}`} className="dui-stage__porta" data-lado="entrada">
                      <title>{`in · ${porta}`}</title>
                      <rect x={place.x - 6} y={cy - 8} width={12} height={16} rx={2} />
                      {aparece > 0.5 ? (
                        <text className="dui-stage__porta-nome" x={place.x + 10} y={cy + 3}>
                          {porta}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {portas.saidas.map((porta, i) => {
                  // No trapézio a saída fica no bico, e não espalhada pela
                  // borda: é ali que a linha realmente sai.
                  const cy =
                    node?.kind === "router"
                      ? place.y + place.h / 2
                      : place.y + place.h * posicaoDaPorta(i, portas.saidas.length);
                  return (
                    <g key={`s${porta}`} className="dui-stage__porta" data-lado="saida">
                      <title>{`out · ${porta}`}</title>
                      <rect x={place.x + place.w - 6} y={cy - 8} width={12} height={16} rx={2} />
                      {aparece > 0.5 ? (
                        <text
                          className="dui-stage__porta-nome"
                          x={place.x + place.w - 10}
                          y={cy + 3}
                          textAnchor="end"
                        >
                          {porta}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>

              {/*
                O rosto da caixa cede lugar ao interior, e cede **antes** de o
                interior chegar inteiro: um rótulo "more inside" por cima do
                inside já visível diz ao leitor o contrário do que ele está
                vendo. Some na metade da rampa; o interior termina de subir com
                o campo livre.
              */}
              <g className="dui-stage__rosto" opacity={Math.max(0, 1 - aparece * 2)}>
              {fam === "container" || molduras.has(place.id) ? (
                <text className="dui-stage__titulo" x={place.x + 12} y={place.y + 18}>
                  {rotulo}
                </text>
              ) : fam === "conduit" ? (
                // O nome de uma pista vai na **ponta de onde ela sai**, rente à
                // linha, como a placa de uma estrada. Centralizado acima, ele
                // caía entre duas pistas e o leitor não sabia de qual era.
                <>
                  <text
                    className="dui-stage__titulo"
                    x={sentidoDaPista(place.id) === 1 ? place.x + 4 : place.x + place.w - 4}
                    y={place.y + place.h / 2 - 6}
                    textAnchor={sentidoDaPista(place.id) === 1 ? "start" : "end"}
                  >
                    {rotulo}
                  </text>
                  {leitura === undefined ? null : (
                    <text
                      className="dui-stage__leitura"
                      x={place.x + place.w / 2}
                      y={place.y + place.h / 2 + 4}
                      textAnchor="middle"
                    >
                      {leitura}
                    </text>
                  )}
                </>
              ) : (
                <>
                  {fam === "processor" && place.h >= 34 ? (
                    // Uma chave não processa: ela deixa passar. Engrenagem nela
                    // seria o mesmo gesto para duas coisas diferentes.
                    node?.kind === "switch" ? (
                      <Chave
                        x={place.x + place.w - 18}
                        y={place.y + 16}
                        r={7}
                        fechada={passa(place.id)}
                      />
                    ) : (
                      <Engrenagem x={place.x + place.w - 16} y={place.y + 16} r={6} />
                    )
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

      {/*
        A esteira vai por cima das caixas, e não por baixo.
        Desenhada antes dos objetos, a carga sumia atrás de toda caixa que ela
        cruzava — inclusive a caixa em que ela estava entrando, que é
        exatamente o momento que se quer ver.
      */}
      {/*
        As âncoras da moldura.

        Uma ligação que continua fora do foco não some e não flutua: ela nasce
        (ou morre) na margem, marcada. Sem isso, subir um nível deixava caixas
        soltas e o leitor sem saber de onde a coisa vinha — era o zoom out
        desconectando os diagramas.
      */}
      <g className="dui-stage__ancoras">
        {[...new Map(
          arestas
            .filter((a) => a.ancora !== undefined)
            .map((a) => {
              const ponta = a.ancora === "entra" ? a.deLugar : a.paraLugar;
              return [`${a.ancora}:${Math.round(ponta.y)}`, { lado: a.ancora!, ponta }] as const;
            }),
        ).values()].map(({ lado, ponta }) => (
          <g key={`${lado}${ponta.y}`} className="dui-stage__ancora" data-lado={lado}>
            <title>{lado === "entra" ? "comes from outside this frame" : "goes outside this frame"}</title>
            <rect
              x={lado === "entra" ? 0 : view.width - 7}
              y={ponta.y + ponta.h / 2 - 9}
              width={7}
              height={18}
              rx={2}
            />
            <text
              className="dui-stage__ancora-nome"
              x={lado === "entra" ? 11 : view.width - 11}
              y={ponta.y + ponta.h / 2 - 14}
              textAnchor={lado === "entra" ? "start" : "end"}
            >
              {lado === "entra" ? "in" : "out"}
            </text>
          </g>
        ))}
      </g>

      <g className="dui-stage__travessias">
        {arestas
          .filter((a) => a.d !== a.traco)
          .map((a) => (
            <path key={`t${a.chave}`} className="dui-stage__travessia" d={a.d} />
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
                data-especie={especieDaCarga?.(mensagem)}
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
                  largura={aresta.width}
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
              data-especie={especieDaCarga?.(item.message)}
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
                largura={larguraEntre.get(`${item.from}->${String(item.to)}`)}
                de={item.from}
                para={String(item.to)}
              />
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
/** Quanto dura a viagem da câmera. Curta o bastante para não cansar. */
const DURACAO_DA_TRANSICAO = 420;

export function Stage(props: StageProps) {
  const { view, tickMs = 700, state, tree, alvoDeCamera, partirDe, onEnquadrado } = props;

  // Uma vez por tick, e não uma vez por camada aberta: a resolução percorre a
  // árvore até o ponto fixo, e um modelo aberto até o fundo tem milhares de
  // nós.
  const emissoes = useMemo(() => emissoesPorPorta(state, tree), [state, tree]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [camera, setCamera] = useState({
    escala: 1,
    x: view.width / 2,
    y: view.height / 2,
    vista: view.id,
  });

  /**
   * O enquadramento que põe um retângulo na tela inteira.
   *
   * Uniforme, pelo lado que aperta — o mesmo critério do encaixe de um
   * interior. Esticar para preencher distorceria, e a proporção é informação.
   */
  const enquadramentoDe = (r: { x: number; y: number; w: number; h: number }) => {
    const escala = Math.max(
      1,
      Math.min(ZOOM_MAXIMO, Math.min(view.width / Math.max(1, r.w), view.height / Math.max(1, r.h))),
    );
    const lq = view.width / escala;
    const aq = view.height / escala;
    return {
      escala,
      x: Math.min(view.width - lq / 2, Math.max(lq / 2, r.x + r.w / 2)),
      y: Math.min(view.height - aq / 2, Math.max(aq / 2, r.y + r.h / 2)),
    };
  };

  const inteira = () => ({ escala: 1, x: view.width / 2, y: view.height / 2 });

  /**
   * Trocar de vista é trocar de assunto, e a câmera acompanha.
   *
   * O enquadramento é **derivado do render**, e não corrigido por efeito: a
   * câmera carrega de qual vista ela é, e uma câmera de outra vista simplesmente
   * não vale. Por efeito, o quadro final da viagem chegava depois da troca e a
   * vista nova nascia enquadrada nas coordenadas da antiga — um desenho aberto
   * num pedaço aleatório de si mesmo.
   *
   * Sem `partirDe`, a vista nova entra inteira. Com ele, ela começa enquadrando
   * de onde o leitor veio e se afasta — que é o zoom de saída, e é o que impede
   * subir um nível de parecer um corte para outro lugar.
   */
  const daVista =
    camera.vista === view.id
      ? camera
      : { ...(partirDe === undefined ? inteira() : enquadramentoDe(partirDe)), vista: view.id };

  useEffect(() => {
    if (camera.vista === view.id) return;
    const entrada = partirDe === undefined ? inteira() : enquadramentoDe(partirDe);
    setCamera({ ...entrada, vista: view.id });
    if (partirDe === undefined) return;
    const solta = requestAnimationFrame(() => setCamera({ ...inteira(), vista: view.id }));
    return () => cancelAnimationFrame(solta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id, partirDe]);

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
            vista: view.id,
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
    // `view.id` entra porque a câmera carimba de qual vista ela é: sem ele, a
    // roda de uma vista nova gravaria o nome da anterior, e o enquadramento
    // seria descartado a cada quadro.
  }, [view.id, view.width, view.height]);

  /**
   * A viagem até o alvo, quadro a quadro.
   *
   * Interpolar a **escala em logaritmo** e não linearmente: zoom é
   * multiplicativo, e uma rampa linear passa quase toda a animação perto do
   * fim, dando a impressão de que travou e depois pulou.
   */
  useEffect(() => {
    if (alvoDeCamera === undefined) return;
    const de = daVista;
    const para = enquadramentoDe(alvoDeCamera);
    const inicio = performance.now();
    let vivo = true;
    const passo = (agora: number) => {
      if (!vivo) return;
      const t = Math.min(1, (agora - inicio) / DURACAO_DA_TRANSICAO);
      const suave = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setCamera({
        escala: Math.exp(Math.log(de.escala) + (Math.log(para.escala) - Math.log(de.escala)) * suave),
        x: de.x + (para.x - de.x) * suave,
        y: de.y + (para.y - de.y) * suave,
        vista: view.id,
      });
      if (t < 1) requestAnimationFrame(passo);
      else onEnquadrado?.();
    };
    const id = requestAnimationFrame(passo);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
    // A câmera de partida é lida uma vez, no começo da viagem: relê-la a cada
    // quadro faria a animação perseguir a si mesma e nunca chegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvoDeCamera]);

  const larguraDoQuadro = view.width / daVista.escala;
  const alturaDoQuadro = view.height / daVista.escala;

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
      x: daVista.x - larguraDoQuadro / 2 + ((clientX - caixa.left) / caixa.width) * larguraDoQuadro,
      y: daVista.y - alturaDoQuadro / 2 + ((clientY - caixa.top) / caixa.height) * alturaDoQuadro,
    };
  };

  return (
    <svg
      ref={svgRef}
      className="dui-stage"
      data-zoom={daVista.escala > 1 ? "true" : undefined}
      viewBox={`${daVista.x - larguraDoQuadro / 2} ${daVista.y - alturaDoQuadro / 2} ${larguraDoQuadro} ${alturaDoQuadro}`}
      role="img"
      aria-label={view.title}
      style={{ ["--dui-tick" as string]: `${tickMs}ms` }}
      onPointerDown={(e) => {
        if (e.button !== 0 || daVista.escala <= 1) return;
        const alvo = e.currentTarget;
        alvo.setPointerCapture(e.pointerId);
        const partiu = { x: e.clientX, y: e.clientY, camera: daVista };
        const arrastar = (ev: PointerEvent) => {
          const caixa = alvo.getBoundingClientRect();
          if (caixa.width === 0) return;
          const dx = ((ev.clientX - partiu.x) / caixa.width) * (view.width / partiu.camera.escala);
          const dy = ((ev.clientY - partiu.y) / caixa.height) * (view.height / partiu.camera.escala);
          setCamera({
            ...enquadrar(partiu.camera.escala, partiu.camera.x - dx, partiu.camera.y - dy),
            vista: view.id,
          });
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
        if (e.target === e.currentTarget) {
          setCamera({ ...enquadrar(1, view.width / 2, view.height / 2), vista: view.id });
        }
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
        dilatacao={1}
      />
    </svg>
  );
}
