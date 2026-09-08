import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { viewDisagreement } from "@ovh/depth-ui";
import { pilaresWorld } from "./world.js";
import { VIEWS_DOS_PILARES } from "./views.js";

const spec = pilaresWorld();
const arvore = indexTree(spec.root, spec.channels);

describe("as views dos pilares dizem a verdade sobre a árvore", () => {
  it.each(VIEWS_DOS_PILARES.map((v) => [v.id, v] as const))(
    "%s não inventa nem esconde",
    (_id, view) => {
      expect(viewDisagreement(arvore, view)).toBeNull();
    },
  );

  it("os três gravadores têm o MESMO tamanho", () => {
    // Não é estética: é a afirmação de que nenhum é o principal, e de que os
    // três veem a mesma coisa. Um maior que os outros já teria respondido a
    // pergunta do lab antes de o leitor pensar.
    const gravadores = VIEWS_DOS_PILARES[0]!.places.filter((p) => p.id.endsWith("-store"));
    expect(gravadores).toHaveLength(3);
    const tamanhos = new Set(gravadores.map((p) => `${p.w}×${p.h}`));
    expect(tamanhos.size).toBe(1);
  });

  it("eles estão na mesma coluna, empilhados sem se tocar", () => {
    const gravadores = [...VIEWS_DOS_PILARES[0]!.places.filter((p) => p.id.endsWith("-store"))].sort(
      (a, b) => a.y - b.y,
    );
    expect(new Set(gravadores.map((p) => p.x)).size).toBe(1);
    for (let i = 1; i < gravadores.length; i += 1) {
      const antes = gravadores[i - 1]!;
      const agora = gravadores[i]!;
      expect(agora.y).toBeGreaterThan(antes.y + antes.h);
    }
  });
});
