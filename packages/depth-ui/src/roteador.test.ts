import { describe, expect, it } from "vitest";
import { caminho } from "./roteador.js";
import type { Retangulo } from "./roteador.js";

const caixa = (id: string, x: number, y: number, w: number, h: number) => ({ id, x, y, w, h });

/** Os segmentos retos de um caminho em cotovelos, como pares de pontos. */
function segmentos(d: string): readonly { x1: number; y1: number; x2: number; y2: number }[] {
  const passos = d.trim().split(/\s+/u);
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < passos.length; i += 1) {
    const cmd = passos[i];
    if (cmd === "M") {
      x = Number(passos[i + 1]);
      y = Number(passos[i + 2]);
      i += 2;
    } else if (cmd === "H") {
      const nx = Number(passos[i + 1]);
      out.push({ x1: x, y1: y, x2: nx, y2: y });
      x = nx;
      i += 1;
    } else if (cmd === "V") {
      const ny = Number(passos[i + 1]);
      out.push({ x1: x, y1: y, x2: x, y2: ny });
      y = ny;
      i += 1;
    }
  }
  return out;
}

/** Um segmento entra no miolo de um retângulo? A borda não conta. */
function atravessa(
  s: { x1: number; y1: number; x2: number; y2: number },
  r: Retangulo,
): boolean {
  const folga = 2;
  return (
    Math.min(s.x1, s.x2) < r.x + r.w - folga &&
    Math.max(s.x1, s.x2) > r.x + folga &&
    Math.min(s.y1, s.y2) < r.y + r.h - folga &&
    Math.max(s.y1, s.y2) > r.y + folga
  );
}

describe("o caminho de um fio", () => {
  it("para a frente, sai pela direita e entra pela esquerda", () => {
    const d = caminho(caixa("a", 0, 0, 100, 50), caixa("b", 300, 0, 100, 50), 18, []);
    expect(d).toMatch(/^M 100 25 H \d+/u);
    expect(d).toMatch(/H 300$/u);
  });

  /**
   * O teste que existe pelo defeito que ele pegou.
   *
   * A descida saía do centro da origem, corria numa faixa livre e **subia no
   * centro do destino sem conferir nada**. Uma caixa entre os dois, na coluna
   * do destino, era atravessada pelo meio — e uma linha que atravessa uma caixa
   * parece entrar nela: o leitor passa a ver uma ligação que não existe.
   */
  it("descendo, nenhum dos três trechos entra numa caixa alheia", () => {
    const de = caixa("de", 300, 0, 100, 50);
    const para = caixa("para", 0, 400, 200, 60);
    // Bem no meio da coluna do destino, que era por onde a linha subia.
    const estorvo = caixa("estorvo", 60, 150, 120, 80);
    const d = caminho(de, para, 18, [de, para, estorvo]);
    for (const s of segmentos(d)) expect(atravessa(s, estorvo), `${d} × estorvo`).toBe(false);
  });

  it("subindo, também não", () => {
    const de = caixa("de", 0, 400, 200, 60);
    const para = caixa("para", 300, 0, 100, 50);
    const estorvo = caixa("estorvo", 310, 150, 80, 80);
    const d = caminho(de, para, 18, [de, para, estorvo]);
    for (const s of segmentos(d)) expect(atravessa(s, estorvo), `${d} × estorvo`).toBe(false);
  });

  it("sem saída limpa, ainda entrega um caminho — desenhar nada seria pior", () => {
    const de = caixa("de", 300, 0, 100, 50);
    const para = caixa("para", 0, 400, 200, 60);
    // Uma parede entre os dois: não há por onde passar, e o roteador não pode
    // devolver vazio por isso. Ele escolhe o menos ruim e a linha aparece.
    const parede = caixa("parede", -50, 100, 600, 200);
    const d = caminho(de, para, 18, [de, para, parede]);
    expect(d).toMatch(/^M /u);
    expect(segmentos(d).length).toBeGreaterThan(1);
  });

  it("destino atrás da origem vira volta por baixo, e parece uma volta", () => {
    const de = caixa("de", 400, 0, 100, 50);
    const para = caixa("para", 0, 0, 100, 50);
    const d = caminho(de, para, 18, []);
    const trechos = segmentos(d);
    // Desce abaixo das duas caixas antes de voltar: é isso que faz o leitor
    // ler realimentação em vez de uma linha atravessando o desenho.
    expect(Math.max(...trechos.map((s) => Math.max(s.y1, s.y2)))).toBeGreaterThan(50);
    expect(trechos.at(-1)?.y2).toBe(50);
  });

  /**
   * O caso que obrigou o desvio por corredor: origem e destino na mesma
   * altura, com uma terceira caixa exatamente entre eles. Com um cotovelo só
   * não há por onde passar — a linha reta entra na caixa do meio, e o leitor
   * lê uma ligação que não existe.
   */
  it("sem passagem reta, desvia por uma faixa livre entre as fileiras", () => {
    const de = caixa("de", 0, 100, 100, 60);
    const para = caixa("para", 400, 100, 100, 60);
    const meio = caixa("meio", 180, 90, 140, 80);
    const d = caminho(de, para, 18, [de, para, meio]);
    for (const s of segmentos(d)) expect(atravessa(s, meio), `${d} × meio`).toBe(false);
    // E ele chega no destino: desviar não pode virar desistir.
    expect(segmentos(d).at(-1)?.x2).toBe(400);
  });
});
