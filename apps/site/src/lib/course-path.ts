// locale: skip-file — ids and storage keys; visible strings live in the components.
import type { Handbook, HandbookItem } from "../data/handbooks";
import { courseProgressKey } from "./learning-progress";

/**
 * A trilha de um handbook como dado: a ordem em que o leitor anda, e onde está.
 *
 * O painel lateral e o "próximo passo" no fim de cada página leem a mesma
 * lista, para que "próximo" no rodapé nunca discorde do que o painel destaca.
 * A ordem dentro de uma fase é artigo antes de lab: o artigo é a teoria que o
 * lab da mesma fase prova.
 */
export type CourseKind = "Article" | "Lab";

export interface CourseStop {
  readonly id: string;
  readonly kind: CourseKind;
  readonly title: string;
  readonly status: HandbookItem["status"];
  readonly phase: number;
  readonly href?: string | undefined;
  /** Chave do localStorage onde a marcação mora. Labs do mapa usam a chave antiga. */
  readonly key: string;
  readonly progressId: string;
  /** Publicado, com link: entra no total e pode ser marcado. */
  readonly available: boolean;
}

export interface CoursePhase {
  readonly number: number;
  readonly title: string;
  readonly stops: readonly CourseStop[];
}

export interface CoursePath {
  readonly handbookId: string;
  readonly phases: readonly CoursePhase[];
  /** Só as paradas publicadas, na ordem da trilha. */
  readonly available: readonly CourseStop[];
}

export function coursePath(handbook: Handbook): CoursePath {
  const courseKey = courseProgressKey(handbook.id);
  const stop = (item: HandbookItem, kind: CourseKind): CourseStop => {
    // O mapa já guardava labs concluídos por id, numa chave própria. Reaproveitar
    // essa chave preserva o que o leitor marcou antes de a trilha existir.
    const legacy = kind === "Lab" ? handbook.map?.labs.find((lab) => lab.href === item.href) : undefined;
    return {
      id: item.id,
      kind,
      title: item.title,
      status: item.status,
      phase: item.phase,
      href: item.href,
      key: legacy ? handbook.map!.storageKey : courseKey,
      progressId: legacy?.id ?? `${kind === "Lab" ? "lab" : "article"}:${item.id}`,
      available: Boolean(item.href) && item.status === "available",
    };
  };
  const phases = handbook.phases.map((phase) => ({
    number: phase.number,
    title: phase.title,
    stops: [
      ...handbook.articles.filter((item) => item.phase === phase.number).map((item) => stop(item, "Article")),
      ...handbook.labs.filter((item) => item.phase === phase.number).map((item) => stop(item, "Lab")),
    ],
  }));
  return { handbookId: handbook.id, phases, available: phases.flatMap((phase) => phase.stops).filter((s) => s.available) };
}

export interface Position {
  readonly current?: CourseStop | undefined;
  readonly previous?: CourseStop | undefined;
  readonly next?: CourseStop | undefined;
  readonly phase?: CoursePhase | undefined;
  /** 1-based, entre as paradas publicadas. */
  readonly index?: number | undefined;
}

/**
 * Onde a página `current` está na trilha. `resolve` transforma o href do
 * catálogo na URL servida (o caminho-base muda entre Vercel e Pages).
 */
export function positionOf(path: CoursePath, current: string, resolve: (href: string) => string = (h) => h): Position {
  const at = path.available.findIndex((s) => resolve(s.href!) === current);
  const phase = path.phases.find((p) => p.stops.some((s) => s.href && resolve(s.href) === current));
  if (at < 0) return { phase };
  return {
    current: path.available[at],
    previous: path.available[at - 1],
    next: path.available[at + 1],
    phase,
    index: at + 1,
  };
}
