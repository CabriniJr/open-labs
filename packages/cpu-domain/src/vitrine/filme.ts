import { elbow, film, line, pt, type Box, type Director, type Film, type Point, type Shape, type Tone } from "@ovh/motion";
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

/**
 * As constantes de cada nível: onde ele aparece e o tamanho do texto dele.
 *
 * Os números saem do zoom em que a câmera PARA em cada nível (1,46× no chip,
 * 6,2× na ULA, 25× no somador, 69× no bit): cada nível tem de terminar de
 * sumir antes de a câmera chegar ao de baixo (`vanish·1,4` < zoom de baixo), e
 * o texto de um nível é `1/zoom` dele, para ler no mesmo tamanho. O teste de
 * "um nível de cada vez" cobra isso.
 */
const NIVEL = [
  { lod: { vanish: 1.02 }, k: 1 },
  { lod: { appear: 1.4, vanish: 4.3 }, k: 0.685 },
  { lod: { appear: 4.5, vanish: 17.5 }, k: 0.161 },
  { lod: { appear: 17.5, vanish: 48 }, k: 0.0395 },
  { lod: { appear: 48 }, k: 0.0145 },
] as const;

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const meio = (b: Box): Point => pt(b.x + b.w / 2, b.y + b.h / 2);
const dir = (b: Box, f = 0.5): Point => pt(b.x + b.w, b.y + b.h * f);
const esq = (b: Box, f = 0.5): Point => pt(b.x, b.y + b.h * f);
const cima = (b: Box, f = 0.5): Point => pt(b.x + b.w * f, b.y);
const baixo = (b: Box, f = 0.5): Point => pt(b.x + b.w * f, b.y + b.h);

export function filmeDaVitrine(): Film<DetalheDaVitrine> {
  const e = execucaoDaVitrine();
  const f = film<DetalheDaVitrine>({ width: 1280, height: 720, gap: 500, maxZoom: 160 });

  const no = (n: number, id: string, box: Box, label: string, opt: { sub?: string; tone?: Tone; shape?: Shape; hidden?: boolean; layer?: number } = {}) =>
    f.add({ type: "node", id, box, label, sublabel: opt.sub ?? "", tone: opt.tone ?? "processor", shape: opt.shape ?? "box", textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: opt.hidden === true, layer: opt.layer ?? n });
  const fio = (n: number, id: string, path: ReturnType<typeof line>, tone: Tone = "ink", dashed = false) =>
    f.add({ type: "link", id, path, tone, dashed, arrow: true, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: n });
  const ficha = (n: number, id: string, path: ReturnType<typeof line>, label: string, sub: string, tone: Tone) =>
    f.add({ type: "token", id, path, label, sublabel: sub, tone, size: 6 * NIVEL[n]!.k, trail: 5, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: 10 + n });
  const nota = (n: number, id: string, at: Point, label: string, tone: Tone = "ink", align: "start" | "middle" | "end" = "middle") =>
    f.add({ type: "note", id, at, label, tone, align, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, hidden: true, layer: 20 + n });
  const moldura = (n: number, id: string, box: Box, label: string, tone: Tone) =>
    f.add({ type: "region", id, box, label, tone, textScale: NIVEL[n]!.k, lod: NIVEL[n]!.lod, layer: -1 });

  // ── nível 0: a placa ──
  const MEM = B(90, 250, 190, 220);
  const CHIP = B(430, 150, 460, 420);
  moldura(0, "placa", B(30, 40, 1220, 640), "board", "container");
  no(0, "memoria", MEM, "program memory", { sub: `${e.imagem.length} words`, tone: "container", shape: "memory" });
  no(0, "chip", CHIP, "RV32I core", { sub: "single cycle · 32 bit", tone: "processor", shape: "chip" });
  fio(0, "barramento", line(dir(MEM), esq(CHIP)), "ink");
  ficha(0, "busca", line(dir(MEM), esq(CHIP)), "FETCH", hex(e.palavra), "kind-1");
  nota(0, "programa", pt(MEM.x + MEM.w / 2, MEM.y + MEM.h + 30), TEXTO.map((t, i) => `${i === 2 ? "▶ " : "  "}${t}`).join("\n"), "ink");

  // ── nível 1: o datapath, dentro do chip ──
  const o = { x: CHIP.x, y: CHIP.y };
  const L1 = (x: number, y: number, w: number, h: number) => B(o.x + x, o.y + y, w, h);
  const PC = L1(18, 190, 48, 40);
  const IMEM = L1(88, 160, 80, 100);
  const CTRL = L1(196, 34, 120, 50);
  const REGS = L1(200, 150, 92, 134);
  const ALU = L1(320, 165, 70, 100);
  const DMEM = L1(404, 190, 44, 64);
  moldura(1, "datapath", CHIP, "datapath", "processor");
  no(1, "pc", PC, "PC", { sub: hex(e.pc, 1), tone: "kind-4", shape: "register" });
  no(1, "imem", IMEM, "instruction", { sub: "memory", tone: "container", shape: "memory" });
  no(1, "ctrl", CTRL, "decode + control", { tone: "controller" });
  no(1, "regs", REGS, "registers", { sub: `x1=${e.a} x2=${e.b}`, tone: "kind-2", shape: "register" });
  no(1, "ula", ALU, "ALU", { tone: "processor", shape: "alu" });
  no(1, "dmem", DMEM, "data", { sub: "unused", tone: "muted", shape: "memory" });
  fio(1, "f:pc-imem", line(dir(PC), esq(IMEM)));
  fio(1, "f:imem-ctrl", elbow(cima(IMEM), esq(CTRL), 8));
  fio(1, "f:imem-regs", line(dir(IMEM), esq(REGS)));
  fio(1, "f:regs-ulaA", line(dir(REGS, 0.3), esq(ALU, 0.22)));
  fio(1, "f:regs-ulaB", line(dir(REGS, 0.7), esq(ALU, 0.78)));
  fio(1, "f:ctrl-ula", elbow(dir(CTRL), cima(ALU), 8), "controller", true);
  const volta = { from: baixo(ALU), segments: [{ type: "line" as const, to: pt(ALU.x + ALU.w / 2, REGS.y + REGS.h + 28) }, { type: "line" as const, to: pt(REGS.x + REGS.w / 2, REGS.y + REGS.h + 28) }, { type: "line" as const, to: baixo(REGS) }] };
  fio(1, "f:ula-regs", volta, "kind-1");
  ficha(1, "t:pc", line(dir(PC), esq(IMEM)), "ADDR", hex(e.pc, 1), "kind-4");
  ficha(1, "t:instr", elbow(cima(IMEM), esq(CTRL), 8), "INSTR", TEXTO[2]!.replace(/\s+/g, " "), "kind-1");
  ficha(1, "t:rs", line(dir(IMEM), esq(REGS)), "READ", "rs1=x1 rs2=x2", "kind-2");
  ficha(1, "t:a", line(dir(REGS, 0.3), esq(ALU, 0.22)), "A", String(e.a), "kind-2");
  ficha(1, "t:b", line(dir(REGS, 0.7), esq(ALU, 0.78)), "B", String(e.b), "kind-2");
  ficha(1, "t:op", elbow(dir(CTRL), cima(ALU), 8), "OP", "ADD", "controller");
  ficha(1, "t:wb", volta, "WRITE", `x3 ← ${e.soma}`, "kind-1");

  // ── nível 2: dentro da ULA ──
  const L2 = (x: number, y: number, w: number, h: number) => B(ALU.x + x, ALU.y + y, w, h);
  const ADD = L2(12, 16, 28, 24);
  const LOG = L2(12, 46, 28, 18);
  const SHF = L2(12, 70, 28, 14);
  const MUX = L2(48, 28, 11, 46);
  moldura(2, "dentro-ula", ALU, "ALU", "processor");
  no(2, "somador", ADD, "adder", { sub: "a + b", tone: "processor" });
  no(2, "logica", LOG, "and · or · xor", { tone: "muted" });
  no(2, "desloc", SHF, "shift", { tone: "muted" });
  no(2, "mux", MUX, "op", { tone: "controller", shape: "mux" });
  const entradaA = pt(ALU.x + 1, ADD.y + ADD.h * 0.3);
  const entradaB = pt(ALU.x + 1, ADD.y + ADD.h * 0.7);
  fio(2, "f2:a", line(entradaA, esq(ADD, 0.3)), "kind-2");
  fio(2, "f2:b", line(entradaB, esq(ADD, 0.7)), "kind-2");
  fio(2, "f2:add-mux", line(dir(ADD), esq(MUX, 0.2)));
  fio(2, "f2:log-mux", line(dir(LOG), esq(MUX, 0.55)), "muted");
  fio(2, "f2:shf-mux", line(dir(SHF), esq(MUX, 0.85)), "muted");
  fio(2, "f2:out", line(dir(MUX), pt(ALU.x + ALU.w - 1, MUX.y + MUX.h / 2)), "kind-1");
  ficha(2, "t2:a", line(entradaA, esq(ADD, 0.3)), "A", `${e.a} = ${bin(e.a, 4)}`, "kind-2");
  ficha(2, "t2:b", line(entradaB, esq(ADD, 0.7)), "B", `${e.b} = ${bin(e.b, 4)}`, "kind-2");
  ficha(2, "t2:sum", line(dir(ADD), esq(MUX, 0.2)), "SUM", String(e.soma), "kind-1");
  ficha(2, "t2:out", line(dir(MUX), pt(ALU.x + ALU.w - 1, MUX.y + MUX.h / 2)), "RESULT", `${e.soma} = ${bin(e.soma, 4)}`, "kind-1");

  // ── nível 3: dentro do somador, os estágios ──
  // Bit 0 à direita, como num somador desenhado: o vai-um corre da direita para a esquerda.
  const visiveis = [31, -1, 3, 2, 1, 0];
  const larg = 4.2;
  const FA: Record<number, Box> = {};
  visiveis.forEach((bit, i) => {
    const caixa = B(ADD.x + 0.8 + i * 4.5, ADD.y + 7, larg, 9);
    if (bit === -1) {
      nota(3, "fa:reticencias", meio(caixa), "· · ·", "muted");
      return;
    }
    FA[bit] = caixa;
    const st = e.estagios[bit]!;
    no(3, `fa:${bit}`, caixa, `bit ${bit}`, { sub: `${st.a}+${st.b}`, tone: st.s === 1 ? "high" : "processor" });
    nota(3, `fa-s:${bit}`, pt(caixa.x + caixa.w / 2, caixa.y + caixa.h + 2.4), `s=${st.s}`, st.s === 1 ? "high" : "muted");
  });
  for (const bit of [0, 1, 2]) {
    const de = FA[bit]!;
    const para = FA[bit + 1]!;
    const c = e.estagios[bit]!.cout;
    fio(3, `f3:c${bit}`, line(esq(de, 0.3), dir(para, 0.3)), c === 1 ? "high" : "muted");
    ficha(3, `t3:c${bit}`, line(esq(de, 0.3), dir(para, 0.3)), "CARRY", String(c), c === 1 ? "high" : "muted");
  }

  // ── nível 4: um bit, cinco portas ──
  const FB = 2;
  const caixaBit = FA[FB]!;
  const st = e.estagios[FB]!;
  const L4 = (x: number, y: number, w: number, h: number) => B(caixaBit.x + x, caixaBit.y + y, w, h);
  const X1 = L4(0.5, 0.8, 1.1, 0.9);
  const X2 = L4(2.4, 1.4, 1.1, 0.9);
  const A1 = L4(0.5, 4.0, 1.1, 0.9);
  const A2 = L4(1.6, 5.6, 1.1, 0.9);
  const OR = L4(2.8, 4.7, 1.1, 0.9);
  moldura(4, "dentro-bit", caixaBit, `full adder · bit ${FB}`, "processor");
  const tom = (v: number): Tone => (v === 1 ? "high" : "processor");
  no(4, "g:x1", X1, "XOR", { tone: tom(st.x), shape: "xor" });
  no(4, "g:x2", X2, "XOR", { tone: tom(st.s), shape: "xor" });
  no(4, "g:a1", A1, "AND", { tone: tom(st.a & st.b), shape: "and" });
  no(4, "g:a2", A2, "AND", { tone: tom(st.x & st.cin), shape: "and" });
  no(4, "g:or", OR, "OR", { tone: tom(st.cout), shape: "or" });
  const ent = (fy: number) => pt(caixaBit.x + 0.1, caixaBit.y + fy);
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
    ["x2→s", dir(X2), pt(caixaBit.x + caixaBit.w - 0.1, X2.y + X2.h / 2), st.s, "sum"],
    ["or→c", dir(OR), pt(caixaBit.x + caixaBit.w - 0.1, OR.y + OR.h / 2), st.cout, "cout"],
  ];
  for (const [id, a, b, v, nome] of fios4) {
    // Reta, e não `connect`: com caixa de tamanho zero ele anda uma unidade para
    // dentro, e numa porta de uma unidade isso inverte o fio.
    const caminho = id === "x1→a2" ? elbow(a, b, 0.2) : line(a, b);
    fio(4, `f4:${id}`, caminho, tom(v));
    ficha(4, `t4:${id}`, caminho, nome, String(v), tom(v));
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
      body: `Three instructions are in memory. The first two load 5 and 7 into x1 and x2; the third adds them. Follow the third one all the way down: it is ${hex(e.palavra)} in memory, and it will become charges on a handful of wires.`,
      detail: { nivel: 0, linhas: linhasBase },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      d.show(["programa"], { dur: 400 });
      d.glow("memoria", 1).ping("memoria");
      d.together((x) => x.draw("barramento", { dur: 900 }), (x) => x.send("busca", { dur: 900 }));
      d.packet({ tag: "FETCH", tone: "kind-1", from: "memory", to: "core", protocol: "bus", payload: `${hex(e.palavra)} = ${TEXTO[2]}`, bytes: 4 });
      d.glow("chip", 1).ping("chip").wait(900);
    },
  );

  f.chapter(
    {
      id: "core",
      title: "Down: the datapath",
      body: "Zoom into the chip and the package gives way to the datapath. The PC points at the instruction; decode splits it into fields; the register file reads x1 and x2; control tells the ALU to add.",
      detail: { nivel: 1, linhas: [...linhasBase, ["pc", hex(e.pc)], ["rd, rs1, rs2", "x3, x1, x2"]] },
    },
    (d) => {
      d.camera({ box: CHIP }, { dur: 2200 });
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
      detail: { nivel: 2, linhas: [["A", `${e.a} = ${bin(e.a, 8)}`], ["B", `${e.b} = ${bin(e.b, 8)}`], ["op", "ADD"]] },
    },
    (d) => {
      d.camera({ box: ALU }, { dur: 2400 });
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
      detail: { nivel: 3, linhas: [["A", bin(e.a, 8)], ["B", bin(e.b, 8)], ["carries", e.estagios.slice(0, 4).map((s) => s.cout).reverse().join("")], ["sum", bin(e.soma, 8)]] },
    },
    (d) => {
      d.camera({ box: ADD }, { dur: 2400 });
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
      detail: { nivel: 4, linhas: [["a, b, cin", `${st.a}, ${st.b}, ${st.cin}`], ["a ⊕ b", String(st.x)], ["sum = a⊕b⊕cin", String(st.s)], ["carry = ab + cin(a⊕b)", String(st.cout)]] },
    },
    (d) => {
      d.camera({ box: caixaBit }, { dur: 2600 });
      const passo = (ids: string[], porta: string, atraso = 0) =>
        d.together(...ids.map((id) => (x: Director<DetalheDaVitrine>) => x.draw(`f4:${id}`, { dur: 500, delay: atraso }).send(`t4:${id}`, { dur: 600 })), (x) => x.wait(500 + atraso).glow(porta, 1, { dur: 250 }).ping(porta));
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
      title: "Back up: x3 ← 12",
      body: `Every level gave the same answer at its own grain. Climb back out and the result is written where the instruction asked: x3 = ${e.soma}. The PC moves on to the next word.`,
      detail: { nivel: 1, linhas: [["x3", String(e.depois.regs[3])], ["pc", hex(e.depois.pc)]] },
    },
    (d) => {
      d.camera({ box: CHIP }, { dur: 2800 });
      d.together((x) => x.draw("f:ula-regs", { dur: 900 }), (x) => x.send("t:wb", { dur: 1000 }));
      d.packet({ tag: "WRITE", tone: "kind-1", from: "ALU", to: "registers", protocol: "datapath", payload: `x3 ← ${e.soma}`, bytes: 4 });
      d.set("regs", { sublabel: `x3=${e.depois.regs[3]}` }).glow("regs", 1).ping("regs");
      d.set("pc", { sublabel: hex(e.depois.pc, 1) }).ping("pc");
      d.wait(1400);
    },
  );

  return f.build();
}
