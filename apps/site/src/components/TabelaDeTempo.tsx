import type { LinhaDeTempo } from "@ovh/cpu-domain";

/**
 * O slide 43 na tela — a projeção mais grossa do mesmo run que o palco anima.
 *
 * Recebe as linhas já prontas e desenha: nenhuma conta mora aqui. Se este
 * componente lesse o mundo e calculasse a própria versão da tabela, seria a
 * segunda contabilidade que o projeto inteiro se recusa a manter — e o
 * resultado seria esta tabela e o palco podendo divergir um dia sem que
 * nenhum teste percebesse.
 */

const hex = (n: number, digitos = 2): string => `0x${(n >>> 0).toString(16).padStart(digitos, "0")}`;

const rotuloDoAcesso = (linha: LinhaDeTempo): string =>
  linha.acesso === "read" ? "READ" : linha.acesso === "write" ? "WRITE" : "";

interface Celula {
  readonly coluna: string;
  readonly texto: string;
}

function celulasDe(linha: LinhaDeTempo): readonly Celula[] {
  return [
    { coluna: "controle", texto: rotuloDoAcesso(linha) },
    { coluna: "endereco", texto: linha.endereco === undefined ? "" : hex(linha.endereco, 4) },
    { coluna: "dado", texto: linha.dado === undefined ? "" : hex(linha.dado) },
    { coluna: "pc", texto: linha.pc === undefined ? "" : hex(linha.pc, 4) },
    { coluna: "ir", texto: linha.ir === undefined ? "" : hex(linha.ir) },
    { coluna: "ac", texto: linha.ac === undefined ? "" : hex(linha.ac) },
    { coluna: "t", texto: linha.t === undefined ? "" : hex(linha.t) },
    { coluna: "h", texto: linha.h === undefined ? "" : hex(linha.h) },
    { coluna: "l", texto: linha.l === undefined ? "" : hex(linha.l) },
    { coluna: "instrucao", texto: linha.instrucao ?? "" },
  ];
}

export function TabelaDeTempo({ linhas }: { readonly linhas: readonly LinhaDeTempo[] }) {
  return (
    <table className="tabela-de-tempo mono">
      <thead>
        <tr>
          {/* O handbook é em inglês, e estes quatro cabeçalhos ficaram em
              português: o leitor lia "Barramentos" numa tabela que o artigo
              ensina a ler chamando as colunas por outros nomes. */}
          <th rowSpan={2}>Control</th>
          <th colSpan={2}>Buses</th>
          <th colSpan={6}>Registers</th>
          <th rowSpan={2}>Instruction</th>
        </tr>
        <tr>
          <th>Addr.</th>
          <th>Data</th>
          <th>PC</th>
          <th>IR</th>
          <th>AC</th>
          <th>T</th>
          <th>H</th>
          <th>L</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i} data-linha-de-tempo>
            {celulasDe(linha).map((celula) => (
              <td key={celula.coluna} data-coluna={celula.coluna}>
                {celula.texto}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
