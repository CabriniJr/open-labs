import { film, line, pt, type Box, type Film, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { attribute, toOtlpJson, type OtelSpan } from "../otlp.js";
import { bytesEmJson, codificarRequisicao, hex, type CampoCodificado } from "./codificar.js";

/**
 * O showcase de "Reading an OTLP payload": um span, do objeto que o SDK
 * segura aos bytes que saem no fio. Tudo o que o filme mostra sai do
 * codificador de verdade (`codificar.ts`): o tamanho de cada bloco, a chave, o
 * hexa, a profundidade de cada campo. No 3D, a altura de cada bloco é quantas
 * mensagens o envolvem — o aninhamento do protobuf vira relevo.
 */
export interface DetalheDoProtobuf {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

export const SPAN_DO_PROTOBUF: OtelSpan = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  name: "GET /cart",
  kind: 2,
  startTimeUnixNano: "1730649600000000000",
  endTimeUnixNano: "1730649600042000000",
  attributes: [attribute("http.request.method", "GET"), attribute("http.response.status_code", 200)],
};

export function envelopeDoProtobuf() {
  const req = toOtlpJson({ attributes: [attribute("service.name", "checkout")] }, [SPAN_DO_PROTOBUF], "checkout");
  return { req, cod: codificarRequisicao(req), json: bytesEmJson(req) };
}

/** Que tom cada jeito de escrever tem, em todo o lab. */
export function tomDoCampo(c: CampoCodificado): Tone {
  if (c.tipo === "message") return "conduit";
  if (c.tipo === "varint") return "high";
  if (c.tipo === "fixed64") return "kind-4";
  if (c.tipo === "bytes") return "kind-2";
  return "kind-1";
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const curto = (c: CampoCodificado) => c.nome.replace("_unix_nano", "").replace("_value", "");
const hexDe = (bytes: Uint8Array, c: CampoCodificado, max = 4) => {
  const b = [...bytes.slice(c.inicio, c.fim)].map(hex);
  return b.length > max ? `${b.slice(0, max).join(" ")} …` : b.join(" ");
};

export function filmeDoProtobuf(): Film<DetalheDoProtobuf> {
  const { cod, json } = envelopeDoProtobuf();
  const { bytes, campos } = cod;
  const f = film<DetalheDoProtobuf>({ width: 1280, height: 720, gap: 450, maxZoom: 3 });

  // ── o objeto: o span como o SDK o segura ──
  const OBJ = B(56, 92, 330, 560);
  f.add({ type: "region", id: "obj", box: OBJ, label: "Span · in memory", tone: "kind-1" });
  f.add({ type: "node", id: "span", box: B(OBJ.x + 20, OBJ.y + 30, OBJ.w - 40, 58), label: SPAN_DO_PROTOBUF.name, sublabel: "SERVER · checkout", tone: "kind-1", icon: I.trace });
  const daRaiz = campos.filter((c) => c.caminho.includes(".spans[0].") && c.profundidade === 3);
  const linhas = daRaiz.map((c, i) => {
    // Duas colunas, linhas largas: no 3D isométrico o eixo vertical encolhe, e
    // oito linhas coladas viravam uma pilha de rótulos.
    const col = i % 2;
    const lin = Math.floor(i / 2);
    const w = (OBJ.w - 52) / 2;
    const box = B(OBJ.x + 20 + col * (w + 12), OBJ.y + 120 + lin * 104, w, 48);
    const valor = c.tipo === "message" ? (campos.find((x) => x.inicio > c.inicio && x.nome === "key" && x.fim <= c.fim)?.valor ?? "") : c.valor;
    f.add({ type: "node", id: `row:${i}`, box, label: curto(c), sublabel: valor.length > 18 ? `${valor.slice(0, 16)}…` : valor, tone: "muted", textScale: 0.85 });
    return { c, box };
  });

  // ── o fio: os campos na ordem dos bytes, cada bloco do tamanho dele ──
  const FIO = B(450, 92, 780, 470);
  f.add({ type: "region", id: "fio", box: FIO, label: `ExportTraceServiceRequest · protobuf · ${bytes.length} B`, tone: "conduit" });
  const ordem = [...campos].sort((a, b) => a.inicio - b.inicio || a.profundidade - b.profundidade);
  const blocos = new Map<CampoCodificado, Box>();
  let x = FIO.x + 18;
  let y = FIO.y + 40;
  const ALT = 46;
  for (const c of ordem) {
    // Uma mensagem aparece no fio só como a cabeça dela (chave + comprimento);
    // o corpo são os campos que vêm depois.
    const n = c.tipo === "message" ? c.cabeca : c.fim - c.inicio;
    const rotulo = c.tipo === "message" ? `${curto(c)} ▸` : curto(c);
    const w = Math.min(FIO.w - 36, Math.max(30 + n * 4.2, rotulo.length * 5.4 + 14));
    if (x + w > FIO.x + FIO.w - 18) {
      x = FIO.x + 18;
      y += ALT + 26;
    }
    const box = B(x, y, w, ALT);
    blocos.set(c, box);
    x += w + 6;
    const id = `b:${c.inicio}:${c.profundidade}`;
    f.add({
      type: "node",
      id,
      box,
      label: rotulo,
      sublabel: `${n} B`,
      tone: tomDoCampo(c),
      shape: c.tipo === "message" ? "pill" : "box",
      textScale: 0.72,
      height: 6,
      hidden: true,
      title: `${c.caminho}: ${hexDe(bytes, c, 12)}`,
    });
  }
  const idDe = (c: CampoCodificado) => `b:${c.inicio}:${c.profundidade}`;

  // As fichas: de cada linha do objeto até o bloco dela no fio.
  linhas.forEach(({ c, box }, i) => {
    const alvo = blocos.get(c)!;
    f.add({ type: "token", id: `t:${i}`, path: line(pt(box.x + box.w, box.y + box.h / 2), pt(alvo.x, alvo.y + alvo.h / 2)), label: hexDe(bytes, c, 2), sublabel: curto(c), tone: tomDoCampo(c), size: 5, hidden: true, layer: 10 });
  });

  // A comparação: o mesmo envelope em JSON e em protobuf.
  const CMP = B(450, 590, 780, 70);
  const escala = (CMP.w - 200) / json;
  f.add({ type: "bar", id: "bar:json", box: B(CMP.x + 180, CMP.y + 6, json * escala, 22), label: `OTLP/JSON · ${json} B`, tone: "muted", grow: "right", hidden: true });
  f.add({ type: "bar", id: "bar:pb", box: B(CMP.x + 180, CMP.y + 40, bytes.length * escala, 22), label: `protobuf · ${bytes.length} B`, tone: "conduit", grow: "right", hidden: true });
  f.add({ type: "note", id: "n:cmp", at: pt(CMP.x, CMP.y + 34), label: "same envelope,\ntwo encodings", tone: "muted", hidden: true });
  f.add({ type: "note", id: "n:alt", at: pt(FIO.x + 18, FIO.y + FIO.h - 20), label: "in 3D, a block's height is how many messages enclose it", tone: "muted", hidden: true });

  const doSpan = (nome: string) => linhas.findIndex((l) => l.c.nome === nome);
  const linhasDe = (c: CampoCodificado): (readonly [string, string])[] => [
    ["field", `${c.nome} = ${c.numero}`],
    ["wire type", `${c.wire} (${c.tipo === "message" ? "length-delimited" : c.tipo})`],
    ["key", `(${c.numero} << 3) | ${c.wire} = 0x${hex((c.numero << 3) | c.wire)}`],
    ["bytes", hexDe(bytes, c, 10)],
  ];
  const campoDoSpan = (nome: string) => linhas[doSpan(nome)]!.c;

  f.chapter(
    { id: "object", title: "One span, as the SDK holds it", body: "A span in memory is an object: ids, a name, a kind, two timestamps and attributes. To leave the process it has to become bytes, and OTLP's default encoding is protobuf.", detail: { nivel: 0, linhas: [["service.name", "checkout"], ["fields", String(linhas.length)], ["OTLP/JSON", `${json} B`]] } },
    (d) => {
      d.camera({ box: OBJ, pad: 30 }, { dur: 1200 });
      d.glow("span", 1).ping("span");
      d.stagger(linhas, 120, (x, _, i) => x.glow(`row:${i}`, 0.6, { dur: 200 }));
      d.wait(900);
    },
  );
  const nome = campoDoSpan("name");
  f.chapter(
    { id: "keys", title: "A field is a key, not a name", body: "Protobuf never writes \"name\". It writes the field's number from the .proto file and how the value is written, packed into one key byte. The receiver needs the same schema to read it back.", detail: { nivel: 1, linhas: linhasDe(nome) } },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1600 });
      d.stagger(linhas, 260, (x, _, i) => {
        x.together((y) => y.send(`t:${i}`, { dur: 700 }), (y) => y.glow(`row:${i}`, 1, { dur: 200 }));
        x.show(idDe(linhas[i]!.c), { dur: 260 }).glow(`row:${i}`, 0, { dur: 200 });
      });
      d.glow(idDe(nome), 1).ping(idDe(nome));
      d.packet({ tag: "KEY", tone: "kind-1", from: "span.name", to: "wire", protocol: "protobuf", payload: `field 5, wire 2 → 0x2a, then length, then "${SPAN_DO_PROTOBUF.name}"`, bytes: nome.fim - nome.inicio });
      d.wait(900);
    },
  );
  const kind = campoDoSpan("kind");
  const status = campos.find((c) => c.nome === "int_value")!;
  f.chapter(
    { id: "varint", title: "Small numbers, small bytes", body: "Integers are varints: seven bits per byte, the high bit says another byte follows. kind = 2 is one byte. status_code 200 does not fit in seven bits, so it takes two: c8 01.", detail: { nivel: 2, linhas: [["kind", `${hexDe(bytes, kind)}  (key 30, value 02)`], ["status_code 200", `${hexDe(bytes, status)}  (key 18, c8 01)`], ["200", "1100 1000 → 1001000 | 1"]] } },
    (d) => {
      d.camera({ box: FIO, pad: 24 }, { dur: 1400 });
      d.dim(ordem.filter((c) => c !== kind && c !== status).map(idDe), 0.6, { dur: 400 });
      d.show(idDe(status), { dur: 300 });
      d.glow(idDe(kind), 1).ping(idDe(kind)).wait(500);
      d.glow(idDe(status), 1).ping(idDe(status));
      d.packet({ tag: "VARINT", tone: "high", from: "status_code", to: "wire", protocol: "protobuf", payload: "200 → c8 01 (two bytes)", bytes: status.fim - status.inicio });
      d.wait(1200);
    },
  );
  const trace = campoDoSpan("trace_id");
  f.chapter(
    { id: "lengths", title: "Ids are raw bytes", body: "Text and ids are written with their length first. The trace id goes as 16 raw bytes — in OTLP/JSON it is 32 hex characters plus quotes. This one field is half the difference.", detail: { nivel: 2, linhas: [["trace_id", `${trace.fim - trace.inicio} B (key + length + 16)`], ["in JSON", `${SPAN_DO_PROTOBUF.traceId.length + 2} chars`], ["bytes", hexDe(bytes, trace, 6)]] } },
    (d) => {
      d.dim(ordem.map(idDe), 0.6, { dur: 1 });
      d.dim(idDe(trace), 0, { dur: 300 }).glow(idDe(trace), 1).ping(idDe(trace));
      d.dim(idDe(nome), 0, { dur: 300 }).glow(idDe(nome), 1);
      d.packet({ tag: "BYTES", tone: "kind-2", from: "trace_id", to: "wire", protocol: "protobuf", payload: "16 raw bytes, not 32 hex chars", bytes: trace.fim - trace.inicio });
      d.wait(1200);
    },
  );
  const inicio = campoDoSpan("start_time_unix_nano");
  f.chapter(
    { id: "fixed", title: "Timestamps are a fixed eight", body: "Nanoseconds since 1970 are huge numbers; a varint would take nine bytes. OTLP declares them fixed64: always eight bytes, little-endian, cheap to read.", detail: { nivel: 2, linhas: [["start", inicio.valor], ["bytes", hexDe(bytes, inicio, 9)], ["wire type", "1 (fixed64)"]] } },
    (d) => {
      d.dim(ordem.map(idDe), 0.6, { dur: 1 });
      const fim = campoDoSpan("end_time_unix_nano");
      d.dim([idDe(inicio), idDe(fim)], 0, { dur: 300 });
      d.glow([idDe(inicio), idDe(fim)], 1).ping(idDe(inicio));
      d.wait(1400);
    },
  );
  const mensagens = ordem.filter((c) => c.tipo === "message");
  // O que ainda não está no fio: o envelope em volta do span e o miolo dos atributos.
  const fora = ordem.filter((c) => !linhas.some((l) => l.c === c));
  f.chapter(
    { id: "nesting", title: "Messages nest by length", body: "The span is a message inside ScopeSpans, inside ResourceSpans, inside the request. Each level is a key and a length, then its fields. The resource is written once for every span in its group.", detail: { nivel: 3, linhas: [["messages", String(mensagens.length)], ["deepest field", `depth ${Math.max(...campos.map((c) => c.profundidade))}`], ["headers", `${mensagens.reduce((s, c) => s + c.cabeca, 0)} B of keys + lengths`]] } },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1400, wait: false });
      d.dim(ordem.map(idDe), 0, { dur: 300 });
      d.glow(ordem.map(idDe), 0, { dur: 200 });
      d.stagger(fora.filter((c) => c !== status), 45, (x, c) => x.show(idDe(c), { dur: 260 }));
      d.show("n:alt", { dur: 300 });
      // O relevo: cada bloco sobe tanto quanto o número de mensagens em volta dele.
      for (const c of ordem) d.to(idDe(c), { lift: c.profundidade * 9 }, { dur: 1200, ease: "inOut", wait: false });
      d.wait(1200);
      d.glow(mensagens.map(idDe), 1, { dur: 400 }).wait(1400);
    },
  );
  f.chapter(
    { id: "wire", title: `On the wire: ${bytes.length} bytes`, body: `The whole request is ${bytes.length} bytes in protobuf and ${json} in OTLP/JSON. The schema carries the names, so the wire only carries numbers — that is the trade: smaller and faster, unreadable without the .proto.`, detail: { nivel: 4, linhas: [["protobuf", `${bytes.length} B`], ["OTLP/JSON", `${json} B`], ["ratio", `${(json / bytes.length).toFixed(1)}×`]] } },
    (d) => {
      d.glow(mensagens.map(idDe), 0, { dur: 300 });
      d.show(["n:cmp", "bar:json", "bar:pb"], { dur: 300 });
      d.together(
        (x) => x.tween("bar:json", "progress", 1, { dur: 1200 }),
        (x) => x.tween("bar:pb", "progress", 1, { dur: 1200, delay: 200 }),
      );
      d.packet({ tag: "OTLP", tone: "conduit", from: "SDK", to: "Collector", protocol: "OTLP/gRPC · protobuf", payload: "ExportTraceServiceRequest · 1 span", bytes: bytes.length });
      d.packet({ tag: "OTLP", tone: "muted", from: "SDK", to: "Collector", protocol: "OTLP/HTTP · JSON", payload: "the same request, as text", bytes: json });
      d.wait(1600);
    },
  );
  return f.build();
}
