# Imagens dos handbooks

A landing de cada handbook tem uma capa e uma imagem por fase. São fotos
reais, da Wikimedia Commons, escolhidas uma a uma — atmosfera, não
informação: se uma faltar, o gradiente do tema ocupa o lugar e nada da página
depende dela.

## Onde mora cada coisa

| Arquivo | O que é | Quem escreve |
|---|---|---|
| `apps/site/src/data/imagens.manifest.json` | a curadoria: qual arquivo da Commons, o texto alternativo, o recorte (`focus`) | pessoa |
| `apps/site/src/data/imagens.credits.json` | autor, licença e fonte de cada imagem | `scripts/imagens.mjs`, lendo a API |
| `apps/site/src/assets/handbooks/<id>/<hero\|phase-N>.jpg` | o JPEG-fonte (capa 1920 px, fase 1280 px, ≤ 500 KB) | `scripts/imagens.mjs` |

O Astro gera AVIF e WebP em vários tamanhos no build (`HandbookImage.astro`);
o navegador baixa o tamanho da tela, não o do arquivo.

## Trocar ou adicionar uma imagem

1. Ache o arquivo na Commons. Licença precisa permitir reuso com atribuição:
   CC BY, CC BY-SA, CC0 ou domínio público. Paisagem, ≥ 1600 px de largura.
2. Escreva a entrada no manifesto, com a chave `<handbook>/<hero|phase-N>`:

   ```json
   "otel/phase-3": {
     "file": "File:Trans-Alaska Pipeline segment 1.jpg",
     "alt": "The Trans-Alaska Pipeline zigzagging across autumn tundra",
     "focus": "50% 40%"
   }
   ```

3. `NODE_USE_ENV_PROXY=1 node scripts/imagens.mjs` — baixa o que falta e
   reescreve os créditos. `--refresh` rebaixa tudo.
4. `pnpm test` cobra: todo arquivo tem crédito, todo crédito veio do
   manifesto, só licenças livres, a chave aponta para handbook e fase reais,
   nenhum arquivo acima de 600 KB.

O crédito nunca é digitado. Digitado, ele envelhece e mente; lido da fonte,
ele é a fonte. Ele aparece sobre a própria foto, com link para a página da
Commons (no card da home, onde o card inteiro já é link, sai como texto).

## Critério de curadoria

A foto é a metáfora da fase, não uma ilustração dela: o OTel "The Problem" é
uma parede de monitores que não conversam; "The Model" são raízes se
ramificando; "The Architecture" é um oleoduto com estações. Prefira objeto
real a stock genérico, e evite pessoas identificáveis em primeiro plano.

Rede: a API e os arquivos ficam em `commons.wikimedia.org`,
`upload.wikimedia.org` e `thumb.wikimedia.org`. A API limita cliente anônimo;
o script espera o `retry-after` em vez de insistir.
