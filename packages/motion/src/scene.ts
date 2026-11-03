import type { Box, Path, Point } from "./geometry.js";

/**
 * O vocabulário do palco. São formas, não assuntos: uma caixa, uma linha de
 * vida, uma ligação, uma ficha que viaja, uma barra que cresce, uma nota e uma
 * região. Quem decide que a caixa é um serviço e a ficha é uma requisição é
 * quem escreve a coreografia — este arquivo nunca vai saber.
 *
 * O `tone` lê o catálogo visual por sentido (`processor`, `live`, `kind-2`…),
 * nunca por valor; o CSS traduz cada sentido para a tinta do catálogo.
 */
export type Tone =
  | "ink"
  | "muted"
  | "live"
  | "high"
  | "processor"
  | "container"
  | "controller"
  | "conduit"
  | "kind-1"
  | "kind-2"
  | "kind-3"
  | "kind-4"
  | "kind-5";

/**
 * A forma diz o que a peça É. `stack` é equipamento (rack); `chip`, `mux`,
 * `alu`, `register` e `memory` são o vocabulário do diagrama de blocos; `and`,
 * `or`, `xor` e `not` são o do esquemático. Ver `shapes.ts`.
 */
export type Shape =
  | "box"
  | "pill"
  | "circle"
  | "diamond"
  | "cylinder"
  | "stack"
  | "window"
  | "server"
  | "router"
  | "chip"
  | "mux"
  | "alu"
  | "register"
  | "memory"
  | "and"
  | "or"
  | "xor"
  | "not";

/** Propriedades que o tempo pode mudar. Números interpolam; texto troca. */
export interface Animatable {
  /** Visibilidade, 0–1. */
  opacity: number;
  /** Deslocamento sobre a posição declarada. */
  dx: number;
  dy: number;
  scale: number;
  /** Brilho de destaque, 0–1. */
  glow: number;
  /** Onda que sai da peça, 0–1; volta a 0 quando acaba. */
  ping: number;
  /** Avanço: ficha no caminho, traço sendo desenhado, barra crescendo. */
  progress: number;
  /** Rebaixa a peça para o fundo, 0–1. */
  dim: number;
  /** Quanto a peça sobe acima do lugar dela, no 3D (a tampa que sai do chip). */
  lift: number;
  label: string;
  sublabel: string;
  tone: Tone;
}

export type Prop = keyof Animatable;
export type PropValue = number | string;

interface Common {
  readonly id: string;
  /** Ordem de desenho: maior fica por cima. */
  readonly layer?: number;
  readonly hidden?: boolean;
  readonly label?: string;
  readonly sublabel?: string;
  readonly tone?: Tone;
  /** Texto para leitor de tela, quando o rótulo não basta. */
  readonly title?: string;
  /**
   * Multiplica o tamanho do texto e dos traços da peça. Uma peça de um nível
   * fundo é pequena no mundo; com `textScale` proporcional, ela lê no mesmo
   * tamanho que a de cima quando a câmera chega nela.
   */
  readonly textScale?: number;
  /**
   * Nível de detalhe, pelo zoom da câmera: a peça surge entre `appear·0,7` e
   * `appear`, e some entre `vanish` e `vanish·1,4`. É o que faz a descida
   * acontecer sem espaguete: o interior só existe quando dá para lê-lo, e a
   * caixa fechada sai quando o interior chega.
   */
  readonly lod?: { readonly appear?: number; readonly vanish?: number };
  /** No 3D: a altura em que a base da peça fica (sobre o que ela está montada). */
  readonly elevation?: number;
  /** No 3D: a altura da peça, quando a proporção da caixa não é a certa. */
  readonly height?: number;
  /**
   * No 3D: do que a peça é feita. `metal` brilha (a tampa de um chip),
   * `silicon` é escuro e espelhado (o die), `pcb` é fosco (a placa).
   */
  readonly material?: "matte" | "metal" | "silicon" | "pcb" | "glass";
}

export interface NodeSpec extends Common {
  readonly type: "node";
  readonly box: Box;
  readonly shape?: Shape;
  /** Uma marca curta dentro da peça (um glifo, uma sigla). */
  readonly badge?: string;
}

export interface LaneSpec extends Common {
  readonly type: "lane";
  /** A cabeça da linha de vida. */
  readonly head: Box;
  /** Até onde a linha desce. */
  readonly bottom: number;
  /**
   * A cabeça acompanha a câmera: com o palco aproximado numa parte baixa do
   * diagrama, ela desce até a borda de cima do quadro em vez de sair dele.
   */
  readonly sticky?: boolean;
}

export interface LinkSpec extends Common {
  readonly type: "link";
  readonly path: Path;
  readonly dashed?: boolean;
  readonly arrow?: boolean;
  /** Onde o rótulo fica ao longo do caminho, 0–1. */
  readonly labelAt?: number;
}

export interface TokenSpec extends Common {
  readonly type: "token";
  readonly path: Path;
  readonly size?: number;
  /** Quantos fantasmas a ficha deixa para trás. */
  readonly trail?: number;
}

export interface BarSpec extends Common {
  readonly type: "bar";
  readonly box: Box;
  /** Para onde a barra cresce enquanto `progress` vai de 0 a 1. */
  readonly grow?: "down" | "right";
}

export interface NoteSpec extends Common {
  readonly type: "note";
  readonly at: Point;
  readonly align?: "start" | "middle" | "end";
  readonly width?: number;
}

export interface RegionSpec extends Common {
  readonly type: "region";
  readonly box: Box;
}

/**
 * A saída de emergência: uma peça que o domínio desenha sozinho, e que mesmo
 * assim anda no tempo do palco. `draw` recebe as propriedades já resolvidas no
 * instante; o renderizador decide o que é um desenho válido (no React, um nó).
 */
export interface CustomSpec extends Common {
  readonly type: "custom";
  readonly box: Box;
  readonly draw: (state: Readonly<Animatable>, time: number) => unknown;
}

export type EntitySpec = NodeSpec | LaneSpec | LinkSpec | TokenSpec | BarSpec | NoteSpec | RegionSpec | CustomSpec;
export type EntityType = EntitySpec["type"];

/** Onde a câmera está olhando: centro e largura visível. A altura segue a proporção. */
export interface CameraState {
  cx: number;
  cy: number;
  /** A altura para onde o 3D mira: a superfície do nível em que a câmera está. */
  elev?: number;
  /** 1 = o palco inteiro. 2 = metade da largura, o dobro do tamanho. */
  zoom: number;
}

export const CAMERA = "@camera";

export function initialState(spec: EntitySpec): Animatable {
  return {
    opacity: spec.hidden === true ? 0 : 1,
    dx: 0,
    dy: 0,
    scale: 1,
    glow: 0,
    ping: 0,
    // Linha, ficha e barra nascem por fazer se nascem escondidas; visíveis, já feitas.
    progress: spec.hidden === true && (spec.type === "link" || spec.type === "token" || spec.type === "bar") ? 0 : 1,
    dim: 0,
    lift: 0,
    label: spec.label ?? "",
    sublabel: spec.sublabel ?? "",
    tone: spec.tone ?? "ink",
  };
}

export function boxOf(spec: EntitySpec): Box | null {
  switch (spec.type) {
    case "node":
    case "bar":
    case "region":
    case "custom":
      return spec.box;
    case "lane":
      return { x: spec.head.x, y: spec.head.y, w: spec.head.w, h: spec.bottom - spec.head.y };
    case "note":
      return { x: spec.at.x - (spec.width ?? 160) / 2, y: spec.at.y - 12, w: spec.width ?? 160, h: 24 };
    case "link":
    case "token":
      return null;
  }
}
