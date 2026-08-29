import { describe, expect, it } from "vitest";
import { indexTree } from "./tree.js";
import { emissoesPorPorta } from "./emissoes.js";
import type { AnyObject, WorldState } from "./model.js";

/**
 * Uma cadeia de três níveis: o composto de fora responde por um do meio, que
 * responde pela folha. É o formato real — nó › porta › somador — reduzido ao
 * mínimo que ainda tem duas dobras.
 */
const folha = (id: string): AnyObject => ({
  id,
  kind: "sink",
  label: id,
  leaf: true,
  behavior: (state) => ({ state, out: [] }),
});

const arvore = indexTree({
  id: "raiz",
  kind: "composite",
  label: "raiz",
  children: [
    {
      id: "fora",
      kind: "composite",
      label: "fora",
      outlets: { out: [{ node: "meio", port: "saida" }] },
      children: [
        {
          id: "meio",
          kind: "composite",
          label: "meio",
          // Borne nomeado: a porta `saida` do meio é a porta `out` da folha.
          // O nome muda ao subir, e é justamente isso que um borne existe para
          // registrar — a forma sem nome vale a porta de mesmo nome, e está
          // testada logo abaixo.
          outlets: { saida: [{ node: "dentro", port: "out" }] },
          children: [folha("dentro")],
        },
      ],
    },
    folha("solta"),
    {
      id: "espelho",
      kind: "composite",
      label: "espelho",
      // Borne sem nome: vale a porta de mesmo nome no filho.
      outlets: { out: ["eco"] },
      children: [folha("eco")],
    },
  ],
});

const mensagem = { id: "m1", kind: "bit", weight: 1, data: { bit: 1 } };

const estado = (settled: WorldState["settled"]): WorldState =>
  ({ nodes: {}, flight: [], ledger: {}, substeps: 1, substepOf: {}, tick: 1, settled }) as WorldState;

describe("as emissões que cada porta mostra", () => {
  it("a porta do composto responde pelo que a folha emitiu, dois níveis acima", () => {
    const r = emissoesPorPorta(estado({ "dentro.out": [mensagem] }), arvore);
    expect(r["dentro.out"]?.mensagens).toEqual([mensagem]);
    // `meio.saida` aponta para `dentro` sem nomear porta: vale a porta do pai.
    expect(r["meio.saida"]?.mensagens).toEqual([mensagem]);
    expect(r["fora.out"]?.mensagens).toEqual([mensagem]);
    // E o desenho sabe de quem veio, que é o que dá o instante dentro do tick.
    expect(r["fora.out"]?.fonte).toBe("dentro");
  });

  /**
   * A metade que impede a invenção. Sem ela, o desenho poderia acender uma
   * linha porque *alguma coisa* rodou lá dentro — que é a mentira silenciosa
   * de sempre, agora vestida de continuidade.
   */
  it("sem emissão dentro, a porta do composto continua calada", () => {
    const r = emissoesPorPorta(estado({}), arvore);
    expect(r["fora.out"]).toBeUndefined();
    expect(r["meio.saida"]).toBeUndefined();
  });

  it("não mexe em quem já emitiu por conta própria", () => {
    const outra = { ...mensagem, id: "m2", data: { bit: 0 } };
    const r = emissoesPorPorta(
      estado({ "dentro.out": [mensagem], "fora.out": [outra] }),
      arvore,
    );
    expect(r["fora.out"]?.mensagens).toEqual([outra]);
  });

  it("o borne sem nome vale a porta de mesmo nome", () => {
    const r = emissoesPorPorta(estado({ "eco.out": [mensagem] }), arvore);
    expect(r["espelho.out"]?.mensagens).toEqual([mensagem]);
  });

  it("não inventa porta para quem não tem borne", () => {
    const r = emissoesPorPorta(estado({ "solta.out": [mensagem] }), arvore);
    expect(Object.keys(r)).toEqual(["solta.out"]);
  });

  it("o estado original não é tocado", () => {
    const original = estado({ "dentro.out": [mensagem] });
    emissoesPorPorta(original, arvore);
    expect(Object.keys(original.settled)).toEqual(["dentro.out"]);
  });
});
