import type { DefinicaoDeExercicio } from "@ovh/handbook-format";

const INDEXES = "labs/splunk-buckets/idx/indexes.conf";

const DOC_RETENCAO =
  "https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/back-up-and-archive-your-indexes/set-a-retirement-and-archiving-policy";
const DOC_ARMAZENAMENTO =
  "https://help.splunk.com/en/data-management/manage-splunk-enterprise-indexers/9.3/manage-index-storage/configure-index-storage";
const DOC_BALDES =
  "https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/manage-index-storage/how-the-indexer-stores-indexes";

/**
 * Os exercícios dos baldes — e os três moram no MESMO arquivo.
 *
 * O contrário do lab da fase 2 de propósito, e pela mesma razão pedagógica: ali
 * a lição era que o mesmo nome de arquivo significa coisas diferentes em
 * máquinas diferentes; aqui é que quatro limites na mesma estrofe governam
 * coisas diferentes, e escolher o errado é a forma mais comum de perder dado
 * em Splunk. Não há máquina errada aqui. Há limite errado.
 */
export const EXERCICIOS_DOS_BALDES: readonly DefinicaoDeExercicio[] = [
  {
    id: "o-limite-que-decide",
    lab: "splunk-buckets",
    arquivo: INDEXES,
    trecho: "o-limite-que-decide",
    cenario:
      "This index receives about 20 GB on disk per day and the disk has 400 GB for it. The " +
      "team agreed on “we keep 30 days”, and the line below this gap already says 30 days.",
    pergunta: "What is the line that will actually decide how far back you can search?",
    porqueCerto:
      "The size of the whole index. Data rolls to frozen when either limit is reached, and " +
      "the documentation is explicit that it will be rolled to frozen before the configured " +
      "time period has elapsed if the size limit is reached first. With this volume and this " +
      "number, the window is 400 GB ÷ 20 GB per day — and the retention everyone agreed " +
      "on is the limit that never gets reached.",
    fonteCerto: DOC_RETENCAO,
    distratores: [
      {
        id: "o-limite-que-decide-contagem",
        codigo: "maxWarmDBCount = 300",
        porque:
          "It is a real limit on a real tier, and raising it does change where data sits — so " +
          "it feels like a retention knob. It is not one: it governs the warm-to-cold " +
          "transition, which moves buckets to a different path without changing their size. " +
          "Bucket sizes do not change as data moves between states, and the index-wide " +
          "limit counts them wherever they are. Cold is not somewhere data goes to stop " +
          "counting; it is where data waits to be frozen.",
        fonte: DOC_ARMAZENAMENTO,
      },
      {
        id: "o-limite-que-decide-balde",
        codigo: "maxDataSize = auto",
        porque:
          "This is the setting whose default is the special value `auto` — 750 MB — and it " +
          "is the one people reach for because it is the only one with “size” in the name " +
          "that they recognise. It decides when one hot bucket closes, which is the " +
          "granularity of everything else: how much data leaves at once when something is " +
          "frozen, and how big a file a search has to open. It does not decide how much the " +
          "index holds.",
        fonte: DOC_ARMAZENAMENTO,
      },
    ],
  },
  {
    id: "o-tempo-que-eu-quis",
    lab: "splunk-buckets",
    arquivo: INDEXES,
    trecho: "o-tempo-que-eu-quis",
    cenario:
      "A compliance requirement: this index must hold 30 days and must not hold more. The " +
      "disk is large enough for about 90 days at the current volume.",
    pergunta: "What expresses “thirty days, and then gone”?",
    porqueCerto:
      "The age limit, in seconds — 2 592 000 of them. When you mean time, say time: this is " +
      "the only one of the four limits that is about the clock, and it is the only one that " +
      "keeps meaning 30 days when the volume doubles. Note that it is measured per bucket " +
      "and every event in the bucket has to be older than the period before it rolls, so " +
      "the effective retention is always slightly longer than the number — never shorter.",
    fonteCerto: DOC_RETENCAO,
    distratores: [
      {
        id: "o-tempo-que-eu-quis-por-tamanho",
        codigo: "maxTotalDataSizeMB = 614400",
        porque:
          "Thirty days of this index's volume, computed honestly, and today it is correct — " +
          "which is what makes it the most expensive answer on this page. It encodes an " +
          "assumption about volume into a limit about size, and volume is the one thing in " +
          "this list that changes without anybody editing a file: a new source type, a " +
          "debug level left on, a traffic peak. The day the volume doubles, this index " +
          "silently holds fifteen days, and the compliance requirement is still written " +
          "down somewhere as satisfied.",
        fonte: DOC_RETENCAO,
      },
      {
        id: "o-tempo-que-eu-quis-janela-do-quente",
        codigo: "maxHotSpanSecs = 2592000",
        porque:
          "It carries the right number and a plausible name, and it is about time — three " +
          "reasons to pick it. What it bounds is how long a single hot bucket may span " +
          "before it rolls to warm, which is a bound on bucket shape, not on how long data " +
          "stays. Everything it rolls is still in the index, searchable, counting against " +
          "the size limit. Nothing leaves.",
        fonte: DOC_ARMAZENAMENTO,
      },
    ],
  },
  {
    id: "o-que-acontece-com-o-congelado",
    lab: "splunk-buckets",
    arquivo: INDEXES,
    trecho: "o-que-acontece-com-o-congelado",
    cenario:
      "Same index, and an auditor who may ask for events from eight months ago — which is " +
      "longer than this index keeps them.",
    pergunta: "What line keeps the data that leaves the index?",
    porqueCerto:
      "A directory for the frozen buckets. Freezing means the data is removed from the " +
      "index, and that is the default behaviour rather than an error condition — so without " +
      "this line, or `coldToFrozenScript`, the bucket is deleted and nothing reports it. " +
      "What is written there is the raw data, which is enough: the index files can be " +
      "rebuilt from the journal, which is why the archived form of a bucket keeps only that.",
    fonteCerto: DOC_RETENCAO,
    distratores: [
      {
        id: "o-que-acontece-com-o-congelado-thawed",
        codigo: "thawedPath = $SPLUNK_DB/openlabs/thaweddb",
        porque:
          "This one is already in the file above, it is required for every index, and its " +
          "name is the English word for bringing something back from frozen — so it reads " +
          "exactly like the answer. It is the path where a bucket you restore is *placed*. " +
          "It is the destination of a recovery, not the thing that makes recovery possible: " +
          "declaring it archives nothing, and an index with a perfectly good `thawedPath` " +
          "and no `coldToFrozenDir` deletes everything it freezes.",
        fonte: DOC_ARMAZENAMENTO,
      },
      {
        id: "o-que-acontece-com-o-congelado-cold",
        codigo: "coldPath = /mnt/cheap-storage/openlabs/colddb",
        porque:
          "Pointing cold at cheaper storage is a good idea and a common one, and it does " +
          "let you afford a bigger index — which is why it feels like the answer to “keep " +
          "it longer”. But cold is still the index: those buckets are searchable, they " +
          "count against the size limit, and they are the ones that get frozen next. " +
          "Moving them somewhere cheaper changes what you pay per gigabyte, not what " +
          "happens at the end.",
        fonte: DOC_BALDES,
      },
    ],
  },
];
