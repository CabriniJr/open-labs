import { z } from "zod";
import { IdSchema } from "./schema.js";

/**
 * O formato de um exercício de código, e ele mora aqui pela mesma razão
 * mecânica que trouxe o frontmatter do artigo: era um tipo dentro do primeiro
 * pacote de domínio que teve exercícios, e o segundo que quisesse teria de
 * importar o primeiro — ou manter uma cópia. As duas saídas são ruins, e a
 * segunda é a que este repositório já pagou entre o mapa e o catálogo de labs.
 *
 * Um exercício é domínio-neutro por construção: ele é um caminho de arquivo,
 * um marcador dentro dele, uma pergunta e três explicações. Nada aqui sabe
 * sobre o assunto do handbook, e a guarda de fronteira cobra isso — foi ela
 * que acusou duas palavras de assunto neste docblock no dia em que este pacote
 * entrou na lista dos agnósticos.
 *
 * Note o que **não** está no formato: o código da resposta certa. Ele é
 * extraído do arquivo que roda, no build, e por isso não existe como escrevê-lo
 * errado nem como ele envelhecer em silêncio. O que é autoral são os
 * distratores e as explicações — explicação, não veredito.
 */

export const DistratorSchema = z
  .object({
    id: IdSchema,
    /** O código que vai na lacuna. Mesma forma do certo: senão o tamanho entrega. */
    codigo: z.string().min(1),
    /** Por que isto PARECE certo, e o que a documentação diz. Escrito para quem já acredita nele. */
    porque: z.string().min(1),
    /** A âncora na documentação do assunto. Obrigatória, como nos mal-entendidos. */
    fonte: z.string().url(),
  })
  .strict();

export const ExercicioSchema = z
  .object({
    id: IdSchema,
    /** O id do lab a que ele pertence, como no catálogo. */
    lab: z.string().min(1),
    /** A frase da aplicação: o que ela faz, o que já existe. Em inglês. */
    cenario: z.string().min(1),
    /** O caminho, a partir da raiz do repo, do arquivo que roda. */
    arquivo: z.string().min(1),
    /** O id do marcador `<handbook:trecho id="…">` dentro dele. */
    trecho: z.string().min(1),
    /** A pergunta, em inglês. */
    pergunta: z.string().min(1),
    /** Por que o bloco certo é o certo. */
    porqueCerto: z.string().min(1),
    fonteCerto: z.string().url(),
    /** Pelo menos um: um exercício com um bloco só não é escolha. */
    distratores: z.array(DistratorSchema).min(1),
  })
  .strict();

export type Distrator = z.infer<typeof DistratorSchema>;
export type DefinicaoDeExercicio = z.infer<typeof ExercicioSchema>;

/**
 * As regras que valem para **todo** exercício, em um lugar só.
 *
 * Elas nasceram como testes dentro do primeiro pacote de domínio e ficaram lá
 * enquanto havia um domínio com exercícios. Com o segundo, a escolha era copiar o arquivo de
 * teste — e aí as regras passariam a valer para um domínio e a não valer para o
 * outro na primeira vez que uma delas mudasse. Isto é a mesma guarda, escrita
 * uma vez, e o que é específico de domínio entra por parâmetro.
 *
 * Devolve problemas em texto, não lança: quem chama é um teste, e um teste que
 * imprime "o exercício X não tem âncora" conserta em um minuto o que
 * "esperava true, recebeu false" leva dez.
 */
export function conferirExercicios(
  conjuntos: Readonly<Record<string, readonly DefinicaoDeExercicio[]>>,
  opcoes: {
    /** Os hosts de documentação que este domínio aceita como âncora. */
    readonly dominiosDeFonte: readonly string[];
    /** Quantos distratores cada exercício tem. Um vira sim/não; três não cabem. */
    readonly distratores?: number;
  },
): readonly string[] {
  const problemas: string[] = [];
  const todos = Object.values(conjuntos).flat();
  const quantos = opcoes.distratores ?? 2;

  if (todos.length === 0) {
    return ["nenhum exercício para conferir: a guarda ficaria verde sem medir nada"];
  }

  const aceita = (url: string): boolean =>
    opcoes.dominiosDeFonte.some((host) => url.startsWith(`https://${host}/`));

  for (const exercicio of todos) {
    const lido = ExercicioSchema.safeParse(exercicio);
    if (!lido.success) {
      for (const issue of lido.error.issues) {
        problemas.push(`${exercicio.id}: ${issue.path.join(".")} ${issue.message}`);
      }
    }

    if (!exercicio.arquivo.startsWith("labs/")) {
      problemas.push(
        `${exercicio.id}: aponta para "${exercicio.arquivo}", fora de labs/ — o recorte ` +
          "sai do arquivo que roda",
      );
    }
    if (!aceita(exercicio.fonteCerto)) {
      problemas.push(
        `${exercicio.id}: a âncora do bloco certo é "${exercicio.fonteCerto}", que não está ` +
          `na documentação deste domínio (${opcoes.dominiosDeFonte.join(", ")})`,
      );
    }
    if (exercicio.distratores.length !== quantos) {
      problemas.push(
        `${exercicio.id}: tem ${exercicio.distratores.length} distratores, e a tela mostra ` +
          `${quantos}`,
      );
    }
    for (const distrator of exercicio.distratores) {
      if (!aceita(distrator.fonte)) {
        problemas.push(
          `${distrator.id}: a âncora é "${distrator.fonte}", que não está na documentação ` +
            "deste domínio — distrator sem fonte é opinião",
        );
      }
    }
  }

  // Id repetido quebra o placar, que é indexado por ele — e repetido entre
  // conjuntos é o caso que um teste por conjunto nunca pegaria.
  const ids = todos.flatMap((e) => [e.id, ...e.distratores.map((d) => d.id)]);
  const vistos = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) problemas.push(`id repetido: "${id}" — o placar é indexado por ele`);
    vistos.add(id);
  }

  return problemas;
}

/**
 * Quantos exercícios cada lab tem, derivado dos conjuntos.
 *
 * O e2e usa isto para cobrar que a página do lab mostre o que o domínio
 * declara, sem número escrito no teste.
 */
export function exerciciosPorLab(
  conjuntos: Readonly<Record<string, readonly DefinicaoDeExercicio[]>>,
): ReadonlyMap<string, number> {
  const porLab = new Map<string, number>();
  for (const lista of Object.values(conjuntos)) {
    for (const e of lista) porLab.set(e.lab, (porLab.get(e.lab) ?? 0) + 1);
  }
  return porLab;
}
