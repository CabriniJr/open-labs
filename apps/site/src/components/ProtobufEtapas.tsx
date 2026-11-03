import { envelopeDoProtobuf, etapasDaCodificacao, hex, narrarEtapa, tomDoCampo, type CampoCodificado } from "@ovh/otel-domain";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

/**
 * O showcase do protobuf, em etapas e não em fluxo: não há nada viajando de um
 * lugar a outro, há um buffer que cresce. Cada etapa escreve um campo, e o que
 * se vê é o formato reagindo — as cabeças das mensagens que abrem, o
 * comprimento de cada mensagem em volta subindo, e, quando um comprimento
 * passa de 127, o byte a mais que empurra tudo uma casa. Um fio animado
 * esconderia justamente isso.
 *
 * Janela à esquerda (cabeças + bytes), andamento à direita (a conta da chave,
 * o valor, as reações), como no player do motor.
 */
const POR_LINHA = 16;
const PASSO_MS = 2800;

export function ProtobufEtapas() {
  const etapas = useMemo(() => etapasDaCodificacao(envelopeDoProtobuf().req), []);
  const { json } = useMemo(() => envelopeDoProtobuf(), []);
  const [i, setI] = useState(0);
  const [tocando, setTocando] = useState(false);
  const e = etapas[i]!;
  const nar = useMemo(() => narrarEtapa(e), [e]);
  const ultima = i === etapas.length - 1;

  useEffect(() => {
    if (!tocando) return;
    if (ultima) {
      setTocando(false);
      return;
    }
    const t = window.setTimeout(() => setI((x) => Math.min(x + 1, etapas.length - 1)), PASSO_MS);
    return () => window.clearTimeout(t);
  }, [tocando, i, ultima, etapas.length]);

  const ir = (n: number) => setI(Math.max(0, Math.min(etapas.length - 1, n)));
  const alternar = () => {
    if (ultima) setI(0);
    setTocando((t) => !t || ultima);
  };
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.target instanceof HTMLInputElement) return;
    if (ev.key === " " || ev.key === "k") {
      ev.preventDefault();
      alternar();
    } else if (ev.key === "ArrowRight") {
      ev.preventDefault();
      setTocando(false);
      ir(i + 1);
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      setTocando(false);
      ir(i - 1);
    }
  };

  const { bytes, campos } = e.cod;
  const mensagens = campos.filter((c) => c.tipo === "message");
  const abertas = new Set(e.abertas.map((c) => c.caminho));
  const reagiu = new Map(e.reacoes.map((r) => [r.campo.caminho, r]));
  // Cada byte: quem é o dono (o campo mais fundo), e o que aconteceu com ele agora.
  const dono: (CampoCodificado | undefined)[] = [];
  const marca: ("novo" | "reage" | "cresceu" | undefined)[] = [];
  for (const c of campos) {
    const ateOnde = c.tipo === "message" ? c.inicio + c.cabeca : c.fim;
    for (let b = c.inicio; b < ateOnde; b += 1) dono[b] = c;
  }
  for (let b = e.campo.inicio; b < e.campo.fim; b += 1) marca[b] = "novo";
  for (const c of e.abertas) for (let b = c.inicio; b < c.inicio + c.cabeca; b += 1) marca[b] = "novo";
  for (const r of e.reacoes) {
    for (let b = r.campo.inicio + 1; b < r.campo.inicio + r.campo.cabeca; b += 1) marca[b] = "reage";
    if (r.cresceu) marca[r.campo.inicio + r.campo.cabeca - 1] = "cresceu";
  }

  return (
    <div className="pbet" tabIndex={0} onKeyDown={onKey} data-testid="protobuf-showcase" aria-label="OTLP protobuf, written one field at a time">
      <div className="pbet__steps" aria-hidden="true">
        <span className="pbet__bars">
          {etapas.map((x, k) => (
            <span key={x.n} data-state={k < i ? "done" : k === i ? "current" : "next"} />
          ))}
        </span>
        <span className="mono">
          Step {i + 1}/{etapas.length} · {e.campo.caminho}
        </span>
      </div>

      <div className="pbet__layout">
        <div className="pbet__janela">
          <section className="pbet__cabecas" aria-label="Message headers">
            <p className="pbet__h mono">Headers · key + length</p>
            <ol>
              {mensagens.map((m) => {
                const r = reagiu.get(m.caminho);
                return (
                  <li key={m.caminho} style={{ ["--d" as string]: m.profundidade }} data-tone="conduit" data-novo={abertas.has(m.caminho) ? "" : undefined} data-reage={r !== undefined ? "" : undefined} data-cresceu={r?.cresceu ? "" : undefined}>
                    <span className="mono pbet__hex" key={`${m.caminho}:${i}`}>
                      {[...bytes.slice(m.inicio, m.inicio + m.cabeca)].map(hex).join(" ")}
                    </span>
                    <span className="pbet__nome">{m.nome}</span>
                    <span className="mono pbet__len">
                      {r !== undefined ? <s>{r.antes}</s> : null} {m.fim - m.inicio - m.cabeca} B
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="pbet__buffer mono" aria-label={`Buffer, ${bytes.length} bytes`}>
            <p className="pbet__h">Buffer · {bytes.length} B</p>
            {Array.from({ length: Math.ceil(bytes.length / POR_LINHA) }, (_, l) => l * POR_LINHA).map((ini) => (
              <div key={ini} className="pbet__linha">
                <span className="pbet__off">{ini.toString(16).padStart(4, "0")}</span>
                {[...bytes.slice(ini, ini + POR_LINHA)].map((b, j) => {
                  const k = ini + j;
                  const m = marca[k];
                  const d = dono[k];
                  return (
                    <span
                      key={m === undefined ? k : `${k}:${i}`}
                      className="pbet__byte"
                      data-tone={d === undefined ? undefined : tomDoCampo(d)}
                      data-head={d !== undefined && k < d.inicio + d.cabeca ? "" : undefined}
                      data-marca={m}
                    >
                      {hex(b)}
                    </span>
                  );
                })}
              </div>
            ))}
          </section>

          <div className="pbet__transport" role="group" aria-label="Steps">
            <button type="button" className="mo-btn" onClick={() => (setTocando(false), ir(i - 1))} aria-label="Previous step" disabled={i === 0}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3v10M13 3 6 8l7 5z" /></svg>
            </button>
            <button type="button" className="mo-btn mo-btn--primary" onClick={alternar} aria-label={tocando ? "Pause" : "Play"}>
              {tocando ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" /></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l8 5-8 5z" /></svg>}
            </button>
            <button type="button" className="mo-btn" onClick={() => (setTocando(false), ir(i + 1))} aria-label="Next step" disabled={ultima}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3v10M3 3l7 5-7 5z" /></svg>
            </button>
            <input type="range" min={0} max={etapas.length - 1} value={i} aria-label="Step" aria-valuetext={`step ${i + 1}: ${e.campo.caminho}`} onChange={(ev) => (setTocando(false), ir(Number(ev.target.value)))} />
          </div>
        </div>

        <aside className="pbet__andamento" aria-live="polite">
          <p className="pbet__eyebrow mono" data-tone={tomDoCampo(e.campo)}>
            {e.campo.tipo}
          </p>
          <h3>{nar.titulo}</h3>
          <dl className="pbet__conta mono" aria-label="The key">
            {nar.chave.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p>{nar.valor}</p>
          {nar.abertas !== "" ? <p className="pbet__abre">{nar.abertas}</p> : null}
          {nar.reacoes.length > 0 ? (
            <>
              <p className="pbet__h mono">Reactions · every enclosing length</p>
              <ul className="pbet__reacoes">
                {nar.reacoes.map((r) => (
                  <li key={r.texto} data-cresceu={r.cresceu ? "" : undefined}>
                    {r.texto}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {ultima ? (
            <p className="pbet__fim">
              Done: <b className="mono">{bytes.length} B</b> of protobuf for a request that is <b className="mono">{json} B</b> as OTLP/JSON. The names stayed in the <code>.proto</code>; only numbers travelled.
            </p>
          ) : null}
          <p className="pbet__keys mono" aria-hidden="true">space play · ←/→ step</p>
        </aside>
      </div>
    </div>
  );
}
