import { readFileSync, readdirSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { conferirHandbook, conferirArquivosDeArtigo } from "./conferir.js";
import { lerDocumento, type HandbookNormalizado } from "./versoes.js";

/**
 * Ler handbooks do disco, e **falhar alto**.
 *
 * O site é estático: se um manifesto estiver errado, o momento certo de
 * descobrir é o build, com o nome do arquivo e o nome do campo — nunca a
 * página nascendo sem um item. É a mesma escolha que a página do handbook já
 * faz para item em fase inexistente.
 *
 * A pasta de submissão é `handbooks/<id>/`, na raiz do repositório, e não
 * dentro do site. Isso é deliberado: ela é **conteúdo de outra pessoa**, com
 * dono declarado no próprio manifesto, e não precisa saber que existe um Astro.
 */

export const PASTA_DE_SUBMISSOES = "handbooks";
export const NOME_DO_MANIFESTO = "handbook.yaml";

export interface LeituraDeSubmissao {
  readonly id: string;
  readonly origem: string;
  readonly handbook?: HandbookNormalizado;
  readonly problemas: readonly string[];
}

/** Lê e confere um manifesto já em texto. `origem` só aparece nas mensagens. */
export function lerManifesto(texto: string, origem: string): LeituraDeSubmissao {
  let doc: unknown;
  try {
    doc = parseYaml(texto);
  } catch (erro) {
    return {
      id: origem,
      origem,
      problemas: [`YAML inválido: ${erro instanceof Error ? erro.message : String(erro)}`],
    };
  }

  const lido = lerDocumento(doc);
  if (!lido.ok) return { id: origem, origem, problemas: lido.errors };

  const problemas = conferirHandbook(lido.value);
  return problemas.length > 0
    ? { id: lido.value.id, origem, problemas }
    : { id: lido.value.id, origem, handbook: lido.value, problemas: [] };
}

/**
 * Lê a submissão de um diretório.
 *
 * `raizDosArtigos` é opcional porque a conferência de arquivo de artigo só faz
 * sentido dentro deste repositório. Um consumidor de fora — outro renderizador,
 * um pacote exportado — lê o manifesto sem ter onde procurar artigo, e exigir
 * isso dele seria exigir a nossa árvore de pastas.
 */
export function lerSubmissao(
  dir: string,
  opcoes: { readonly raizDosArtigos?: string } = {},
): LeituraDeSubmissao {
  const caminho = `${dir}/${NOME_DO_MANIFESTO}`;
  const esperado = dir.replace(/\/+$/u, "").split("/").pop() ?? dir;

  if (!existsSync(caminho)) {
    return {
      id: esperado,
      origem: caminho,
      problemas: [
        `não achei ${NOME_DO_MANIFESTO} em ${dir}. Todo handbook submetido é um diretório ` +
          `com esse arquivo dentro — \`node scripts/handbook.mjs new ${esperado}\` cria um.`,
      ],
    };
  }

  const lido = lerManifesto(readFileSync(caminho, "utf8"), caminho);
  if (lido.handbook === undefined) return lido;

  const problemas: string[] = [];

  /*
    O id e o nome da pasta são a mesma coisa, e por isso não podem divergir: a
    pasta é o endereço do dono (é ela que entra no CODEOWNERS) e o id é o
    endereço do leitor (é ele que entra na URL). Divergindo, o dono mantém um
    diretório cujo conteúdo aparece noutro lugar do site.
  */
  if (lido.handbook.id !== esperado) {
    problemas.push(
      `o manifesto diz \`id: ${lido.handbook.id}\` e a pasta se chama "${esperado}". ` +
        "Os dois são o mesmo endereço: a pasta é quem mantém, o id é a URL.",
    );
  }

  if (opcoes.raizDosArtigos !== undefined) {
    const pasta = `${opcoes.raizDosArtigos}/${lido.handbook.id}`;
    const slugs = existsSync(pasta)
      ? readdirSync(pasta)
          .filter((f) => f.endsWith(".md"))
          .map((f) => f.replace(/\.md$/u, ""))
      : [];
    problemas.push(...conferirArquivosDeArtigo(lido.handbook, slugs));
  }

  return problemas.length > 0
    ? { id: lido.handbook.id, origem: caminho, problemas }
    : lido;
}

/** Todas as submissões de `<raiz>/handbooks/`, em ordem de id. */
export function lerSubmissoes(
  raiz: string,
  opcoes: { readonly raizDosArtigos?: string } = {},
): readonly LeituraDeSubmissao[] {
  const pasta = `${raiz}/${PASTA_DE_SUBMISSOES}`;
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((nome) => lerSubmissao(`${pasta}/${nome}`, opcoes));
}

/**
 * Os handbooks submetidos, ou uma exceção que nomeia o arquivo e o campo.
 *
 * É o que o catálogo do site chama. Juntar as duas coisas num `throw` aqui, em
 * vez de devolver erro, é para não existir caminho em que o site publica
 * ignorando uma submissão quebrada — publicar ignorando é a mentira silenciosa
 * outra vez.
 */
export function carregarSubmissoes(
  raiz: string,
  opcoes: { readonly raizDosArtigos?: string } = {},
): readonly HandbookNormalizado[] {
  const lidas = lerSubmissoes(raiz, opcoes);
  const quebradas = lidas.filter((l) => l.handbook === undefined || l.problemas.length > 0);
  if (quebradas.length > 0) {
    const relato = quebradas
      .map((l) => [`${l.origem}:`, ...l.problemas.map((p) => `  · ${p}`)].join("\n"))
      .join("\n");
    throw new Error(
      `handbook submetido inválido — o build para aqui de propósito:\n${relato}\n` +
        "Rode `node scripts/handbook.mjs check` para ver o mesmo relato sem subir o site.",
    );
  }
  return lidas.flatMap((l) => (l.handbook === undefined ? [] : [l.handbook]));
}
