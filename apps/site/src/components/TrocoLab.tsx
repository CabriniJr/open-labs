import { ErroDeTroco, filmeDoTroco, guloso, lerMoedas, MAIOR_VALOR, menorContraexemplo, otimo, SISTEMAS, VALOR_DO_SISTEMA, type DetalheDoTroco } from "@ovh/algo-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";

function Moedas({ moedas, tom, rotulo }: { moedas: readonly number[]; tom: string; rotulo: string }) {
  return (
    <ul className="algo-moedas" data-tone={tom} aria-label={rotulo}>
      {moedas.map((m, k) => (
        <li key={k}>{m}</li>
      ))}
    </ul>
  );
}

function Vitrine() {
  const [sistema, setSistema] = useState("toy");
  const filme = useMemo(() => filmeDoTroco(sistema), [sistema]);
  return (
    <div className="cpuvit algo" data-testid="change-showcase">
      <MotionPlayer
        film={filme}
        label="Making change with the fewest coins: greedy takes the biggest coin that fits; the table solves every smaller amount first and remembers."
        controls={
          <div className="algo-seg" role="group" aria-label="Coin system">
            {SISTEMAS.map((s) => (
              <button key={s.id} type="button" aria-pressed={sistema === s.id} onClick={() => setSistema(s.id)}>
                {s.nome} · {VALOR_DO_SISTEMA[s.id]}
              </button>
            ))}
          </div>
        }
        renderDetail={(frame) => {
          const d: DetalheDoTroco | undefined = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="algo-detalhe">
              <p className="algo-h">
                {d.sistema} · change for {d.valor}
              </p>
              <p className="algo-h">Greedy so far {d.restante > 0 ? `(${d.restante} left)` : ""}</p>
              {d.gulosas.length === 0 ? <p className="algo-nota">nothing yet</p> : <Moedas moedas={d.gulosas} tom="processor" rotulo="Greedy coins" />}
              <p className="algo-h">Table filled</p>
              <p className="mono algo-nota">{d.tabela.length === 0 ? "not started" : `${d.tabela.length} of ${d.valor + 1} amounts`}</p>
              <p className="algo-h">Optimal</p>
              {d.otimas === null || d.otimas.length === 0 ? <p className="algo-nota">{d.otimas === null ? "impossible" : "not yet"}</p> : <Moedas moedas={d.otimas} tom="conduit" rotulo="Optimal coins" />}
              {d.veredito !== "" ? <p className="algo-nota">{d.veredito}</p> : null}
            </div>
          );
        }}
      />
    </div>
  );
}

function Simulacao() {
  const [texto, setTexto] = useState("1 3 4");
  const [valor, setValor] = useState(6);
  const leitura = useMemo((): { moedas: number[] } | { erro: string } => {
    try {
      return { moedas: lerMoedas(texto) };
    } catch (e) {
      return { erro: e instanceof ErroDeTroco ? e.message : String(e) };
    }
  }, [texto]);
  const moedas = "moedas" in leitura ? leitura.moedas : [1];
  const g = useMemo(() => guloso(moedas, valor), [moedas.join(","), valor]);
  const o = useMemo(() => otimo(moedas, valor), [moedas.join(","), valor]);
  const contra = useMemo(() => menorContraexemplo(moedas), [moedas.join(",")]);
  // As células que a reconstrução visita: do valor para trás, moeda a moeda.
  const usadas = useMemo(() => {
    const s = new Set<number>();
    if (o.moedas === null) return s;
    for (let v = valor; v > 0; v -= o.tabela.ultima[v]!) s.add(v);
    s.add(0);
    return s;
  }, [o, valor]);
  const veredito =
    o.moedas === null
      ? { ok: false, texto: `${valor} cannot be paid with these coins.` }
      : g.moedas === null
        ? { ok: false, texto: `Greedy gets stuck with ${g.sobra} left. The table pays it with ${o.moedas.length} coins.` }
        : g.moedas.length > o.moedas.length
          ? { ok: false, texto: `Greedy: ${g.moedas.length} coins. Optimal: ${o.moedas.length}. Greedy was wrong here.` }
          : { ok: true, texto: `Both use ${o.moedas.length} coins. Greedy is right for this amount.` };

  return (
    <div className="algo" data-testid="change-sim">
      <div className="algo-controles">
        <div className="algo-seg" role="group" aria-label="Coin system">
          {SISTEMAS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={texto === s.moedas.join(" ")}
              onClick={() => {
                setTexto(s.moedas.join(" "));
                setValor(VALOR_DO_SISTEMA[s.id] ?? 10);
              }}
            >
              {s.nome}
            </button>
          ))}
        </div>
        <label>
          Coins (your own system)
          <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false} />
        </label>
        <label>
          Amount: {valor}
          <input type="range" min={1} max={200} value={Math.min(valor, 200)} onChange={(e) => setValor(Number(e.target.value))} aria-label="Amount to pay" />
        </label>
        <label>
          Or type it
          <input type="number" min={1} max={MAIOR_VALOR} value={valor} onChange={(e) => setValor(Math.max(1, Math.min(MAIOR_VALOR, Math.round(Number(e.target.value) || 1))))} />
        </label>
      </div>
      {"erro" in leitura ? (
        <p className="algo-erro" role="alert">
          {leitura.erro}
        </p>
      ) : null}

      <p className="algo-veredito" data-ok={veredito.ok ? "" : undefined} aria-live="polite">
        {veredito.texto}
      </p>

      <div className="algo-dois">
        <section className="algo-cartao" aria-label="Greedy">
          <h3>Greedy — biggest coin that fits</h3>
          {g.moedas === null && g.historia.length === 0 ? <p className="algo-nota">no coin fits at all</p> : <Moedas moedas={g.historia.map((p) => p.moeda)} tom="processor" rotulo="Greedy coins" />}
          <p className="algo-nota mono">
            {g.historia.length} coins{g.moedas === null ? `, ${g.sobra} left over` : ""} · {g.passos} decisions (one per coin value)
          </p>
        </section>
        <section className="algo-cartao" aria-label="Dynamic programming">
          <h3>The table — every smaller amount first</h3>
          {o.moedas === null ? <p className="algo-nota">impossible</p> : <Moedas moedas={o.moedas} tom="conduit" rotulo="Optimal coins" />}
          <p className="algo-nota mono">
            {o.moedas?.length ?? "—"} coins · {o.passos} steps (amounts × coin values)
          </p>
        </section>
      </div>

      <section className="algo-cartao" aria-label="The table">
        <h3>The table that remembers: fewest coins for 0 … {valor}</h3>
        <p className="algo-nota">Each cell is the answer for that amount, built from cells to its left. The highlighted ones are the walk back from {valor} that gives the optimal coins.</p>
        <ol className="algo-faixa">
          {o.tabela.minimo.map((m, v) => (
            <li key={v} data-usado={usadas.has(v) ? "" : undefined} data-alvo={v === valor ? "" : undefined} data-impossivel={Number.isFinite(m) ? undefined : ""}>
              <small>{v}</small>
              {Number.isFinite(m) ? m : "✕"}
            </li>
          ))}
        </ol>
      </section>

      <p className="algo-veredito" data-ok={contra === null ? "" : undefined}>
        {contra === null
          ? `For {${moedas.join(", ")}}, greedy is optimal for every amount up to ${MAIOR_VALOR}: this system is canonical (at least that far).`
          : `The smallest amount where greedy loses with {${moedas.join(", ")}} is ${contra}.`}{" "}
        {contra !== null ? (
          <button type="button" className="algo-btn" onClick={() => setValor(contra)}>
            Show {contra}
          </button>
        ) : null}
      </p>
    </div>
  );
}

export function TrocoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
