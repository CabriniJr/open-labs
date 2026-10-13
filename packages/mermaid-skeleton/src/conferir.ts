import { indexTree } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import type { Skeleton } from "./types.js";

/**
 * O desenho contra o run: as três formas de o `.mmd` mentir sem falhar.
 *
 * O formato aposta em strings escritas à mão no rótulo de cada aresta — a porta
 * antes do `:`, o kind da mensagem depois. Errar ali não quebra nada: o parser
 * aceita, o compilador aceita (um nó com `override` não tem porta validada,
 * porque o compilador não pode saber por quais portas uma função emite),
 * `validateWorld` aceita, o mundo é válido, e o run roda. O que muda é **o que
 * o lab ensina**, e num material em que o desenho é o argumento isso é a pior
 * classe de defeito que existe.
 *
 * As três, e cada uma pega o que as outras não pegam:
 *
 * 1. **Emissão sem fio.** O comportamento fala e ninguém ouve. Esta o motor já
 *    media sozinho — `out:<nó>.<porta>.unwired` no livro-caixa — e quem lê é
 *    `emissoesPerdidas`, no `depth-core`. Não está aqui porque não é do
 *    formato: vale para mundo escrito à mão também.
 * 2. **Fio sem emissão** (`sem-trafego`). O desenho mostra uma ligação que não
 *    existe. É a pior das três para um leitor: ele não tem como saber que
 *    aquela linha nunca carregou nada.
 * 3. **Rótulo que mente** (`kind-divergente`). O canal carrega, mas o rótulo
 *    nomeia outra coisa. A mais barata de cometer e a mais difícil de ver — o
 *    lab roda, ensina a topologia certa, e nomeia errado o que passa por ela.
 *
 * A §3 do design do esqueleto diz que o rótulo do canal **é** o kind da
 * mensagem no vocabulário do domínio. O compilador lê esse kind e o descarta:
 * `WorldSpec.wires` não tem campo para ele, e quem decide o kind do que viaja é
 * `ctx.emit(kind, …)`, no comportamento. Então a declaração existe, é
 * normativa, e nada a conferia.
 */
export interface DivergenciaDoDesenho {
  /** `"<nó>.<porta>"`, como o livro-caixa nomeia. */
  readonly canal: string;
  readonly problema: "sem-trafego" | "kind-divergente";
  readonly detalhe: string;
}

/**
 * Os kinds que de fato saíram de cada porta, acumulados ao longo de um run.
 *
 * Recebe os estados, e não o `World`, para ser pura: quem roda o mundo é o
 * chamador, que é também quem sabe quantos ticks o lab precisa e com quais
 * parâmetros.
 *
 * Lê `flight`, e **não** `settled`. `settled` registra só a fase de acomodação;
 * comportamento que age no `commit` — a maioria — não aparece lá. Uma sonda
 * escrita com `settled` devolve mapa vazio e parece um achado.
 */
export function observarCanais(
  estados: readonly WorldState[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const porCanal = new Map<string, Set<string>>();
  for (const estado of estados) {
    for (const item of estado.flight) {
      const canal = `${item.from}.${item.port}`;
      const vistos = porCanal.get(canal) ?? new Set<string>();
      vistos.add(item.message.kind);
      porCanal.set(canal, vistos);
    }
  }
  return porCanal;
}

/**
 * A pré-condição, verificada em vez de comentada.
 *
 * `observarCanais` indexa por `item.from`, que é **o emissor real** — a folha
 * lá no fundo. Um fio declarado saindo de um composto nunca casa com essa
 * chave: quem emite por aquela porta é um filho, e a cadeia de bornes é o que
 * liga os dois (é o que `emissoesPorPorta` resolve, por tick).
 *
 * Medido na rodada em que isto nasceu: na CPU, **67 de 68** fios que uma conta
 * ingênua de tráfego chamaria de mortos saem de composto e carregam carga
 * normalmente. Uma conferência sem esta guarda seria fábrica de falso positivo,
 * que é como se ensina gente a ignorar guarda.
 *
 * Por isso ela levanta, e não devolve aviso: um chamador que ignora o aviso
 * recebe uma lista de mentiras, e a próxima pessoa a ler o teste acredita nela.
 */
function exigirDesenhoDeFolhas(spec: WorldSpec): void {
  const tree = indexTree(spec.root);
  const deComposto = spec.wires
    .filter((w) => (w.line ?? "data") === "data")
    .filter((w) => {
      const no = tree.byId.get(w.from);
      return no !== undefined && no.leaf !== true && (no.children?.length ?? 0) > 0;
    })
    .map((w) => `${w.from}.${w.port}`);

  if (deComposto.length === 0) return;
  throw new Error(
    "conferirDesenho: este mundo tem fio saindo de composto, e a conferência " +
      "não vale para ele — a chave do livro-caixa pertence à folha de dentro, " +
      "não ao composto, então todo fio desses apareceria como sem tráfego. " +
      `Fios: ${deComposto.join(", ")}. Resolva a cadeia de bornes com ` +
      "`emissoesPorPorta` antes de conferir um desenho com compostos.",
  );
}

/**
 * Confere o desenho contra o run, e devolve só o que divergiu.
 *
 * Lista vazia é o estado saudável, e foi o estado de todos os mundos do
 * repositório no dia em que isto entrou — a conferência não documenta dívida,
 * ela trava o próximo erro.
 *
 * Canal mudo é relatado uma vez, e não duas: sem tráfego não há kind para
 * comparar, e acusar as duas coisas pelo mesmo defeito faria o relato contar
 * mentiras pela metade.
 */
export function conferirDesenho(
  sk: Skeleton,
  spec: WorldSpec,
  observado: ReadonlyMap<string, ReadonlySet<string>>,
): readonly DivergenciaDoDesenho[] {
  exigirDesenhoDeFolhas(spec);

  const divergencias: DivergenciaDoDesenho[] = [];
  for (const aresta of sk.edges) {
    if (aresta.line === "control") continue; // sinal não é carga; `flight` não o conta como tal
    const porta = aresta.fromPort ?? "out";
    const canal = `${aresta.from}.${porta}`;
    const vistos = observado.get(canal);

    if (vistos === undefined || vistos.size === 0) {
      divergencias.push({
        canal,
        problema: "sem-trafego",
        detalhe:
          `o desenho liga ${canal} -> ${aresta.to}, e nada saiu por essa porta ` +
          "em nenhum tick: é uma linha que o leitor vê e que nunca carregou nada",
      });
      continue;
    }

    if (aresta.messageKind === null) continue; // sem rótulo não há promessa a conferir
    const lista = [...vistos].sort();
    if (lista.length !== 1 || lista[0] !== aresta.messageKind) {
      divergencias.push({
        canal,
        problema: "kind-divergente",
        detalhe:
          `o rótulo declara "${aresta.messageKind}" e viajou ${JSON.stringify(lista)}: ` +
          "o canal carrega, e o desenho nomeia outra coisa",
      });
    }
  }
  return divergencias;
}

/** O relato que vai para a mensagem de um teste que falhou. */
export function relatoDeDivergencias(divs: readonly DivergenciaDoDesenho[]): string {
  return divs.map((d) => `  [${d.problema}] ${d.canal}: ${d.detalhe}`).join("\n");
}
