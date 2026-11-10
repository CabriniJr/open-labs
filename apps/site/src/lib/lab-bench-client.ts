// locale: skip-file — visible strings live in LabBench.astro and the reviewed overrides.

/**
 * A bancada do lab.
 *
 * O palco é a estrela: em modo foco ele toma a tela inteira, e o "Break it"
 * daquele lab vai junto como guia — mexer no modelo com as instruções do lado,
 * sem rolar a página. O leitor escolhe o arranjo (lado a lado, empilhado, só o
 * palco), troca o guia de lado e arrasta a divisória; tudo fica guardado.
 *
 * Nenhum nó do lab sai do lugar. A ilha React continua filha do palco; o
 * script só acrescenta a barra, a divisória e uma cópia do guia, e o CSS faz
 * o resto. Mover a ilha arriscaria a hidratação de todos os labs de uma vez.
 */
type Layout = "auto" | "side" | "stack" | "stage";
interface Prefs { layout: Layout; side: "end" | "start"; guide: number }

const KEY = "ovh:lab-bench:v1";
const DEFAULTS: Prefs = { layout: "auto", side: "end", guide: 0.32 };
const PORTRAIT = "(orientation: portrait)";

function load(): Prefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object") {
      const p = raw as Partial<Prefs>;
      return {
        layout: (["auto", "side", "stack", "stage"] as const).includes(p.layout as Layout) ? p.layout! : DEFAULTS.layout,
        side: p.side === "start" ? "start" : "end",
        guide: typeof p.guide === "number" && p.guide >= 0.18 && p.guide <= 0.6 ? p.guide : DEFAULTS.guide,
      };
    }
  } catch { /* sem armazenamento: vale o padrão */ }
  return { ...DEFAULTS };
}
function save(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* só nesta visita */ }
}

/** O guia é o primeiro bloco (h2 até o próximo h2) da prosa logo depois do palco. */
function guideFrom(stage: HTMLElement): HTMLElement | undefined {
  const next = stage.nextElementSibling;
  if (!next?.classList.contains("lab-prosa")) return undefined;
  const h2 = next.querySelector(".prose h2");
  if (!h2) return undefined;
  const guide = document.createElement("aside");
  guide.className = "bench-guide";
  guide.setAttribute("aria-label", "Guide");
  for (let node: Element | null = h2; node && (node === h2 || node.tagName !== "H2"); node = node.nextElementSibling) {
    guide.append(node.cloneNode(true));
  }
  // Ids duplicados quebrariam âncoras e rótulos acessíveis.
  for (const el of guide.querySelectorAll("[id]")) el.removeAttribute("id");
  return guide;
}

export function initLabBench(): void {
  const stage = document.querySelector<HTMLElement>("main .lab-palco, main .lab-stage");
  const bar = document.querySelector<HTMLElement>("[data-bench-bar]");
  if (!stage || !bar) return;

  const prefs = load();
  const guide = guideFrom(stage);
  const split = document.createElement("div");
  split.className = "bench-split";
  split.setAttribute("role", "separator");
  split.setAttribute("aria-label", "Resize the guide");
  split.tabIndex = 0;

  stage.classList.add("lab-bench");
  stage.prepend(bar);
  bar.hidden = false;
  if (guide) stage.append(split, guide);
  else stage.dataset.noGuide = "true";

  const focusBtn = bar.querySelector<HTMLButtonElement>("[data-bench-focus]")!;
  const focusLabel = bar.querySelector<HTMLElement>("[data-bench-focus-label]")!;
  const portrait = matchMedia(PORTRAIT);

  const effective = (): Exclude<Layout, "auto"> => {
    if (!guide) return "stage";
    if (prefs.layout !== "auto") return prefs.layout;
    return portrait.matches ? "stack" : "side";
  };
  const paint = () => {
    stage.dataset.layout = effective();
    stage.dataset.side = prefs.side;
    stage.style.setProperty("--bench-guide", String(prefs.guide));
    for (const b of bar.querySelectorAll<HTMLButtonElement>("button[data-layout]")) b.setAttribute("aria-checked", String(b.dataset.layout === prefs.layout));
  };

  // Foco: tela cheia do navegador quando existe; onde não existe (iPhone),
  // o CSS cobre a janela do mesmo jeito. Os dois caminhos usam o mesmo layout.
  const focused = () => stage.dataset.focus === "true";
  const setFocus = (on: boolean) => {
    if (on === focused()) return;
    stage.dataset.focus = String(on);
    document.documentElement.classList.toggle("bench-open", on);
    focusBtn.setAttribute("aria-pressed", String(on));
    focusLabel.textContent = on ? "Exit focus mode" : "Focus mode";
    if (on) {
      if (stage.requestFullscreen && !document.fullscreenElement) stage.requestFullscreen().catch(() => { /* fica o modo CSS */ });
      focusBtn.focus();
    } else if (document.fullscreenElement === stage) {
      void document.exitFullscreen();
    }
    // Os labs medem o próprio tamanho; um resize os faz remedir na hora.
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };

  focusBtn.addEventListener("click", () => setFocus(!focused()));
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && focused()) setFocus(false); });
  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable=true]")) return;
    if (e.key === "f" || e.key === "F") { e.preventDefault(); setFocus(!focused()); }
    if (e.key === "Escape" && focused() && !document.fullscreenElement) setFocus(false);
  });

  bar.addEventListener("click", (e) => {
    const target = e.target as Element;
    // Só os botões da barra: o próprio palco também carrega `data-layout`.
    const choice = target.closest<HTMLButtonElement>(".bench-bar button[data-layout]");
    if (choice) { prefs.layout = choice.dataset.layout as Layout; save(prefs); paint(); window.dispatchEvent(new Event("resize")); }
    if (target.closest("[data-bench-swap]")) { prefs.side = prefs.side === "end" ? "start" : "end"; save(prefs); paint(); }
  });
  portrait.addEventListener("change", paint);

  // A divisória: arrastar ou setas do teclado. A medida é fração da tela, e
  // não pixels, para sobreviver a girar o celular.
  const resizeBy = (fraction: number) => {
    prefs.guide = Math.min(0.6, Math.max(0.18, fraction));
    paint();
  };
  split.addEventListener("pointerdown", (e) => {
    split.setPointerCapture(e.pointerId);
    const box = stage.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const side = stage.dataset.layout === "side";
      const fromEnd = side ? (box.right - ev.clientX) / box.width : (box.bottom - ev.clientY) / box.height;
      resizeBy(prefs.side === "end" ? fromEnd : 1 - fromEnd);
    };
    const up = () => { split.removeEventListener("pointermove", move); save(prefs); window.dispatchEvent(new Event("resize")); };
    split.addEventListener("pointermove", move);
    split.addEventListener("pointerup", up, { once: true });
    split.addEventListener("pointercancel", up, { once: true });
  });
  split.addEventListener("keydown", (e) => {
    const grow = prefs.side === "end" ? ["ArrowLeft", "ArrowUp"] : ["ArrowRight", "ArrowDown"];
    const shrink = prefs.side === "end" ? ["ArrowRight", "ArrowDown"] : ["ArrowLeft", "ArrowUp"];
    if (grow.includes(e.key)) { e.preventDefault(); resizeBy(prefs.guide + 0.03); save(prefs); }
    if (shrink.includes(e.key)) { e.preventDefault(); resizeBy(prefs.guide - 0.03); save(prefs); }
  });

  paint();
  stage.dataset.bench = "ready";
}

initLabBench();
