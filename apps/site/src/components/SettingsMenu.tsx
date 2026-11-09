import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { localeReady, getLanguage, setLanguage, startI18n, subscribeLanguage } from "../lib/i18n.js";

export function SettingsMenu() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => "en" as const);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [theme, setTheme] = useState("system");
  const [hydrated, setHydrated] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), first = useRef<HTMLSelectElement>(null);
  const close = (focus = false) => { setOpen(false); if (focus) trigger.current?.focus(); };
  useEffect(() => { localeReady(root.current); void startI18n(); setTheme(document.documentElement.dataset.theme ?? "system"); setHydrated(true); }, []);
  useEffect(() => {
    if (!open) return; first.current?.focus();
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) close(); };
    const keyboard = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(true); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard); };
  }, [open]);
  const chooseTheme = (value: string) => {
    setTheme(value); if (value === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = value;
    try { if (value === "system") localStorage.removeItem("ovh-theme"); else localStorage.setItem("ovh-theme", value); } catch { setNotice("Settings apply to this page; browser storage is unavailable."); }
  };
  return <div className="settings-menu" ref={root}><button ref={trigger} type="button" className="settings-menu-trigger" disabled={!hydrated} aria-label="Open settings" aria-expanded={open} onClick={() => setOpen(!open)}><span aria-hidden="true">☰</span></button>{open && <section className="settings-menu-panel" role="dialog" aria-label="Settings"><h2>Settings</h2><label>Language<select ref={first} aria-label="Language" value={language} disabled={busy} onChange={(e) => { setBusy(true); setNotice(""); void setLanguage(e.target.value as "en" | "pt-BR").then((r) => { if (!r.persisted) setNotice("Language changed on this page. Browser storage is unavailable."); }).catch(() => setNotice("Could not load the language pack. The original text remains available.")).finally(() => setBusy(false)); }}><option value="en" translate="no">English</option><option value="pt-BR" translate="no">Português (Brasil)</option></select></label><label>Appearance<select aria-label="Appearance" value={theme} onChange={(e) => chooseTheme(e.target.value)}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></label><p>Language and appearance are saved in this browser.</p><p className="settings-translation-note">Technical identifiers and source files keep their original form. Content translations are assisted and open to editorial review.</p>{busy && <p role="status">Loading language…</p>}{notice && <p role="status">{notice}</p>}<button type="button" onClick={() => close(true)}>Close settings</button></section>}</div>;
}
