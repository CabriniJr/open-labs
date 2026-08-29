/** Um tema agrupa capítulos. É a primeira divisão do índice à esquerda. */
export interface Theme {
  readonly id: string;
  readonly title: string;
  /** Uma frase dizendo a quem este tema serve. Aparece sob o título. */
  readonly blurb: string;
  readonly chapters: readonly Chapter[];
}

export interface Chapter {
  /** O id do documento na coleção — o caminho relativo sem extensão. */
  readonly id: string;
  readonly title: string;
  /**
   * Honestidade editorial: o leitor precisa saber o que está lendo.
   * `stable` — pode confiar. `draft` — a ideia está de pé, o texto não.
   * `proposal` — ainda é discussão, pode mudar inteiro.
   */
  readonly status: "stable" | "draft" | "proposal";
}

export const THEMES: readonly Theme[] = [
  {
    id: "start",
    title: "Comece por aqui",
    blurb: "O que o projeto é, e as decisões que já foram tomadas.",
    chapters: [
      { id: "DECISIONS", title: "Decisões e ideias consolidadas", status: "stable" },
      { id: "VISION", title: "Visão e escopo", status: "draft" },
      { id: "why-simulate", title: "Por que simular", status: "draft" },
    ],
  },
  {
    id: "engine",
    title: "O motor",
    blurb: "Como a simulação funciona por dentro, e por que ela não consegue mentir.",
    chapters: [
      { id: "theory", title: "Teoria: de que formalismos o motor é instância", status: "stable" },
      { id: "kinds", title: "Catálogo de arquétipos", status: "proposal" },
      { id: "depth", title: "Profundidade e níveis", status: "proposal" },
      {
        id: "superpowers/specs/2026-08-28-motor-composicional-design",
        title: "Spec do motor composicional",
        status: "stable",
      },
    ],
  },
  {
    id: "authoring",
    title: "Escrever um lab",
    blurb: "O formato que um handbook usa — hoje ainda proposta.",
    chapters: [
      { id: "authoring", title: "Guia de autoria", status: "draft" },
      { id: "model-format", title: "Formato do modelo", status: "proposal" },
      { id: "stack", title: "O que reaproveitar", status: "draft" },
    ],
  },
  {
    id: "process",
    title: "Andamento",
    blurb: "O que já existe, o que falta, e em que ordem.",
    chapters: [
      { id: "roadmap", title: "Roteiro", status: "draft" },
      { id: "PROGRESS", title: "Progresso", status: "stable" },
    ],
  },
];

/** Todos os capítulos em ordem de leitura — o que alimenta anterior/próximo. */
export const READING_ORDER: readonly Chapter[] = THEMES.flatMap((t) => t.chapters);

/** O tema a que um capítulo pertence, para o breadcrumb. */
export function themeOf(id: string): Theme | undefined {
  return THEMES.find((t) => t.chapters.some((c) => c.id === id));
}

export function chapterOf(id: string): Chapter | undefined {
  return READING_ORDER.find((c) => c.id === id);
}

/** Vizinhos na ordem de leitura. */
export function neighbours(id: string): {
  readonly prev: Chapter | undefined;
  readonly next: Chapter | undefined;
} {
  const i = READING_ORDER.findIndex((c) => c.id === id);
  if (i === -1) return { prev: undefined, next: undefined };
  return { prev: READING_ORDER[i - 1], next: READING_ORDER[i + 1] };
}

export const STATUS_LABEL: Record<Chapter["status"], string> = {
  stable: "estável",
  draft: "rascunho",
  proposal: "proposta",
};
