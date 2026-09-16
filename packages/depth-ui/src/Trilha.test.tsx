import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Parada } from "@ovh/depth-core";
import { Trilha } from "./Trilha.js";

/**
 * Um caminho reto: três lugares, e o segundo salto acrescenta campo.
 *
 * Os nomes são neutros de propósito — a `Trilha` não sabe o que atravessa ela,
 * e um teste com vocabulário de um domínio esconderia isso.
 */
const RETO: readonly Parada[] = [
  { tick: 1, de: "origem", para: "meio", corpo: { id: 7 }, mudou: [] },
  { tick: 3, de: "meio", para: "destino", corpo: { id: 7, campoA: "x" }, mudou: ["campoA"] },
];

/**
 * Um leque: três saltos que saem do MESMO lugar, e cada um guarda uma coisa
 * diferente da mesma carga. É o caso que existe hoje no lab dos três pilares.
 */
const LEQUE: readonly Parada[] = [
  { tick: 1, de: "fonte", para: "guarda-a", corpo: { id: 7, a: 1 }, mudou: [] },
  { tick: 1, de: "fonte", para: "guarda-b", corpo: { id: 7, b: 2 }, mudou: ["b"] },
  { tick: 1, de: "fonte", para: "guarda-c", corpo: { id: 7, c: 3 }, mudou: ["c"] },
];

// A limpeza é explícita porque a suíte não roda com `globals`, e sem ela o
// auto-cleanup da testing-library não se registra: cada `render` ficaria
// empilhado no mesmo `document.body` e um teste leria as estações do anterior.
afterEach(() => {
  cleanup();
});

describe("Trilha", () => {
  it("desenha uma estação por ponta do trajeto, na ordem em que foram vistas", () => {
    /*
      O trajeto tem N paradas e N+1 estações: a primeira parada traz duas
      pontas, e cada parada seguinte acrescenta uma. Desenhar uma estação por
      parada perderia a origem — o item passaria a nascer no meio do caminho.
    */
    render(<Trilha trajeto={RETO} titulo="item 7" />);
    const estacoes = screen.getAllByRole("listitem");
    expect(estacoes.map((e) => e.textContent)).toEqual([
      expect.stringContaining("origem"),
      expect.stringContaining("meio"),
      expect.stringContaining("destino"),
    ]);
  });

  it("põe o que o salto mudou na estação a que ele CHEGOU", () => {
    /*
      O rótulo é do salto. Ele mora na chegada por uma razão que só o leque
      revela: três saltos saem do mesmo lugar com deltas diferentes, e do lado
      da partida os três disputariam a mesma linha. Na chegada, cada braço
      carrega o seu — e num caminho reto o texto continua caindo entre os dois
      pontos, que é onde ele aconteceu.
    */
    render(<Trilha trajeto={RETO} titulo="item 7" />);
    const marcas = screen.getAllByRole("listitem").map((e) => e.getAttribute("data-mudou"));
    expect(marcas).toEqual([null, null, "campoA"]);
  });

  it("num leque, cada braço é uma estação própria pendurada na mesma origem", () => {
    /*
      É o caso do lab dos três pilares, e é o que quebra uma espinha ingênua:
      três paradas que saem do mesmo lugar não são três trechos de um caminho.
      Desenhadas em fila, elas afirmariam que a carga passou por um, depois pelo
      outro — e o assunto do lab é justamente que os três viram a MESMA coisa.
    */
    render(<Trilha trajeto={LEQUE} titulo="item 7" />);
    const estacoes = screen.getAllByRole("listitem");
    expect(estacoes.map((e) => e.textContent)).toEqual([
      expect.stringContaining("fonte"),
      expect.stringContaining("guarda-a"),
      expect.stringContaining("guarda-b"),
      expect.stringContaining("guarda-c"),
    ]);
    // A primeira não é ramo: ela é a que continua a linha. As outras duas
    // penduram na mesma origem, e é o `data-ramo` que faz o desenho bifurcar.
    expect(estacoes.map((e) => e.getAttribute("data-ramo"))).toEqual([null, null, "true", "true"]);
    // E cada braço guarda o seu, que é a tese do lab.
    expect(estacoes[2]?.getAttribute("data-mudou")).toBe("b");
    expect(estacoes[3]?.getAttribute("data-mudou")).toBe("c");
  });

  it("diz a ausência em vez de omiti-la", () => {
    /*
      Chegada sem nada mudado é `unchanged`; a primeira de todas é
      `first sighting`. Em branco, as três situações — não vi antes, vi e nada
      mudou, mudou — pareceriam a mesma coisa na tela.
    */
    const semMudanca: readonly Parada[] = [
      { tick: 1, de: "origem", para: "meio", corpo: { id: 7 }, mudou: [] },
      { tick: 2, de: "meio", para: "destino", corpo: { id: 7 }, mudou: [] },
    ];
    render(<Trilha trajeto={semMudanca} titulo="item 7" />);
    expect(screen.getByText("first sighting")).toBeDefined();
    expect(screen.getByText("unchanged")).toBeDefined();
  });

  it("marca como atual apenas a última estação", () => {
    /*
      Duas estações atuais significariam que o item está em dois lugares. A
      trilha desenha UM item.
    */
    render(<Trilha trajeto={RETO} titulo="item 7" />);
    const atuais = screen
      .getAllByRole("listitem")
      .filter((e) => e.getAttribute("data-atual") === "true");
    expect(atuais).toHaveLength(1);
    expect(atuais[0]?.textContent).toContain("destino");
  });

  it("mostra o corpo da última parada com o campo alterado marcado", () => {
    /*
      O corpo é o de AGORA, e o que está marcado é o que a última parada mudou.
      Sem a marca, o leitor teria de comparar dois blocos de JSON de cabeça —
      que é exatamente o trabalho que a peça existe para tirar dele.
    */
    const { container } = render(<Trilha trajeto={RETO} titulo="item 7" />);
    const marcadas = container.querySelectorAll('.dui-inspector__line[data-changed="true"]');
    expect(marcadas.length).toBeGreaterThan(0);
    expect([...marcadas].some((n) => n.textContent?.includes("campoA"))).toBe(true);
  });

  it("não desenha estação nenhuma quando o trajeto está vazio", () => {
    /*
      O item pode ainda não ter sido visto. Uma trilha vazia com estações
      desenhadas afirmaria um percurso que ninguém andou.
    */
    render(<Trilha trajeto={[]} titulo="item 7" vazio="nothing yet" />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("nothing yet")).toBeDefined();
  });
});
