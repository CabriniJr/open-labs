import {
  BUSCAS,
  buscarNoMapa,
  chaveDaRua,
  ErroDeBusca,
  FICHAS_DAS_BUSCAS,
  filmeDaBusca,
  fotoDaBusca,
  mapaDaCidade,
  placarDe,
  type Busca,
  type DetalheDaBusca,
  type Mapa,
  type Resultado,
} from "@ovh/algo-domain";
import { MotionPlayer, type MotionView } from "@ovh/motion/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";

const IsoStage = lazy(() => import("@ovh/stage3d").then((m) => ({ default: m.IsoStage })));

function Placar({ linhas, atual }: { linhas: DetalheDaBusca["placar"]; atual: Busca }) {
  return (
    <div className="algo-tabela">
      <table>
        <caption>Same map, four rules</caption>
        <thead>
          <tr>
            <th scope="col">Search</th>
            <th scope="col" className="num">
              Minutes
            </th>
            <th scope="col" className="num">
              Roads
            </th>
            <th scope="col" className="num">
              Places examined
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.busca} data-on={l.busca === atual ? "" : undefined} data-melhor={l.otimo ? "" : undefined}>
              <td>
                {l.nome}
                {l.otimo ? " ✓" : ""}
              </td>
              <td className="num">{Number.isFinite(l.custo) ? l.custo : "—"}</td>
              <td className="num">{l.ruas}</td>
              <td className="num">{l.expandidos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vitrine() {
  const [busca, setBusca] = useState<Busca>("dijkstra");
  const filme = useMemo(() => filmeDaBusca(busca), [busca]);
  const vistas: readonly MotionView<DetalheDaBusca>[] = [
    {
      id: "iso",
      label: "3D",
      render: ({ film: f, t, frame, label }) => (
        <Suspense fallback={<div className="iso-stage" aria-busy="true" />}>
          <IsoStage film={f} t={t} frame={frame} label={label} />
        </Suspense>
      ),
    },
  ];
  return (
    <div className="cpuvit algo" data-testid="path-showcase">
      <MotionPlayer
        film={filme}
        views={vistas}
        flatLabel="Map"
        label={`${FICHAS_DAS_BUSCAS[busca].nome} looking for the fastest way from Home to the Harbor on a city map of twelve places and twenty roads.`}
        controls={
          <div className="algo-seg" role="group" aria-label="Search">
            {BUSCAS.map((b) => (
              <button key={b} type="button" aria-pressed={busca === b} onClick={() => setBusca(b)}>
                {FICHAS_DAS_BUSCAS[b].nome}
              </button>
            ))}
          </div>
        }
        renderDetail={(frame) => {
          const d: DetalheDaBusca | undefined = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="algo-detalhe">
              <p className="mono">{d.evento}</p>
              <p className="algo-h">Frontier — best first ({FICHAS_DAS_BUSCAS[d.busca].prioridade})</p>
              {d.fronteira.length === 0 ? (
                <p className="algo-nota">empty</p>
              ) : (
                <ol className="algo-fila mono">
                  {d.fronteira.slice(0, 6).map((f) => (
                    <li key={f.lugar}>
                      <span>{f.lugar}</span>
                      <span>
                        {d.busca === "bfs" ? `${f.prioridade} roads` : d.busca === "dijkstra" ? `${f.g} min` : d.busca === "greedy" ? `h ${f.prioridade}` : `${f.g} + h = ${f.prioridade}`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="algo-nota">Settled: {d.resolvidos.join(", ") || "none yet"}</p>
              <Placar linhas={d.placar} atual={d.busca} />
            </div>
          );
        }}
      />
    </div>
  );
}

const JAM = 3;

function Simulacao() {
  const [busca, setBusca] = useState<Busca>("dijkstra");
  const [jams, setJams] = useState<Readonly<Record<string, number>>>({});
  const [origem, setOrigem] = useState("home");
  const [destino, setDestino] = useState("harbor");
  const [negativa, setNegativa] = useState(false);
  const [k, setK] = useState(0);
  const [tocando, setTocando] = useState(false);

  const mapa: Mapa = useMemo(() => {
    const m = mapaDaCidade(jams);
    if (!negativa) return m;
    // A "estrada mágica": a balsa passa a devolver tempo. É para ver quem recusa.
    const arestas = m.grafo.arestas.map((a) => (a.de === "pier" && a.para === "harbor" ? { ...a, peso: -10 } : a));
    return { ...m, grafo: { ...m.grafo, arestas }, ruas: m.ruas.map((r) => (r.de === "pier" && r.para === "harbor" ? { ...r, peso: -10 } : r)) };
  }, [jams, negativa]);

  const resultados = useMemo(() => {
    const saida = new Map<Busca, Resultado | string>();
    for (const b of BUSCAS) {
      try {
        saida.set(b, buscarNoMapa(b, mapa, origem, destino));
      } catch (e) {
        saida.set(b, e instanceof ErroDeBusca ? e.message : String(e));
      }
    }
    return saida;
  }, [mapa, origem, destino]);
  const atual = resultados.get(busca)!;
  const r = typeof atual === "string" ? null : atual;
  const total = r?.eventos.length ?? 0;

  useEffect(() => setK(0), [busca, mapa, origem, destino]);
  useEffect(() => {
    if (!tocando) return;
    if (k >= total) {
      setTocando(false);
      return;
    }
    const id = setTimeout(() => setK((x) => x + 1), 260);
    return () => clearTimeout(id);
  }, [tocando, k, total]);

  const foto = r === null ? null : fotoDaBusca(r, k);
  const naFronteira = new Set(foto?.fronteira.map((f) => f.no));
  const resolvidos = new Set(foto?.fechados);
  const ev = foto?.evento;
  const olhada = ev?.tipo === "relax" ? chaveDaRua(mapa.ruas.find((x) => (x.de === ev.de && x.para === ev.para) || (x.de === ev.para && x.para === ev.de))!) : null;
  const naRota = new Set<string>();
  if (foto?.terminou === true && r !== null) for (let i = 1; i < r.caminho.length; i += 1) naRota.add(chaveDaRua(mapa.ruas.find((x) => (x.de === r.caminho[i - 1] && x.para === r.caminho[i]) || (x.para === r.caminho[i - 1] && x.de === r.caminho[i]))!));
  const pos = new Map(mapa.grafo.nos.map((n) => [n.id, n]));
  const alternarJam = (chave: string) => setJams((j) => (j[chave] !== undefined ? Object.fromEntries(Object.entries(j).filter(([c]) => c !== chave)) : { ...j, [chave]: JAM * 2 }));

  const placar = useMemo(() => {
    try {
      return negativa ? null : placarDe({ ...mapa, origem, destino });
    } catch {
      return null;
    }
  }, [mapa, origem, destino, negativa]);

  return (
    <div className="algo" data-testid="path-sim">
      <div className="algo-controles">
        <div className="algo-seg" role="group" aria-label="Search">
          {BUSCAS.map((b) => (
            <button key={b} type="button" aria-pressed={busca === b} onClick={() => setBusca(b)}>
              {FICHAS_DAS_BUSCAS[b].nome}
            </button>
          ))}
        </div>
        <label>
          From
          <select aria-label="From" value={origem} onChange={(e) => setOrigem(e.target.value)}>
            {mapa.grafo.nos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          To
          <select aria-label="To" value={destino} onChange={(e) => setDestino(e.target.value)}>
            {mapa.grafo.nos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jam a road
          <select aria-label="Jam a road" value="" onChange={(e) => e.target.value !== "" && alternarJam(e.target.value)}>
            <option value="">choose…</option>
            {mapa.ruas.map((x) => (
              <option key={chaveDaRua(x)} value={chaveDaRua(x)}>
                {jams[chaveDaRua(x)] !== undefined ? "✕ clear " : ""}
                {pos.get(x.de)!.rotulo}–{pos.get(x.para)!.rotulo} ({x.peso}′)
              </option>
            ))}
          </select>
        </label>
        <label className="ctxlab-switch" htmlFor="caminho-neg">
          <input id="caminho-neg" type="checkbox" role="switch" checked={negativa} onChange={(e) => setNegativa(e.target.checked)} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Magic ferry: −10 minutes</span>
        </label>
      </div>

      <div className="algo-transporte">
        <button type="button" className="algo-btn" disabled={r === null} onClick={() => (k >= total ? (setK(0), setTocando(true)) : setTocando(!tocando))}>
          {tocando ? "Pause" : k >= total && total > 0 ? "Search again" : k === 0 ? "Search" : "Resume"}
        </button>
        <button type="button" className="algo-btn" disabled={r === null || tocando || k >= total} onClick={() => setK((x) => x + 1)}>
          One step
        </button>
        <button type="button" className="algo-btn" disabled={r === null} onClick={() => (setTocando(false), setK(total))}>
          Jump to the end
        </button>
        <input type="range" min={0} max={total} value={k} aria-label="Search progress, in events" onChange={(e) => (setTocando(false), setK(Number(e.target.value)))} disabled={r === null} />
        <output>
          event {k} of {total}
        </output>
      </div>
      <p className="algo-nota">Click a road on the map to jam it (it becomes six times slower) or to clear it. Every search reruns on the new map.</p>

      {typeof atual === "string" ? (
        <p className="algo-erro" role="alert">
          {atual}
        </p>
      ) : null}

      <div className="algo-lado">
        <svg className="algo-svg algo-mapa" viewBox="0 0 1020 620" role="img" aria-label={`City map. ${r === null ? "The search refused this map." : `${FICHAS_DAS_BUSCAS[busca].nome}: ${resolvidos.size} places settled, ${naFronteira.size} in the frontier.`}`}>
          {mapa.ruas.map((x) => {
            const a = pos.get(x.de)!;
            const b = pos.get(x.para)!;
            const chave = chaveDaRua(x);
            return (
              <g key={chave}>
                <line
                  className="algo-rua"
                  data-jam={x.transito >= JAM || jams[chave] !== undefined ? "" : undefined}
                  data-olhada={olhada === chave ? "" : undefined}
                  data-rota={naRota.has(chave) ? "" : undefined}
                  x1={a.x + 40}
                  y1={a.y + 20}
                  x2={b.x + 40}
                  y2={b.y + 20}
                />
                <line className="algo-rua-alvo" x1={a.x + 40} y1={a.y + 20} x2={b.x + 40} y2={b.y + 20} onClick={() => alternarJam(chave)}>
                  <title>
                    {a.rotulo}–{b.rotulo}: {x.nome}, {x.peso} min
                  </title>
                </line>
                <text className="algo-min" x={(a.x + b.x) / 2 + 40} y={(a.y + b.y) / 2 + 16}>
                  {x.peso}′
                </text>
              </g>
            );
          })}
          {mapa.grafo.nos.map((n) => {
            const estado = ev?.tipo === "expand" && ev.no === n.id ? "agora" : resolvidos.has(n.id) ? "resolvido" : naFronteira.has(n.id) ? "fronteira" : undefined;
            const g = foto?.custo.get(n.id);
            return (
              <g key={n.id} className="algo-lugar" data-estado={estado}>
                <circle cx={n.x + 40} cy={n.y + 20} r={n.id === origem || n.id === destino ? 17 : 13} />
                <text x={n.x + 40} y={n.y - 4}>
                  {n.id === origem ? "▶ " : n.id === destino ? "⚓ " : ""}
                  {n.rotulo}
                </text>
                {g !== undefined && (resolvidos.has(n.id) || naFronteira.has(n.id)) ? (
                  <text className="algo-min" x={n.x + 40} y={n.y + 50}>
                    {g} min
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="algo-detalhe">
          <p className="algo-h">{FICHAS_DAS_BUSCAS[busca].nome}</p>
          <dl className="algo-linhas mono">
            <div>
              <dt>picks by</dt>
              <dd>{FICHAS_DAS_BUSCAS[busca].prioridade}</dd>
            </div>
            <div>
              <dt>guarantees</dt>
              <dd>{FICHAS_DAS_BUSCAS[busca].otimo}</dd>
            </div>
            <div>
              <dt>cost class</dt>
              <dd>{FICHAS_DAS_BUSCAS[busca].classe}</dd>
            </div>
          </dl>
          <p className="algo-h">Frontier now</p>
          {foto === null || foto.fronteira.length === 0 ? (
            <p className="algo-nota">{foto?.terminou ? "done" : "empty"}</p>
          ) : (
            <ol className="algo-fila mono">
              {foto.fronteira.slice(0, 6).map((f) => (
                <li key={f.no}>
                  <span>{pos.get(f.no)!.rotulo}</span>
                  <span>{busca === "bfs" ? "queued" : `${Math.round(f.prioridade * 10) / 10}`}</span>
                </li>
              ))}
            </ol>
          )}
          {foto?.terminou === true && r !== null ? (
            <p className="algo-veredito" data-ok={placar?.find((p) => p.busca === busca)?.otimo ? "" : undefined}>
              {r.caminho.length === 0 ? "No route: the two places are not connected." : `${r.caminho.map((id) => pos.get(id)!.rotulo).join(" → ")} · ${r.custo} min · ${r.ruas} roads · ${r.expandidos} examined`}
            </p>
          ) : null}
        </div>
      </div>

      <div className="algo-tabela">
        <table>
          <caption>The competition on this map, {pos.get(origem)!.rotulo} → {pos.get(destino)!.rotulo}</caption>
          <thead>
            <tr>
              <th scope="col">Search</th>
              <th scope="col" className="num">
                Minutes
              </th>
              <th scope="col" className="num">
                Roads
              </th>
              <th scope="col" className="num">
                Places examined
              </th>
              <th scope="col" className="num">
                Roads looked at
              </th>
              <th scope="col">Fastest?</th>
            </tr>
          </thead>
          <tbody>
            {BUSCAS.map((b) => {
              const x = resultados.get(b)!;
              if (typeof x === "string")
                return (
                  <tr key={b}>
                    <td>{FICHAS_DAS_BUSCAS[b].nome}</td>
                    <td colSpan={5}>refuses: negative road</td>
                  </tr>
                );
              const melhor = Math.min(...BUSCAS.map((y) => resultados.get(y)).filter((y): y is Resultado => typeof y !== "string").map((y) => y.custo));
              return (
                <tr key={b} data-on={b === busca ? "" : undefined}>
                  <td>{FICHAS_DAS_BUSCAS[b].nome}</td>
                  <td className="num">{Number.isFinite(x.custo) ? x.custo : "—"}</td>
                  <td className="num">{x.ruas}</td>
                  <td className="num">{x.expandidos}</td>
                  <td className="num">{x.relaxamentos}</td>
                  <td>{negativa ? "—" : x.custo === melhor ? "yes" : `no (+${x.custo - melhor} min)`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CaminhoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
