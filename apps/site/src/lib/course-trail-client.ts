// locale: skip-file — visible strings are covered by CourseTrail/CourseStep markup and reviewed overrides.
import { readProgress, writeProgress, PROGRESS_EVENT } from "./learning-progress";

const DESKTOP = "(min-width: 80rem)";

/**
 * O painel da trilha e o passo no fim da página leem o mesmo armazenamento e
 * reagem ao mesmo evento: marcar em qualquer um (ou no mapa do handbook)
 * redesenha os três, sem um conhecer o outro.
 */
export function initCourseTrail(
  trail = document.querySelector<HTMLDetailsElement>(".course-trail"),
  step = document.querySelector<HTMLElement>("[data-course-step]"),
): void {
  if (!trail) return;
  const $ = <T extends Element>(selector: string, root: ParentNode = trail) => root.querySelector<T>(selector);

  // Abrir/recolher: só o gesto do leitor vira preferência. Abrir por largura
  // de tela no primeiro acesso também dispara `toggle`, e gravar aquilo
  // prenderia o painel aberto no celular de quem só visitou pelo desktop. O
  // `toggle` é assíncrono e se funde com o do clique, então a gravação mora no
  // clique: ali `open` ainda é o estado de antes, e o novo é o contrário.
  const preference = trail.dataset.preference!;
  let saved: string | null = null;
  try { saved = localStorage.getItem(preference); } catch { /* sem memória: decide pela largura */ }
  trail.open = saved === "open" || (saved !== "closed" && matchMedia(DESKTOP).matches);
  $<HTMLElement>(":scope > summary")!.addEventListener("click", () => {
    try { localStorage.setItem(preference, trail.open ? "closed" : "open"); } catch { /* session only */ }
  });

  const items = [...trail.querySelectorAll<HTMLElement>('[data-course-item][data-available="true"]')];
  const isDone = (el: HTMLElement) => readProgress(el.dataset.key!).includes(el.dataset.progressId!);
  const completedPhases = new Set<string>();
  let first = true;

  const refresh = () => {
    let completed = 0;
    for (const item of items) {
      const done = isDone(item);
      completed += Number(done);
      item.dataset.done = String(done);
      const button = $<HTMLButtonElement>("[data-course-toggle]", item)!;
      button.hidden = false;
      button.setAttribute("aria-pressed", String(done));
    }
    const total = items.length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    $("[data-course-percent]")!.textContent = `${percent}%`;
    $("[data-course-count]")!.textContent = `${completed} / ${total}`;
    $("[data-course-chip]")!.textContent = `${completed} / ${total}`;
    $<HTMLElement>("[data-course-ring]")!.style.setProperty("--p", String(percent));
    trail.style.setProperty("--p", String(percent));
    $<HTMLProgressElement>("progress")!.value = completed;
    trail.dataset.complete = String(total > 0 && completed === total);

    for (const phase of trail.querySelectorAll<HTMLElement>(".course-trail__phase")) {
      const own = [...phase.querySelectorAll<HTMLElement>('[data-available="true"]')];
      const done = own.filter(isDone).length;
      $("[data-phase-count]", phase)!.textContent = own.length ? `${done}/${own.length}` : "";
      const n = phase.dataset.phase!;
      $<HTMLElement>(`[data-phase-bar="${n}"]`)?.style.setProperty("--fill", String(own.length ? done / own.length : 0));
      const complete = own.length > 0 && done === own.length;
      phase.dataset.complete = String(complete);
      // Fechar uma fase merece um aceno — mas só quando acontece agora, não ao
      // abrir a página com ela já fechada.
      if (complete && !completedPhases.has(n) && !first) {
        phase.classList.remove("is-celebrating");
        void phase.offsetWidth;
        phase.classList.add("is-celebrating");
      }
      if (complete) completedPhases.add(n); else completedPhases.delete(n);
    }

    const next = items.find((item) => !isDone(item));
    const resume = $<HTMLAnchorElement>("[data-course-continue]");
    if (resume) {
      resume.href = next ? $<HTMLAnchorElement>("a", next)!.href : $<HTMLAnchorElement>(".course-trail__home")!.href;
      $("[data-course-next-label]", resume)!.textContent = !next ? "Path complete — review" : completed ? "Continue learning" : "Start learning";
      const title = $<HTMLElement>("[data-course-next-title]", resume)!;
      const wanted = next?.dataset.title ?? $(".course-trail__home span:last-child")!.textContent ?? "";
      if (title.textContent !== wanted && title.dataset.source !== wanted) { title.dataset.source = wanted; title.textContent = wanted; }
    }

    if (step) {
      const done = isDone(step);
      step.dataset.done = String(done);
      const mark = $<HTMLButtonElement>("[data-course-complete]", step)!;
      mark.hidden = false;
      mark.setAttribute("aria-pressed", String(done));
      $("[data-course-complete-label]", step)!.textContent = done ? "Completed · undo" : "Mark as complete";
      const advance = $<HTMLAnchorElement>("[data-course-advance]", step);
      if (advance) advance.hidden = done;
    }
    first = false;
  };

  const toggle = (el: HTMLElement, force?: boolean) => {
    const key = el.dataset.key!, id = el.dataset.progressId!;
    const previous = readProgress(key);
    const done = previous.includes(id);
    if (force === done) return;
    const ok = writeProgress(key, done ? previous.filter((value) => value !== id) : [...previous, id]);
    if (!ok) $("[data-course-storage]")!.textContent = "Progress is kept for this session only; browser storage is unavailable.";
  };

  trail.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-course-toggle]");
    if (button) toggle(button.closest<HTMLElement>("[data-course-item]")!);
  });
  step?.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target.closest("[data-course-complete]")) toggle(step);
    // O link segue sozinho; antes, a marcação é gravada (síncrona).
    if (target.closest("[data-course-advance]")) toggle(step, true);
  });
  window.addEventListener(PROGRESS_EVENT, refresh);
  window.addEventListener("storage", refresh);
  refresh();
  trail.dataset.ready = "true";
}

initCourseTrail();
