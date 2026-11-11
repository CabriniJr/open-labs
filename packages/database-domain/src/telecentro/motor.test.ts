import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONSULTA3_COM_INNER, CONSULTAS } from "./consultas.js";
import { DADOS } from "./dados.js";
import { constraintsDe, nivelDe, TABELAS } from "./esquema.js";
import { avaliar } from "./expressao.js";
import { apagar, bancoInicial, consulta1, consulta2, consulta3, inserir, linhasDe, proximoId, type Banco, type Escrita, type Linha } from "./motor.js";

const b0 = bancoInicial();

describe("esquema e dados", () => {
  it("toda tabela tem de 5 a 15 linhas, cada uma com um valor por coluna", () => {
    for (const t of TABELAS) {
      const { linhas } = DADOS[t.nome];
      expect(linhas.length, t.nome).toBeGreaterThanOrEqual(5);
      expect(linhas.length, t.nome).toBeLessThanOrEqual(15);
      for (const l of linhas) expect(l.length, t.nome).toBe(t.colunas.length);
    }
  });

  it("os dados de exemplo passam por todas as regras do próprio banco", () => {
    // Carregar inserindo linha a linha, na ordem: se algum dado violasse uma
    // constraint, o Oracle recusaria o 02-dml.sql — e aqui também.
    let b: Banco = { tabelas: new Map(TABELAS.map((t) => [t.nome, [] as Linha[]])) };
    for (const t of TABELAS) {
      for (const valores of DADOS[t.nome].linhas) {
        const r = inserir(b, t.nome, Object.fromEntries(t.colunas.map((c, i) => [c.nome, valores[i] ?? null])));
        if (!r.ok) throw new Error(`${t.nome}: ${r.recusa.mensagem}`);
        b = r.banco;
      }
    }
    expect(linhasDe(b, "T_TENTATIVA")).toHaveLength(12);
  });

  it("10 chaves estrangeiras, e a altura no 3D é a distância até uma tabela sem FK", () => {
    expect(TABELAS.flatMap((t) => constraintsDe(t).filter((k) => k.tipo === "FK"))).toHaveLength(10);
    expect(nivelDe("T_TELECENTRO")).toBe(0);
    expect(nivelDe("T_HANDBOOK")).toBe(0);
    expect(nivelDe("T_ALUNO")).toBe(1);
    expect(nivelDe("T_LAB")).toBe(2);
    expect(nivelDe("T_TENTATIVA")).toBe(4);
    // A ordem de criação respeita a altura: ninguém aponta para quem vem depois.
    TABELAS.forEach((t, i) => (t.fks ?? []).forEach((f) => expect(TABELAS.findIndex((x) => x.nome === f.tabela)).toBeLessThan(i)));
  });

  it("os scripts em database/ estão em dia com o pacote", () => {
    const raiz = fileURLToPath(new URL("../../../../", import.meta.url));
    expect(() => execFileSync(process.execPath, ["database/gerar.mjs", "--check"], { cwd: raiz, stdio: "pipe" })).not.toThrow();
  });
});

describe("CHECK com lógica de três valores", () => {
  it("verdadeiro, falso e desconhecido", () => {
    expect(avaliar("vl_nota BETWEEN 0 AND 10", { vl_nota: 10 })).toBe(true);
    expect(avaliar("vl_nota BETWEEN 0 AND 10", { vl_nota: 11 })).toBe(false);
    expect(avaliar("vl_nota BETWEEN 0 AND 10", { vl_nota: null })).toBe(null);
    expect(avaliar("nr_vlan IN (10, 20, 30)", { nr_vlan: 40 })).toBe(false);
    expect(avaliar("st_ativo IN ('S', 'N')", { st_ativo: "S" })).toBe(true);
    expect(avaliar("dt_conclusao IS NULL OR dt_conclusao >= dt_inicio", { dt_conclusao: null, dt_inicio: "2026-01-01" })).toBe(true);
    expect(avaliar("dt_conclusao IS NULL OR dt_conclusao >= dt_inicio", { dt_conclusao: "2025-12-31", dt_inicio: "2026-01-01" })).toBe(false);
  });
});

describe("o banco recusa o que o Oracle recusaria", () => {
  const aluno = { id_aluno: 13, id_telecentro: 1, nm_aluno: "Nina Prado", dt_nascimento: "2009-02-02", ds_email: null, dt_cadastro: "2026-11-01" };
  const tentativa = { id_tentativa: 13, id_aluno: 1, id_avaliacao: 1, dt_envio: "2026-11-01", nr_acertos: 5 };

  it("um aluno válido entra, com o padrão de st_ativo, e o banco antigo não muda", () => {
    const r = inserir(b0, "T_ALUNO", aluno);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.linha.st_ativo).toBe("S");
      expect(r.mensagem).toBe("1 row inserted.");
      expect(linhasDe(r.banco, "T_ALUNO")).toHaveLength(13);
    }
    expect(linhasDe(b0, "T_ALUNO")).toHaveLength(12);
  });

  const casos: [string, () => Escrita, string, string][] = [
    ["nota 11", () => inserir(b0, "T_TENTATIVA", { ...tentativa, vl_nota: 11 }), "ORA-02290", "CK_TENTATIVA_NOTA"],
    ["nota 100 não cabe em NUMBER(4,2)", () => inserir(b0, "T_TENTATIVA", { ...tentativa, vl_nota: 100 }), "ORA-01438", "NUMBER(4,2)"],
    ["telecentro 77", () => inserir(b0, "T_ALUNO", { ...aluno, id_telecentro: 77 }), "ORA-02291", "FK_ALUNO_TELECENTRO"],
    ["id repetido", () => inserir(b0, "T_ALUNO", { ...aluno, id_aluno: 1 }), "ORA-00001", "PK_ALUNO"],
    [
      "o mesmo aluno duas vezes no mesmo lab",
      () => inserir(b0, "T_PROGRESSO", { id_progresso: 99, id_aluno: 1, id_lab: 1, dt_inicio: "2026-11-01", dt_conclusao: null }),
      "ORA-00001",
      "UK_PROGRESSO_ALUNO_LAB",
    ],
    [
      "conclusão antes do início",
      () => inserir(b0, "T_PROGRESSO", { id_progresso: 99, id_aluno: 2, id_lab: 4, dt_inicio: "2026-11-10", dt_conclusao: "2026-11-01" }),
      "ORA-02290",
      "CK_PROGRESSO_DATAS",
    ],
    ["nome vazio", () => inserir(b0, "T_ALUNO", { ...aluno, nm_aluno: "" }), "ORA-01400", "NOT NULL"],
    ["st_ativo X", () => inserir(b0, "T_ALUNO", { ...aluno, st_ativo: "X" }), "ORA-02290", "CK_ALUNO_ATIVO"],
    ["VLAN 40", () => inserir(b0, "T_COMPUTADOR", { id_computador: 9, id_telecentro: 1, nm_hostname: "PC-X", ds_endereco_ip: null, nr_vlan: 40 }), "ORA-02290", "CK_COMPUTADOR_VLAN"],
    ["data impossível", () => inserir(b0, "T_ALUNO", { ...aluno, dt_cadastro: "2026-02-30" }), "ORA-01861", "DATE"],
    [
      "UF com três letras",
      () => inserir(b0, "T_TELECENTRO", { id_telecentro: 9, nm_telecentro: "X", nm_bairro: "X", nm_cidade: "X", sg_uf: "SPX", nr_computadores: 1, ds_faixa_rede: "10.0.0.0/24", dt_inauguracao: "2026-01-01" }),
      "ORA-12899",
      "CHAR(2)",
    ],
    ["coluna que não existe", () => inserir(b0, "T_ALUNO", { ...aluno, nm_mae: "x" }), "ORA-00904", "nm_mae"],
  ];
  for (const [nome, fazer, codigo, regra] of casos) {
    it(`${nome} → ${codigo}`, () => {
      const r = fazer();
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.recusa.codigo).toBe(codigo);
        expect(r.recusa.regra).toBe(regra);
        expect(r.recusa.mensagem.startsWith(codigo)).toBe(true);
      }
    });
  }

  it("apagar um telecentro com alunos → ORA-02292; sem filhos, apaga", () => {
    const r = apagar(b0, "T_TELECENTRO", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.recusa.codigo).toBe("ORA-02292");
    const t = apagar(b0, "T_TENTATIVA", 12);
    expect(t.ok && linhasDe(t.banco, "T_TENTATIVA").length).toBe(11);
  });

  it("o próximo id é o que a IDENTITY daria", () => expect(proximoId(b0, "T_ALUNO")).toBe(13));

  it("sem id, a IDENTITY gera o próximo — como no POST da API Java", () => {
    const r = inserir(b0, "T_ALUNO", { ...aluno, id_aluno: null });
    expect(r.ok && r.linha.id_aluno).toBe(13);
    const s = inserir(b0, "T_TELECENTRO", { nm_telecentro: "Telecentro Teste", nm_bairro: "Centro", nm_cidade: "Santos", sg_uf: "SP", nr_computadores: 4, ds_faixa_rede: "10.9.0.0/24", dt_inauguracao: "2026-11-10" });
    expect(s.ok && s.linha.id_telecentro).toBe(6);
  });
});

describe("as três consultas, com os resultados do README", () => {
  it("consulta 1: 12 linhas, por telecentro e nome", () => {
    const r = consulta1(b0);
    expect(r.linhas).toHaveLength(12);
    // "Capão Redondo" vem antes de "Cidade Tiradentes".
    expect(r.linhas[0]?.[1]).toBe("Henrique Batista Costa");
    expect(r.linhas.at(-1)?.[1]).toBe("Mateus Oliveira Barros");
  });

  it("consulta 2: alunos ativos por telecentro", () => {
    expect(consulta2(b0).linhas).toEqual([
      ["Telecentro Cidade Tiradentes", "São Paulo", 3, "2026-07-14", "2026-09-12"],
      ["Telecentro Jardim Ângela", "São Paulo", 3, "2026-08-03", "2026-08-10"],
      ["Telecentro Jardim Gramacho", "Duque de Caxias", 2, "2026-10-01", "2026-10-03"],
      ["Telecentro Capão Redondo", "São Paulo", 1, "2026-06-02", "2026-06-02"],
      ["Telecentro Vila Kennedy", "Rio de Janeiro", 1, "2026-10-20", "2026-10-20"],
    ]);
  });

  it("consulta 3: três alunos sem avaliação; com INNER JOIN, nenhum", () => {
    expect(consulta3(b0).linhas.map((l) => l[1])).toEqual(["Felipe Cardoso Reis", "Larissa Moura Campos", "Mateus Oliveira Barros"]);
    expect(consulta3(b0, "inner").linhas).toHaveLength(0);
    expect(CONSULTA3_COM_INNER).toContain("INNER JOIN T_TENTATIVA te");
    expect(CONSULTAS).toHaveLength(3);
  });

  it("um aluno novo, sem tentativa, entra na consulta 3", () => {
    const r = inserir(b0, "T_ALUNO", { id_aluno: 13, id_telecentro: 1, nm_aluno: "Nina Prado", dt_nascimento: "2009-02-02", ds_email: null, dt_cadastro: "2026-11-01" });
    if (!r.ok) throw new Error(r.recusa.mensagem);
    expect(consulta3(r.banco).linhas.map((l) => l[1])).toContain("Nina Prado");
  });
});
