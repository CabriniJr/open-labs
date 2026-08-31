import type {
  AnyObject,
  Emission,
  Message,
  ObjectSpec,
  Wire,
  WorldSpec,
  WorldState,
} from "@ovh/depth-core";
import { peso, somador as somadorDeNBits } from "../alu.js";
import { nivelFixo } from "../gates.js";
import { ROTULOS } from "../labels.js";
import { PRIMEIRA_FASE, ordensDe, proximaFase } from "./fases.js";
import type { Fase, Ordem } from "./fases.js";
import { INICIO_PROGRAMA, decodificar } from "./isa.js";
import type { Mnemonico } from "./isa.js";

/**
 * O caminho de dados do microprocessador genérico.
 *
 * A diferença que dá nome à rodada está aqui: **um tick é um micro-passo**, e
 * não uma instrução. A unidade de controle guarda a fase entre ticks e acende
 * as linhas que aquela fase pede; os registradores fazem o que a linha manda.
 *
 * Duas fases do motor, como sempre:
 *
 * - **acomodação** — a UC lê a fase e acende as ordens; quem foi chamado
 *   calcula. Combinacional, e o estado devolvido aqui é descartado.
 * - **confronto** — os registradores e a memória guardam.
 *
 * A memória é **uma só**, com o programa em 0000 e os dados em 2000, como no
 * deck. Não é Harvard: esta máquina tem um barramento de endereços e um de
 * dados, e é justamente por isso que buscar e executar não cabem no mesmo
 * instante. É a razão física do ciclo, e o modelo tem que mostrá-la.
 *
 * Quem decide a sequência é `fases.ts`, e nada aqui a recalcula: a UC pergunta
 * qual é a próxima fase e o que está aceso nela. Duas cópias da sequência
 * seriam duas máquinas, e a que o teste de `fases.ts` cobre seria a errada.
 *
 * O que faz o micro-passo caber num tick está em `Saida`, mais abaixo: uma
 * transferência acontece dentro do instante em que a ordem acende, e a borda de
 * relógio fica onde há laço — que é onde um circuito de verdade põe um
 * registrador.
 */

const OITO_BITS = 0xff;
const DEZESSEIS_BITS = 0xffff;

interface EstadoRegistrador {
  readonly valor: number;
}
interface EstadoStatus {
  readonly zero: boolean;
  readonly vaium: boolean;
}
interface EstadoMemoria {
  readonly mem: ReadonlyMap<number, number>;
}
interface EstadoUc {
  /** A fase que rodou no último tick. `null` antes do primeiro pulso. */
  readonly fase: Fase | null;
  /** Parou porque o que estava no IR não é instrução. */
  readonly parado: boolean;
}

type Sinais = Readonly<Record<string, readonly Message[]>>;

const dado = (m: Message | undefined, campo: string): number =>
  (m?.data[campo] as number | undefined) ?? 0;

const achar = (inbox: readonly Message[], kind: string): Message | undefined =>
  inbox.find((m) => m.kind === kind);

/** Uma ordem acesa é uma linha de controle com sinal nela, e nada mais. */
const acesa = (sinais: Sinais, ordem: Ordem): boolean => sinais[ordem] !== undefined;

/**
 * O valor que a ordem manda transferir, ou um erro dizendo o que faltou.
 *
 * A alternativa era ler zero de uma entrada vazia, e aí um fio esquecido
 * viraria uma soma com zero, uma escrita de zero, um endereço zero — todos
 * resultados plausíveis, nenhum acusado. É o defeito que este projeto persegue:
 * o modelo continuaria rodando e mentindo baixinho.
 */
function exigir(m: Message | undefined, falta: string): Message {
  if (m === undefined) throw new Error(`micro: ${falta}`);
  return m;
}

/** Os dois bytes de endereço, na ordem em que a máquina os leu. */
const enderecoDeHl = (inbox: readonly Message[], ordem: Ordem): number =>
  ((dado(exigir(achar(inbox, "h"), `${ordem} sem o byte alto na entrada`), "valor") << 8) |
    dado(exigir(achar(inbox, "l"), `${ordem} sem o byte baixo na entrada`), "valor")) &
  DEZESSEIS_BITS;

/**
 * O relógio. Ele **dirige**: acende dentro do próprio tick, e não uma borda
 * depois.
 *
 * Um pulso que custasse uma borda faria o primeiro micro-passo acontecer no
 * tick 2, e a tabela de tempo abriria com uma linha em que nada aconteceu — num
 * modelo cuja tese é "um tick é um micro-passo", essa linha seria a primeira
 * coisa a desmentir a tese.
 */
const relogio: ObjectSpec<Record<string, never>> = {
  id: "relogio",
  kind: "source",
  label: ROTULOS.relogio,
  leaf: true,
  drives: true,
  behavior: (state, _inbox, ctx) =>
    ctx.phase === "settle"
      ? { state, out: [{ port: "pulso", message: ctx.emit("pulso") }] }
      : { state, out: [] },
};

/**
 * A unidade de controle: a máquina de fases.
 *
 * Ela é `sequencer` porque guarda estado entre ticks e decide por linha de
 * controle — e o motor recusa o mundo se alguma aresta que sai daqui carregar
 * carga. A fase é o único estado dela; o mnemônico e o bit Z chegam de fora, do
 * IR e do status, em vez de serem copiados para cá. Uma cópia envelheceria um
 * tick e ninguém veria.
 *
 * O decodificador de instrução mora dentro dela, como no deck: o que chega do
 * IR é um byte, e virar mnemônico é trabalho de quem comanda.
 *
 * A fase é calculada na acomodação, e não no fim do tick anterior, por uma
 * razão de causalidade: a fase que vem depois de `decodifica` depende do
 * formato da instrução, e o IR só entrega o byte na borda em que ele foi
 * carregado. Decidir antes seria adivinhar — que é exatamente o que a fase de
 * decodificação existe para não precisar fazer.
 */
const uc: ObjectSpec<EstadoUc> = {
  id: "uc",
  kind: "sequencer",
  label: ROTULOS.controle,
  leaf: true,
  init: (): EstadoUc => ({ fase: null, parado: false }),
  behavior: (state, inbox, ctx) => {
    if (state.parado) return { state, out: [] };
    // Sem pulso não há instante: é o relógio que faz o micro-passo acontecer.
    if (achar(inbox, "pulso") === undefined) return { state, out: [] };

    const noIr = achar(inbox, "ir");
    const m: Mnemonico | undefined =
      noIr === undefined ? undefined : decodificar(dado(noIr, "valor"));
    const zero = (achar(inbox, "status")?.data.zero as boolean | undefined) ?? false;

    // O byte decodificou em nada. A máquina para aqui, e parar é a resposta
    // certa: o que vem depois de uma instrução que não existe não é programa.
    if (state.fase === "decodifica" && m === undefined) {
      return { state: { fase: state.fase, parado: true }, out: [] };
    }

    const fase = state.fase === null ? PRIMEIRA_FASE : proximaFase(state.fase, m, zero);
    if (ctx.phase === "commit") return { state: { fase, parado: false }, out: [] };
    return {
      state,
      // Uma porta por ordem, com o nome que a ordem tem no slide. A linha
      // acesa é a que emitiu: uma que não acende não carrega sinal nenhum, e
      // é assim que o livro-caixa conta as ordens que de fato aconteceram.
      out: ordensDe(fase, m, zero).map((ordem) => ({
        port: ordem,
        message: ctx.emit("ordem", 1, { ordem }),
      })),
    };
  },
};

/**
 * Como a saída de um registrador chega a quem a recebe. São dois regimes, e a
 * diferença não é de gosto — é de quando a ordem fica sabida.
 *
 * - `"borda"` — a saída **atravessa a borda de relógio** e está sempre ligada.
 *   É o Q do registrador: o que ele entrega é o que guardou no flanco anterior,
 *   e ele não tem como saber, um instante antes, quem vai precisar dele. Quem
 *   decide a transferência é o latch do destino, aberto pela ordem.
 * - `"ordem"` — a saída acontece **dentro do instante**, e a ordem que a pede
 *   está acesa agora: então ela abre a porta da origem também. É a linha
 *   vermelha do slide, que num barramento interno liga as duas pontas de uma
 *   vez.
 *
 * `aoLatch` devolve `undefined` quando nenhuma ordem desta fase diz respeito a
 * este registrador — e aí ele guarda o que já tinha, que é o que um registrador
 * não escrito faz.
 */
type Saida =
  | { readonly modo: "borda" }
  | { readonly modo: "ordem"; readonly abre: (sinais: Sinais) => boolean };

function registrador(
  id: string,
  label: string,
  inicial: number,
  aoLatch: (atual: number, inbox: readonly Message[], sinais: Sinais) => number | undefined,
  saida: Saida,
): ObjectSpec<EstadoRegistrador> {
  return {
    id,
    kind: "buffer",
    label,
    leaf: true,
    init: (): EstadoRegistrador => ({ valor: inicial }),
    behavior: (state, inbox, ctx) => {
      if (ctx.phase === "settle") {
        const abre = saida.modo === "ordem" && saida.abre(ctx.signals);
        return {
          state,
          // O que sai é o conteúdo guardado, e não o que está entrando: um
          // registrador entrega o flanco anterior.
          out: abre ? [{ port: "q", message: ctx.emit(id, 1, { valor: state.valor }) }] : [],
        };
      }
      const valor = aoLatch(state.valor, inbox, ctx.signals) ?? state.valor;
      return {
        state: { valor },
        out:
          saida.modo === "borda" ? [{ port: "q", message: ctx.emit(id, 1, { valor }) }] : [],
      };
    },
  };
}

const pc = registrador(
  "pc",
  ROTULOS.pc,
  INICIO_PROGRAMA,
  (atual, inbox, sinais) => {
    if (acesa(sinais, "pc<-hl")) return enderecoDeHl(inbox, "pc<-hl");
    // Um por byte lido do programa, e é `fases.ts` quem sabe quantos são.
    if (acesa(sinais, "pc++")) return (atual + 1) & DEZESSEIS_BITS;
    return undefined;
  },
  // O PC só põe o endereço no barramento interno quando mandam levá-lo ao MAR.
  { modo: "ordem", abre: (sinais) => acesa(sinais, "mar<-pc") },
);

const ir = registrador(
  "ir",
  ROTULOS.ir,
  0,
  (_atual, inbox, sinais) =>
    acesa(sinais, "mbr->ir")
      ? dado(exigir(achar(inbox, "mbr"), "mbr->ir sem o MBR na entrada do IR"), "valor")
      : undefined,
  // A UC lê o IR o tempo todo: é dele que sai o mnemônico de toda fase depois
  // da decodificação, e não há ordem que peça essa leitura.
  { modo: "borda" },
);

const h = registrador(
  "h",
  ROTULOS.alto,
  0,
  (_atual, inbox, sinais) =>
    acesa(sinais, "mbr->h")
      ? dado(exigir(achar(inbox, "mbr"), "mbr->h sem o MBR na entrada do H"), "valor")
      : undefined,
  { modo: "borda" },
);

const l = registrador(
  "l",
  ROTULOS.baixo,
  0,
  (_atual, inbox, sinais) =>
    acesa(sinais, "mbr->l")
      ? dado(exigir(achar(inbox, "mbr"), "mbr->l sem o MBR na entrada do L"), "valor")
      : undefined,
  { modo: "borda" },
);

/**
 * O acumulador. Duas origens, e nunca as duas no mesmo micro-passo: o byte que
 * veio do MBR, ou a resposta da ULA.
 */
const ac = registrador(
  "ac",
  ROTULOS.ac,
  0,
  (_atual, inbox, sinais) => {
    if (acesa(sinais, "mbr->ac")) {
      return dado(exigir(achar(inbox, "mbr"), "mbr->ac sem o MBR na entrada do AC"), "valor");
    }
    const daUla = achar(inbox, "resultado");
    return daUla === undefined ? undefined : dado(daUla, "valor");
  },
  // A saída do acumulador alimenta a ULA e o MBR por borda, e é ela que fecha
  // o laço `ac -> ula -> ac`: um laço que se fechasse dentro do instante seria
  // combinacional, e o motor recusaria o mundo — com razão, porque é um
  // registrador que o quebra num circuito de verdade.
  { modo: "borda" },
);

/**
 * O ponteiro de pilha. **Existe e nada o move.**
 *
 * Está no diagrama do deck e nenhuma das seis instruções o toca — não há
 * chamada nem retorno nesta máquina. Desenhar sem ele seria desenhar outro
 * processador; dar-lhe um fio que nada usa seria pior, porque o desenho
 * afirmaria uma transferência que não existe.
 */
const sp: ObjectSpec<EstadoRegistrador> = {
  id: "sp",
  kind: "buffer",
  label: ROTULOS.ponteiroDePilha,
  leaf: true,
  init: (): EstadoRegistrador => ({ valor: 0 }),
  behavior: (state) => ({ state, out: [] }),
};

/**
 * O latch de endereços. Ele anuncia o que **já** guardou, e não o que está
 * guardando neste instante.
 *
 * É o comportamento de um registrador de verdade — a saída é o valor do flanco
 * anterior —, e aqui ela é indispensável: a memória grava na borda seguinte à
 * ordem de escrita, e é o MAR ainda segurando o endereço que faz o dado cair no
 * lugar certo. Um MAR transparente já estaria mostrando o próximo endereço de
 * instrução quando o dado chegasse.
 *
 * Ele é o único que põe o valor no barramento **sem ordem nenhuma**, e é o que
 * um barramento de endereços é: ele carrega sempre o que o MAR guarda. Quem
 * decide se há transação é a linha de leitura ou a de escrita, e por isso o
 * livro-caixa mostra um endereço por tick e só dez transações de dado.
 */
const mar: ObjectSpec<EstadoRegistrador> = {
  id: "mar",
  kind: "buffer",
  label: ROTULOS.mar,
  leaf: true,
  init: (): EstadoRegistrador => ({ valor: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase === "settle") {
      return {
        state,
        out: [{ port: "endereco", message: ctx.emit("endereco", 1, { valor: state.valor }) }],
      };
    }
    const sinais = ctx.signals;
    const valor = acesa(sinais, "mar<-pc")
      ? dado(exigir(achar(inbox, "pc"), "mar<-pc sem o PC na entrada do MAR"), "valor")
      : acesa(sinais, "mar<-hl")
        ? enderecoDeHl(inbox, "mar<-hl")
        : state.valor;
    return { state: { valor }, out: [] };
  },
};

/** As cinco ordens que abrem a saída do MBR sobre o barramento interno. */
const ORDENS_DO_MBR: readonly Ordem[] = ["mbr->ir", "mbr->ac", "mbr->t", "mbr->h", "mbr->l"];

/**
 * O latch de dados. É o único registrador **transparente**, e tem de ser.
 *
 * `acesso-dado` de um LOADM acende `ler` e `mbr->ac` no mesmo micro-passo: o
 * byte sai da memória, atravessa o MBR e chega ao acumulador dentro do mesmo
 * instante. Guardar primeiro e entregar na borda seguinte partiria esse
 * micro-passo em dois, e o modelo passaria a contar um tempo que a máquina do
 * deck não gasta.
 *
 * A saída para a memória é a exceção, e é `clocked` de propósito: a gravação é
 * síncrona — a memória só se compromete na borda. É também o que quebra o laço
 * combinacional entre o MBR e a memória, que existe porque a via de leitura e a
 * de escrita ligam as mesmas duas peças em sentidos opostos.
 */
const mbr: ObjectSpec<EstadoRegistrador> = {
  id: "mbr",
  kind: "buffer",
  label: ROTULOS.mbr,
  leaf: true,
  init: (): EstadoRegistrador => ({ valor: 0 }),
  behavior: (state, inbox, ctx) => {
    const sinais = ctx.signals;
    const daMemoria = achar(inbox, "lido");
    const valor = acesa(sinais, "mbr<-ac")
      ? dado(exigir(achar(inbox, "ac"), "mbr<-ac sem o acumulador na entrada do MBR"), "valor")
      : daMemoria === undefined
        ? state.valor
        : dado(daMemoria, "valor");

    if (ctx.phase === "settle") {
      const abre = ORDENS_DO_MBR.some((ordem) => acesa(sinais, ordem));
      return {
        state,
        out: abre ? [{ port: "interno", message: ctx.emit("mbr", 1, { valor }) }] : [],
      };
    }
    return {
      state: { valor },
      out: acesa(sinais, "escrever")
        ? [{ port: "escrita", message: ctx.emit("escrita", 1, { valor }) }]
        : [],
    };
  },
};

/**
 * O temporário. Ele anuncia na acomodação o que vai guardar no confronto, e os
 * dois usam a mesma conta.
 *
 * É o que faz `mbr->t` e `somar` caberem no mesmo micro-passo, como no slide
 * 43: o operando entra no temporário e a ULA age sobre ele no mesmo instante.
 * Sem o anúncio, a ULA somaria o operando anterior — a resposta ainda seria um
 * número, e ninguém veria que é o número errado.
 */
const t: ObjectSpec<EstadoRegistrador> = {
  id: "t",
  kind: "buffer",
  label: ROTULOS.temporario,
  leaf: true,
  init: (): EstadoRegistrador => ({ valor: 0 }),
  behavior: (state, inbox, ctx) => {
    const valor = acesa(ctx.signals, "mbr->t")
      ? dado(exigir(achar(inbox, "mbr"), "mbr->t sem o MBR na entrada do T"), "valor")
      : state.valor;
    if (ctx.phase === "settle") {
      return {
        state,
        out: acesa(ctx.signals, "somar")
          ? [{ port: "operando", message: ctx.emit("t", 1, { valor }) }]
          : [],
      };
    }
    return { state: { valor }, out: [] };
  },
};

/**
 * O registrador de estado: Z e C.
 *
 * Z é o único bit desta máquina que muda o caminho do programa, e ele muda em
 * um lugar só — o desvio condicional. Guardar aqui, e não na UC, é o que faz o
 * desvio depender de uma peça que o leitor vê acender.
 */
const status: ObjectSpec<EstadoStatus> = {
  id: "status",
  kind: "buffer",
  label: ROTULOS.status,
  leaf: true,
  init: (): EstadoStatus => ({ zero: false, vaium: false }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const daUla = achar(inbox, "resultado");
    const novo: EstadoStatus =
      daUla === undefined
        ? state
        : {
            zero: (daUla.data.zero as boolean | undefined) ?? false,
            vaium: (daUla.data.vaium as boolean | undefined) ?? false,
          };
    return {
      state: novo,
      out: [{ port: "q", message: ctx.emit("status", 1, { zero: novo.zero, vaium: novo.vaium }) }],
    };
  },
};

/**
 * A ULA, aberta até onde o slide não vai.
 *
 * O deck desenha duas caixas — "Complementador/Deslocador" e "Somador" — e para
 * ali, porque um slide não abre. Aqui o somador de oito bits é o **mesmo** que
 * o RISC-V usa em trinta e dois: `somador()` de `alu.ts`, agora com a largura
 * por argumento, e por baixo dele os somadores completos de `gates.ts` e as
 * redes CMOS de `transistors.ts`. Nenhum silício foi escrito de novo — se
 * tivesse sido, haveria duas verdades sobre o que uma porta XOR faz, e uma
 * delas envelheceria calada.
 *
 * O que é desta máquina, e só dela, são as duas pontas: o dispersor lê `AC` e
 * `T`, o coletor devolve `{valor, zero, vaium}`. A ULA inteira do RISC-V não
 * serviria, e a razão é o topo dela, não o fundo: lá a operação é escolhida por
 * mnemônico de RISC-V e o vai-um final é jogado fora, porque aquela máquina não
 * tem bandeira de carry. O que generaliza é o andar de baixo, e é ele que está
 * reusado.
 *
 * Nada disso mexeu num fio de fora. Os bornes continuam `operando`, `somar` e
 * `resultado`, exatamente como quando a ULA era uma folha só — que é o motivo
 * de ela ter nascido como contêiner de uma peça.
 */
const BITS_DA_ULA = 8;

/**
 * O número vira oito linhas, e só quando mandam somar.
 *
 * Uma ULA que respondesse a cada tick encheria o livro-caixa de contas que a
 * máquina não pediu, e a conta é justamente o que mede quanto trabalho o
 * sistema fez. Calada, ela também deixa o silício em repouso nos micro-passos
 * que não somam — que é o que um circuito real faz quando nada muda na entrada.
 */
const dispersorDaUla: ObjectSpec<Record<string, never>> = {
  id: "dispersor",
  kind: "router",
  label: ROTULOS.dispersor,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle" || !acesa(ctx.signals, "somar")) return { state, out: [] };
    const a = dado(exigir(achar(inbox, "ac"), "somar sem o acumulador na entrada da ULA"), "valor");
    const b = dado(exigir(achar(inbox, "t"), "somar sem o temporário na entrada da ULA"), "valor");
    const out: Emission[] = [];
    for (let i = 0; i < BITS_DA_ULA; i += 1) {
      out.push({ port: `a${i}`, message: ctx.emit("bit", 1, { bit: (a >>> i) & 1 }) });
      out.push({ port: `b${i}`, message: ctx.emit("bit", 1, { bit: (b >>> i) & 1 }) });
    }
    return { state, out };
  },
};

/**
 * As oito linhas viram número, e as duas bandeiras saem com ele.
 *
 * Ele espera as oito parcelas **e** o vai-um do bit sete antes de falar: com
 * menos que isso a soma ainda estaria se propagando pela cascata, e anunciar no
 * meio seria publicar um número que o circuito ainda vai corrigir.
 *
 * O carry é lido da linha que sai do último somador, e não recalculado
 * comparando `a + b` com 255. Recalcular seria a segunda contabilidade de
 * sempre — e ela concordaria com a primeira até o dia em que não concordasse.
 */
const coletorDaUla: ObjectSpec<Record<string, never>> = {
  id: "coletor",
  kind: "router",
  label: ROTULOS.coletor,
  leaf: true,
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "settle") return { state, out: [] };
    const parcelas = inbox.filter((m) => m.kind === "parcela");
    const vaium = achar(inbox, "bit");
    if (parcelas.length < BITS_DA_ULA || vaium === undefined) return { state, out: [] };
    const valor = parcelas.reduce((total, m) => total + dado(m, "n"), 0) & OITO_BITS;
    return {
      state,
      out: [
        {
          port: "resultado",
          // Uma emissão, dois destinos: o acumulador e as bandeiras. É o mesmo
          // fio da ULA se abrindo, e não duas contas.
          message: ctx.emit("resultado", 1, {
            valor,
            zero: valor === 0,
            vaium: vaium.data.bit === 1,
          }),
        },
      ],
    };
  },
};

function ulaAberta(): { objeto: AnyObject; wires: readonly Wire[] } {
  // O vai-um do último bit vai para o coletor, e não para o descarte: esta
  // máquina tem bandeira de carry e o RISC-V não. É a única diferença que a
  // largura não explica.
  const somaDeOito = somadorDeNBits(BITS_DA_ULA, true, "coletor");
  const pesos = Array.from({ length: BITS_DA_ULA }, (_, i) => peso(i));

  return {
    objeto: {
      id: "ula",
      kind: "composite",
      label: ROTULOS.ula,
      inlets: { operando: ["dispersor"], somar: ["dispersor"] },
      outlets: { resultado: ["coletor"] },
      children: [
        dispersorDaUla,
        nivelFixo("cin0", 0, ROTULOS.cin),
        somaDeOito.objeto,
        {
          id: "pesos",
          kind: "composite",
          label: ROTULOS.pesos,
          replicas: BITS_DA_ULA,
          children: pesos,
        },
        coletorDaUla,
      ],
    },
    wires: [
      // O vem-de-trás do bit zero, amarrado em zero. Sem ele a primeira porta
      // não tem o que responder, e a ULA inteira devolve zero sem reclamar.
      { from: "cin0", port: "out", to: "bit0", toPort: "cin", timing: "settle" },
      ...somaDeOito.wires,
    ],
  };
}

/**
 * Uma via: transporta e não altera, que é a definição de `conduit`. Uma via que
 * mexesse na carga faria o desenho mentir sobre o que acontece entre as pontas.
 */
function via(id: string, label: string): ObjectSpec {
  return {
    id,
    kind: "channel",
    label,
    leaf: true,
    behavior: (state, inbox, ctx) =>
      ctx.phase !== "settle" || inbox.length === 0
        ? { state, out: [] }
        : { state, out: inbox.map((message) => ({ port: "out", message })) },
  };
}

/**
 * O barramento de dados, com as duas vias que ele tem de ter.
 *
 * Uma via só, percorrida nos dois sentidos, seria um laço combinacional — e o
 * motor recusa, com razão: dentro do mesmo instante, um fio não pode levar o
 * dado da memória para o MBR e o do MBR para a memória. São dois sentidos, e
 * eles nunca acontecem no mesmo micro-passo.
 */
const barramentoDeDados: ObjectSpec = {
  id: "barramento-dado",
  kind: "channel",
  label: ROTULOS.barramento,
  children: [via("via-leitura", ROTULOS.viaLeitura), via("via-escrita", ROTULOS.viaEscrita)],
};

/**
 * A memória, uma só: programa em 0000, dados em 2000.
 *
 * Ela lê na acomodação e grava no confronto, e não é simetria de conveniência —
 * é a diferença entre uma leitura assíncrona, que responde dentro do mesmo
 * instante, e uma gravação que só vale na borda.
 *
 * Célula que ninguém escreveu lê zero, e zero não é opcode de nada: é assim que
 * a máquina encontra o fim do programa em vez de executar lixo.
 */
function memoriaPrincipal(programa: Uint8Array): ObjectSpec<EstadoMemoria> {
  return {
    id: "memoria",
    kind: "store",
    label: ROTULOS.memoria,
    leaf: true,
    init: (): EstadoMemoria => {
      const mem = new Map<number, number>();
      programa.forEach((byte, i) => mem.set(INICIO_PROGRAMA + i, byte));
      return { mem };
    },
    behavior: (state, inbox, ctx) => {
      const noBarramento = achar(inbox, "endereco");
      if (ctx.phase === "settle") {
        if (!acesa(ctx.signals, "ler")) return { state, out: [] };
        const endereco = dado(
          exigir(noBarramento, "ler sem endereço no barramento de endereços"),
          "valor",
        );
        return {
          state,
          out: [
            { port: "lido", message: ctx.emit("lido", 1, { valor: state.mem.get(endereco) ?? 0 }) },
          ],
        };
      }

      const escrita = achar(inbox, "escrita");
      if (escrita === undefined) return { state, out: [] };
      // A via de escrita não carrega outra coisa: o que chega por ela **é** a
      // gravação. E ela sozinha não basta — sem endereço no barramento, o dado
      // cairia em 0000 sem ninguém reclamar.
      const endereco = dado(
        exigir(noBarramento, "chegou dado na via de escrita sem endereço no barramento"),
        "valor",
      );
      const mem = new Map(state.mem);
      mem.set(endereco, dado(escrita, "valor") & OITO_BITS);
      return { state: { mem }, out: [] };
    },
  };
}

/**
 * O estado da máquina, lido por id.
 *
 * Existe para que o teste e a tabela de tempo não cavem em `state.nodes`: quem
 * lê o modelo lê os nomes das peças, e não a estrutura interna do motor.
 *
 * `fase` é a fase **daquele** tick — a UC calcula na acomodação e guarda no
 * confronto, então o estado depois do commit é o do micro-passo que acabou de
 * acontecer. No tick 0 nada rodou ainda, e o que se lê é a fase que vai rodar.
 */
export interface EstadoMicro {
  readonly pc: number;
  readonly ir: number;
  readonly ac: number;
  readonly t: number;
  readonly h: number;
  readonly l: number;
  readonly sp: number;
  readonly mar: number;
  readonly mbr: number;
  readonly zero: boolean;
  readonly fase: Fase;
  readonly memoria: ReadonlyMap<number, number>;
}

export function estadoDe(s: WorldState): EstadoMicro {
  const valor = (id: string): number => (s.nodes[id] as EstadoRegistrador | undefined)?.valor ?? 0;
  const controle = s.nodes.uc as EstadoUc | undefined;
  return {
    pc: valor("pc"),
    ir: valor("ir"),
    ac: valor("ac"),
    t: valor("t"),
    h: valor("h"),
    l: valor("l"),
    sp: valor("sp"),
    mar: valor("mar"),
    mbr: valor("mbr"),
    zero: (s.nodes.status as EstadoStatus | undefined)?.zero ?? false,
    fase: controle?.fase ?? PRIMEIRA_FASE,
    memoria: (s.nodes.memoria as EstadoMemoria | undefined)?.mem ?? new Map(),
  };
}

/** Uma linha de controle: sai da UC pela porta que tem o nome da ordem. */
function linha(ordem: Ordem, para: readonly string[]): readonly Wire[] {
  return para.map((destino) => ({
    from: "uc",
    port: ordem,
    to: destino,
    line: "control" as const,
    toPort: ordem,
    timing: "settle" as const,
  }));
}

export function microWorld(programa: Uint8Array, seed = 1): WorldSpec {
  const ula = ulaAberta();
  const processador: AnyObject = {
    id: "processador",
    kind: "composite",
    label: ROTULOS.processador,
    children: [pc, ir, mar, mbr, ac, t, h, l, sp, status, ula.objeto],
  };
  const cpu: AnyObject = {
    id: "cpu",
    kind: "composite",
    label: ROTULOS.cpu,
    children: [uc, processador],
  };
  const root: AnyObject = {
    id: "sistema",
    kind: "composite",
    label: ROTULOS.sistema,
    children: [
      relogio,
      cpu,
      // Uma via só, e é o bastante: endereço vai da CPU para a memória e nunca
      // volta. O de dados precisa de duas porque tem os dois sentidos.
      via("barramento-endereco", ROTULOS.barramentoEndereco),
      barramentoDeDados,
      memoriaPrincipal(programa),
    ],
  };

  return {
    id: "micro",
    seed,
    // Uma borda de relógio, um tick. É o que faz a saída de um registrador
    // chegar ao destino no micro-passo seguinte, e não três depois.
    edgeTicks: 1,
    root,
    params: {},
    wires: [
      // Os fios de dentro da ULA. Eles são gerados por `alu.ts` a partir da
      // largura, e é por isso que oito bits não custam oito linhas escritas.
      ...ula.wires,

      // o pulso, e o que a UC precisa saber para decidir: o byte que está no IR
      // e o bit Z. Nenhum dos dois é copiado para dentro dela
      { from: "relogio", port: "pulso", to: "uc", timing: "settle" },
      { from: "ir", port: "q", to: "uc", timing: "clocked", width: 8 },
      { from: "status", port: "q", to: "uc", timing: "clocked" },

      // O barramento interno. As saídas que fecham laço com quem as alimenta
      // atravessam a borda de relógio — `ac -> ula -> ac`, `mbr -> h -> pc ->
      // mar -> memória -> mbr` —, e é isso que faz o micro-passo custar um
      // tick: o que o destino guarda é o que a origem tinha no flanco anterior.
      { from: "h", port: "q", to: "mar", timing: "clocked", width: 8 },
      { from: "l", port: "q", to: "mar", timing: "clocked", width: 8 },
      { from: "h", port: "q", to: "pc", timing: "clocked", width: 8 },
      { from: "l", port: "q", to: "pc", timing: "clocked", width: 8 },
      { from: "ac", port: "q", to: "mbr", timing: "clocked", width: 8 },
      { from: "ac", port: "q", to: "ula", toPort: "operando", timing: "clocked", width: 8 },
      // O que não fecha laço acontece dentro do instante, aberto pela ordem.
      { from: "pc", port: "q", to: "mar", timing: "settle", width: 16 },
      { from: "t", port: "operando", to: "ula", toPort: "operando", timing: "settle", width: 8 },
      { from: "ula", port: "resultado", to: "ac", timing: "settle", width: 8 },
      { from: "ula", port: "resultado", to: "status", timing: "settle", width: 8 },

      // Nada fala com a memória sem passar pelos barramentos. É o que impede
      // buscar e executar de caberem no mesmo instante — e é a razão física do
      // ciclo de instrução desta máquina.
      { from: "mar", port: "endereco", to: "barramento-endereco", timing: "settle", width: 16 },
      { from: "barramento-endereco", port: "out", to: "memoria", timing: "settle", width: 16 },
      { from: "memoria", port: "lido", to: "via-leitura", timing: "settle", width: 8 },
      { from: "via-leitura", port: "out", to: "mbr", timing: "settle", width: 8 },
      { from: "mbr", port: "escrita", to: "via-escrita", timing: "clocked", width: 8 },
      { from: "via-escrita", port: "out", to: "memoria", timing: "settle", width: 8 },

      // O MBR sobre o barramento interno: um fio, cinco destinos, e a ordem
      // acesa diz qual deles guarda.
      { from: "mbr", port: "interno", to: "ir", timing: "settle", width: 8 },
      { from: "mbr", port: "interno", to: "ac", timing: "settle", width: 8 },
      { from: "mbr", port: "interno", to: "t", timing: "settle", width: 8 },
      { from: "mbr", port: "interno", to: "h", timing: "settle", width: 8 },
      { from: "mbr", port: "interno", to: "l", timing: "settle", width: 8 },

      // As ordens. Metade do diagrama do slide 9 é vermelha, e é isto aqui.
      // A ordem chega nas duas pontas quando a transferência acontece dentro do
      // instante: ela abre a saída da origem e o latch do destino.
      ...linha("mar<-pc", ["pc", "mar"]),
      ...linha("mar<-hl", ["mar"]),
      ...linha("ler", ["memoria"]),
      ...linha("escrever", ["mbr"]),
      ...linha("mbr->ir", ["mbr", "ir"]),
      ...linha("mbr->ac", ["mbr", "ac"]),
      ...linha("mbr->t", ["mbr", "t"]),
      ...linha("mbr->h", ["mbr", "h"]),
      ...linha("mbr->l", ["mbr", "l"]),
      ...linha("mbr<-ac", ["mbr"]),
      ...linha("pc++", ["pc"]),
      ...linha("pc<-hl", ["pc"]),
      ...linha("somar", ["t", "ula"]),
    ],
  };
}

export type { EstadoMemoria, EstadoRegistrador, EstadoStatus, EstadoUc };
