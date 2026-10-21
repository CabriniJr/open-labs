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
it("a busca compara o conteúdo localizado e original e respeita frases entre aspas", () => {
  const index = { searchVersion: 1 as const, language: "en" as const, pages: [{ path: "docs/one/", title: "Assessment review", text: "Educators approve question banks and answer keys.", original: "Educadores aprovam bancos de questões e gabaritos." }] };
  expect(searchLocalized(index, "question banks")[0]?.path).toBe("docs/one/");
  expect(searchLocalized(index, "questões")).toHaveLength(1);
  expect(searchLocalized(index, '"no such phrase"')).toEqual([]);
});
