import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HANDBOOKS, handbookOf, readyCount, type Handbook } from "./handbooks.js";

/**
 * O catálogo é a promessa da landing. Um item apontando para uma fase que não
 * existe some da página sem aviso — é exatamente a mentira silenciosa que este
 * projeto trata como o pior defeito, então ela morre aqui e não no navegador.
 */
function itens(handbook: Handbook) {
  return [...handbook.articles, ...handbook.labs];
}

describe("catálogo do OpenLabs", () => {
  it("tem id único por handbook", () => {
    const ids = HANDBOOKS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("acha handbook por id, e não inventa o que não existe", () => {
    expect(handbookOf("otel")?.name).toContain("OpenTelemetry");
    expect(handbookOf("nao-existe")).toBeUndefined();
  });

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: toda fase é numerada uma vez só e em ordem",
    (_id, handbook) => {
      const numeros = handbook.phases.map((f) => f.number);
      expect(new Set(numeros).size).toBe(numeros.length);
      expect([...numeros].sort((a, b) => a - b)).toEqual(numeros);
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: todo artigo e todo lab caem numa fase que existe",
    (_id, handbook) => {
      const fases = new Set(handbook.phases.map((f) => f.number));
      for (const item of itens(handbook)) {
        expect(fases.has(item.phase), `${item.id} está na fase ${item.phase}`).toBe(true);
      }
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: nenhuma fase fica vazia dos dois lados",
    (_id, handbook) => {
      for (const fase of handbook.phases) {
        const daFase = itens(handbook).filter((item) => item.phase === fase.number);
        expect(daFase.length, `fase ${fase.number} (${fase.title}) sem nada`).toBeGreaterThan(0);
      }
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: id de item não se repete",
    (_id, handbook) => {
      const ids = itens(handbook).map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it("conta como pronto só o que está pronto", () => {
    expect(readyCount([])).toBe(0);
    expect(
      readyCount([
        { id: "a", title: "A", status: "available", phase: 1 },
        { id: "b", title: "B", status: "coming", phase: 1 },
      ]),
    ).toBe(1);
  });
});

/**
 * O catálogo tem que dizer a verdade sobre o que já dá para abrir.
 *
 * O defeito que originou estes testes: o handbook do RISC-V anunciava
 * "Assemble and run your own program" como **coming** enquanto o lab do caminho
 * de dados já estava no ar fazendo exatamente isso. Ninguém mentiu de propósito
 * — havia duas listas escritas à mão para o mesmo fato, e elas divergiram.
 *
 * A correção de verdade foi juntar as fontes (os labs saem do mapa). Estes
 * testes são a trava: se alguém escrever uma segunda lista de novo, o desacordo
 * morre aqui.
 */
describe("o catálogo não promete o que não abre, nem esconde o que abre", () => {
  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: todo item pronto tem para onde levar",
    (_id, handbook) => {
      const mudos = itens(handbook)
        .filter((item) => item.status === "available" && (item.href ?? "") === "")
        .map((item) => item.id);
      // Um item "pronto" sem link é um convite que não abre nada.
      expect(mudos).toEqual([]);
    },
  );

  it.each(HANDBOOKS.map((h) => [h.id, h] as const))(
    "%s: nada que ainda não existe leva a algum lugar",
    (_id, handbook) => {
      const prometidos = itens(handbook)
        .filter((item) => item.status === "coming" && (item.href ?? "") !== "")
        .map((item) => item.id);
      expect(prometidos).toEqual([]);
    },
  );

  it.each(HANDBOOKS.filter((h) => h.map !== undefined).map((h) => [h.id, h] as const))(
    "%s: o mapa e a lista de labs contam a mesma história",
    (_id, handbook) => {
      const doMapa = handbook.map!.labs.map((lab) => ({
        id: lab.id,
        status: lab.status,
      }));
      const daLista = handbook.labs.map((lab) => ({ id: lab.id, status: lab.status }));
      expect(daLista).toEqual(doMapa);
    },
  );

  it("todo artigo escrito está na lista, e toda entrada pronta tem arquivo", () => {
    /*
      A lista de artigos é escrita à mão — e tem de ser, porque ela carrega a
      ORDEM de leitura e os nós por escrever, que não existem como arquivo. O
      que não pode é divergir do disco, e as duas direções erram diferente:

      - artigo escrito e fora da lista some do handbook. O texto existe, a
        página existe, e nenhum leitor chega nela;
      - entrada "available" sem arquivo é link morto em produção, que o
        docblock da lista já nomeia como a coisa que ela existe para evitar.

      Esta é a guarda derivada que faltava. A âncora escrita à mão do teste
      abaixo continua valendo por outra razão: ela pega os dois lados
      concordando estando os dois errados.
    */
    const raiz = new URL("../content/articles/", import.meta.url);
    for (const handbook of HANDBOOKS) {
      const dir = new URL(`${handbook.id}/`, raiz);
      const noDisco = existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith(".md"))
            .map((f) => f.replace(/\.md$/u, ""))
            .sort()
        : [];
      const naLista = handbook.articles.filter((a) => a.status === "available");

      expect(
        naLista.map((a) => a.id).sort(),
        `${handbook.id}: artigo escrito e fora da lista some do handbook; ` +
          "entrada pronta sem arquivo é link morto",
      ).toEqual(noDisco);

      // E o href de cada um aponta para o próprio slug: um href trocado entre
      // dois artigos passaria na checagem de cima.
      for (const a of naLista) {
        expect(a.href, a.id).toBe(`handbooks/${handbook.id}/articles/${a.id}`);
      }
    }
  });

  it("os labs que existem de verdade estão marcados como prontos", () => {
    // As páginas que o site publica hoje. Escrito à mão de propósito: é a
    // âncora fora do catálogo, e sem ela os dois lados poderiam concordar
    // estando os dois errados.
    const NO_AR = ["labs/gates", "labs/cpu"];
    const linkados = new Set(
      HANDBOOKS.flatMap((h) => itens(h))
        .filter((item) => item.status === "available")
        .map((item) => item.href),
    );
    for (const pagina of NO_AR) {
      expect([...linkados], `${pagina} está no ar e ninguém aponta para ele`).toContain(pagina);
    }
  });
});

/**
 * A prova da compatibilidade entre versões do contrato — e ela é uma igualdade,
 * não um argumento.
 *
 * O `algorithms` era um objeto TypeScript escrito à mão neste diretório, e
 * passou a ser `handbooks/algorithms/handbook.yaml`. Isso é uma migração entre
 * duas versões reais do contrato (`typescript` → `openlabs/handbook/v1`), e a
 * promessa do formato é que uma migração **não muda o handbook**.
 *
 * Então o objeto que estava escrito aqui fica aqui, congelado, como expectativa
 * — e o teste compara campo por campo com o que o leitor produz hoje. É a única
 * forma de a frase "migrar é mecânico" ser verificável: se o leitor da `v1`
 * entender uma cor, uma fase ou um href de um jeito diferente do que o site
 * entendia, isto cai mostrando os dois valores.
 *
 * NÃO ATUALIZE este objeto para acompanhar edição de conteúdo do handbook. Ele
 * não descreve o `algorithms` de hoje; ele descreve o que a versão anterior do
 * contrato dizia no dia da migração. Conteúdo novo entra no manifesto, e a
 * expectativa certa para ele é o próprio manifesto.
 */
const ALGORITHMS_NA_VERSAO_ANTERIOR = {
  id: "algorithms",
  tema: {
    claro: {
      acento: "#6d28d9",
      fluxo: "#6d28d9",
      descarte: "#b8442a",
      ok: "#3f7a52",
      mutacao: "#c2410c",
      processador: "#6d28d9",
      conduite: "#3f7a52",
      especies: ["#6d28d9", "#0e7490", "#b45309", "#3f7a52"],
    },
    escuro: {
      acento: "#c4a7f7",
      fluxo: "#c4a7f7",
      processador: "#c4a7f7",
      especies: ["#c4a7f7", "#22d3ee", "#e3b341", "#3fb950"],
    },
  },
  name: "Algorithms Visual Handbook",
  subject: "algorithms",
  tagline: "An algorithm is a system of parts. Watch the items move.",
  blurb:
    "A stack is a box with things in it; a queue is a belt with a policy; a " +
    "sort is a load changing places. Every model here runs, and the answer " +
    "comes out of parts moving — never out of a script.",
  model: "algo.model",
  stage: "building",
  phases: [
    { number: 1, title: "What holds the data", line: "Stack, queue, table: the boxes everything else is built on." },
    { number: 2, title: "One pass at a time", line: "Evaluation and traversal, as items travelling between parts." },
    { number: 3, title: "Sorting", line: "The same load, changing places — and what each swap costs." },
    { number: 4, title: "Greedy", line: "Deciding with what is in front of you, and when that is enough." },
    { number: 5, title: "Dynamic programming", line: "A table that remembers, so the same work is never done twice." },
  ],
  articles: [
    { id: "a-stack-is-a-box", title: "A stack is a box", status: "coming", phase: 1 },
    { id: "fifo-and-backpressure", title: "FIFO, and what happens when it is full", status: "coming", phase: 1 },
    { id: "postfix-needs-no-parentheses", title: "Postfix needs no parentheses", status: "coming", phase: 2 },
    { id: "what-a-swap-costs", title: "What a swap costs", status: "coming", phase: 3 },
    { id: "when-greedy-is-right", title: "When greedy is right", status: "coming", phase: 4 },
    { id: "the-table-that-remembers", title: "The table that remembers", status: "coming", phase: 5 },
  ],
  labs: [
    { id: "rpn", title: "A stack machine, running", status: "available", phase: 2, href: "labs/rpn" },
    { id: "fifo", title: "A queue, and what fills it", status: "coming", phase: 1 },
    { id: "sorting", title: "Sorting, swap by swap", status: "coming", phase: 3 },
    { id: "greedy", title: "Greedy, and the case it misses", status: "coming", phase: 4 },
    { id: "dynamic", title: "The table that remembers", status: "coming", phase: 5 },
  ],
} as const;

describe("migrar de uma versão do contrato para a outra não muda o handbook", () => {
  const migrado = handbookOf("algorithms");

  it("o handbook submetido existe no catálogo", () => {
    // Se o manifesto não carregar, o build do site já falha — mas este teste
    // roda sem o build, e é o que diz ao autor que o arquivo dele entrou.
    expect(migrado, "handbooks/algorithms/handbook.yaml não entrou no catálogo").toBeDefined();
  });

  it.each(
    (Object.keys(ALGORITHMS_NA_VERSAO_ANTERIOR) as (keyof typeof ALGORITHMS_NA_VERSAO_ANTERIOR)[]).map(
      (campo) => [campo] as const,
    ),
  )("%s é idêntico ao que a versão anterior dizia", (campo) => {
    expect(migrado?.[campo]).toEqual(ALGORITHMS_NA_VERSAO_ANTERIOR[campo]);
  });

  it("e o carregado traz o que só o contrato novo tem: dono e versão", () => {
    /*
      A migração não muda o handbook, mas o contrato novo pede duas coisas que o
      antigo não tinha — e elas são a razão de ele existir: quem mantém, e
      contra qual versão foi escrito. Sem dono declarado, manutenção volta para
      quem mantém a casa, que é o que o caminho dourado existe para evitar.
    */
    const comExtras = migrado as unknown as {
      readonly mantenedores?: readonly { readonly github: string }[];
      readonly apiVersion?: string;
    };
    expect(comExtras.apiVersion).toBe("openlabs/handbook/v1");
    expect(comExtras.mantenedores?.length ?? 0).toBeGreaterThan(0);
  });
});
