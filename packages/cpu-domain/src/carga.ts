import type { Message } from "@ovh/depth-core";

/**
 * O que a carga leva, em dois ou três caracteres.
 *
 * O motor sabe que uma mensagem tem forma, peso e dados; **o que aqueles dados
 * significam é do domínio**. Um `bit` é 0 ou 1, um `endereco` é hexadecimal,
 * um `sinal` é o nome da decisão que ele carrega. Deixar o desenho adivinhar
 * seria pedir a ele que inventasse, e é a fronteira que este projeto guarda.
 *
 * O valor existe para uma coisa só: **ver a transformação**. Um ponto anônimo
 * andando na linha mostra que algo passou; o valor ao lado dele mostra o que
 * entrou num bloco e o que saiu do outro lado — que é a coisa a entender.
 */
export function leituraDaCarga(mensagem: Message): string | undefined {
  const d = mensagem.data;

  const numero = (v: unknown): string | undefined =>
    typeof v === "number" ? String(v | 0) : undefined;
  const hex = (v: unknown): string | undefined =>
    typeof v === "number" ? `0x${(v >>> 0).toString(16)}` : undefined;

  switch (mensagem.kind) {
    case "bit":
      return typeof d.bit === "number" ? String(d.bit) : undefined;

    // A corrente não leva número: ela leva se o caminho está aberto, e qual
    // trilho está puxando. É o único "valor" que existe naquele nível.
    case "corrente":
      return d.conduz === true ? (d.bit === 1 ? "▲1" : "▼0") : "—";

    case "endereco":
      return hex(d.pc);
    case "selecao":
      // A linha escolhida, e não o endereço: é o que sai de um decodificador
      // de endereço, e ver o número mudar de um para o outro é ver o passo.
      return `#${String(d.linha)}`;
    case "instrucao":
      return hex(d.word);
    case "proximo":
      return hex(d.pc);
    case "palavra":
    case "entrada":
      return numero(d.valor);
    case "parcela":
      return numero(d.n);
    case "soma":
      return numero(d.soma);
    case "logico":
      return numero(d.valor);
    case "resultado":
      return numero(d.resultado);
    // O que voltou da memória, já com o destino: é a carga que o `lw` esperava.
    case "acessado":
      return typeof d.rd === "number" && typeof d.lido === "number"
        ? `x${d.rd}←${d.lido | 0}`
        : numero(d.lido);
    case "escrita":
      return typeof d.rd === "number" && typeof d.valor === "number"
        ? `x${d.rd}=${d.valor | 0}`
        : undefined;
    case "guardar":
      return typeof d.addr === "number" && typeof d.valor === "number"
        ? `${hex(d.addr)}←${d.valor | 0}`
        : undefined;

    // A instrução decodificada: o que o leitor procura nela são os registradores
    // que ela vai tocar, e não os cinco campos inteiros — isso é trabalho da
    // ficha, não de uma etiqueta que anda.
    case "campos": {
      const rs1 = numero(d.rs1);
      const rs2 = numero(d.rs2);
      const rd = numero(d.rd);
      if (rs1 === undefined || rs2 === undefined || rd === undefined) return undefined;
      return `x${rs1},x${rs2}→x${rd}`;
    }

    // O pulso não carrega dado nenhum, e é isso que ele diz: o relógio não
    // manda um valor, manda o instante. A legenda existe para o leitor não
    // confundir "sem legenda" com "não soubemos ler".
    case "pulso":
      return "⏱";

    // Os dois operandos a caminho da ULA. É o par que entra; o que sai é a
    // soma, e ver os dois lados da linha é ver a conta acontecer.
    case "operandos":
    case "valores": {
      const a = numero(d.a);
      const b = numero(d.b);
      return a === undefined || b === undefined ? undefined : `${a},${b}`;
    }

    // O sinal de controle não carrega valor: carrega a decisão, e o nome dela
    // é o que se quer ler na linha tracejada.
    case "sinal": {
      const decisao = Object.values(d).find((v) => typeof v === "string" || typeof v === "number");
      return decisao === undefined ? undefined : String(decisao);
    }

    default:
      return undefined;
  }
}
