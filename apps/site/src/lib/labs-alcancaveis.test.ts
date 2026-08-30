import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { HANDBOOKS } from "../data/handbooks.js";

/**
 * Este teste mora em `lib/` e não ao lado das páginas de propósito: tudo sob
 * `src/pages/` é rota para o Astro, e um arquivo de teste ali dentro arrasta o
 * vitest para dentro do bundle do site — o `astro build` quebra inteiro, e a
 * mensagem fala de estado interno do vitest, não de onde o arquivo está.
 */
const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const aqui = join(src, "pages", "labs");
const ler = (...p: readonly string[]) => readFileSync(join(src, ...p), "utf8");

/** As páginas de lab que o site realmente publica, lidas do disco. */
const publicados = readdirSync(aqui)
  .filter((f) => f.endsWith(".astro") && f !== "index.astro")
  .map((f) => `labs/${f.replace(/\.astro$/, "")}`)
  .sort();

const doCatalogo = HANDBOOKS.flatMap((h) => h.labs)
  .map((lab) => lab.href)
  .filter((href): href is string => href !== undefined);

describe("nada de teste dentro das rotas", () => {
  /**
   * Custou uma suíte inteira vermelha: um `.test.ts` sob `src/pages/` fez o
   * `astro build` importar o vitest e falhar, e o sintoma apareceu longe — em
   * páginas de documentação que ninguém tinha tocado.
   */
  it("nenhum arquivo de teste mora sob src/pages", () => {
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const caminho = join(dir, entrada.name);
        if (entrada.isDirectory()) varrer(caminho);
        else if (/\.test\.[cm]?[jt]sx?$/.test(entrada.name)) achados.push(caminho);
      }
    };
    varrer(join(src, "pages"));
    expect(achados).toEqual([]);
  });
});

describe("os labs são alcançáveis", () => {
  /**
   * Os dois labs rodavam e estavam publicados, e mesmo assim "não apareciam":
   * o único caminho até eles era o fim da página de um handbook. Um lab que
   * ninguém encontra é indistinguível de um lab que não existe.
   */
  it("a navegação do site tem uma entrada para os labs", () => {
    const nav = ler("components", "SiteNav.astro");
    expect(nav).toContain('url("labs")');
    const strings = ler("lib", "chrome-strings.ts");
    expect(strings).toMatch(/labs:\s*"Labs"/);
  });

  it("o índice de labs sai do catálogo, e não de uma segunda lista", () => {
    const indice = ler("pages", "labs", "index.astro");
    expect(indice).toContain("HANDBOOKS");
    // Nenhum título de lab escrito à mão na página: se houver, as duas listas
    // vão divergir do mesmo jeito que o mapa e o handbook já divergiram.
    for (const lab of HANDBOOKS.flatMap((h) => h.labs)) {
      expect(indice, `"${lab.title}" está escrito à mão no índice`).not.toContain(lab.title);
    }
  });

  it("toda página de lab publicada está no catálogo", () => {
    for (const pagina of publicados) {
      expect(doCatalogo, `${pagina} existe e o catálogo não aponta para ele`).toContain(pagina);
    }
  });

  it("todo link do catálogo tem uma página publicada", () => {
    for (const href of doCatalogo) {
      expect(publicados, `o catálogo aponta para ${href} e a página não existe`).toContain(href);
    }
  });

  it("toda página de lab se marca como lab na navegação", () => {
    for (const f of readdirSync(aqui).filter((f) => f.endsWith(".astro"))) {
      expect(ler("pages", "labs", f), `${f} não marca a aba atual`).toContain(
        '<SiteNav current="labs" />',
      );
    }
  });
});

/**
 * O handbook é em inglês por decisão editorial, e o código é pensado em
 * português. A fronteira entre os dois não é visível ao escrever: "Um ciclo"
 * e "compasso" foram parar num botão e num rótulo de um lab em inglês e
 * ficaram lá, porque nada olhava para o texto que sai na tela.
 */
const PALAVRAS_PT = [
  "ciclo", "compasso", "acomodação", "acomodacao", "entrada", "saída", "saida",
  "ligado", "desligado", "pausar", "rodar", "estado", "profundidade", "porta",
  "fio", "carga", "passo", "subpasso", "clique", "duplo", "dentro", "sobre",
];

/** Só o texto que o leitor vê: nós de texto do JSX e rótulos de acessibilidade. */
function textoVisivel(fonte: string): readonly string[] {
  // O `>` de uma seta de função abre um falso nó de texto e engole o código
  // que vem depois — por isso a seta é excluída, e o que sobra ainda passa
  // pelo filtro de prosa lá embaixo.
  const nos = [...fonte.matchAll(/(?<![=-])>([^<>{}]+)</g)].map((m) => m[1] ?? "");
  const rotulos = [...fonte.matchAll(/(?:aria-label|title|placeholder)=["']([^"']+)["']/g)].map(
    (m) => m[1] ?? "",
  );
  return [...nos, ...rotulos]
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !/^[\d\s.,;:—·/|()[\]{}=+*-]+$/.test(t))
    // Prosa não tem ponto-e-vírgula nem atribuição: o que tem é código que
    // escapou do extrator, e ele não sai na tela.
    .filter((t) => !/[;=]/.test(t));
}

describe("os labs em inglês falam inglês", () => {
  const arquivos = [
    ["components", "CpuLab.tsx"],
    ["components", "GatesLab.tsx"],
    ["components", "Ficha.tsx"],
    ["pages", "labs", "cpu.astro"],
    ["pages", "labs", "gates.astro"],
    ["pages", "labs", "index.astro"],
  ] as const;

  it.each(arquivos.map((p) => [p.join("/"), p] as const))(
    "%s não mostra texto em português",
    (_nome, partes) => {
      const achados: string[] = [];
      for (const texto of textoVisivel(ler(...partes))) {
        const palavras = texto.toLowerCase().match(/[a-zà-ú]+/g) ?? [];
        for (const palavra of palavras) {
          if (PALAVRAS_PT.includes(palavra)) achados.push(`${palavra} — em "${texto}"`);
        }
      }
      expect(achados).toEqual([]);
    },
  );
});
