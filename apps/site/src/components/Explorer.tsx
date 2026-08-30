import { useMemo, useState } from "react";
import { isOpenable } from "@ovh/depth-core";
import type { Message, TreeIndex, Wire, WorldState } from "@ovh/depth-core";
import { Stage, autoView, pathTo } from "@ovh/depth-ui";
import type { NodePlacement, View } from "@ovh/depth-ui";
import { Ficha } from "./Ficha.js";

/**
 * O palco com profundidade: clique duas vezes num objeto e você entra nele.
 *
 * As views desenhadas à mão dão o enquadramento bonito dos lugares que
 * importam; para todo o resto há a view montada sozinha. É isso que faz descer
 * ser sempre possível — sem ela, abrir um objeto que ninguém desenhou não
 * mostraria nada, e a profundidade seria promessa em vez de caminho.
 */

export interface ExplorerProps {
  readonly tree: TreeIndex;
  readonly wires: readonly Wire[];
  readonly state: WorldState;
  readonly previous?: WorldState | undefined;
  readonly edgeTicks?: number;
  readonly tickMs?: number;
  /** Views desenhadas à mão, por foco. A montada sozinha cobre o resto. */
  readonly views: readonly View[];
  readonly inicial?: string | undefined;
  readonly fills?: Readonly<Record<string, number>> | undefined;
  readonly readouts?: Readonly<Record<string, string>> | undefined;
  /** Quem está com a saída em alto. Só o domínio sabe ler o valor que saiu. */
  readonly altos?: ReadonlySet<string> | undefined;
  /** O valor que a carga leva. Quem sabe ler o dado é o domínio. */
  readonly leituraDaCarga?: ((mensagem: Message) => string | undefined) | undefined;
  /** O que cada caixa guarda agora. Quem lê o estado é o domínio. */
  readonly conteudo?:
    | ((id: string) => readonly { readonly chave: string; readonly valor: string; readonly ativo?: boolean }[] | undefined)
    | undefined;
  /** Mostra a ficha do objeto selecionado ao lado do palco. */
  readonly comFicha?: boolean;
}

export function Explorer({
  tree,
  wires,
  state,
  previous,
  edgeTicks,
  tickMs,
  views,
  inicial,
  fills,
  readouts,
  altos,
  leituraDaCarga,
  conteudo,
  comFicha = false,
}: ExplorerProps) {
  const primeiro = inicial ?? views[0]?.focus ?? tree.rootId;
  const [foco, setFoco] = useState(primeiro);
  /**
   * A seleção carrega o enquadramento em que foi feita.
   *
   * Ela era um id solto, e sobrevivia à navegação: descer até o NAND, ler a
   * ficha dele e voltar ao topo pela trilha deixava a ficha explicando uma
   * peça que não está mais na tela. O leitor lia a descrição errada achando
   * que ela descreve o que está vendo.
   *
   * A correção não é limpar quando clicam na trilha. Isso é regra sobre um
   * botão, e sobraria todo outro caminho de navegação — entrar numa caixa,
   * subir por outro lado — para alguém lembrar de cobrir depois. **Seleção
   * fora do enquadramento não é seleção**, e o jeito de isso não ter exceção é
   * o par carregar o foco junto: quem lê descarta o que não é daqui, e não há
   * limpeza a esquecer em lugar nenhum.
   *
   * Não dá para conferir contra o que o palco desenhou: o interior de uma
   * caixa aparece ou não conforme o nível de detalhe, que é conta do palco. O
   * enquadramento, esse, é a mesma coisa dos dois lados.
   */
  const [selecao, setSelecao] = useState<{ readonly foco: string; readonly id: string }>();
  const selecionado = selecao?.foco === foco ? selecao.id : undefined;
  const selecionar = (id: string): void => setSelecao({ foco, id });

  const view = useMemo(
    () => views.find((v) => v.focus === foco) ?? autoView(tree, foco, wires),
    [views, foco, tree, wires],
  );
  const trilha = pathTo(tree, foco);

  /**
   * O interior de uma caixa, para o zoom contínuo.
   *
   * É derivado, e é essa a garantia: o interior de `x` é a view **focada em
   * `x`**, e não uma escolha que alguém faz caixa a caixa. Escrever esse
   * casamento à mão seria dar a um componente de desenho o poder de afirmar
   * quem mora dentro de quem.
   *
   * Guardado em cache porque `autoView` monta um layout, e montar o mesmo a
   * cada quadro de zoom seria pagar caro por nada.
   */
  const interiores = useMemo(() => {
    const cache = new Map<string, View | undefined>();
    return (id: string): View | undefined => {
      if (cache.has(id)) return cache.get(id);
      const achada = isOpenable(tree, id)
        ? (views.find((v) => v.focus === id) ?? autoView(tree, id, wires))
        : undefined;
      cache.set(id, achada);
      return achada;
    };
  }, [views, tree, wires]);

  /**
   * Entrar num objeto é uma **viagem da câmera**, e não um corte.
   *
   * A vista só troca quando a câmera já enquadrou a caixa — e nessa escala o
   * interior dela já está desenhado, então a troca acontece sem o leitor ver.
   * Cortar direto era perder a relação entre os dois níveis: o leitor via o
   * interior e não via mais de que ele era o interior.
   */
  const [viagem, setViagem] = useState<{ readonly para: string } | undefined>(undefined);
  const [partirDe, setPartirDe] = useState<NodePlacement | undefined>(undefined);

  const abrir = (id: string): void => {
    if (id === foco || !isOpenable(tree, id)) return;
    const caixa = view.places.find((p) => p.id === id);
    if (caixa === undefined) {
      setFoco(id);
      return;
    }
    setViagem({ para: id });
  };

  const chegou = (): void => {
    if (viagem === undefined) return;
    setFoco(viagem.para);
    setPartirDe(undefined);
    setViagem(undefined);
  };

  /**
   * Sair é a mesma viagem ao contrário: a vista de cima entra já enquadrada em
   * quem o leitor estava vendo, e se afasta até caber inteira.
   */
  const subirPara = (id: string): void => {
    if (id === foco) return;
    const acima = views.find((v) => v.focus === id) ?? autoView(tree, id, wires);
    setPartirDe(acima.places.find((p) => p.id === foco));
    setFoco(id);
  };

  /**
   * O alvo precisa ser **estável** entre quadros.
   *
   * Recalculado a cada render, ele muda de identidade sessenta vezes por
   * segundo, e a viagem reinicia em cada uma: a câmera se aproxima do alvo por
   * uma exponencial que nunca chega, e a transição fica com cara de travamento.
   */
  const alvoDeCamera = useMemo(
    () => (viagem === undefined ? undefined : view.places.find((p) => p.id === viagem.para)),
    [viagem, view],
  );

  return (
    <div className="explorer">
      <nav className="explorer__trilha mono" aria-label="Onde você está">
        {trilha.map((id, i) => (
          <span key={id}>
            {i > 0 ? <span aria-hidden="true"> › </span> : null}
            <button
              type="button"
              onClick={() => subirPara(id)}
              aria-current={id === foco ? "true" : undefined}
              disabled={id === foco}
            >
              {tree.byId.get(id)?.label ?? id}
            </button>
          </span>
        ))}
        <span className="explorer__dica">
          {view.id.startsWith("auto:")
            ? "auto-laid view · double-click to enter"
            : "double-click to enter"}
        </span>
      </nav>

      <div className="explorer__corpo" data-com-ficha={comFicha ? "true" : undefined}>
        <Stage
          tree={tree}
          wires={wires}
          view={view}
          state={state}
          previous={previous}
          {...(edgeTicks === undefined ? {} : { edgeTicks })}
          {...(tickMs === undefined ? {} : { tickMs })}
          fills={fills}
          readouts={readouts}
          altos={altos}
          selected={selecionado}
          onSelect={selecionar}
          onOpen={abrir}
          interiores={interiores}
          alvoDeCamera={alvoDeCamera}
          partirDe={partirDe}
          onEnquadrado={chegou}
          leituraDaCarga={leituraDaCarga}
          conteudo={conteudo}
        />
        {comFicha ? <Ficha tree={tree} wires={wires} state={state} id={selecionado} /> : null}
      </div>
    </div>
  );
}
