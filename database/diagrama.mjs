// Desenha os diagramas do banco (relacional e lógico) a partir de
// packages/database-domain/src/telecentro/esquema.ts — a mesma fonte do
// 01-ddl.sql. Não é a exportação do Oracle Data Modeler: é o mesmo modelo, na
// mesma notação, desenhado do esquema. `gerar.mjs` usa estes SVGs só quando
// não há exportação do Data Modeler em entrega/.

const LINHA = 17;
const CABECALHO = 26;
const LETRA = 6.7; // largura média de um caractere monoespaçado de 11,5px
const COL_GAP = 150;
const ROW_GAP = 64;
const MARGEM = 24;
const COR = { borda: "#3b5b8c", cabeca: "#dbe6f4", texto: "#1f2328", suave: "#57606a", linha: "#3b5b8c", fundo: "#ffffff" };

// Onde cada tabela fica: [coluna, linha]. O catálogo em cima, o telecentro
// embaixo, e o que liga os dois (progresso, tentativa) no meio.
const POSICAO = {
  T_HANDBOOK: [0, 0], T_FASE: [1, 0], T_LAB: [2, 0], T_AVALIACAO: [3, 0],
  T_COMPUTADOR: [0, 1], T_PROGRESSO: [2, 1], T_TENTATIVA: [3, 1],
  T_MONITOR: [0, 2], T_TELECENTRO: [1, 2], T_ALUNO: [2, 2],
};

const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const ACENTOS = { Avaliacao: "Avaliação" };
const entidade = (nome) => {
  const e = nome.replace(/^T_/u, "").toLowerCase().replace(/^./u, (c) => c.toUpperCase());
  return ACENTOS[e] ?? e;
};

/** As linhas de cada caixa: [marcador, nome, tipo]. */
function linhasDa(t, modo) {
  const fks = new Set((t.fks ?? []).map((f) => f.coluna));
  const unicos = new Set([...t.colunas.filter((c) => c.unico).map((c) => c.nome), ...(t.unicos ?? []).flat()]);
  return t.colunas
    .filter((c) => modo === "relacional" || !fks.has(c.nome) || c.nome === t.pk)
    .map((c) => {
      const obrig = c.nulo ? " " : "*";
      const marca = modo === "relacional"
        ? (c.nome === t.pk ? "P" : fks.has(c.nome) ? "F" : unicos.has(c.nome) ? "U" : " ") + obrig
        : (c.nome === t.pk ? "#" : unicos.has(c.nome) ? "U" : " ") + obrig;
      return [marca, c.nome, c.tipo];
    });
}

function caixas(tabelas, modo) {
  const medidas = tabelas.map((t) => {
    const linhas = linhasDa(t, modo);
    const titulo = modo === "relacional" ? t.nome : entidade(t.nome);
    const nome = Math.max(...linhas.map(([, n]) => n.length));
    const tipo = Math.max(...linhas.map(([, , ti]) => ti.length));
    const largura = Math.max(titulo.length * 7.6 + 24, (3 + nome + 2 + tipo) * LETRA + 22);
    return { t, titulo, linhas, nome, largura, altura: CABECALHO + linhas.length * LINHA + 8 };
  });
  const colunas = Math.max(...Object.values(POSICAO).map(([c]) => c)) + 1;
  const linhasDaGrade = Math.max(...Object.values(POSICAO).map(([, l]) => l)) + 1;
  const largCol = Array.from({ length: colunas }, (_, c) => Math.max(0, ...medidas.filter((m) => POSICAO[m.t.nome][0] === c).map((m) => m.largura)));
  const altLin = Array.from({ length: linhasDaGrade }, (_, l) => Math.max(0, ...medidas.filter((m) => POSICAO[m.t.nome][1] === l).map((m) => m.altura)));
  const x0 = largCol.map((_, c) => MARGEM + largCol.slice(0, c).reduce((a, b) => a + b + COL_GAP, 0));
  const y0 = altLin.map((_, l) => MARGEM + altLin.slice(0, l).reduce((a, b) => a + b + ROW_GAP, 0));
  const porNome = {};
  for (const m of medidas) {
    const [c, l] = POSICAO[m.t.nome];
    // Centrada na coluna, alinhada ao topo da linha.
    porNome[m.t.nome] = { ...m, x: x0[c] + (largCol[c] - m.largura) / 2, y: y0[l], col: c, lin: l };
  }
  const largura = x0[colunas - 1] + largCol[colunas - 1] + MARGEM;
  const altura = y0[linhasDaGrade - 1] + altLin[linhasDaGrade - 1] + MARGEM;
  return { porNome, largura, altura };
}

/** O caminho de uma FK: do filho (lado N) até o pai (lado 1), em ângulos retos. */
function rota(f, p, ordem) {
  const meioY = (b) => b.y + CABECALHO + 6 + ordem * 14;
  if (f.lin === p.lin) {
    const y = Math.min(meioY(f), meioY(p));
    return f.x < p.x ? [[f.x + f.largura, y], [p.x, y]] : [[f.x, y], [p.x + p.largura, y]];
  }
  if (f.col === p.col) {
    const x = Math.max(f.x, p.x) + Math.min(f.largura, p.largura) / 2 + (ordem - 0.5) * 0;
    return f.y < p.y ? [[x, f.y + f.altura], [x, p.y]] : [[x, f.y], [x, p.y + p.altura]];
  }
  // Colunas e linhas diferentes. Se a casa ao lado do filho, na linha dele,
  // está vazia, sai pela lateral e desce até o pai; senão desce e entra pela lateral.
  const ocupada = Object.values(POSICAO).some(([c, l]) => l === f.lin && c === p.col);
  if (!ocupada) {
    const y = f.y + f.altura / 2;
    const x = p.x + p.largura / 2;
    return f.x < p.x ? [[f.x + f.largura, y], [x, y], [x, f.y < p.y ? p.y : p.y + p.altura]] : [[f.x, y], [x, y], [x, f.y < p.y ? p.y : p.y + p.altura]];
  }
  const x = f.x + f.largura / 2;
  const y = meioY(p) + 14;
  return [[x, f.y < p.y ? f.y + f.altura : f.y], [x, y], [f.x < p.x ? p.x : p.x + p.largura, y]];
}

/** Pé de galinha na ponta `a` (que encosta no filho), vindo de `b`. */
function peDeGalinha([ax, ay], [bx, by]) {
  const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
  const base = [ax + dx * 12, ay + dy * 12];
  const lados = dx !== 0 ? [[ax, ay - 7], [ax, ay + 7]] : [[ax - 7, ay], [ax + 7, ay]];
  return [lados[0], [ax, ay], lados[1]].map(([x, y]) => `M${base[0]},${base[1]} L${x},${y}`).join(" ");
}

/** A ponta do pai: seta (relacional) ou traço do "exatamente 1" (lógico). */
function pontaDoPai([ax, ay], [bx, by], modo) {
  const dx = Math.sign(ax - bx), dy = Math.sign(ay - by); // aponta para dentro do pai
  if (modo === "relacional") {
    const tras = [ax - dx * 9, ay - dy * 9];
    const p1 = dx !== 0 ? [tras[0], tras[1] - 5] : [tras[0] - 5, tras[1]];
    const p2 = dx !== 0 ? [tras[0], tras[1] + 5] : [tras[0] + 5, tras[1]];
    return `<path d="M${p1} L${ax},${ay} L${p2} Z" fill="${COR.linha}"/>`;
  }
  const c = [ax - dx * 9, ay - dy * 9];
  const d = dx !== 0 ? `M${c[0]},${c[1] - 7} L${c[0]},${c[1] + 7}` : `M${c[0] - 7},${c[1]} L${c[0] + 7},${c[1]}`;
  return `<path d="${d}" stroke="${COR.linha}" stroke-width="1.4" fill="none"/>`;
}

/**
 * @param {readonly import("../packages/database-domain/src/telecentro/esquema.ts").Tabela[]} tabelas
 * @param {"relacional" | "logico"} modo
 */
export function diagramaSvg(tabelas, modo) {
  const { porNome, largura, altura } = caixas(tabelas, modo);
  const partes = [];
  const contagem = {};
  for (const t of tabelas) {
    for (const fk of t.fks ?? []) {
      const f = porNome[t.nome], p = porNome[fk.tabela];
      const chave = p.t.nome;
      const ordem = (contagem[chave] = (contagem[chave] ?? -1) + 1);
      const pts = rota(f, p, f.lin === p.lin ? 0 : ordem);
      const caminho = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
      // No lógico, "0 ou muitos" é participação opcional do lado N: a metade do
      // filho fica tracejada, como no Data Modeler.
      const opcional = modo === "logico" && /\b0 ou muit/u.test(fk.cardinalidade);
      if (opcional && pts.length === 2) {
        const meio = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
        partes.push(`<path d="M${pts[0]} L${meio}" stroke="${COR.linha}" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/>`);
        partes.push(`<path d="M${meio} L${pts[1]}" stroke="${COR.linha}" stroke-width="1.4" fill="none"/>`);
      } else if (opcional) {
        partes.push(`<path d="M${pts[0]} L${pts[1]}" stroke="${COR.linha}" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/>`);
        partes.push(`<path d="${pts.slice(1).map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ")}" stroke="${COR.linha}" stroke-width="1.4" fill="none"/>`);
      } else {
        partes.push(`<path d="${caminho}" stroke="${COR.linha}" stroke-width="1.4" fill="none"/>`);
      }
      partes.push(`<path d="${peDeGalinha(pts[0], pts[1])}" stroke="${COR.linha}" stroke-width="1.4" fill="none"/>`);
      partes.push(pontaDoPai(pts.at(-1), pts.at(-2), modo));
      if (modo === "relacional") {
        // O nome da FK, como o Data Modeler escreve na linha.
        const [ax, ay] = pts[0], [bx, by] = pts[1];
        const nome = `${t.nome.replace(/^T_/u, "")}_${fk.tabela.replace(/^T_/u, "")}_FK`;
        const horiz = ay === by;
        const lx = horiz ? (ax + bx) / 2 : ax + 5, ly = horiz ? ay - 4 : (ay + by) / 2;
        partes.push(`<text x="${lx}" y="${ly}" font-size="8.5" fill="${COR.suave}" text-anchor="${horiz ? "middle" : "start"}">${esc(nome)}</text>`);
      }
    }
  }
  for (const b of Object.values(porNome)) {
    const xm = b.x + 10, xn = xm + 3 * LETRA, xt = xn + (b.nome + 2) * LETRA;
    partes.push(`<g><rect x="${b.x}" y="${b.y}" width="${b.largura}" height="${b.altura}" rx="${modo === "logico" ? 7 : 2}" fill="${COR.fundo}" stroke="${COR.borda}" stroke-width="1.3"/>`);
    partes.push(`<path d="M${b.x},${b.y + CABECALHO} H${b.x + b.largura}" stroke="${COR.borda}" stroke-width="1"/>`);
    partes.push(`<rect x="${b.x + 0.65}" y="${b.y + 0.65}" width="${b.largura - 1.3}" height="${CABECALHO - 1.3}" rx="${modo === "logico" ? 6 : 1.5}" fill="${COR.cabeca}"/>`);
    partes.push(`<text x="${b.x + b.largura / 2}" y="${b.y + 17.5}" font-size="12.5" font-weight="700" text-anchor="middle" fill="${COR.texto}" font-family="Segoe UI, Arial, sans-serif">${esc(b.titulo)}</text>`);
    b.linhas.forEach(([marca, nome, tipo], i) => {
      const y = b.y + CABECALHO + 14 + i * LINHA;
      partes.push(`<text y="${y}" font-size="11.5" fill="${COR.texto}"><tspan x="${xm}" font-weight="700" fill="${COR.borda}">${esc(marca)}</tspan><tspan x="${xn}">${esc(nome)}</tspan><tspan x="${xt}" fill="${COR.suave}">${esc(tipo)}</tspan></text>`);
    });
    partes.push(`</g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(largura)} ${Math.ceil(altura)}" width="${Math.ceil(largura)}" height="${Math.ceil(altura)}" font-family="Consolas, 'Cascadia Mono', 'Courier New', monospace">
<rect width="100%" height="100%" fill="${COR.fundo}"/>
${partes.join("\n")}
</svg>
`;
}
