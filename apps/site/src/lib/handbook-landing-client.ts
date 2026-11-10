// locale: skip-file — visible strings are in the page markup and reviewed overrides.
import { readProgress, subscribeProgress } from "./learning-progress";

/**
 * A landing do handbook: entrada ao rolar, retomar de onde parou e o
 * progresso por capítulo. Lê o mesmo armazenamento que o painel da trilha e o
 * mapa — marcar em qualquer um atualiza este também.
 */
function reveal(): void {
  const items = [...document.querySelectorAll<HTMLElement>(".hb-story [data-reveal]")];
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Escalonar irmãos: cada bloco entra um tico depois do anterior.
  for (const parent of new Set(items.map((el) => el.parentElement))) {
    [...(parent?.children ?? [])].filter((el) => el.hasAttribute("data-reveal")).forEach((el, i) => (el as HTMLElement).style.setProperty("--i", String(Math.min(i, 6))));
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-in"); observer.unobserve(entry.target); }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  // O que já está na tela ao carregar entra junto, sem esperar rolagem.
  document.documentElement.classList.add("hb-reveal");
  for (const el of items) observer.observe(el);
}

function progress(): void {
  const stops = [...document.querySelectorAll<HTMLElement>('.hb-story [data-progress-id][data-available="true"]')]
    .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
  const resume = document.querySelector<HTMLAnchorElement>("[data-hb-resume]");
  const refresh = () => {
    const done = (el: HTMLElement) => readProgress(el.dataset.key!).includes(el.dataset.progressId!);
    for (const el of stops) el.dataset.done = String(done(el));
    for (const chapter of document.querySelectorAll<HTMLElement>(".hb-chapter")) {
      const own = stops.filter((el) => chapter.contains(el));
      const badge = chapter.querySelector<HTMLElement>("[data-chapter-progress]");
      if (!badge || own.length === 0) continue;
      const n = own.filter(done).length;
      badge.hidden = n === 0;
      badge.textContent = `${n}/${own.length}`;
      badge.dataset.complete = String(n === own.length);
    }
    if (!resume) return;
    const started = stops.some(done);
    const next = stops.find((el) => !done(el));
    const link = next?.querySelector<HTMLAnchorElement>("a");
    if (!started || !link) return;
    resume.href = link.href;
    resume.querySelector("[data-hb-resume-label]")!.textContent = "Continue learning";
    const title = resume.querySelector<HTMLElement>("[data-hb-resume-title]")!;
    const wanted = next!.dataset.title ?? link.textContent?.trim() ?? "";
    if (title.dataset.source !== wanted) { title.dataset.source = wanted; title.textContent = wanted; }
  };
  refresh();
  subscribeProgress(refresh);
}

reveal();
progress();
