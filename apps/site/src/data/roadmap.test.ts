import { describe, expect, it } from "vitest";
import {
  ANNEX_W,
  ANNEX_X,
  LEFT_X,
  MAP_HEIGHT,
  MAPA_OTEL,
  NODE_H,
  NODE_W,
  PHASE_W,
  PHASE_X,
  RIGHT_X,
  annexes,
  labs,
  phases,
} from "./roadmap.js";

/**
 * O mapa é a navegação principal do handbook, e ele é **dado posicionado à mão**:
 * cada nó carrega um `y` que alguém escolheu. Isso não tinha teste nenhum, e o
 * modo de falhar é o pior que este projeto conhece — duas caixas por cima uma da
 * outra, ou um espaçamento diferente do resto, num SVG que ninguém abre no
 * navegador durante a revisão.
 *
 * Um teste de layout não é capricho aqui: acrescentar um lab no meio de uma fase
 * obriga a recalcular tudo o que está abaixo, e "recalcular tudo o que está
 * abaixo" é exatamente o tipo de tarefa que uma pessoa faz quase certo.
 */

interface Caixa {
  readonly nome: string;
  readonly x: number;
  readonly w: number;
  readonly y: number;
  readonly h: number;
}

/**
 * Todas as caixas do mapa no mesmo espaço de coordenadas. A altura de um rótulo
 * de fase é dada pelo CSS e não por um número daqui; `NODE_H` é a aproximação
 * conservadora, e errar para o lado de acusar sobreposição é o lado certo.
 */
const CAIXAS: readonly Caixa[] = [
  ...phases.map((fase) => ({
    nome: `fase ${fase.number}`,
    x: PHASE_X,
    w: PHASE_W,
    y: fase.y,
    h: NODE_H,
  })),
  ...labs.map((lab) => ({
    nome: lab.id,
    x: lab.side === "left" ? LEFT_X : RIGHT_X,
    w: NODE_W,
    y: lab.y,
    h: NODE_H,
  })),
  ...annexes.map((anexo) => ({
    nome: anexo.id,
    x: ANNEX_X,
    w: ANNEX_W,
    y: anexo.y,
    h: NODE_H,
  })),
];

/** As fileiras de uma fase, sem repetição e em ordem. */
function fileirasDa(fase: number): readonly number[] {
  return [...new Set(labs.filter((lab) => lab.phase === fase).map((lab) => lab.y))].sort(
    (a, b) => a - b,
  );
}

describe("o mapa do OTel não tem caixa por cima de caixa", () => {
  it("nenhum par se sobrepõe", () => {
    const colisoes: string[] = [];
    CAIXAS.forEach((a, i) => {
      for (const b of CAIXAS.slice(i + 1)) {
        const cruzaX = a.x < b.x + b.w && b.x < a.x + a.w;
        const cruzaY = a.y < b.y + b.h && b.y < a.y + a.h;
        if (cruzaX && cruzaY) colisoes.push(`${a.nome} × ${b.nome}`);
      }
    });
    expect(colisoes).toEqual([]);
  });

  it("nenhuma caixa sai da moldura", () => {
    for (const caixa of CAIXAS) {
      expect(caixa.y, `${caixa.nome} começa acima do topo`).toBeGreaterThanOrEqual(0);
      expect(caixa.y + caixa.h, `${caixa.nome} passa da altura do mapa`).toBeLessThanOrEqual(
        MAP_HEIGHT,
      );
    }
  });
});

/**
 * A régua está escrita como comentário no `roadmap.ts`, e comentário não impede
 * ninguém de nada. Aqui ela passa a valer.
 */
describe("a régua de espaçamento do mapa", () => {
  it.each(phases.map((fase) => [fase.number, fase] as const))(
    "fase %i: a primeira fileira fica 66 abaixo do rótulo",
    (_numero, fase) => {
      const ys = fileirasDa(fase.number);
      expect(ys.length, `fase ${fase.number} (${fase.title}) sem nenhum lab`).toBeGreaterThan(0);
      expect(Math.min(...ys) - fase.y).toBe(66);
    },
  );

  it.each(phases.map((fase) => [fase.number, fase] as const))(
    "fase %i: fileiras consecutivas ficam 56 uma da outra",
    (_numero, fase) => {
      const ys = fileirasDa(fase.number);
      ys.forEach((y, i) => {
        if (i === 0) return;
        const anterior = ys[i - 1] ?? y;
        expect(y - anterior).toBe(56);
      });
    },
  );

  it("a fase seguinte começa 68 depois da última fileira da anterior", () => {
    for (const fase of phases) {
      const seguinte = phases.find((p) => p.number === fase.number + 1);
      if (seguinte === undefined) continue;
      expect(seguinte.y - Math.max(...fileirasDa(fase.number))).toBe(68);
    }
  });

  it("a espinha termina na última fileira, e a altura do mapa a comporta", () => {
    const ultima = Math.max(...labs.map((lab) => lab.y));
    expect(MAPA_OTEL.spineBottom).toBe(ultima);
    expect(MAP_HEIGHT).toBe(ultima + 56);
  });
});

/**
 * O anexo pendura por uma aresta tracejada que parte da coluna da esquerda. Sem
 * um lab à esquerda naquele `y`, a aresta sai de lugar nenhum — e é uma linha
 * apontando para o vazio, não um erro que alguém veja.
 */
describe("os anexos penduram em algo", () => {
  it("todo anexo alinha com um lab da coluna da esquerda", () => {
    const esquerda = new Set(labs.filter((lab) => lab.side === "left").map((lab) => lab.y));
    for (const anexo of annexes) {
      expect(esquerda.has(anexo.y), `${anexo.id} está em y=${anexo.y}, sem lab à esquerda`).toBe(
        true,
      );
    }
  });

  it("todo anexo aponta para um lab que existe na ordem de leitura", () => {
    const ids = new Set(labs.map((lab) => lab.id));
    for (const anexo of annexes) {
      expect(ids.has(anexo.afterLab), `${anexo.id} aponta afterLab "${anexo.afterLab}"`).toBe(true);
    }
  });

  it("dois anexos não dividem a mesma fileira", () => {
    const ys = annexes.map((anexo) => anexo.y);
    expect(new Set(ys).size).toBe(ys.length);
  });
});
