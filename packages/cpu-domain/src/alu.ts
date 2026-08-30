import type { AnyObject, Emission, Message, ObjectSpec, Wire } from "@ovh/depth-core";
import { somadorCompleto, fiosDoSomador, nivelFixo } from "./gates.js";
import type { Mnemonic } from "./isa.js";
import { ROTULOS } from "./labels.js";

/**
 * A ULA aberta: por dentro dela, o somador de 32 bits é feito de portas.
 *
 * É aqui que a fatia vertical encosta no caminho de dados. O resto da ULA
 * (lógica bit a bit, deslocamento, comparação) continua sendo folha — está
 * declarado, e é o próximo pedaço a abrir. **A fatia desce por um caminho**, e
 * esse caminho é a soma, que é a operação que a máquina mais faz.
 *
 * Duas peças existem por causa de uma verdade que o desenho costuma esconder:
 * um barramento de 32 vias **é** 32 linhas. O `dispersor` transforma o número
 * nas trinta e duas linhas; o `coletor` transforma as trinta e duas de volta em
 * número. Elas não são adaptador de conveniência: são o `/32` do fio, dito em
 * voz alta.
 */

export const LARGURA = 32;

const dado = (m: Message | undefined, campo: string): number =>
  (m?.data[campo] as number | undefined) ?? 0;

const achar = (inbox: readonly Message[], kind: string): Message | undefined =>
  inbox.find((m) => m.kind === kind);

/** Operações que a soma resolve. As outras vão para a unidade lógica. */
const SOMA = new Set<Mnemonic>(["add", "addi", "lw", "sw", "jalr"]);

/** O número vira 32 linhas. Toda linha sai, dizendo o bit que ela vale. */
const dispersor: ObjectSpec = {
  id: "dispersor",
  kind: "router",
  label: ROTULOS.dispersor,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const operandos = achar(inbox, "operandos");
    if (operandos === undefined) return { state, out: [] };
    const a = dado(operandos, "a");
    const b = dado(operandos, "b");
    const out: Emission[] = [
      // O resto do número segue inteiro para quem não soma bit a bit.
      { port: "resto", message: ctx.emit("operandos", 1, { ...operandos.data }) },
    ];
    for (let i = 0; i < LARGURA; i += 1) {
      out.push({ port: `a${i}`, message: ctx.emit("bit", 1, { bit: (a >>> i) & 1 }) });
      out.push({ port: `b${i}`, message: ctx.emit("bit", 1, { bit: (b >>> i) & 1 }) });
    }
    return { state, out };
  },
};

/** Uma linha vale o que a posição dela vale. É isso que faz o número posicional. */
function peso(i: number): ObjectSpec {
  return {
    id: `peso${i}`,
    kind: "router",
    label: ROTULOS.peso(i),
    leaf: true,
    behavior: (state, inbox, ctx) => {
      if (ctx.phase !== "settle" || inbox.length === 0) return { state, out: [] };
      // A linha chega mesmo em zero, então o peso pergunta o valor dela em vez
      // de tomar a chegada como resposta.
      const alto = inbox.some((m) => m.data.bit === 1);
      return {
        state,
        out: [{ port: "out", message: ctx.emit("parcela", 1, { n: alto ? 2 ** i : 0 }) }],
      };
    },
  };
}

/** As 32 linhas viram número de novo. */
const coletor: ObjectSpec = {
  id: "coletor",
  kind: "router",
  label: ROTULOS.coletor,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const resto = achar(inbox, "operandos");
    if (resto === undefined) return { state, out: [] };
    const soma = inbox
      .filter((m) => m.kind === "parcela")
      .reduce((total, m) => total + dado(m, "n"), 0);
    return {
      state,
      out: [{ port: "out", message: ctx.emit("soma", 1, { ...resto.data, soma: soma | 0 }) }],
    };
  },
};

/**
 * O que não é soma. Continua sendo folha, e isso está declarado: abrir a lógica
 * bit a bit é o mesmo trabalho que abrir o somador, e a fatia desce por um
 * caminho só.
 */
const unidadeLogica: ObjectSpec = {
  id: "unidade-logica",
  kind: "router",
  label: ROTULOS.unidadeLogica,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const operandos = achar(inbox, "operandos");
    const sel = ctx.signals.op?.[0];
    if (operandos === undefined || sel === undefined) return { state, out: [] };
    const op = sel.data.op as Mnemonic;
    const a = dado(operandos, "a");
    const b = dado(operandos, "b");
    const pc = dado(operandos, "pc");
    const imm = dado(operandos, "imm");
    let valor: number;
    switch (op) {
      case "sub": valor = (a - b) | 0; break;
      case "and": case "andi": valor = a & b; break;
      case "or": case "ori": valor = a | b; break;
      case "xor": case "xori": valor = a ^ b; break;
      case "sll": case "slli": valor = a << (b & 31); break;
      case "srl": case "srli": valor = a >>> (b & 31); break;
      case "sra": case "srai": valor = a >> (b & 31); break;
      case "slt": case "slti": valor = a < b ? 1 : 0; break;
      case "lui": valor = b << 12; break;
      case "auipc": valor = (pc + (imm << 12)) | 0; break;
      default: valor = 0;
    }
    return {
      state,
      out: [{ port: "out", message: ctx.emit("logico", 1, { ...operandos.data, valor }) }],
    };
  },
};

/** Escolhe entre a soma e a lógica, e é ele que fala pela ULA inteira. */
const muxOperacao: ObjectSpec = {
  id: "mux-operacao",
  kind: "router",
  label: ROTULOS.muxOperacao,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const daSoma = achar(inbox, "soma");
    const daLogica = achar(inbox, "logico");
    const sel = ctx.signals.op?.[0];
    if (sel === undefined || (daSoma === undefined && daLogica === undefined)) {
      return { state, out: [] };
    }
    const op = sel.data.op as Mnemonic;
    const fonte = SOMA.has(op) ? daSoma : daLogica;
    if (fonte === undefined) return { state, out: [] };
    const resultado = SOMA.has(op) ? dado(fonte, "soma") : dado(fonte, "valor");
    return {
      state,
      out: [
        {
          port: "out",
          message: ctx.emit("resultado", 1, {
            pc: dado(fonte, "pc"),
            resultado,
            aReg: dado(fonte, "aReg"),
            bReg: dado(fonte, "bReg"),
            rd: dado(fonte, "rd"),
            imm: dado(fonte, "imm"),
          }),
        },
      ],
    };
  },
};

/** O somador de 32 bits, e os fios que fazem a cascata do vai-um. */
/**
 * O vai-um que entra no bit zero, amarrado em zero.
 *
 * Ele sempre existiu no circuito e estava **implícito**: nada acionava
 * `bit0.cin`, e a porta lógica modelada como folha tratava "não me acionaram"
 * como zero. Deu certo por coincidência, e a coincidência apareceu no primeiro
 * teste de refinamento: aberta até o transistor, a mesma porta não tem como
 * inventar um comando que não chegou — o nó lá embaixo se recusa a responder, e
 * a ULA inteira devolvia zero.
 *
 * É exatamente o resultado que `docs/depth.md` §3 chama de precioso: descer um
 * nível mostrou que o de cima estava mentindo.
 */
function somador(comTransistores: boolean): { objeto: AnyObject; wires: readonly Wire[] } {
  const bits = Array.from({ length: LARGURA }, (_, i) =>
    somadorCompleto(`bit${i}`, false, comTransistores),
  );
  const wires: Wire[] = [];
  for (let i = 0; i < LARGURA; i += 1) {
    wires.push(...fiosDoSomador(`bit${i}`, comTransistores));
    for (const via of ["a", "b"] as const) {
      wires.push({
        from: "dispersor",
        port: `${via}${i}`,
        to: `bit${i}`,
        toPort: via,
        timing: "settle",
      });
    }
    wires.push({ from: `bit${i}`, port: "soma", to: `peso${i}`, timing: "settle" });
    if (i + 1 < LARGURA) {
      wires.push({
        from: `bit${i}`,
        port: "vaium",
        to: `bit${i + 1}`,
        toPort: "cin",
        timing: "settle",
      });
    } else {
      // O vai-um do último bit é o estouro, e em 32 bits ele se perde de
      // propósito: dizer isso ao descarte é diferente de esquecê-lo.
      wires.push({ from: `bit${i}`, port: "vaium", to: "@drop", timing: "settle" });
    }
    wires.push({ from: `peso${i}`, port: "out", to: "coletor", timing: "settle" });
  }
  return {
    objeto: {
      id: "somador",
      kind: "composite",
      label: ROTULOS.somadorDe(LARGURA),
      replicas: LARGURA,
      children: bits,
    },
    wires,
  };
}

/**
 * A ULA e os fios de dentro dela.
 *
 * `comAtalho` fecha a ULA num caminho rápido — a mesma conta numa passada só.
 * Ele é legítimo porque `shortcutDisagreement` prova que o caminho rápido e as
 * duzentas peças de dentro produzem exatamente o que o mundo de fora enxerga.
 * O lab roda **aberto**, para que descer até a porta lógica mostre coisa viva.
 */
export function ula(
  comAtalho: boolean,
  comTransistores = false,
): { objeto: AnyObject; wires: readonly Wire[] } {
  const somadorDe32 = somador(comTransistores);
  const vaiUmInicial: Wire = {
    from: "cin0",
    port: "out",
    to: "bit0",
    toPort: "cin",
    timing: "settle",
  };
  const pesos = Array.from({ length: LARGURA }, (_, i) => peso(i));

  const base: AnyObject = {
    id: "ula",
    kind: "composite",
    label: ROTULOS.ula,
    inlets: {
      in: ["dispersor"],
      // O sinal de operação manda em dois: em quem faz o que não é soma, e em
      // quem escolhe qual das duas respostas sai.
      op: ["unidade-logica", "mux-operacao"],
    },
    outlets: { out: ["mux-operacao"] },
    children: [
      dispersor,
      nivelFixo("cin0", 0, ROTULOS.cin),
      somadorDe32.objeto,
      { id: "pesos", kind: "composite", label: ROTULOS.pesos, replicas: LARGURA, children: pesos },
      coletor,
      unidadeLogica,
      muxOperacao,
    ],
  };

  const wires: Wire[] = [
    vaiUmInicial,
    ...somadorDe32.wires,
    { from: "dispersor", port: "resto", to: "coletor", timing: "settle" },
    { from: "dispersor", port: "resto", to: "unidade-logica", timing: "settle" },
    { from: "coletor", port: "out", to: "mux-operacao", timing: "settle" },
    { from: "unidade-logica", port: "out", to: "mux-operacao", timing: "settle" },
  ];

  if (!comAtalho) return { objeto: base, wires };

  return {
    objeto: {
      ...base,
      shortcut: (state, inbox, ctx) => {
        if (ctx.phase !== "settle") return { state, out: [] };
        const operandos = achar(inbox, "operandos");
        const sel = ctx.signals.op?.[0];
        if (operandos === undefined || sel === undefined) return { state, out: [] };
        const op = sel.data.op as Mnemonic;
        const a = dado(operandos, "a");
        const b = dado(operandos, "b");
        const pc = dado(operandos, "pc");
        const imm = dado(operandos, "imm");
        let resultado: number;
        switch (op) {
          case "sub": resultado = (a - b) | 0; break;
          case "and": case "andi": resultado = a & b; break;
          case "or": case "ori": resultado = a | b; break;
          case "xor": case "xori": resultado = a ^ b; break;
          case "sll": case "slli": resultado = a << (b & 31); break;
          case "srl": case "srli": resultado = a >>> (b & 31); break;
          case "sra": case "srai": resultado = a >> (b & 31); break;
          case "slt": case "slti": resultado = a < b ? 1 : 0; break;
          case "lui": resultado = b << 12; break;
          case "auipc": resultado = (pc + (imm << 12)) | 0; break;
          default: resultado = (a + b) | 0;
        }
        return {
          state,
          out: [
            {
              port: "out",
              message: ctx.emit("resultado", 1, {
                pc,
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
    },
    wires,
  };
}
