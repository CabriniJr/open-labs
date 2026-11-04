# Where parsing happens, against real Splunk

This directory is the counterpart of
[`labs/splunk-ingest/`](../../apps/site/src/pages/labs/splunk-ingest.astro) on
the site: one application writing a log file, one universal forwarder, one
indexer, and — behind a profile — a heavy forwarder in the middle. The lab on
screen makes one claim, and it is a claim about these files rather than about a
simulator:

> The parsing phase runs **once**, on the first component in the deployment
> that is capable of it. A `props.conf` is correct or inert depending on which
> machine it is installed on, and which machine that is depends on a topology
> decision usually taken by somebody else.

```
docker compose up                     # parsing happens on the indexer
docker compose --profile heavy up     # parsing happens on the heavy forwarder
```

Then, in Splunk Web at <http://localhost:8000>:

```
index=main sourcetype=app:json "NullPointerException"
```

## The experiment

The application writes a twelve-line Java stack trace every twentieth record.
That record is the whole experiment: the other nineteen are single lines, which
the default line breaking gets right *by accident*. This is why this defect
reaches production unnoticed — it only shows up on the day of the exception.

**1. Parsing on the indexer, line breaking on the indexer.** The default. The
search above returns **one** event, twelve lines long, with the exception at
the top and the frames under it.

**2. Move the file to the forwarder.** Copy the `LINE_BREAKER` stanza from
`idx/props.conf` into `uf/props.conf` and remove it from the indexer. Restart.
Nothing warns you, nothing fails, the data keeps arriving — and the search
returns **twelve** events, each one line long. The universal forwarder does not
parse data; what it forwards is unparsed, so the setting has nothing to act on.

**3. Put the file back, and add a heavy forwarder instead.**

```
docker compose --profile heavy up
```

`idx/props.conf` is untouched and still correct. The stack trace is twelve
events again, because the parsing phase moved: with a heavy forwarder in the
path, the input phase happens on the universal forwarder and the parsing phase
happens on the heavy forwarder. The indexer receives parsed events and does not
re-parse them. `hf/props.conf` is the same file, in the place where it now has
to be — empty its stanza and watch the twelve come back.

## What each file is for

| file | phase it belongs to | what it does here |
| --- | --- | --- |
| `uf/inputs.conf` | input | opens the file, sets `index` and `sourcetype` |
| `uf/outputs.conf` | — | where to send, and what counts as delivered (`useACK`) |
| `uf/props.conf` | input | `EVENT_BREAKER`, which is valid **only** on a universal forwarder |
| `idx/inputs.conf` | input | makes port 9997 exist at all |
| `idx/props.conf` | parsing | `LINE_BREAKER`: where an event begins and ends |
| `hf/props.conf` | parsing | the same file, on the machine the phase moved to |

## What is verified, and what is not

This repository's rule is that a counterpart is the thing that makes a claim
checkable against a binary instead of a simulation. Being precise about how far
that went here:

- **verified:** every setting in these files was read against the current
  Splunk documentation, and each one is linked from the comment above it —
  `LINE_BREAKER` semantics against the event line breaking page, the phase
  table against the configuration-parameters page, `EVENT_BREAKER` being
  universal-forwarder-only against Splunk's own article on it, `useACK`'s
  default against `outputs.conf`. The compose file parses, and the log producer
  passes `sh -n`;
- **not verified:** a booted run. The container that wrote this lab has no
  Docker daemon, so nobody here has seen these three experiments on a screen.
  Saying so is cheaper than the alternative: a counterpart that claims to boot
  and does not is worse than one that says it has not been tried.

If you run it and any of the three experiments does not behave as described
above, that is a bug in this lab and worth an issue. The images are pinned
(`10.6.0-rhel9`) so that the thing you run is the thing this text describes.

## Sources

- [How Splunk Enterprise handles your data](https://docs.splunk.com/Documentation/Splunk/latest/Data/WhatSplunkdoeswithyourdata)
  — the four phases, and the 64K blocks annotated with metadata.
- [Configuration parameters and the data pipeline](https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.4/administer-splunk-enterprise-with-configuration-files/configuration-parameters-and-the-data-pipeline)
  — which component handles which phase, and the rule that each configuration
  belongs on only one of them.
- [Types of forwarders](https://docs.splunk.com/Documentation/Splunk/9.3.1/Forwarding/Typesofforwarders)
  — the universal forwarder does not parse; the heavy forwarder does.
- [Configure event line breaking](https://help.splunk.com/en/splunk-enterprise/get-started/get-data-in/9.4/configure-event-processing/configure-event-line-breaking)
  — the capturing-group semantics of `LINE_BREAKER`, and why
  `SHOULD_LINEMERGE = false` goes with it.
- [Use EVENT_BREAKER on Universal Forwarder](https://splunk.my.site.com/customer/s/article/EVENT-BREAKER)
  — what the forwarder can cut, and why.
- [outputs.conf](https://docs.splunk.com/Documentation/Splunk/latest/Admin/Outputsconf)
  — `useACK`, and that it is `false` by default.
