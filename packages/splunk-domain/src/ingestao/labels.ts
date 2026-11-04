/**
 * Uma crença, o que a documentação diz, e o link. A mesma forma dos outros
 * handbooks — a tabela é a parte do lab que fala com quem já acredita na coisa
 * errada, e ela não existe sem a âncora.
 */
export interface MalEntendido {
  readonly crenca: string;
  readonly spec: string;
  readonly fonte: string;
  /** O id do nó do desenho a que a crença se refere. */
  readonly onde: string;
}

export const ROTULOS_DA_INGESTAO = {
  ingestao: "Parsing happens once, on the first component that can",
  app: "app · writes the log file",
  uf: "universal forwarder · input phase only",
  meio: "intermediate tier · the topology decision",
  idx: "indexer · parses only if nobody did",
  indice: "index · what a search can find",
} as const;

export const MAL_ENTENDIDOS_DA_INGESTAO: readonly MalEntendido[] = [
  {
    crenca: "The universal forwarder reads my props.conf, so that is where line breaking belongs.",
    spec:
      "The universal forwarder does not parse data except in a few limited situations, and " +
      "what it forwards is unparsed. Line breaking, line merging, timestamp extraction and " +
      "index-time field extraction all belong to the parsing phase, which runs on the first " +
      "component capable of it — an indexer or a heavy forwarder. The file installed on the " +
      "forwarder is syntactically valid, deploys cleanly, and changes nothing.",
    fonte: "https://docs.splunk.com/Documentation/Splunk/9.3.1/Forwarding/Typesofforwarders",
    onde: "uf",
  },
  {
    crenca: "Putting a heavy forwarder in the middle is just a hop. It cannot change my events.",
    spec:
      "It moves the parsing phase. Splunk's rule is that each configuration belongs on only " +
      "one component — the first in the deployment that handles that phase — so with a heavy " +
      "forwarder in the path, the input phase happens on the universal forwarders and the " +
      "parsing phase happens on the heavy forwarder. The indexer then receives parsed events " +
      "and the props.conf sitting on it has nothing left to break.",
    fonte:
      "https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.4/administer-splunk-enterprise-with-configuration-files/configuration-parameters-and-the-data-pipeline",
    onde: "meio",
  },
  {
    crenca: "An event is a line. Splunk figures the rest out.",
    spec:
      "The parsing phase is what decides where an event begins and ends: it breaks the stream " +
      "into lines, identifies and sets the timestamp, and transforms the data according to " +
      "regex rules. Before that phase runs, the concept of an event does not exist yet — " +
      "what travels is a 64K block annotated with host, source and sourcetype.",
    fonte: "https://docs.splunk.com/Documentation/Splunk/latest/Data/WhatSplunkdoeswithyourdata",
    onde: "idx",
  },
  {
    crenca: "If the events were broken wrong, something would say so.",
    spec:
      "Nothing does. A twelve-line stack trace indexed as twelve events is indistinguishable, " +
      "in the index, from twelve single-line log records: the index stores the events it was " +
      "given, each with its own timestamp and its own default fields. The cost shows up " +
      "twice, quietly — in the licence volume and in a search that returns the one line it " +
      "matched, with no stack under it.",
    fonte:
      "https://help.splunk.com/en/splunk-enterprise/get-started/get-data-in/9.4/configure-indexed-field-extraction/about-default-fields-host-source-sourcetype-and-more",
    onde: "indice",
  },
  {
    crenca: "A source type is a label for searching.",
    spec:
      "It is the handle the parsing phase uses: the source type identifies the data structure " +
      "of an event, and it determines how the platform formats the data during indexing. " +
      "Every line-breaking rule is attached to it, which is why data arriving with the wrong " +
      "source type is broken by the wrong rules — and is still, by every counter, ingested " +
      "successfully.",
    fonte: "https://docs.splunk.com/Splexicon:Sourcetype",
    onde: "uf",
  },
];
