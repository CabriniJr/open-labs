import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Contraste não se confere no olho. Cor de texto que reprova em 4,5:1 passa
 * despercebida numa revisão visual e some de vez na primeira vez que alguém
 * troca um token — por isso a regra mora num teste, e não numa promessa.
 * O tema escuro é o que quebra: papel escuro perdoa tinta clara demais.
 */

const CSS_TOKENS = readFileSync(
  fileURLToPath(new URL("./tokens.css", import.meta.url)),
  "utf8",
);
const CSS_TEMA = readFileSync(
  fileURLToPath(new URL("./themes/otel.css", import.meta.url)),
  "utf8",
);

type Paleta = Record<string, string>;

/** Lê os `--token: valor` do bloco que começa em `seletor`. */
function bloco(css: string, seletor: string): Paleta {
  const inicio = css.indexOf(seletor);
  if (inicio === -1) throw new Error(`bloco "${seletor}" não existe no CSS`);
  const corpo = css.slice(inicio + seletor.length, css.indexOf("}", inicio));
  const paleta: Paleta = {};
  for (const [, nome, valor] of corpo.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    paleta[nome!] = valor!.trim();
  }
  return paleta;
}

const claroBase = bloco(CSS_TOKENS, ":root {");
const escuroSistema = bloco(CSS_TOKENS, ':root:not([data-theme="light"]) {');
const escuroExplicito = bloco(CSS_TOKENS, ':root[data-theme="dark"] {');

const acentoClaro = bloco(CSS_TEMA, ':root[data-domain="otel"] {');
const acentoEscuroSistema = bloco(
  CSS_TEMA,
  ':root[data-domain="otel"]:not([data-theme="light"]) {',
);
const acentoEscuroExplicito = bloco(CSS_TEMA, ':root[data-domain="otel"][data-theme="dark"] {');

const CLARO: Paleta = { ...claroBase, ...acentoClaro };
const ESCURO: Paleta = {
  ...claroBase,
  ...acentoClaro,
  ...escuroSistema,
  ...acentoEscuroSistema,
};

function canal(hex: string): [number, number, number] {
  const limpo = hex.trim().replace("#", "");
  const largo =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  if (!/^[0-9a-fA-F]{6}$/.test(largo)) throw new Error(`cor não hexadecimal: "${hex}"`);
  return [0, 2, 4].map((i) => parseInt(largo.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

/** Luminância relativa, WCAG 2.1. */
function luminancia(hex: string): number {
  const [r, g, b] = canal(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contraste(frente: string, fundo: string): number {
  const a = luminancia(frente);
  const b = luminancia(fundo);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Os pares que de fato existem na tela, com quem os usa. Cada linha aqui é
 * texto legível por gente — cor de traço e de diagrama não entra.
 */
const PARES: readonly (readonly [string, string, string])[] = [
  ["ink", "paper", "corpo do texto"],
  ["ink", "paper-raised", "texto em cartão"],
  ["ink-muted", "paper", "lede, legenda, item do índice"],
  ["ink-muted", "paper-raised", "resultado da busca"],
  ["ink-faint", "paper", "metadados, blurb do tema, nota dos níveis"],
  ["ink-faint", "paper-raised", "etiqueta `proposal` dentro do cartão"],
  ["ink-warn", "paper", "etiqueta `draft`"],
  ["ink-warn", "paper-raised", "etiqueta `draft` dentro do cartão"],
  ["accent", "paper", "link"],
  ["accent", "paper-raised", "link em cartão e realce da busca"],
  ["paper", "accent", "texto do botão primário"],
];

describe.each([
  ["claro", CLARO],
  ["escuro", ESCURO],
])("contraste no tema %s", (_nome, paleta) => {
  it.each(PARES)("--%s sobre --%s (%s) alcança 4,5:1", (frente, fundo, _uso) => {
    const razao = contraste(paleta[frente]!, paleta[fundo]!);
    expect(
      Number(razao.toFixed(2)),
      `--${frente} (${paleta[frente]}) sobre --${fundo} (${paleta[fundo]})`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("os dois jeitos de pedir o escuro", () => {
  it("o bloco do sistema e o do atributo declaram a mesma paleta", () => {
    expect({ ...escuroExplicito, ...acentoEscuroExplicito }).toEqual({
      ...escuroSistema,
      ...acentoEscuroSistema,
    });
  });
});
