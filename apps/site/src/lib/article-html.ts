import { marked } from "marked";
import DOMPurify from "dompurify";

/** Preview sanitizes Markdown output, without images or executable embeds. */
export function previewHtml(markdown: string): string {
  const clean = DOMPurify.sanitize(marked.parse(markdown, { async: false }), {
    ALLOWED_TAGS: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "a", "strong", "em", "del", "code", "pre", "ul", "ol", "li", "blockquote", "hr", "br", "table", "thead", "tbody", "tr", "td", "th"],
    ALLOWED_ATTR: ["href", "title"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  for (const heading of doc.querySelectorAll("h1")) {
    const replacement = doc.createElement("h2"); replacement.append(...heading.childNodes); heading.replaceWith(replacement);
  }
  for (const link of doc.querySelectorAll("a")) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("#src-")) link.setAttribute("href", href.replace("#src-", "#studio-src-"));
    else if (/^https:\/\//u.test(href)) { link.setAttribute("rel", "noopener noreferrer"); link.setAttribute("target", "_blank"); }
    else link.removeAttribute("href");
  }
  for (const quote of doc.querySelectorAll("blockquote")) {
    const first = quote.querySelector("p");
    const match = /^\[!deeper\]\s*(.*)/u.exec(first?.textContent ?? "");
    if (!match) continue;
    const detail = doc.createElement("details"), summary = doc.createElement("summary");
    summary.textContent = match[1] || "Go deeper"; first?.remove();
    detail.append(summary, ...quote.childNodes); quote.replaceWith(detail);
  }
  return doc.body.innerHTML;
}

