import type { NodePlacement, View } from "@ovh/depth-ui";
import { comandoDe, DESENHO_CMOS, portasCmosDe } from "./transistors.js";
import type { PortaCmos } from "./transistors.js";
import type { PortaLogica } from "./gates.js";

/**
 * As views do caminho de dados.
 *
 * Uma view guarda **a disposição inicial** — onde cada objeto começa e de que
 * tamanho. Ela não decide o que existe nem o que se liga a quê: isso é da
 * árvore e dos fios, e `viewDisagreement` recusa qualquer view que tente.
 *
 * O enquadramento segue o diagrama de blocos de sempre: a CPU é uma moldura, o
 * processador é uma moldura dentro dela, e as memórias ficam **fora**, embaixo,
 * com o barramento descendo até elas. Quem já viu a figura num livro reconhece;
 * a diferença é que esta anda.
 */

/**
 * As faixas do caminho de dados.
 *
 * O desenho não é livre: ele segue a figura canônica do caminho de dados de
 * ciclo único, a mesma de Patterson & Hennessy. Ela existe porque resolveu, há
 * décadas, exatamente o problema que um layout inventado cria — o caminho de
 * volta cruzando o de ida e virando sopa.
 *
 * Três faixas, e cada uma diz uma coisa:
 *
 * - **controle**, em cima: quem decide. As linhas dele descem sobre o caminho,
 *   e por isso nunca se confundem com dado.
 * - **fluxo**, no meio: da esquerda para a direita, na ordem dos estágios —
 *   buscar, decodificar, executar, acessar, escrever. Ler o desenho da esquerda
 *   para a direita **é** ler a execução de uma instrução.
 * - **retorno**, embaixo: o que volta. O próximo PC e o valor que vai ser
 *   escrito no banco andam da direita para a esquerda, numa faixa só deles.
 *   Reservar essa faixa é o que impede a volta de atravessar a ida.
 */
const FAIXA = { controle: 60, fluxo: 190, retorno: 470 } as const;

export const VIEW_SISTEMA: View = {
  id: "sistema",
  focus: "sistema",
  title: "The system: CPU, memories, and the clock that moves it",
  width: 1240,
  height: 700,
  places: [
    // O relógio fica fora e embaixo: ele não participa do caminho, ele o move.
    { id: "relogio", x: 20, y: FAIXA.retorno + 130, w: 110, h: 64 },

    { id: "cpu", x: 160, y: 24, w: 1050, h: 540 },

    // Faixa de controle, em cima de tudo o que ela comanda.
    { id: "controle", x: 300, y: FAIXA.controle, w: 240, h: 56 },
    { id: "decodificador", x: 600, y: FAIXA.controle, w: 220, h: 56 },

    { id: "processador", x: 190, y: FAIXA.fluxo - 40, w: 990, h: 470 },

    // Faixa de fluxo: buscar › decodificar › executar › escrever.
    { id: "pc", x: 220, y: FAIXA.fluxo, w: 110, h: 64 },
    { id: "banco", x: 380, y: FAIXA.fluxo - 20, w: 170, h: 130 },

    { id: "logica", x: 600, y: FAIXA.fluxo - 30, w: 550, h: 330 },
    { id: "mux-operando", x: 630, y: FAIXA.fluxo, w: 120, h: 64 },
    // A ULA tem interior, e a view diz isso em voz alta em vez de desenhar uma
    // caixa lisa: dois cliques entram nela, e o zoom também.
    { id: "ula", x: 800, y: FAIXA.fluxo - 8, w: 150, h: 80, collapsed: true },
    { id: "desvio", x: 1000, y: FAIXA.fluxo, w: 130, h: 64 },

    // Faixa de retorno, dentro da lógica: o valor escrito volta para o banco.
    { id: "mux-escrita", x: 800, y: FAIXA.fluxo + 160, w: 150, h: 64 },

    // Memórias e mundo, embaixo: fora da CPU, e é isso que o desenho diz.
    { id: "imem", x: 220, y: FAIXA.retorno + 130, w: 240, h: 70 },
    { id: "memoria", x: 620, y: FAIXA.retorno + 130, w: 240, h: 70 },
    // Entrada e saída ficam junto da memória de propósito: são endereços dela,
    // e não instruções novas.
    { id: "entrada", x: 500, y: FAIXA.retorno + 130, w: 100, h: 70 },
    { id: "saida", x: 890, y: FAIXA.retorno + 130, w: 100, h: 70 },
  ],
};

/**
 * O mesmo run, enquadrado no processador. Não é outro desenho: é a mesma coisa
 * vista de mais perto, com as mesmas faixas — e é por isso que os números batem
 * entre as duas, e que descer não desorienta.
 */
export const VIEW_PROCESSADOR: View = {
  id: "processador",
  focus: "processador",
  title: "Inside the processor: PC, register file, and the combinational logic",
  width: 1120,
  height: 540,
  places: [
    { id: "pc", x: 40, y: 120, w: 130, h: 76 },
    { id: "banco", x: 230, y: 100, w: 190, h: 150 },

    { id: "logica", x: 480, y: 60, w: 600, h: 400 },
    { id: "mux-operando", x: 510, y: 130, w: 140, h: 76 },
    { id: "ula", x: 700, y: 118, w: 170, h: 100, collapsed: true },
    { id: "desvio", x: 920, y: 130, w: 140, h: 76 },
    // A faixa de retorno: o que vai ser escrito desce e volta para o banco.
    { id: "mux-escrita", x: 700, y: 330, w: 170, h: 76 },
  ],
};

/**
 * Dentro da ULA: o número vira linhas, as linhas viram soma, a soma vira número.
 *
 * A vista montada na hora enfileirava as seis peças numa linha só, e a leitura
 * que importa aqui não é a ordem — é que **o caminho da soma passa por trinta e
 * dois somadores** enquanto tudo o mais atravessa numa passada. Por isso o
 * somador é a peça larga do meio, e a unidade lógica corre por baixo dele: as
 * duas respostas chegam no mesmo mux, e uma custa muito mais que a outra.
 */
export const VIEW_ULA: View = {
  id: "ula",
  focus: "ula",
  title: "Inside the ALU: the bus becomes lines, and the lines are added",
  width: 1160,
  height: 420,
  places: [
    { id: "dispersor", x: 30, y: 130, w: 140, h: 90 },
    // O vai-um do bit zero, amarrado em zero. Estava implícito no circuito e
    // virou linha de verdade quando a ULA passou a poder abrir até o
    // transistor — onde "não me acionaram" deixa de poder valer zero.
    { id: "cin0", x: 30, y: 250, w: 140, h: 46 },
    // A peça larga é larga porque é cara: são 32 somadores completos em fila.
    { id: "somador", x: 220, y: 40, w: 300, h: 150, collapsed: true },
    { id: "pesos", x: 570, y: 40, w: 180, h: 150, collapsed: true },
    { id: "coletor", x: 800, y: 70, w: 140, h: 90 },
    // O outro caminho, e ele é uma folha: está declarado no arquivo que abrir a
    // lógica bit a bit é o mesmo trabalho do somador, por outro caminho.
    { id: "unidade-logica", x: 220, y: 270, w: 300, h: 90 },
    { id: "mux-operacao", x: 990, y: 155, w: 140, h: 110 },
  ],
};

export const CPU_VIEWS: readonly View[] = [VIEW_SISTEMA, VIEW_PROCESSADOR, VIEW_ULA];

/**
 * Uma porta CMOS desenhada como esquemático, e não como fluxo.
 *
 * A vista montada na hora enfileirava os transistores da esquerda para a
 * direita, na ordem em que a corrente os atravessa. Está correto e não ensina
 * nada: o que separa um NAND de um NOR é **série contra paralelo**, e essa é
 * uma propriedade da forma, que some quando tudo vira uma fila.
 *
 * Aqui a alimentação fica em cima, o terra embaixo, o nó de saída no meio, e
 * dois transistores lado a lado querem dizer em paralelo. É o desenho que
 * qualquer livro usa, e é ele que faz a diferença entre as duas portas ser
 * visível antes de ser lida.
 */
export function viewPortaCmos(id: string, tipo: PortaCmos): View {
  const alturaAndar = 84;
  const andares = DESENHO_CMOS[tipo];

  /**
   * Dois PMOS num NAND são o mesmo desenho e fazem coisas diferentes: um é
   * comandado por `a` e o outro por `b`. Sem dizer qual, o esquemático mostra a
   * forma certa e deixa o leitor sem saber qual transistor é qual.
   */
  const rotulo = (sufixo: string): { label?: string } => {
    const via = comandoDe(tipo, sufixo);
    return via === undefined ? {} : { label: `${sufixo.startsWith("p") ? "PMOS" : "NMOS"} · ${via}` };
  };

  const places = andares.flatMap((andar, i) => {
    const trilho = andar[0] === "vdd" || andar[0] === "gnd";
    const y = 30 + i * alturaAndar;
    const h = trilho ? 46 : 58;
    if (andar.length === 1) {
      const sufixo = andar[0]!;
      return [{ id: `${id}-${sufixo}`, x: 330, y, w: 200, h, ...rotulo(sufixo) }];
    }
    // Paralelo: os dois puxam o mesmo nó, e ficam lado a lado por isso.
    return andar.map((sufixo, j) => ({
      id: `${id}-${sufixo}`,
      x: j === 0 ? 110 : 550,
      y,
      w: 200,
      h,
      ...rotulo(sufixo),
    }));
  });

  return {
    id: `cmos-${id}`,
    focus: id,
    title: `${tipo.toUpperCase()}: two complementary networks`,
    width: 860,
    height: 30 + andares.length * alturaAndar + 24,
    places,
  };
}

/**
 * A vista do somador de portas, montada por laço.
 *
 * Gerar as posições não afrouxa nada: a view continua declarando onde cada
 * objeto fica, e `viewDisagreement` continua conferindo objeto por objeto
 * contra a árvore. O que o laço evita é escrever vinte e tantas coordenadas à
 * mão e errar uma em silêncio.
 */
export function viewSomador(bits: number, comTransistores = false): View {
  const alturaBit = 190;
  const topo = 30;
  const altura = topo + bits * alturaBit + 60;

  const places: View["places"] = [
    { id: "entradas", x: 30, y: topo + 10, w: 130, h: bits * alturaBit - 30 },
    // O vem-de-trás do primeiro bit, amarrado em zero. Ele sempre existiu no
    // circuito; só passou a ser desenhável quando virou uma linha de verdade.
    { id: "cin0", x: 30, y: topo + bits * alturaBit - 10, w: 130, h: 46 },
    { id: "somador", x: 220, y: topo, w: 680, h: bits * alturaBit + 10 },
    ...Array.from({ length: bits }, (_, i) => {
      const y = topo + 20 + i * alturaBit;
      const p = (s: string): string => `bit${i}-${s}`;
      // Com transistores a porta deixa de ser folha: a view diz isso em voz
      // alta em vez de desenhar uma caixa lisa, e dois cliques entram nela.
      const porta = (id: string, x: number, dy: number): NodePlacement => ({
        id,
        x,
        y: y + dy,
        w: 100,
        h: 46,
        ...(comTransistores ? { collapsed: true as const } : {}),
      });
      return [
        { id: `bit${i}`, x: 240, y, w: 640, h: alturaBit - 40 },
        porta(p("xor1"), 270, 22),
        porta(p("and1"), 270, 88),
        porta(p("xor2"), 430, 22),
        porta(p("and2"), 430, 88),
        porta(p("or1"), 600, 88),
      ];
    }).flat(),
    ...Array.from({ length: bits }, (_, i) => ({
      id: `soma${i}`,
      x: 960,
      y: topo + 42 + i * alturaBit,
      w: 110,
      h: 46,
    })),
    { id: "vaium", x: 960, y: topo + 108 + (bits - 1) * alturaBit, w: 110, h: 46 },
  ];

  return {
    id: "somador",
    focus: "circuito",
    title: `${bits}-bit adder, gate by gate`,
    width: 1100,
    height: altura,
    places,
  };
}

/**
 * Todas as vistas do lab das portas: o somador, e uma para cada porta CMOS.
 *
 * São muitas — quatro bits vezes cinco portas, e um XOR são quatro NANDs —, e
 * gerá-las é o único jeito honesto: escrever setenta e seis vistas à mão
 * garantiria que uma delas ficasse para trás sem ninguém notar. O
 * `viewDisagreement` continua conferindo cada uma contra a árvore.
 */
export function viewsDoSomador(bits: number, comTransistores = false): readonly View[] {
  const somador = viewSomador(bits, comTransistores);
  if (!comTransistores) return [somador];
  return [somador, ...viewsDasPortas(bits)];
}

/**
 * As vistas esquemáticas de toda porta de um somador de `bits` bits.
 *
 * Vale para qualquer somador construído com `somadorCompleto`, e é por isso que
 * mora aqui em vez de dentro do somador do lab: o somador da ULA usa o mesmo
 * esquema de nomes, e sem isto descer nele encontraria a vista montada na hora
 * — que enfileira transistor da esquerda para a direita e não mostra que uma
 * rede está em série e a outra em paralelo, que é a coisa a aprender.
 */
export function viewsDasPortas(bits: number): readonly View[] {
  const portas: View[] = [];
  for (let i = 0; i < bits; i += 1) {
    for (const [sufixo, tipo] of PORTAS_DO_SOMADOR) {
      for (const cmos of portasCmosDe(`bit${i}-${sufixo}`, tipo)) {
        portas.push(viewPortaCmos(cmos.id, cmos.tipo));
      }
    }
  }
  return portas;
}

/** As cinco portas de um somador completo, na ordem em que ele as monta. */
const PORTAS_DO_SOMADOR: readonly (readonly [string, PortaLogica])[] = [
  ["xor1", "xor"],
  ["and1", "and"],
  ["xor2", "xor"],
  ["and2", "and"],
  ["or1", "or"],
];

/**
 * O somador de 32 bits da ULA, em serpentina.
 *
 * A vista montada na hora enfileirava os trinta e dois somadores numa linha só:
 * dentro da caixa da ULA aquilo vira uma fita de mil e poucas unidades de
 * largura por quarenta de altura, e o encaixe uniforme — que é o certo — a
 * reduz a um fio de peças ilegíveis. Correta, e inútil.
 *
 * A serpentina mantém o que há para aprender: o vai-um **atravessa a largura
 * inteira do número**, um estágio de cada vez, e é isso que custa profundidade.
 * Ele continua andando em fila; a fila é que dobra ao chegar na borda, como a
 * linha de um texto. A volta é desenhada da direita para a esquerda, e por isso
 * a leitura não se perde na dobra.
 */
export function viewSomadorDaUla(bits: number, porLinha = 8): View {
  const largura = 150;
  const altura = 92;
  const folga = 26;
  const linhas = Math.ceil(bits / porLinha);

  return {
    id: "somador-da-ula",
    focus: "somador",
    title: "The carry walks the whole width of the number, one stage at a time",
    width: porLinha * (largura + folga) + folga,
    height: linhas * (altura + folga) + folga,
    places: Array.from({ length: bits }, (_, i) => {
      const linha = Math.floor(i / porLinha);
      const coluna = i % porLinha;
      // Linha ímpar volta ao contrário: é a dobra da serpentina, e sem ela o
      // vai-um pularia da borda direita para a esquerda por cima de tudo.
      const x = linha % 2 === 0 ? coluna : porLinha - 1 - coluna;
      return {
        id: `bit${i}`,
        x: folga + x * (largura + folga),
        y: folga + linha * (altura + folga),
        w: largura,
        h: altura,
        collapsed: true as const,
      };
    }),
  };
}
