import { cruzamentos, segmentos } from "./espaguete.js";

/**
 * O túnel: onde dois fios se cruzam, um mergulha e reaparece do outro lado.
 *
 * É o belt subterrâneo do Factorio, e ele existe lá pela mesma razão que aqui —
 * duas esteiras se cruzando sem que o leitor tenha de adivinhar o que se mistura
 * com o quê. A convenção antiga do esquemático (o T ganha pontinho, o X não)
 * está certa e é **muda por ausência**: quem não a conhece não tem como saber
 * que a falta do ponto quer dizer alguma coisa.
 *
 * Este módulo não desenha nada e não conhece React: ele decide **quem** mergulha
 * e **onde**. Quem pinta é o `Stage`.
 */

/** Um fio já roteado, do jeito que o palco o desenhou. */
export interface FioDesenhado {
  readonly chave: string;
  readonly d: string;
  /** A largura declarada pelo modelo. Ausente é fio de uma via. */
  readonly width?: number | undefined;
}

/** Onde um fio some, e por quanto. */
export interface Lacuna {
  /** De quem é o mergulho. */
  readonly chave: string;
  /** O centro do buraco. */
  readonly x: number;
  readonly y: number;
  /** Se o trecho que mergulha está deitado. Decide para que lado o buraco abre. */
  readonly horizontal: boolean;
  /** Metade do comprimento do buraco: do centro até cada boca. */
  readonly folga: number;
}

/** Do centro até a boca, quando há espaço. */
const MERGULHO = 6;
/** O mínimo que ainda se lê como buraco, e não como falha de antialiasing. */
const MINIMO = 2;
/** Encostado na ponta do trecho, o buraco invadiria a porta. */
const MARGEM_DA_PONTA = 2;

const larguraDe = (fio: FioDesenhado): number => fio.width ?? 1;

/**
 * Quem mergulha. Duas regras, e elas bastam.
 *
 * 1. o fio **mais estreito** passa por baixo do mais largo — o barramento é a
 *    linha que o leitor está seguindo, então quem some é o magro;
 * 2. empatados na largura, mergulha **o em pé**: o olho segue a linha deitada.
 *
 * O plano previa uma terceira regra (a ordem das chaves) para o caso de empate
 * também na orientação. Ela **não existe**: um cruzamento é, por construção, um
 * trecho deitado com um em pé — é o que `seCruzam` exige —, então a segunda
 * regra sempre resolve. Uma terceira regra aqui seria código morto fingindo
 * decidir alguma coisa.
 */
function quemMergulha(
  a: FioDesenhado,
  b: FioDesenhado,
  horizontalA: boolean,
): { readonly fio: FioDesenhado; readonly horizontal: boolean } {
  const larguraA = larguraDe(a);
  const larguraB = larguraDe(b);
  if (larguraA !== larguraB) {
    return larguraA < larguraB
      ? { fio: a, horizontal: horizontalA }
      : { fio: b, horizontal: !horizontalA };
  }
  return horizontalA ? { fio: b, horizontal: false } : { fio: a, horizontal: false };
}

/** O trecho, dentro do fio, que passa por este ponto na orientação dada. */
function trechoNoPonto(
  fio: FioDesenhado,
  x: number,
  y: number,
  horizontal: boolean,
): { readonly de: number; readonly ate: number } | undefined {
  for (const s of segmentos(fio.d)) {
    const deitado = s.y1 === s.y2;
    if (deitado !== horizontal) continue;
    if (deitado && s.y1 === y && x > Math.min(s.x1, s.x2) && x < Math.max(s.x1, s.x2)) {
      return { de: Math.min(s.x1, s.x2), ate: Math.max(s.x1, s.x2) };
    }
    if (!deitado && s.x1 === x && y > Math.min(s.y1, s.y2) && y < Math.max(s.y1, s.y2)) {
      return { de: Math.min(s.y1, s.y2), ate: Math.max(s.y1, s.y2) };
    }
  }
  return undefined;
}

interface Acumulado {
  readonly chave: string;
  readonly horizontal: boolean;
  /** A coordenada fixa do trecho: o `y` de quem está deitado, o `x` de quem está em pé. */
  readonly fixa: number;
  readonly limites: { readonly de: number; readonly ate: number };
  readonly posicoes: number[];
}

/**
 * As lacunas de todos os fios.
 *
 * Cruzamentos vizinhos **no mesmo trecho do mesmo fio** viram um túnel só: é o
 * que o belt subterrâneo faz, mergulhar antes do primeiro e reaparecer depois do
 * último. Dois buracos colados se leriam como um fio picotado, que é justamente
 * a "quebra" que este round existe para matar.
 */
export function tuneis(fios: readonly FioDesenhado[]): readonly Lacuna[] {
  const porTrecho = new Map<string, Acumulado>();

  for (const c of cruzamentos(fios.map((f) => f.d))) {
    const a = fios[c.a];
    const b = fios[c.b];
    if (a === undefined || b === undefined) continue;

    const escolhido = quemMergulha(a, b, c.horizontalA);
    const trecho = trechoNoPonto(escolhido.fio, c.x, c.y, escolhido.horizontal);
    // Sem trecho não há onde abrir o buraco. Acontece se o caminho tiver curva,
    // que `segmentos` não lê — e aí o cruzamento também não foi contado.
    if (trecho === undefined) continue;

    const fixa = escolhido.horizontal ? c.y : c.x;
    const posicao = escolhido.horizontal ? c.x : c.y;
    const id = `${escolhido.fio.chave}|${escolhido.horizontal ? "h" : "v"}|${fixa}|${trecho.de}-${trecho.ate}`;

    const existente = porTrecho.get(id);
    if (existente === undefined) {
      porTrecho.set(id, {
        chave: escolhido.fio.chave,
        horizontal: escolhido.horizontal,
        fixa,
        limites: trecho,
        posicoes: [posicao],
      });
      continue;
    }
    existente.posicoes.push(posicao);
  }

  const saida: Lacuna[] = [];
  for (const acumulado of porTrecho.values()) {
    for (const grupo of agrupar(acumulado.posicoes)) {
      const menor = Math.min(...grupo);
      const maior = Math.max(...grupo);
      const centro = (menor + maior) / 2;
      const metade = (maior - menor) / 2;
      // A folga é o que cabe: perto da ponta do trecho ela encolhe em vez de
      // invadir a porta em que o fio chega.
      const espaco =
        Math.min(centro - acumulado.limites.de, acumulado.limites.ate - centro) - MARGEM_DA_PONTA;
      const folga = Math.max(MINIMO, Math.min(metade + MERGULHO, espaco));
      saida.push({
        chave: acumulado.chave,
        horizontal: acumulado.horizontal,
        x: acumulado.horizontal ? centro : acumulado.fixa,
        y: acumulado.horizontal ? acumulado.fixa : centro,
        folga,
      });
    }
  }
  // Ordem estável: o desenho não pode depender da ordem de iteração do mapa.
  return saida.sort((p, q) => p.chave.localeCompare(q.chave) || p.x - q.x || p.y - q.y);
}

/** Posições vizinhas o bastante para caberem no mesmo túnel. */
function agrupar(posicoes: readonly number[]): readonly (readonly number[])[] {
  const ordenadas = [...posicoes].sort((a, b) => a - b);
  const grupos: number[][] = [];
  for (const p of ordenadas) {
    const ultimo = grupos[grupos.length - 1];
    const fim = ultimo?.[ultimo.length - 1];
    if (ultimo !== undefined && fim !== undefined && p - fim <= MERGULHO * 2) {
      ultimo.push(p);
      continue;
    }
    grupos.push([p]);
  }
  return grupos;
}
