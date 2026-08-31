/**
 * Todo texto que o leitor vê, num lugar só.
 *
 * O handbook é em inglês por decisão declarada, e os labs estavam em português:
 * o leitor lia um parágrafo numa língua e mexia num painel noutra. Aqui tudo é
 * inglês, como o resto do site e como o `depth-ui` sempre foi.
 *
 * **Estar num arquivo só é o ponto.** A CPU é material para aulas em pt-BR, e
 * uma camada de idioma vai ser pedida. Espalhado pelos modelos, traduzir seria
 * caçar string em vinte arquivos e esquecer três; reunido, é trocar este mapa.
 * O código, os comentários e os identificadores seguem em português — eles não
 * são lidos por quem visita o site.
 */

export const ROTULOS = {
  // o sistema
  sistema: "system",
  cpu: "CPU",
  processador: "processor",
  logica: "combinational logic",
  relogio: "clock",
  imem: "instruction memory",
  decodificadorDeEndereco: "address decoder",
  celulas: "cells",
  memoria: "main memory",
  entrada: "input",
  saida: "output",

  // dentro do processador
  pc: "PC",
  banco: "register file",
  controle: "control unit",
  decodificador: "decoder",
  desvio: "branch unit",
  muxOperando: "operand mux",
  muxEscrita: "write-back mux",

  // dentro da ULA
  ula: "ALU",
  dispersor: "splitter",
  coletor: "collector",
  pesos: "weights",
  unidadeLogica: "logic unit",
  muxOperacao: "operation mux",
  somadorDe: (bits: number): string => `${bits}-bit adder`,
  // O somador completo de um bit. O rótulo era o id cru (`bit0`), que é nome
  // de variável e não de peça: quem abre o somador de 32 bits vê trinta e duas
  // caixas chamadas por um identificador e nenhuma dizendo o que é.
  somadorCompleto: (i: number): string => `full adder ${i}`,
  somadorCompletoSemIndice: "full adder",
  peso: (i: number): string => `2^${i}`,

  // o circuito
  circuito: "circuit",
  entradas: "inputs",
  soma: (i: number): string => `sum ${i}`,
  vaium: "carry-out",
  cin: "carry-in",
  barramento: "data bus",
  barramentoInstrucao: "instruction bus",
  viaPc: "address",
  viaInstrucao: "instruction",
  viaEndereco: "address",
  viaDado: "data",
  viaControle: "control",
  no: "node",
  vdd: "Vdd",
  gnd: "GND",

  // o microprocessador genérico do deck. O que já existe acima é reaproveitado
  // — `cpu`, `processador`, `relogio`, `memoria`, `pc`, `ula`, `controle` e
  // `barramento` são as mesmas peças, com o mesmo nome, noutra máquina.
  ir: "IR",
  mar: "MAR",
  mbr: "MBR",
  ac: "AC",
  temporario: "T",
  alto: "H",
  baixo: "L",
  ponteiroDePilha: "SP",
  status: "status flags",
  barramentoEndereco: "address bus",
  viaLeitura: "read",
  viaEscrita: "write",
} as const;

/**
 * O que cada peça do genérico **é**, no vocabulário do domínio — nunca no do
 * motor.
 *
 * A Ficha descrevia todo objeto selecionado só pelo `kind`: quem clicava em
 * `MAR` lia a descrição de `buffer`, um registrador de um bit de capacidade, e
 * nunca descobria que ali mora o endereço que a CPU está pondo no barramento
 * agora. `KINDS[node.kind].detalhe` é verdade sobre a peça e não é a pergunta
 * que o leitor fez.
 *
 * Chave é **id do objeto**, não `kind`: dois objetos do mesmo `kind` — dois
 * `buffer`, `mar` e `ac` — são coisas diferentes nesta máquina, e um mapa por
 * `kind` faria um responder pela descrição do outro.
 *
 * A cobertura é travada dos dois lados em `labels.test.ts`, contra a árvore de
 * `microWorld` — e não contra uma segunda lista escrita à mão, que é
 * exatamente o duplicado que este projeto proíbe.
 */
export const DESCRICOES: Readonly<Record<string, string>> = {
  pc: "Holds the address of the next instruction. It advances by one after " +
    "every fetch, and only a jump or a taken branch changes it any other way.",
  ir: "Holds the instruction byte just fetched from memory — the one the " +
    "control unit is decoding right now.",
  mar: "Holds the address the CPU is putting on the address bus right now. " +
    "The CPU cannot name a memory cell any other way.",
  mbr: "Holds the byte in transit between the CPU and memory — the one just " +
    "read, or the one about to be written.",
  ac: "Where arithmetic happens. Almost every instruction of this machine " +
    "either fills it or changes it.",
  t: "Where the second operand waits while the ALU adds. It is why ADD " +
    "takes one more instant than LOAD.",
  h: "The high byte of a two-byte address, paired with L. Neither half " +
    "holds a full address alone — that is why loading one costs a whole " +
    "instant of its own.",
  l: "The low byte of that same address, paired with H.",
  sp: "Declared and unused: this machine has no instruction that moves it. " +
    "The reference model lists it among the registers and never uses it, " +
    "and so do we.",
  status: "Holds the flags the last ALU result set — zero and carry. The " +
    "conditional jump is the only thing in this machine that ever reads Z.",
  uc: "Keeps the phase of the instruction cycle and lights the control " +
    "lines that phase calls for. It decides; it never carries a value.",
  "barramento-endereco": "The one wire nothing reaches memory without. " +
    "Whatever the MAR holds is what is on it, every instant — the CPU has " +
    "no other way to name a cell.",
  "barramento-dado": "Two one-way lanes between the CPU and memory, never " +
    "the same instant: a byte comes back on one, and only leaves on the " +
    "other. A single two-way wire would ask this model to carry a byte in " +
    "both directions at once, which it never does.",
  "via-leitura": "The lane a byte travels back from memory on, when the " +
    "read line is lit.",
  "via-escrita": "The lane a byte travels out to memory on, when the write " +
    "line is lit.",
  memoria: "The single memory this machine has — program at 0000, data at " +
    "2000. It is why fetch and execute can never share an instant: one " +
    "address bus, one memory, one access at a time.",
} as const;

/**
 * Os sinais de controle, com o nome que eles têm no livro.
 *
 * A unidade de controle emitia os identificadores internos crus no payload —
 * `ler`, `escrever`, `nada`, `ula`, `mem`, `pc4` —, e a linha tracejada os
 * imprimia como estavam. O leitor de um site em inglês lia palavras em
 * português na única legenda que diz o **nome do sinal**; e nem no idioma
 * certo elas seriam os nomes certos, porque o que ele vai encontrar no livro e
 * na prova é `MemRead`, `RegWrite`, `ALUSrc`, `MemToReg`.
 *
 * A guarda de idioma não pegou isso, e não foi por descuido dela: ela varre
 * caractere acentuado, e nenhuma daquelas palavras tem acento. Quem pega é o
 * teste que exige que todo par campo/valor emitido esteja aqui.
 *
 * **Por campo, e não por valor.** `nada` quer dizer "não acessa memória" em
 * `modo` e "não escreve no banco" em `fonte`: são decisões diferentes de peças
 * diferentes, e um mapa por valor faria uma responder pela outra.
 */
export const SINAIS: Readonly<
  Record<string, { readonly nome: string; readonly valores: Readonly<Record<string, string>> }>
> = {
  // A operação vai para a ULA; os valores são os mnemônicos do ISA, que já são
  // o nome canônico e não passam por tradução nenhuma.
  op: { nome: "ALUOp", valores: {} },
  fonteB: { nome: "ALUSrc", valores: { reg: "reg", imm: "imm" } },
  // O acesso é o par clássico, e cada um é um sinal com nome próprio — por
  // isso o nome do campo fica vazio: `MemRead` já se diz inteiro.
  acesso: { nome: "", valores: { ler: "MemRead", escrever: "MemWrite", nada: "no access" } },
  escrita: {
    nome: "MemToReg",
    valores: { ula: "ALU", mem: "mem", pc4: "PC+4", nada: "no write" },
  },
  desvio: { nome: "Branch", valores: { seq: "none" } },
} as const;

/**
 * A legenda de um sinal, ou `undefined` quando o par não é conhecido.
 *
 * Devolver o valor cru no desconhecido seria o desenho continuar afirmando
 * algo que ninguém revisou. Quem impede o desconhecido de existir é o teste,
 * na construção — aqui só resta não inventar.
 */
export function rotuloDoSinal(campo: string, valor: string): string | undefined {
  const sinal = SINAIS[campo];
  if (sinal === undefined) return undefined;
  // `op` e `desvio` carregam mnemônico do ISA, que já é o nome canônico.
  const traduzido =
    sinal.valores[valor] ?? (campo === "op" || campo === "desvio" ? valor : undefined);
  if (traduzido === undefined) return undefined;
  return sinal.nome === "" ? traduzido : `${sinal.nome}=${traduzido}`;
}
