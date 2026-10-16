import { z } from "zod";
import { CORPO_COMUM, type Fase, type Item, type Mantenedor, type Referencia, type Tema } from "./schema.js";

/**
 * As versões do contrato que esta casa sabe ler — e a promessa de compatibilidade.
 *
 * ## A promessa
 *
 * **Um handbook escrito contra uma versão do contrato continua sendo lido
 * quando a casa muda de versão.** Em termos concretos: a release que introduz
 * `v2` continua lendo `v1`, sem o autor tocar em nada. Essa é a promessa que
 * faz valer a pena alguém manter um handbook aqui — formato que quebra a cada
 * release é formato que transfere o custo da casa para quem escreve.
 *
 * ## Como ela é mantida, e por que não é só boa intenção
 *
 * Uma versão só sai da lista depois de **duas** coisas: existir leitor para a
 * seguinte, e existir migração automática (`node scripts/handbook.mjs migrate`).
 * E enquanto ela está na lista, `versoes.test.ts` cobra que exista um
 * **exemplar de conformidade** dela que carrega de verdade. Apagar o leitor sem
 * apagar a versão da lista derruba a suíte nomeando a versão; apagar as duas
 * coisas é uma decisão deliberada, que é o que se quer que seja.
 *
 * ## Por que "typescript" é uma versão
 *
 * Os três primeiros handbooks desta casa são objetos TypeScript escritos à mão
 * dentro do site. Essa é, literalmente, a versão anterior do contrato — e
 * tratá-la como legado **nomeado** em vez de "o jeito antigo" é o que torna a
 * promessa acima verificável hoje, com duas versões reais, em vez de uma
 * promessa sobre um futuro `v2` que ninguém pode testar ainda.
 *
 * O leitor dela é a própria identidade: eles já estão na forma interna. O que a
 * entrada traz é o compromisso — ela está na lista, então ela tem exemplar e
 * tem teste, e um handbook antigo não deixa de abrir porque o formato novo
 * chegou.
 */

/** A forma interna, e é ela que a casa consome. Uma só, qualquer que seja a versão de entrada. */
export interface ItemNormalizado {
  readonly id: string;
  readonly title: string;
  readonly status: "available" | "draft" | "coming";
  readonly phase: number;
  readonly href?: string | undefined;
}

export interface TemaNormalizado {
  readonly claro: {
    readonly acento: string;
    readonly fluxo: string;
    readonly descarte: string;
    readonly ok: string;
    readonly mutacao: string;
    readonly processador: string;
    readonly conduite: string;
    readonly especies: readonly [string, string, string, string];
  };
  readonly escuro: Partial<TemaNormalizado["claro"]>;
}

export interface HandbookNormalizado {
  readonly id: string;
  readonly name: string;
  readonly subject: string;
  readonly tagline: string;
  readonly blurb: string;
  readonly model: string;
  readonly stage: "building" | "planned";
  readonly phases: readonly Fase[];
  readonly articles: readonly ItemNormalizado[];
  readonly labs: readonly ItemNormalizado[];
  readonly reference?: Referencia;
  readonly tema: TemaNormalizado;
  /** Quem mantém. Não vai para a página; vai para o `CODEOWNERS` e para a recusa. */
  readonly mantenedores: readonly Mantenedor[];
  /** Com qual versão do contrato ele foi escrito. A casa relata, não adivinha. */
  readonly apiVersion: string;
}

/** `v1`: o primeiro contrato em arquivo. */
export const ManifestoV1Schema = z
  .object({
    apiVersion: z.literal("openlabs/handbook/v1"),
    ...CORPO_COMUM,
  })
  .strict();

export type ManifestoV1 = z.infer<typeof ManifestoV1Schema>;

/**
 * A tradução de sentido: chave em inglês no arquivo, nome em português no
 * código.
 *
 * Ela mora no leitor da versão de propósito. É o lugar onde uma renomeação de
 * chave entre versões acontece sem que nada além do leitor saiba — que é a
 * razão de existir um leitor por versão em vez de o schema ser a forma interna.
 */
function temaDeV1(theme: Tema): TemaNormalizado {
  const claro = {
    acento: theme.light.accent,
    fluxo: theme.light.flow,
    descarte: theme.light.dropped,
    ok: theme.light.ok,
    mutacao: theme.light.mutation,
    processador: theme.light.processor,
    conduite: theme.light.conduit,
    especies: theme.light.species,
  } as const;

  const d = theme.dark;
  const escuro: Partial<TemaNormalizado["claro"]> = {
    ...(d.accent === undefined ? {} : { acento: d.accent }),
    ...(d.flow === undefined ? {} : { fluxo: d.flow }),
    ...(d.dropped === undefined ? {} : { descarte: d.dropped }),
    ...(d.ok === undefined ? {} : { ok: d.ok }),
    ...(d.mutation === undefined ? {} : { mutacao: d.mutation }),
    ...(d.processor === undefined ? {} : { processador: d.processor }),
    ...(d.conduit === undefined ? {} : { conduite: d.conduit }),
    ...(d.species === undefined ? {} : { especies: d.species }),
  };

  return { claro, escuro };
}

const itemDeV1 = (item: Item): ItemNormalizado => ({
  id: item.id,
  title: item.title,
  status: item.status,
  phase: item.phase,
  ...(item.href === undefined ? {} : { href: item.href }),
});

function handbookDeV1(doc: ManifestoV1): HandbookNormalizado {
  return {
    id: doc.id,
    name: doc.name,
    subject: doc.subject,
    tagline: doc.tagline,
    blurb: doc.blurb,
    model: doc.model,
    stage: doc.stage,
    phases: doc.phases,
    articles: doc.articles.map(itemDeV1),
    labs: doc.labs.map(itemDeV1),
    ...(doc.reference === undefined ? {} : { reference: doc.reference }),
    tema: temaDeV1(doc.theme),
    mantenedores: doc.maintainers,
    apiVersion: doc.apiVersion,
  };
}

/** O estado de uma versão na lista. */
export type EstadoDaVersao = "atual" | "anterior";

export interface VersaoDoContrato {
  readonly apiVersion: string;
  readonly estado: EstadoDaVersao;
  /** Quando ela entrou, em ISO. Aparece na recusa e na documentação. */
  readonly desde: string;
  /**
   * Lê um documento já em YAML/JSON e devolve a forma interna, ou os erros.
   *
   * `undefined` marca a versão que **não se escreve em arquivo** — o legado em
   * TypeScript, que já nasce na forma interna. Ter o campo opcional em vez de
   * uma lista separada é o que mantém uma lista só, que é a que o teste varre.
   */
  readonly ler?: (doc: unknown) => LeituraDoManifesto;
}

export type LeituraDoManifesto =
  | { readonly ok: true; readonly value: HandbookNormalizado }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * A lista, e ela é a fonte única de "o que esta casa lê".
 *
 * Ordem: a atual primeiro, as anteriores depois — é a ordem em que a recusa as
 * imprime, e quem lê uma recusa quer ver a atual na primeira linha.
 */
export const VERSOES_SUPORTADAS: readonly VersaoDoContrato[] = [
  {
    apiVersion: "openlabs/handbook/v1",
    estado: "atual",
    desde: "2026-10-16",
    ler: (doc) => {
      const parsed = ManifestoV1Schema.safeParse(doc);
      if (!parsed.success) {
        return {
          ok: false,
          errors: parsed.error.issues.map(
            (i) => `${i.path.length === 0 ? "(raiz)" : i.path.join(".")}: ${i.message}`,
          ),
        };
      }
      return { ok: true, value: handbookDeV1(parsed.data) };
    },
  },
  {
    apiVersion: "typescript",
    estado: "anterior",
    desde: "2026-08-29",
  },
];

export const VERSAO_ATUAL: string = VERSOES_SUPORTADAS.find((v) => v.estado === "atual")!.apiVersion;

/** As versões que se escrevem em arquivo, que são as que um manifesto pode declarar. */
export const VERSOES_EM_ARQUIVO: readonly VersaoDoContrato[] = VERSOES_SUPORTADAS.filter(
  (v) => v.ler !== undefined,
);

/**
 * A recusa de uma versão que esta casa não lê, e ela **ensina o próximo passo**.
 *
 * As duas direções erram diferente, e a mensagem precisa separá-las: quem
 * escreveu contra uma versão mais nova está num site velho e precisa atualizar
 * a casa; quem escreveu contra uma mais velha precisa migrar o arquivo. Dizer
 * só "versão inválida" manda os dois procurarem no lugar errado.
 */
export function recusaDeVersao(apiVersion: unknown): string {
  const lidas = VERSOES_EM_ARQUIVO.map((v) => `${v.apiVersion} (${v.estado}, desde ${v.desde})`);
  const quais = `Esta release lê: ${lidas.join(", ")}.`;

  if (typeof apiVersion !== "string" || apiVersion.trim() === "") {
    return (
      "manifesto sem `apiVersion`. É o primeiro campo do arquivo, e ele nomeia o CONTRATO " +
      `(não a versão do seu handbook). Escreva \`apiVersion: ${VERSAO_ATUAL}\`. ${quais}`
    );
  }

  const parecido = /^openlabs\/handbook\/v(\d+)$/u.exec(apiVersion);
  const atualN = /^openlabs\/handbook\/v(\d+)$/u.exec(VERSAO_ATUAL);
  if (parecido?.[1] !== undefined && atualN?.[1] !== undefined) {
    const pedida = Number(parecido[1]);
    const temos = Number(atualN[1]);
    if (pedida > temos) {
      return (
        `este handbook foi escrito contra \`${apiVersion}\`, que é mais novo do que esta ` +
        `release conhece. Atualize o OpenLabs — nada no seu arquivo está errado. ${quais}`
      );
    }
    return (
      `\`${apiVersion}\` foi aposentada. Rode \`node scripts/handbook.mjs migrate <id>\` para ` +
      `reescrever o manifesto na versão atual; a migração é mecânica e o conteúdo não muda. ${quais}`
    );
  }

  return `\`apiVersion: ${apiVersion}\` não é uma versão deste contrato. ${quais}`;
}

/**
 * Lê um documento qualquer escolhendo o leitor pela `apiVersion` declarada.
 *
 * É aqui que a promessa de compatibilidade acontece: o chamador não sabe qual
 * versão chegou, e nunca precisa saber.
 */
export function lerDocumento(doc: unknown): LeituraDoManifesto {
  const apiVersion =
    typeof doc === "object" && doc !== null && "apiVersion" in doc
      ? (doc as { apiVersion: unknown }).apiVersion
      : undefined;

  const versao = VERSOES_EM_ARQUIVO.find((v) => v.apiVersion === apiVersion);
  if (versao?.ler === undefined) return { ok: false, errors: [recusaDeVersao(apiVersion)] };
  return versao.ler(doc);
}
