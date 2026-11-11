import {
  CARGAS,
  CODIGO_DA_FILA,
  emOrdem,
  ESTRUTURAS_DA_FILA,
  filmeDaFila,
  POLITICAS,
  rodarFila,
  type Carga,
  type DetalheDaFila,
  type FotoDaFila,
  type Politica,
  type RodadaDaFila,
} from "@ovh/algo-domain";
import { MotionPlayer } from "@ovh/motion/react";
import { useMemo, useState } from "react";
import { ModosDoLab } from "./ModosDoLab";

const nome = (id: number) => `#${id + 1}`;

function Pedidos({ ids, tom, rotulo, vazio }: { ids: readonly number[]; tom: string; rotulo: string; vazio: string }) {
  if (ids.length === 0) return <p className="algo-nota">{vazio}</p>;
  return (
    <ul className="algo-vetor" data-tone={tom} aria-label={rotulo}>
      {ids.map((id) => (
        <li key={id}>{nome(id)}</li>
      ))}
    </ul>
  );
}

function Vitrine() {
  const [politica, setPolitica] = useState<Politica>("recusar");
  const filme = useMemo(() => filmeDaFila(politica), [politica]);
  return (
    <div className="cpuvit algo" data-testid="fifo-showcase">
      <MotionPlayer
        film={filme}
        label="The same requests arrive at two queues of 8 slots: a ring buffer that only moves its head, and an array that shifts every waiting request when the head leaves. When the queue is full, the policy decides who is lost."
        controls={
          <div className="algo-seg" role="group" aria-label="When the queue is full">
            {POLITICAS.map((p) => (
              <button key={p.id} type="button" aria-pressed={politica === p.id} onClick={() => setPolitica(p.id)}>
                {p.nome}
              </button>
            ))}
          </div>
        }
        renderDetail={(frame) => {
          const d: DetalheDaFila | undefined = frame.detail;
          if (d === undefined) return null;
          return (
            <div className="algo-detalhe">
              <p className="algo-h">
                Tick {d.tick} · {d.fila.length} of {d.vagas} waiting
              </p>
              <p className="algo-nota">{d.frase}</p>
              <p className="algo-h">The queue, head first</p>
              <Pedidos ids={d.fila} tom="processor" rotulo="Waiting requests" vazio="empty" />
              <p className="algo-h">Served, in order</p>
              <Pedidos ids={d.atendidos} tom="conduit" rotulo="Served requests" vazio="nobody yet" />
              <p className="algo-h">Lost</p>
              <Pedidos ids={d.perdidos} tom="live" rotulo="Lost requests" vazio="nobody" />
              <dl className="algo-linhas">
                <div>
                  <dt>Ring buffer</dt>
                  <dd className="mono">{d.opsAnel} operations</dd>
                </div>
                <div>
                  <dt>Shifting array</dt>
                  <dd className="mono">{d.opsVetor} operations</dd>
                </div>
              </dl>
            </div>
          );
        }}
      />
    </div>
  );
}

/** As vagas de uma estrutura num tick: a cabeça marcada, o resto vazio. */
function Vagas({ foto, rotulo, tom }: { foto: FotoDaFila; rotulo: string; tom: string }) {
  const N = foto.vagas.length;
  const cauda = (foto.cabeca + foto.tamanho) % N;
  return (
    <ol className="fila-vagas" aria-label={rotulo} data-tone={tom}>
      {foto.vagas.map((id, i) => (
        <li key={i} data-cheia={id >= 0 ? "" : undefined} data-cabeca={i === foto.cabeca ? "" : undefined} data-cauda={foto.tamanho < N && i === cauda ? "" : undefined} title={`slot ${i}${i === foto.cabeca ? " · head" : ""}`}>
          {id >= 0 ? id + 1 : ""}
        </li>
      ))}
    </ol>
  );
}

/** A lotação ao longo do tempo, com o teto das vagas e o tick em que o leitor está. */
function Lotacao({ rodada, tick }: { rodada: RodadaDaFila; tick: number }) {
  const W = 640;
  const H = 150;
  const fotos = rodada.linhaDoTempo;
  const x = (t: number) => 34 + (t / Math.max(1, fotos.length - 1)) * (W - 44);
  const y = (n: number) => H - 22 - (n / rodada.vagas) * (H - 40);
  const linha = fotos.map((f, k) => `${k === 0 ? "M" : "L"}${x(f.tick).toFixed(1)} ${y(f.tamanho).toFixed(1)}`).join(" ");
  const perdas = fotos.filter((f, k) => f.perdidos > (fotos[k - 1]?.perdidos ?? 0));
  return (
    <svg className="algo-svg algo-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Queue length over ${fotos.length} ticks, against ${rodada.vagas} slots. ${rodada.perdidos} requests lost on ${perdas.length} ticks.`}>
      <line className="algo-eixo" x1={34} x2={W - 10} y1={y(0)} y2={y(0)} />
      <line className="algo-ref" data-tone="live" x1={34} x2={W - 10} y1={y(rodada.vagas)} y2={y(rodada.vagas)} />
      <text x={30} y={y(rodada.vagas) + 4} textAnchor="end">
        {rodada.vagas}
      </text>
      <text x={30} y={y(0) + 4} textAnchor="end">
        0
      </text>
      <path className="algo-curva" data-tone="processor" d={linha} />
      {perdas.map((f) => (
        <circle key={f.tick} className="algo-ponto" data-tone="live" cx={x(f.tick)} cy={y(rodada.vagas)} r={3.2} />
      ))}
      <line className="algo-cursor" x1={x(tick)} x2={x(tick)} y1={12} y2={y(0)} />
      <text x={W - 10} y={H - 4} textAnchor="end" className="algo-fraco">
        ticks →
      </text>
    </svg>
  );
}

const fotoNo = (r: RodadaDaFila, tick: number): FotoDaFila => r.linhaDoTempo[Math.min(tick, r.linhaDoTempo.length - 1)]!;

function Simulacao() {
  const [carga, setCarga] = useState<Carga>("burst");
  const [politica, setPolitica] = useState<Politica>("recusar");
  const [vagas, setVagas] = useState(16);
  const [servico, setServico] = useState(2);
  const [semente, setSemente] = useState(3);
  const [tick, setTick] = useState<number | null>(null);

  const [anel, vetor] = useMemo(() => {
    const base = { politica, carga, semente, vagas, servico } as const;
    return [rodarFila({ ...base, estrutura: "anel" }), rodarFila({ ...base, estrutura: "vetor" })] as const;
  }, [carga, politica, vagas, servico, semente]);
  const ultimo = anel.linhaDoTempo.length - 1;
  const agora = Math.min(tick ?? ultimo, ultimo);
  const fotoA = fotoNo(anel, agora);
  const fotoV = fotoNo(vetor, agora);
  const mesmaOrdem = anel.ordemAtendida.join(",") === vetor.ordemAtendida.join(",");
  const razao = vetor.ops / Math.max(1, anel.ops);

  const mudar = (f: () => void) => {
    f();
    setTick(null);
  };

  return (
    <div className="algo" data-testid="fifo-sim">
      <div className="algo-controles">
        <div className="algo-seg" role="group" aria-label="Load">
          {CARGAS.map((c) => (
            <button key={c.id} type="button" aria-pressed={carga === c.id} title={c.nota} onClick={() => mudar(() => setCarga(c.id))}>
              {c.nome}
            </button>
          ))}
        </div>
        <div className="algo-seg" role="group" aria-label="When full">
          {POLITICAS.map((p) => (
            <button key={p.id} type="button" aria-pressed={politica === p.id} onClick={() => mudar(() => setPolitica(p.id))}>
              {p.nome}
            </button>
          ))}
        </div>
        <label>
          Slots
          <select value={vagas} onChange={(e) => mudar(() => setVagas(Number(e.target.value)))}>
            {[4, 8, 16, 32, 64].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Server
          <select value={servico} onChange={(e) => mudar(() => setServico(Number(e.target.value)))}>
            <option value={1}>1 request per tick</option>
            <option value={2}>1 request every 2 ticks</option>
            <option value={3}>1 request every 3 ticks</option>
          </select>
        </label>
        <button type="button" className="algo-btn" onClick={() => mudar(() => setSemente((s) => s + 1))}>
          New arrivals
        </button>
      </div>

      <p className="algo-veredito" data-ok={anel.perdidos === 0 ? "" : undefined} aria-live="polite" data-testid="fifo-verdict">
        {anel.chegaram} requests arrived: {anel.atendidos} served, {anel.perdidos} lost
        {anel.perdidos > 0 ? (politica === "recusar" ? " (turned away on arrival)" : " (dropped after waiting)") : ""}.{" "}
        {mesmaOrdem ? "Both structures served them in the same order." : "The two structures disagree — this is a bug."} The ring did {anel.ops} operations; the array did {vetor.ops} ({razao.toFixed(1)}×).
      </p>

      <section className="algo-cartao" aria-label="Queue length over time">
        <h3>How full the queue is, tick by tick</h3>
        <p className="algo-nota">
          The dashed line is the {vagas}-slot ceiling; a dot is a tick where a request was lost. {CARGAS.find((c) => c.id === carga)!.nota}; the server takes {servico === 1 ? "1 tick" : `${servico} ticks`} per request.
        </p>
        <Lotacao rodada={anel} tick={agora} />
        <label className="fila-tempo">
          Tick {agora} of {ultimo}
          <input type="range" min={0} max={ultimo} value={agora} onChange={(e) => setTick(Number(e.target.value))} aria-label="Tick" />
        </label>
      </section>

      <div className="algo-dois">
        {(
          [
            [anel, fotoA, "processor"],
            [vetor, fotoV, "controller"],
          ] as const
        ).map(([r, foto, tom]) => {
          const e = ESTRUTURAS_DA_FILA.find((x) => x.id === r.opcoes.estrutura)!;
          return (
            <section key={e.id} className="algo-cartao" aria-label={e.nome}>
              <h3>
                {e.nome} · {e.custo}
              </h3>
              <Vagas foto={foto} rotulo={`${e.nome} slots at tick ${agora}`} tom={tom} />
              <p className="algo-nota mono">
                head = slot {foto.cabeca} · {foto.tamanho}/{r.vagas} waiting · {foto.ops} operations so far
              </p>
              <p className="algo-nota">Next out: {foto.tamanho === 0 ? "nobody" : emOrdem(foto.vagas, foto.cabeca, foto.tamanho).slice(0, 4).map(nome).join(", ")}</p>
              <pre className="fila-codigo mono">{CODIGO_DA_FILA[e.id].join("\n")}</pre>
            </section>
          );
        })}
      </div>

      <div className="algo-tabela">
        <table>
          <caption>Same requests, same order, different price</caption>
          <thead>
            <tr>
              <th scope="col">Structure</th>
              <th scope="col" className="num">
                Operations
              </th>
              <th scope="col" className="num">
                Per request
              </th>
              <th scope="col" className="num">
                Served
              </th>
              <th scope="col" className="num">
                Lost
              </th>
              <th scope="col" className="num">
                Longest wait
              </th>
            </tr>
          </thead>
          <tbody>
            {[anel, vetor].map((r) => (
              <tr key={r.opcoes.estrutura}>
                <td>{ESTRUTURAS_DA_FILA.find((x) => x.id === r.opcoes.estrutura)!.nome}</td>
                <td className="num">{r.ops}</td>
                <td className="num">{(r.ops / Math.max(1, r.chegaram)).toFixed(1)}</td>
                <td className="num">{r.atendidos}</td>
                <td className="num">{r.perdidos}</td>
                <td className="num">{r.maiorEspera} ticks</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FifoModos() {
  return <ModosDoLab showcase={() => <Vitrine />} simulation={() => <Simulacao />} inicial="showcase" />;
}
