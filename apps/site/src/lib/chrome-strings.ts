/**
 * A moldura do site fala a língua da página, e não uma só.
 *
 * O handbook é em inglês, por alcance; a documentação de projeto é em
 * português, porque é onde o Luigi pensa. Traduzir uma das duas é decisão
 * editorial ainda não tomada — o que **não** pode é uma página declarar
 * `lang="en"` e mostrar uma navegação em português, que é o que quebra leitor
 * de tela e tradutor automático.
 */
export type Lang = "en" | "pt-BR";

export interface ChromeStrings {
  readonly skip: string;
  readonly nav: string;
  readonly docs: string;
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
