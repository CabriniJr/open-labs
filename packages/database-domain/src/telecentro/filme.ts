import { connect, elbow, film, pt, through, type Box, type Director, type Film, type Path, type Point, type Segment, type Tone } from "@ovh/motion";
import { ICONE_APP, ICONES_BANCO } from "../icones.js";
import { CONSULTAS } from "./consultas.js";
import { SOBRE_A_CONSULTA } from "./labels.js";
import { constraintsDe, nivelDe, tabela, TABELAS, type NomeDaTabela } from "./esquema.js";
import { bancoInicial, consulta1, consulta2, consulta3, inserir, linhasDe, proximoId, type Banco, type Juncao, type Linha, type Recusa } from "./motor.js";
import type { Valor } from "./dados.js";

/**
 * O filme do banco do OpenLabs, derivado do motor: nada aqui decide se uma
 * escrita passa ou é recusada, nem o que uma consulta devolve. O filme pergunta
 * ao `motor.ts` e desenha a resposta.
 *
 * Uma aluna se cadastra no balcão do telecentro. A linha dela atravessa as
 * regras do banco (NOT NULL, chave primária, CHECK, chave estrangeira) até
 * entrar em T_ALUNO. Depois vêm a cardinalidade (1:N e N:N), uma escrita que o
 * banco recusa, e as três consultas da entrega — com a aluna nova aparecendo
 * nos resultados, porque a consulta lê o banco que o filme acabou de mudar.
 *
 * No 3D a altura é a distância até uma tabela que não aponta para ninguém
 * (`nivelDe`): cada tabela fica de pé sobre as tabelas que ela referencia. É a
 * ordem do CREATE TABLE e dos INSERTs — quem está embaixo nasce antes.
 */
export interface ResultadoNoPainel {
  readonly titulo: string;
  readonly colunas: readonly string[];
  readonly linhas: readonly (readonly Valor[])[];
  /** Quantas linhas o resultado tem de verdade (o painel pode mostrar menos). */
  readonly total: number;
  /** Índices das linhas a acender (a aluna nova, por exemplo). */
  readonly destaque?: readonly number[];
}

export interface DetalheDoBanco {
  /** O comando SQL deste passo. */
  readonly sql: string;
  readonly linhas: readonly (readonly [string, string])[];
  readonly resultado?: ResultadoNoPainel;
  /** O que o banco respondeu, como o SQL Developer mostra. */
  readonly resposta?: { readonly ok: boolean; readonly texto: string };
  /** Colunas a acender no diagrama: `T_ALUNO.id_telecentro`. */
  readonly realce: readonly string[];
}

export type ErroDoFilme = "nota" | "pai" | "repetido";

export interface OpcoesDoBanco {
  /** A escrita que o capítulo "o banco diz não" tenta. */
  readonly erro: ErroDoFilme;
  /** A junção da consulta 3: com INNER, o resultado some. */
  readonly juncao: Juncao;
}

export const OPCOES_DO_BANCO: OpcoesDoBanco = { erro: "pai", juncao: "left" };

export const CAPITULOS_DO_BANCO = ["mapa", "tabela", "insert", "um-para-muitos", "muitos-para-muitos", "recusa", "inner", "agrupar", "left"] as const;
export type CapituloDoBanco = (typeof CAPITULOS_DO_BANCO)[number];

// ------------------------------------------------------------------ o desenho

export const LARGURA_DO_BANCO = 1280;
export const ALTURA_DO_BANCO = 720;
/** Altura do cabeçalho da tabela e de cada linha de coluna, no diagrama. */
export const CABECALHO = 34;
export const LINHA = 15;
const LARGURA = 210;

const POSICAO: Readonly<Record<NomeDaTabela, readonly [number, number]>> = {
  T_MONITOR: [26, 100],
  T_TELECENTRO: [26, 262],
  T_COMPUTADOR: [26, 470],
  T_ALUNO: [280, 262],
  T_PROGRESSO: [534, 130],
  T_TENTATIVA: [534, 420],
  T_LAB: [790, 130],
  T_AVALIACAO: [790, 420],
  T_FASE: [1040, 130],
  T_HANDBOOK: [1040, 320],
};

/** A caixa de cada tabela: o cabeçalho e uma linha por coluna. */
export const CAIXAS_DO_BANCO: Readonly<Record<NomeDaTabela, Box>> = Object.fromEntries(
  TABELAS.map((t) => {
    const [x, y] = POSICAO[t.nome];
    return [t.nome, { x, y, w: LARGURA, h: CABECALHO + t.colunas.length * LINHA + 8 }];
  }),
) as Record<NomeDaTabela, Box>;

export const CAIXA_DO_APP: Box = { x: 280, y: 470, w: LARGURA, h: 64 };

export type GrupoDeTabela = "cadastro" | "acompanhamento" | "catalogo";

export const GRUPO: Readonly<Record<NomeDaTabela, GrupoDeTabela>> = {
  T_TELECENTRO: "cadastro",
  T_MONITOR: "cadastro",
  T_ALUNO: "cadastro",
  T_COMPUTADOR: "cadastro",
  T_HANDBOOK: "catalogo",
  T_FASE: "catalogo",
  T_LAB: "catalogo",
  T_AVALIACAO: "catalogo",
  T_PROGRESSO: "acompanhamento",
  T_TENTATIVA: "acompanhamento",
};

/** A cor de uma tabela diz o grupo dela: cadastro, catálogo ou acompanhamento (as associativas). */
export const TOM_DO_GRUPO: Readonly<Record<GrupoDeTabela, Tone>> = { cadastro: "processor", catalogo: "container", acompanhamento: "conduit" };

export const REGIOES_DO_BANCO: Readonly<Record<GrupoDeTabela, { readonly box: Box; readonly label: string }>> = {
  cadastro: { box: { x: 6, y: 66, w: 494, h: 556 }, label: "registration · who and where" },
  acompanhamento: { box: { x: 520, y: 96, w: 234, h: 476 }, label: "tracking · who did what" },
  catalogo: { box: { x: 766, y: 96, w: 508, h: 476 }, label: "catalogue · what there is to learn" },
};

/** A cor de uma ficha diz o que ela é. */
export const TOM_DA_FICHA = { escrita: "kind-1", chave: "kind-4", juncao: "kind-2", grupo: "kind-3", nulo: "muted", recusa: "live" } as const satisfies Record<string, Tone>;

/** O centro vertical da linha de uma coluna, dentro da caixa da tabela. */
export function yDaColuna(nome: NomeDaTabela, coluna: string): number {
  const t = tabela(nome);
  const i = Math.max(0, t.colunas.findIndex((c) => c.nome === coluna));
  return CAIXAS_DO_BANCO[nome].y + CABECALHO + i * LINHA + LINHA / 2;
}

/**
 * As tabelas uma acima da outra, na mesma coluna, ligam-se por fora: a linha
 * sai pela borda indicada, contorna e volta. As outras ligam-se pela borda que
 * olha para a outra tabela.
 */
const LADO_DO_CONTORNO: Partial<Record<NomeDaTabela, "esq" | "dir">> = { T_MONITOR: "esq", T_COMPUTADOR: "esq", T_AVALIACAO: "esq", T_FASE: "dir" };

export interface LigacaoDoBanco {
  readonly id: string;
  readonly filha: NomeDaTabela;
  readonly coluna: string;
  readonly pai: NomeDaTabela;
  readonly pk: string;
  /** Da coluna FK na filha até a PK no pai. */
  readonly caminho: Path;
  /** Onde a linha toca a filha e o pai, e para que lado sai de cada um (−1 esquerda, +1 direita). */
  readonly naFilha: Point;
  readonly noPai: Point;
  readonly saidaFilha: -1 | 1;
  readonly saidaPai: -1 | 1;
  /** A filha precisa ter ao menos uma linha por pai (1..N) ou pode não ter nenhuma (0..N). */
  readonly minimo: 0 | 1;
  readonly cardinalidade: string;
}

export const LIGACOES_DO_BANCO: readonly LigacaoDoBanco[] = TABELAS.flatMap((t) =>
  (t.fks ?? []).map((f): LigacaoDoBanco => {
    const pai = tabela(f.tabela);
    const a = CAIXAS_DO_BANCO[t.nome];
    const b = CAIXAS_DO_BANCO[f.tabela];
    const ya = yDaColuna(t.nome, f.coluna);
    const yb = yDaColuna(f.tabela, pai.pk);
    const contorno = a.x === b.x ? (LADO_DO_CONTORNO[t.nome] ?? "esq") : undefined;
    let naFilha: Point;
    let noPai: Point;
    let caminho: Path;
    let saidaFilha: -1 | 1;
    let saidaPai: -1 | 1;
    if (contorno !== undefined) {
      const lado = contorno === "esq" ? -1 : 1;
      const x = lado < 0 ? a.x : a.x + a.w;
      naFilha = pt(x, ya);
      noPai = pt(x, yb);
      caminho = through([naFilha, pt(x + lado * 18, ya), pt(x + lado * 18, yb), noPai]);
      saidaFilha = lado;
      saidaPai = lado;
    } else {
      const paraDireita = b.x > a.x;
      naFilha = pt(paraDireita ? a.x + a.w : a.x, ya);
      noPai = pt(paraDireita ? b.x : b.x + b.w, yb);
      caminho = elbow(naFilha, noPai, 10);
      saidaFilha = paraDireita ? 1 : -1;
      saidaPai = paraDireita ? -1 : 1;
    }
    return {
      id: `fk:${t.nome}-${f.tabela}`,
      filha: t.nome,
      coluna: f.coluna,
      pai: f.tabela,
      pk: pai.pk,
      caminho,
      naFilha,
      noPai,
      saidaFilha,
      saidaPai,
      minimo: /tem 1 ou muit/u.test(f.cardinalidade) ? 1 : 0,
      cardinalidade: f.cardinalidade,
    };
  }),
);

const ligacao = (filha: NomeDaTabela, pai: NomeDaTabela): LigacaoDoBanco => {
  const l = LIGACOES_DO_BANCO.find((x) => x.filha === filha && x.pai === pai);
  if (l === undefined) throw new Error(`não há FK de ${filha} para ${pai}`);
  return l;
};

/** O mesmo caminho, de trás para a frente: a resposta que volta pela FK. */
export function inverter(p: Path): Path {
  const pontos: Point[] = [p.from, ...p.segments.map((s) => s.to)];
  const segmentos: Segment[] = [];
  for (let i = p.segments.length - 1; i >= 0; i -= 1) {
    const s = p.segments[i];
    const to = pontos[i];
    if (s === undefined || to === undefined) continue;
    if (s.type === "line") segmentos.push({ type: "line", to });
    else if (s.type === "quad") segmentos.push({ type: "quad", c: s.c, to });
    else segmentos.push({ type: "cubic", c1: s.c2, c2: s.c1, to });
  }
  return { from: pontos.at(-1) ?? p.from, segments: segmentos };
}

// ------------------------------------------------------------------ o roteiro

/** A aluna que se cadastra no capítulo do INSERT. Dados simulados. */
export function alunaNova(b: Banco): Readonly<Record<string, Valor>> {
  return { id_aluno: proximoId(b, "T_ALUNO"), id_telecentro: 1, nm_aluno: "Nina Prado Lopes", dt_nascimento: "2009-02-02", ds_email: null, dt_cadastro: "2026-11-01" };
}

const literal = (v: Valor, data: boolean) => (v === null ? "NULL" : typeof v === "number" ? String(v) : data ? `DATE '${v}'` : `'${v.replaceAll("'", "''")}'`);

/** O INSERT em SQL, para o painel. */
export function sqlDoInsert(nome: NomeDaTabela, valores: Readonly<Record<string, Valor>>): string {
  const t = tabela(nome);
  const cols = t.colunas.filter((c) => c.nome in valores);
  return `INSERT INTO ${nome}\n  (${cols.map((c) => c.nome).join(", ")})\nVALUES\n  (${cols.map((c) => literal(valores[c.nome] ?? null, c.tipo === "DATE")).join(", ")});`;
}

/** As escritas erradas que o capítulo "o banco diz não" pode tentar. */
export function escritaErrada(b: Banco, erro: ErroDoFilme): { tabela: NomeDaTabela; valores: Readonly<Record<string, Valor>>; rotulo: string } {
  if (erro === "nota") return { tabela: "T_TENTATIVA", valores: { id_tentativa: proximoId(b, "T_TENTATIVA"), id_aluno: 2, id_avaliacao: 1, dt_envio: "2026-11-02", nr_acertos: 5, vl_nota: 11 }, rotulo: "grade 11" };
  if (erro === "repetido") return { tabela: "T_PROGRESSO", valores: { id_progresso: proximoId(b, "T_PROGRESSO"), id_aluno: 1, id_lab: 1, dt_inicio: "2026-11-02", dt_conclusao: null }, rotulo: "learner 1 · lab 1 again" };
  return { tabela: "T_ALUNO", valores: { ...alunaNova(b), id_aluno: proximoId(b, "T_ALUNO"), nm_aluno: "Otávio Reis Mendes", id_telecentro: 77 }, rotulo: "telecentre 77" };
}

const limite = (r: { colunas: readonly string[]; linhas: readonly (readonly Valor[])[] }, titulo: string, max = 6, destaque?: (l: readonly Valor[]) => boolean): ResultadoNoPainel => {
  const linhas = r.linhas.slice(0, max);
  const d = destaque === undefined ? [] : linhas.flatMap((l, i) => (destaque(l) ? [i] : []));
  return { titulo, colunas: r.colunas, linhas, total: r.linhas.length, ...(d.length > 0 ? { destaque: d } : {}) };
};

const comoResultado = (colunas: readonly string[], linhas: readonly Linha[]) => ({ colunas: colunas.map((c) => c.toUpperCase()), linhas: linhas.map((l) => colunas.map((c) => l[c] ?? null)) });

export function filmeDoBanco(opcoes: OpcoesDoBanco = OPCOES_DO_BANCO): Film<DetalheDoBanco> {
  const f = film<DetalheDoBanco>({ width: LARGURA_DO_BANCO, height: ALTURA_DO_BANCO, gap: 400, maxZoom: 1.7 });
  const b0 = bancoInicial();
  const cont = (b: Banco, nome: NomeDaTabela) => `${linhasDe(b, nome).length} rows`;

  // ------------------------------------------------------------ o cenário
  for (const [g, r] of Object.entries(REGIOES_DO_BANCO) as [GrupoDeTabela, (typeof REGIOES_DO_BANCO)[GrupoDeTabela]][]) {
    f.add({ type: "region", id: `grupo:${g}`, box: r.box, label: r.label, tone: TOM_DO_GRUPO[g] });
  }
  for (const t of TABELAS) {
    f.add({ type: "node", id: t.nome, box: CAIXAS_DO_BANCO[t.nome], label: t.nome, sublabel: cont(b0, t.nome), tone: TOM_DO_GRUPO[GRUPO[t.nome]], icon: ICONES_BANCO[t.nome], elevation: nivelDe(t.nome) * 16, height: 10 });
  }
  f.add({ type: "node", id: "app", box: CAIXA_DO_APP, label: "OpenLabs app", sublabel: "the telecentre desk", tone: "ink", shape: "pill", icon: ICONE_APP, elevation: 0, height: 8 });
  for (const l of LIGACOES_DO_BANCO) f.add({ type: "link", id: l.id, path: l.caminho, label: "", tone: "muted" });
  f.add({ type: "note", id: "nota:resposta", at: pt(CAIXA_DO_APP.x + CAIXA_DO_APP.w / 2, CAIXA_DO_APP.y + CAIXA_DO_APP.h + 26), label: "", tone: "ink", align: "middle", width: 300, hidden: true });

  let n = 0;
  const ficha = (path: Path, label: string, tone: Tone, sublabel = "", elevation = 40) => {
    const id = `ficha:${(n += 1)}`;
    f.add({ type: "token", id, path, label, sublabel, tone, hidden: true, size: 4.5, elevation });
    return id;
  };
  const todas = TABELAS.map((t) => t.nome);
  const resposta = (d: Director<DetalheDoBanco>, texto: string, tone: Tone) => d.set("nota:resposta", { label: texto, tone, opacity: 1 });
  const silencio = (d: Director<DetalheDoBanco>) => d.set("nota:resposta", { label: "", opacity: 0 });

  // ------------------------------------------------------------ 1. o mapa
  const contagem = comoResultado(["table_name", "num_rows"], TABELAS.map((t) => ({ table_name: t.nome, num_rows: linhasDe(b0, t.nome).length })));
  f.chapter(
    {
      id: "mapa",
      title: "Ten tables, three jobs",
      body: "Registration says who and where. The catalogue says what there is to learn. Tracking records what each learner did. Every line between two tables is a foreign key.",
      detail: {
        sql: "SELECT table_name, num_rows\n  FROM user_tables\n ORDER BY table_name;",
        linhas: [
          ["tables", String(TABELAS.length)],
          ["foreign keys", String(LIGACOES_DO_BANCO.length)],
          ["rows of sample data", String(TABELAS.reduce((s, t) => s + linhasDe(b0, t.nome).length, 0))],
        ],
        resultado: limite(contagem, "user_tables", 10),
        realce: [],
      },
    },
    (d) => {
      d.camera({ box: { x: 0, y: 0, w: LARGURA_DO_BANCO, h: ALTURA_DO_BANCO } }, { dur: 0 });
      d.stagger(["cadastro", "catalogo", "acompanhamento"] as const, 260, (x, g) => x.glow(`grupo:${g}`, 0.6).glow(`grupo:${g}`, 0, { delay: 900 }));
      d.wait(600);
      d.together(...LIGACOES_DO_BANCO.map((l) => (x: Director<DetalheDoBanco>) => x.draw(l.id, { dur: 700 })));
      d.beat({ title: "Height is the order of creation", body: "In 3D, each table stands on the tables it points to. The ones on the floor point to no one, so they are created and filled first." }).wait(2200);
    },
  );

  // ------------------------------------------------------------ 2. uma tabela
  const aluno = tabela("T_ALUNO");
  f.chapter(
    {
      id: "tabela",
      title: "A table is a grid with a key",
      body: "T_ALUNO has one row per learner and one column per property, always of the same type. The primary key, id_aluno, tells two learners apart even when they share a name.",
      detail: {
        sql: "SELECT id_aluno, nm_aluno, id_telecentro, st_ativo\n  FROM T_ALUNO;",
        linhas: [
          ["row", "one learner"],
          ["column", "one property, one type"],
          ["primary key", "id_aluno — unique, never NULL"],
          ["columns", aluno.colunas.map((c) => c.nome).join(" · ")],
        ],
        resultado: limite(comoResultado(["id_aluno", "nm_aluno", "id_telecentro", "st_ativo"], linhasDe(b0, "T_ALUNO")), "T_ALUNO"),
        realce: ["T_ALUNO.id_aluno"],
      },
    },
    (d) => {
      d.camera({ focus: ["T_ALUNO", "T_TELECENTRO"], pad: 70 });
      d.dim(todas.filter((x) => x !== "T_ALUNO"), 0.6);
      d.glow("T_ALUNO").ping("T_ALUNO");
      d.wait(2600);
      d.glow("T_ALUNO", 0);
    },
  );

  // ------------------------------------------------------------ 3. INSERT
  const nina = alunaNova(b0);
  const insert = inserir(b0, "T_ALUNO", nina);
  if (!insert.ok) throw new Error(`a aluna do filme deveria entrar: ${insert.recusa.mensagem}`);
  const b1 = insert.banco;
  const sqlNina = sqlDoInsert("T_ALUNO", nina);
  const fkAluno = ligacao("T_ALUNO", "T_TELECENTRO");
  const telecentro1 = linhasDe(b0, "T_TELECENTRO").find((t) => t.id_telecentro === nina.id_telecentro);
  const passoInsert = (linhas: (readonly [string, string])[], realce: string[], extra: Partial<DetalheDoBanco> = {}): DetalheDoBanco => ({ sql: sqlNina, linhas, realce, ...extra });
  f.chapter(
    {
      id: "insert",
      title: "INSERT: a learner signs up",
      body: `${String(nina.nm_aluno)} signs up at the desk. Before her row exists, the database checks it against every rule of T_ALUNO — the last one needs to look into another table.`,
      detail: passoInsert([["statement", "DML · INSERT"]], []),
    },
    (d) => {
      d.dim(todas, 0).dim(todas.filter((x) => x !== "T_ALUNO" && x !== "T_TELECENTRO"), 0.6);
      d.camera({ box: { x: 16, y: 230, w: 500, h: 330 } });
      silencio(d);
      const ida = ficha(connect(CAIXA_DO_APP, CAIXAS_DO_BANCO.T_ALUNO, 6), `row ${String(nina.id_aluno)}`, TOM_DA_FICHA.escrita, String(nina.nm_aluno), 20);
      d.packet({ tag: "INSERT", tone: TOM_DA_FICHA.escrita, from: "OpenLabs app", to: "T_ALUNO", protocol: "DML", payload: sqlNina });
      d.glow("app").send(ida, { dur: 900 }).glow("app", 0).ping("T_ALUNO");
      d.beat({ title: "NOT NULL, type and size", body: "Every required column has a value, and every value fits its type: a DATE is a real date, nm_aluno fits VARCHAR2(80).", detail: passoInsert([["NOT NULL", "nm_aluno, dt_nascimento, dt_cadastro… ✓"], ["ds_email", "NULL — allowed, the column is optional"], ["types", "DATE · VARCHAR2(80) · NUMBER(8) ✓"]], ["T_ALUNO.nm_aluno", "T_ALUNO.ds_email"]) }).wait(1900);
      d.beat({ title: "Primary key and DEFAULT", body: `id_aluno ${String(nina.id_aluno)} is not taken. st_ativo was left out, so the DEFAULT fills it with 'S', and the CHECK accepts it.`, detail: passoInsert([["PK_ALUNO", `id_aluno = ${String(nina.id_aluno)} is free ✓`], ["DEFAULT", "st_ativo = 'S'"], ["CK_ALUNO_ATIVO", "st_ativo IN ('S', 'N') ✓"]], ["T_ALUNO.id_aluno", "T_ALUNO.st_ativo"]) }).wait(1900);
      const fk = ficha(fkAluno.caminho, `id_telecentro = ${String(nina.id_telecentro)}?`, TOM_DA_FICHA.chave, "", 24);
      const volta = ficha(inverter(fkAluno.caminho), "found ✓", TOM_DA_FICHA.chave, "", 24);
      d.beat({ title: "Foreign key: does the parent exist?", body: `The row says id_telecentro = ${String(nina.id_telecentro)}. The database looks it up in T_TELECENTRO before accepting.`, detail: passoInsert([["FK_ALUNO_TELECENTRO", "T_ALUNO.id_telecentro → T_TELECENTRO.id_telecentro"], ["looking for", `id_telecentro = ${String(nina.id_telecentro)}`]], ["T_ALUNO.id_telecentro", "T_TELECENTRO.id_telecentro"]) });
      d.glow(fkAluno.id, 1).send(fk, { dur: 800 }).glow("T_TELECENTRO").ping("T_TELECENTRO");
      d.wait(500).send(volta, { dur: 800 }).glow(["T_TELECENTRO", fkAluno.id], 0);
      d.set("T_ALUNO", { sublabel: cont(b1, "T_ALUNO") }).ping("T_ALUNO");
      resposta(d, insert.mensagem, "conduit");
      d.beat({
        title: "1 row inserted.",
        body: `Telecentre ${String(nina.id_telecentro)} exists (${String(telecentro1?.nm_telecentro)}), so the row goes in. T_ALUNO now has ${linhasDe(b1, "T_ALUNO").length} rows — and every query from now on sees her.`,
        detail: passoInsert([["result", insert.mensagem], ["T_ALUNO", cont(b1, "T_ALUNO")]], [`T_ALUNO.id_aluno`], { resposta: { ok: true, texto: insert.mensagem }, resultado: limite(comoResultado(["id_aluno", "nm_aluno", "id_telecentro", "st_ativo"], linhasDe(b1, "T_ALUNO").slice(-3)), "T_ALUNO (last rows)", 3, (l) => l[0] === nina.id_aluno) }),
      }).wait(2400);
    },
  );

  // ------------------------------------------------------------ 4. 1:N
  const porTelecentro = linhasDe(b1, "T_TELECENTRO").map((t) => ({
    nm_telecentro: t.nm_telecentro ?? null,
    alunos: linhasDe(b1, "T_ALUNO").filter((a) => a.id_telecentro === t.id_telecentro).length,
    monitores: linhasDe(b1, "T_MONITOR").filter((a) => a.id_telecentro === t.id_telecentro).length,
    computadores: linhasDe(b1, "T_COMPUTADOR").filter((a) => a.id_telecentro === t.id_telecentro).length,
  }));
  const fksDoTelecentro = LIGACOES_DO_BANCO.filter((l) => l.pai === "T_TELECENTRO");
  const fkAlunoSql = constraintsDe(aluno).find((k) => k.tipo === "FK");
  f.chapter(
    {
      id: "um-para-muitos",
      title: "One telecentre, many learners (1:N)",
      body: "The foreign key lives on the “many” side: each learner stores the id of their one telecentre. A telecentre stores nothing about its learners — they point to it.",
      detail: {
        sql: `ALTER TABLE T_ALUNO\n  ADD CONSTRAINT ${fkAlunoSql?.nome ?? ""}\n  ${fkAlunoSql?.sql ?? ""};`,
        linhas: fksDoTelecentro.map((l) => [l.filha, `${l.minimo === 1 ? "1..N" : "0..N"} per telecentre · exactly 1 telecentre each`] as const),
        resultado: limite(comoResultado(["nm_telecentro", "alunos", "monitores", "computadores"], porTelecentro), "rows that point to each telecentre"),
        realce: fksDoTelecentro.flatMap((l) => [`${l.filha}.${l.coluna}`, `${l.pai}.${l.pk}`]),
      },
    },
    (d) => {
      silencio(d);
      d.dim(todas, 0).dim(todas.filter((x) => GRUPO[x] !== "cadastro"), 0.6);
      d.camera({ box: { x: 0, y: 60, w: 530, h: 570 } });
      d.glow(fksDoTelecentro.map((l) => l.id)).glow("T_TELECENTRO");
      for (const l of fksDoTelecentro) {
        const ids = [0, 1, 2].map(() => ficha(l.caminho, "→ 1", TOM_DA_FICHA.chave, "", 24));
        d.stagger(ids, 180, (x, id) => x.send(id, { dur: 800 }));
      }
      d.ping("T_TELECENTRO");
      d.beat({ title: "Reading the crow's foot", body: "The fork on the learner's side means “many”; the bar on the telecentre's side means “exactly one”. A circle before the fork means the many may be zero — a new telecentre can have no learners yet." }).wait(2600);
      d.glow([...fksDoTelecentro.map((l) => l.id), "T_TELECENTRO"], 0);
    },
  );

  // ------------------------------------------------------------ 5. N:N
  const prog = linhasDe(b1, "T_PROGRESSO");
  const labsDaAna = prog.filter((p) => p.id_aluno === 1).length;
  const alunosDoLab1 = prog.filter((p) => p.id_lab === 1).length;
  const fkPa = ligacao("T_PROGRESSO", "T_ALUNO");
  const fkPl = ligacao("T_PROGRESSO", "T_LAB");
  f.chapter(
    {
      id: "muitos-para-muitos",
      title: "Many labs per learner, many learners per lab (N:N)",
      body: "A column can hold one value, so neither table can list the other. The relational answer is a table in between: each row of T_PROGRESSO is one learner in one lab, with the dates.",
      detail: {
        sql: "ALTER TABLE T_PROGRESSO\n  ADD CONSTRAINT UK_PROGRESSO_ALUNO_LAB\n  UNIQUE (id_aluno, id_lab);",
        linhas: [
          ["T_ALUNO 1 — N T_PROGRESSO", "a learner has many progress rows"],
          ["T_PROGRESSO N — 1 T_LAB", "a lab has many progress rows"],
          ["learner 1", `${labsDaAna} labs`],
          ["lab 1", `${alunosDoLab1} learners`],
          ["UNIQUE (id_aluno, id_lab)", "one row per learner per lab"],
        ],
        resultado: limite(comoResultado(["id_progresso", "id_aluno", "id_lab", "dt_inicio", "dt_conclusao"], prog), "T_PROGRESSO"),
        realce: ["T_PROGRESSO.id_aluno", "T_PROGRESSO.id_lab", "T_ALUNO.id_aluno", "T_LAB.id_lab"],
      },
    },
    (d) => {
      d.dim(todas, 0).dim(todas.filter((x) => !["T_ALUNO", "T_PROGRESSO", "T_LAB", "T_TENTATIVA", "T_AVALIACAO"].includes(x)), 0.6);
      d.camera({ box: { x: 280, y: 110, w: 750, h: 470 } });
      d.glow("T_PROGRESSO").glow([fkPa.id, fkPl.id]);
      const pares = [0, 1, 2].map(() => [ficha(fkPa.caminho, "id_aluno", TOM_DA_FICHA.chave, "", 40), ficha(fkPl.caminho, "id_lab", TOM_DA_FICHA.chave, "", 40)] as const);
      d.stagger(pares, 420, (x, [a, l]) => x.together((y) => y.send(a, { dur: 800 }), (y) => y.send(l, { dur: 800 })));
      d.ping(["T_ALUNO", "T_LAB"]);
      d.beat({ title: "T_TENTATIVA does the same for assessments", body: "A learner answers many assessments, an assessment is answered by many learners: T_TENTATIVA sits between them, and also keeps the grade of each attempt." }).glow(["T_TENTATIVA"]).wait(2400);
      d.glow(["T_PROGRESSO", "T_TENTATIVA", fkPa.id, fkPl.id], 0);
    },
  );

  // ------------------------------------------------------------ 6. o banco diz não
  const errada = escritaErrada(b1, opcoes.erro);
  const recusa = inserir(b1, errada.tabela, errada.valores);
  if (recusa.ok) throw new Error("a escrita errada do filme deveria ser recusada");
  const r: Recusa = recusa.recusa;
  const sqlErrado = sqlDoInsert(errada.tabela, errada.valores);
  const realceDaRecusa = (r.coluna ?? "").split(", ").filter(Boolean).map((c) => `${errada.tabela}.${c}`);
  const porque: Record<ErroDoFilme, string> = {
    nota: "The grade passes NOT NULL and fits NUMBER(4,2), but the CHECK says a grade lives between 0 and 10. FALSE means no.",
    pai: "Every rule of T_ALUNO passes until the last one: there is no telecentre 77 in T_TELECENTRO, so the learner would point at nothing.",
    repetido: "Learner 1 already has a progress row for lab 1. The UNIQUE pair (id_aluno, id_lab) keeps one row per learner per lab.",
  };
  f.chapter(
    {
      id: "recusa",
      title: "The database says no",
      body: "Rules in the database hold for every program that writes to it — the site, the Java API, someone at SQL Developer. Change the bad write below the stage and watch which rule catches it.",
      detail: { sql: sqlErrado, linhas: [["statement", `INSERT INTO ${errada.tabela}`], ["trying", errada.rotulo]], realce: [] },
    },
    (d) => {
      silencio(d);
      const alvo = errada.tabela;
      const outros = todas.filter((x) => x !== alvo && x !== r.outra);
      d.dim(todas, 0).dim(outros, 0.6);
      d.camera({ focus: [alvo, "app", ...(r.outra === undefined ? [] : [r.outra])], pad: 60 });
      const ida = ficha(connect(CAIXA_DO_APP, CAIXAS_DO_BANCO[alvo], 6), errada.rotulo, TOM_DA_FICHA.escrita, "", 20);
      d.packet({ tag: "INSERT", tone: TOM_DA_FICHA.recusa, from: "OpenLabs app", to: alvo, protocol: "DML", payload: sqlErrado });
      d.glow("app").send(ida, { dur: 900, keep: true }).glow("app", 0);
      if (r.tipo === "FK" && r.outra !== undefined) {
        const l = ligacao(alvo, r.outra);
        const fk = ficha(l.caminho, `${r.coluna ?? ""} = ${String(errada.valores[r.coluna ?? ""])}?`, TOM_DA_FICHA.chave, "", 24);
        const volta = ficha(inverter(l.caminho), "not found", TOM_DA_FICHA.recusa, "", 24);
        d.glow(l.id).send(fk, { dur: 800 }).ping(r.outra).wait(400).send(volta, { dur: 800 }).glow(l.id, 0);
      }
      d.set(ida, { tone: TOM_DA_FICHA.recusa, label: r.codigo }).set(alvo, { tone: "live" }).ping(alvo);
      // No palco, só o código e a regra: a mensagem inteira está no painel.
      resposta(d, `${r.codigo} · ${r.regra}`, "live");
      d.beat({ title: r.codigo, body: porque[opcoes.erro], detail: { sql: sqlErrado, linhas: [["rule", r.regra], ["kind", r.tipo], ["table", `${alvo} still has ${linhasDe(b1, alvo).length} rows`]], resposta: { ok: false, texto: r.mensagem }, realce: realceDaRecusa } });
      d.wait(2800).hide(ida).set(alvo, { tone: TOM_DO_GRUPO[GRUPO[alvo]] });
    },
  );

  // ------------------------------------------------------------ 7. INNER JOIN
  const q1 = consulta1(b1);
  const ehNina = (l: readonly Valor[]) => l[1] === nina.nm_aluno;
  const alunosAmostra = linhasDe(b1, "T_ALUNO").filter((a) => [1, 5, 8, nina.id_aluno].includes(a.id_aluno as number));
  const consultaQ = (i: 0 | 1 | 2) => {
    const q = CONSULTAS[i];
    return q === undefined ? undefined : { ...q, ...SOBRE_A_CONSULTA[q.id] };
  };
  f.chapter(
    {
      id: "inner",
      title: "INNER JOIN: rows that have a partner",
      body: consultaQ(0)?.juncao ?? "",
      detail: {
        sql: consultaQ(0)?.sql ?? "",
        linhas: [["question", consultaQ(0)?.pergunta ?? ""], ["joins on", "t.id_telecentro = a.id_telecentro"], ["rows", String(q1.linhas.length)]],
        resultado: limite({ colunas: q1.colunas.slice(0, 3), linhas: q1.linhas.map((l) => l.slice(0, 3)) }, "query 1", 13, ehNina),
        realce: ["T_ALUNO.id_telecentro", "T_TELECENTRO.id_telecentro"],
      },
    },
    (d) => {
      silencio(d);
      d.dim(todas, 0).dim(todas.filter((x) => x !== "T_ALUNO" && x !== "T_TELECENTRO"), 0.6);
      d.camera({ focus: ["T_ALUNO", "T_TELECENTRO"], pad: 70 });
      d.packet({ tag: "SELECT", tone: TOM_DA_FICHA.juncao, from: "OpenLabs app", to: "T_ALUNO ⋈ T_TELECENTRO", protocol: "DQL", payload: consultaQ(0)?.sql ?? "" });
      d.glow(fkAluno.id);
      const ids = alunosAmostra.map((a) => ficha(fkAluno.caminho, String(a.nm_aluno).split(" ")[0] ?? "", TOM_DA_FICHA.juncao, `→ ${String(a.id_telecentro)}`, 24));
      d.stagger(ids, 300, (x, id) => x.send(id, { dur: 900 }));
      d.ping("T_TELECENTRO").glow(fkAluno.id, 0);
      d.beat({ title: `${q1.linhas.length} rows`, body: `Every learner found a telecentre, so every learner is in the result — including ${String(nina.nm_aluno)}, inserted a minute ago.` }).wait(2400);
    },
  );

  // ------------------------------------------------------------ 8. GROUP BY
  const q2 = consulta2(b1);
  const ativosDo1 = q2.linhas.find((l) => l[0] === telecentro1?.nm_telecentro)?.[2];
  f.chapter(
    {
      id: "agrupar",
      title: "GROUP BY: one line per telecentre",
      body: consultaQ(1)?.juncao ?? "",
      detail: {
        sql: consultaQ(1)?.sql ?? "",
        linhas: [["question", consultaQ(1)?.pergunta ?? ""], ["WHERE", "a.st_ativo = 'S' — inactive learners leave before grouping"], ["groups", String(q2.linhas.length)]],
        resultado: limite({ colunas: q2.colunas.slice(0, 3), linhas: q2.linhas.map((l) => l.slice(0, 3)) }, "query 2", 6, (l) => l[0] === telecentro1?.nm_telecentro),
        realce: ["T_ALUNO.st_ativo", "T_ALUNO.id_telecentro", "T_TELECENTRO.nm_telecentro"],
      },
    },
    (d) => {
      d.camera({ focus: ["T_ALUNO", "T_TELECENTRO"], pad: 70 });
      d.packet({ tag: "SELECT", tone: TOM_DA_FICHA.grupo, from: "OpenLabs app", to: "T_TELECENTRO ⋈ T_ALUNO", protocol: "DQL", payload: consultaQ(1)?.sql ?? "" });
      const ids = q2.linhas.map((l) => ficha(fkAluno.caminho, `${String(l[2])} active`, TOM_DA_FICHA.grupo, String(l[0]).replace("Telecentro ", ""), 24));
      d.stagger(ids, 380, (x, id) => x.send(id, { dur: 900 }));
      d.ping("T_TELECENTRO");
      d.beat({ title: "The impact indicator", body: `Five telecentres, five lines. ${String(telecentro1?.nm_telecentro)} now counts ${String(ativosDo1)} active learners — one more than before the INSERT.` }).wait(2600);
    },
  );

  // ------------------------------------------------------------ 9. LEFT OUTER JOIN
  const q3 = consulta3(b1, opcoes.juncao);
  const fkTa = ligacao("T_TENTATIVA", "T_ALUNO");
  const tentativas = linhasDe(b1, "T_TENTATIVA");
  const amostra3 = linhasDe(b1, "T_ALUNO").filter((a) => [1, 6, 11, nina.id_aluno].includes(a.id_aluno as number));
  const sql3 = opcoes.juncao === "left" ? (consultaQ(2)?.sql ?? "") : (consultaQ(2)?.sql ?? "").replace("  LEFT OUTER JOIN T_TENTATIVA te", " INNER JOIN T_TENTATIVA te");
  f.chapter(
    {
      id: "left",
      title: opcoes.juncao === "left" ? "LEFT OUTER JOIN: keep who has no partner" : "INNER JOIN where LEFT was needed",
      body: opcoes.juncao === "left" ? (consultaQ(2)?.juncao ?? "") : "INNER JOIN drops every learner without an attempt before WHERE runs — so te.id_tentativa IS NULL has nothing left to find. The query is valid SQL and answers the wrong question.",
      detail: {
        sql: sql3,
        linhas: [["question", consultaQ(2)?.pergunta ?? ""], ["join", opcoes.juncao === "left" ? "LEFT OUTER — learners without attempts stay, with NULLs" : "INNER — learners without attempts are dropped"], ["rows", String(q3.linhas.length)]],
        resultado: limite({ colunas: [q3.colunas[1] ?? "", q3.colunas[3] ?? ""], linhas: q3.linhas.map((l) => [l[1] ?? null, l[3] ?? null]) }, "query 3", 6, ehNina),
        realce: ["T_TENTATIVA.id_aluno", "T_ALUNO.id_aluno", "T_TENTATIVA.id_tentativa"],
      },
    },
    (d) => {
      d.dim(todas, 0).dim(todas.filter((x) => x !== "T_ALUNO" && x !== "T_TENTATIVA"), 0.6);
      d.camera({ box: { x: 270, y: 240, w: 520, h: 340 } });
      d.packet({ tag: "SELECT", tone: TOM_DA_FICHA.juncao, from: "OpenLabs app", to: "T_ALUNO ⟕ T_TENTATIVA", protocol: "DQL", payload: sql3 });
      d.glow(fkTa.id);
      const caminho = inverter(fkTa.caminho);
      const ids = amostra3.map((a) => {
        const tem = tentativas.some((t) => t.id_aluno === a.id_aluno);
        const nome = String(a.nm_aluno).split(" ")[0] ?? "";
        return { tem, ida: ficha(caminho, nome, TOM_DA_FICHA.juncao, "", 40), volta: tem ? undefined : ficha(fkTa.caminho, `${nome} · NULL`, opcoes.juncao === "left" ? TOM_DA_FICHA.nulo : TOM_DA_FICHA.recusa, opcoes.juncao === "left" ? "kept" : "dropped", 40) };
      });
      d.stagger(ids, 450, (x, { ida, volta }) => {
        x.send(ida, { dur: 800 });
        if (volta !== undefined) x.send(volta, { dur: 700 });
      });
      d.ping("T_ALUNO").glow(fkTa.id, 0);
      d.beat({
        title: `${q3.linhas.length} rows`,
        body:
          opcoes.juncao === "left"
            ? `The learners who came back with NULL are the answer: ${q3.linhas.map((l) => String(l[1]).split(" ")[0]).join(", ")}. ${String(nina.nm_aluno).split(" ")[0]} is on the list — she signed up, and has not taken an assessment yet.`
            : "Nobody. Switch the join back to LEFT OUTER and the learners who need a call come back.",
      }).wait(2800);
      d.dim(todas, 0);
    },
  );

  return f.build();
}
