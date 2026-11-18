/**
 * Quem volta ao telecentro: as duas regressões da entrega de Data Science
 * (`data-science/analise.ipynb`), refeitas no navegador sobre a mesma base.
 *
 * A preparação é a mesma do notebook, passo a passo, para que os coeficientes
 * batam com os do scikit-learn (o teste confere):
 *
 * - por linha, sem aprender nada: `minutos_no_lab` acima de 4× o estimado vira
 *   desconhecido (o cronômetro ficou ligado), e `ritmo = minutos_no_lab / estimado`;
 * - aprendido **só no treino**: a mediana que imputa os faltantes, a média e o
 *   desvio (populacional) que padronizam as numéricas, as categorias do one-hot
 *   (ordem alfabética, a primeira cai);
 * - a divisão é **por pessoa**: as pessoas do teste são as do notebook
 *   (`GroupShuffleSplit`), gravadas em `referencia_openlabs.json`.
 *
 * A linear é mínimos quadrados (equações normais, eliminação de Gauss). A
 * logística minimiza o mesmo objetivo do `LogisticRegression()` padrão,
 * `½‖w‖² + C·Σ perda logística` com C = 1 e o intercepto sem penalidade, por
 * Newton–Raphson.
 */
export class ErroDoModelo extends Error {}

export type Coluna =
  | "id_sessao" | "id_aluno" | "telecentro" | "idade" | "internet_em_casa" | "distancia_m" | "minutos_caminhada" | "periodo"
  | "lab" | "handbook" | "minutos_estimados" | "labs_concluidos_antes" | "minutos_no_lab" | "usou_showcase" | "nota" | "voltou_em_7_dias";

export interface Referencia {
  readonly pessoas_no_teste: readonly number[];
  readonly linear: { readonly variaveis: readonly string[]; readonly coeficientes: Readonly<Record<string, number>>; readonly MAE: number; readonly RMSE: number; readonly "R²": number };
  readonly logistica: { readonly variaveis: readonly string[]; readonly coeficientes: Readonly<Record<string, number>>; readonly "acurácia": number; readonly "precisão": number; readonly recall: number; readonly F1: number };
}

export interface Base {
  readonly colunas: Readonly<Record<Coluna, readonly (number | string | null)[]>>;
  readonly referencia: Referencia;
}

/** Uma sessão já preparada (cronômetro ligado tratado, ritmo calculado). */
export interface Sessao {
  readonly id_aluno: number;
  readonly idade: number | null;
  readonly internet_em_casa: number;
  readonly minutos_caminhada: number;
  readonly periodo: string;
  readonly handbook: string;
  readonly minutos_estimados: number;
  readonly labs_concluidos_antes: number;
  readonly ritmo: number | null;
  readonly usou_showcase: number;
  readonly nota: number;
  readonly voltou_em_7_dias: number;
}

export function preparar(base: Base): Sessao[] {
  const c = base.colunas;
  const n = c.id_sessao.length;
  const num = (col: Coluna, i: number) => c[col][i] as number;
  const out: Sessao[] = [];
  for (let i = 0; i < n; i += 1) {
    const est = num("minutos_estimados", i);
    const min = num("minutos_no_lab", i);
    const ligado = min > 4 * est;
    out.push({
      id_aluno: num("id_aluno", i),
      idade: c.idade[i] === null ? null : num("idade", i),
      internet_em_casa: num("internet_em_casa", i),
      minutos_caminhada: num("minutos_caminhada", i),
      periodo: c.periodo[i] as string,
      handbook: c.handbook[i] as string,
      minutos_estimados: est,
      labs_concluidos_antes: num("labs_concluidos_antes", i),
      ritmo: ligado ? null : min / est,
      usou_showcase: num("usou_showcase", i),
      nota: num("nota", i),
      voltou_em_7_dias: num("voltou_em_7_dias", i),
    });
  }
  return out;
}

export const NUMERICAS = ["idade", "minutos_caminhada", "labs_concluidos_antes", "ritmo", "minutos_estimados"] as const;
export const BINARIAS = ["internet_em_casa", "usou_showcase"] as const;
export const CATEGORICAS = ["periodo", "handbook"] as const;
export type Numerica = (typeof NUMERICAS)[number] | "nota";
export type Variavel = Numerica | (typeof BINARIAS)[number] | (typeof CATEGORICAS)[number];

export const VARIAVEIS_DA_LINEAR: readonly Variavel[] = [...NUMERICAS, ...BINARIAS, ...CATEGORICAS];
export const VARIAVEIS_DA_LOGISTICA: readonly Variavel[] = [...NUMERICAS, "nota", ...BINARIAS, ...CATEGORICAS];

export type Divisao = "pessoa" | "linha";

export interface Partes {
  readonly treino: readonly Sessao[];
  readonly teste: readonly Sessao[];
  /** Pessoas que têm sessões nos dois lados. Zero na divisão por pessoa. */
  readonly pessoasNosDois: number;
}

/**
 * Por pessoa: as do teste são as do notebook. Por linha: 25% das sessões
 * sorteadas com semente fixa, para mostrar o vazamento.
 */
export function dividir(sessoes: readonly Sessao[], ref: Referencia, divisao: Divisao = "pessoa"): Partes {
  let noTeste: (s: Sessao, i: number) => boolean;
  if (divisao === "pessoa") {
    const ids = new Set(ref.pessoas_no_teste);
    noTeste = (s) => ids.has(s.id_aluno);
  } else {
    const ordem = sessoes.map((_, i) => i);
    let x = 2026;
    for (let i = ordem.length - 1; i > 0; i -= 1) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      const j = x % (i + 1);
      [ordem[i], ordem[j]] = [ordem[j]!, ordem[i]!];
    }
    const sorteadas = new Set(ordem.slice(0, Math.round(sessoes.length * 0.25)));
    noTeste = (_, i) => sorteadas.has(i);
  }
  const treino: Sessao[] = [];
  const teste: Sessao[] = [];
  sessoes.forEach((s, i) => (noTeste(s, i) ? teste : treino).push(s));
  const a = new Set(treino.map((s) => s.id_aluno));
  const pessoasNosDois = new Set(teste.map((s) => s.id_aluno).filter((id) => a.has(id))).size;
  return { treino, teste, pessoasNosDois };
}

// ------------------------------------------------------------------ a matriz

interface Coluna1 {
  readonly nome: string;
  readonly valor: (s: Sessao) => number;
}

export interface Preprocessador {
  readonly nomes: readonly string[];
  readonly linha: (s: Sessao) => number[];
}

const mediana = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
};

/** Ajustado só no treino, como o `ColumnTransformer` do notebook. */
export function ajustarPreprocessador(treino: readonly Sessao[], variaveis: readonly Variavel[]): Preprocessador {
  if (treino.length === 0) throw new ErroDoModelo("the training set is empty");
  const colunas: Coluna1[] = [];
  const valorBruto = (s: Sessao, v: Numerica): number | null => (s as unknown as Record<string, number | null>)[v] ?? null;
  for (const v of [...NUMERICAS, "nota"] as const) {
    if (!variaveis.includes(v)) continue;
    const vistos = treino.map((s) => valorBruto(s, v)).filter((x): x is number => x !== null);
    const med = mediana(vistos);
    const cheios = treino.map((s) => valorBruto(s, v) ?? med);
    const media = cheios.reduce((a, b) => a + b, 0) / cheios.length;
    const dp = Math.sqrt(cheios.reduce((a, b) => a + (b - media) ** 2, 0) / cheios.length) || 1;
    colunas.push({ nome: v, valor: (s) => ((valorBruto(s, v) ?? med) - media) / dp });
  }
  for (const v of BINARIAS) if (variaveis.includes(v)) colunas.push({ nome: v, valor: (s) => s[v] });
  for (const v of CATEGORICAS) {
    if (!variaveis.includes(v)) continue;
    const categorias = [...new Set(treino.map((s) => s[v]))].sort();
    for (const cat of categorias.slice(1)) colunas.push({ nome: `${v}_${cat}`, valor: (s) => (s[v] === cat ? 1 : 0) });
  }
  if (colunas.length === 0) throw new ErroDoModelo("pick at least one input variable");
  return { nomes: colunas.map((c) => c.nome), linha: (s) => colunas.map((c) => c.valor(s)) };
}

/** Resolve A·x = b (A quadrada) por eliminação de Gauss com pivô parcial. */
export function resolver(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((l, i) => [...l, b[i]!]);
  for (let k = 0; k < n; k += 1) {
    let p = k;
    for (let i = k + 1; i < n; i += 1) if (Math.abs(M[i]![k]!) > Math.abs(M[p]![k]!)) p = i;
    if (Math.abs(M[p]![k]!) < 1e-12) throw new ErroDoModelo("the inputs are collinear: one of them is a combination of the others");
    [M[k], M[p]] = [M[p]!, M[k]!];
    for (let i = k + 1; i < n; i += 1) {
      const f = M[i]![k]! / M[k]![k]!;
      for (let j = k; j <= n; j += 1) M[i]![j]! -= f * M[k]![j]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let s = M[i]![n]!;
    for (let j = i + 1; j < n; j += 1) s -= M[i]![j]! * x[j]!;
    x[i] = s / M[i]![i]!;
  }
  return x;
}

export interface Modelo {
  readonly nomes: readonly string[];
  readonly intercepto: number;
  readonly pesos: readonly number[];
  readonly prever: (s: Sessao) => number;
}

/** Mínimos quadrados, com intercepto. */
export function regressaoLinear(treino: readonly Sessao[], variaveis: readonly Variavel[] = VARIAVEIS_DA_LINEAR): Modelo {
  const prep = ajustarPreprocessador(treino, variaveis);
  const X = treino.map((s) => [1, ...prep.linha(s)]);
  const y = treino.map((s) => s.nota);
  const p = X[0]!.length;
  const XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((a, l) => a + l[i]! * l[j]!, 0)));
  const Xty = Array.from({ length: p }, (_, i) => X.reduce((a, l, k) => a + l[i]! * y[k]!, 0));
  const w = resolver(XtX, Xty);
  const [b, ...pesos] = w;
  return { nomes: prep.nomes, intercepto: b!, pesos, prever: (s) => prep.linha(s).reduce((a, x, k) => a + x * pesos[k]!, b!) };
}

const sigmoide = (z: number) => 1 / (1 + Math.exp(-z));

/** Logística com L2 (C = 1, intercepto livre), por Newton–Raphson. `prever` dá a probabilidade. */
export function regressaoLogistica(treino: readonly Sessao[], variaveis: readonly Variavel[] = VARIAVEIS_DA_LOGISTICA, C = 1): Modelo {
  const prep = ajustarPreprocessador(treino, variaveis);
  const X = treino.map((s) => [1, ...prep.linha(s)]);
  const y = treino.map((s) => s.voltou_em_7_dias);
  const p = X[0]!.length;
  let w = new Array<number>(p).fill(0);
  for (let iter = 0; iter < 50; iter += 1) {
    const g = w.map((wi, j) => (j === 0 ? 0 : wi));
    const H = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => (i === j && i > 0 ? 1 : 0)));
    X.forEach((l, k) => {
      const q = sigmoide(l.reduce((a, x, j) => a + x * w[j]!, 0));
      const r = C * (q - y[k]!);
      const peso = C * q * (1 - q);
      for (let i = 0; i < p; i += 1) {
        g[i]! += r * l[i]!;
        for (let j = 0; j < p; j += 1) H[i]![j]! += peso * l[i]! * l[j]!;
      }
    });
    const passo = resolver(H, g);
    w = w.map((wi, j) => wi - passo[j]!);
    if (Math.max(...passo.map(Math.abs)) < 1e-10) break;
  }
  const [b, ...pesos] = w;
  return { nomes: prep.nomes, intercepto: b!, pesos, prever: (s) => sigmoide(prep.linha(s).reduce((a, x, k) => a + x * pesos[k]!, b!)) };
}

// ------------------------------------------------------------------ as métricas

export interface MetricasDeRegressao {
  readonly MAE: number;
  readonly RMSE: number;
  readonly R2: number;
}

export function metricasDeRegressao(y: readonly number[], p: readonly number[]): MetricasDeRegressao {
  const n = y.length;
  const media = y.reduce((a, b) => a + b, 0) / n;
  let abs = 0;
  let sq = 0;
  let tot = 0;
  y.forEach((v, i) => {
    abs += Math.abs(v - p[i]!);
    sq += (v - p[i]!) ** 2;
    tot += (v - media) ** 2;
  });
  return { MAE: abs / n, RMSE: Math.sqrt(sq / n), R2: 1 - sq / tot };
}

export interface Matriz {
  /** Verdadeiro positivo: previu "volta" e voltou. */
  readonly vp: number;
  readonly fp: number;
  readonly fn: number;
  readonly vn: number;
}

export interface MetricasDeClassificacao extends Matriz {
  readonly acuracia: number;
  readonly precisao: number;
  readonly recall: number;
  readonly F1: number;
}

/** Classe positiva = 1 ("volta"), como no `precision_score` padrão. */
export function metricasDeClassificacao(y: readonly number[], prob: readonly number[], corte = 0.5): MetricasDeClassificacao {
  let vp = 0, fp = 0, fn = 0, vn = 0;
  y.forEach((v, i) => {
    const previu = prob[i]! >= corte ? 1 : 0;
    if (previu === 1 && v === 1) vp += 1;
    else if (previu === 1) fp += 1;
    else if (v === 1) fn += 1;
    else vn += 1;
  });
  const precisao = vp + fp === 0 ? 0 : vp / (vp + fp);
  const recall = vp + fn === 0 ? 0 : vp / (vp + fn);
  return { vp, fp, fn, vn, acuracia: (vp + vn) / y.length, precisao, recall, F1: precisao + recall === 0 ? 0 : (2 * precisao * recall) / (precisao + recall) };
}

export interface Analise {
  readonly partes: Partes;
  readonly linear: Modelo;
  readonly logistica: Modelo;
  readonly notaPrevista: readonly number[];
  readonly probabilidade: readonly number[];
  readonly regressao: MetricasDeRegressao;
  readonly linhaDeBase: MetricasDeRegressao;
}

/** A análise do notebook inteira, para uma escolha de divisão e de variáveis. */
export function analisar(base: Base, opcoes: { divisao?: Divisao; linear?: readonly Variavel[]; logistica?: readonly Variavel[] } = {}): Analise {
  const partes = dividir(preparar(base), base.referencia, opcoes.divisao ?? "pessoa");
  const linear = regressaoLinear(partes.treino, opcoes.linear ?? VARIAVEIS_DA_LINEAR);
  const logistica = regressaoLogistica(partes.treino, opcoes.logistica ?? VARIAVEIS_DA_LOGISTICA);
  const notaPrevista = partes.teste.map(linear.prever);
  const probabilidade = partes.teste.map(logistica.prever);
  const y = partes.teste.map((s) => s.nota);
  const mediaDoTreino = partes.treino.reduce((a, s) => a + s.nota, 0) / partes.treino.length;
  return {
    partes,
    linear,
    logistica,
    notaPrevista,
    probabilidade,
    regressao: metricasDeRegressao(y, notaPrevista),
    linhaDeBase: metricasDeRegressao(y, y.map(() => mediaDoTreino)),
  };
}

/** Retorno médio previsto para as mesmas sessões, mudando só os minutos de caminhada. */
export function retornoPorCaminhada(a: Analise, minutos: readonly number[]): number[] {
  return minutos.map((m) => {
    const ps = a.partes.teste.map((s) => a.logistica.prever({ ...s, minutos_caminhada: m }));
    return ps.reduce((x, y) => x + y, 0) / ps.length;
  });
}
