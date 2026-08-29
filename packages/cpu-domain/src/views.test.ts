import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { viewDisagreement } from "@ovh/depth-ui";
import { assemble } from "./assembler.js";
import { cpuWorld } from "./datapath.js";
import { somadorWorld } from "./gates.js";
import { CPU_VIEWS, VIEW_SISTEMA, viewSomador } from "./views.js";

const r = assemble("addi t0, x0, 1");
if (!r.ok) throw new Error("o programa de teste tem que montar");
const tree = indexTree(cpuWorld(r.image.words).root);

describe("as views do caminho de dados", () => {
  it.each(CPU_VIEWS.map((v) => [v.id, v] as const))(
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
    expect(viewDisagreement(comSilicio, viewSomador(bits, true))).toBeNull();
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
