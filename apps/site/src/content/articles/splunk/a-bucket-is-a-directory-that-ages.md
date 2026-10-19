---
title: "A bucket is a directory that ages"
dek: "An index is not a database. It is a set of directories, each covering a slice of time, that move through four states on their way out — and how far back you can search is what is left over from your daily volume and four limits, a number that appears in no configuration file."
handbook: splunk
phase: 3
lab: labs/splunk-buckets
sources:
  - id: splunk-how-indexer-stores
    author: "Splunk Inc."
    year: "current"
    title: "How the indexer stores indexes"
    where: "Splunk Enterprise documentation"
    url: "https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/manage-index-storage/how-the-indexer-stores-indexes"
    note: "What a bucket is made of, and the sentence that makes the rest of the model make sense: buckets are sets of directories organised by age, each covering a limited time range."
  - id: splunk-configure-index-storage
    author: "Splunk Inc."
    year: "current"
    title: "Configure index storage"
    where: "Splunk Enterprise documentation"
    url: "https://help.splunk.com/en/data-management/manage-splunk-enterprise-indexers/9.3/manage-index-storage/configure-index-storage"
    note: "The four settings, their defaults, and which transition each one governs. Worth reading as a table of four different units — megabytes, a count, megabytes again, and seconds — because that mismatch is where the mistakes come from."
  - id: splunk-retirement-policy
    author: "Splunk Inc."
    year: "current"
    title: "Set a retirement and archiving policy"
    where: "Splunk Enterprise documentation"
    url: "https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/back-up-and-archive-your-indexes/set-a-retirement-and-archiving-policy"
    note: "The page that should be read before anybody promises a retention period. It states that either limit freezes data, that the size limit can get there first, and what freezing does to the data if you did not configure an archive."
  - id: splunk-restore-archived
    author: "Splunk Inc."
    year: "current"
    title: "Restore archived indexed data"
    where: "Splunk Enterprise documentation"
    url: "https://help.splunk.com/en/data-management/manage-splunk-enterprise-indexers/9.2/back-up-and-archive-your-indexes/restore-archived-indexed-data"
    note: "What an archived bucket contains, which is less than you might assume: only the raw data directory. The searchable part is rebuilt on restore, which is why the archive is small and why restoring is work."
---

An index looks like a database and is not one. It is a set of directories, each
holding a slice of time, and the slices are organised by age
([source](#src-splunk-how-indexer-stores)). That is the whole data structure.
Everything that is surprising about Splunk retention follows from it being
directories rather than rows.

## What is in one

Three kinds of thing, and the proportions explain both the compression and the
speed ([source](#src-splunk-how-indexer-stores)):

- the **raw data**, compressed, in a journal. This is your events, as text;
- the **index files** that point into that journal — the part that makes a
  search fast rather than a grep;
- some **metadata** files.

Two consequences worth holding. First, a search that only needs to find events
touches the index files and decompresses the slices of journal it actually
needs, which is why Splunk is fast on a term and slow on a regex over
everything. Second, the index files can be rebuilt from the journal — which is
why an archived bucket contains only the raw data directory
([source](#src-splunk-restore-archived)). The archive is small. Restoring is
work.

## The four states, and the four settings

A bucket is born **hot**, which means writable, and it is the only state that
is. Then it ages, in one direction, and each step is governed by a different
setting with a different unit ([source](#src-splunk-configure-index-storage)):

| transition | setting | real default | unit |
| --- | --- | --- | --- |
| hot → warm | `maxDataSize` | `auto`, which is 750 MB | megabytes |
| warm → cold | `maxWarmDBCount` | 300 | a **count** of buckets |
| the whole index | `maxTotalDataSizeMB` | 500000 | megabytes |
| any → frozen | `frozenTimePeriodInSecs` | 188697600, about six years | seconds |

Read that column of units again, because it is the source of most of the
trouble. Three of the four are about size, and only one of those three is about
how much the index holds. `maxDataSize` is granularity: how big one bucket gets
before it closes. `maxWarmDBCount` is a count, and moving a bucket from warm to
cold moves it to a different path — bucket sizes do not change as data moves
between states ([source](#src-splunk-configure-index-storage)).

Which means warm and cold are both *the index*. They are searchable, they count
against the index limit, and the words do not describe a hierarchy where data
gradually stops costing. Cold is not where data goes to stop counting. It is
where data waits to be frozen.

## The number nobody configured

Here is the sentence to take away, and it is the documentation's own: data
rolls to frozen when either limit is reached, and it will be rolled to frozen
before the configured time period has elapsed if the size limit is reached
first ([source](#src-splunk-retirement-policy)).

So with the real defaults — 500000 MB of index, about six years of retention —
and 20 GB a day on disk, your retention is about **25 days**. Not six years.
Twenty-five days, and the number 25 is written nowhere: it is a division, and
one of its two terms is your traffic.

(The [lab](../../../../labs/splunk-buckets/) measures 26 rather than 25, and the
difference is worth a sentence because it is real: what leaves the index is a
whole bucket, so the window lands on the next bucket boundary above the
division. It is always a little more than the quotient, never less.)

That is why this is the question that gets answered wrong in good faith. Ask
the team and they will tell you the number in `frozenTimePeriodInSecs`, because
that is the setting named after the thing you asked about. Nobody is lying.
There is simply no file in which the operative number is written down, and the
only way to know it is to ask the index — or to watch it, which is what the
[lab for this phase](../../../../labs/splunk-buckets/) is for: move the volume
slider and watch the window halve while every configured value stays exactly
where it was.

And note which way the error runs. Volume changes without anybody editing
anything: a new source type onboarded, a debug level left on after an incident,
one chatty release. None of those look like a retention change. All of them are
one.

> [!deeper]
>
> Two refinements that matter in practice, and both are about *when* rather than
> *how much*.
>
> **Age is per bucket, not per event.** The `indexes.conf` reference requires
> every event in the bucket to be older than the retention period before the
> bucket rolls ([source](#src-splunk-configure-index-storage)). A bucket covers
> a time range, and one recent event in it keeps the whole thing. So retention
> by age is always slightly *longer* than the number you configured — never
> shorter — and how much longer depends on how wide your buckets are, which is
> `maxDataSize`, which is the setting that looked like it had nothing to do with
> retention.
>
> **Freezing is deleting unless you said otherwise.** Freezing means the data is
> removed from the index, and it is written somewhere only if `coldToFrozenDir`
> or `coldToFrozenScript` is configured ([source](#src-splunk-retirement-policy)).
> If neither is, the bucket is deleted. This is the normal, documented,
> non-error behaviour, so nothing warns you — no log line, no counter, no
> difference in any dashboard between an index that archives and one that
> deletes. The two are distinguishable only by one line in a file, and by
> looking in the directory.
>
> The word is the problem. In English, *frozen* means preserved.

## What to do with this

Three questions, and the first one is the one that does not get asked:

1. **What is my actual window?** Not what is configured — what the index has.
   `index=<name> | stats min(_time)` answers it in one line, and the answer is
   the only one of the three that is a fact rather than an intention.
2. **Which limit is producing it?** If the answer is the size limit, then your
   retention is a function of your traffic, and it will change when traffic
   changes. If it is the age limit, your configuration is doing what it says —
   and that is the regime you want to be in when somebody asks for a promise.
3. **What happens to what leaves?** There are exactly two answers, and only one
   of them leaves a trace.
