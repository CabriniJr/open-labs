import { describe, expect, it } from "vitest";
import { cruzamentos, juncoes, meada, segmentos } from "./espaguete.js";

describe("ler os cotovelos de um caminho", () => {
  it("quebra M/H/V nos trechos que eles desenham", () => {
    expect(segmentos("M 0 10 H 50 V 40 H 100")).toEqual([
      { x1: 0, y1: 10, x2: 50, y2: 10 },
      { x1: 50, y1: 10, x2: 50, y2: 40 },
      { x1: 50, y1: 40, x2: 100, y2: 40 },
    ]);
  });

  it("trecho de comprimento zero não é trecho", () => {
    expect(segmentos("M 0 0 H 0 V 0")).toEqual([]);
  });
});

describe("contar o espaguete", () => {
  it("um deitado e um em pé se atravessando é um cruzamento", () => {
    expect(meada(["M 0 10 H 100", "M 50 0 V 40"])).toEqual({
      cruzamentos: 1,
      sobreposicoes: 0,
    });
  });

  it("encostar na ponta não é cruzar — é assim que um fio chega na porta", () => {
    // O vertical começa exatamente sobre o horizontal: é um T, não um X.
    expect(meada(["M 0 10 H 100", "M 50 10 V 40"]).cruzamentos).toBe(0);
  });

  it("dois fios por cima um do outro é sobreposição, e é pior que cruzar", () => {
    // Desenhados assim, o leitor vê UMA ligação onde existem duas.
    expect(meada(["M 0 10 H 100", "M 20 10 H 80"])).toEqual({
      cruzamentos: 0,
      sobreposicoes: 1,
    });
  });

  it("fio consigo mesmo nunca conta", () => {
    // Um caminho que volta sobre si é um cotovelo, não uma meada.
    expect(meada(["M 0 0 H 50 V 20 H 0 V 0"])).toEqual({
      cruzamentos: 0,
      sobreposicoes: 0,
    });
  });

  it("paralelas próximas não são sobreposição: elas se leem como duas", () => {
    expect(meada(["M 0 10 H 100", "M 0 14 H 100"]).sobreposicoes).toBe(0);
  });

  it("roçar numa quina não é sobreposição, e um trecho longo é", () => {
    // Dois pixels em comum não fazem ninguém ler uma linha onde há duas; o
    // limiar existe para a medida não acusar o que não é defeito.
    expect(meada(["M 0 10 H 50", "M 48 10 H 120"]).sobreposicoes).toBe(0);
    expect(meada(["M 0 10 H 50", "M 20 10 H 120"]).sobreposicoes).toBe(1);
  });
});

describe("onde o desenho marca junção", () => {
  it("o T ganha ponto: a ponta de um fio cai no meio do outro", () => {
    expect(juncoes(["M 0 10 H 100", "M 50 10 V 40"])).toEqual([{ x: 50, y: 10 }]);
  });

  it("o X não ganha ponto, e é a ausência dele que diz que não se falam", () => {
    expect(juncoes(["M 0 10 H 100", "M 50 0 V 40"])).toEqual([]);
  });

  it("duas pontas no mesmo lugar não é junção: é o encontro numa porta", () => {
    // A porta já está desenhada ali; um ponto por cima dela não diz nada novo.
    expect(juncoes(["M 0 10 H 50", "M 50 10 H 100"])).toEqual([]);
  });

  it("um leque de três dá um ponto por derivação, e não três no mesmo lugar", () => {
    const leque = ["M 0 10 H 100", "M 0 10 H 40 V 60", "M 0 10 H 70 V 60"];
    expect(juncoes(leque)).toEqual([
      { x: 40, y: 10 },
      { x: 70, y: 10 },
    ]);
  });
});

describe("onde os fios se cruzam", () => {
  it("devolve o ponto, e diz quem é quem", () => {
    // Um deitado em y=50 indo de x=0 a x=100; um em pé em x=50 indo de y=0 a y=100.
    const deitado = "M 0 50 H 100";
    const emPe = "M 50 0 V 100";
    const achados = cruzamentos([deitado, emPe]);
    expect(achados).toHaveLength(1);
    expect(achados[0]).toMatchObject({ x: 50, y: 50, a: 0, b: 1 });
  });

  it("a contagem é a mesma que a meada já dava", () => {
    // Duas fontes para o mesmo fato discordariam no dia em que uma piorasse.
    const fios = ["M 0 50 H 100", "M 50 0 V 100", "M 20 0 V 100"];
    expect(cruzamentos(fios)).toHaveLength(meada(fios).cruzamentos);
  });

  it("encostar na ponta não é cruzamento", () => {
    // É assim que um fio chega numa porta, e acusar isso condenaria todo
    // desenho correto.
    expect(cruzamentos(["M 0 50 H 100", "M 100 50 V 100"])).toEqual([]);
  });

  it("diz por qual trecho cada fio passou ali", () => {
    // A boca precisa saber se o trecho que mergulha está deitado ou em pé.
    const achados = cruzamentos(["M 0 50 H 100", "M 50 0 V 100"]);
    expect(achados[0]?.horizontalA).toBe(true);
    expect(achados[0]?.horizontalB).toBe(false);
  });
});
