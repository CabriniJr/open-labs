import { readFileSync } from "node:fs";
import type { DefinicaoDeExercicio, Distrator } from "@ovh/otel-domain";

/**
 * A extração, e ela roda no **build**.
 *
 * O frontmatter do Astro executa em Node, então ler o arquivo aqui é ler uma vez,
 * na geração da página. A ilha recebe o resultado como propriedade e nunca toca
 * no sistema de arquivos — o que é obrigatório, porque ela roda no navegador.
 */

/** A raiz do repositório, a partir deste arquivo: lib → src → site → apps → raiz. */
const RAIZ = new URL("../../../../", import.meta.url);

export interface BlocoDeCodigo {
  readonly id: string;
  readonly codigo: string;
  readonly porque: string;
  readonly fonte: string;
  readonly certo?: true;
}

export interface ExercicioMontado {
  readonly id: string;
  readonly lab: string;
  readonly cenario: string;
  readonly pergunta: string;
  readonly arquivo: string;
  /** A versão do SDK, lida do `pom.xml` do lab. Aparece na tela ao lado do código. */
  readonly versao: string;
  /** O código acima da lacuna, já sem os marcadores. */
  readonly antes: string;
  readonly depois: string;
  readonly certo: BlocoDeCodigo;
  /** Os três, na ordem em que a tela os mostra. Estável entre builds. */
  readonly blocos: readonly BlocoDeCodigo[];
}

const abre = (id: string): string => `<handbook:trecho id="${id}">`;
const FECHA_TRECHO = "</handbook:trecho>";
const ABRE_LACUNA = "<handbook:lacuna>";
const FECHA_LACUNA = "</handbook:lacuna>";

/** Tira a indentação comum, para o trecho não nascer torto na tela. */
function desindentar(linhas: readonly string[]): string {
  const uteis = linhas.filter((l) => l.trim().length > 0);
  const minimo = uteis.reduce(
    (menor, l) => Math.min(menor, l.length - l.trimStart().length),
    Number.POSITIVE_INFINITY,
  );
  const corte = Number.isFinite(minimo) ? minimo : 0;
  return linhas
    .map((l) => l.slice(corte))
    .join("\n")
    .replace(/^\n+|\n+$/gu, "");
}

/** Ordem estável, derivada do id: sorteio quebraria a hidratação do SSG. */
function embaralharPorSemente<T>(itens: readonly T[], semente: string): readonly T[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < semente.length; i += 1) {
    h ^= semente.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const giro = h % Math.max(1, itens.length);
  return [...itens.slice(giro), ...itens.slice(0, giro)];
}

/** A versão do BOM, lida do `pom.xml`: uma fonte só para o número que a tela mostra. */
function versaoDoBom(): string {
  const pom = readFileSync(new URL("labs/providers/app/pom.xml", RAIZ), "utf8");
  const achado = /<artifactId>opentelemetry-bom<\/artifactId>\s*<version>([^<]+)<\/version>/u.exec(
    pom,
  );
  if (achado?.[1] === undefined) {
    throw new Error(
      "não achei a versão do opentelemetry-bom em labs/providers/app/pom.xml — " +
        "a tela mostra esse número, e ele não pode ser escrito em dois lugares",
    );
  }
  return achado[1];
}

export function montarExercicio(definicao: DefinicaoDeExercicio): ExercicioMontado {
  const fonte = readFileSync(new URL(definicao.arquivo, RAIZ), "utf8");

  const inicio = fonte.indexOf(abre(definicao.trecho));
  if (inicio < 0) {
    throw new Error(
      `exercício "${definicao.id}": o marcador <handbook:trecho id="${definicao.trecho}"> ` +
        `não está em ${definicao.arquivo}. O recorte sai do arquivo que roda, e sem o ` +
        `marcador não há de onde recortar.`,
    );
  }
  const fim = fonte.indexOf(FECHA_TRECHO, inicio);
  if (fim < 0) {
    throw new Error(`exercício "${definicao.id}": o trecho "${definicao.trecho}" não fecha`);
  }

  const corpo = fonte.slice(fonte.indexOf("\n", inicio) + 1, fonte.lastIndexOf("\n", fim));
  const linhas = corpo.split("\n").filter((l) => !l.includes("<handbook:trecho"));

  const iAbre = linhas.findIndex((l) => l.includes(ABRE_LACUNA));
  const iFecha = linhas.findIndex((l) => l.includes(FECHA_LACUNA));
  if (iAbre < 0 || iFecha < 0 || iFecha <= iAbre) {
    throw new Error(
      `exercício "${definicao.id}": o trecho "${definicao.trecho}" não tem lacuna ` +
        `(${ABRE_LACUNA} … ${FECHA_LACUNA})`,
    );
  }

  const certo: BlocoDeCodigo = {
    id: `${definicao.id}-certo`,
    codigo: desindentar(linhas.slice(iAbre + 1, iFecha)),
    porque: definicao.porqueCerto,
    fonte: definicao.fonteCerto,
    certo: true,
  };

  const paraBloco = (d: Distrator): BlocoDeCodigo => ({
    id: d.id,
    codigo: d.codigo,
    porque: d.porque,
    fonte: d.fonte,
  });

  return {
    id: definicao.id,
    lab: definicao.lab,
    cenario: definicao.cenario,
    pergunta: definicao.pergunta,
    arquivo: definicao.arquivo,
    versao: versaoDoBom(),
    antes: desindentar(linhas.slice(0, iAbre)),
    depois: desindentar(linhas.slice(iFecha + 1)),
    certo,
    blocos: embaralharPorSemente([certo, ...definicao.distratores.map(paraBloco)], definicao.id),
  };
}
