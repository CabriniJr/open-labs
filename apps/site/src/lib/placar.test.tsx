import { afterEach, describe, expect, it } from "vitest";
import { lerPlacar, registrar, CHAVE_DO_PLACAR } from "./placar.js";

afterEach(() => window.localStorage.clear());

describe("o placar guarda o acerto de PRIMEIRA", () => {
  it("nasce vazio", () => {
    expect(lerPlacar()).toEqual({});
  });

  it("acertar de primeira fica registrado como primeira", () => {
    registrar("e1", true);
    expect(lerPlacar()["e1"]).toBe("primeira");
  });

  it("errar registra depois, e acertar em seguida NÃO promove", () => {
    // É a regra inteira: premia prever, não tentar até ficar verde.
    registrar("e1", false);
    registrar("e1", true);
    expect(lerPlacar()["e1"]).toBe("depois");
  });

  it("não encosta na chave do progresso do mapa", () => {
    registrar("e1", true);
    expect(CHAVE_DO_PLACAR).not.toBe("ovh:progress:v1");
    expect(window.localStorage.getItem("ovh:progress:v1")).toBeNull();
  });

  it("storage indisponível não derruba a página", () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error("modo privado"); };
    expect(() => registrar("e2", true)).not.toThrow();
    window.localStorage.setItem = original;
  });
});
