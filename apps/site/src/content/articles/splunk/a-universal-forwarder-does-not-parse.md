---
title: "A universal forwarder does not parse"
dek: "The machine that reads your log file is the one machine in the path that does not understand it. It cuts the stream into 64K blocks, tags each block with where it came from, and forwards — so every setting about what an event is has no effect there, and the ones that do have effect are a different, shorter list."
handbook: splunk
phase: 1
sources:
  - id: splunk-types-of-forwarders
    author: "Splunk Inc."
    year: "current"
    title: "Types of forwarders"
    where: "Splunk Enterprise documentation"
    url: "https://docs.splunk.com/Documentation/Splunk/9.3.1/Forwarding/Typesofforwarders"
    note: "The two forwarders side by side. Read it for what the universal forwarder is said not to do, which is the half that gets skipped: it does not parse data except in certain limited situations, and what it forwards is unparsed."
  - id: splunk-splexicon-uf
    author: "Splunk Inc."
    year: "current"
    title: "Splexicon: universal forwarder"
    where: "Splunk documentation glossary"
    url: "https://docs.splunk.com/Splexicon:Universalforwarder"
    note: "Four sentences, and one of them is the whole of this article: its main limitation is that it forwards only unparsed data. The glossary is worth more than its size here, because this is the sentence nobody quotes."
  - id: splunk-what-splunk-does
    author: "Splunk Inc."
    year: "current"
    title: "How Splunk Enterprise handles your data"
    where: "Splunk Enterprise documentation"
    url: "https://docs.splunk.com/Documentation/Splunk/latest/Data/WhatSplunkdoeswithyourdata"
    note: "The four phases, and the only page that says what the input phase physically produces: 64K blocks, each annotated with metadata keys including host, source and source type. Before parsing runs, there is no event."
  - id: splunk-pipeline-config
    author: "Splunk Inc."
    year: "current"
    title: "Configuration parameters and the data pipeline"
    where: "Splunk Enterprise admin manual"
    url: "https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.4/administer-splunk-enterprise-with-configuration-files/configuration-parameters-and-the-data-pipeline"
    note: "The table that maps every setting to the phase it belongs to, and the rule under it: each configuration belongs on only one component, the first in the deployment that handles that phase. Most Splunk configuration mistakes are one line of this page."
  - id: splunk-event-breaker
    author: "Splunk Inc."
    year: "current"
    title: "Use EVENT_BREAKER on Universal Forwarder for better data distribution across indexers"
    where: "Splunk support knowledge base"
    url: "https://splunk.my.site.com/customer/s/article/EVENT-BREAKER"
    note: "The one line-related setting that is valid on a universal forwarder, and why it exists: not to decide what an event is, but to let load balancing switch receivers at the end of one."
  - id: splunk-splexicon-sourcetype
    author: "Splunk Inc."
    year: "current"
    title: "Splexicon: source type"
    where: "Splunk documentation glossary"
    url: "https://docs.splunk.com/Splexicon:Sourcetype"
    note: "Short, and it corrects the common reading: a source type identifies the data structure of an event and determines how the platform formats the data during indexing. It is not a search label."
  - id: splunk-outputs-conf
    author: "Splunk Inc."
    year: "current"
    title: "outputs.conf"
    where: "Splunk Enterprise configuration file reference"
    url: "https://docs.splunk.com/Documentation/Splunk/latest/Admin/Outputsconf"
    note: "Where the forwarder's side of delivery is defined. Look up useAck and note the default, which is the kind of default that decides what happens to your data during a restart you planned."
  - id: splunk-intermediate-routing
    author: "Splunk Inc."
    year: "current"
    title: "Intermediate data routing using universal and heavy forwarders"
    where: "Splunk Validated Architectures"
    url: "https://help.splunk.com/en/splunk-cloud-platform/splunk-validated-architectures/getting-data-in-forwarding-and-preprocessing/intermediate-data-routing-using-universal-and-heavy-forwarders"
    note: "The page to read before putting anything in the middle of the path, because it treats the intermediate tier as a decision with costs rather than as a hop."
---

A universal forwarder is the piece of Splunk that most people picture as the
one doing the work. It sits on the machine that produces the data, it reads the
file, it knows the path and the hostname, and it is the thing you install when
somebody says "get this into Splunk". So it feels like the place where the data
is understood.

It is the one component in the path that understands nothing about it.

## What it actually does

The Splunk pipeline has four phases — input, parsing, indexing, search — and a
universal forwarder runs the first one and stops. The input phase is physical
rather than semantic: the raw stream is broken into 64K blocks, and each block
is annotated with metadata keys, including the host, the source and the source
type ([source](#src-splunk-what-splunk-does)). That is the output. Blocks, with
labels on them.

The documentation says the rest plainly, and in the glossary rather than
anywhere prominent: the universal forwarder's main limitation is that it
forwards only unparsed data ([source](#src-splunk-splexicon-uf)). The longer
page puts it as a behaviour instead of a limit — it does not parse data except
in certain limited situations, the main exception being structured data such as
CSV ([source](#src-splunk-types-of-forwarders)).

Nothing in that list decides where an event begins. At the moment the data
leaves this machine, the concept of an event does not exist yet.

## What follows, and it follows mechanically

If the forwarder does not parse, then no setting about parsing can take effect
on it. `LINE_BREAKER`, `SHOULD_LINEMERGE`, `TIME_PREFIX`, `TRANSFORMS-` for
index-time fields: all of them belong to the parsing phase, and the rule for
where a phase's configuration goes is one sentence — each configuration belongs
on only one component, the first one in the deployment that handles that phase
([source](#src-splunk-pipeline-config)).

So a `props.conf` with a correct `LINE_BREAKER`, deployed to a universal
forwarder by a deployment server that reports success, applied to a source type
that matches, on a machine that is ingesting perfectly, does nothing. There is
no warning. There is no error. There is no counter anywhere that distinguishes
this from a working configuration, because from every other point of view it
*is* a working configuration — the data arrives, it is indexed, it is
searchable. It is just searchable as twelve events instead of one.

The [lab of the next phase](../../../../labs/splunk-ingest/) is that sentence,
running: move the file between three machines and watch the stack trace split
and reassemble while every other number on the screen stays the same.

## The shorter list: what *is* yours on this machine

Three things, and they are worth knowing precisely, because the instinct after
learning the above is to decide the forwarder holds nothing.

**The source type.** It is assigned at input, in `inputs.conf`, and it is the
handle every later rule hangs from: a source type identifies the data structure
of an event and determines how the platform formats the data during indexing
([source](#src-splunk-splexicon-sourcetype)). The parsing phase downstream looks
up its rules by this string. Getting it wrong on the forwarder is not a labelling
mistake — it is handing the right data to the wrong rule set, three machines
away, with no error anywhere.

**`EVENT_BREAKER`.** The exception that proves the shape of the rule. It is a
line-matching setting, it lives in `props.conf`, and it is valid only on
universal forwarder instances — but what it does is not decide what an event is
for indexing. It lets the forwarder cut the chunks it sends at event boundaries,
so that load balancing switches to another receiver at the end of an event
instead of in the middle of one ([source](#src-splunk-event-breaker)). It is
about the network, not about meaning.

**What counts as delivered.** `useAck` in `outputs.conf`, and it is `false` by
default ([source](#src-splunk-outputs-conf)). Without it, "sent" means the
socket accepted the bytes and the forwarder has already moved on in the file.
With it, the forwarder holds each block until the indexer confirms it. This is
the forwarder's own business and nobody else's, and it is the setting that
decides whether a planned restart of an indexer is invisible or is a gap in
your data.

> [!deeper]
>
> The usual next step is an intermediate tier — a forwarder between the hosts
> and the indexers, for network reasons: one hole in a firewall instead of
> hundreds, or a DMZ that may not reach the indexing tier. It is a reasonable
> thing to want, and Splunk documents it as a decision with costs rather than as
> a hop ([source](#src-splunk-intermediate-routing)).
>
> What matters here is which kind you put there, and it is not a performance
> question. An **intermediate universal forwarder** passes blocks through and
> changes nothing about where the parsing phase runs. A **heavy forwarder** is a
> full Splunk Enterprise instance, it parses, and therefore it *takes the
> parsing phase with it* — the indexers downstream then receive events that are
> already broken, and do not re-parse them.
>
> That is why a ticket about network topology can break line breaking that has
> worked for two years, in a file nobody opened, on a machine nobody logged
> into. The phase moved.

## The useful way to hold this

Not as a list of which setting goes where — that list is long and you will look
it up anyway. As a question you ask before touching any Splunk configuration
file:

**Which phase does this setting belong to, and which machine in my path is the
first one that runs that phase?**

The answer to the first half is on one page ([source](#src-splunk-pipeline-config)).
The answer to the second half is your topology, which is the part that changes
without telling you.
