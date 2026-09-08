import { describe, expect, it } from "vitest";
import { baldeDe, BALDES, chaveDaSerie } from "./carga.js";
import type { Requisicao } from "./carga.js";

const req = (over: Partial<Requisicao> = {}): Requisicao => ({
  n: 1,
  rota: "/checkout",
  latencia: 120,
  erro: false,
  usuario: "u1",
  tick: 0,
  ...over,
});

describe("o balde do histograma", () => {
  it("o limite pertence ao balde dele", () => {
    // `≤` e não `<`: é a convenção da spec, e trocá-la moveria uma contagem
    // inteira de balde sem ninguém perceber.
    expect(baldeDe(50)).toBe("≤ 50 ms");
    expect(baldeDe(51)).toBe("≤ 100 ms");
  });

  it("acima do último limite há um balde, e ele é aberto", () => {
    expect(baldeDe(5000)).toBe("> 1000 ms");
  });

  it("todo valor cai em exatamente um balde", () => {
    const baldes = new Set(BALDES.flatMap((b) => [baldeDe(b - 1), baldeDe(b), baldeDe(b + 1)]));
    for (const balde of baldes) expect(balde.length).toBeGreaterThan(0);
    expect(baldeDe(0)).toBe("≤ 50 ms");
  });
});

describe("a chave da série é o conjunto de atributos", () => {
  it("sem o usuário, duas requisições da mesma rota caem na mesma linha", () => {
    expect(chaveDaSerie(req({ n: 1, usuario: "u1" }), false)).toBe(
      chaveDaSerie(req({ n: 2, usuario: "u2" }), false),
    );
  });

  it("com o usuário, cada um abre a sua — e é assim que a conta explode", () => {
    expect(chaveDaSerie(req({ usuario: "u1" }), true)).not.toBe(
      chaveDaSerie(req({ usuario: "u2" }), true),
    );
  });

  it("o erro separa a série, porque status é atributo", () => {
    expect(chaveDaSerie(req({ erro: true }), false)).not.toBe(
      chaveDaSerie(req({ erro: false }), false),
    );
  });
});
