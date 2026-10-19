import { readFileSync } from "node:fs";
import type { DefinicaoDeExercicio, Distrator } from "@ovh/handbook-format";
import { raizDoRepoUrl } from "./raiz.js";

/**
 * A extração, e ela roda no **build**.
 *
 * O frontmatter do Astro executa em Node, então ler o arquivo aqui é ler uma vez,
 * na geração da página. A ilha recebe o resultado como propriedade e nunca toca
 * no sistema de arquivos — o que é obrigatório, porque ela roda no navegador.
 */

const RAIZ = raizDoRepoUrl();

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
  /**
   * O que executa este arquivo, e em que versão — já com o nome da coisa.
   *
   * Carrega o nome junto do número porque o nome é parte do fato: o componente
   * escrevia "OpenTelemetry Java" fixo, e com a entrada dos exercícios de YAML
   * a linha de origem de um `collector.yaml` passou a dizer
   * "OpenTelemetry Java collector 0.160.0" — um número certo com o nome errado
   * em volta. Quem sabe qual é a coisa é esta função, e não a tela.
   */
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

/**
 * A versão **da coisa a que o arquivo pertence**, para a tela mostrar ao lado
 * do código.
 *
 * Era fixa em `labs/providers/` enquanto só havia exercício de um lab, e virou
 * "o `pom.xml` ao lado do arquivo" quando entrou o segundo — porque a tela
 * mostraria a versão de outro projeto. Agora ela aprende a segunda coisa: nem
 * todo exercício é sobre Java.
 *
 * Um exercício sobre `collector.yaml` não tem `pom.xml` nenhum, e a versão que
 * importa ali **não é a do SDK** — é a tag da imagem do Collector que o
 * `compose.yaml` sobe. Dizer "1.65.0" ao lado de uma configuração de Collector
 * seria um número certo sobre a coisa errada, que é pior que número nenhum.
 *
 * As duas leituras são de fonte única: o `pom.xml` e o `compose.yaml` que já
 * existem no lab.
 */
/**
 * O que executa um arquivo deste lab, e onde a versão disso está escrita.
 *
 * Uma tabela, e não uma cadeia de `if`, porque a terceira entrada foi o que
 * mostrou o defeito da segunda: com a entrada do Splunk, o MESMO `compose.yaml`
 * sobe duas imagens de produtos diferentes — o forwarder universal e o Splunk
 * Enterprise — e qual delas executa um arquivo depende da pasta em que ele
 * está. Uma cadeia de `if` resolveria isso também, e esconderia que a pergunta
 * tem duas partes: "quem executa este caminho?" e "onde o número dele está?".
 *
 * `quando` casa contra o caminho **relativo ao lab**, para a regra não repetir
 * o slug.
 */
const EXECUTORES: readonly {
  readonly quando: RegExp;
  /** O que a tela escreve antes do número. */
  readonly nome: string;
  /** Onde o número está, relativo ao lab, e como achá-lo lá dentro. */
  readonly arquivo: string;
  readonly padrao: RegExp;
}[] = [
  {
    // Java sob `app/`: a versão é a do BOM do OpenTelemetry, e não de imagem.
    quando: /^app\//u,
    nome: "OpenTelemetry Java",
    arquivo: "app/pom.xml",
    padrao: /<artifactId>opentelemetry-bom<\/artifactId>\s*<version>([^<]+)<\/version>/u,
  },
  {
    quando: /^uf\//u,
    nome: "Splunk Universal Forwarder",
    arquivo: "compose.yaml",
    padrao: /image:\s*splunk\/universalforwarder:([^\s]+)/u,
  },
  {
    quando: /^(idx|hf)\//u,
    nome: "Splunk Enterprise",
    arquivo: "compose.yaml",
    padrao: /image:\s*splunk\/splunk:([^\s]+)/u,
  },
  {
    // O caso mais antigo, e agora o último: configuração de Collector na raiz.
    quando: /^[^/]+$/u,
    nome: "OpenTelemetry Collector",
    arquivo: "compose.yaml",
    padrao: /image:\s*otel\/opentelemetry-collector-contrib:([^\s]+)/u,
  },
];

function versaoDoArquivo(arquivo: string): string {
  const lab = /^(labs\/[^/]+)\//u.exec(arquivo)?.[1];
  if (lab === undefined) {
    throw new Error(
      `exercício aponta para "${arquivo}", que não está em labs/<slug>/ — ` +
        "a versão que a tela mostra é lida do lab ao lado do arquivo",
    );
  }

  const relativo = arquivo.slice(lab.length + 1);
  const executor = EXECUTORES.find((e) => e.quando.test(relativo));
  if (executor === undefined) {
    throw new Error(
      `não sei o que executa "${arquivo}" — acrescente uma entrada em EXECUTORES. ` +
        "A tela mostra a versão de quem executa o arquivo ao lado do código, e " +
        "um número certo sobre a coisa errada é pior que número nenhum",
    );
  }

  const caminho = `${lab}/${executor.arquivo}`;
  const achado = executor.padrao.exec(readFileSync(new URL(caminho, RAIZ), "utf8"));
  if (achado?.[1] === undefined) {
    throw new Error(
      `não achei a versão de ${executor.nome} em ${caminho} — ` +
        `o exercício sobre "${arquivo}" mostra esse número, e ele tem de sair de ` +
        "onde o lab já o declara, e não de uma segunda cópia",
    );
  }
  return `${executor.nome} ${achado[1]}`;
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
    versao: versaoDoArquivo(definicao.arquivo),
    antes: desindentar(linhas.slice(0, iAbre)),
    depois: desindentar(linhas.slice(iFecha + 1)),
    certo,
    blocos: embaralharPorSemente([certo, ...definicao.distratores.map(paraBloco)], definicao.id),
  };
}
