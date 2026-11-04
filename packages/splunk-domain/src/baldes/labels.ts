import type { MalEntendido } from "../ingestao/labels.js";

export const ROTULOS_DOS_BALDES = {
  baldes: "How far back you can search is not a setting",
  eventos: "indexed events · what the parsing phase produced",
  quente: "hot · the only writable buckets",
  morno: "warm · read-only, counted",
  frio: "cold · read-only, and the tier that gets evicted",
  congelado: "frozen · removed from the index",
} as const;

export const MAL_ENTENDIDOS_DOS_BALDES: readonly MalEntendido[] = [
  {
    crenca: "We keep 90 days, because that is what the retention setting says.",
    spec:
      "The retention setting is a maximum, not a promise. Data rolls to frozen when either " +
      "limit is reached, and the documentation states it directly: data will be rolled to " +
      "frozen before the configured time period has elapsed if the size limit is reached " +
      "first. The number of days you actually have is volume ÷ size limit, and it appears in " +
      "no configuration file.",
    fonte:
      "https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/back-up-and-archive-your-indexes/set-a-retirement-and-archiving-policy",
    onde: "frio",
  },
  {
    crenca: "Frozen data is archived. That is what frozen means.",
    spec:
      "Freezing means the data is removed from the index. Archiving happens only if " +
      "`coldToFrozenDir` or `coldToFrozenScript` is configured — and if neither is, the " +
      "bucket is deleted. Nothing warns you, because deletion is the normal behaviour.",
    fonte:
      "https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/back-up-and-archive-your-indexes/set-a-retirement-and-archiving-policy",
    onde: "congelado",
  },
  {
    crenca: "Moving buckets from warm to cold frees space.",
    spec:
      "It moves them to a different path, which is usually cheaper storage — and bucket " +
      "sizes do not change as data moves between states. `maxTotalDataSizeMB` is the limit " +
      "of the whole index, so cold is not somewhere data goes to stop counting. It is " +
      "where data waits to be frozen.",
    fonte:
      "https://help.splunk.com/en/data-management/manage-splunk-enterprise-indexers/9.3/manage-index-storage/configure-index-storage",
    onde: "morno",
  },
  {
    crenca: "Retention is per event, so yesterday's events leave tomorrow.",
    spec:
      "Age is tracked per bucket. The `indexes.conf` reference requires every event in a " +
      "bucket to be older than the retention period before the bucket rolls — so a single " +
      "recent event keeps the whole bucket, and the effective retention is always somewhat " +
      "longer than the number configured.",
    fonte:
      "https://help.splunk.com/en/data-management/manage-splunk-enterprise-indexers/9.3/manage-index-storage/configure-index-storage",
    onde: "frio",
  },
  {
    crenca: "A bucket is a file.",
    spec:
      "It is a directory, and what is in it explains both the compression and the search " +
      "speed: the compressed raw data journal, the index files that point into it, and some " +
      "metadata files. The index files can be rebuilt from the journal, which is why the " +
      "archived form of a bucket keeps only the raw data.",
    fonte:
      "https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/manage-index-storage/how-the-indexer-stores-indexes",
    onde: "quente",
  },
];
