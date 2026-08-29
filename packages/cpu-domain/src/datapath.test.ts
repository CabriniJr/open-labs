import { describe, expect, it } from "vitest";
import { World, shortcutDisagreement } from "@ovh/depth-core";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";
import type { EstadoBanco } from "./datapath.js";

const imagem = (fonte: string): readonly number[] => {
  const r = assemble(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join(" | "));
  return r.image.words;
};

const PROGRAMA = `
  addi t0, x0, 20
  addi t1, x0, 22
  add  t2, t0, t1
`;

describe("o caminho de dados como mundo do motor", () => {
  it("passa pela validação do motor: nenhum laço combinacional, nenhum fio solto", () => {
    // O laço pc -> imem -> ... -> pc existe, e só é legal porque volta por
    // aresta de relógio. Se alguém trocasse essa aresta para acomodada, o
    // motor recusaria o mundo aqui, na construção — que é o ponto.
    expect(() => new World(cpuWorld(imagem(PROGRAMA)))).not.toThrow();
  });

  it("uma instrução por tick, e o resultado aparece no banco", () => {
    const mundo = new World(cpuWorld(imagem(PROGRAMA)));
    mundo.advance(6);
    const banco = mundo.state.nodes.banco as EstadoBanco;
    expect(banco.regs[7]).toBe(42);
  });

  it("a acomodação atravessa o caminho inteiro dentro de um tick", () => {
    // `substeps` é a profundidade do caminho combinacional. Um valor de 1
    // significaria que a busca e a ULA caíram em ticks diferentes — ou seja,
    // que isto não é um ciclo único.
    const mundo = new World(cpuWorld(imagem(PROGRAMA)));
    mundo.advance(4);
    // Com o somador de 32 bits aberto, a cascata do vai-um domina: são dezenas
    // de subpassos, e cada um deles é um pedaço de atraso de propagação.
    expect(mundo.state.substeps).toBeGreaterThan(30);
  });

  it("as linhas de controle são contadas em eixo próprio, e não como carga", () => {
    const mundo = new World(cpuWorld(imagem(PROGRAMA)));
    mundo.advance(5);
    const ledger = mundo.state.ledger;
    // O sinal de operação entra na ULA por um borne, e lá dentro chega em dois:
    // quem faz o que não é soma, e quem escolhe qual resposta sai.
    expect(ledger["sigin:mux-operacao.op"]).toBeGreaterThan(0);
    expect(ledger["sigin:unidade-logica.op"]).toBeGreaterThan(0);
    expect(ledger["sigin:mux-operando.selb"]).toBeGreaterThan(0);
    // A carga entra na ULA pelo borne e chega em quem recebe por ele — uma por
    // instrução —, e o sinal não entra nessa conta.
    expect(ledger["in:dispersor"]).toBe(ledger["out:mux-operando.out"]);
  });

  it("a saída da ULA alimenta dois destinos pelo leque nativo da porta", () => {
    const mundo = new World(cpuWorld(imagem(PROGRAMA)));
    mundo.advance(5);
    const ledger = mundo.state.ledger;
    // Com a ULA aberta, quem emite pela porta dela é o mux de operação — o
    // borne de saída diz isso, e o livro-caixa conta no nome de quem agiu.
    const emitiu = ledger["out:mux-operacao.out"] ?? 0;
    expect(emitiu).toBeGreaterThan(0);
    // uma emissão, dois destinos: é a divergência que mede o espalhamento
    expect(ledger["in:desvio"]).toBe(emitiu);
    // A memória também recebe do dispositivo de entrada, então ela conta mais
    // do que a ULA emitiu — o que importa é que nenhuma cópia se perdeu.
    expect(ledger["in:memoria"]).toBeGreaterThanOrEqual(emitiu);
  });

  it("o atalho da ULA concorda com as duzentas peças de dentro dela", () => {
    // O caminho rápido não é uma segunda verdade: é a mesma conta em menos
    // passos. Aqui os dois rodam dentro da CPU inteira e o que se compara é o
    // que o mundo FORA da ULA enxerga — registradores, pc e memória inclusive.
    const programas = [
      PROGRAMA,
      `
      addi t0, x0, -5
      addi t1, x0, 3
      sub  t2, t0, t1
      and  t3, t0, t1
      sll  t4, t1, t1
      slt  t5, t0, t1
      lui  t6, 0x10
      `,
    ];
    for (const fonte of programas) {
      expect(
        shortcutDisagreement(cpuWorld(imagem(fonte), { atalhoNaUla: true }), "ula", 10),
      ).toBeNull();
    }
  });

  it("a ULA aberta é o caminho que se desce: o somador é feito de portas", () => {
    const arvore = new World(cpuWorld(imagem(PROGRAMA))).tree;
    // bit 7 do somador de 32, e as cinco portas dele
    expect(arvore.byId.has("bit7")).toBe(true);
    for (const sufixo of ["xor1", "and1", "xor2", "and2", "or1"]) {
      expect(arvore.byId.has(`bit7-${sufixo}`)).toBe(true);
    }
    expect(arvore.byId.get("somador")?.replicas).toBe(32);
  });
});
