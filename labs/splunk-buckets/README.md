# An index ageing, against real Splunk

This directory is the counterpart of
[`labs/splunk-buckets/`](../../apps/site/src/pages/labs/splunk-buckets.astro) on
the site: one indexer, one index, and four limits. The lab on screen makes one
claim, and it is a claim about this `indexes.conf`:

> How far back you can search is not a setting. It is what is left over from
> your daily volume and four limits, and the number appears in no file.

```
docker compose up
```

Then, in Splunk Web at <http://localhost:8000>:

```
| dbinspect index=openlabs
index=openlabs | stats min(_time) as oldest, max(_time) as newest, count
```

`dbinspect` lists the buckets with their state, so you watch the staircase move:
hot filling, warm counted, cold accumulating, and buckets leaving. The second
search is the answer the lab is about — `oldest` is your real retention, and
you will watch it stop going backwards and start moving forwards.

## The limits here are small on purpose

| setting | here | the real default |
| --- | --- | --- |
| `maxDataSize` | 50 (MB) | `auto`, which is 750 MB |
| `maxWarmDBCount` | 6 | 300 |
| `maxTotalDataSizeMB` | 400 | 500000 |
| `frozenTimePeriodInSecs` | 2592000 (30 days) | 188697600, about six years |

That is the same time compression the on-screen lab does with its
`hours per tick` parameter, and for the same reason: with the real defaults,
nothing rolls anywhere in less than a week of wall-clock time, and a lab in
which nothing happens teaches nothing. The real defaults are in the right-hand
column so that what you learn here transfers.

## The experiment

**1. Watch the staircase.** `| dbinspect index=openlabs` and look at the
`state` column. Buckets appear as `hot`, roll to `warm` at 50 MB, and start
rolling to `cold` once there are more than six warm.

**2. Find out what your retention actually is.** Run the `stats` search every
minute. `oldest` goes backwards while the index is filling, and then — once
400 MB is reached — it starts moving *forwards*, because the oldest buckets are
being frozen. The distance between `oldest` and `newest` stops growing. That
distance is your retention, and nothing configured it.

Note which limit did it. `frozenTimePeriodInSecs` here says 30 days, and you
will not have 30 days: the documentation states that data will be rolled to
frozen before the configured time period has elapsed if the size limit is
reached first.

**3. Find out where the frozen buckets went.**

```
docker compose exec idx ls -la /opt/splunk/frozen
```

They are there because `coldToFrozenDir` is set in this file. Comment that line
out, `docker compose restart idx`, and let it run again: everything behaves
identically, every search returns the same, the disk usage is the same — and
the buckets are gone. Freezing means removing the data from the index, and
archiving is a line somebody has to write.

## What is verified, and what is not

- **verified:** every setting in `indexes.conf` was read against the current
  Splunk documentation, with the link in the comment above it; the defaults in
  the table above come from those pages; the compose file parses and the volume
  generator passes `sh -n`;
- **not verified:** a booted run. The container this lab was written in has no
  Docker daemon, so nobody here has watched `dbinspect` move. If step 2 does not
  behave as described, that is a bug in this lab and worth an issue.

## Sources

- [Set a retirement and archiving policy](https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/back-up-and-archive-your-indexes/set-a-retirement-and-archiving-policy)
  — that either limit freezes data, that the size limit can beat the time one,
  and that freezing removes the data unless you archive it.
- [Configure index storage](https://help.splunk.com/en/data-management/manage-splunk-enterprise-indexers/9.3/manage-index-storage/configure-index-storage)
  — the four settings, their defaults, and which transition each one governs.
- [How the indexer stores indexes](https://help.splunk.com/en/splunk-enterprise/administer/manage-indexers-and-indexer-clusters/10.6/manage-index-storage/how-the-indexer-stores-indexes)
  — what is inside a bucket: the compressed raw data journal, the index files
  that point into it, and metadata.
