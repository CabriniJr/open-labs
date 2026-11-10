// locale: skip-file — internal storage keys, no rendered strings.
/** Shared by the course navigation and the existing roadmap. Keep legacy keys. */
export const PROGRESS_EVENT = "openlabs:progress";
const memory = new Map<string, string[]>();

export function readProgress(key: string): string[] {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
  } catch {
    return memory.get(key) ?? [];
  }
}

export function writeProgress(key: string, ids: readonly string[]): boolean {
  memory.set(key, [...ids]);
  let saved = true;
  try { localStorage.setItem(key, JSON.stringify(ids)); memory.delete(key); }
  catch { saved = false; }
  window.dispatchEvent(new Event(PROGRESS_EVENT));
  return saved;
}

export const courseProgressKey = (id: string): string => `ovh:course:${id}:v1`;

export function subscribeProgress(refresh: () => void): () => void {
  window.addEventListener(PROGRESS_EVENT, refresh);
  window.addEventListener("storage", refresh);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, refresh);
    window.removeEventListener("storage", refresh);
  };
}
