import type { AnyObject, Message, ObjectSpec, WorldSpec } from "@ovh/depth-core";
import { decode } from "./isa.js";
import type { Instruction, Mnemonic } from "./isa.js";

/**
 * O caminho de dados, como composição.
 *
 * Um ciclo por tick do motor, com as duas fases fazendo exatamente o que o
 * relógio faz num circuito de verdade:
 *
 * - **acomodação** — busca, decodificação, leitura, ULA, memória. Tudo isso
 *   fecha dentro do mesmo tick, porque é combinacional
 * - **confronto** — só os elementos de memória escrevem: PC, banco e memória
 *
 * O que atravessa a borda de relógio viaja numa aresta `clocked`, e a mensagem
 * em voo **é** o valor esperando o flanco. É por isso que o laço
 * `pc -> ... -> pc` não é um laço combinacional: ele passa por um registrador,
 * e o motor recusaria se não passasse.
 *
 * Compromisso declarado: a unidade de controle é `router` porque o catálogo de
 * hoje não tem `kind` da família `controller` — `clock` e `arbiter` são onda 1.
 * A família está certa no papel; o `kind` chega com ela.
 */

const PALAVRA = 4;

/** Só os elementos de memória guardam estado. Todo o resto é combinacional. */
interface EstadoPc {
  readonly pc: number;
}
interface EstadoBanco {
  readonly regs: readonly number[];
}
interface EstadoMemoria {
  readonly mem: ReadonlyMap<number, number>;
}

const dado = (m: Message | undefined, campo: string): number =>
  (m?.data[campo] as number | undefined) ?? 0;

const achar = (inbox: readonly Message[], kind: string): Message | undefined =>
  inbox.find((m) => m.kind === kind);

const sinal = (
  signals: Readonly<Record<string, readonly Message[]>>,
  porta: string,
): Message | undefined => signals[porta]?.[0];

/** O relógio. Existe para que alguma coisa comece: sem pulso, ninguém roda. */
const relogio: ObjectSpec<Record<string, never>> = {
  id: "relogio",
  kind: "source",
  label: "relógio",
  leaf: true,
  behavior: (state, _inbox, ctx) =>
    ctx.phase === "commit"
      ? { state, out: [{ port: "tick", message: ctx.emit("pulso") }] }
      : { state, out: [] },
};

/**
 * O contador de programa.
 *
 * Na acomodação ele **anuncia** o endereço; no confronto ele **guarda**. Os dois
 * usam a mesma conta, e é isso que faz o valor anunciado ser exatamente o que
 * vai ser latchado — que é o que um registrador é.
 */
const pc: ObjectSpec<EstadoPc> = {
  id: "pc",
  kind: "buffer",
  label: "PC",
  leaf: true,
  init: () => ({ pc: 0 }),
  behavior: (state, inbox, ctx) => {
    const proximo = achar(inbox, "proximo");
    const valor = proximo === undefined ? state.pc : dado(proximo, "pc");
    if (ctx.phase === "commit") return { state: { pc: valor }, out: [] };
    const pulso = achar(inbox, "pulso");
    if (pulso === undefined) return { state, out: [] };
    return { state, out: [{ port: "out", message: ctx.emit("endereco", 1, { pc: valor }) }] };
  },
};

/** Memória de instruções: só lê, e é o que a torna diferente da principal. */
function memoriaDeInstrucoes(image: readonly number[]): ObjectSpec<Record<string, never>> {
  return {
    id: "imem",
    kind: "buffer",
    label: "memória de instruções",
    leaf: true,
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "settle") return { state, out: [] };
      const pedido = achar(inbox, "endereco");
      if (pedido === undefined) return { state, out: [] };
      const endereco = dado(pedido, "pc");
      const word = image[endereco / PALAVRA];
      // Endereço fora do programa não emite nada: a cadeia morre aqui, e o
      // mundo fica parado em vez de executar lixo como se fosse instrução.
      if (word === undefined) return { state, out: [] };
      return {
        state,
        out: [{ port: "out", message: ctx.emit("instrucao", 1, { pc: endereco, word }) }],
      };
    },
  };
}

/** O que a decodificação extrai da palavra, sem decidir nada. */
const decodificador: ObjectSpec<Record<string, never>> = {
  id: "decodificador",
  kind: "router",
  label: "decodificador",
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const palavra = achar(inbox, "instrucao");
    if (palavra === undefined) return { state, out: [] };
    const instr = decode(dado(palavra, "word"));
    if (instr === null) return { state, out: [] };
    return {
      state,
      out: [
        {
          port: "out",
          message: ctx.emit("campos", 1, {
            pc: dado(palavra, "pc"),
            rs1: instr.rs1,
            rs2: instr.rs2,
            rd: instr.rd,
            imm: instr.imm,
          }),
        },
      ],
    };
  },
};

type FonteB = "reg" | "imm";
type FonteEscrita = "ula" | "mem" | "pc4" | "nada";
type Acesso = "ler" | "escrever" | "nada";
type Desvio = "seq" | Mnemonic;

/** O que cada instrução manda cada peça fazer. É a tabela de controle. */
function controlar(instr: Instruction): {
  op: Mnemonic;
  fonteB: FonteB;
  acesso: Acesso;
  escrita: FonteEscrita;
  desvio: Desvio;
} {
  const m = instr.mnemonic;
  const usaImediato: FonteB =
    m === "add" || m === "sub" || m === "and" || m === "or" || m === "xor" ||
    m === "sll" || m === "srl" || m === "sra" || m === "slt" ||
    m === "beq" || m === "bne" || m === "blt" || m === "bge"
      ? "reg"
      : "imm";
  const acesso: Acesso = m === "lw" ? "ler" : m === "sw" ? "escrever" : "nada";
  const escrita: FonteEscrita =
    m === "lw"
      ? "mem"
      : m === "jal" || m === "jalr"
        ? "pc4"
        : m === "sw" || m === "beq" || m === "bne" || m === "blt" || m === "bge"
          ? "nada"
          : "ula";
  const desvio: Desvio =
    m === "beq" || m === "bne" || m === "blt" || m === "bge" || m === "jal" || m === "jalr"
      ? m
      : "seq";
  return { op: m, fonteB: usaImediato, acesso, escrita, desvio };
}

/**
 * A unidade de controle. Manda em todo mundo pelas linhas de controle e nunca
 * recebe carga — é o caso mais puro da família `controller` que existe.
 */
const controle: ObjectSpec<Record<string, never>> = {
  id: "controle",
  kind: "router",
  label: "unidade de controle",
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const palavra = achar(inbox, "instrucao");
    if (palavra === undefined) return { state, out: [] };
    const instr = decode(dado(palavra, "word"));
    if (instr === null) return { state, out: [] };
    const c = controlar(instr);
    return {
      state,
      out: [
        { port: "op", message: ctx.emit("sinal", 1, { op: c.op }) },
        { port: "selb", message: ctx.emit("sinal", 1, { fonteB: c.fonteB }) },
        { port: "acesso", message: ctx.emit("sinal", 1, { modo: c.acesso }) },
        { port: "selwb", message: ctx.emit("sinal", 1, { fonte: c.escrita }) },
        { port: "cond", message: ctx.emit("sinal", 1, { tipo: c.desvio }) },
      ],
    };
  },
};

/**
 * O banco de registradores: **ator que responde a pedido de leitura**.
 *
 * É assim que "ler sem consumir" se resolve sem ninguém espiar o estado de
 * ninguém. A leitura acontece na acomodação e não custa ciclo, que é o
 * comportamento real; a escrita chega por aresta de relógio e vale já para a
 * leitura do mesmo tick — um banco que escreve na primeira metade do ciclo.
 */
const banco: ObjectSpec<EstadoBanco> = {
  id: "banco",
  kind: "buffer",
  label: "banco de registradores",
  leaf: true,
  init: (): EstadoBanco => ({ regs: new Array<number>(32).fill(0) }),
  behavior: (state, inbox, ctx) => {
    const escrita = achar(inbox, "escrita");
    const regs = [...state.regs];
    if (escrita !== undefined) {
      const rd = dado(escrita, "rd");
      // Escrever em x0 é legal e não tem efeito. É a única instrução do
      // subconjunto cujo comportamento correto É não fazer nada.
      if (rd !== 0) regs[rd] = dado(escrita, "valor") | 0;
    }
    if (ctx.phase === "commit") return { state: { regs }, out: [] };

    const campos = achar(inbox, "campos");
    if (campos === undefined) return { state, out: [] };
    return {
      state,
      out: [
        {
          port: "out",
          message: ctx.emit("valores", 1, {
            pc: dado(campos, "pc"),
            a: regs[dado(campos, "rs1")] ?? 0,
            b: regs[dado(campos, "rs2")] ?? 0,
            rd: dado(campos, "rd"),
            imm: dado(campos, "imm"),
          }),
        },
      ],
    };
  },
};

/** O mux que escolhe a segunda entrada da ULA: registrador ou imediato. */
const muxOperando: ObjectSpec<Record<string, never>> = {
  id: "mux-operando",
  kind: "router",
  label: "mux de operando",
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const valores = achar(inbox, "valores");
    const sel = sinal(ctx.signals, "selb");
    if (valores === undefined || sel === undefined) return { state, out: [] };
    const fonteB = sel.data.fonteB as FonteB;
    return {
      state,
      out: [
        {
          port: "out",
          message: ctx.emit("operandos", 1, {
            pc: dado(valores, "pc"),
            a: dado(valores, "a"),
            b: fonteB === "imm" ? dado(valores, "imm") : dado(valores, "b"),
            aReg: dado(valores, "a"),
            bReg: dado(valores, "b"),
            rd: dado(valores, "rd"),
            imm: dado(valores, "imm"),
          }),
        },
      ],
    };
  },
};

function operar(op: Mnemonic, a: number, b: number): number {
  switch (op) {
    case "sub": return (a - b) | 0;
    case "and": case "andi": return a & b;
    case "or": case "ori": return a | b;
    case "xor": case "xori": return a ^ b;
    case "sll": case "slli": return a << (b & 31);
    case "srl": case "srli": return a >>> (b & 31);
    case "sra": case "srai": return a >> (b & 31);
    case "slt": case "slti": return a < b ? 1 : 0;
    case "lui": return b << 12;
    case "auipc": return 0;
    default: return (a + b) | 0;
  }
}

const ula: ObjectSpec<Record<string, never>> = {
  id: "ula",
  kind: "router",
  label: "ULA",
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const operandos = achar(inbox, "operandos");
    const sel = sinal(ctx.signals, "op");
    if (operandos === undefined || sel === undefined) return { state, out: [] };
    const op = sel.data.op as Mnemonic;
    const pcAtual = dado(operandos, "pc");
    const imm = dado(operandos, "imm");
    const resultado =
      op === "auipc"
        ? (pcAtual + (imm << 12)) | 0
        : operar(op, dado(operandos, "a"), dado(operandos, "b"));
    return {
      state,
      out: [
        {
          port: "out",
          message: ctx.emit("resultado", 1, {
            pc: pcAtual,
            resultado,
            aReg: dado(operandos, "aReg"),
            bReg: dado(operandos, "bReg"),
            rd: dado(operandos, "rd"),
            imm,
          }),
        },
      ],
    };
  },
};

/**
 * A memória principal, endereçada. Fica **fora** da CPU, como no diagrama de
 * referência, e é ator: quem quer um valor pede.
 *
 * A escrita também atravessa a borda de relógio — pelo mesmo motivo do banco, e
 * pela mesma aresta `clocked` (aqui, uma que volta para ela mesma). Sem isso, a
 * memória guardaria um tick antes do banco, e o modelo teria dois flancos.
 */
function memoriaPrincipal(image: readonly number[]): ObjectSpec<EstadoMemoria> {
  return {
    id: "memoria",
    kind: "buffer",
    label: "memória principal",
    leaf: true,
    init: (): EstadoMemoria => {
      const mem = new Map<number, number>();
      image.forEach((word, i) => mem.set(i * PALAVRA, word | 0));
      return { mem };
    },
    behavior: (state, inbox, ctx) => {
      const guardar = achar(inbox, "guardar");
      const mem = new Map(state.mem);
      if (guardar !== undefined) mem.set(dado(guardar, "addr"), dado(guardar, "valor") | 0);

      const acesso = achar(inbox, "resultado");
      const modo = sinal(ctx.signals, "acesso")?.data.modo as Acesso | undefined;

      if (ctx.phase === "commit") {
        const out =
          acesso !== undefined && modo === "escrever"
            ? [
                {
                  port: "guardar",
                  message: ctx.emit("guardar", 1, {
                    addr: dado(acesso, "resultado"),
                    valor: dado(acesso, "bReg"),
                  }),
                },
              ]
            : [];
        return { state: { mem }, out };
      }

      if (acesso === undefined || modo === undefined) return { state, out: [] };
      return {
        state,
        out: [
          {
            port: "out",
            message: ctx.emit("acessado", 1, {
              pc: dado(acesso, "pc"),
              resultado: dado(acesso, "resultado"),
              lido: modo === "ler" ? (mem.get(dado(acesso, "resultado")) ?? 0) : 0,
              rd: dado(acesso, "rd"),
            }),
          },
        ],
      };
    },
  };
}

/** O mux de escrita: de onde vem o valor que volta para o banco. */
const muxEscrita: ObjectSpec<Record<string, never>> = {
  id: "mux-escrita",
  kind: "router",
  label: "mux de escrita",
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const acessado = achar(inbox, "acessado");
    const sel = sinal(ctx.signals, "selwb");
    if (acessado === undefined || sel === undefined) return { state, out: [] };
    const fonte = sel.data.fonte as FonteEscrita;
    if (fonte === "nada") return { state, out: [] };
    const valor =
      fonte === "mem"
        ? dado(acessado, "lido")
        : fonte === "pc4"
          ? dado(acessado, "pc") + PALAVRA
          : dado(acessado, "resultado");
    return {
      state,
      out: [
        {
          port: "escrita",
          message: ctx.emit("escrita", 1, { rd: dado(acessado, "rd"), valor }),
        },
      ],
    };
  },
};

/** Quem decide o próximo endereço. O laço que ele fecha passa pelo PC. */
const unidadeDeDesvio: ObjectSpec<Record<string, never>> = {
  id: "desvio",
  kind: "router",
  label: "unidade de desvio",
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const resultado = achar(inbox, "resultado");
    const sel = sinal(ctx.signals, "cond");
    if (resultado === undefined || sel === undefined) return { state, out: [] };
    const tipo = sel.data.tipo as Desvio;
    const pcAtual = dado(resultado, "pc");
    const a = dado(resultado, "aReg");
    const b = dado(resultado, "bReg");
    const imm = dado(resultado, "imm");

    let proximo = pcAtual + PALAVRA;
    if (tipo === "beq" && a === b) proximo = pcAtual + imm;
    if (tipo === "bne" && a !== b) proximo = pcAtual + imm;
    if (tipo === "blt" && a < b) proximo = pcAtual + imm;
    if (tipo === "bge" && a >= b) proximo = pcAtual + imm;
    if (tipo === "jal") proximo = pcAtual + imm;
    // O bit 0 do alvo é zerado: é regra da instrução, não arredondamento.
    if (tipo === "jalr") proximo = ((a + imm) | 0) & ~1;

    return {
      state,
      out: [{ port: "proximo", message: ctx.emit("proximo", 1, { pc: proximo }) }],
    };
  },
};

/** A árvore. Contêineres organizam e nunca têm comportamento. */
export function cpuWorld(image: readonly number[], seed = 1): WorldSpec {
  const logica: AnyObject = {
    id: "logica",
    kind: "composite",
    label: "lógica combinacional",
    children: [muxOperando, ula, muxEscrita, unidadeDeDesvio],
  };
  const processador: AnyObject = {
    id: "processador",
    kind: "composite",
    label: "processador",
    children: [pc, banco, logica],
  };
  const cpu: AnyObject = {
    id: "cpu",
    kind: "composite",
    label: "CPU",
    children: [controle, decodificador, processador],
  };
  const root: AnyObject = {
    id: "sistema",
    kind: "composite",
    label: "sistema",
    children: [relogio, cpu, memoriaDeInstrucoes(image), memoriaPrincipal(image)],
  };

  return {
    id: "cpu",
    seed,
    edgeTicks: 1,
    root,
    params: {},
    wires: [
      // o pulso é o que faz o ciclo começar
      { from: "relogio", port: "tick", to: "pc", timing: "clocked" },

      // acomodação: tudo isto fecha dentro do mesmo tick. `width: 32` não é
      // enfeite: a linha é um feixe de 32 vias, e é isso que faz somar dois
      // números custar 32 vezes um somador de um bit
      { from: "pc", port: "out", to: "imem", timing: "settle", width: 32 },
      { from: "imem", port: "out", to: "decodificador", timing: "settle", width: 32 },
      { from: "imem", port: "out", to: "controle", timing: "settle", width: 32 },
      { from: "decodificador", port: "out", to: "banco", timing: "settle" },
      { from: "banco", port: "out", to: "mux-operando", timing: "settle", width: 32 },
      { from: "mux-operando", port: "out", to: "ula", timing: "settle", width: 32 },
      { from: "ula", port: "out", to: "memoria", timing: "settle", width: 32 },
      { from: "ula", port: "out", to: "desvio", timing: "settle", width: 32 },
      { from: "memoria", port: "out", to: "mux-escrita", timing: "settle", width: 32 },

      // as linhas de controle: metade do diagrama, e nenhuma carrega carga
      { from: "controle", port: "op", to: "ula", line: "control", toPort: "op", timing: "settle" },
      { from: "controle", port: "selb", to: "mux-operando", line: "control", toPort: "selb", timing: "settle" },
      { from: "controle", port: "acesso", to: "memoria", line: "control", toPort: "acesso", timing: "settle" },
      { from: "controle", port: "selwb", to: "mux-escrita", line: "control", toPort: "selwb", timing: "settle" },
      { from: "controle", port: "cond", to: "desvio", line: "control", toPort: "cond", timing: "settle" },

      // o que atravessa a borda de relógio, e por isso não fecha laço nenhum
      { from: "mux-escrita", port: "escrita", to: "banco", timing: "clocked", width: 32 },
      { from: "desvio", port: "proximo", to: "pc", timing: "clocked", width: 32 },
      { from: "memoria", port: "guardar", to: "memoria", timing: "clocked" },
    ],
  };
}

export type { EstadoBanco, EstadoMemoria, EstadoPc };
