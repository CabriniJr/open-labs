import { useState } from "react";

/**
 * Predição antes da revelação.
 *
 * Perguntar o que a pessoa **acha** que vai acontecer, antes de ela rodar, é o
 * achado mais replicado da pesquisa em simulação didática: quem prediz e erra
 * aprende; quem só assiste reconhece e esquece. O `DECISIONS.md` §8.1 registra
 * isso, e este é o primeiro lab do repo a ter.
 *
 * A peça nasce **neutra de domínio** e mora em `apps/site`, e não em
 * `depth-ui`: não é primitiva de modelo, é pedagogia de página, e os dois
 * handbooks a alcançam daqui. A fronteira do CI não se pronuncia sobre isso, e
 * por isso a decisão está escrita.
 *
 * Predição feita não se refaz. Deixar trocar depois de ver a resposta apagaria
 * o compromisso — e o compromisso é o mecanismo inteiro.
 */

export interface PredicaoProps {
  readonly pergunta: string;
  readonly opcoes: readonly string[];
  /** O índice da opção correta. */
  readonly correta: number;
  readonly revelacao: string;
  readonly onResponder?: (escolhida: number) => void;
}

export function Predicao({ pergunta, opcoes, correta, revelacao, onResponder }: PredicaoProps) {
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const respondeu = escolhida !== null;

  const responder = (i: number): void => {
    if (respondeu) return;
    setEscolhida(i);
    onResponder?.(i);
  };

  return (
    <div className="predicao" data-respondeu={respondeu ? "true" : undefined}>
      <p className="predicao__pergunta">{pergunta}</p>
      <ul className="predicao__opcoes">
        {opcoes.map((opcao, i) => {
          const escolha = escolhida === i;
          const acerto = i === correta;
          return (
            <li key={opcao}>
              <button
                type="button"
                onClick={() => responder(i)}
                disabled={respondeu}
                aria-pressed={escolha}
                data-veredito={respondeu ? (acerto ? "certo" : escolha ? "errado" : "outro") : undefined}
              >
                {opcao}
              </button>
            </li>
          );
        })}
      </ul>
      {/*
        A revelação só existe no DOM depois da resposta. Escondê-la com CSS
        deixaria o texto legível para quem abrisse o inspetor — e, pior, para
        quem usa leitor de tela, que é o leitor a quem a predição mais serve.
      */}
      {respondeu ? (
        <p className="predicao__revelacao" role="status">
          {revelacao}
        </p>
      ) : (
        <p className="predicao__aviso">Commit to an answer first. You cannot change it afterwards.</p>
      )}
    </div>
  );
}
