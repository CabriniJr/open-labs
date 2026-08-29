import { describe, expect, it } from "vitest";
import { readingTime } from "./reading-time.js";

const palavras = (n: number): string => Array.from({ length: n }, (_, i) => `p${i}`).join(" ");

describe("readingTime", () => {
  it("conta prosa a 200 palavras por minuto", () => {
    expect(readingTime(palavras(600))).toEqual({ minutes: 3, words: 600 });
  });

  it("código pesa mais que prosa: o mesmo número de palavras dá mais minutos", () => {
    const prosa = readingTime(palavras(400)).minutes;
    const codigo = readingTime("```\n" + palavras(400) + "\n```").minutes;
    expect(codigo).toBeGreaterThan(prosa);
  });

  it("documento vazio dá um minuto e zero palavras", () => {
    // Zero minuto diria ao leitor que a página está vazia, que é outra coisa.
    expect(readingTime("")).toEqual({ minutes: 1, words: 0 });
  });

  it("não conta a cerca nem a linguagem declarada como palavra", () => {
    expect(readingTime("```ts\n```").words).toBe(0);
    expect(readingTime("```\nconst a = 1;\n```").words).toBe(4);
  });

  it("soma prosa e código no total de palavras", () => {
    const md = `${palavras(100)}\n\n\`\`\`ts\n${palavras(50)}\n\`\`\`\n\n${palavras(100)}`;
    expect(readingTime(md).words).toBe(250);
  });

  it("um bloco não fechado não engole o resto do documento como código", () => {
    // Sem a âncora de fechamento a regex casaria até o fim do arquivo; aqui o
    // bloco solto simplesmente não casa, e o texto conta como prosa.
    expect(readingTime("```\n" + palavras(400)).minutes).toBe(2);
  });
});
