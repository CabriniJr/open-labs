import { formatTraceparent, parseTraceparent, type TraceContext } from "../traceparent.js";
import { formatBaggage, parseBaggage, type Baggage } from "./baggage.js";

/**
 * Propagação de contexto, salto por salto.
 *
 * Um caminho fixo de requisições — navegador, gateway, checkout, e daí um
 * leque para o estoque e, por um proxy, para pagamentos. Cada serviço
 * instrumentado faz as três coisas que um propagador faz: **extrai** o
 * contexto dos headers que chegaram, **cria** um span filho dele (ou uma raiz,
 * se não chegou contexto nenhum) e **injeta** o contexto novo nos headers que
 * saem. O proxy não é instrumentado: ele repassa os headers como vieram, ou os
 * descarta, e não cria span nenhum.
 *
 * Tudo aqui é determinístico: os ids saem de um gerador semeado, então a mesma
 * escolha dá a mesma história — e o filme do lab pode ser recalculado quando o
 * leitor muda uma opção, sem que os ids pulem na tela.
 */
export type Servico = "browser" | "gateway" | "checkout" | "inventory" | "proxy" | "payments";

export interface OpcoesDePropagacao {
  /** O proxy repassa `traceparent` e `baggage`? */
  readonly proxyRepassa: boolean;
  /** A decisão do amostrador na raiz. Os filhos a herdam pelo flag. */
  readonly amostrado: boolean;
  readonly baggage: Baggage;
  readonly semente?: number;
}

export const OPCOES_PADRAO: OpcoesDePropagacao = {
  proxyRepassa: true,
  amostrado: true,
  baggage: { "user.tier": "gold" },
};

export interface SpanGerado {
  readonly servico: Servico;
  readonly nome: string;
  readonly traceId: string;
  readonly spanId: string;
  /** `null` é raiz. */
  readonly parentId: string | null;
  readonly amostrado: boolean;
  /** O que o serviço leu do baggage que chegou. */
  readonly baggage: Baggage;
}

export interface Chamada {
  readonly de: Servico;
  readonly para: Servico;
  readonly rota: string;
  /** Os headers como chegaram em `para`. */
  readonly headers: Readonly<Record<string, string>>;
  /** O contexto que `para` conseguiu extrair, ou `null`. */
  readonly extraido: TraceContext | null;
  /** O span que `para` criou ao receber; `null` se `para` não é instrumentado. */
  readonly span: SpanGerado | null;
}

export interface Propagacao {
  readonly raiz: SpanGerado;
  readonly chamadas: readonly Chamada[];
  readonly spans: readonly SpanGerado[];
  /** Spans agrupados por trace, na ordem em que cada trace nasceu. */
  readonly traces: readonly { readonly traceId: string; readonly spans: readonly SpanGerado[] }[];
}

export const INSTRUMENTADOS: ReadonlySet<Servico> = new Set(["browser", "gateway", "checkout", "inventory", "payments"]);

const NOMES: Record<Servico, string> = {
  browser: "click checkout",
  gateway: "POST /checkout",
  checkout: "PlaceOrder",
  inventory: "ReserveStock",
  proxy: "",
  payments: "Charge",
};

/** O caminho das requisições, na ordem em que acontecem. */
export const CAMINHO: readonly { readonly de: Servico; readonly para: Servico; readonly rota: string }[] = [
  { de: "browser", para: "gateway", rota: "POST /checkout" },
  { de: "gateway", para: "checkout", rota: "POST /orders" },
  { de: "checkout", para: "inventory", rota: "POST /reserve" },
  { de: "checkout", para: "proxy", rota: "POST /charge" },
  { de: "proxy", para: "payments", rota: "POST /charge" },
];

function gerador(semente: number) {
  let s = semente >>> 0 || 1;
  const nibble = () => {
    // xorshift32: pequeno, determinístico e suficiente para ids de exemplo.
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s & 0xf).toString(16);
  };
  return (digitos: number) => {
    let out = "";
    while (out.length < digitos) out += nibble();
    return /^0+$/.test(out) ? `${out.slice(0, -1)}1` : out;
  };
}

export function propagar(opcoes: OpcoesDePropagacao = OPCOES_PADRAO): Propagacao {
  const hex = gerador(opcoes.semente ?? 0x5eed);
  const spans: SpanGerado[] = [];
  const contexto = new Map<Servico, { span: SpanGerado | null; headers: Record<string, string> }>();

  const criar = (servico: Servico, pai: TraceContext | null, baggage: Baggage): SpanGerado => {
    const span: SpanGerado = {
      servico,
      nome: NOMES[servico],
      traceId: pai?.traceId ?? hex(32),
      spanId: hex(16),
      parentId: pai?.spanId ?? null,
      // ParentBased: com pai, herda o flag; sem pai, a raiz decide.
      amostrado: pai?.sampled ?? opcoes.amostrado,
      baggage,
    };
    spans.push(span);
    return span;
  };

  const injetar = (span: SpanGerado): Record<string, string> => {
    const headers: Record<string, string> = {
      traceparent: formatTraceparent({ traceId: span.traceId, spanId: span.spanId, sampled: span.amostrado }),
    };
    if (Object.keys(span.baggage).length > 0) headers.baggage = formatBaggage(span.baggage);
    return headers;
  };

  const raiz = criar("browser", null, opcoes.baggage);
  contexto.set("browser", { span: raiz, headers: injetar(raiz) });

  const chamadas: Chamada[] = [];
  for (const { de, para, rota } of CAMINHO) {
    const origem = contexto.get(de);
    if (origem === undefined) throw new Error(`${de} sends before it received anything.`);
    const headers = origem.headers;
    if (!INSTRUMENTADOS.has(para)) {
      // Sem SDK: nenhum span, e os headers seguem como o proxy quiser.
      contexto.set(para, { span: null, headers: opcoes.proxyRepassa ? { ...headers } : {} });
      chamadas.push({ de, para, rota, headers, extraido: parseTraceparent(headers.traceparent ?? ""), span: null });
      continue;
    }
    const extraido = headers.traceparent === undefined ? null : parseTraceparent(headers.traceparent);
    const span = criar(para, extraido, parseBaggage(headers.baggage));
    contexto.set(para, { span, headers: injetar(span) });
    chamadas.push({ de, para, rota, headers, extraido, span });
  }

  const traces: { traceId: string; spans: SpanGerado[] }[] = [];
  for (const span of spans) {
    const trace = traces.find((t) => t.traceId === span.traceId);
    if (trace === undefined) traces.push({ traceId: span.traceId, spans: [span] });
    else trace.spans.push(span);
  }
  return { raiz, chamadas, spans, traces };
}
