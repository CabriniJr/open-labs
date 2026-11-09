import { expect, it } from "vitest";
import { localizeText } from "./localize-text.js";
import { searchLocalized } from "./localized-search.js";

it("traduz texto, preserva espaços e interpola variáveis sem alterar os valores nativos", () => {
  const messages = { "Submit assessment": "Entregar avaliação", "Opened {0}. Previous project available.": "Aberto {0}. Projeto anterior disponível.", "{0} questions": "{0} questões" };
  expect(localizeText("  Submit assessment \n", messages)).toBe("  Entregar avaliação \n");
  expect(localizeText("Opened team-handbook.zip. Previous project available.", messages)).toBe("Aberto team-handbook.zip. Projeto anterior disponível.");
  expect(localizeText("7 questions", messages)).toBe("7 questões");
  expect(localizeText("manifest.yaml", messages)).toBe("manifest.yaml");
  expect(localizeText("3000m", messages)).toBe("3000m");
});
it("traduz também o que o modelo encaixa num molde, e o valor nativo continua intacto", () => {
  const messages = { "R1 drops it at {0}: {1}.": "O R1 descarta na {0}: {1}.", "line {0} ({1})": "linha {0} ({1})", "the public Wi-Fi never reaches the staff network": "o Wi-Fi público nunca chega à rede da equipe" };
  expect(localizeText("R1 drops it at line 10 (deny): the public Wi-Fi never reaches the staff network.", messages)).toBe("O R1 descarta na linha 10 (deny): o Wi-Fi público nunca chega à rede da equipe.");
  expect(localizeText("R1 drops it at 192.168.10.1: CIDADAO-IN.", messages)).toBe("O R1 descarta na 192.168.10.1: CIDADAO-IN.");
});
it("um molde de código no catálogo não come letra de texto comum", async () => {
  const { readFileSync } = await import("node:fs");
  const pt = JSON.parse(readFileSync(new URL("../../locales/pt-BR.json", import.meta.url), "utf8")) as Record<string, string>;
  expect(localizeText("space play", pt)).not.toBe("pace play");
  expect(localizeText("trunk 802.1Q", pt)).toBe("trunk 802.1Q");
});
it("a busca compara o conteúdo localizado e original e respeita frases entre aspas", () => {
  const index = { searchVersion: 1 as const, language: "en" as const, pages: [{ path: "docs/one/", title: "Assessment review", text: "Educators approve question banks and answer keys.", original: "Educadores aprovam bancos de questões e gabaritos." }] };
  expect(searchLocalized(index, "question banks")[0]?.path).toBe("docs/one/");
  expect(searchLocalized(index, "questões")).toHaveLength(1);
  expect(searchLocalized(index, '"no such phrase"')).toEqual([]);
});
