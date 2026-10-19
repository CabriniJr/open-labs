// packages/splunk-domain/src/baldes/world.test.ts
//
// A tese do lab: até onde dá para pesquisar é uma propriedade EMERGENTE, e o
// número não está em nenhum arquivo de configuração.
//
// Estes testes são a tese. Se um dia a janela passar a ser igual à retenção
// configurada, ou a parar de reagir ao volume, o lab passou a ensinar o que
// todo mundo já acredita — que retenção é um número que se escolhe.
import { World } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { estadoDosBaldes, type EstadoDosBaldes } from "./estado.js";
import { baldesWorld, PARAMS_DOS_BALDES, diasPorTick, mbPorTick } from "./world.js";

/** Um run longo o bastante para o índice chegar ao regime permanente. */
function rodar(params: Readonly<Record<string, number>> = {}, ticks = 300): EstadoDosBaldes {
  const world = new World(baldesWorld(params));
  world.advance(ticks);
  return estadoDosBaldes(world.state, { ...PARAMS_DOS_BALDES, ...params });
}

describe("a janela de busca é emergente, e não configurada", () => {
  it("com os defaults de verdade, a retenção efetiva é 26 dias e a configurada é 2 184", () => {
    const e = rodar();
    expect(e.retencaoEmDias).toBe(2184);
    expect(e.janelaEmDias).toBe(26);
    // E a razão é o tamanho, não a idade: nada envelheceu seis anos.
    expect(e.porIdade).toBe(0);
    expect(e.porTamanho).toBeGreaterThan(0);
  });

  it("a janela é inversamente proporcional ao volume, e nada na configuração muda", () => {
    const base = rodar();
    const dobro = rodar({ "gb-por-dia": 40 });
    const dez = rodar({ "gb-por-dia": 200 });

    expect(base.retencaoEmDias).toBe(dobro.retencaoEmDias);
    expect(base.retencaoEmDias).toBe(dez.retencaoEmDias);

    // Dobrar o volume corta a janela pela metade, com um balde de folga: o
    // corte acontece em múltiplos de `maxDataSize`.
    expect(dobro.janelaEmDias).toBe(13);
    expect(dez.janelaEmDias).toBe(3);
  });

  it("aumentar o limite de tamanho aumenta a janela — é a alavanca certa", () => {
    const pequeno = rodar({ "max-total-gb": 200 });
    const grande = rodar({ "max-total-gb": 500 });
    expect(pequeno.janelaEmDias ?? 0).toBeLessThan(grande.janelaEmDias ?? 0);
  });

  it("enquanto nada congelou, a janela NÃO é reportada", () => {
    // Dizer "você tem 3 dias" quando nada foi apagado inverteria a leitura: o
    // lab estaria reportando o tempo que ele está rodando como se fosse um
    // limite do sistema.
    const e = rodar({ "max-total-gb": 500000, "retencao-dias": 999999 }, 60);
    expect(e.congelados).toBe(0);
    expect(e.janelaEmDias).toBeUndefined();
  });
});

describe("os dois caminhos para congelado, e vale o que vier primeiro", () => {
  it("retenção curta congela por IDADE, e aí a janela se aproxima do configurado", () => {
    const e = rodar({ "retencao-dias": 10 }, 200);
    expect(e.porIdade).toBeGreaterThan(0);
    expect(e.porTamanho).toBe(0);
    // Um pouco MAIS longa que o configurado, e não igual: a idade é por balde,
    // e um evento recente segura o balde inteiro.
    expect(e.janelaEmDias ?? 0).toBeGreaterThanOrEqual(10);
    expect(e.janelaEmDias ?? 0).toBeLessThanOrEqual(12);
  });

  it("com retenção longa e disco pequeno, congela por TAMANHO — o caso que surpreende", () => {
    // `max-warm` cai junto, senão a configuração fica incoerente: o morno
    // sozinho caberia mais que o índice inteiro. Ver o teste abaixo.
    const e = rodar({ "retencao-dias": 2184, "max-total-gb": 60, "max-warm": 40 });
    expect(e.configuracaoIncoerente).toBe(false);
    expect(e.porTamanho).toBeGreaterThan(0);
    expect(e.porIdade).toBe(0);
    /*
      60 GB a 20 GB por dia dão três dias de conta, e a medida dá quatro. A
      diferença é granularidade, e ela é do Splunk também: o que sai do índice é
      um balde inteiro de 750 MB, o tick vale meio dia, e um balde fica em
      trânsito. A janela real é sempre um pouco maior que a divisão — nunca
      menor —, e o que importa é a ordem de grandeza contra os 2 184 dias
      configurados.
    */
    expect(e.janelaEmDias ?? 0).toBeGreaterThanOrEqual(3);
    expect(e.janelaEmDias ?? 0).toBeLessThanOrEqual(4);
  });
});

describe("a região em que este modelo não vale, e ele diz qual é", () => {
  /*
    O teste que achou isto pediu 60 GB de índice com os 300 baldes mornos do
    default — e o morno sozinho cabe 225 GB. O Splunk resolve congelando o mais
    velho do ÍNDICE, que ali seria um balde morno; este modelo só congela no
    frio, porque um nó do motor conhece apenas o próprio estado.

    Modelar errado em silêncio uma região inteira de configuração seria o pior
    defeito possível aqui. Medi-la e nomeá-la na tela é o que a página faz.
  */
  it("com os defaults de verdade, a configuração é coerente", () => {
    expect(rodar({}, 10).configuracaoIncoerente).toBe(false);
    // 300 × 750 MB = 225 GB, contra 500 GB de índice.
    expect((PARAMS_DOS_BALDES["max-warm"] ?? 0) * (PARAMS_DOS_BALDES["max-data-size-mb"] ?? 0)).
      toBeLessThan((PARAMS_DOS_BALDES["max-total-gb"] ?? 0) * 1024);
  });

  it("baixar o índice abaixo do que o morno cabe é marcado como incoerente", () => {
    expect(rodar({ "max-total-gb": 60 }, 10).configuracaoIncoerente).toBe(true);
    expect(rodar({ "max-total-gb": 60, "max-warm": 40 }, 10).configuracaoIncoerente).toBe(false);
  });
});

describe("congelar é remover, e arquivar é uma linha que ninguém é obrigado a escrever", () => {
  it("sem `coldToFrozenDir`, todo balde congelado é APAGADO", () => {
    const e = rodar();
    expect(e.congelados).toBeGreaterThan(0);
    expect(e.apagados).toBe(e.congelados);
    expect(e.arquivados).toBe(0);
  });

  it("com ele, o mesmo run arquiva em vez de apagar", () => {
    const e = rodar({ arquivar: 1 });
    expect(e.congelados).toBeGreaterThan(0);
    expect(e.arquivados).toBe(e.congelados);
    expect(e.apagados).toBe(0);
  });

  it("a escolha não muda QUANTO congela — só o destino", () => {
    // É o que a torna invisível: nenhum contador de volume, de disco ou de
    // ingestão se mexe quando o arquivo não existe.
    const sem = rodar();
    const com = rodar({ arquivar: 1 });
    expect(com.congelados).toBe(sem.congelados);
    expect(com.mbCongelado).toBe(sem.mbCongelado);
  });
});

describe("a escada de estados", () => {
  it("o balde quente fecha em `maxDataSize`, e os mornos são contados", () => {
    const e = rodar({}, 50);
    expect(e.baldesFechados).toBeGreaterThan(0);
    expect(e.mornos).toBe(300);
    // O morno é limite de CONTAGEM: 300 baldes de 750 MB são 225 GB.
    expect(Math.round(e.mbMorno / 1024)).toBe(Math.round((300 * 750) / 1024));
  });

  it("o nível morno nunca passa de `maxWarmDBCount`", () => {
    for (const maximo of [4, 30, 300]) {
      const e = rodar({ "max-warm": maximo }, 120);
      expect(e.mornos, `com max-warm=${maximo}`).toBeLessThanOrEqual(maximo);
    }
  });

  it("mudar o tamanho do balde não muda o quanto cabe no índice", () => {
    /*
      `maxDataSize` é a granularidade do que rola, não o tamanho do índice. É a
      confusão mais comum entre os quatro limites, e o modelo tem de discordar
      dela: com baldes de 250 MB e de 750 MB, o disco ocupado tem de ser o
      mesmo, e só o número de baldes muda.
    */
    const pequeno = rodar({ "max-data-size-mb": 250, "max-warm": 900 });
    const grande = rodar({ "max-data-size-mb": 750, "max-warm": 300 });
    const gb = (mb: number) => Math.round(mb / 1024 / 10) * 10;
    expect(gb(pequeno.mbNoDisco)).toBe(gb(grande.mbNoDisco));
  });

  it("sem volume, nada enche e nada congela", () => {
    const e = rodar({ "gb-por-dia": 0 }, 100);
    expect(e.baldesFechados).toBe(0);
    expect(e.congelados).toBe(0);
  });
});

describe("a compressão de tempo é declarada, e as duas contas saem dela", () => {
  it("MB por tick é volume diário × horas por tick", () => {
    expect(mbPorTick({ "gb-por-dia": 24, "horas-por-tick": 1 })).toBe(1024);
    expect(mbPorTick({ "gb-por-dia": 20, "horas-por-tick": 12 })).toBe((20 * 1024) / 2);
  });

  it("dias por tick é só o relógio, e é ele que mede idade de balde", () => {
    expect(diasPorTick({ "horas-por-tick": 24 })).toBe(1);
    expect(diasPorTick({ "horas-por-tick": 12 })).toBe(0.5);
  });

  it("a janela em dias NÃO depende da compressão de tempo escolhida", () => {
    // A prova de que a compressão é só a velocidade da tela: o mesmo sistema,
    // visto mais rápido, tem a mesma retenção. Se isto cair, o parâmetro
    // deixou de ser compressão e passou a ser parte do modelo.
    const seisHoras = rodar({ "horas-por-tick": 6 }, 600);
    const umDia = rodar({ "horas-por-tick": 24 }, 150);
    expect(Math.abs((seisHoras.janelaEmDias ?? 0) - (umDia.janelaEmDias ?? 0))).toBeLessThanOrEqual(
      1,
    );
  });
});
