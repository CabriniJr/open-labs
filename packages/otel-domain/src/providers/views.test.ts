import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { fracaoDoQuadro, quantoAparece, viewDisagreement } from "@ovh/depth-ui";
import type { View } from "@ovh/depth-ui";
import {
  FAIXA,
  MARGEM_DA_BORDA,
  OTEL_VIEWS,
  VIEWS_DE_PROVIDER,
  VIEWS_SEM_SDK,
  VIEW_LOGGER_PROVIDER,
  VIEW_METER_PROVIDER,
  VIEW_PROCESS,
  VIEW_TRACER_PROVIDER,
} from "./views.js";
import { otelWorld } from "./world.js";

const spec = otelWorld();
const arvore = indexTree(spec.root, spec.channels);

const semSdk = otelWorld({ semSdk: true });
const arvoreSemSdk = indexTree(semSdk.root, semSdk.channels);

const lugar = (view: View, id: string) => {
  const p = view.places.find((x) => x.id === id);
  if (p === undefined) throw new Error(`a view ${view.id} não desenha ${id}`);
  return p;
};

describe("as seis views, e as três regras de desenho como teste", () => {
  it.each(OTEL_VIEWS.map((v) => [v.id, v] as const))(
    "a view %s concorda com a árvore: não inventa e não esconde",
    (_id, view) => {
      expect(viewDisagreement(arvore, view)).toBeNull();
    },
  );

  it.each(VIEWS_SEM_SDK.map((v) => [v.id, v] as const))(
    "a view %s do mundo sem SDK concorda com a árvore dele",
    (_id, view) => {
      expect(viewDisagreement(arvoreSemSdk, view)).toBeNull();
    },
  );

  it("uma view que esquece um objeto é recusada — a prova de que o teste acima tem dente", () => {
    const capenga: View = {
      ...VIEW_TRACER_PROVIDER,
      places: VIEW_TRACER_PROVIDER.places.filter((p) => p.id !== "sampler"),
    };
    expect(viewDisagreement(arvore, capenga)).toMatch(/"sampler" existe dentro de "tracer-provider"/u);
  });

  it("R3 — as três views de provider compartilham a moldura, então o diff é o interior", () => {
    expect(new Set(VIEWS_DE_PROVIDER.map((v) => `${v.width}x${v.height}`)).size).toBe(1);
  });

  it("R3 — e compartilham as duas faixas e a coluna das bordas", () => {
    const decide = [
      lugar(VIEW_TRACER_PROVIDER, "sampler"),
      lugar(VIEW_LOGGER_PROVIDER, "trace-gate"),
      lugar(VIEW_METER_PROVIDER, "points"),
    ];
    expect(new Set(decide.map((p) => `${p.x},${p.y},${p.w},${p.h}`)).size).toBe(1);

    const controle = [
      lugar(VIEW_TRACER_PROVIDER, "trace-flush"),
      lugar(VIEW_LOGGER_PROVIDER, "log-flush"),
      lugar(VIEW_METER_PROVIDER, "metric-reader"),
    ];
    expect(new Set(controle.map((p) => `${p.x},${p.y},${p.w},${p.h}`)).size).toBe(1);
  });

  it("R2 — o controle acaba onde o dado começa, e por isso nunca o cruza", () => {
    // A regra é sobre as FAIXAS, e não sobre pares de caixas: comparar par a par
    // deixaria passar um controlador colado na borda do quadro que ainda assim
    // corre por cima da faixa. Duas afirmações, e as duas têm de valer.
    let controladores = 0;
    for (const view of VIEWS_DE_PROVIDER) {
      for (const place of view.places) {
        const node = arvore.byId.get(place.id);
        if (node === undefined) continue;
        if (node.kind === "static") continue;
        if (node.kind === "sequencer") {
          controladores += 1;
          expect(place.y + place.h, `${place.id} em ${view.id}`).toBeLessThanOrEqual(FAIXA.dado);
          continue;
        }
        expect(place.y, `${place.id} em ${view.id}`).toBeGreaterThanOrEqual(FAIXA.dado);
      }
    }
    // Um teste que varre e não encontra nada passa calado. Este diz quantos viu.
    expect(controladores).toBe(3);
  });

  it("R1 — toda placa encosta na borda de quem a declara", () => {
    for (const view of OTEL_VIEWS) {
      for (const place of view.places) {
        if (arvore.byId.get(place.id)?.kind !== "static") continue;
        const encosta =
          place.x <= MARGEM_DA_BORDA ||
          place.y <= MARGEM_DA_BORDA ||
          place.x + place.w >= view.width - MARGEM_DA_BORDA ||
          place.y + place.h >= view.height - MARGEM_DA_BORDA;
        expect(encosta, `${place.id} em ${view.id}`).toBe(true);
      }
    }
  });

  it("R1 — os propagadores encostam na borda do PROCESSO e estão fora das três molduras", () => {
    const placa = lugar(VIEW_PROCESS, "propagators");
    expect(placa.y).toBeLessThanOrEqual(MARGEM_DA_BORDA);
    for (const id of ["tracer-provider", "logger-provider", "meter-provider"]) {
      const moldura = lugar(VIEW_PROCESS, id);
      const cruza =
        placa.x < moldura.x + moldura.w &&
        placa.x + placa.w > moldura.x &&
        placa.y < moldura.y + moldura.h &&
        placa.y + placa.h > moldura.y;
      expect(cruza, id).toBe(false);
    }
  });

  it("as três molduras passam do limiar de LOD — senão a assimetria só aparece com clique", () => {
    const quadro = { largura: VIEW_PROCESS.width, altura: VIEW_PROCESS.height };
    for (const id of ["tracer-provider", "logger-provider", "meter-provider"]) {
      const caixa = lugar(VIEW_PROCESS, id);
      expect(quantoAparece(fracaoDoQuadro(caixa, quadro)), id).toBeGreaterThan(0);
    }
  });

  it("nenhuma caixa desenhada por cima de uma irmã", () => {
    const contemAlguem = (view: View, id: string): boolean =>
      view.places.some((outro) => {
        if (outro.id === id) return false;
        let cursor = arvore.parent.get(outro.id);
        while (cursor !== undefined) {
          if (cursor === id) return true;
          cursor = arvore.parent.get(cursor);
        }
        return false;
      });

    for (const view of OTEL_VIEWS) {
      const caixas = view.places.filter((p) => !contemAlguem(view, p.id));
      for (let i = 0; i < caixas.length; i += 1) {
        for (let j = i + 1; j < caixas.length; j += 1) {
          const a = caixas[i]!;
          const b = caixas[j]!;
          const cruza =
            a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
          expect(cruza, `${view.id}: ${a.id} × ${b.id}`).toBe(false);
        }
      }
    }
  });

  it("toda view está no registro de blocos: preta é dado, vermelha é controle", () => {
    // Não há esquemático aqui — não se desce a transistor num SDK.
    for (const view of [...OTEL_VIEWS, ...VIEWS_SEM_SDK]) {
      expect(view.registro, view.id).toBe("blocos");
    }
  });
});
