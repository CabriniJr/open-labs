import { attribute, bytesEmJson, codificarRequisicao, hex, SPAN_DO_PROTOBUF, toOtlpJson, tomDoCampo, type CampoCodificado, type OtelSpan } from "@ovh/otel-domain";
import { useMemo, useState } from "react";

/**
 * A simulação de "Reading an OTLP payload": o leitor muda o span e lê os bytes
 * como num analisador de pacotes — o hexa à esquerda, a árvore de campos à
 * direita, e o campo escolhido aceso nos dois. Os bytes saem do mesmo
 * codificador do filme; nada aqui é desenho de bytes, é o protobuf de verdade.
 */
const POR_LINHA = 16;

export function ProtobufLab() {
  const [nome, setNome] = useState(SPAN_DO_PROTOBUF.name);
  const [status, setStatus] = useState(200);
  const [comPai, setComPai] = useState(false);
  const [extra, setExtra] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  const { cod, json } = useMemo(() => {
    const span: OtelSpan = {
      ...SPAN_DO_PROTOBUF,
      name: nome,
      ...(comPai ? { parentSpanId: "b7ad6b7169203331" } : {}),
      attributes: [attribute("http.request.method", "GET"), attribute("http.response.status_code", status), ...(extra ? [attribute("user.id", "u-1234567890")] : [])],
    };
    const req = toOtlpJson({ attributes: [attribute("service.name", "checkout")] }, [span], "checkout");
    return { cod: codificarRequisicao(req), json: bytesEmJson(req) };
  }, [nome, status, comPai, extra]);

  const campo = cod.campos.find((c) => c.caminho === escolhido) ?? null;
  // De cada byte, o campo mais fundo que o contém: é ele que dá a cor.
  const donoDoByte = useMemo(() => {
    const dono: (CampoCodificado | undefined)[] = [];
    for (const c of cod.campos) for (let i = c.inicio; i < (c.tipo === "message" ? c.inicio + c.cabeca : c.fim); i += 1) dono[i] = c;
    return dono;
  }, [cod]);

  const linhas = Array.from({ length: Math.ceil(cod.bytes.length / POR_LINHA) }, (_, l) => l * POR_LINHA);
  const dentro = (i: number) => campo !== null && i >= campo.inicio && i < campo.fim;
  const cabeca = (i: number) => campo !== null && i >= campo.inicio && i < campo.inicio + campo.cabeca;

  return (
    <div className="pblab" data-testid="protobuf-lab">
      <form className="pblab__form" onSubmit={(e) => e.preventDefault()}>
        <label>
          <span className="mono">span.name</span>
          <input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          <span className="mono">http.response.status_code</span>
          <select value={status} onChange={(e) => setStatus(Number(e.target.value))}>
            {[1, 127, 128, 200, 404, 503, 70000].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="pblab__check">
          <input type="checkbox" checked={comPai} onChange={(e) => setComPai(e.target.checked)} />
          <span>has a parent span</span>
        </label>
        <label className="pblab__check">
          <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} />
          <span>add user.id attribute</span>
        </label>
      </form>

      <div className="pblab__sizes" aria-live="polite">
        <div data-tone="conduit">
          <b className="mono">{cod.bytes.length} B</b> protobuf
          <span style={{ ["--w" as string]: `${(cod.bytes.length / json) * 100}%` }} />
        </div>
        <div data-tone="muted">
          <b className="mono">{json} B</b> OTLP/JSON
          <span style={{ ["--w" as string]: "100%" }} />
        </div>
      </div>

      <div className="pblab__panes">
        <div className="pblab__hex mono" role="table" aria-label="Request bytes">
          {linhas.map((ini) => (
            <div key={ini} role="row" className="pblab__linha">
              <span className="pblab__off" role="rowheader">
                {ini.toString(16).padStart(4, "0")}
              </span>
              {Array.from(cod.bytes.slice(ini, ini + POR_LINHA)).map((b, j) => {
                const i = ini + j;
                const dono = donoDoByte[i];
                return (
                  <button
                    key={i}
                    type="button"
                    role="cell"
                    className="pblab__byte"
                    data-tone={dono === undefined ? undefined : tomDoCampo(dono)}
                    data-head={dono !== undefined && i < dono.inicio + dono.cabeca ? "" : undefined}
                    data-on={dentro(i) ? "" : undefined}
                    data-key={cabeca(i) ? "" : undefined}
                    onClick={() => setEscolhido(dono?.caminho ?? null)}
                    aria-label={`byte ${i}: ${hex(b)}${dono === undefined ? "" : `, ${dono.caminho}`}`}
                  >
                    {hex(b)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <ol className="pblab__tree" aria-label="Fields">
          {cod.campos.map((c) => (
            <li key={c.caminho} style={{ ["--d" as string]: c.profundidade }}>
              <button type="button" data-tone={tomDoCampo(c)} aria-pressed={escolhido === c.caminho} onClick={() => setEscolhido(c.caminho)}>
                <span className="mono pblab__num">{c.numero}</span>
                <span className="pblab__nome">{c.nome}</span>
                <span className="mono pblab__val">{c.tipo === "message" ? `${c.fim - c.inicio - c.cabeca} B` : c.valor}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <p className="pblab__leitura" aria-live="polite">
        {campo === null ? (
          "Pick a byte or a field. The key and length bytes are outlined; the rest is the value."
        ) : (
          <>
            <b className="mono">{campo.caminho}</b> — field {campo.numero}, wire type {campo.wire} ({campo.tipo}). Key{" "}
            <code>
              ({campo.numero} &lt;&lt; 3) | {campo.wire} = 0x{hex((campo.numero << 3) | campo.wire)}
            </code>
            , {campo.cabeca} B of key{campo.wire === 2 ? " + length" : ""}, {campo.fim - campo.inicio - campo.cabeca} B of value.
          </>
        )}
      </p>
    </div>
  );
}
