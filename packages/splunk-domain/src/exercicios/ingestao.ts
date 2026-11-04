import type { DefinicaoDeExercicio } from "@ovh/handbook-format";

const INPUTS = "labs/splunk-ingest/uf/inputs.conf";
const OUTPUTS = "labs/splunk-ingest/uf/outputs.conf";
const PROPS = "labs/splunk-ingest/idx/props.conf";

const DOC_PIPELINE =
  "https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.4/administer-splunk-enterprise-with-configuration-files/configuration-parameters-and-the-data-pipeline";
const DOC_QUEBRA =
  "https://help.splunk.com/en/splunk-enterprise/get-started/get-data-in/9.4/configure-event-processing/configure-event-line-breaking";
const DOC_SOURCETYPE = "https://docs.splunk.com/Splexicon:Sourcetype";
const DOC_OUTPUTS = "https://docs.splunk.com/Documentation/Splunk/latest/Admin/Outputsconf";
const DOC_EVENT_BREAKER = "https://splunk.my.site.com/customer/s/article/EVENT-BREAKER";
const DOC_FORWARDERS =
  "https://docs.splunk.com/Documentation/Splunk/9.3.1/Forwarding/Typesofforwarders";

/**
 * Os exercícios da ingestão — e os três moram em arquivos de **duas máquinas**.
 *
 * Isso é a tese do lab transformada em exercício: dois dos três arquivos estão
 * no forwarder e um está no indexador, e o que vale em cada um é diferente. O
 * mesmo nome de arquivo (`props.conf`) existe nas duas máquinas carregando
 * configurações que não se aplicam na outra — e nenhum dos dois reclama quando
 * recebe a do vizinho.
 */
export const EXERCICIOS_DA_INGESTAO: readonly DefinicaoDeExercicio[] = [
  {
    id: "a-etiqueta-da-fonte",
    lab: "splunk-ingest",
    arquivo: INPUTS,
    trecho: "a-etiqueta-da-fonte",
    cenario:
      "The universal forwarder on the application host. This file is the input phase: it " +
      "opens the log file and annotates what it reads. The indexer has a props.conf with a " +
      "`[app:json]` stanza in it, holding the line breaking for this application.",
    pergunta: "What has to be on this line for that stanza to apply?",
    porqueCerto:
      "The source type, spelled exactly as the stanza that holds the rules. A source type is " +
      "not a search label: it identifies the data structure of an event and determines how " +
      "the platform formats the data during indexing, which means every line-breaking and " +
      "timestamp rule hangs from it. The parsing phase downstream looks up the stanza by " +
      "this string, finds it, and applies it.",
    fonteCerto: DOC_SOURCETYPE,
    distratores: [
      {
        id: "a-etiqueta-da-fonte-sublinhado",
        codigo: "sourcetype = app_json",
        porque:
          "One character apart from the right answer, and it is the version that gets typed " +
          "when the source type is invented twice — once by whoever writes the input and once " +
          "by whoever writes the parsing rules. Nothing matches `[app:json]` any more, so no " +
          "stanza applies and the defaults break the stack trace line by line. Every counter " +
          "stays green: the data arrived, it was indexed, it is searchable. It is just " +
          "searchable as twelve events.",
        fonte: DOC_PIPELINE,
      },
      {
        id: "a-etiqueta-da-fonte-syslog",
        codigo: "sourcetype = syslog",
        porque:
          "It reads as the safe, generic choice for a log file — and it is a real source type " +
          "with real rules attached, which is what makes it worse than a typo. The data is " +
          "now broken and timestamped by rules written for a different format, and the result " +
          "is plausible enough that nobody goes looking: events exist, times are set, fields " +
          "are extracted. They are just not this application's events.",
        fonte: DOC_SOURCETYPE,
      },
    ],
  },
  {
    id: "o-que-conta-como-entregue",
    lab: "splunk-ingest",
    arquivo: OUTPUTS,
    trecho: "o-que-conta-como-entregue",
    cenario:
      "The same forwarder, sending to one indexer. The indexer will be restarted tonight for " +
      "patching, and the application keeps writing throughout.",
    pergunta: "What makes the forwarder resend what did not land?",
    porqueCerto:
      "Indexer acknowledgment. Without it, “sent” means the socket accepted the bytes — and " +
      "the forwarder has already advanced its position in the file, so the block that was in " +
      "flight when the indexer went away does not exist anywhere else. With it, the forwarder " +
      "holds each block until the indexer confirms it, and resends anything unconfirmed. It " +
      "is `false` by default, which makes this the most consequential line in the file.",
    fonteCerto: DOC_OUTPUTS,
    distratores: [
      {
        id: "o-que-conta-como-entregue-fila",
        codigo: "maxQueueSize = 64MB",
        porque:
          "A bigger queue does help: the forwarder holds more while the receiver is away, so " +
          "a short outage stops being a loss. What it does not do is change what counts as " +
          "delivered. The queue is drained as soon as the socket takes the bytes, so a block " +
          "that was accepted and then lost on the other side is gone from the queue too — the " +
          "size of the buffer does not make anything confirm receipt.",
        fonte: DOC_OUTPUTS,
      },
      {
        id: "o-que-conta-como-entregue-batida",
        codigo: "heartbeatFrequency = 30",
        porque:
          "This is the setting that notices the indexer is gone, and noticing is genuinely " +
          "useful — it is what moves the stream to another receiver, when there is one. But " +
          "noticing is after the fact: the heartbeat tells the forwarder where to send the " +
          "*next* block, not what happened to the one it already let go of.",
        fonte: DOC_OUTPUTS,
      },
    ],
  },
  {
    id: "onde-um-evento-termina",
    lab: "splunk-ingest",
    arquivo: PROPS,
    trecho: "onde-um-evento-termina",
    cenario:
      "The indexer, which in this topology is the first component capable of parsing. The " +
      "application writes a twelve-line Java stack trace, every line of which starts with a " +
      "tab except the first — and the first starts with an ISO 8601 timestamp.",
    pergunta: "What decides that those twelve lines are one event?",
    porqueCerto:
      "`LINE_BREAKER`, and its semantics are three sentences in the documentation: the start " +
      "of the first capturing group is the end of the previous event, the end of the group is " +
      "the start of the next one, and the contents of the group are discarded. So the group " +
      "is `([\\r\\n]+)` — the newlines vanish — and the timestamp stays, because the lookahead " +
      "matches without consuming. The same page says to set `SHOULD_LINEMERGE = false` " +
      "alongside it, which the line above already does.",
    fonteCerto: DOC_QUEBRA,
    distratores: [
      {
        id: "onde-um-evento-termina-event-breaker",
        codigo:
          "EVENT_BREAKER_ENABLE = true\nEVENT_BREAKER = ([\\r\\n]+)(?=\\d{4}-\\d{2}-\\d{2}T)",
        porque:
          "The regex is identical to the right answer, and the setting is real — it is in this " +
          "lab, in `uf/props.conf`. It is also documented as valid only on universal " +
          "forwarder instances, and this file is on an indexer. What it does there is cut the " +
          "chunks leaving over the network at event boundaries so load balancing switches " +
          "between events instead of inside one; it does not decide how anything is indexed. " +
          "On this machine it parses, deploys and does nothing.",
        fonte: DOC_EVENT_BREAKER,
      },
      {
        id: "onde-um-evento-termina-linemerge",
        codigo: "BREAK_ONLY_BEFORE = ^\\d{4}-\\d{2}-\\d{2}T",
        porque:
          "This is the other mechanism, and on its own it works — it is the one that reads " +
          "most naturally, because it says what you mean. Two things are wrong with it here. " +
          "It needs `SHOULD_LINEMERGE = true`, and the line above this gap sets it to false, " +
          "so as written in this stanza it does nothing at all. And even corrected it is the " +
          "slow path: the documentation states that delimiting multi-line events with " +
          "`LINE_BREAKER` is significantly faster than reassembling them line by line, which " +
          "at ingestion volume is the difference between a parsing queue that keeps up and " +
          "one that does not.",
        fonte: DOC_QUEBRA,
      },
    ],
  },
];
