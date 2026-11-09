import {
  adicionarAresta,
  adicionarNo,
  ALTURA_DO_GRAFO,
  comDirecao,
  componentes,
  ErroDeGrafo,
  EXEMPLOS,
  filmeDoGrafo,
  graus,
  LARGURA_DO_GRAFO,
  listaDeAdjacencia,
  matrizDeAdjacencia,
  oQueE,
  pesar,
  removerAresta,
  removerNo,
  type DetalheDoGrafo,
  type Grafo,
} from "@ovh/algo-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { ModosDoLab } from "./ModosDoLab";

function Matriz({ ids, celulas }: DetalheDoGrafo["matriz"]) {
  if (ids.length === 0) return <p className="algo-nota">No points, no matrix.</p>;
  return (
    <div className="algo-tabela">
      <table>
        <caption>Adjacency matrix: row → column</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">from</span>
            </th>
            {ids.map((id) => (
              <th key={id} scope="col" className="num">
                {id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((id, i) => (
            <tr key={id}>
              <th scope="row">{id}</th>
              {celulas[i]!.map((c, j) => (
                <td key={j} className="num">
                  {c === null ? "·" : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vitrine() {
  const filme = useMemo(() => filmeDoGrafo(), []);
  return (
    <div className="cpuvit algo" data-testid="graph-showcase">
      <MotionPlayer
        film={filme}
        label="What a graph is: two points, an edge, a weight, a direction, and a third point where the cheapest way is not the straight one."
        renderDetail={(frame) => {
          const d: DetalheDoGrafo | undefined = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="algo-detalhe">
              <p className="mono">{d.oQueE}</p>
              <p className="algo-h">Adjacency list{d.dirigido ? " (out-going)" : ""}</p>
              <dl className="algo-linhas mono">
                {d.lista.map(([id, vs]) => (
                  <div key={id}>
                    <dt>{id}</dt>
                    <dd>{vs}</dd>
                  </div>
                ))}
              </dl>
              <Matriz ids={d.matriz.ids} celulas={d.matriz.celulas} />
            </div>
          );
        }}
      />
    </div>
  );
}

type Ferramenta = "point" | "link" | "erase";

function Simulacao() {
  const [g, setG] = useState<Grafo>(EXEMPLOS["two-points"]!.grafo);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("point");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [peso, setPeso] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [de, setDe] = useState("");
  const [para, setPara] = useState("");
  const svg = useRef<SVGSVGElement>(null);

  const tentar = (f: () => Grafo) => {
    try {
      setG(f());
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroDeGrafo ? e.message : String(e));
    }
  };
  const lista = useMemo(() => listaDeAdjacencia(g), [g]);
  const matriz = useMemo(() => matrizDeAdjacencia(g), [g]);
  const gr = useMemo(() => graus(g), [g]);
  const pedacos = useMemo(() => componentes(g), [g]);
  const porId = useMemo(() => new Map(g.nos.map((n) => [n.id, n])), [g]);

  const noPonto = (e: PointerEvent<SVGSVGElement>) => {
    if (ferramenta !== "point" || e.target !== svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * LARGURA_DO_GRAFO;
    const y = ((e.clientY - r.top) / r.height) * ALTURA_DO_GRAFO;
    tentar(() => adicionarNo(g, Math.round(Math.max(30, Math.min(LARGURA_DO_GRAFO - 30, x))), Math.round(Math.max(30, Math.min(ALTURA_DO_GRAFO - 30, y)))));
  };
  const noNo = (id: string) => {
    if (ferramenta === "erase") {
      tentar(() => removerNo(g, id));
      if (selecionado === id) setSelecionado(null);
      return;
    }
    if (ferramenta === "link") {
      if (selecionado === null) setSelecionado(id);
      else if (selecionado === id) setSelecionado(null);
      else {
        const a = selecionado;
        tentar(() => adicionarAresta(g, a, id, g.ponderado ? peso : 1));
        setSelecionado(null);
      }
    }
  };
  const naAresta = (a: string, b: string) => {
    if (ferramenta === "erase") tentar(() => removerAresta(g, a, b));
    else if (g.ponderado) tentar(() => pesar(g, a, b, peso));
  };

  const R = 22;
  const ponta = (x1: number, y1: number, x2: number, y2: number) => {
    const d = Math.hypot(x2 - x1, y2 - y1) || 1;
    return { x: x2 - ((x2 - x1) / d) * (R + 4), y: y2 - ((y2 - y1) / d) * (R + 4), ux: (x2 - x1) / d, uy: (y2 - y1) / d };
  };
  const ajuda: Record<Ferramenta, string> = {
    point: "Click an empty spot to add a point.",
    link: selecionado === null ? "Click a point, then another, to link them." : `Linking from ${selecionado} — click another point (or ${selecionado} again to cancel).`,
    erase: "Click a point or an edge to remove it.",
  };

  return (
    <div className="algo" data-testid="graph-editor">
      <div className="algo-controles">
        <div className="algo-seg" role="group" aria-label="Start from">
          {Object.entries(EXEMPLOS).map(([id, ex]) => (
            <button
              key={id}
              type="button"
              aria-pressed={false}
              onClick={() => {
                setG(ex.grafo);
                setSelecionado(null);
                setErro(null);
              }}
            >
              {ex.titulo}
            </button>
          ))}
          <button type="button" aria-pressed={false} onClick={() => (setG({ nos: [], arestas: [], dirigido: g.dirigido, ponderado: g.ponderado }), setSelecionado(null))}>
            Empty
          </button>
        </div>
        <div className="algo-seg" role="group" aria-label="Tool">
          {(["point", "link", "erase"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={ferramenta === t} onClick={() => (setFerramenta(t), setSelecionado(null))}>
              {t === "point" ? "Add points" : t === "link" ? "Link points" : "Erase"}
            </button>
          ))}
        </div>
        <label className="ctxlab-switch" htmlFor="grafo-dir">
          <input id="grafo-dir" type="checkbox" role="switch" checked={g.dirigido} onChange={(e) => setG(comDirecao(g, e.target.checked))} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Directed (arrows)</span>
        </label>
        <label className="ctxlab-switch" htmlFor="grafo-peso">
          <input id="grafo-peso" type="checkbox" role="switch" checked={g.ponderado} onChange={(e) => setG({ ...g, ponderado: e.target.checked })} />
          <span className="ctxlab-switch__track" aria-hidden="true">
            <span />
          </span>
          <span>Weighted</span>
        </label>
        {g.ponderado ? (
          <label>
            Weight for new edges (click an edge to apply)
            <input type="number" min={1} max={99} value={peso} onChange={(e) => setPeso(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
          </label>
        ) : null}
      </div>
      <p className="algo-nota" aria-live="polite">
        {ajuda[ferramenta]}
      </p>
      {erro !== null ? (
        <p className="algo-erro" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="algo-lado">
        <svg
          ref={svg}
          className="algo-svg algo-grafo"
          viewBox={`0 0 ${LARGURA_DO_GRAFO} ${ALTURA_DO_GRAFO}`}
          role="img"
          aria-label={`A graph with ${g.nos.length} points and ${g.arestas.length} edges: ${oQueE(g)}`}
          onPointerDown={noPonto}
          data-ferramenta={ferramenta}
        >
          {g.arestas.map((a) => {
            const p = porId.get(a.de)!;
            const q = porId.get(a.para)!;
            const f = ponta(p.x, p.y, q.x, q.y);
            const mx = (p.x + q.x) / 2;
            const my = (p.y + q.y) / 2;
            return (
              <g key={`${a.de}-${a.para}`}>
                <line className="algo-aresta" x1={p.x} y1={p.y} x2={g.dirigido ? f.x : q.x} y2={g.dirigido ? f.y : q.y} />
                {g.dirigido ? <polygon className="algo-seta" points={`${f.x},${f.y} ${f.x - f.ux * 12 - f.uy * 6},${f.y - f.uy * 12 + f.ux * 6} ${f.x - f.ux * 12 + f.uy * 6},${f.y - f.uy * 12 - f.ux * 6}`} /> : null}
                <line className="algo-aresta-alvo" x1={p.x} y1={p.y} x2={q.x} y2={q.y} onClick={() => naAresta(a.de, a.para)}>
                  <title>
                    {a.de}
                    {g.dirigido ? " → " : " – "}
                    {a.para}
                  </title>
                </line>
                {g.ponderado ? (
                  <text className="algo-peso" x={mx} y={my - 10}>
                    {a.peso}
                  </text>
                ) : null}
              </g>
            );
          })}
          {g.nos.map((n) => (
            <g key={n.id} className="algo-no" data-tone="processor" data-sel={selecionado === n.id ? "" : undefined} onClick={() => noNo(n.id)}>
              <circle cx={n.x} cy={n.y} r={R} />
              <text x={n.x} y={n.y}>
                {n.rotulo}
              </text>
            </g>
          ))}
        </svg>

        <div className="algo-detalhe">
          <p className="mono">{oQueE(g)}</p>
          <dl className="algo-linhas mono">
            <div>
              <dt>points (V)</dt>
              <dd>{g.nos.length}</dd>
            </div>
            <div>
              <dt>edges (E)</dt>
              <dd>{g.arestas.length}</dd>
            </div>
            <div>
              <dt>separate pieces</dt>
              <dd>{pedacos.length}</dd>
            </div>
          </dl>
          <p className="algo-h">Adjacency list{g.dirigido ? " (out-going)" : ""}</p>
          <dl className="algo-linhas mono">
            {[...lista].map(([id, vs]) => (
              <div key={id}>
                <dt>
                  {id} <small>{g.dirigido ? `in ${gr.get(id)!.entra} · out ${gr.get(id)!.sai}` : `degree ${gr.get(id)!.sai}`}</small>
                </dt>
                <dd>{vs.length === 0 ? "—" : vs.map((v) => (g.ponderado ? `${v.para} (${v.peso})` : v.para)).join(", ")}</dd>
              </div>
            ))}
          </dl>
          <Matriz ids={matriz.ids} celulas={matriz.celulas} />
          <p className="algo-nota">
            A list stores only the edges that exist (memory grows with V + E). A matrix stores every pair (V² cells) but answers “are A and B linked?” in one read. Maps and social networks have few edges per point, so programs usually keep the list.
          </p>
        </div>
      </div>

      <form
        className="algo-controles"
        aria-label="Link two points without a pointer"
        onSubmit={(e) => {
          e.preventDefault();
          tentar(() => adicionarAresta(g, de, para, g.ponderado ? peso : 1));
        }}
      >
        <label>
          From
          <select aria-label="From" value={de} onChange={(e) => setDe(e.target.value)}>
            <option value="">—</option>
            {g.nos.map((n) => (
              <option key={n.id}>{n.id}</option>
            ))}
          </select>
        </label>
        <label>
          To
          <select aria-label="To" value={para} onChange={(e) => setPara(e.target.value)}>
            <option value="">—</option>
            {g.nos.map((n) => (
              <option key={n.id}>{n.id}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="algo-btn">
          Link them
        </button>
        <button type="button" className="algo-btn" onClick={() => tentar(() => adicionarNo(g, 60 + ((g.nos.length * 97) % (LARGURA_DO_GRAFO - 120)), 60 + ((g.nos.length * 151) % (ALTURA_DO_GRAFO - 120))))}>
          Add a point
        </button>
      </form>
    </div>
  );
}

export function GrafoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
