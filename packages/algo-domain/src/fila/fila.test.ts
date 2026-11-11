import { describe, expect, it } from "vitest";
import { chegadasDe, emOrdem, ErroDaFila, rodarFila, VAGAS, type OpcoesDaFila } from "./fila.js";

const base: OpcoesDaFila = { estrutura: "anel", politica: "recusar", carga: "overload", semente: 3 };

describe("a fila", () => {
  it("nunca passa das vagas, e todo pedido tem destino", () => {
    for (const carga of ["steady", "burst", "overload"] as const) {
      for (const estrutura of ["anel", "vetor"] as const) {
        for (const politica of ["recusar", "expulsar"] as const) {
          const f = rodarFila({ ...base, carga, estrutura, politica });
          expect(Math.max(...f.passos.map((p) => p.tamanho))).toBeLessThanOrEqual(VAGAS);
          expect(f.atendidos + f.perdidos).toBe(f.chegaram);
          expect(f.linhaDoTempo.at(-1)!.tamanho).toBe(0);
        }
      }
    }
  });

  it("a ordem é a da chegada: o primeiro a entrar é o primeiro a sair", () => {
    for (const politica of ["recusar", "expulsar"] as const) {
      const f = rodarFila({ ...base, politica });
      expect(f.ordemAtendida).toEqual([...f.ordemAtendida].sort((a, b) => a - b));
    }
  });

  it("as duas estruturas atendem os mesmos pedidos, e só o preço muda", () => {
    for (const politica of ["recusar", "expulsar"] as const) {
      const anel = rodarFila({ ...base, politica });
      const vetor = rodarFila({ ...base, politica, estrutura: "vetor" });
      expect(vetor.ordemAtendida).toEqual(anel.ordemAtendida);
      expect(vetor.ordemPerdida).toEqual(anel.ordemPerdida);
      expect(vetor.ops).toBeGreaterThan(anel.ops * 3);
    }
  });

  it("o anel custa no máximo duas operações por pedido, mais as de quem foi expulso", () => {
    const f = rodarFila({ ...base, politica: "expulsar" });
    expect(f.ops).toBeLessThanOrEqual(f.chegaram * 2 + f.perdidos);
  });

  it("recusar perde os novos; expulsar perde os velhos", () => {
    const recusa = rodarFila(base);
    const expulsa = rodarFila({ ...base, politica: "expulsar" });
    expect(recusa.perdidos).toBe(expulsa.perdidos);
    // Recusar perde os que chegaram por último; expulsar, os que já esperavam.
    const media = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    expect(media(recusa.ordemPerdida)).toBeGreaterThan(media(expulsa.ordemPerdida));
  });

  it("sobrecarga perde pedidos; a carga constante, não; um atendente mais rápido salva a sobrecarga", () => {
    expect(rodarFila(base).perdidos).toBeGreaterThan(0);
    expect(rodarFila({ ...base, carga: "steady" }).perdidos).toBe(0);
    expect(rodarFila({ ...base, servico: 1, vagas: 8 }).perdidos).toBeLessThan(rodarFila({ ...base, vagas: 8 }).perdidos);
  });

  it("vagas a mais seguram a rajada; na sobrecarga, trocam perda por espera", () => {
    const rajada = (vagas: number) => rodarFila({ ...base, carga: "burst", vagas }).perdidos;
    expect(rajada(4)).toBeGreaterThan(0);
    expect(rajada(32)).toBe(0);
    const pequena = rodarFila(base);
    const grande = rodarFila({ ...base, vagas: 64 });
    expect(grande.perdidos).toBeLessThan(pequena.perdidos);
    expect(grande.maiorEspera).toBeGreaterThan(pequena.maiorEspera * 2);
  });

  it("é semeada: a mesma semente dá as mesmas chegadas", () => {
    expect(chegadasDe("burst", 7)).toEqual(chegadasDe("burst", 7));
    expect(chegadasDe("overload", 7)).not.toEqual(chegadasDe("overload", 8));
  });

  it("a linha do tempo e os passos contam a mesma história", () => {
    const f = rodarFila({ ...base, estrutura: "vetor" });
    const fim = f.linhaDoTempo.at(-1)!;
    expect(fim.ops).toBe(f.ops);
    expect(fim.atendidos).toBe(f.atendidos);
    // No vetor, a cabeça nunca sai da vaga 0.
    expect(f.passos.every((p) => p.cabeca === 0)).toBe(true);
    for (const foto of f.linhaDoTempo) expect(emOrdem(foto.vagas, foto.cabeca, foto.tamanho).every((id) => id >= 0)).toBe(true);
  });

  it("recusa vagas e ritmos impossíveis", () => {
    expect(() => rodarFila({ ...base, vagas: 0 })).toThrow(ErroDaFila);
    expect(() => rodarFila({ ...base, servico: 0.5 })).toThrow(ErroDaFila);
  });
});
