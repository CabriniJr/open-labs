import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { estadoDe, microWorld } from "./datapath.js";

const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};

/**
 * Um laço de verdade: um contador na memória, decrementado por `ADD FF` — que é
 * somar −1 em complemento de dois, e o deck desenha o complementador na ULA
 * justamente por isso —, e `JZ` saindo quando ele zera.
 *
 * Sem `LOADM`, `JMP` e `JZ` este programa não existe, e é essa a justificativa
 * da extensão: com as três instruções do deck só dá para escrever contas de
 * tamanho fixo, uma linha por parcela.
 *
 * O que o laço soma é uma **constante**, e não o contador: `ADD` desta máquina
 * é imediato, e não existe soma com operando na memória. Somar o contador
 * pediria uma sétima instrução, e a rodada não é sobre isso — o que este teste
 * tem que provar é que existe laço, que ele termina e que o total bate.
 *
 * Os deslocamentos, contados byte a byte (formato 1 gasta 2, formato 2 gasta 3):
 *
 * ```
 * 0000  LOAD  03      contador = 3
 * 0002  STORE 2000
 * 0005  LOAD  00      total = 0
 * 0007  STORE 2001
 * 000A  LOADM 2001    <- topo do laço
 * 000D  ADD   02      total += 2
 * 000F  STORE 2001
 * 0012  LOADM 2000
 * 0015  ADD   FF      contador -= 1, e é este ADD que acende o Z
 * 0017  STORE 2000
 * 001A  JZ    0020    sai (para depois do JMP, e não em cima dele)
 * 001D  JMP   000A    volta ao topo
 * 0020  (byte 00: não é instrução, e a máquina para)
 * ```
 *
 * O `JZ` lê o Z do `ADD FF` porque nada entre os dois aciona a ULA: `STORE`
 * não soma, e o registrador de estado só é escrito quando a ULA responde.
 */
const SOMA_TRES_VEZES_DOIS = `
  LOAD  03
  STORE 2000
  LOAD  00
  STORE 2001
  LOADM 2001
  ADD   02
  STORE 2001
  LOADM 2000
  ADD   FF
  STORE 2000
  JZ    0020
  JMP   000A
`;

describe("o laço", () => {
  it("JZ não desvia enquanto o acumulador não zera", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 02\nJZ 0000\nLOAD 07")), 40);
    expect(estadoDe(estados.at(-1)!).ac).toBe(0x07);
  });

  it("JZ desvia quando o acumulador zera", () => {
    // ADD FF em 01 dá 00 e liga Z; o desvio pula o LOAD 07.
    const estados = rodar(microWorld(bytesDe("LOAD 01\nADD FF\nJZ 0009\nLOAD 07")), 60);
    expect(estadoDe(estados.at(-1)!).ac).toBe(0x00);
  });

  it("JMP volta e o programa passa duas vezes pelo mesmo endereço", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 01\nJMP 0000")), 40);
    const pcs = estados.map((s) => estadoDe(s).pc);
    expect(pcs.filter((p) => p === 0x0000).length).toBeGreaterThan(1);
  });

  it("LOADM lê da memória de dados o que STORE guardou", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 2A\nSTORE 2000\nLOAD 00\nLOADM 2000")), 80);
    expect(estadoDe(estados.at(-1)!).ac).toBe(0x2a);
  });

  it("o programa tem os trinta e dois bytes que os desvios pressupõem", () => {
    // Um endereço de desvio errado não falha: ele desvia para outro lugar e
    // executa outra coisa. Por isso a contagem é conferida aqui, e não lida.
    expect(bytesDe(SOMA_TRES_VEZES_DOIS)).toHaveLength(0x20);
  });

  it("um laço completo roda, termina e o total bate", () => {
    const estados = rodar(microWorld(bytesDe(SOMA_TRES_VEZES_DOIS)), 600);
    const fim = estadoDe(estados.at(-1)!);
    expect(fim.memoria.get(0x2000)).toBe(0x00);
    expect(fim.memoria.get(0x2001)).toBe(0x06);
  });

  it("o laço passa três vezes pelo topo, e não uma nem para sempre", () => {
    // Sem esta contagem, um `JZ` que saísse na primeira volta ainda deixaria
    // 2000 em zero por outro caminho, e o teste de cima passaria em silêncio.
    const estados = rodar(microWorld(bytesDe(SOMA_TRES_VEZES_DOIS)), 600);
    const topo = estados.filter((s) => estadoDe(s).pc === 0x000a).length;
    expect(topo).toBeGreaterThanOrEqual(3);
  });
});
