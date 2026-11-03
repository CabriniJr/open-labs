import { descida, film, line, pt, type Box, type Film, type FilmBuilder, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { attribute, toOtlpJson, type OtelSpan } from "../otlp.js";
import { bytesEmJson, codificarRequisicao, hex, type CampoCodificado } from "./codificar.js";
import { SPAN_DO_PROTOBUF } from "./exemplo.js";

/**
 * O showcase de "Reading an OTLP payload": o span é um papelzinho que pula de
 * app em app, e uma tela ao lado vai somando o que cada um fez com ele, em
 * verbos — cria, carimba, escreve, envia, lê, guarda. A profundidade está no
 * papel: no SDK a câmera desce para dentro dele (os campos) e para dentro de um
 * campo (do que ele é feito no fio). Os tamanhos saem do codificador de verdade.
 *
 * Duas escolhas do leitor refazem o filme: a codificação (protobuf ou JSON) e
 * um atributo a mais. É ali que se vê o que pesa.
 */
export type Codificacao = "protobuf" | "json";

export interface LinhaDoDiario {
  readonly quem: string;
  readonly verbo: string;
  readonly resto: string;
  readonly tom: Tone;
  /** O capítulo em que a linha nasceu, para a tela poder voltar até ele. */
  readonly capitulo: number;
}

export interface DetalheDaViagem {
  readonly nivel: number;
  readonly diario: readonly LinhaDoDiario[];
}

export interface OpcoesDaViagem {
  readonly codificacao?: Codificacao;
  readonly atributoExtra?: boolean;
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const dir = (b: Box) => pt(b.x + b.w, b.y + b.h / 2);
const esq = (b: Box) => pt(b.x, b.y + b.h / 2);

/** O span da viagem, com ou sem o atributo a mais. */
export function spanDaViagem(atributoExtra: boolean): OtelSpan {
  return { ...SPAN_DO_PROTOBUF, attributes: [...SPAN_DO_PROTOBUF.attributes, ...(atributoExtra ? [attribute("user.id", "u-1234567890")] : [])] };
}

/** Um campo do span como linha do papel: nome na codificação escolhida e quanto pesa nela. */
interface CampoDoPapel {
  readonly nome: string;
  readonly bytes: number;
  readonly tom: Tone;
}

const TOM: Record<CampoCodificado["tipo"], Tone> = { string: "kind-1", bytes: "kind-2", varint: "high", fixed64: "kind-4", message: "conduit" };
const CAMEL: Record<string, string> = { trace_id: "traceId", span_id: "spanId", name: "name", kind: "kind", start_time_unix_nano: "startTimeUnixNano", end_time_unix_nano: "endTimeUnixNano", attributes: "attributes" };

function camposDoPapel(span: OtelSpan, campos: readonly CampoCodificado[], cod: Codificacao): CampoDoPapel[] {
  const doSpan = campos.filter((c) => c.caminho.includes(".spans[0].") && c.profundidade === 3);
  let atributo = 0;
  return doSpan.map((c) => {
    if (cod === "protobuf") return { nome: c.nome, bytes: c.fim - c.inicio, tom: TOM[c.tipo] };
    // Em JSON, o pedaço de texto que o campo vira: nome entre aspas, dois-pontos, valor, vírgula.
    const chave = CAMEL[c.nome] ?? c.nome;
    const valor = chave === "attributes" ? span.attributes[atributo++] : (span as unknown as Record<string, unknown>)[chave];
    return { nome: chave, bytes: new TextEncoder().encode(`${JSON.stringify(chave)}:${JSON.stringify(valor)},`).length, tom: TOM[c.tipo] };
  });
}

export function filmeDaViagem(opcoes: OpcoesDaViagem = {}): Film<DetalheDaViagem> {
  const cod = opcoes.codificacao ?? "protobuf";
  const span = spanDaViagem(opcoes.atributoExtra === true);
  const req = toOtlpJson({ attributes: [attribute("service.name", "checkout")] }, [span], "checkout");
  const pb = codificarRequisicao(req);
  const total = cod === "protobuf" ? pb.bytes.length : bytesEmJson(req);
  const outro = cod === "protobuf" ? bytesEmJson(req) : pb.bytes.length;
  const papel = camposDoPapel(span, pb.campos, cod);

  const f = film<DetalheDaViagem>({ width: 1280, height: 720, gap: 400, maxZoom: 40 });

  // ── nível 0: os apps ──
  const TUDO = B(0, 0, 1280, 720);
  const APP = B(60, 285, 170, 100);
  const SDK = B(300, 250, 280, 170);
  const COL = B(680, 285, 210, 100);
  const BACK = B(1010, 285, 200, 100);
  const PAY = B(470, 540, 170, 90);

  // ── nível 1: o papel aberto, dentro do SDK ──
  const CARTAO = B(SDK.x + 14, SDK.y + 26, SDK.w - 28, SDK.h - 40);
  const colunas = 2;
  const lw = (CARTAO.w - 18) / colunas;
  const linhas = Math.ceil(papel.length / colunas);
  const lh = Math.min(18, (CARTAO.h - 22) / linhas - 4);
  const caixaDaLinha = (i: number) => B(CARTAO.x + 6 + (i % colunas) * (lw + 6), CARTAO.y + 14 + Math.floor(i / colunas) * (lh + 4), lw, lh);
  const iNome = papel.findIndex((p) => p.nome === "name");
  const NOME = caixaDaLinha(iNome);

  const nv = descida(f as unknown as FilmBuilder<unknown>, [TUDO, SDK, NOME]);
  const N = nv.map((n, i) => ({ lod: n.lod, k: i === 0 ? 1 : n.k }));

  const app = (id: string, box: Box, label: string, sub: string, tone: Tone, icon: (typeof I)[keyof typeof I], shape: "box" | "stack" | "cylinder" = "box", hidden = false) =>
    f.add({ type: "node", id, box, label, sublabel: sub, tone, icon, shape, textScale: 1.45, lod: N[0]!.lod, hidden });
  app("checkout", APP, "checkout", "your app", "kind-1", I.service);
  app("sdk", SDK, "OpenTelemetry SDK", "inside checkout", "processor", I.sdk);
  app("collector", COL, "Collector", "otlp receiver", "conduit", I.collector, "stack");
  app("backend", BACK, "backend", "trace storage", "container", I.backend, "cylinder");
  app("payments", PAY, "payments", "another app", "kind-3", I.service, "box", true);
  const fio = (id: string, a: Box, b: Box) => f.add({ type: "link", id, path: line(dir(a), esq(b)), tone: "muted", dashed: true, lod: N[0]!.lod });
  fio("f:app", APP, SDK);
  fio("f:col", SDK, COL);
  fio("f:back", COL, BACK);
  f.add({ type: "link", id: "f:pay", path: line(pt(PAY.x + PAY.w, PAY.y + PAY.h / 2), pt(COL.x + COL.w / 2, COL.y + COL.h)), tone: "muted", dashed: true, lod: N[0]!.lod, hidden: true });

  // O papelzinho: um em cada trecho, para cada salto ter o seu caminho.
  const papelzinho = (id: string, a: Box, b: Box, label: string, sub: string, tone: Tone) =>
    f.add({ type: "token", id, path: line(dir(a), esq(b)), label, sublabel: sub, tone, size: 9, trail: 6, textScale: 1.35, hidden: true, lod: N[0]!.lod, layer: 10 });
  papelzinho("p:1", APP, SDK, "span", span.name, "kind-1");
  papelzinho("p:2", SDK, COL, cod === "protobuf" ? "OTLP · protobuf" : "OTLP · JSON", `${total} B`, "conduit");
  papelzinho("p:3", COL, BACK, "BATCH", "2 spans", "conduit");
  f.add({ type: "token", id: "p:pay", path: line(pt(PAY.x + PAY.w, PAY.y + PAY.h / 2), pt(COL.x + COL.w / 2, COL.y + COL.h)), label: "span", sublabel: "POST /pay", tone: "kind-3", size: 9, trail: 6, textScale: 1.35, hidden: true, lod: N[0]!.lod, layer: 10 });

  // Nível 1: o papel aberto. Cada linha é um campo, do tamanho que ele pesa.
  f.add({ type: "region", id: "cartao", box: CARTAO, label: `the span · ${cod}`, tone: "kind-1", textScale: N[1]!.k * 1.4, lod: N[1]!.lod, layer: -1 });
  papel.forEach((p, i) => {
    f.add({ type: "node", id: `campo:${i}`, box: caixaDaLinha(i), label: p.nome, sublabel: `${p.bytes} B`, tone: p.tom, textScale: N[1]!.k * 1.5, lod: N[1]!.lod, hidden: true });
  });

  // Nível 2: um campo por dentro. Protobuf: etiqueta, tamanho, texto. JSON: o nome escrito por extenso.
  const peca = cod === "protobuf"
    ? [
        { t: hex(0x2a), sub: "tag: field 5, text", w: 0.22 },
        { t: hex(span.name.length), sub: `length ${span.name.length}`, w: 0.22 },
        { t: span.name, sub: "the text", w: 0.5 },
      ]
    : [
        { t: '"name"', sub: "the field name, spelled out", w: 0.34 },
        { t: ":", sub: "", w: 0.1 },
        { t: `"${span.name}"`, sub: "the text, in quotes", w: 0.5 },
      ];
  let x = NOME.x + NOME.w * 0.02;
  peca.forEach((p, i) => {
    const w = NOME.w * p.w;
    f.add({ type: "node", id: `peca:${i}`, box: B(x, NOME.y + NOME.h * 0.12, w, NOME.h * 0.76), label: p.t, sublabel: p.sub, tone: i === 2 ? "kind-1" : cod === "protobuf" ? "high" : "muted", textScale: N[2]!.k * 1.7, lod: N[2]!.lod, hidden: true });
    x += w + NOME.w * 0.015;
  });

  // ── a tela: o que cada um fez, somado ──
  const diario: LinhaDoDiario[] = [];
  let capitulo = 0;
  let nivelAtual = 0;
  const escrever = (quem: string, verbo: string, resto: string, tom: Tone): DetalheDaViagem => {
    diario.push({ quem, verbo, resto, tom, capitulo });
    return { nivel: nivelAtual, diario: [...diario] };
  };
  const ms = (Number(BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)) / 1e6).toFixed(0);

  f.chapter({ id: "create", title: "checkout creates the span", body: `A request arrives. The instrumentation in checkout opens a span, gives it a name and a kind, and closes it ${ms} ms later. It lives in memory, as an object.`, detail: escrever("checkout", "creates", `span "${span.name}" · SERVER · ${ms} ms`, "kind-1") }, (d) => {
    d.camera({ at: { zoom: 1 } }, { dur: 1 });
    d.glow("checkout", 1).ping("checkout").wait(500);
    d.show("p:1", { dur: 1 });
  });
  capitulo += 1;
  f.chapter({ id: "stamp", title: "the SDK stamps who sent it", body: "The span goes to the SDK in the same process. The SDK adds the resource, service.name = checkout, once for every span it sends, not once per span.", detail: escrever("SDK", "stamps", "service.name = checkout", "processor") }, (d) => {
    d.glow("checkout", 0, { dur: 200 });
    d.send("p:1", { dur: 1200 });
    d.set("p:1", { sublabel: `${span.name} · checkout` }).glow("sdk", 1).ping("sdk").wait(600);
  });
  capitulo += 1;
  nivelAtual = 1;
  f.chapter(
    {
      id: "write",
      title: `the SDK writes it down: ${total} B`,
      body: cod === "protobuf"
        ? `Open the paper. Each field becomes a few bytes: ids go raw, numbers go small, text goes as it is. Field names stay home in the .proto. The whole request is ${total} B; the same request as JSON would be ${outro} B.`
        : `Open the paper. As JSON, every field name travels spelled out, in quotes, next to its value. The whole request is ${total} B; the same request in protobuf would be ${outro} B.`,
      detail: escrever("SDK", "writes", `${papel.length} fields → ${total} B of ${cod}`, "processor"),
    },
    (d) => {
      d.camera({ box: SDK, pad: 10 }, { dur: 2200 });
      d.stagger(papel, 140, (x2, _, i) => x2.show(`campo:${i}`, { dur: 260 }));
      d.wait(900);
    },
  );
  capitulo += 1;
  nivelAtual = 2;
  f.chapter(
    {
      id: "spell",
      title: cod === "protobuf" ? "one field, up close" : "one field, up close",
      body: cod === "protobuf"
        ? `Inside the name field: one byte says "field 5, text", one byte says "${span.name.length} letters follow", then the letters. The receiver knows field 5 is the name because it has the same .proto.`
        : `Inside the name field: the word "name" in quotes, a colon, then the value in quotes. Readable by anyone, and paid for in every span.`,
      detail: escrever("SDK", "spells", cod === "protobuf" ? `name as 2a · ${hex(span.name.length)} · "${span.name}"` : `name as "name":"${span.name}"`, cod === "protobuf" ? "high" : "muted"),
    },
    (d) => {
      d.camera({ box: NOME, pad: 2 }, { dur: 2000 });
      d.stagger(peca, 380, (x2, _, i) => x2.show(`peca:${i}`, { dur: 300 }).glow(`peca:${i}`, 1, { dur: 200 }));
      d.wait(1200);
    },
  );
  capitulo += 1;
  nivelAtual = 0;
  f.chapter({ id: "send", title: "the SDK sends the request", body: `Back up. The exporter sends one request of ${total} B to the Collector. ${cod === "protobuf" ? "Over gRPC, the connection stays open for the next one." : "Over HTTP, as text."}`, detail: escrever("SDK", "sends", `1 request · ${total} B → Collector`, "conduit") }, (d) => {
    d.camera({ at: { zoom: 1 } }, { dur: 2000 });
    d.hide("p:1", { dur: 200 });
    d.show("p:2", { dur: 1 }).send("p:2", { dur: 1400 });
    d.packet({ tag: "OTLP", tone: "conduit", from: "checkout SDK", to: "Collector", protocol: cod === "protobuf" ? "OTLP/gRPC · protobuf" : "OTLP/HTTP · JSON", payload: `ExportTraceServiceRequest · ${papel.length} span fields`, bytes: total });
    d.glow("collector", 1).ping("collector").wait(500);
  });
  capitulo += 1;
  f.chapter({ id: "read", title: "the Collector reads and batches", body: "The otlp receiver reads the request back into spans — by field number, with the same schema. Another app's span arrives, and the batch processor puts both in one request.", detail: escrever("Collector", "reads + batches", `checkout's span + payments' span → 1 batch`, "conduit") }, (d) => {
    d.show(["payments", "f:pay"], { dur: 400 });
    d.show("p:pay", { dur: 1 }).send("p:pay", { dur: 1200 });
    d.packet({ tag: "OTLP", tone: "kind-3", from: "payments SDK", to: "Collector", protocol: cod === "protobuf" ? "OTLP/gRPC · protobuf" : "OTLP/HTTP · JSON", payload: "POST /pay" });
    d.glow("collector", 1).ping("collector").wait(700);
  });
  capitulo += 1;
  f.chapter({ id: "store", title: "the backend stores the trace", body: "The batch reaches the backend. It stores the spans and joins them into a trace by trace_id — the same 16 bytes the SDK wrote at the start.", detail: escrever("backend", "stores", `2 spans · joined by trace_id ${span.traceId.slice(0, 8)}…`, "container") }, (d) => {
    d.glow("collector", 0, { dur: 200 });
    d.show("p:3", { dur: 1 }).send("p:3", { dur: 1300 });
    d.packet({ tag: "BATCH", tone: "conduit", from: "Collector", to: "backend", protocol: "OTLP", payload: "2 spans" });
    d.glow("backend", 1).ping("backend").wait(1400);
  });
  return f.build();
}
