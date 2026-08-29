import { z } from "zod";

/**
 * Duas espécies de linha, e a diferença é dura: uma linha de controle carrega
 * sinal — pedido, concessão, gatilho, medida — e nunca carga. É o que faz a
 * pergunta "por onde o dado passa?" ter resposta olhando só as linhas de dado.
 */
export const LineSchema = z.enum(["data", "control"]);

/**
 * Nome de porta, de filho e de parâmetro.
 *
 * O "." separa filho de porta na ponta de um fio (`queue.out`), e o ":" separa
 * eixo de chave no livro-caixa do motor. Um nome que carregue um dos dois
 * escreveria numa contagem que não é a dele, e sem erro nenhum. A recusa mora
 * aqui, no nome, e não em quem parte a string: assim nenhum nome ambíguo chega
 * a existir para alguém partir errado depois.
 */
export const NomeSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9_-]*$/, {
    message:
      'nome precisa começar com letra ou "_" e usar só letras, dígitos, "_" e "-": ' +
      '"." separa filho de porta num fio e ":" separa campos no livro-caixa',
  });

/**
 * Descarte é `direction: "drop"`, e não a ausência de uma porta. Um objeto que
 * joga coisa fora sem porta de descarte não pode ser medido, e um amostrador
 * que não mostra o que descartou não ensina nada.
 */
export const PortSchema = z
  .object({
    role: LineSchema.default("data"),
    direction: z.enum(["in", "out", "drop"]),
    accepts: z.string().min(1).optional(),
    emits: z.string().min(1).optional(),
  })
  .strict()
  .refine((p) => p.role !== "control" || (p.accepts === undefined && p.emits === undefined), {
    message: "porta de controle não declara accepts/emits: controle carrega sinal, não carga",
  });

const NumeroSchema = z
  .object({
    type: z.enum(["int", "float"]),
    default: z.number(),
    // Sem unidade, o leitor inventa a correspondência e não há como corrigi-lo.
    unit: z.string().min(1),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict()
  // A faixa é declarada pelo próprio parâmetro; um default fora dela nasceria
  // inválido e só apareceria quando alguém movesse o controle.
  .refine((p) => p.min === undefined || p.default >= p.min, {
    message: "o default é menor que o min declarado",
  })
  .refine((p) => p.max === undefined || p.default <= p.max, {
    message: "o default é maior que o max declarado",
  })
  .refine((p) => p.min === undefined || p.max === undefined || p.min <= p.max, {
    message: "min é maior que max",
  })
  .refine((p) => p.type !== "int" || Number.isInteger(p.default), {
    message: "parâmetro int com default fracionário",
  });

const DuracaoSchema = z
  .object({
    type: z.literal("duration"),
    // String com unidade ("5s", "200ms"): número puro esconde a escala.
    default: z.string().regex(/^\d+(ms|s|m|h)$/),
  })
  .strict();

const EnumSchema = z
  .object({
    type: z.literal("enum"),
    values: z.array(z.string().min(1)).min(2),
    default: z.string(),
  })
  .strict()
  .refine((p) => p.values.includes(p.default), {
    message: "o default precisa estar entre os values",
  });

export const ParamSchema = z.union([NumeroSchema, DuracaoSchema, EnumSchema]);

export const WireSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    line: LineSchema.default("data"),
  })
  .strict();

export type Line = z.infer<typeof LineSchema>;
export type Port = z.infer<typeof PortSchema>;
export type Param = z.infer<typeof ParamSchema>;
export type Wire = z.infer<typeof WireSchema>;
