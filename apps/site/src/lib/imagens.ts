// locale: skip-file — license metadata, rendered as proper names.
import credits from "../data/imagens.credits.json";

/**
 * O crédito de cada imagem curada, como a Wikimedia Commons o publica.
 * Gerado por `node scripts/imagens.mjs` a partir de `imagens.manifest.json`;
 * não edite o `.credits.json` à mão — o autor e a licença vêm da API.
 */
export interface Credit {
  readonly file: string;
  readonly alt: string;
  readonly author: string;
  readonly license: string;
  readonly licenseUrl?: string | undefined;
  readonly source: string;
  /** `object-position` do recorte, quando o centro da foto não é o assunto. */
  readonly focus?: string | undefined;
}

const table = credits as Readonly<Record<string, Credit>>;

export function creditOf(name: string): Credit | undefined {
  return table[name];
}

export function hasImage(name: string): boolean {
  return Object.hasOwn(table, name);
}

/** O nome da capa e da imagem de uma fase, como o manifesto as chama. */
export const heroOf = (handbook: string): string => `${handbook}/hero`;
export const phaseImageOf = (handbook: string, phase: number): string => `${handbook}/phase-${phase}`;
