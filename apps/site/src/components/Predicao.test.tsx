import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Predicao } from "./Predicao.js";

afterEach(cleanup);

const props: {
  readonly pergunta: string;
  readonly opcoes: readonly [string, string, string];
  readonly correta: number;
  readonly revelacao: string;
} = {
  pergunta: "What happens when the queue is full?",
  opcoes: ["The span is dropped", "The exporter blocks", "The queue grows"],
  correta: 0,
  revelacao: "maxQueueSize is a hard limit: the span is dropped.",
};

describe("predição antes da revelação", () => {
  it("a revelação NÃO está no documento antes de responder", () => {
    render(<Predicao {...props} />);
    expect(screen.queryByText(props.revelacao)).toBeNull();
  });

  it("responder mostra a revelação e marca a escolha", () => {
    render(<Predicao {...props} />);
    fireEvent.click(screen.getByRole("button", { name: props.opcoes[1] }));
    expect(screen.getByText(props.revelacao)).not.toBeNull();
    expect(screen.getByRole("button", { name: props.opcoes[1] }).getAttribute("data-veredito")).toBe(
      "errado",
    );
    expect(screen.getByRole("button", { name: props.opcoes[0] }).getAttribute("data-veredito")).toBe(
      "certo",
    );
  });

  it("acertar marca a mesma opção como certa, e não como escolha errada", () => {
    render(<Predicao {...props} />);
    fireEvent.click(screen.getByRole("button", { name: props.opcoes[0] }));
    expect(screen.getByRole("button", { name: props.opcoes[0] }).getAttribute("data-veredito")).toBe(
      "certo",
    );
  });

  it("não dá para trocar depois de responder — o compromisso é o mecanismo", () => {
    const onResponder = vi.fn();
    render(<Predicao {...props} onResponder={onResponder} />);
    fireEvent.click(screen.getByRole("button", { name: props.opcoes[2] }));
    fireEvent.click(screen.getByRole("button", { name: props.opcoes[0] }));
    expect(onResponder).toHaveBeenCalledTimes(1);
    expect(onResponder).toHaveBeenCalledWith(2);
    for (const opcao of props.opcoes) {
      expect((screen.getByRole("button", { name: opcao }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
