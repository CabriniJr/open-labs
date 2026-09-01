import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { WorldState } from "@ovh/depth-core";
import { envelopesDe } from "./envelope.js";
import { estadoOtel } from "./estado.js";
import { otelWorld, type OpcoesDoMundo } from "./world.js";

/**
 * Os cinco fenômenos da §5 da spec de desenho, como teste.
 *
 * A régua do projeto é *"a decisão aparece?"*, e a régua dura é **fenômeno que
 * precisou de roteiro deve ser zero**: nenhum dos cinco abaixo é encenado. Todos
 * são `otelWorld` mais um parâmetro, e o número sai do livro-caixa.
 */

const rodar = (ticks: number, opcoes: OpcoesDoMundo = {}): WorldState => {
  const w = new World(otelWorld(opcoes));
  w.advance(ticks);
  return w.state;
};

describe("F1 — o provider é onde o recurso é estampado", () => {
  it("dois providers no mesmo processo produzem dois recursos, e NADA falha", () => {
    const mundo = new World(otelWorld({ segundoProvider: true, params: { "scheduled-delay": 3 } }));
    const recursos = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      mundo.advance(1);
      for (const emVoo of envelopesDe(mundo.state)) {
        for (const rs of emVoo.envelope.resourceSpans) {
          recursos.add(JSON.stringify(rs.resource.attributes));
        }
      }
    }
    expect(recursos.size).toBe(2);
    // Nenhum descarte, nenhuma porta sem fio: o processo roda perfeitamente bem
    // com dois recursos, e é justamente por isso que ninguém percebe.
    const e = estadoOtel(mundo.state);
    expect(e.descartadosPelaFila).toBe(0);
    expect(e.exportados).toBeGreaterThan(0);
  });
});

describe("F2 — amostrar não é uma coisa, são três", () => {
  it("a porta do meio acende: o processador recebe, e o exportador não vê nada", () => {
    // O processo para no tick 25 e o mundo anda até 30: a conta só fecha quando
    // nada está mais em voo. Travessia custa tick, e o teste tem de saber.
    const s = rodar(30, {
      params: { "sampling-ratio": 0, "record-only": 1, "scheduled-delay": 3, "shutdown-at": 25 },
    });
    const e = estadoOtel(s);

    expect(e.gravadosSemSair).toBeGreaterThan(0);
    expect(e.descartadosPeloSampler).toBe(0);

    // Chegou no processador...
    expect(e.entraramNaFila).toBe(e.gravadosSemSair);
    // ...e não passou dali. A recusa tem porta própria e não se confunde com
    // fila cheia: são dois motivos diferentes de o span não sair.
    expect(e.recusadosPorNaoAmostrado).toBe(e.gravadosSemSair);
    expect(e.descartadosPelaFila).toBe(0);
    expect(e.exportados).toBe(0);
    expect(e.recebidosPeloCollector).toBe(0);
  });

  it("com o decorador desligado, a mesma razão zero vira descarte — e o processador nem vê", () => {
    const e = estadoOtel(rodar(30, { params: { "sampling-ratio": 0, "scheduled-delay": 3 } }));
    expect(e.descartadosPeloSampler).toBeGreaterThan(0);
    expect(e.gravadosSemSair).toBe(0);
    expect(e.entraramNaFila).toBe(0);
  });
});

describe("F3 — a morte do processo é um evento do provider", () => {
  const PRAZO_LONGO = { "scheduled-delay": 50, "shutdown-at": 20 };

  it("sem flush, o conteúdo da fila morre com o processo", () => {
    const e = estadoOtel(rodar(30, { params: { ...PRAZO_LONGO, "force-flush": 0 } }));
    expect(e.naFila).toBe(20);
    expect(e.recebidosPeloCollector).toBe(0);
    expect(e.flushesRecebidos).toBe(0);
  });

  it("com ForceFlush, a linha de controle desce e o lote sai antes do fim", () => {
    const e = estadoOtel(rodar(30, { params: { ...PRAZO_LONGO, "force-flush": 1 } }));
    // Quase tudo sai — e o "quase" é conteúdo, não folga de teste. O ForceFlush
    // esvazia a FILA; o span que ainda estava atravessando a aresta entre o
    // amostrador e ela não estava na fila, e não é esvaziado. É a mesma razão
    // pela qual o flush não é garantia de zero perda num processo que morre.
    expect(e.recebidosPeloCollector).toBeGreaterThanOrEqual(18);
    expect(e.naFila).toBeLessThanOrEqual(2);
    // O cascateamento: a spec manda invocar ForceFlush em TODOS os processadores
    // registrados, e o do lote continua a descida até o exportador.
    expect(e.flushesRecebidos).toBeGreaterThan(0);
  });

  it("é o mesmo run com um parâmetro trocado — não são dois modelos", () => {
    const sem = otelWorld({ params: { ...PRAZO_LONGO, "force-flush": 0 } });
    const com = otelWorld({ params: { ...PRAZO_LONGO, "force-flush": 1 } });
    expect(sem.seed).toBe(com.seed);
    expect(sem.wires.length).toBe(com.wires.length);
  });
});

describe("F4 — os três provedores não são simétricos, e a assimetria é a lição", () => {
  it("com os padrões da spec, os traces saem doze vezes mais que as métricas", () => {
    // 5 000 ms contra 60 000 ms. O 12 é o número da spec, e não um número
    // escolhido para a demonstração: ele é `exportInterval / scheduledDelay`.
    const spec = otelWorld();
    const prazo = spec.params["scheduled-delay"] ?? 0;
    const intervalo = spec.params["export-interval"] ?? 0;
    expect(intervalo / prazo).toBe(12);

    // A razão é medida nos DOIS SEQUENCIADORES, no livro-caixa — quem empurra e
    // quem pede. Medi-la na chegada ao exportador mediria o atraso de travessia
    // junto, e a conta sairia de 12 sem nada estar errado.
    const e = estadoOtel(rodar(240, {}));
    expect(e.pedidosDoLeitor).toBe(4);
    expect(e.disparosDoLote).toBe(48);
    expect(e.disparosDoLote / e.pedidosDoLeitor).toBe(12);
  });

  it("no limite, a fila RECUSA e o banco COLAPSA — mesmo problema, duas mentiras", () => {
    const apertado = { "max-queue-size": 3, "cardinality-limit": 3, "scheduled-delay": 10_000 };
    const e = estadoOtel(rodar(60, { params: { ...apertado, "spans-per-tick": 2 } }));

    // A fila perde: o que ela recusou não está em lugar nenhum.
    expect(e.descartadosPelaFila).toBeGreaterThan(0);
    expect(e.naFila).toBe(3);

    // O banco não perde: colapsa. A soma continua fechando com o que entrou.
    expect(e.colapsados).toBeGreaterThan(0);
    expect(e.pontos.some((p) => p.overflow)).toBe(true);
    expect(e.pontos.length).toBe(3);
  });

  it("os logs não têm amostrador nenhum — a ausência é conteúdo", () => {
    const arvore = otelWorld();
    const doLogger = arvore.wires.filter((w) => w.from === "log-queue" && w.port === "unsampled");
    expect(doLogger).toEqual([]);
  });
});

describe("F5 — sem SDK, silêncio", () => {
  it("nenhum erro, nenhum aviso: o contador do no-op sobe e o collector recebe zero", () => {
    const e = estadoOtel(rodar(30, { semSdk: true, params: { "shutdown-at": 25 } }));
    expect(e.criados).toBe(25);
    expect(e.engolidosPeloNoop).toBe(25);
    expect(e.exportados).toBe(0);
    expect(e.recebidosPeloCollector).toBe(0);
    expect(e.envelopes).toBe(0);
  });

  it("o silêncio tem número: sem o contador, 'nada aconteceu' e 'nada apareceu' seriam o mesmo", () => {
    const parado = estadoOtel(rodar(30, { semSdk: true, params: { "spans-per-tick": 0 } }));
    const rodando = estadoOtel(rodar(30, { semSdk: true }));
    expect(parado.engolidosPeloNoop).toBe(0);
    expect(rodando.engolidosPeloNoop).toBeGreaterThan(0);
    // Os dois exportam zero. É o contador que os separa.
    expect(parado.exportados).toBe(rodando.exportados);
  });
});

describe("D5 — a linha que cruza a fronteira de um provider", () => {
  it("baixar a amostragem de traces APAGA logs, e quase ninguém liga as duas coisas", () => {
    const comum = { "trace-based": 1, "log-scheduled-delay": 3, "scheduled-delay": 3 };
    const tudo = estadoOtel(rodar(40, { params: { ...comum, "sampling-ratio": 1 } }));
    const nada = estadoOtel(rodar(40, { params: { ...comum, "sampling-ratio": 0 } }));

    expect(tudo.logsBarradosPeloTrace).toBe(0);
    expect(nada.logsBarradosPeloTrace).toBeGreaterThan(0);
    expect(nada.logsExportados).toBeLessThan(tudo.logsExportados);
  });

  it("com trace_based desligado — o padrão da spec — os logs saem de qualquer jeito", () => {
    const e = estadoOtel(rodar(40, { params: { "sampling-ratio": 0, "log-scheduled-delay": 3 } }));
    expect(e.logsBarradosPeloTrace).toBe(0);
    expect(e.logsExportados).toBeGreaterThan(0);
  });
});
