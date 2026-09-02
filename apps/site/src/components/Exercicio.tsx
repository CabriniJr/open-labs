import { useEffect, useState } from "react";
import type { ExercicioMontado } from "../lib/exercicios.js";
import { registrar } from "../lib/placar.js";

/**
 * Um exercício de instrumentação: o código com uma lacuna, e três blocos.
 *
 * **Botão primeiro, arraste depois.** Cada bloco é um `<button>`: clicar escolhe.
 * O arraste é uma camada por cima disso e some sem prejuízo — se ele fosse o
 * único caminho, metade dos leitores ficaria de fora.
 *
 * A escolha não se refaz, pela mesma razão da peça de predição: o compromisso é o
 * mecanismo. E a explicação só entra no DOM depois da resposta — escondê-la com
 * CSS a deixaria legível no inspetor e, pior, para quem usa leitor de tela.
 */
export interface ExercicioProps {
  readonly exercicio: ExercicioMontado;
}

export function Exercicio({ exercicio }: ExercicioProps) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const respondeu = escolhido !== null;

  /**
   * O marcador de que a peça está **viva**.
   *
   * O HTML do servidor e o da ilha hidratada são idênticos, então nada na tela
   * distingue um botão que já responde de um que ainda não. Sem este sinal, quem
   * testa (e quem automatiza) manda a tecla no vão entre os dois e não acontece
   * nada — que foi exatamente o que o e2e pegou.
   */
  const [vivo, setVivo] = useState(false);
  useEffect(() => setVivo(true), []);

  const escolher = (id: string): void => {
    if (respondeu) return;
    setEscolhido(id);
    registrar(exercicio.id, id === exercicio.certo.id);
  };

  const veredito = (bloco: { readonly id: string; readonly certo?: true }): string | undefined => {
    if (!respondeu) return undefined;
    if (bloco.certo === true) return "certo";
    return bloco.id === escolhido ? "errado" : "outro";
  };

  const preenchida = respondeu
    ? exercicio.blocos.find((b) => b.id === escolhido)?.codigo
    : undefined;

  return (
    <div
      className="exercicio"
      data-respondeu={respondeu ? "true" : undefined}
      data-vivo={vivo ? "true" : undefined}
    >
      <p className="exercicio__cenario">{exercicio.cenario}</p>
      <p className="exercicio__pergunta">{exercicio.pergunta}</p>

      <pre className="exercicio__codigo mono">
        <code>
          {exercicio.antes}
          {"\n"}
          <span className="exercicio__lacuna" data-cheia={respondeu ? "true" : undefined}>
            {preenchida ?? " "}
          </span>
          {"\n"}
          {exercicio.depois}
        </code>
      </pre>

      <ul className="exercicio__blocos">
        {exercicio.blocos.map((bloco) => (
          <li key={bloco.id}>
            <button
              type="button"
              className="exercicio__bloco mono"
              onClick={() => escolher(bloco.id)}
              disabled={respondeu}
              aria-pressed={bloco.id === escolhido}
              data-veredito={veredito(bloco)}
              draggable={!respondeu}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", bloco.id)}
            >
              {bloco.codigo}
            </button>
            {respondeu ? (
              <p className="exercicio__porque">
                {bloco.porque}{" "}
                <a href={bloco.fonte} rel="noopener">
                  spec&nbsp;→
                </a>
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {respondeu ? null : (
        <p className="exercicio__aviso">
          Pick one. You cannot change it afterwards — and that is the point.
        </p>
      )}

      {/*
        De onde este código veio, e em que versão. Sem isto o leitor não tem como
        saber que a assinatura que ele acabou de escolher é de uma versão fixada —
        e a spec do handbook exige que toda afirmação técnica seja rastreável.
      */}
      <p className="exercicio__origem mono">
        {exercicio.arquivo} · OpenTelemetry Java {exercicio.versao}
      </p>
    </div>
  );
}
