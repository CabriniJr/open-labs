#!/usr/bin/env node
// scripts/handbook.mjs
//
// A ferramenta do caminho dourado: criar, conferir, exportar e migrar um
// handbook submetido. O passo a passo para humano e para agente está em
// `docs/handbooks.md`; aqui está o que ele executa.
//
// **Por que uma ferramenta, e não só os testes.** A suíte deste repositório
// confere tudo isto — mas ela confere no fim, de dentro, e quem está escrevendo
// um handbook precisa de resposta antes de abrir PR e sem aprender a casa. Uma
// regra que só a suíte sabe cobrar é uma regra que o autor descobre quando o CI
// reprova, que é o momento mais caro de descobrir.
//
// **Por que `node` puro.** Nada aqui depende do Astro, de navegador, ou de
// estar dentro deste monorepo rodando. É `node scripts/handbook.mjs`, e as
// mensagens são as mesmas em qualquer ambiente.
//
// Uso:
//   node scripts/handbook.mjs new <id> --github <handle> [--name "Seu Nome"]
//   node scripts/handbook.mjs check [id...]
//   node scripts/handbook.mjs export <id> [--out arquivo.json]
//   node scripts/handbook.mjs migrate <id>
//   node scripts/handbook.mjs codeowners [--write]
//   node scripts/handbook.mjs versions

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");
const PACOTE = join(RAIZ, "packages", "handbook-format");
const ARTIGOS = join(RAIZ, "apps", "site", "src", "content", "articles");
const SUBMISSOES = join(RAIZ, "handbooks");
const CODEOWNERS = join(RAIZ, ".github", "CODEOWNERS");

/* ------------------------------------------------------------------ o formato
 *
 * O schema é TypeScript, e esta ferramenta é JavaScript puro de propósito. A
 * ponte é o compilado: `tsc -b` do pacote, que esta função garante estar em dia
 * antes de importar.
 *
 * A alternativa seria uma segunda cópia das regras em JS, e duas cópias da
 * mesma regra divergem — já divergiram aqui, entre o mapa e o catálogo de labs.
 * Compilar um pacote leva cerca de um segundo; ter duas verdades custa um
 * handbook publicado errado. */
function garantirCompilado() {
  const saida = join(PACOTE, "dist", "index.js");
  const fontes = readdirSync(join(PACOTE, "src"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts"))
    .map((f) => statSync(join(PACOTE, "src", f)).mtimeMs);
  const maisNova = Math.max(...fontes);
  const atual = existsSync(saida) && statSync(saida).mtimeMs >= maisNova;
  if (atual) return saida;

  const tsc = join(RAIZ, "node_modules", ".bin", "tsc");
  if (!existsSync(tsc)) {
    falhar(
      "o formato não está compilado e não achei o tsc",
      "Rode `pnpm install` na raiz do repositório e tente de novo.",
    );
  }
  try {
    execFileSync(tsc, ["-b", PACOTE], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (erro) {
    const detalhe = [erro.stdout?.toString(), erro.stderr?.toString()].filter(Boolean).join("\n");
    falhar("não consegui compilar @ovh/handbook-format", detalhe.trim() || String(erro));
  }
  return saida;
}

const formato = await import(pathToFileURL(garantirCompilado()).href);

/* ------------------------------------------------------------------- utilidades */

function falhar(porque, comoResolver) {
  console.error(`\n✗ ${porque}`);
  if (comoResolver !== undefined) console.error(`  ${comoResolver}`);
  console.error("");
  process.exit(1);
}

const args = process.argv.slice(2);
const comando = args[0];
const livres = args.slice(1).filter((a) => !a.startsWith("--"));

function opcao(nome) {
  const i = args.indexOf(`--${nome}`);
  if (i < 0) return undefined;
  const valor = args[i + 1];
  return valor === undefined || valor.startsWith("--") ? true : valor;
}

const bandeira = (nome) => opcao(nome) !== undefined;

/** Os ids submetidos, lidos do disco. Lista derivada: nunca escrita à mão. */
function idsSubmetidos() {
  if (!existsSync(SUBMISSOES)) return [];
  return readdirSync(SUBMISSOES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/* ------------------------------------------------------------------------ new
 *
 * O molde nasce VÁLIDO, e isso é a regra desta ferramenta: `new` seguido de
 * `check` é verde. Um molde com `TODO` no meio obrigaria o autor a descobrir as
 * regras pela reprovação, que é o oposto do caminho dourado. */
function cmdNew() {
  const id = livres[0];
  if (id === undefined) falhar("falta o id", "node scripts/handbook.mjs new meu-handbook --github seu-handle");

  const github = opcao("github");
  if (typeof github !== "string") {
    falhar(
      "falta --github",
      "O handle vai no manifesto e é de lá que sai o CODEOWNERS: quem submete mantém o seu.",
    );
  }

  let nome = opcao("name");
  if (typeof nome !== "string") {
    try {
      nome = execFileSync("git", ["config", "user.name"], { encoding: "utf8" }).trim();
    } catch {
      nome = "";
    }
  }
  if (nome === "") falhar("falta --name", 'Passe --name "Seu Nome" (não achei no git config).');

  const dir = join(SUBMISSOES, id);
  if (existsSync(dir)) falhar(`${dir} já existe`, "Escolha outro id ou edite o manifesto que está lá.");

  const titulo = id
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

  const manifesto = `# ${titulo} — um handbook do OpenLabs.
#
# O caminho dourado inteiro está em docs/handbooks.md. O resumo:
#   1. edite este arquivo;
#   2. rode: node scripts/handbook.mjs check ${id}
#   3. escreva os artigos em apps/site/src/content/articles/${id}/<id-do-artigo>.md
#      e troque o status do item para "available" com o href que o check pedir;
#   4. abra o PR. Você é o dono deste diretório.
apiVersion: ${formato.VERSAO_ATUAL}

id: ${id}
name: ${titulo} Visual Handbook
subject: ${id.replace(/-/g, " ")}
tagline: One sentence that says what the reader will be able to see.
blurb: >-
  Two or three sentences on what this handbook teaches and why the models in it
  run instead of being drawn. This text goes on the card in the catalogue.
model: ${id}.model
stage: planned

# Quem mantém. É daqui que sai o CODEOWNERS deste diretório.
maintainers:
  - name: ${nome}
    github: ${github}

# A identidade visual, e o conjunto do que ela pinta é FECHADO: fundo e
# tipografia são da casa. Cor é hex de seis dígitos porque o contraste é
# medido em teste — ver docs/handbooks.md.
theme:
  light:
    accent: "#425cc7"
    flow: "#425cc7"
    dropped: "#b8442a"
    ok: "#3f7a52"
    mutation: "#f5a800"
    processor: "#425cc7"
    conduit: "#3f7a52"
    species: ["#7c5cd6", "#3f7a52", "#c2410c", "#0e7490"]
  dark:
    accent: "#8fa2ee"

# A ordem das fases É o currículo: é a ordem em que os conceitos se sustentam.
# Toda fase precisa de pelo menos um item, mesmo que ainda como "coming".
phases:
  - number: 1
    title: The first idea
    line: What the reader has to believe before anything else works.

articles:
  - id: the-first-article
    title: The first article
    status: coming
    phase: 1

labs: []
`;

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "handbook.yaml"), manifesto, "utf8");

  console.log(`\n✓ ${join("handbooks", id, "handbook.yaml")} criado.\n`);
  console.log("Próximos passos:");
  console.log(`  1. edite o manifesto (nome, tagline, fases, itens);`);
  console.log(`  2. node scripts/handbook.mjs check ${id}`);
  console.log(`  3. escreva o primeiro artigo em apps/site/src/content/articles/${id}/;`);
  console.log(`  4. docs/handbooks.md tem o resto — inclusive o que um lab exige.\n`);

  // O molde tem de nascer válido. Se não nascer, é defeito desta ferramenta, e
  // quem descobre é ela mesma, agora, e não o autor dentro de dez minutos.
  const lido = formato.lerSubmissao(dir, { raizDosArtigos: ARTIGOS });
  if (lido.problemas.length > 0) {
    falhar(
      "o molde que acabei de escrever não passa no check — isto é defeito da ferramenta",
      formato.relatoDeProblemas(join("handbooks", id), lido.problemas),
    );
  }
}

/* ---------------------------------------------------------------------- check */
function cmdCheck() {
  const pedidos = livres.length > 0 ? livres : idsSubmetidos();
  if (pedidos.length === 0) {
    console.log("nenhum handbook submetido em handbooks/ — nada a conferir");
    return;
  }

  let problemas = 0;
  for (const id of pedidos) {
    const dir = join(SUBMISSOES, id);
    const lido = formato.lerSubmissao(dir, { raizDosArtigos: ARTIGOS });
    const extras = lido.handbook === undefined ? [] : conferirNoRepo(lido.handbook);
    const todos = [...lido.problemas, ...extras];
    console.log(formato.relatoDeProblemas(join("handbooks", id), todos));
    problemas += todos.length;
  }

  if (problemas > 0) {
    console.error(`\n✗ ${problemas} problema(s). docs/handbooks.md explica cada regra.\n`);
    process.exit(1);
  }
  console.log(`\n✓ ${pedidos.length} handbook(s) conferido(s).\n`);
}

/**
 * As conferências que só fazem sentido DENTRO deste repositório.
 *
 * Elas não estão no pacote de formato porque um consumidor de fora não tem
 * `apps/site/` para procurar — exigir isso dele seria exigir a nossa árvore de
 * pastas, e o formato existe justamente para não exigir nada além do arquivo.
 */
function conferirNoRepo(handbook) {
  const problemas = [];
  const paginas = join(RAIZ, "apps", "site", "src", "pages");

  for (const lab of handbook.labs) {
    if (lab.status !== "available" || lab.href === undefined) continue;
    const pagina = join(paginas, `${lab.href}.astro`);
    if (!existsSync(pagina)) {
      problemas.push(
        `o lab "${lab.id}" está pronto e aponta para "${lab.href}", e não existe página ` +
          `em apps/site/src/pages/${lab.href}.astro. Lab que roda precisa de TypeScript: ` +
          "ver a seção “O que o manifesto não descreve” em docs/handbooks.md.",
      );
    }
  }

  return problemas;
}

/* --------------------------------------------------------------------- export
 *
 * O pacote portátil: o handbook inteiro — manifesto normalizado mais os artigos
 * com corpo — num JSON com versão própria.
 *
 * É a resposta a "usar em qualquer ambiente": quem quiser renderizar este
 * handbook fora daqui lê um arquivo e não precisa do nosso Astro, do nosso
 * monorepo nem desta árvore de pastas. E quem exporta não perde o vínculo: o
 * `apiVersion` do contrato viaja dentro do pacote. */
const VERSAO_DO_PACOTE = "openlabs/bundle/v1";

function cmdExport() {
  const id = livres[0];
  if (id === undefined) falhar("falta o id", "node scripts/handbook.mjs export algorithms");

  const lido = formato.lerSubmissao(join(SUBMISSOES, id), { raizDosArtigos: ARTIGOS });
  if (lido.handbook === undefined || lido.problemas.length > 0) {
    falhar(
      `não exporto um handbook que não passa no check`,
      formato.relatoDeProblemas(join("handbooks", id), lido.problemas),
    );
  }

  const pasta = join(ARTIGOS, id);
  const artigos = existsSync(pasta)
    ? readdirSync(pasta)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((f) => ({ id: f.replace(/\.md$/, ""), markdown: readFileSync(join(pasta, f), "utf8") }))
    : [];

  const pacote = {
    bundleVersion: VERSAO_DO_PACOTE,
    exportedAt: new Date().toISOString().slice(0, 10),
    handbook: lido.handbook,
    articles: artigos,
  };

  const json = `${JSON.stringify(pacote, null, 2)}\n`;
  const saida = opcao("out");
  if (typeof saida === "string") {
    writeFileSync(saida, json, "utf8");
    console.log(`✓ ${saida} (${artigos.length} artigo(s), contrato ${lido.handbook.apiVersion})`);
  } else {
    process.stdout.write(json);
  }
}

/* -------------------------------------------------------------------- migrate
 *
 * A migração entre versões do contrato.
 *
 * A tabela está VAZIA hoje, e isso é um fato e não um esquecimento: só existe
 * uma versão em arquivo (`v1`), então não há de onde para onde migrar. O
 * comando existe desde já porque ele é metade da promessa de compatibilidade —
 * uma versão só pode ser aposentada quando existe migração automática para a
 * seguinte, e é aqui que ela vai morar. Dizer "migrado" sem migrar nada seria
 * exatamente a mentira que este repositório trata como o pior defeito. */
const MIGRACOES = [];

function cmdMigrate() {
  const id = livres[0];
  if (id === undefined) falhar("falta o id", "node scripts/handbook.mjs migrate meu-handbook");

  const caminho = join(SUBMISSOES, id, "handbook.yaml");
  if (!existsSync(caminho)) falhar(`não achei ${caminho}`);

  const bruto = readFileSync(caminho, "utf8");
  const declarada = /^apiVersion:\s*(\S+)\s*$/m.exec(bruto)?.[1];

  if (declarada === formato.VERSAO_ATUAL) {
    console.log(`✓ ${id} já está em ${formato.VERSAO_ATUAL} (a versão atual): nada a migrar.`);
    return;
  }

  const passos = [];
  let atual = declarada;
  while (atual !== formato.VERSAO_ATUAL) {
    const passo = MIGRACOES.find((m) => m.de === atual);
    if (passo === undefined) break;
    passos.push(passo);
    atual = passo.para;
  }

  if (atual !== formato.VERSAO_ATUAL) {
    falhar(
      `não sei migrar de "${declarada ?? "(sem apiVersion)"}" para ${formato.VERSAO_ATUAL}`,
      formato.recusaDeVersao(declarada),
    );
  }

  let texto = bruto;
  for (const passo of passos) texto = passo.aplicar(texto);
  writeFileSync(caminho, texto, "utf8");
  console.log(`✓ ${id}: ${declarada} → ${formato.VERSAO_ATUAL} (${passos.length} passo(s))`);
}

/* ----------------------------------------------------------------- codeowners
 *
 * Quem mantém sai do manifesto, e o `CODEOWNERS` é DERIVADO dele.
 *
 * Escrito à mão, ele é a segunda lista da mesma verdade — e duas listas da
 * mesma verdade divergem em silêncio, que é o defeito que este repositório mais
 * combate. Derivado, submeter um handbook já traz a propriedade dele junto. */
function codeownersEsperado() {
  const linhas = [
    "# GERADO — não edite à mão.",
    "#",
    "# Sai do campo `maintainers` de cada handbooks/<id>/handbook.yaml.",
    "# Regenerar:  node scripts/handbook.mjs codeowners --write",
    "# Conferir:   node scripts/handbook.mjs codeowners",
    "#",
    "# A promessa do caminho dourado é que quem submete mantém o seu: estes",
    "# caminhos são o diretório do manifesto e a pasta dos artigos daquele",
    "# handbook, que é tudo o que uma submissão possui.",
    "",
  ];

  for (const id of idsSubmetidos()) {
    const lido = formato.lerSubmissao(join(SUBMISSOES, id), { raizDosArtigos: ARTIGOS });
    if (lido.handbook === undefined) continue;
    const donos = lido.handbook.mantenedores.map((m) => `@${m.github}`).join(" ");
    linhas.push(`/handbooks/${id}/ ${donos}`);
    linhas.push(`/apps/site/src/content/articles/${id}/ ${donos}`);
  }

  return `${linhas.join("\n")}\n`;
}

function cmdCodeowners() {
  const esperado = codeownersEsperado();
  if (bandeira("write")) {
    mkdirSync(dirname(CODEOWNERS), { recursive: true });
    writeFileSync(CODEOWNERS, esperado, "utf8");
    console.log(`✓ ${CODEOWNERS.replace(`${RAIZ}/`, "")} regenerado`);
    return;
  }

  const atual = existsSync(CODEOWNERS) ? readFileSync(CODEOWNERS, "utf8") : "";
  if (atual === esperado) {
    console.log("✓ CODEOWNERS está em dia com os manifestos");
    return;
  }
  falhar(
    "CODEOWNERS está fora de dia com os manifestos",
    "Rode `node scripts/handbook.mjs codeowners --write` e inclua o arquivo no commit.",
  );
}

/* -------------------------------------------------------------------- versions */
function cmdVersions() {
  console.log("\nVersões do contrato que esta release lê:\n");
  for (const v of formato.VERSOES_SUPORTADAS) {
    const emArquivo = v.ler === undefined ? " (legado, não se escreve em arquivo)" : "";
    console.log(`  ${v.apiVersion.padEnd(26)} ${v.estado.padEnd(9)} desde ${v.desde}${emArquivo}`);
  }
  console.log(
    "\nA promessa: a release que introduz uma versão nova continua lendo a anterior.\n" +
      "Ver packages/handbook-format/src/versoes.ts e docs/handbooks.md.\n",
  );
}

/* --------------------------------------------------------------------- dispatch */
const COMANDOS = {
  new: cmdNew,
  check: cmdCheck,
  export: cmdExport,
  migrate: cmdMigrate,
  codeowners: cmdCodeowners,
  versions: cmdVersions,
};

const escolhido = COMANDOS[comando ?? ""];
if (escolhido === undefined) {
  console.error(`\nuso: node scripts/handbook.mjs <comando>\n`);
  console.error("  new <id> --github <handle> [--name \"Seu Nome\"]   cria um manifesto válido");
  console.error("  check [id...]                                   confere o que foi submetido");
  console.error("  export <id> [--out arquivo.json]                pacote portátil do handbook");
  console.error("  migrate <id>                                    sobe o manifesto de versão");
  console.error("  codeowners [--write]                            deriva o CODEOWNERS");
  console.error("  versions                                        versões suportadas\n");
  console.error("docs/handbooks.md tem o caminho inteiro.\n");
  process.exit(comando === undefined ? 1 : 1);
}

escolhido();
