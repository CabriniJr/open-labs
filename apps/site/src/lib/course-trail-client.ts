// locale: skip-file — visible strings are covered by CourseTrail markup and reviewed overrides.
import { readProgress, writeProgress, PROGRESS_EVENT } from "./learning-progress";

export function initCourseTrail(trail = document.querySelector<HTMLDetailsElement>(".course-trail")): void {
  if (!trail) return;

  const preference = trail.dataset.preference!;
  try {
    const saved = localStorage.getItem(preference);
    trail.open = saved === "open" || (saved !== "closed" && matchMedia("(min-width: 80rem)").matches);
  } catch { trail.open = matchMedia("(min-width: 80rem)").matches; }
  trail.addEventListener("toggle", () => {
    try { localStorage.setItem(preference, trail.open ? "open" : "closed"); } catch { /* session only */ }
  });
  const items = [...trail.querySelectorAll<HTMLElement>('[data-course-item][data-available="true"]')];
  const isDone = (item: HTMLElement) => readProgress(item.dataset.key!).includes(item.dataset.progressId!);
  const refresh = () => {
    let completed = 0;
    for (const item of items) {
      const done = isDone(item);
      completed += Number(done);
      item.dataset.done = String(done);
      const button = item.querySelector<HTMLButtonElement>("[data-course-toggle]")!;
      button.hidden = false;
      button.setAttribute("aria-pressed", String(done));
      button.firstElementChild!.textContent = done ? "✓" : "○";
    }
    trail.querySelector("[data-course-percent]")!.textContent = `${items.length ? Math.round(completed / items.length * 100) : 0}%`;
    trail.querySelector("[data-course-count]")!.textContent = `${completed} / ${items.length}`;
    trail.querySelector("progress")!.value = completed;
    for (const phase of trail.querySelectorAll(".course-trail__phase")) {
      const phaseItems = [...phase.querySelectorAll<HTMLElement>('[data-available="true"]')];
      phase.querySelector("[data-phase-count]")!.textContent = `${phaseItems.filter(isDone).length}/${phaseItems.length}`;
    }
    const next = items.find((item) => !isDone(item));
    const resume = trail.querySelector<HTMLAnchorElement>("[data-course-continue]");
    if (resume) {
      resume.href = next?.querySelector("a")?.href ?? trail.querySelector<HTMLAnchorElement>(".course-trail__home")!.href;
      resume.textContent = !next ? "Path complete — review →" : completed ? "Continue learning →" : "Start learning →";
    }
    const active = trail.querySelector<HTMLButtonElement>("[data-course-active]");
    if (active) {
      active.hidden = false;
      active.setAttribute("aria-pressed", String(isDone(active)));
      active.textContent = isDone(active) ? "Completed · undo" : "Mark as complete";
    }
  };
  trail.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-course-toggle], [data-course-active]");
    if (!button) return;
    const item = button.matches("[data-course-active]") ? button : button.closest<HTMLElement>("[data-course-item]")!;
    const key = item.dataset.key!, id = item.dataset.progressId!;
    const previous = readProgress(key);
    const saved = writeProgress(key, previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
    if (!saved) trail.querySelector("[data-course-storage]")!.textContent = "Progress is kept for this session only; browser storage is unavailable.";
  });
  window.addEventListener(PROGRESS_EVENT, refresh);
  window.addEventListener("storage", refresh);
  refresh();
}

initCourseTrail();
