"""Opt-in build-time translation of the public OpenLabs inventory, with a local cache.

Normal builds and deployed applications never invoke this script or a translator.
Only run this helper for source text already published by its author.
"""
import concurrent.futures
import json
from pathlib import Path
import re
import threading
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'apps/site/locales'
inventory = json.loads((ROOT / 'dist/locale-inventory.json').read_text())['messages']
lock = threading.Lock()
cache = {lang: json.loads((OUT / f'{lang}.json').read_text()) if (OUT / f'{lang}.json').exists() else {} for lang in ['en', 'pt-BR']}
glossary = ['Kubelet', 'kubelet', 'Ready', 'Created', 'Scheduled', 'Started', 'restartPolicy', 'Always', 'spec.replicas', 'handbooks', 'Handbooks', 'handbook', 'Handbook', 'OpenLabs', 'OpenTelemetry', 'Kubernetes', 'Mermaid', 'GitHub', 'TypeScript', 'JavaScript', 'ReplicaSet', 'Deployment', 'Pods', 'Pod', 'Pending', 'Running', 'Terminating', 'ImagePullBackOff', 'CrashLoopBackOff', 'OOMKilled', 'OTLP', 'OTel', 'gRPC', 'HTTP/2', 'RISC-V', 'RV32I', 'nginx', 'traceparent', 'Trace Context', 'CPU', 'UID', 'UUID', 'SDK', 'API', 'YAML', 'JSON', 'Protobuf', 'Ptolemy', 'Factorio', 'Logisim', 'tick', 'ticks', 'span', 'spans', 'trace', 'traces', 'payload', 'backpressure', 'datapath', 'batch', 'batches', 'receiver', 'exporter', 'sampler', 'sampling', 'pipeline', 'pipelines', 'modelet', 'modelets', 'sink', 'sinks']
protected = re.compile(r'\b\d+(?:\.\d+)?(?:m|Mi|Gi|Ki|MiB|GiB|KiB)\b|`[^`]+`|\{\d+\}|\b[a-zA-Z0-9_./-]+\.(?:json|ya?ml|md|mmd|tsx?|m?js|css|html|go|py|rs|zip|tgz)\b|\bopenlabs/[a-z-]+/v\d+\b|\b\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?\b|\b(?:' + '|'.join(re.escape(s) for s in sorted(glossary, key=len, reverse=True)) + r')\b')
for lang, values in cache.items():
    allowed = {m['source'] for m in inventory if m['language'] != lang}
    for source in list(values):
        if source not in allowed or any(values[source].count(term) < source.count(term) for term in protected.findall(source)):
            del values[source]

def protect(source):
    tokens = []
    def mask(match):
        tokens.append(match.group(0))
        return f'__OLTOKEN{len(tokens)-1}__'
    return protected.sub(mask, source), tokens

def restore(text, tokens):
    for index, token in enumerate(tokens):
        text = re.sub(r'__\s*OLTOKEN\s*' + str(index) + r'\s*__', lambda _: token, text, flags=re.I)
    if '__OLTOKEN' in text: raise ValueError('Unrestored technical token')
    return text.strip()

def request(text, source, target):
    query = urllib.parse.urlencode({'client':'gtx','sl':source,'tl':target,'dt':'t','q':text})
    url = 'https://translate.googleapis.com/translate_a/single?' + query
    last = None
    for retry in range(6):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                data = json.load(response)
                return ''.join(part[0] for part in data[0] if part[0])
        except Exception as error:
            last = error
            time.sleep(min(2 ** retry, 16))
    raise last

def save():
    for lang, values in cache.items():
        target = OUT / f'{lang}.json'
        target.with_suffix('.json.tmp').write_text(json.dumps(dict(sorted(values.items())), ensure_ascii=False, indent=2) + '\n')
        target.with_suffix('.json.tmp').replace(target)

jobs = []
for lang in ['en', 'pt-BR']:
    items = [m for m in inventory if m['language'] != lang and m['source'] not in cache[lang]]
    batch, size = [], 0
    for item in items:
        masked, tokens = protect(item['source'])
        entry = (item['source'], masked, tokens)
        if batch and size + len(masked) > 2600:
            jobs.append((lang, batch)); batch, size = [], 0
        batch.append(entry); size += len(masked) + 20
    if batch: jobs.append((lang, batch))

completed = 0
def run(job):
    global completed
    lang, batch = job
    source, target = ('pt','en') if lang == 'en' else ('en','pt')
    text = '\n'.join(f'[OL{i:06d}] {masked}' for i, (_, masked, _) in enumerate(batch))
    output = request(text, source, target)
    pieces = list(re.finditer(r'\[\s*OL\s*(\d{6})\s*\]\s*', output, re.I))
    translations = {}
    if len(pieces) == len(batch):
        for index, match in enumerate(pieces):
            key = int(match.group(1)); original, _, tokens = batch[key]
            end = pieces[index+1].start() if index+1 < len(pieces) else len(output)
            translated = restore(output[match.end():end], tokens)
            if not translated: translated = restore(request(batch[key][1], source, target), tokens)
            translations[original] = translated
    else:
        for original, masked, tokens in batch:
            translations[original] = restore(request(masked, source, target), tokens)
    with lock:
        cache[lang].update(translations); completed += 1
        if completed % 5 == 0 or completed == len(jobs):
            save(); print(f'{completed}/{len(jobs)} batches; en={len(cache["en"])} pt-BR={len(cache["pt-BR"])}', flush=True)
    time.sleep(.15)

print(f'Translating {len(jobs)} batches from public source text; cache is resumable.', flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    futures = [pool.submit(run, job) for job in jobs]
    for future in concurrent.futures.as_completed(futures): future.result()
with lock: save()
print('Static locale catalogs complete.', flush=True)
