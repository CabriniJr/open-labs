import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { viewDisagreement } from "@ovh/depth-ui";
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
      places: VIEW_SISTEMA.places.filter((p) => p.id !== "ula"),
    };
    expect(viewDisagreement(tree, capenga)).toMatch(/"ula" existe dentro de "logica"/);
  });

  it("nenhuma caixa desenhada por cima de outra irmã", () => {
    // Não é regra do motor, é regra deste desenho: irmãs sobrepostas seriam um
    // objeto escondendo o outro, e o leitor não teria como saber.
    const irmas = VIEW_SISTEMA.places.filter(
      (p) => !["cpu", "processador", "logica"].includes(p.id),
    );
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
        expect(agora.y - antes.y).toBe(antes.h + 26);
      }
    }
  });
});
