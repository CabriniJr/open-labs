import { describe, expect, it } from "vitest";
import { tuneis } from "./tunel.js";

const deitado = { chave: "a", d: "M 0 50 H 100" };
const emPe = { chave: "b", d: "M 50 0 V 100" };

describe("quem mergulha", () => {
  it("o fio mais estreito passa por baixo do mais largo", () => {
    // O barramento é a linha que o leitor está seguindo; quem some é o magro.
    const achados = tuneis([
      { ...deitado, width: 1 },
      { ...emPe, width: 32 },
    ]);
    expect(achados.map((l) => l.chave)).toEqual(["a"]);
  });

  it("empatados na largura, o em pé mergulha sob o deitado", () => {
    // O olho segue a linha deitada, então ela é a que fica inteira.
    expect(tuneis([deitado, emPe]).map((l) => l.chave)).toEqual(["b"]);
  });

  it("a decisão é a mesma nas duas ordens de entrada", () => {
    const ida = tuneis([{ ...deitado, width: 1 }, { ...emPe, width: 32 }]);
    const volta = tuneis([{ ...emPe, width: 32 }, { ...deitado, width: 1 }]);
    expect(ida.map((l) => `${l.chave}@${l.x},${l.y}`)).toEqual(
      volta.map((l) => `${l.chave}@${l.x},${l.y}`),
    );
  });

  it("empatados em tudo, decide a ordem das chaves", () => {
    // Sem esta terceira regra sobraria caso sem dono, e o desenho mudaria entre
    // dois carregamentos conforme a ordem de renderização.
    const zPrimeiro = tuneis([
      { chave: "z", d: "M 0 50 H 100 V 0" },
      { chave: "y", d: "M 20 0 V 100 H 120" },
    ]);
    const yPrimeiro = tuneis([
      { chave: "y", d: "M 20 0 V 100 H 120" },
      { chave: "z", d: "M 0 50 H 100 V 0" },
    ]);
    expect(zPrimeiro.map((l) => l.chave)).toEqual(yPrimeiro.map((l) => l.chave));
  });
});

describe("a lacuna", () => {
  it("cai sobre o cruzamento, e sabe para que lado ela se abre", () => {
    const [lacuna] = tuneis([deitado, emPe]);
    expect(lacuna).toMatchObject({ chave: "b", x: 50, y: 50, horizontal: false });
    expect(lacuna?.folga).toBeGreaterThan(0);
  });

  it("todo cruzamento fica coberto por alguma lacuna", () => {
    // É o invariante inteiro: cruzamento nu é o defeito que este round mata.
    const fios = [
      { chave: "a", d: "M 0 50 H 200" },
      { chave: "b", d: "M 50 0 V 100" },
      { chave: "c", d: "M 150 0 V 100" },
    ];
    const achados = tuneis(fios);
    expect(achados).toHaveLength(2);
    expect(achados.map((l) => l.y).sort((p, q) => p - q)).toEqual([50, 50]);
  });

  it("dois cruzamentos juntos viram UM túnel, e não dois buracos colados", () => {
    // É o que o belt subterrâneo faz: mergulha antes do primeiro e reaparece
    // depois do último. Duas lacunas coladas se leem como fio picotado.
    // Aqui quem mergulha é o fio magro deitado, sob dois barramentos vizinhos.
    const fios = [
      { chave: "a", d: "M 0 50 H 200", width: 1 },
      { chave: "b", d: "M 50 0 V 100", width: 32 },
      { chave: "c", d: "M 56 0 V 100", width: 32 },
    ];
    const achados = tuneis(fios);
    expect(achados).toHaveLength(1);
    expect(achados[0]?.chave).toBe("a");
    expect(achados[0]?.x).toBe(53);
    expect(achados[0]?.folga).toBeGreaterThan(3);
  });

  it("perto da ponta do trecho, a folga encolhe em vez de invadir a porta", () => {
    // O trecho que mergulha começa dois pontos antes do cruzamento: abrir seis
    // ali comeria a porta em que o fio chega.
    const fios = [
      { chave: "a", d: "M 0 50 H 100" },
      { chave: "b", d: "M 4 48 V 100" },
    ];
    const [lacuna] = tuneis(fios);
    expect(lacuna?.chave).toBe("b");
    expect(lacuna?.folga).toBe(2);
  });
});
