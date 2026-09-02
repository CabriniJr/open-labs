import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Exercicio } from "./Exercicio.js";

afterEach(() => { cleanup(); window.localStorage.clear(); });

const montado = {
  id: "e1",
  lab: "providers",
  cenario: "The checkout service already installs an SDK.",
  pergunta: "Where does the Tracer come from?",
  arquivo: "labs/providers/app/src/main/java/checkout/Checkout.java",
  versao: "1.65.0",
  antes: "OpenTelemetry otel = GlobalOpenTelemetry.get();",
  depois: 'Span span = tracer.spanBuilder("GET /checkout").startSpan();',
  certo: {
    id: "e1-certo",
    codigo: 'Tracer tracer = otel.getTracer("checkout.http");',
    porque: "A Tracer only ever comes from a provider.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#tracer-creation",
    certo: true as const,
  },
  blocos: [
    {
      id: "e1-errado",
      codigo: "Tracer tracer = new SdkTracer();",
      porque: "You just built a second provider.",
      fonte: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
    },
    {
      id: "e1-certo",
      codigo: 'Tracer tracer = otel.getTracer("checkout.http");',
      porque: "A Tracer only ever comes from a provider.",
      fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#tracer-creation",
      certo: true as const,
    },
  ],
};

describe("o exercício de instrumentação", () => {
  it("a explicação NÃO está no documento antes de responder", () => {
    render(<Exercicio exercicio={montado} />);
    expect(screen.queryByText(/only ever comes from a provider/u)).toBeNull();
  });

  it("escolher pelo TECLADO encaixa o bloco, sem arraste nenhum", () => {
    // Arrastar é a camada de cima. Se só ela funcionasse, metade dos leitores
    // ficaria de fora — e a peça de predição já nasceu botão puro.
    render(<Exercicio exercicio={montado} />);
    fireEvent.click(screen.getByRole("button", { name: /getTracer/u }));
    expect(screen.getByText(/only ever comes from a provider/u)).not.toBeNull();
  });

  it("o veredito é ATRIBUTO, e não só cor", () => {
    render(<Exercicio exercicio={montado} />);
    fireEvent.click(screen.getByRole("button", { name: /new SdkTracer/u }));
    expect(
      screen.getByRole("button", { name: /new SdkTracer/u }).getAttribute("data-veredito"),
    ).toBe("errado");
    expect(
      screen.getByRole("button", { name: /getTracer/u }).getAttribute("data-veredito"),
    ).toBe("certo");
  });

  it("depois de responder, os dois blocos mostram a explicação — inclusive o não escolhido", () => {
    render(<Exercicio exercicio={montado} />);
    fireEvent.click(screen.getByRole("button", { name: /new SdkTracer/u }));
    expect(screen.getByText(/second provider/u)).not.toBeNull();
    expect(screen.getByText(/only ever comes from a provider/u)).not.toBeNull();
  });

  it("a escolha não se refaz", () => {
    render(<Exercicio exercicio={montado} />);
    fireEvent.click(screen.getByRole("button", { name: /new SdkTracer/u }));
    for (const nome of [/new SdkTracer/u, /getTracer/u]) {
      expect((screen.getByRole("button", { name: nome }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
