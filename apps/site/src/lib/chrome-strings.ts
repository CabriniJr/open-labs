/**
 * A moldura do site fala a língua da página, e não uma só.
 *
 * O HTML sem JavaScript preserva a língua original de cada página. A camada
 * de tradução aplica a preferência do leitor ao conteúdo e à moldura, com
 * catálogos locais; o atributo lang acompanha o idioma escolhido.
 */
export type Lang = "en" | "pt-BR";

export interface ChromeStrings {
  readonly skip: string;
  readonly nav: string;
  readonly docs: string;
  readonly handbooks: string;
  readonly labs: string;
  readonly theme: string;
  readonly footerNote: string;
  readonly code: string;
  readonly licenseCode: string;
  readonly licenseContent: string;
  readonly footerNav: string;
}

const EN: ChromeStrings = {
  skip: "Skip to content",
  nav: "Main",
  docs: "Docs",
  handbooks: "Handbooks",
  labs: "Labs",
  theme: "Toggle light and dark theme",
  footerNote:
    "Every model on this site is a simulation that actually runs. No animation is scripted.",
  code: "Code",
  licenseCode: "Apache-2.0 (code)",
  licenseContent: "CC BY-SA 4.0 (content)",
  footerNav: "Footer",
};

const PT: ChromeStrings = {
  skip: "Pular para o conteúdo",
  nav: "Principal",
  docs: "Documentação",
  handbooks: "Handbooks",
  labs: "Labs",
  theme: "Alternar tema claro e escuro",
  footerNote:
    "Todo modelo deste site é uma simulação que roda de verdade. Nenhuma animação é roteirizada.",
  code: "Código",
  licenseCode: "Apache-2.0 (código)",
  licenseContent: "CC BY-SA 4.0 (conteúdo)",
  footerNav: "Rodapé",
};

export function chrome(lang: Lang): ChromeStrings {
  return lang === "pt-BR" ? PT : EN;
}
