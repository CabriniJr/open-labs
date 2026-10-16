import type { HandbookNormalizado, ItemNormalizado } from "./versoes.js";

/**
 * As conferências que o schema não alcança — e por que elas não moram nele.
 *
 * Zod confere **forma**: tipo, formato, chave desconhecida. O que ele não
 * confere é **coerência entre campos**: um item na fase 7 de um handbook que
 * tem cinco fases passa pelo schema e desaparece da página, porque a página
 * agrupa por fase e não existe grupo 7. Esse é exatamente o defeito que este
 * projeto trata como o pior: a mentira silenciosa.
 *
 * Então estas são as regras que já custaram alguma coisa aqui, uma por uma, e
 * todas devolvem **texto para humano** em vez de lançar: quem roda isto é um
 * autor conferindo o próprio handbook antes de abrir PR, e uma lista do que
 * está errado vale mais do que a primeira exceção.
 */

const plural = (n: number, um: string, muitos: string): string => (n === 1 ? um : muitos);

function conferirFases(h: HandbookNormalizado): readonly string[] {
  const problemas: string[] = [];
  const numeros = h.phases.map((f) => f.number);

  const repetidos = numeros.filter((n, i) => numeros.indexOf(n) !== i);
  if (repetidos.length > 0) {
    problemas.push(
      `fase repetida: ${[...new Set(repetidos)].join(", ")}. Duas fases com o mesmo número ` +
        "fazem a segunda sumir da página.",
    );
  }

  const ordenados = [...numeros].sort((a, b) => a - b);
  if (JSON.stringify(numeros) !== JSON.stringify(ordenados)) {
    problemas.push(
      `as fases não estão em ordem: ${numeros.join(", ")}. A ordem das fases É o currículo — ` +
        "ela é a ordem em que os conceitos se sustentam, e a página a imprime como está escrita.",
    );
  }

  return problemas;
}

function conferirItens(h: HandbookNormalizado): readonly string[] {
  const problemas: string[] = [];
  const fases = new Set(h.phases.map((f) => f.number));
  const todos: readonly (readonly [string, ItemNormalizado])[] = [
    ...h.articles.map((a) => ["article", a] as const),
    ...h.labs.map((l) => ["lab", l] as const),
  ];

  for (const [tipo, item] of todos) {
    if (!fases.has(item.phase)) {
      problemas.push(
        `${tipo} "${item.id}" está na fase ${item.phase}, que não existe. Ele não apareceria ` +
          `na página: as fases declaradas são ${[...fases].join(", ")}.`,
      );
    }
  }

  const ids = todos.map(([, item]) => item.id);
  const repetidos = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (repetidos.length > 0) {
    problemas.push(
      `id de item repetido: ${repetidos.join(", ")}. O id vira URL e chave de lista; ` +
        "repetido, um dos dois ganha e o outro não abre.",
    );
  }

  /*
    Fase vazia dos dois lados é promessa quebrada no meio da trilha: o leitor
    chega na fase 3 e não há nada para ler nem para rodar. O handbook pode ter
    tudo `coming` — o que não pode é a fase não existir em lugar nenhum.
  */
  for (const fase of h.phases) {
    const na = todos.filter(([, item]) => item.phase === fase.number);
    if (na.length === 0) {
      problemas.push(
        `a fase ${fase.number} ("${fase.title}") não tem artigo nem lab. Uma fase vazia é um ` +
          "degrau faltando na escada; declare pelo menos um item, mesmo como `coming`.",
      );
    }
  }

  return problemas;
}

function conferirArtigos(h: HandbookNormalizado): readonly string[] {
  const problemas: string[] = [];
  for (const artigo of h.articles) {
    if (artigo.status !== "available") continue;
    const esperado = `handbooks/${h.id}/articles/${artigo.id}`;
    if (artigo.href !== esperado) {
      problemas.push(
        `o artigo "${artigo.id}" aponta para "${artigo.href ?? "(nada)"}" e a página dele é ` +
          `"${esperado}". O href do artigo é derivado do id, e trocá-lo leva o leitor a ` +
          "outro texto ou a lugar nenhum.",
      );
    }
  }
  return problemas;
}

/**
 * Os arquivos de artigo que existem no disco, contra o que o manifesto anuncia.
 *
 * As duas direções erram diferente, e é por isso que as duas são cobradas:
 * artigo escrito e anunciado como `coming` fica **invisível** (o texto existe, a
 * página existe, e nenhum leitor chega nela); anunciado como `available` sem
 * arquivo é **link morto** em produção.
 */
export function conferirArquivosDeArtigo(
  h: HandbookNormalizado,
  slugsNoDisco: readonly string[],
): readonly string[] {
  const problemas: string[] = [];
  const noDisco = new Set(slugsNoDisco);
  const prontos = h.articles.filter((a) => a.status === "available");

  for (const artigo of prontos) {
    if (!noDisco.has(artigo.id)) {
      problemas.push(
        `o artigo "${artigo.id}" está anunciado como pronto e não existe como arquivo. ` +
          `Esperado: apps/site/src/content/articles/${h.id}/${artigo.id}.md`,
      );
    }
  }

  const anunciados = new Set(prontos.map((a) => a.id));
  for (const slug of noDisco) {
    if (!anunciados.has(slug)) {
      const listado = h.articles.find((a) => a.id === slug);
      problemas.push(
        listado === undefined
          ? `o arquivo "${slug}.md" existe e não está no manifesto: ninguém chega nele.`
          : `o arquivo "${slug}.md" existe e o manifesto o anuncia como "${listado.status}": ` +
            "o texto está escrito e invisível.",
      );
    }
  }

  return problemas;
}

/** Tudo o que se confere sabendo só o manifesto. */
export function conferirHandbook(h: HandbookNormalizado): readonly string[] {
  return [...conferirFases(h), ...conferirItens(h), ...conferirArtigos(h)];
}

/** Relato para humano, com a contagem na primeira linha. */
export function relatoDeProblemas(
  origem: string,
  problemas: readonly string[],
): string {
  if (problemas.length === 0) return `${origem}: ok`;
  const cabeca = `${origem}: ${problemas.length} ${plural(problemas.length, "problema", "problemas")}`;
  return [cabeca, ...problemas.map((p) => `  · ${p}`)].join("\n");
}
