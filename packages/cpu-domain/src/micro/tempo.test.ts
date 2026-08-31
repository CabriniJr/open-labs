import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { estadoDe, microWorld } from "./datapath.js";
import { tabelaDeTempo } from "./tempo.js";

const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};

const tabelaDe = (fonte: string, ticks: number) =>
  tabelaDeTempo(rodar(microWorld(bytesDe(fonte)), ticks));

describe("a tabela de tempo", () => {
  it("abre com a linha de inicialização, e ela traz PC zerado", () => {
    const t = tabelaDe("LOAD 0A", 40);
    expect(t[0]).toMatchObject({ acesso: "init", pc: 0x0000 });
  });

  it("uma linha por transação de barramento, e não por tick", () => {
    // LOAD tem duas transações (o opcode e o valor) e seis micro-passos — e são
    // seis os ticks aqui de propósito. Deixar a máquina andar além do programa
    // acrescentaria a busca do byte seguinte, que é uma transação de verdade e
    // apareceria (bem) na tabela; contá-la aqui seria contar outra coisa.
    const t = tabelaDe("LOAD 0A", 6);
    expect(t.filter((l) => l.acesso !== "init")).toHaveLength(2);
  });

  it("(⊆) não inventa: todo endereço da tabela foi endereço de verdade no run", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 0A\nADD 05")), 40);
    const marsDoRun = new Set(estados.map((s) => estadoDe(s).mar));
    for (const linha of tabelaDeTempo(estados)) {
      if (linha.acesso === "init") continue;
      expect(marsDoRun.has(linha.endereco!)).toBe(true);
    }
  });

  it("(⊇) não omite: toda escrita que mudou a memória tem linha", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 07\nSTORE 2000")), 40);
    const escritas = tabelaDeTempo(estados).filter((l) => l.acesso === "write");
    expect(escritas).toHaveLength(1);
    expect(escritas[0]).toMatchObject({ endereco: 0x2000, dado: 0x07 });
  });

  it("(⊇) nenhum registrador muda de valor sem aparecer em alguma linha", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 0A\nADD 05")), 40);
    const linhas = tabelaDeTempo(estados);
    const acsNaTabela = new Set(linhas.map((l) => l.ac).filter((v) => v !== undefined));
    const acsDoRun = new Set(estados.map((s) => estadoDe(s).ac));
    acsDoRun.delete(0); // o valor inicial não é mudança
    for (const v of acsDoRun) expect(acsNaTabela.has(v)).toBe(true);
  });

  it("a coluna de instrução marca onde cada instrução começa, e só ali", () => {
    const t = tabelaDe("LOAD 0A\nADD 05", 40);
    const marcadas = t.filter((l) => l.instrucao !== undefined);
    expect(marcadas.map((l) => l.instrucao)).toEqual(["LOAD 0A", "ADD 05"]);
  });

  it("um run ainda em andamento não inventa o operando de uma instrução de dois bytes", () => {
    // STORE é formato 2: opcode e dois bytes de endereço. Parar bem depois do
    // opcode e antes do segundo byte do endereço é o instante em que o lab
    // pede a tabela no meio de uma transação de duas — e "0000" no operando
    // seria a mentira silenciosa, não a leitura honesta de que ele ainda não
    // chegou.
    const estados = rodar(microWorld(bytesDe("LOAD 0A\nSTORE 2000")), 9);
    const linhas = tabelaDeTempo(estados);
    const comStore = linhas.filter((l) => l.instrucao?.startsWith("STORE"));
    expect(comStore).toHaveLength(0);

    // E assim que os dois bytes do endereço aparecem, ela se corrige sozinha —
    // sem que ninguém tenha reescrito a linha à mão.
    const completa = tabelaDeTempo(rodar(microWorld(bytesDe("LOAD 0A\nSTORE 2000")), 40));
    expect(completa.filter((l) => l.instrucao === "STORE 2000")).toHaveLength(1);
  });
});
