---
title: "Parsing happens once, and you choose where"
dek: "The parsing phase turns a byte stream into events, and it runs on exactly one machine: the first one in your path capable of running it. Which machine that is depends on your topology, not on where you put the file — so the same correct configuration is effective or inert depending on a decision taken in somebody else's ticket."
handbook: splunk
phase: 2
lab: labs/splunk-ingest
sources:
  - id: splunk-pipeline-config
    author: "Splunk Inc."
    year: "current"
    title: "Configuration parameters and the data pipeline"
    where: "Splunk Enterprise admin manual"
    url: "https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.4/administer-splunk-enterprise-with-configuration-files/configuration-parameters-and-the-data-pipeline"
    note: "The page this whole article is about. The table maps settings to phases, and under it is the rule and the worked example: with universal forwarders feeding a heavy forwarder feeding an indexer, input happens on the forwarders and parsing happens on the heavy forwarder."
  - id: splunk-what-splunk-does
    author: "Splunk Inc."
    year: "current"
    title: "How Splunk Enterprise handles your data"
    where: "Splunk Enterprise documentation"
    url: "https://docs.splunk.com/Documentation/Splunk/latest/Data/WhatSplunkdoeswithyourdata"
    note: "What the parsing phase actually does, in one list: break the stream into lines, identify and set timestamps, annotate each event with the source-wide metadata, and transform the data according to regex rules."
  - id: splunk-line-breaking
    author: "Splunk Inc."
    year: "current"
    title: "Configure event line breaking"
    where: "Splunk Enterprise documentation"
    url: "https://help.splunk.com/en/splunk-enterprise/get-started/get-data-in/9.4/configure-event-processing/configure-event-line-breaking"
    note: "The semantics of LINE_BREAKER in three sentences — where the previous event ends, where the next one starts, and what is discarded — plus the reason to prefer it over line merging, which is speed at ingestion volume."
  - id: splunk-types-of-forwarders
    author: "Splunk Inc."
    year: "current"
    title: "Types of forwarders"
    where: "Splunk Enterprise documentation"
    url: "https://docs.splunk.com/Documentation/Splunk/9.3.1/Forwarding/Typesofforwarders"
    note: "A heavy forwarder parses data before forwarding it, and can route on what it finds. This is the capability that, once present in a path, moves the phase."
  - id: splunk-index-time-fields
    author: "Splunk Inc."
    year: "current"
    title: "Create custom fields at index time"
    where: "Splunk Enterprise documentation"
    url: "https://help.splunk.com/en/splunk-enterprise/get-started/get-data-in/10.6/configure-indexed-field-extraction/create-custom-fields-at-index-time"
    note: "Read it for its warnings rather than its instructions: each indexed field enlarges the index and costs performance, and you cannot change fields on data that is already indexed."
  - id: splunk-search-time-fields
    author: "Splunk Inc."
    year: "current"
    title: "Configure custom fields at search time"
    where: "Splunk knowledge management manual"
    url: "https://help.splunk.com/en/splunk-enterprise/manage-knowledge-objects/knowledge-management-manual/9.4/use-the-configuration-files-to-configure-field-extractions/configure-custom-fields-at-search-time"
    note: "The other half of the same decision, and the sentence that should settle most arguments about it: you should generally extract fields at search time."
  - id: splunk-splexicon-indexed-field
    author: "Splunk Inc."
    year: "current"
    title: "Splexicon: indexed field"
    where: "Splunk documentation glossary"
    url: "https://docs.splunk.com/Splexicon:Indexedfield"
    note: "What is in the index by default, and what adding to it costs. Useful for seeing that the default fields are themselves index-time decisions — you are never choosing whether to have them, only whether to have more."
---

The parsing phase is where a byte stream becomes events. It breaks the stream
into lines, identifies and sets the timestamp of each event, annotates each one
with the metadata that belonged to the whole source, and transforms the data
according to regex rules ([source](#src-splunk-what-splunk-does)). Everything
you think of as "Splunk understanding my data" is this phase.

It runs **once**. Not once per machine, not once per tier: once, on the first
component in the deployment that is capable of it
([source](#src-splunk-pipeline-config)). Everything downstream of that
component receives events, and treats them as already decided.

## Why that is a stronger statement than it looks

The rule is usually read as an optimisation — don't do the work twice, fair
enough. It is not an optimisation. It is the reason a correct configuration can
be inert.

A universal forwarder cannot parse. A heavy forwarder can
([source](#src-splunk-types-of-forwarders)). An indexer can. So "the first
component capable of it" is a fact about your **path**, and the path is not
described anywhere in the file you are editing:

| your path | parsing runs on | so `props.conf` has to be on |
| --- | --- | --- |
| forwarder → indexer | the indexer | the indexer |
| forwarder → intermediate universal forwarder → indexer | the indexer | the indexer |
| forwarder → heavy forwarder → indexer | the heavy forwarder | the heavy forwarder |

The third row is the one that bites, and the documentation spells it out with
that exact topology: with universal forwarders feeding a heavy forwarder
feeding an indexer, the input phase occurs on the universal forwarders and the
parsing phase occurs on the heavy forwarder
([source](#src-splunk-pipeline-config)).

Nothing about that row is a misconfiguration. Somebody added a heavy forwarder
to terminate TLS, or to route to two destinations, or because the DMZ cannot
reach the indexing tier. It was a good decision, taken by someone who had no
reason to think about line breaking. Your `props.conf` is still on the indexers,
still correct, still deployed, and now has nothing left to act on — because the
events arriving have already been broken, by default rules, into one event per
line.

The [lab for this phase](../../../../labs/splunk-ingest/) is three machines and
a switch: put the file in each of the three places, with and without the heavy
forwarder, and six combinations resolve to two that work.

## What the phase decides, and the cost of each decision

Three things happen here, and they differ in how expensive they are to get
wrong.

**Where events begin and end.** `LINE_BREAKER`, with
`SHOULD_LINEMERGE = false` alongside it. The semantics are worth memorising
because they explain every surprising result: the start of the first capturing
group is the end of the previous event, the end of that group is the start of
the next one, and the contents of the group are discarded
([source](#src-splunk-line-breaking)). That is why the idiomatic pattern puts
`([\r\n]+)` in the group and the timestamp outside it — the newlines vanish and
the timestamp stays. The same page explains why this is preferred over
reassembling lines after the fact: it is significantly faster, which at
ingestion volume is the difference between a parsing queue that keeps up and
one that does not.

**When the event happened.** Timestamp recognition, and it is the one failure
that hides best, because a wrong timestamp does not produce a wrong event — it
produces a correct event filed under the wrong time. Nobody finds it by looking
at the data. They find it by searching the last 15 minutes during an incident
and seeing nothing.

**Which fields are written into the index.** This is the expensive one, and
Splunk's own position is unambiguous: you should generally extract fields at
search time ([source](#src-splunk-search-time-fields)). Index-time extraction
is a `TRANSFORMS-` in `props.conf` on the parsing tier, every indexed field
enlarges the index and costs performance across the deployment, and — the part
that makes it a different kind of decision from everything else in Splunk — you
cannot change fields on data that is already indexed
([source](#src-splunk-index-time-fields)).

> [!deeper]
>
> That last sentence is the real line between the two halves of Splunk, and it
> is worth stating as a property rather than as a caveat.
>
> **Everything decided at parsing time is written to disk and is permanent for
> that data.** How the events were broken, what time they carry, which fields
> were indexed. Changing the configuration changes what happens to data that
> arrives *afterwards*; the events already on disk keep the decisions that were
> in force when they were written. Fixing them means re-ingesting them, which
> means still having the original files.
>
> **Everything decided at search time is a knowledge object, and it is
> reversible.** A field extraction that turns out to be wrong is edited, and the
> next search is right — including searches over data indexed years ago, because
> the extraction is applied when the search runs, not when the data landed.
>
> This is why the default is search time, and why the exceptions are narrow.
> The question to ask is not "which is faster" — it is "what do I pay if this
> turns out to be wrong in six months". At search time you pay an edit. At index
> time you pay a re-ingestion you may not be able to perform.
>
> Note that you are never fully outside this: the default fields — host, source,
> source type, index, `_time` — are themselves index-time decisions, written
> into every event ([source](#src-splunk-splexicon-indexed-field)). The choice
> is not whether to have indexed fields. It is whether to have more of them.

## What to do with this

When something about your events is wrong — wrong boundaries, wrong time, a
missing field — the instinct is to find the setting. Find the machine first.

1. **What phase is this setting?** One page answers it
   ([source](#src-splunk-pipeline-config)).
2. **What is the first component in this data's path capable of that phase?**
   Not the first component: the first *capable* one.
3. **Is the file on that machine?**

And then the question that has no good answer, which is why it is worth asking
early: **if someone changes the path, who finds out that this file moved?**
