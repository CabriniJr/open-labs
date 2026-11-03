import { descida, elbow, film, line, pt, type Box, type Director, type Film, type FilmBuilder, type Point, type Shape, type Tone } from "@ovh/motion";
import { encode, type Instruction } from "../isa.js";
import { initialCpu, stepCpu } from "../reference.js";

/**
 * A vitrine da CPU: uma instrução, do chip ao transistor-quase, num mergulho só.
 *
 * É o modo "showcase" do lab: um filme com play, narração e câmera, ao lado da
 * simulação que já existe. O que ele mostra NÃO é roteiro solto — o programa
 * é montado por `encode` e executado por `stepCpu`, o RV32I de referência do
 * domínio, e cada valor que anda na tela (a palavra buscada, x1, x2, a soma,
 * cada bit e cada vai-um do somador) sai dessa execução.
 *
 * Os níveis moram aninhados no mesmo mundo: o datapath DENTRO do chip, a ULA
 * dentro do datapath, o somador dentro da ULA, um bit dentro do somador, e as
 * portas dentro do bit. Cada nível tem `lod` (aparece quando a câmera chega,
 * some quando ela passa) e `textScale` (lê no mesmo tamanho quando a câmera
 * está nele). A descida é um zoom contínuo, e por isso nunca há espaguete: o
 * que está na tela é sempre um nível só, com o de cima saindo e o de baixo
 * entrando.
 */
export interface DetalheDaVitrine {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const PROGRAMA: readonly Instruction[] = [
  { mnemonic: "addi", rd: 1, rs1: 0, rs2: 0, imm: 5 },
  { mnemonic: "addi", rd: 2, rs1: 0, rs2: 0, imm: 7 },
  { mnemonic: "add", rd: 3, rs1: 1, rs2: 2, imm: 0 },
];
const TEXTO = ["addi x1, x0, 5", "addi x2, x0, 7", "add  x3, x1, x2"];

const hex = (n: number, d = 8) => `0x${(n >>> 0).toString(16).padStart(d, "0")}`;
const bin = (n: number, d: number) => (n >>> 0).toString(2).padStart(d, "0");

export function execucaoDaVitrine() {
  const imagem = PROGRAMA.map(encode);
  let cpu = initialCpu(imagem);
  cpu = stepCpu(stepCpu(cpu));
  const antes = cpu;
  const depois = stepCpu(cpu);
  const a = antes.regs[1]!;
  const b = antes.regs[2]!;
  const soma = depois.regs[3]!;
  // O somador de verdade, bit a bit: o que cada estágio recebe e devolve.
  const bits = Array.from({ length: 32 }, (_, i) => ({ a: (a >>> i) & 1, b: (b >>> i) & 1 }));
  const estagios: { a: number; b: number; cin: number; s: number; cout: number; x: number }[] = [];
  let vaiUm = 0;
  for (const { a: ai, b: bi } of bits) {
    const x = ai ^ bi;
    const s = x ^ vaiUm;
    const cout = (ai & bi) | (x & vaiUm);
    estagios.push({ a: ai, b: bi, cin: vaiUm, s, cout, x });
    vaiUm = cout;
  }
  return { imagem, pc: antes.pc, palavra: imagem[2]!, a, b, soma, estagios, depois };
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
/** Uma caixa dentro de outra, em frações dela: os níveis fundos são escritos assim. */
const D = (pai: Box, fx: number, fy: number, fw: number, fh: number): Box => B(pai.x + pai.w * fx, pai.y + pai.h * fy, pai.w * fw, pai.h * fh);
const meio = (b: Box): Point => pt(b.x + b.w / 2, b.y + b.h / 2);
const dir = (b: Box, f = 0.5): Point => pt(b.x + b.w, b.y + b.h * f);
const esq = (b: Box, f = 0.5): Point => pt(b.x, b.y + b.h * f);
const cima = (b: Box, f = 0.5): Point => pt(b.x + b.w * f, b.y);
const baixo = (b: Box, f = 0.5): Point => pt(b.x + b.w * f, b.y + b.h);

/** Alturas físicas do encapsulamento, no 3D: placa, substrato, die, tampa. */
const ALT = { placa: 6, substrato: 6, die: 3, tampa: 12 } as const;
const SOBRE_O_SUBSTRATO = ALT.placa + ALT.substrato;
const SOBRE_O_DIE = SOBRE_O_SUBSTRATO + ALT.die;

export function filmeDaVitrine(): Film<DetalheDaVitrine> {
  const e = execucaoDaVitrine();
  const f = film<DetalheDaVitrine>({ width: 1280, height: 720, gap: 500, maxZoom: 400 });

  // ── geometria de todos os níveis, antes de tudo: é dela que saem os limiares ──
  const PLACA = B(30, 40, 1220, 640);
  const DIMM1 = B(110, 190, 46, 340);
  const DIMM2 = B(178, 190, 46, 340);
  const PKG = B(470, 170, 400, 380);
  const TAMPA = B(500, 200, 340, 320);
  const DIE = B(580, 270, 180, 180);
  const CORE = D(DIE, 0.06, 0.06, 0.62, 0.62);
  const ISRAM = D(DIE, 0.73, 0.06, 0.21, 0.29);
  const DSRAM = D(DIE, 0.73, 0.39, 0.21, 0.29);
  const IO = D(DIE, 0.06, 0.74, 0.88, 0.2);
  // O datapath dentro do núcleo (as frações vêm do desenho de 460×420 da versão plana).
  const DP = (x: number, y: number, w: number, h: number) => D(CORE, x / 460, y / 420, w / 460, h / 420);
  const PC = DP(18, 190, 48, 40);
  const IMEM = DP(88, 160, 80, 100);
  const CTRL = DP(196, 34, 120, 50);
  const REGS = DP(200, 150, 92, 134);
  const ALU = DP(320, 165, 70, 100);
  const DMEM = DP(404, 190, 44, 64);
  const NA_ULA = (x: number, y: number, w: number, h: number) => D(ALU, x / 70, y / 100, w / 70, h / 100);
  const ADD = NA_ULA(12, 16, 28, 24);
  const LOG = NA_ULA(12, 46, 28, 18);
  const SHF = NA_ULA(12, 70, 28, 14);
  const MUX = NA_ULA(48, 28, 11, 46);
  const visiveis = [31, -1, 3, 2, 1, 0];
  const caixaDoEstagio = (i: number) => D(ADD, (0.8 + i * 4.5) / 28, 7 / 24, 4.2 / 28, 9 / 24);
  const FB = 2;
  const caixaBit = caixaDoEstagio(visiveis.indexOf(FB));

  const nv = descida(f as unknown as FilmBuilder<unknown>, [PKG, DIE, CORE, ALU, ADD, caixaBit]);
  // O nível 0 é visto de longe e no encapsulamento: texto em tamanho cheio.
  const NIVEL = nv.map((n, i) => ({ lod: n.lod, k: i === 0 ? 1 : n.k, elev: i === 0 ? 0 : SOBRE_O_DIE }));

  const no = (n: number, id: string, box: Box, label: string, opt: { sub?: string; tone?: Tone; shape?: Shape; hidden?: boolean; layer?: number; material?: "matte" | "metal" | "silicon" | "pcb"; elevation?: number; height?: number } = {}) =>
    f.add({
      type: "node", id, box, label, sublabel: opt.sub ?? "", tone: opt.tone ?? "processor", shape: opt.shape ?? "box",
      textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: opt.hidden === true, layer: opt.layer ?? n,
      elevation: opt.elevation ?? NIVEL[n]!.elev, ...(opt.material === undefined ? {} : { material: opt.material }), ...(opt.height === undefined ? {} : { height: opt.height }),
    });
  const fio = (n: number, id: string, path: ReturnType<typeof line>, tone: Tone = "ink", dashed = false, elevation?: number) =>
    f.add({ type: "link", id, path, tone, dashed, arrow: true, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: n, elevation: elevation ?? NIVEL[n]!.elev });
  const ficha = (n: number, id: string, path: ReturnType<typeof line>, label: string, sub: string, tone: Tone, elevation?: number) =>
    f.add({ type: "token", id, path, label, sublabel: sub, tone, size: 6 * NIVEL[n]!.k, trail: 5, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: 10 + n, elevation: elevation ?? NIVEL[n]!.elev });
  const nota = (n: number, id: string, at: Point, label: string, tone: Tone = "ink", align: "start" | "middle" | "end" = "middle", elevation?: number) =>
    f.add({ type: "note", id, at, label, tone, align, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: 20 + n, elevation: elevation ?? NIVEL[n]!.elev });
  const moldura = (n: number, id: string, box: Box, label: string, tone: Tone) =>
    f.add({ type: "region", id, box, label, tone, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, layer: -1, elevation: NIVEL[n]!.elev });

  // ── nível 0: a placa-mãe, o encapsulamento e o die debaixo da tampa ──
  no(0, "placa", PLACA, "", { tone: "conduit", material: "pcb", height: ALT.placa, layer: -2, elevation: 0 });
  no(0, "dimm1", DIMM1, "DRAM", { sub: "program", tone: "kind-2", shape: "memory", material: "pcb", elevation: ALT.placa, height: 30 });
  no(0, "dimm2", DIMM2, "DRAM", { tone: "kind-2", shape: "memory", material: "pcb", elevation: ALT.placa, height: 30 });
  no(0, "substrato", PKG, "", { tone: "conduit", material: "pcb", elevation: ALT.placa, height: ALT.substrato, shape: "chip", layer: 0 });
  no(0, "die", DIE, "silicon die", { sub: "RV32I core + SRAM", tone: "processor", material: "silicon", elevation: SOBRE_O_SUBSTRATO, height: ALT.die, hidden: true, layer: 1 });
  no(0, "tampa", TAMPA, "RV32I", { sub: "single-cycle · 32-bit", tone: "container", material: "metal", elevation: SOBRE_O_SUBSTRATO, height: ALT.tampa, layer: 2 });
  fio(0, "barramento", line(dir(DIMM2), esq(PKG)), "ink", false, ALT.placa);
  ficha(0, "busca", line(dir(DIMM2), esq(PKG)), "FETCH", hex(e.palavra), "kind-1", ALT.placa);
  nota(0, "programa", pt(DIMM1.x + 56, DIMM1.y + DIMM1.h + 34), TEXTO.map((t, i) => `${i === 2 ? "▶ " : "  "}${t}`).join("\n"), "ink", "middle", ALT.placa);

  // ── nível 1: a planta do die ──
  moldura(1, "planta", DIE, "die floorplan", "processor");
  // A planta é camada fina sobre o silício, não torres: altura de fração de unidade.
  const fina = DIE.w * 0.02;
  no(1, "core", CORE, "core", { sub: "datapath + control", tone: "processor", height: fina * 1.4 });
  no(1, "isram", ISRAM, "instr", { sub: "SRAM", tone: "container", shape: "memory", height: fina });
  no(1, "dsram", DSRAM, "data", { sub: "SRAM", tone: "container", shape: "memory", height: fina });
  no(1, "io", IO, "bus interface · pads", { tone: "muted", shape: "register", height: fina * 0.8 });
  fio(1, "f:isram-core", line(esq(ISRAM, 0.5), dir(CORE, 0.3)), "kind-1");
  ficha(1, "t:isram", line(esq(ISRAM, 0.5), dir(CORE, 0.3)), "INSTR", hex(e.palavra), "kind-1");

  // ── nível 2: o datapath, dentro do núcleo ──
  moldura(2, "datapath", CORE, "datapath", "processor");
  no(2, "pc", PC, "PC", { sub: hex(e.pc, 1), tone: "kind-4", shape: "register" });
  no(2, "imem", IMEM, "instruction", { sub: "memory", tone: "container", shape: "memory" });
  no(2, "ctrl", CTRL, "decode + control", { tone: "controller" });
  no(2, "regs", REGS, "registers", { sub: `x1=${e.a} x2=${e.b}`, tone: "kind-2", shape: "register" });
  no(2, "ula", ALU, "ALU", { tone: "processor", shape: "alu" });
  no(2, "dmem", DMEM, "data", { sub: "unused", tone: "muted", shape: "memory" });
  const k2 = NIVEL[2]!.k;
  fio(2, "f:pc-imem", line(dir(PC), esq(IMEM)));
  fio(2, "f:imem-ctrl", elbow(cima(IMEM), esq(CTRL), 8 * k2));
  fio(2, "f:imem-regs", line(dir(IMEM), esq(REGS)));
  fio(2, "f:regs-ulaA", line(dir(REGS, 0.3), esq(ALU, 0.22)));
  fio(2, "f:regs-ulaB", line(dir(REGS, 0.7), esq(ALU, 0.78)));
  fio(2, "f:ctrl-ula", elbow(dir(CTRL), cima(ALU), 8 * k2), "controller", true);
  const fundo = REGS.y + REGS.h + 28 * k2;
  const volta = { from: baixo(ALU), segments: [{ type: "line" as const, to: pt(ALU.x + ALU.w / 2, fundo) }, { type: "line" as const, to: pt(REGS.x + REGS.w / 2, fundo) }, { type: "line" as const, to: baixo(REGS) }] };
  fio(2, "f:ula-regs", volta, "kind-1");
  ficha(2, "t:pc", line(dir(PC), esq(IMEM)), "ADDR", hex(e.pc, 1), "kind-4");
  ficha(2, "t:instr", elbow(cima(IMEM), esq(CTRL), 8 * k2), "INSTR", TEXTO[2]!.replace(/\s+/g, " "), "kind-1");
  ficha(2, "t:rs", line(dir(IMEM), esq(REGS)), "READ", "rs1=x1 rs2=x2", "kind-2");
  ficha(2, "t:a", line(dir(REGS, 0.3), esq(ALU, 0.22)), "A", String(e.a), "kind-2");
  ficha(2, "t:b", line(dir(REGS, 0.7), esq(ALU, 0.78)), "B", String(e.b), "kind-2");
  ficha(2, "t:op", elbow(dir(CTRL), cima(ALU), 8 * k2), "OP", "ADD", "controller");
  ficha(2, "t:wb", volta, "WRITE", `x3 ← ${e.soma}`, "kind-1");

  // ── nível 3: dentro da ULA ──
  moldura(3, "dentro-ula", ALU, "ALU", "processor");
  no(3, "somador", ADD, "adder", { sub: "a + b", tone: "processor" });
  no(3, "logica", LOG, "and · or · xor", { tone: "muted" });
  no(3, "desloc", SHF, "shift", { tone: "muted" });
  no(3, "mux", MUX, "op", { tone: "controller", shape: "mux" });
  const borda = ALU.w * 0.015;
  const entradaA = pt(ALU.x + borda, ADD.y + ADD.h * 0.3);
  const entradaB = pt(ALU.x + borda, ADD.y + ADD.h * 0.7);
  const saida = pt(ALU.x + ALU.w - borda, MUX.y + MUX.h / 2);
  fio(3, "f2:a", line(entradaA, esq(ADD, 0.3)), "kind-2");
  fio(3, "f2:b", line(entradaB, esq(ADD, 0.7)), "kind-2");
  fio(3, "f2:add-mux", line(dir(ADD), esq(MUX, 0.2)));
  fio(3, "f2:log-mux", line(dir(LOG), esq(MUX, 0.55)), "muted");
  fio(3, "f2:shf-mux", line(dir(SHF), esq(MUX, 0.85)), "muted");
  fio(3, "f2:out", line(dir(MUX), saida), "kind-1");
  ficha(3, "t2:a", line(entradaA, esq(ADD, 0.3)), "A", `${e.a} = ${bin(e.a, 4)}`, "kind-2");
  ficha(3, "t2:b", line(entradaB, esq(ADD, 0.7)), "B", `${e.b} = ${bin(e.b, 4)}`, "kind-2");
  ficha(3, "t2:sum", line(dir(ADD), esq(MUX, 0.2)), "SUM", String(e.soma), "kind-1");
  ficha(3, "t2:out", line(dir(MUX), saida), "RESULT", `${e.soma} = ${bin(e.soma, 4)}`, "kind-1");

  // ── nível 4: os estágios do somador ──
  // Bit 0 à direita, como num somador desenhado: o vai-um corre da direita para a esquerda.
  const FA: Record<number, Box> = {};
  visiveis.forEach((bit, i) => {
    const caixa = caixaDoEstagio(i);
    if (bit === -1) {
      nota(4, "fa:reticencias", meio(caixa), "· · ·", "muted");
      return;
    }
    FA[bit] = caixa;
    const st = e.estagios[bit]!;
    no(4, `fa:${bit}`, caixa, `bit ${bit}`, { sub: `${st.a}+${st.b}`, tone: st.s === 1 ? "high" : "processor" });
    nota(4, `fa-s:${bit}`, pt(caixa.x + caixa.w / 2, caixa.y + caixa.h + caixa.h * 0.27), `s=${st.s}`, st.s === 1 ? "high" : "muted");
  });
  for (const bit of [0, 1, 2]) {
    const de = FA[bit]!;
    const para = FA[bit + 1]!;
    const c = e.estagios[bit]!.cout;
    fio(4, `f3:c${bit}`, line(esq(de, 0.3), dir(para, 0.3)), c === 1 ? "high" : "muted");
    ficha(4, `t3:c${bit}`, line(esq(de, 0.3), dir(para, 0.3)), "CARRY", String(c), c === 1 ? "high" : "muted");
  }

  // ── nível 5: um bit, cinco portas ──
  const st = e.estagios[FB]!;
  const G = (x: number, y: number, w: number, h: number) => D(caixaBit, x / 4.2, y / 9, w / 4.2, h / 9);
  const X1 = G(0.5, 0.8, 1.1, 0.9);
  const X2 = G(2.4, 1.4, 1.1, 0.9);
  const A1 = G(0.5, 4.0, 1.1, 0.9);
  const A2 = G(1.6, 5.6, 1.1, 0.9);
  const OR = G(2.8, 4.7, 1.1, 0.9);
  moldura(5, "dentro-bit", caixaBit, `full adder · bit ${FB}`, "processor");
  const tom = (v: number): Tone => (v === 1 ? "high" : "processor");
  no(5, "g:x1", X1, "XOR", { tone: tom(st.x), shape: "xor" });
  no(5, "g:x2", X2, "XOR", { tone: tom(st.s), shape: "xor" });
  no(5, "g:a1", A1, "AND", { tone: tom(st.a & st.b), shape: "and" });
  no(5, "g:a2", A2, "AND", { tone: tom(st.x & st.cin), shape: "and" });
  no(5, "g:or", OR, "OR", { tone: tom(st.cout), shape: "or" });
  const ent = (fy: number) => pt(caixaBit.x + caixaBit.w * 0.024, caixaBit.y + (caixaBit.h * fy) / 9);
  const fimDoBit = (b: Box) => pt(caixaBit.x + caixaBit.w * 0.976, b.y + b.h / 2);
  const fios4: [string, Point, Point, number, string][] = [
    ["a→x1", ent(0.95), esq(X1, 0.3), st.a, "a"],
    ["b→x1", ent(1.55), esq(X1, 0.75), st.b, "b"],
    ["x1→x2", dir(X1), esq(X2, 0.3), st.x, "a⊕b"],
    ["cin→x2", ent(2.0), esq(X2, 0.75), st.cin, "cin"],
    ["a→a1", ent(4.15), esq(A1, 0.3), st.a, "a"],
    ["b→a1", ent(4.75), esq(A1, 0.75), st.b, "b"],
    ["x1→a2", baixo(X1), esq(A2, 0.3), st.x, "a⊕b"],
    ["cin→a2", ent(6.2), esq(A2, 0.75), st.cin, "cin"],
    ["a1→or", dir(A1), esq(OR, 0.3), st.a & st.b, "ab"],
    ["a2→or", dir(A2), esq(OR, 0.75), st.x & st.cin, "c(a⊕b)"],
    ["x2→s", dir(X2), fimDoBit(X2), st.s, "sum"],
    ["or→c", dir(OR), fimDoBit(OR), st.cout, "cout"],
  ];
  for (const [id, a, b, v, nome] of fios4) {
    // Reta, e não `connect`: com caixa de tamanho zero ele anda uma unidade para
    // dentro, e numa porta de uma fração de unidade isso inverte o fio.
    const caminho = id === "x1→a2" ? elbow(a, b, caixaBit.w * 0.05) : line(a, b);
    fio(5, `f4:${id}`, caminho, tom(v));
    ficha(5, `t4:${id}`, caminho, nome, String(v), tom(v));
  }

  // ── a história ──
  const linhasBase: (readonly [string, string])[] = [
    ["instruction", TEXTO[2]!],
    ["word", hex(e.palavra)],
    ["x1, x2", `${e.a}, ${e.b}`],
  ];
  f.chapter(
    {
      id: "board",
      title: "One instruction",
      body: `Three instructions are in memory. The first two load 5 and 7 into x1 and x2; the third adds them. Follow the third: it is ${hex(e.palavra)} in DRAM, about to cross the board into the processor.`,
      detail: { nivel: 0, linhas: linhasBase },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      d.show(["programa"], { dur: 400 });
      d.glow("dimm2", 1).ping("dimm2");
      d.together((x) => x.draw("barramento", { dur: 900 }), (x) => x.send("busca", { dur: 1000 }));
      d.packet({ tag: "FETCH", tone: "kind-1", from: "DRAM", to: "processor", protocol: "bus", payload: `${hex(e.palavra)} = ${TEXTO[2]}`, bytes: 4 });
      d.glow("tampa", 1).ping("tampa").wait(700);
    },
  );
  f.chapter(
    {
      id: "lid",
      title: "Lift the lid",
      body: "What you see on a board is the package: a metal lid that spreads heat, on a substrate that fans the die's tiny pads out to pins. Lift the lid and the chip itself is underneath — a square of silicon a few millimetres wide.",
      detail: { nivel: 0, linhas: [...linhasBase, ["package", "substrate + heat spreader"], ["die", "1 core, on-chip SRAM"]] },
    },
    (d) => {
      d.camera({ box: PKG, elevation: SOBRE_O_SUBSTRATO }, { dur: 1800 });
      d.show("die", { dur: 10 });
      d.to("tampa", { lift: 140, opacity: 0 }, { dur: 1700, ease: "inOut" });
      d.glow("die", 1).ping("die").wait(700);
    },
  );
  f.chapter(
    {
      id: "die",
      title: "Down: the die",
      body: "The die's floorplan: the core, the SRAM that holds instructions and data, and the bus interface around them. The instruction word arrives in the instruction SRAM and goes into the core.",
      detail: { nivel: 1, linhas: [...linhasBase, ["blocks", "core · instr SRAM · data SRAM · I/O"]] },
    },
    (d) => {
      d.camera({ box: DIE, elevation: SOBRE_O_DIE }, { dur: 2200 });
      d.glow("isram", 1).ping("isram");
      d.together((x) => x.draw("f:isram-core", { dur: 800 }), (x) => x.send("t:isram", { dur: 900 }));
      d.glow("core", 1).ping("core").wait(600);
    },
  );
  f.chapter(
    {
      id: "core",
      title: "Down: the datapath",
      body: "Inside the core: the PC points at the instruction; decode splits it into fields; the register file reads x1 and x2; control tells the ALU to add.",
      detail: { nivel: 2, linhas: [...linhasBase, ["pc", hex(e.pc)], ["rd, rs1, rs2", "x3, x1, x2"]] },
    },
    (d) => {
      d.camera({ box: CORE, elevation: SOBRE_O_DIE }, { dur: 2200 });
      d.together((x) => x.draw("f:pc-imem"), (x) => x.send("t:pc", { dur: 800 }));
      d.together((x) => x.draw("f:imem-ctrl"), (x) => x.send("t:instr", { dur: 900 }));
      d.glow("ctrl", 1).ping("ctrl");
      d.together((x) => x.draw("f:imem-regs"), (x) => x.send("t:rs", { dur: 800 }));
      d.glow("regs", 1);
      d.together(
        (x) => x.draw(["f:regs-ulaA", "f:regs-ulaB", "f:ctrl-ula"]),
        (x) => x.send("t:a", { dur: 900 }),
        (x) => x.send("t:b", { dur: 900, delay: 120 }),
        (x) => x.send("t:op", { dur: 900, delay: 240 }),
      );
      d.packet({ tag: "READ", tone: "kind-2", from: "registers", to: "ALU", protocol: "datapath", payload: `A = x1 = ${e.a} · B = x2 = ${e.b} · op = ADD` });
      d.glow("ula", 1).ping("ula").wait(700);
    },
  );
  f.chapter(
    {
      id: "alu",
      title: "Down: inside the ALU",
      body: "The ALU computes every operation at once — add, logic, shift — and a multiplexer picks one. Control chose ADD, so only the adder's answer leaves.",
      detail: { nivel: 3, linhas: [["A", `${e.a} = ${bin(e.a, 8)}`], ["B", `${e.b} = ${bin(e.b, 8)}`], ["op", "ADD"]] },
    },
    (d) => {
      d.camera({ box: ALU, elevation: SOBRE_O_DIE }, { dur: 2400 });
      d.together((x) => x.draw(["f2:a", "f2:b"]), (x) => x.send("t2:a", { dur: 900 }), (x) => x.send("t2:b", { dur: 900, delay: 150 }));
      d.glow("somador", 1).ping("somador");
      d.draw(["f2:log-mux", "f2:shf-mux"], { dur: 400, wait: false });
      d.together((x) => x.draw("f2:add-mux"), (x) => x.send("t2:sum", { dur: 800 }));
      d.glow("mux", 1).ping("mux");
      d.together((x) => x.draw("f2:out"), (x) => x.send("t2:out", { dur: 800 }));
      d.wait(600);
    },
  );
  f.chapter(
    {
      id: "adder",
      title: "Down: thirty-two stages",
      body: `The adder is 32 one-bit stages in a row, bit 0 on the right. Each adds its two bits and the carry from its neighbour, and passes its own carry left. ${e.a} + ${e.b}: bits 0, 1 and 2 all carry, so the carry walks three stages before it stops.`,
      detail: { nivel: 4, linhas: [["A", bin(e.a, 8)], ["B", bin(e.b, 8)], ["carries", e.estagios.slice(0, 4).map((s) => s.cout).reverse().join("")], ["sum", bin(e.soma, 8)]] },
    },
    (d) => {
      d.camera({ box: ADD, elevation: SOBRE_O_DIE }, { dur: 2400 });
      d.stagger([0, 1, 2], 700, (x, bit) => {
        x.glow(`fa:${bit}`, 1, { dur: 250 }).ping(`fa:${bit}`);
        x.wait(250);
        x.together((y) => y.draw(`f3:c${bit}`, { dur: 500 }), (y) => y.send(`t3:c${bit}`, { dur: 500 }));
      });
      d.packet({ tag: "CARRY", tone: "high", from: "bit 0", to: "bit 3", protocol: "ripple", payload: `carries ${e.estagios.slice(0, 3).map((s) => s.cout).join(", ")} · sum ${bin(e.soma, 4)}` });
      d.show(["fa-s:0", "fa-s:1", "fa-s:2", "fa-s:3", "fa-s:31", "fa:reticencias"], { dur: 400 });
      d.wait(900);
    },
  );
  f.chapter(
    {
      id: "gates",
      title: `Down: bit ${FB}, five gates`,
      body: `One stage is a full adder: two XORs make the sum bit, two ANDs and an OR make the carry. Bit ${FB} gets a=${st.a}, b=${st.b} and a carry of ${st.cin}. Sum ${st.s}, carry out ${st.cout} — the same answer, now as gates that are on or off.`,
      detail: { nivel: 5, linhas: [["a, b, cin", `${st.a}, ${st.b}, ${st.cin}`], ["a ⊕ b", String(st.x)], ["sum = a⊕b⊕cin", String(st.s)], ["carry = ab + cin(a⊕b)", String(st.cout)]] },
    },
    (d) => {
      d.camera({ box: caixaBit, elevation: SOBRE_O_DIE }, { dur: 2600 });
      const passo = (ids: string[], porta: string) =>
        d.together(...ids.map((id) => (x: Director<DetalheDaVitrine>) => x.draw(`f4:${id}`, { dur: 500 }).send(`t4:${id}`, { dur: 600 })), (x) => x.wait(500).glow(porta, 1, { dur: 250 }).ping(porta));
      passo(["a→x1", "b→x1"], "g:x1");
      passo(["a→a1", "b→a1"], "g:a1");
      passo(["x1→x2", "cin→x2"], "g:x2");
      passo(["x1→a2", "cin→a2"], "g:a2");
      passo(["a1→or", "a2→or"], "g:or");
      d.together((x) => x.draw("f4:x2→s").send("t4:x2→s", { dur: 600 }), (x) => x.draw("f4:or→c").send("t4:or→c", { dur: 600 }));
      d.packet({ tag: "BIT", tone: "high", from: `bit ${FB}`, to: `bit ${FB + 1}`, protocol: "gates", payload: `sum ${st.s} · carry ${st.cout}` });
      d.wait(1000);
    },
  );
  f.chapter(
    {
      id: "up",
      title: `Back up: x3 ← ${e.soma}`,
      body: `Every level gave the same answer at its own grain. Climb back out and the result is written where the instruction asked: x3 = ${e.soma}. The lid goes back on, and the PC moves to the next word.`,
      detail: { nivel: 2, linhas: [["x3", String(e.depois.regs[3])], ["pc", hex(e.depois.pc)]] },
    },
    (d) => {
      d.camera({ box: CORE, elevation: SOBRE_O_DIE }, { dur: 2800 });
      d.together((x) => x.draw("f:ula-regs", { dur: 900 }), (x) => x.send("t:wb", { dur: 1000 }));
      d.packet({ tag: "WRITE", tone: "kind-1", from: "ALU", to: "registers", protocol: "datapath", payload: `x3 ← ${e.soma}`, bytes: 4 });
      d.set("regs", { sublabel: `x3=${e.depois.regs[3]}` }).glow("regs", 1).ping("regs");
      d.set("pc", { sublabel: hex(e.depois.pc, 1) }).ping("pc");
      d.wait(900);
      d.camera({ at: { zoom: 1, elev: 0 } }, { dur: 2600 });
      d.to("tampa", { lift: 0, opacity: 1 }, { dur: 1200 });
      d.wait(600);
    },
  );

  return f.build();
}
