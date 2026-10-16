import { describe, expect, it } from "vitest";
import { ATRIBUTOS_DA_CARDINALIDADE, MAL_ENTENDIDOS_DA_CARDINALIDADE } from "./labels.js";
import { calcular, fatorDeEntrada, pontosPorSerie } from "./modelo.js";
import type { Atributo } from "./modelo.js";

/**
 * O que estes testes cobram é **a tese**, que é uma afirmação sobre aritmética:
 * um atributo não é uma coluna a mais, é uma multiplicação. Se um dia a conta
 * passar a somar, o lab continua rodando bonito e ensina o contrário do que
 * promete — e é aqui que isso cai.
 *
 * Este lab não tem motor, então não há `WorldSpec` para validar nem porta para
 * medir. A trava equivalente é esta suíte: a ADR §9 diz que um lab PhET-like
 * deve o mesmo que qualquer outro, e um teste que caia quando ele para de
 * ensinar é parte do mesmo.
 */

const atrib = (id: string, valores: number): Atributo => ({
  id,
  nome: id,
  valores,
  porque: "",
  fonte: "https://opentelemetry.io/docs/specs/otel/metrics/data-model/",
});

const COM = (ids: readonly string[]): readonly Atributo[] =>
  ATRIBUTOS_DA_CARDINALIDADE.filter((a) => ids.includes(a.id));

describe("a conta é um PRODUTO, e é a tese do lab", () => {
  it("nenhum atributo é uma série, e não zero", () => {
    // Produto vazio é 1, e não é caso de borda: uma métrica sem atributo tem
    // uma série. É o piso de toda a conta.
    expect(calcular([], "counter", 0, 1, 10_000).series).toBe(1);
  });

  it("multiplica, não soma — o número que desfaz o mal-entendido", () => {
    const tres = [atrib("a", 12), atrib("b", 6), atrib("c", 4)];
    expect(calcular(tres, "counter", 0, 1, 10_000_000).series).toBe(288);

    // E o atributo de alta cardinalidade entrando: 288 + 8000 = 8288 é a conta
    // errada; 288 × 8000 é a certa, e são quatro ordens de grandeza de
    // diferença.
    const comCliente = [...tres, atrib("cliente", 8000)];
    const r = calcular(comCliente, "counter", 0, 1, 10_000_000_000);
    expect(r.series).toBe(2_304_000);
    expect(r.series).not.toBe(288 + 8000);
  });

  it("o fator de entrada é o número de valores, e é o que o leitor pergunta", () => {
    // "Se eu adicionar este, quanto piora?" — vezes isto, não mais um.
    expect(fatorDeEntrada(atrib("cliente", 8000))).toBe(8000);
    const antes = calcular(COM(["route", "status"]), "counter", 0, 1, 10_000_000).series;
    const depois = calcular(COM(["route", "status", "customer"]), "counter", 0, 1, 10_000_000)
      .series;
    expect(depois).toBe(antes * fatorDeEntrada(COM(["customer"])[0]!));
  });

  it("os números padrão do lab dão a conta da pergunta da página", () => {
    /*
      A pergunta é "latência por cliente, quanto custa?". Com os três atributos
      da convenção, são 12 × 6 × 4 = 288 séries. Com `enduser.id`, 288 × 8000.

      O número está escrito aqui de propósito: se alguém mexer nas contagens dos
      atributos, este teste cai e obriga a reler a prosa da página, que cita a
      ordem de grandeza.
    */
    expect(calcular(COM(["route", "status", "method"]), "counter", 0, 1, 1e12).series).toBe(288);
    expect(
      calcular(COM(["route", "status", "method", "customer"]), "counter", 0, 1, 1e12).series,
    ).toBe(2_304_000);
  });
});

describe("o histograma é caro antes de qualquer atributo", () => {
  it("contador e medidor publicam um ponto; histograma publica um por balde mais dois", () => {
    expect(pontosPorSerie("counter", 11)).toBe(1);
    expect(pontosPorSerie("gauge", 11)).toBe(1);
    // Os dois a mais são soma e contagem, que a spec exige — sem elas o
    // histograma não responde "qual a média".
    expect(pontosPorSerie("histogram", 11)).toBe(13);
  });

  it("um balde é o piso: histograma com zero balde ainda publica soma e contagem", () => {
    expect(pontosPorSerie("histogram", 0)).toBe(3);
  });

  it("com os baldes padrão, o histograma é mais de dez vezes o contador", () => {
    const atributos = COM(["route", "status", "method"]);
    const contador = calcular(atributos, "counter", 11, 4, 1e12);
    const histograma = calcular(atributos, "histogram", 11, 4, 1e12);
    expect(histograma.pontosPorMinuto / contador.pontosPorMinuto).toBeGreaterThan(10);
  });
});

describe("o limite tampa o número e destrói a quebra", () => {
  it("abaixo do limite, nada colapsa", () => {
    const r = calcular(COM(["route", "status"]), "counter", 0, 1, 10_000);
    expect(r.estourouOLimite).toBe(false);
    expect(r.semQuebra).toBe(0);
    expect(r.seriesEfetivas).toBe(r.series);
  });

  it("acima do limite, o volume PARA de crescer e a quebra se perde", () => {
    /*
      É a parte contraintuitiva, e a razão de o lab existir com o limite dentro:
      o limite protege a fatura e não protege a resposta. Quem adicionou o
      atributo paga a instrumentação e não recebe a quebra.
    */
    const comLimite = calcular(COM(["route", "status", "method", "customer"]), "counter", 0, 1, 2000);
    expect(comLimite.estourouOLimite).toBe(true);
    expect(comLimite.seriesEfetivas).toBe(2000);
    expect(comLimite.semQuebra).toBe(2_304_000 - 2000);
    // O volume é o do limite, e não o do produto: a conta para de subir.
    expect(comLimite.pontosPorMinuto).toBe(2000);
  });

  it("o limite nunca é menor que um", () => {
    // Zero séries não é um estado possível: há sempre a de overflow.
    expect(calcular(COM(["customer"]), "counter", 0, 1, 0).seriesEfetivas).toBe(1);
  });
});

describe("o volume é derivado, e o preço nunca é afirmado", () => {
  it("pontos por minuto é séries × pontos por série × exportações por minuto", () => {
    const r = calcular(COM(["route", "status"]), "histogram", 11, 4, 10_000_000);
    expect(r.series).toBe(72);
    expect(r.pontosPorSerie).toBe(13);
    expect(r.pontosPorMinuto).toBe(72 * 13 * 4);
  });

  it("o modelo não tem preço nenhum em lugar nenhum", () => {
    /*
      A ADR §9 nomeia o defeito mais caro do projeto: um lab PhET-like desenhado
      à mão afirmando o que nenhum modelo sustenta. Preço de fornecedor é
      exatamente isso — cada um cobra por unidade diferente.

      Este teste é a trava: o módulo calcula VOLUME, que é mecânico, e o preço é
      campo que o leitor preenche com a fatura dele. Um `custo` ou `preco`
      aparecendo na `Conta` quer dizer que alguém inventou um número.
    */
    const r = calcular(COM(["route"]), "counter", 0, 1, 10_000);
    expect(Object.keys(r).some((k) => /pre[cç]o|custo|cost|price|usd|\$/iu.test(k))).toBe(false);
  });
});

describe("as afirmações do lab têm âncora", () => {
  it("todo atributo e todo mal-entendido cita a spec", () => {
    for (const a of ATRIBUTOS_DA_CARDINALIDADE) {
      expect(a.fonte, a.id).toMatch(/^https:\/\/opentelemetry\.io\//u);
      expect(a.valores, a.id).toBeGreaterThan(0);
    }
    for (const m of MAL_ENTENDIDOS_DA_CARDINALIDADE) {
      expect(m.fonte, m.crenca).toMatch(/^https:\/\/opentelemetry\.io\//u);
    }
  });

  it("os três da convenção semântica estão marcados, e são os três primeiros", () => {
    // A ordem é pedagógica: de cima para baixo é ver a conta sair de controle.
    const daConvencao = ATRIBUTOS_DA_CARDINALIDADE.filter((a) => a.daConvencao === true);
    expect(daConvencao).toHaveLength(3);
    expect(ATRIBUTOS_DA_CARDINALIDADE.slice(0, 3)).toEqual(daConvencao);
  });

  it("todo id é único: a tela indexa a seleção por ele", () => {
    const ids = ATRIBUTOS_DA_CARDINALIDADE.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
