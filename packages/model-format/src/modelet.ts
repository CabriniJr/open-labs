import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { NomeSchema, ParamSchema, PortSchema, WireSchema } from "./schema.js";
import type { Line, Param, Port } from "./schema.js";

const TeachesSchema = z
  .object({
    phenomenon: z.string().min(1),
    perturbation: z.string().min(1),
    watch: z.array(z.string().min(1)).min(1),
  })
  .strict();

/**
 * Um filho é `kind` mais os argumentos que aquele `kind` entende. Os
 * argumentos ficam abertos de propósito: quem sabe quais existem é o motor, e
 * a conferência acontece no compilador, que conhece o catálogo.
 */
const ChildSchema = z.object({ kind: NomeSchema }).passthrough();

export const ModeletSchema = z
  .object({
    modelet: z.string().min(1),
    version: z.number().int().positive(),
    title: z.string().min(1),
    /** Quanto do interior já foi construído. `depth.md` §2. */
    state: z.enum(["opaque", "approximate", "refined"]),
    ports: z.record(NomeSchema, PortSchema),
    params: z.record(NomeSchema, ParamSchema).default({}),
    children: z.record(NomeSchema, ChildSchema).default({}),
    wires: z.array(WireSchema).default([]),
    /** Um lab que não declara o que ensina não é um lab. */
    teaches: z.array(TeachesSchema).min(1),
    not_modeled: z.array(z.string().min(1)).default([]),
  })
  .strict();

type RawModelet = z.infer<typeof ModeletSchema>;

export type Child = z.infer<typeof ChildSchema>;
export type Teaches = z.infer<typeof TeachesSchema>;

/**
 * A ponta de um fio, já resolvida.
 *
 * É a diferença entre checar antes de usar e não poder violar: depois do
 * parse ninguém mais parte `"queue.out"` em dois, então ninguém mais pode
 * partir errado. `at: "self"` nomeia uma porta que existe em `ports`, e
 * `at: "child"` nomeia um filho que existe em `children` — ambos conferidos na
 * construção, uma vez só.
 */
export type Endpoint =
  | { readonly at: "self"; readonly port: string }
  | { readonly at: "child"; readonly child: string; readonly port: string };

export interface ResolvedWire {
  readonly from: Endpoint;
  readonly to: Endpoint;
  readonly line: Line;
}

export interface Modelet {
  readonly modelet: string;
  readonly version: number;
  readonly title: string;
  readonly state: RawModelet["state"];
  readonly ports: Readonly<Record<string, Port>>;
  readonly params: Readonly<Record<string, Param>>;
  readonly children: Readonly<Record<string, Child>>;
  readonly wires: readonly ResolvedWire[];
  readonly teaches: readonly Teaches[];
  readonly not_modeled: readonly string[];
}

export type ParseResult =
  | { readonly ok: true; readonly value: Modelet }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Onde uma ponta de fio aponta, ainda como texto. */
function partir(
  ponta: string,
): { readonly kind: "self"; readonly port: string } | { readonly kind: "child"; readonly child: string; readonly port: string } | null {
  const pedacos = ponta.split(".");
  const [a, b] = pedacos;
  if (a === undefined || a === "") return null;
  if (pedacos.length === 1) return { kind: "self", port: a };
  if (pedacos.length === 2 && b !== undefined && b !== "") {
    return { kind: "child", child: a, port: b };
  }
  return null;
}

/** Toda referência `{ param: nome }` dentro de um valor, em qualquer profundidade. */
function referencias(valor: unknown, achadas: Set<string>): void {
  if (Array.isArray(valor)) {
    for (const item of valor) referencias(item, achadas);
    return;
  }
  if (typeof valor !== "object" || valor === null) return;
  const obj = valor as Record<string, unknown>;
  const alvo = obj["param"];
  if (typeof alvo === "string") achadas.add(alvo);
  for (const v of Object.values(obj)) referencias(v, achadas);
}

/**
 * Lê um `modelet` e recusa com mensagem que diz ao autor o que consertar.
 *
 * As checagens que exigem o documento inteiro moram aqui, não no schema de
 * campo: fio apontando para porta inexistente é o erro que mais acontece, e é
 * exatamente o que um schema por campo não vê.
 *
 * Todas as regras aqui são de **igualdade**, não de inclusão: um fio só pode
 * apontar para porta que existe *e* toda porta declarada precisa ser usada;
 * um filho só pode citar parâmetro que existe *e* todo parâmetro precisa ser
 * citado. Provar só um dos lados deixaria passar metade dos desenhos que
 * mentem — a porta que aparece na tela e não faz nada, o controle que não
 * controla.
 */
export function parseModelet(source: string): ParseResult {
  let cru: unknown;
  try {
    cru = parseYaml(source);
  } catch (e) {
    const causa = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [`YAML inválido: ${causa}`] };
  }

  const lido = ModeletSchema.safeParse(cru);
  if (!lido.success) {
    return {
      ok: false,
      errors: lido.error.issues.map((i) => {
        const onde = i.path.length > 0 ? i.path.join(".") : "(raiz)";
        return `${onde}: ${i.message}`;
      }),
    };
  }
  const doc = lido.data;

  const erros: string[] = [];
  const portas = new Set(Object.keys(doc.ports));
  const filhos = new Set(Object.keys(doc.children));
  const usadas = new Set<string>();
  const fios: ResolvedWire[] = [];

  const resolver = (ponta: string, papel: "origem" | "destino"): Endpoint | null => {
    const partes = partir(ponta);
    if (partes === null) {
      erros.push(
        `a ${papel} "${ponta}" não é uma ponta de fio: use "porta" para uma porta ` +
          `deste modelet ou "filho.porta" para a porta de um filho`,
      );
      return null;
    }
    if (partes.kind === "child") {
      if (!filhos.has(partes.child)) {
        erros.push(
          `a ${papel} "${ponta}" cita o filho "${partes.child}", que não está em ` +
            `children — filhos declarados: ${[...filhos].join(", ") || "nenhum"}`,
        );
        return null;
      }
      return { at: "child", child: partes.child, port: partes.port };
    }
    const porta = doc.ports[partes.port];
    if (porta === undefined) {
      erros.push(
        `a ${papel} "${ponta}" não é porta deste modelet nem "filho.porta" — ` +
          `portas declaradas: ${[...portas].join(", ") || "nenhuma"}`,
      );
      return null;
    }
    // A direção da porta é do ponto de vista do modelet: o que ele recebe pela
    // porta `in` sai dela para dentro, e por isso `in` só pode ser origem. Uma
    // porta usada do lado errado desenharia o fluxo ao contrário.
    const esperado = porta.direction === "in" ? "origem" : "destino";
    if (papel !== esperado) {
      erros.push(
        `a porta "${partes.port}" tem direction "${porta.direction}" e aparece como ` +
          `${papel} de um fio: por dentro do modelet ela só pode ser ${esperado}`,
      );
      return null;
    }
    usadas.add(partes.port);
    return { at: "self", port: partes.port };
  };

  for (const fio of doc.wires) {
    const from = resolver(fio.from, "origem");
    const to = resolver(fio.to, "destino");
    if (from === null || to === null) continue;
    fios.push({ from, to, line: fio.line });
  }

  for (const nome of portas) {
    if (usadas.has(nome)) continue;
    erros.push(
      `a porta "${nome}" é declarada e nenhum fio a usa: porta órfã aparece no ` +
        `desenho e não faz nada. Ligue-a ou remova-a`,
    );
  }

  const citados = new Set<string>();
  for (const filho of Object.values(doc.children)) referencias(filho, citados);
  for (const nome of citados) {
    if (doc.params[nome] !== undefined) continue;
    erros.push(
      `um filho referencia { param: ${nome} }, que não está em params — ` +
        `parâmetros declarados: ${Object.keys(doc.params).join(", ") || "nenhum"}`,
    );
  }
  for (const nome of Object.keys(doc.params)) {
    if (citados.has(nome)) continue;
    erros.push(
      `o parâmetro "${nome}" é declarado e nenhum filho o referencia: parâmetro ` +
        `morto vira controle que não controla. Use-o com { param: ${nome} } ou remova-o`,
    );
  }

  for (const [i, t] of doc.teaches.entries()) {
    for (const alvo of t.watch) {
      const cabeca = alvo.split(".")[0];
      if (cabeca !== undefined && (portas.has(cabeca) || filhos.has(cabeca))) continue;
      erros.push(
        `teaches[${i}].watch aponta para "${alvo}", e "${cabeca ?? ""}" não é porta ` +
          `nem filho deste modelet: um fenômeno que manda olhar o que não existe não ensina`,
      );
    }
  }

  if (erros.length > 0) return { ok: false, errors: erros };

  return {
    ok: true,
    value: {
      modelet: doc.modelet,
      version: doc.version,
      title: doc.title,
      state: doc.state,
      ports: doc.ports,
      params: doc.params,
      children: doc.children,
      wires: fios,
      teaches: doc.teaches,
      not_modeled: doc.not_modeled,
    },
  };
}
