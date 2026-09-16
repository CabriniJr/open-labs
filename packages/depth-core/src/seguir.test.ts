import { describe, expect, it } from "vitest";
import { seguir } from "./seguir.js";
import type { Message, WorldState } from "./model.js";

const mensagem = (data: Record<string, unknown>): Message =>
  ({ kind: "request", weight: 1, data }) as Message;

const estado = (tick: number, voos: readonly { from: string; to: string; data: Record<string, unknown> }[]): WorldState =>
  ({
    tick,
    nodes: {},
    ledger: {},
    substeps: 0,
    substepOf: {},
    settled: {},
    flight: voos.map((v, i) => ({
      id: `${tick}:${i}`,
      message: mensagem(v.data),
      from: v.from,
      port: "out",
      to: v.to,
      sent: tick,
    })),
  }) as unknown as WorldState;

const leitor = {
  chave: (m: Message) => (typeof m.data["n"] === "number" ? `req:${m.data["n"]}` : undefined),
  corpo: (m: Message) => ({ n: m.data["n"], selo: m.data["selo"] }),
};

describe("seguir a carga pelo trajeto", () => {
  it("uma parada por SALTO, e não por tick", () => {
    // A mesma carga aparece no mesmo fio em vários ticks enquanto atravessa.
    // Uma parada por tick encheria o painel de linhas iguais.
    let trajeto = seguir([], estado(1, [{ from: "a", to: "b", data: { n: 7, selo: "x" } }]), "req:7", leitor);
    trajeto = seguir(trajeto, estado(2, [{ from: "a", to: "b", data: { n: 7, selo: "x" } }]), "req:7", leitor);
    expect(trajeto).toHaveLength(1);

    trajeto = seguir(trajeto, estado(3, [{ from: "b", to: "c", data: { n: 7, selo: "y" } }]), "req:7", leitor);
    expect(trajeto).toHaveLength(2);
    expect(trajeto[1]?.de).toBe("b");
  });

  it("cada parada diz o que MUDOU desde a anterior", () => {
    // É o enriquecimento acontecendo, e não uma legenda dizendo que acontece.
    let trajeto = seguir([], estado(1, [{ from: "a", to: "b", data: { n: 7, selo: "aaa" } }]), "req:7", leitor);
    trajeto = seguir(trajeto, estado(2, [{ from: "b", to: "c", data: { n: 7, selo: "bbb" } }]), "req:7", leitor);
    expect(trajeto[0]?.mudou).toEqual([]);
    expect(trajeto[1]?.mudou).toEqual(["selo"]);
  });

  it("carga de outra chave não entra no trajeto", () => {
    const trajeto = seguir([], estado(1, [{ from: "a", to: "b", data: { n: 9, selo: "x" } }]), "req:7", leitor);
    expect(trajeto).toEqual([]);
  });

  it("o cabeçalho que some é uma mudança, e ela aparece", () => {
    // É o caso do lab: um proxy derruba o selo e nada dá erro. O trajeto
    // é o único lugar em que isso é visível como evento.
    let trajeto = seguir([], estado(1, [{ from: "a", to: "b", data: { n: 7, selo: "aaa" } }]), "req:7", leitor);
    trajeto = seguir(trajeto, estado(2, [{ from: "b", to: "c", data: { n: 7 } }]), "req:7", leitor);
    expect(trajeto[1]?.mudou).toContain("selo");
  });
});

describe("produto não é parada", () => {
  it("mensagem que não continua o caminho fica de fora do trajeto", () => {
    // Num lab real, cada serviço exporta um registro à parte: ele é PRODUTO da
    // requisição, e não um passo dela. Misturados, cada parada acusava duas
    // mudanças e o leitor lia ruído no lugar do mecanismo.
    const comProduto = {
      ...leitor,
      noTrajeto: (m: Message) => m.data["selo"] !== undefined || m.data["n"] === 7,
    };
    let trajeto = seguir([], estado(1, [{ from: "a", to: "b", data: { n: 7, selo: "x" } }]), "req:7", comProduto);
    trajeto = seguir(
      trajeto,
      estado(2, [{ from: "b", to: "backend", data: { n: 7, span: "s1" } }]),
      "req:7",
      { ...comProduto, noTrajeto: (m: Message) => m.data["selo"] !== undefined },
    );
    expect(trajeto).toHaveLength(1);
  });
});
