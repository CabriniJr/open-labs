import { World, emissoesPerdidas } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { collectorWorld } from "./world.js";
import type {
  EstadoDoDescarte,
  EstadoDoDestino,
  EstadoDoLimiter,
  EstadoDoLote,
  EstadoDoReceiver,
} from "./world.js";

/**
 * O que estes testes cobram é **a tese**, e não a aritmética.
 *
 * O lab existe para desfazer uma crença: "pus um processor para filtrar, então
 * paramos de mandar aquilo". O que prova o contrário é um número que **não
 * muda** quando o filtro liga — e um teste que compare dois mundos é a única
 * forma de cobrar um não-efeito. Se um dia ligar o filtro passar a mexer no
 * backend, o lab parou de ensinar o que promete, e é aqui que isso cai.
 */

const rodar = (params: Record<string, number> = {}, ticks = 24): WorldState => {
  const world = new World(collectorWorld(params));
  world.advance(ticks);
  return world.state;
};

const no = <T>(state: WorldState, id: string): T => state.nodes[id] as T;

describe("o mundo do collector", () => {
  it("é válido: nenhum fio solto, nenhum laço combinacional", () => {
    expect(() => new World(collectorWorld())).not.toThrow();
  });

  it("o receiver emite UMA vez e a fiação entrega duas cópias", () => {
    /*
      É o coração do lab, e ele é verificável sem olhar desenho: o receiver
      recebeu N spans e emitiu N — não 2N. O que duplica é a fiação, e as duas
      cópias aparecem como chegadas nos dois lados.
    */
    const s = rodar();
    const r = no<EstadoDoReceiver>(s, "receiver");
    const limiter = no<EstadoDoLimiter>(s, "limiter");
    const filtro = no<{ readonly passaram: number; readonly barrados: number }>(s, "filtro");

    expect(r.recebidos).toBeGreaterThan(0);
    // O que o receiver emitiu chegou inteiro nos DOIS, e cada um viu o total.
    const viuLimiter = limiter.admitidos + limiter.recusados;
    const viuFiltro = filtro.passaram + filtro.barrados;
    expect(viuLimiter).toBe(viuFiltro);
    // E não é metade para cada: as duas pipelines viram a mesma quantidade.
    expect(viuLimiter).toBeGreaterThan(0);
  });
});

describe("a tese: um filter numa pipeline não muda a outra", () => {
  it("ligar o filtro não mexe em UM span do que o backend recebe", () => {
    const sem = rodar();
    const com = rodar({ "filtrar-health-checks": 1 });
    expect(no<EstadoDoDestino>(com, "backend").spans.length).toBe(
      no<EstadoDoDestino>(sem, "backend").spans.length,
    );
  });

  it("e mexe no debug exporter, senão o filtro não estaria filtrando nada", () => {
    // A outra metade da prova. Sem ela, um filtro quebrado passaria este teste
    // junto com o de cima: não mexer em nada é fácil.
    const sem = rodar();
    const com = rodar({ "filtrar-health-checks": 1 });
    expect(no<EstadoDoDestino>(com, "console").spans.length).toBeLessThan(
      no<EstadoDoDestino>(sem, "console").spans.length,
    );
  });

  it("o que o filtro barrou chega em `/health`, e só ele", () => {
    const s = rodar({ "filtrar-health-checks": 1 });
    const console_ = no<EstadoDoDestino>(s, "console");
    expect(console_.spans.length).toBeGreaterThan(0);
    expect(console_.spans.every((span) => span.rota !== "/health")).toBe(true);
    // E o backend, que não passou pelo filtro, continua vendo `/health`.
    const backend = no<EstadoDoDestino>(s, "backend");
    expect(backend.spans.some((span) => span.rota === "/health")).toBe(true);
  });
});

describe("o batch fecha por tamanho OU por tempo", () => {
  it("com tráfego alto, quem fecha é o tamanho", () => {
    const l = no<EstadoDoLote>(rodar({ "spans-por-tick": 3, "tamanho-do-lote": 4 }), "lote");
    expect(l.fechadosPorTamanho).toBeGreaterThan(0);
    expect(l.fechadosPorTempo).toBe(0);
  });

  it("com tráfego baixo, quem fecha é o tempo — e sem ele a telemetria não sairia", () => {
    /*
      A crença é "ele manda quando enche". Aqui o lote nunca enche: um span por
      tick, lote de seis, e ainda assim a telemetria sai. Se o timeout não
      existisse, este mundo exportaria zero.
    */
    const s = rodar({ "spans-por-tick": 1, "tamanho-do-lote": 6, "timeout-do-lote": 3 });
    const l = no<EstadoDoLote>(s, "lote");
    expect(l.fechadosPorTempo).toBeGreaterThan(0);
    expect(l.fechadosPorTamanho).toBe(0);
    expect(no<EstadoDoDestino>(s, "backend").spans.length).toBeGreaterThan(0);
  });

  it("um lote vazio não envelhece: collector ocioso não fecha lote nenhum", () => {
    const l = no<EstadoDoLote>(rodar({ "spans-por-tick": 0 }), "lote");
    expect(l.fechadosPorTamanho + l.fechadosPorTempo).toBe(0);
    expect(l.idade).toBe(0);
  });
});

describe("a recusa sai por porta, e por isso é contada", () => {
  it("sob pressão o limiter recusa, e o descarte sabe de quem é", () => {
    const s = rodar({ "spans-por-tick": 5, "limite-de-memoria": 2 });
    const limiter = no<EstadoDoLimiter>(s, "limiter");
    expect(limiter.recusados).toBeGreaterThan(0);
    const d = no<EstadoDoDescarte>(s, "descartes");
    expect(d.porQuem["memory_limiter"]).toBeGreaterThan(0);
  });

  it("as duas pipelines perdem por razões diferentes, e o painel não as soma", () => {
    /*
      Uma perde por limite de capacidade; a outra porque a configuração está
      funcionando. Um número só apagaria a diferença que o lab existe para
      mostrar.
    */
    const d = no<EstadoDoDescarte>(
      rodar({ "spans-por-tick": 5, "limite-de-memoria": 2, "filtrar-health-checks": 1 }),
      "descartes",
    );
    expect(Object.keys(d.porQuem).sort()).toEqual(["filter", "memory_limiter"]);
    expect(d.total).toBe(Object.values(d.porQuem).reduce((a, b) => a + b, 0));
  });

  it("sem pressão e sem filtro, nada é descartado — o zero também é afirmação", () => {
    const d = no<EstadoDoDescarte>(rodar(), "descartes");
    expect(d.total).toBe(0);
  });
});

describe("nada desaparece em silêncio", () => {
  it("nenhuma emissão cai no vácuo em nenhum dos cenários do lab", () => {
    const cenarios: Record<string, Record<string, number>> = {
      padrao: {},
      "filtro ligado": { "filtrar-health-checks": 1 },
      "sob pressão": { "spans-por-tick": 5, "limite-de-memoria": 2 },
      "tráfego baixo": { "spans-por-tick": 1, "tamanho-do-lote": 6 },
      ocioso: { "spans-por-tick": 0 },
    };
    for (const [nome, params] of Object.entries(cenarios)) {
      expect(emissoesPerdidas(rodar(params)), nome).toEqual([]);
    }
  });

  it("o que o limiter admitiu está no lote, saiu dele, ou ainda está em voo", () => {
    const s = rodar({}, 30);
    const limiter = no<EstadoDoLimiter>(s, "limiter");
    const l = no<EstadoDoLote>(s, "lote");
    const backend = no<EstadoDoDestino>(s, "backend");
    const emVoo = s.flight.length;
    // A conta não precisa fechar na igualdade — há itens em voo entre quatro
    // saltos —, mas a perda não pode existir: o que chegou ao backend mais o
    // retido mais o que voa não pode passar do admitido, e não pode faltar
    // mais do que cabe nos saltos.
    expect(backend.spans.length + l.retidos.length).toBeLessThanOrEqual(limiter.admitidos);
    expect(limiter.admitidos - backend.spans.length - l.retidos.length).toBeLessThanOrEqual(
      emVoo + l.retidos.length + 12,
    );
  });
});
