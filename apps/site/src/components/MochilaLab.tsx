import {
  CATALOGO,
  CENARIOS_DA_MOCHILA,
  chamadasComMemoria,
  chamadasSemMemoria,
  ErroDeMochila,
  filmeDaMochila,
  gulosa,
  MAIOR_SESSAO,
  mochila,
  PASSO,
  porQue,
  type DetalheDaMochila,
  type ItemDaMochila,
} from "@ovh/algo-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";

const fmt = (n: number) => n.toLocaleString("en-US");

function Plano({ labs, tom, rotulo }: { labs: readonly string[]; tom: string; rotulo: string }) {
  if (labs.length === 0) return <p className="algo-nota">nothing fits</p>;
  return (
    <ul className="algo-vetor" data-tone={tom} aria-label={rotulo}>
      {labs.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

function Vitrine() {
  const [cenario, setCenario] = useState("rafa");
  const filme = useMemo(() => filmeDaMochila(cenario), [cenario]);
  return (
    <div className="cpuvit algo" data-testid="knapsack-showcase">
      <MotionPlayer
        film={filme}
        label="Which labs fit in a session at the telecentre: greedy picks by points per minute; the table T[i][t] fills row by row and the walk back finds the best plan."
        controls={
          <div className="algo-seg" role="group" aria-label="Session">
            {CENARIOS_DA_MOCHILA.map((c) => (
              <button key={c.id} type="button" aria-pressed={cenario === c.id} onClick={() => setCenario(c.id)}>
                {c.nome}
              </button>
            ))}
          </div>
        }
        renderDetail={(frame) => {
          const d: DetalheDaMochila | undefined = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="algo-detalhe">
              <p className="algo-h">
                {d.cenario} · {d.sessao} min
              </p>
              <p className="algo-h">Greedy {d.gulosa !== null ? `· ${d.gulosa.pontos} pts` : ""}</p>
              {d.gulosa === null ? <p className="algo-nota">not yet</p> : <Plano labs={d.gulosa.labs} tom="processor" rotulo="Greedy plan" />}
              <p className="algo-h">Table</p>
              <p className="mono algo-nota">{d.linhas === 0 ? "not started" : `${d.linhas} of ${d.totalDeLinhas} rows`}</p>
              <p className="algo-h">Best plan {d.otimo !== null ? `· ${d.otimo.pontos} pts` : ""}</p>
              {d.otimo === null ? <p className="algo-nota">not yet</p> : <Plano labs={d.otimo.labs} tom="conduit" rotulo="Best plan" />}
              {d.contagem !== null ? (
                <dl className="algo-linhas">
                  <div>
                    <dt>table cells</dt>
                    <dd className="mono">{fmt(d.contagem.celulas)}</dd>
                  </div>
                  <div>
                    <dt>calls without memory</dt>
                    <dd className="mono">{fmt(d.contagem.semMemoria)}</dd>
                  </div>
                  <div>
                    <dt>every subset</dt>
                    <dd className="mono">{fmt(d.contagem.subconjuntos)}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  );
}

function Simulacao() {
  const inicial = CENARIOS_DA_MOCHILA[0]!;
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set(inicial.itens));
  const [sessao, setSessao] = useState(inicial.sessao);
  const itens: ItemDaMochila[] = useMemo(() => CATALOGO.filter((c) => marcados.has(c.id)), [marcados]);
  const chave = `${itens.map((i) => i.id).join(",")}|${sessao}`;
  const r = useMemo(() => {
    try {
      const m = mochila(itens, sessao);
      return { m, g: gulosa(itens, sessao), sem: chamadasSemMemoria(itens, sessao), com: chamadasComMemoria(itens, sessao) };
    } catch (e) {
      return { erro: e instanceof ErroDeMochila ? e.message : String(e) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  const colunas = sessao / PASSO + 1;
  const [alvo, setAlvo] = useState<readonly [number, number] | null>(null);
  // A célula explicada: a escolhida, ou a do canto (a resposta).
  const celula: readonly [number, number] = alvo !== null && alvo[0] <= itens.length && alvo[1] < colunas ? alvo : [itens.length, colunas - 1];

  if ("erro" in r) {
    return (
      <p className="algo-erro" role="alert">
        {r.erro}
      </p>
    );
  }
  const { m, g, sem, com } = r;
  const usadas = new Set(m.caminho.map(([i, c]) => `${i}:${c}`));
  const [ai, ac] = celula;
  const pq = porQue(itens, m.T, ai, ac);
  const itemDaLinha = ai > 0 ? itens[ai - 1]! : null;
  const fontes = new Set<string>();
  if (itemDaLinha !== null) {
    fontes.add(`${ai - 1}:${ac}`);
    if (pq.leva !== null) fontes.add(`${ai - 1}:${ac - itemDaLinha.minutos / PASSO}`);
  }
  const veredito =
    m.pontos > g.pontos
      ? { ok: false, texto: `Greedy: ${g.pontos} points. The table: ${m.pontos}. Picking by points per minute left ${m.pontos - g.pontos} on the table.` }
      : { ok: true, texto: `Both plans reach ${m.pontos} points. Here greedy happens to be right.` };

  return (
    <div className="algo" data-testid="knapsack-sim">
      <div className="algo-controles">
        <div className="algo-seg" role="group" aria-label="Session">
          {CENARIOS_DA_MOCHILA.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={sessao === c.sessao && c.itens.length === marcados.size && c.itens.every((i) => marcados.has(i))}
              onClick={() => {
                setMarcados(new Set(c.itens));
                setSessao(c.sessao);
                setAlvo(null);
              }}
            >
              {c.nome}
            </button>
          ))}
        </div>
        <label>
          Session: {sessao} min
          <input type="range" min={0} max={MAIOR_SESSAO} step={PASSO} value={sessao} onChange={(e) => setSessao(Number(e.target.value))} aria-label="Session length in minutes" />
        </label>
        <fieldset>
          <legend>Labs unlocked ({itens.length})</legend>
          {CATALOGO.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={marcados.has(c.id)}
                onChange={(e) => {
                  const s = new Set(marcados);
                  if (e.target.checked) s.add(c.id);
                  else s.delete(c.id);
                  setMarcados(s);
                }}
              />
              {c.nome} <span className="mono algo-nota">{c.minutos}′ · {c.pontos}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <p className="algo-veredito" data-ok={veredito.ok ? "" : undefined} aria-live="polite">
        {veredito.texto}
      </p>

      <div className="algo-dois">
        <section className="algo-cartao" aria-label="Greedy">
          <h3>Greedy — most points per minute first</h3>
          <Plano labs={g.escolhidos.map((k) => itens[k]!.nome)} tom="processor" rotulo="Greedy plan" />
          <p className="algo-nota mono">
            {g.pontos} pts · {g.minutos} of {sessao} min · {itens.length} decisions
          </p>
        </section>
        <section className="algo-cartao" aria-label="Dynamic programming">
          <h3>The table — every smaller session first</h3>
          <Plano labs={m.escolhidos.map((k) => itens[k]!.nome)} tom="conduit" rotulo="Best plan" />
          <p className="algo-nota mono">
            {m.pontos} pts · {m.minutos} of {sessao} min · {fmt(m.celulas)} cells
          </p>
        </section>
      </div>

      <section className="algo-cartao" aria-label="The table">
        <h3>T[i][t] — most points with the first i labs and t minutes</h3>
        <p className="algo-nota">
          Click a cell to see where its number comes from. The highlighted path is the walk back from the bottom-right cell: where a cell differs from the one above, that row&apos;s lab went in.
        </p>
        <div className="algo-tabela algo-pd">
          <table>
            <thead>
              <tr>
                <th scope="col">lab \ minutes</th>
                {Array.from({ length: colunas }, (_, c) => (
                  <th key={c} scope="col" className="num">
                    {c * PASSO}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.T.map((linha, i) => (
                <tr key={i}>
                  <th scope="row">{i === 0 ? "(none)" : itens[i - 1]!.nome}</th>
                  {linha.map((v, c) => (
                    <td
                      key={c}
                      className="num"
                      data-usado={usadas.has(`${i}:${c}`) ? "" : undefined}
                      data-alvo={ai === i && ac === c ? "" : undefined}
                      data-fonte={fontes.has(`${i}:${c}`) ? "" : undefined}
                      onClick={() => setAlvo([i, c])}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="algo-controles">
          <label>
            Explain the cell in row
            <select value={ai} onChange={(e) => setAlvo([Number(e.target.value), ac])}>
              {m.T.map((_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? "0 (none)" : `${i} — ${itens[i - 1]!.nome}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            at minute
            <select value={ac} onChange={(e) => setAlvo([ai, Number(e.target.value)])}>
              {Array.from({ length: colunas }, (_, c) => (
                <option key={c} value={c}>
                  {c * PASSO}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="algo-nota mono" aria-live="polite" data-testid="knapsack-why">
          {itemDaLinha === null
            ? `T[0][${ac * PASSO}] = 0: with no lab, no points.`
            : pq.leva === null
              ? `T[${ai}][${ac * PASSO}] = ${pq.valor}: ${itemDaLinha.nome} takes ${itemDaLinha.minutos} min and does not fit in ${ac * PASSO}, so it copies the cell above (${pq.deixa}).`
              : `T[${ai}][${ac * PASSO}] = max(skip ${itemDaLinha.nome} = ${pq.deixa}, take it = ${itemDaLinha.pontos} + T[${ai - 1}][${ac * PASSO - itemDaLinha.minutos}] = ${pq.leva}) = ${pq.valor}`}
        </p>
      </section>

      <section className="algo-cartao" aria-label="What it cost">
        <h3>Why remembering wins</h3>
        <div className="algo-tabela">
          <table>
            <thead>
              <tr>
                <th scope="col">way</th>
                <th scope="col" className="num">
                  work
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>try every subset</td>
                <td className="num mono">{fmt(2 ** itens.length)} subsets</td>
              </tr>
              <tr>
                <td>the recurrence, no memory</td>
                <td className="num mono">{fmt(sem)} calls</td>
              </tr>
              <tr>
                <td>the recurrence, with memory</td>
                <td className="num mono">{fmt(com)} calls</td>
              </tr>
              <tr data-melhor="">
                <td>the table, bottom-up</td>
                <td className="num mono">{fmt(m.celulas)} cells</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="algo-nota">Counted by running each one, not estimated. Add a lab: every subset doubles, the table gains one row.</p>
      </section>
    </div>
  );
}

export function MochilaModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
