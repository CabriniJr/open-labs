// locale: skip-file — no rendered strings.
import { HANDBOOKS, type Handbook } from "../data/handbooks";
import { url } from "./urls";
import { coursePath, positionOf } from "./course-path";

/** A página servida em `pathname`, normalizada com barra final como `url()` gera. */
export const pageOf = (pathname: string): string => `${pathname.replace(/\/$/, "")}/`;

/** O handbook cuja trilha passa por esta página (a página do handbook inclusa). */
export function courseAt(current: string): Handbook | undefined {
  return HANDBOOKS.find((handbook) =>
    current === url(`handbooks/${handbook.id}`) ||
    [...handbook.articles, ...handbook.labs].some((item) => item.href && url(item.href) === current),
  );
}

/** Esta página é uma parada publicada da trilha (e então ganha o passo seguinte)? */
export function isCourseStop(current: string): boolean {
  const handbook = courseAt(current);
  return handbook !== undefined && positionOf(coursePath(handbook), current, url).current !== undefined;
}
