import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { viewDisagreement } from "@ovh/depth-ui";
import type { View } from "@ovh/depth-ui";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";
import { somadorWorld } from "./gates.js";
import {
  CPU_VIEWS,
  VIEW_SISTEMA,
  viewSomador,
  viewSomadorDaUla,
  viewsDasPortas,
  viewsDoSomador,
} from "./views.js";
import { LARGURA } from "./alu.js";
import { interiorDisagreement } from "@ovh/depth-ui";

const r = assemble("addi t0, x0, 1");
if (!r.ok) throw new Error("o programa de teste tem que montar");
const tree = indexTree(cpuWorld(r.image.words).root);

describe("as views do caminho de dados", () => {
  it.each([...CPU_VIEWS, viewSomadorDaUla(LARGURA)].map((v) => [v.id, v] as const))(
    "a view %s concorda com a árvore: não inventa e não esconde",
    (_id, view) => {
      expect(viewDisagreement(tree, view)).toBeNull();
    },
  );

  it("uma view que esquece um objeto é recusada", () => {
    // A prova de que o teste acima tem dente: tirar uma peça reprova.
    const capenga = {
      ...VIEW_SISTEMA,
      // `banco` e não `ula`: a ULA não é mais desenhada no primeiro nível — ela
      // mora dentro da lógica combinacional, que vem fechada. Tirar dali não é
      // esquecer, é o que `collapsed` autoriza.
      places: VIEW_SISTEMA.places.filter((p) => p.id !== "banco"),
    };
    expect(viewDisagreement(tree, capenga)).toMatch(/"banco" existe dentro de "processador"/);
  });

  it("nenhuma caixa desenhada por cima de outra irmã", () => {
    // Não é regra do motor, é regra deste desenho: irmãs sobrepostas seriam um
    // objeto escondendo o outro, e o leitor não teria como saber.
    //
    // Quem é moldura sai da conta, e **quem é moldura sai da árvore**: uma
    // caixa que contém outra caixa desenhada está por baixo dela por
    // definição. A lista escrita à mão que morava aqui envelhecia calada — o
    // dia em que um barramento passou a mostrar as vias dele, ela reprovou um
    // desenho correto.
    const contemAlguem = (id: string): boolean =>
      VIEW_SISTEMA.places.some((outro) => {
        if (outro.id === id) return false;
        let cursor = tree.parent.get(outro.id);
        while (cursor !== undefined) {
          if (cursor === id) return true;
          cursor = tree.parent.get(cursor);
        }
        return false;
      });
    const irmas = VIEW_SISTEMA.places.filter((p) => !contemAlguem(p.id));
    for (const a of irmas) {
      for (const b of irmas) {
        if (a.id >= b.id) continue;
        const separadas =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(separadas, `"${a.id}" e "${b.id}" se sobrepõem`).toBe(true);
      }
    }
  });
});

describe("a view do somador de portas", () => {
  it.each([2, 4, 8])("concorda com a árvore de %i bits", (bits) => {
    const arvore = indexTree(somadorWorld(bits).root);
    expect(viewDisagreement(arvore, viewSomador(bits))).toBeNull();

    // E o mesmo somador aberto até o transistor: aí as portas têm interior, e
    // a view precisa dizer isso — é o invariante de não esconder calado, agora
    // no nível que o lab de fato roda.
    const comSilicio = indexTree(somadorWorld(bits, false, 1, true).root);
    for (const view of viewsDoSomador(bits, true)) {
      expect({ view: view.id, erro: viewDisagreement(comSilicio, view) }).toEqual({
        view: view.id,
        erro: null,
      });
    }
  });

  it("nenhuma porta desenhada por cima de outra", () => {
    const view = viewSomador(4);
    const portas = view.places.filter((p) => /-(xor|and|or)\d$/.test(p.id));
    for (const a of portas) {
      for (const b of portas) {
        if (a.id >= b.id) continue;
        const separadas =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(separadas, `"${a.id}" e "${b.id}" se sobrepõem`).toBe(true);
      }
    }
  });
});

/**
 * A escada da ULA, do sistema ao silício.
 *
 * Ela existe para ser descida por zoom, e descer por zoom é o desenho
 * afirmando quem mora dentro de quem. Sem este teste, uma vista com o `focus`
 * errado poria o interior de uma peça dentro de outra — e o leitor estudaria
 * uma hierarquia que o modelo não tem.
 */
describe("a escada da ULA aberta até o transistor", () => {
  const fundo = indexTree(cpuWorld(r.image.words, { transistoresNaUla: true }).root);
  const portas = viewsDasPortas(LARGURA);

  it("o somador da ULA cabe na caixa que a ULA dá a ele", () => {
    const caixa = CPU_VIEWS.find((v) => v.id === "ula")?.places.find((p) => p.id === "somador");
    expect(caixa).toBeDefined();
    expect(interiorDisagreement(fundo, caixa!, viewSomadorDaUla(LARGURA))).toBeNull();
  });

  it("cada porta do somador tem a esquemática dela, e é dela mesmo", () => {
    expect(portas.length).toBeGreaterThan(LARGURA * 5);
    for (const view of portas) {
      expect(viewDisagreement(fundo, view), `${view.id}`).toBeNull();
    }
  });

  it("a serpentina não empilha dois bits no mesmo lugar", () => {
    const lugares = viewSomadorDaUla(LARGURA).places;
    const chaves = new Set(lugares.map((p) => `${p.x},${p.y}`));
    expect(chaves.size).toBe(lugares.length);
  });

  /**
   * O vai-um atravessa a largura inteira, e a dobra não pode desfazer isso: dois
   * bits vizinhos têm que ficar vizinhos na tela, ou na mesma linha ou logo
   * abaixo. É a única coisa que a serpentina precisa preservar.
   */
  it("bits vizinhos ficam vizinhos na tela", () => {
    const lugares = viewSomadorDaUla(LARGURA).places;
    for (let i = 1; i < lugares.length; i += 1) {
      const antes = lugares[i - 1]!;
      const agora = lugares[i]!;
      const mesmaLinha = antes.y === agora.y;
      const distancia = Math.abs(antes.x - agora.x);
      if (mesmaLinha) {
        expect(distancia, `bit${i - 1} e bit${i}`).toBe(antes.w + 26);
      } else {
        expect(distancia, `bit${i - 1} e bit${i} na dobra`).toBe(0);
        // A dobra SOBE. Era o contrário, e a serpentina de 32 bits lia ao
        // avesso da figura de quatro bits do mesmo circuito: quem descesse de
        // uma para a outra teria de virar a cabeça no meio do caminho, sem ter
        // como saber que precisava. O sinal aqui é a direção, e é ele que se
        // está cobrando — `Math.abs` a esconderia.
        expect(agora.y - antes.y, `a dobra entre bit${i - 1} e bit${i} sobe`).toBe(
          -(antes.h + 26),
        );
      }
    }
  });
});

/**
 * A direção da leitura do somador, travada.
 *
 * Estava invertida, e discordava de três coisas ao mesmo tempo: do texto do
 * lab ("watch the carry climb from the low bit to the high one"), do número
 * escrito — ler as somas de cima para baixo dava `1011` onde a caixa de
 * resultado dizia `1101` — e do próprio desenho, porque o vem-de-trás nascia
 * embaixo, saltava a figura inteira até o bit zero lá em cima, e o vai-um
 * descia de volta.
 *
 * Nada disso quebrava teste: o circuito somava certo, a view concordava com a
 * árvore, e a suíte inteira passava. Só a leitura estava de cabeça para baixo,
 * e leitura é a coisa que este lab existe para dar. Por isso o invariante é
 * geométrico e não de conteúdo.
 */
describe("o somador se lê como o número se escreve", () => {
  const y = (view: View, id: string): number => {
    const place = view.places.find((p) => p.id === id);
    if (place === undefined) throw new Error(`a view não desenha "${id}"`);
    return place.y;
  };

  it.each([4, 8])("com %i bits, o mais significativo fica por cima", (bits) => {
    const view = viewSomador(bits);
    for (let i = 1; i < bits; i += 1) {
      expect(y(view, `bit${i}`), `bit${i} tem de estar acima de bit${i - 1}`).toBeLessThan(
        y(view, `bit${i - 1}`),
      );
      expect(y(view, `soma${i}`)).toBeLessThan(y(view, `soma${i - 1}`));
    }
  });

  it("o transporte sobe: entra por baixo do bit zero e sai por cima do último", () => {
    const view = viewSomador(4);
    // O vem-de-trás nasce abaixo do primeiro somador...
    expect(y(view, "cin0")).toBeGreaterThan(y(view, "bit0"));
    // ...e o vai-um sai acima do último, porque ele é o bit seguinte a ele.
    expect(y(view, "vaium")).toBeLessThan(y(view, "bit3"));
  });
});

/**
 * E a serpentina de 32 bits lê no mesmo sentido da de quatro.
 *
 * São duas figuras do MESMO circuito, uma dentro da CPU e a outra no lab das
 * portas. Lendo em sentidos opostos, quem descesse de uma para a outra teria
 * de virar a cabeça no meio do caminho — e não teria como saber que precisava.
 */
describe("as duas figuras do somador leem no mesmo sentido", () => {
  it("na serpentina, a fileira do bit zero fica abaixo da fileira seguinte", () => {
    const view = viewSomadorDaUla(32, 8);
    const y = (id: string): number => {
      const place = view.places.find((p) => p.id === id);
      if (place === undefined) throw new Error(`a view não desenha "${id}"`);
      return place.y;
    };
    // bit0 e bit7 estão na mesma fileira; bit8 abre a de cima.
    expect(y("bit0")).toBe(y("bit7"));
    expect(y("bit8")).toBeLessThan(y("bit0"));
    expect(y("bit31")).toBeLessThan(y("bit8"));
  });
});
