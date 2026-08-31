import { useMemo, useState } from "react";
import { DROP, familyOf } from "@ovh/depth-core";
import type { TreeIndex, Wire, WorldState } from "@ovh/depth-core";
import { FAMILIAS, KINDS, toDot } from "@ovh/depth-ui";

/**
 * A ficha do objeto selecionado.
 *
 * O palco mostra o que **está acontecendo**; a ficha responde o que a coisa
 * **é**. Sem ela, o leitor que não sabe o que é um mux tem de sair da página
 * para descobrir — e sair da página é onde se perde o fio.
 *
 * Tudo aqui sai da árvore, dos fios e do estado. Não há uma segunda descrição
 * do modelo em lugar nenhum: se houvesse, ela divergiria, e a ficha passaria a
 * explicar um objeto que não é o que está desenhado ao lado.
 */

export interface FichaProps {
  readonly tree: TreeIndex;
  readonly wires: readonly Wire[];
  readonly state: WorldState;
  readonly id: string | undefined;
  /**
   * O que a peça **é**, no vocabulário do domínio — por id, não por `kind`.
   *
   * Sem isto a ficha só sabia responder no vocabulário do motor: quem clicava
   * no MAR lia a descrição de `buffer`, nunca a de "onde mora o endereço que
   * está no barramento agora". Opcional porque a maioria dos labs não tem
   * (ainda) um mapa assim — e um objeto sem entrada aqui continua mostrando
   * exatamente o que mostrava antes.
   */
  readonly descricoes?: Readonly<Record<string, string>> | undefined;
}

const numero = (v: unknown): string =>
  typeof v === "number" ? String(v) : JSON.stringify(v) ?? "";

export function Ficha({ tree, wires, state, id, descricoes }: FichaProps) {
  const [mostrarDot, setMostrarDot] = useState(false);
  const node = id === undefined ? undefined : tree.byId.get(id);

  const dot = useMemo(
    () => (id === undefined || node === undefined ? "" : toDot(tree, wires, id)),
    [tree, wires, id, node],
  );

  if (id === undefined || node === undefined) {
    return (
      <section className="ficha ficha--vazia">
        <h3>Details</h3>
        <p className="ficha__dica">
          Click a part to see what it is and what it is doing. Double-click to go inside it.
        </p>
      </section>
    );
  }

  const descricaoDoDominio = descricoes?.[id];
  const familia = familyOf(node.kind);
  const entram = wires.filter((w) => String(w.to) === id && w.to !== DROP);
  const saem = wires.filter((w) => w.from === id);
  const estado = state.nodes[id];
  const subpasso = state.substepOf[id];
  const filhos = node.children ?? [];

  return (
    <section className="ficha">
      <h3>Details</h3>

      <p className="ficha__nome mono">{node.label}</p>
      <p className="ficha__id mono">{id}</p>

      <dl className="ficha__campos">
        <dt>kind</dt>
        <dd className="mono">{node.kind}</dd>
        <dd className="ficha__prosa">
          {descricaoDoDominio ?? KINDS[node.kind].detalhe}
        </dd>
        {descricaoDoDominio === undefined ? null : (
          // O domínio responde "o que é" primeiro; o motor continua disponível
          // logo abaixo, porque "buffer" também é verdade sobre a peça — só
          // não é a pergunta que quem clicou fez.
          <dd className="ficha__prosa ficha__prosa--motor">{KINDS[node.kind].detalhe}</dd>
        )}

        <dt>family</dt>
        <dd className="mono">{familia}</dd>
        <dd className="ficha__prosa">{FAMILIAS[familia].detalhe}</dd>

        {node.replicas === undefined ? null : (
          <>
            <dt>replicas</dt>
            <dd className="mono">
              ×{node.replicas} — they exist, one is drawn
            </dd>
          </>
        )}

        <dt>wires</dt>
        <dd className="mono">
          {entram.length} in · {saem.length} out
        </dd>

        {subpasso === undefined ? null : (
          <>
            <dt>substep</dt>
            <dd className="mono">
              {subpasso} of {state.substeps} — how deep in this tick it ran
            </dd>
          </>
        )}

        {filhos.length === 0 ? null : (
          <>
            <dt>inside</dt>
            <dd className="mono">{filhos.length} part(s)</dd>
          </>
        )}
      </dl>

      {estado === undefined || Object.keys(estado as object).length === 0 ? null : (
        <>
          <h4>State now</h4>
          <ul className="ficha__estado mono">
            {Object.entries(estado as Record<string, unknown>)
              .filter(([, v]) => typeof v !== "object" || v === null)
              .map(([chave, valor]) => (
                <li key={chave}>
                  <span>{chave}</span>
                  <span>{numero(valor)}</span>
                </li>
              ))}
          </ul>
        </>
      )}

      {/*
        A topologia crua, sem enquadramento. O palco escolhe onde cada peça fica;
        isto não escolhe nada, e por isso serve para conferir um contra o outro.
      */}
      <button type="button" className="ficha__dot-botao" onClick={() => setMostrarDot((v) => !v)}>
        {mostrarDot ? "hide graph source" : "graph source (DOT)"}
      </button>
      {mostrarDot ? <pre className="ficha__dot mono">{dot}</pre> : null}
    </section>
  );
}
