import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * A ferramenta do caminho dourado, exercitada como quem a usa a executa.
 *
 * Testar as funções por dentro não cobriria o que importa aqui: o valor desta
 * ferramenta é **o que acontece na linha de comando** — o código de saída, a
 * mensagem, e o fato de o molde que ela escreve passar na conferência dela
 * mesma. Então o teste roda o processo.
 *
 * A promessa que ele cobra, e que é a razão de o caminho se chamar dourado:
 * **`new` seguido de `check` é verde.** Um molde que não passa obriga o autor a
 * descobrir as regras pela reprovação, que é o momento mais caro de descobrir.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(RAIZ, "scripts", "handbook.mjs");

/** Um id que ninguém usaria de verdade: o teste escreve no disco e apaga. */
const ID = "zzz-handbook-de-teste";
const DIR = join(RAIZ, "handbooks", ID);

function rodar(...args) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], { encoding: "utf8", cwd: RAIZ });
    return { codigo: 0, stdout, stderr: "" };
  } catch (erro) {
    return {
      codigo: erro.status ?? 1,
      stdout: erro.stdout?.toString() ?? "",
      stderr: erro.stderr?.toString() ?? "",
    };
  }
}

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true });
});

describe("node scripts/handbook.mjs", () => {
  it("sem comando, ensina os comandos e sai com erro", () => {
    const r = rodar();
    expect(r.codigo).toBe(1);
    expect(r.stderr).toContain("new <id>");
    expect(r.stderr).toContain("docs/handbooks.md");
  });

  it("versions imprime as versões suportadas e a promessa", () => {
    const r = rodar("versions");
    expect(r.codigo).toBe(0);
    expect(r.stdout).toContain("openlabs/handbook/v1");
    expect(r.stdout).toContain("anterior");
  });

  it("check aprova o que está submetido hoje", () => {
    const r = rodar("check");
    expect(r.stdout + r.stderr).toContain("algorithms");
    expect(r.codigo).toBe(0);
  });

  it("check de um id que não existe diz como criar", () => {
    const r = rodar("check", "nao-existe-este-handbook");
    expect(r.codigo).toBe(1);
    expect(r.stdout).toContain("handbook.yaml");
    expect(r.stdout).toContain("new nao-existe-este-handbook");
  });

  it("new exige o handle de quem mantém", () => {
    // Sem dono declarado, manutenção volta para quem mantém a casa — que é o
    // que o caminho dourado existe para evitar. Então falta de handle é recusa.
    const r = rodar("new", ID);
    expect(r.codigo).toBe(1);
    expect(r.stderr).toContain("--github");
    expect(existsSync(DIR)).toBe(false);
  });

  it("new escreve um molde que passa no check — a promessa do caminho", () => {
    const criar = rodar("new", ID, "--github", "octocat", "--name", "Octo Cat");
    expect(criar.stderr).toBe("");
    expect(criar.codigo).toBe(0);
    expect(existsSync(join(DIR, "handbook.yaml"))).toBe(true);

    const check = rodar("check", ID);
    expect(check.stdout).toContain(`handbooks/${ID}: ok`);
    expect(check.codigo).toBe(0);
  });

  it("new recusa escrever em cima de um handbook que já existe", () => {
    const r = rodar("new", ID, "--github", "octocat", "--name", "Octo Cat");
    expect(r.codigo).toBe(1);
    expect(r.stderr).toContain("já existe");
  });

  it("export devolve um pacote portátil com o contrato dentro", () => {
    const r = rodar("export", "algorithms");
    expect(r.codigo).toBe(0);
    const pacote = JSON.parse(r.stdout);
    expect(pacote.bundleVersion).toBe("openlabs/bundle/v1");
    expect(pacote.handbook.apiVersion).toBe("openlabs/handbook/v1");
    expect(pacote.handbook.id).toBe("algorithms");
    // O pacote é autossuficiente: fases, itens e tema viajam com ele.
    expect(pacote.handbook.phases.length).toBeGreaterThan(0);
    expect(pacote.handbook.tema.claro.acento).toMatch(/^#/u);
    expect(Array.isArray(pacote.articles)).toBe(true);
  });

  it("migrate diz que não há o que migrar quando já está na versão atual", () => {
    // E dizer isso é o certo: um comando que respondesse "migrado" sem migrar
    // nada seria a mentira que este repositório trata como o pior defeito.
    const r = rodar("migrate", "algorithms");
    expect(r.codigo).toBe(0);
    expect(r.stdout).toContain("nada a migrar");
  });

  it("codeowners: o arquivo no repo está em dia com os manifestos", () => {
    /*
      Independente de ordem de propósito: o handbook temporário dos testes acima
      MUDA a resposta — e isso é o ponto do teste seguinte. Aqui a pergunta é
      sobre o repositório como ele está commitado, então o temporário sai antes.
    */
    rmSync(DIR, { recursive: true, force: true });
    const r = rodar("codeowners");
    expect(r.stdout + r.stderr).toContain("CODEOWNERS");
    expect(r.codigo, "rode `node scripts/handbook.mjs codeowners --write`").toBe(0);
  });

  it("um handbook novo deixa o CODEOWNERS fora de dia, e o check acusa", () => {
    /*
      A prova de que a derivação está viva. Um CODEOWNERS escrito à mão passaria
      neste caso — é a segunda lista da mesma verdade, e ela divergiria em
      silêncio no primeiro handbook submetido, que é exatamente quando a
      propriedade do diretório passa a importar.
    */
    rodar("new", ID, "--github", "octocat", "--name", "Octo Cat");
    expect(existsSync(DIR)).toBe(true);
    const r = rodar("codeowners");
    expect(r.codigo).toBe(1);
    expect(r.stderr).toContain("fora de dia");
    rmSync(DIR, { recursive: true, force: true });
  });
});
