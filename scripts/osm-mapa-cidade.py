"""Transforma um recorte do OpenStreetMap no grafo de ruas do lab do mapa.

Uso (uma vez, na máquina de quem mantém o handbook — o site nunca chama o OSM):

    # baixe o recorte em quadrados de 0,01° pela API oficial (limite de 50 mil nós)
    #   https://api.openstreetmap.org/api/0.6/map?bbox=OESTE,SUL,LESTE,NORTE
    python3 -I scripts/osm-mapa-cidade.py PASTA_COM_OS_.osm SAIDA.json

O que sai é o grafo dirigido das ruas por onde passa carro:

- só `highway` de tráfego (motorway … living_street); calçada, ciclovia e
  serviço ficam de fora;
- mão única respeitada (`oneway=yes|1|true|-1`, rotatória, motorway);
- trechos sem cruzamento viram UMA aresta, com a geometria da rua guardada à
  parte (é ela que o lab pinta);
- peso = tempo de viagem na velocidade típica do tipo de via; comprimento em
  metros;
- só a maior componente fortemente conexa: entre quaisquer dois cruzamentos
  existe rota, nos dois sentidos;
- coordenadas em metros, projeção equirretangular centrada no recorte
  (erro < 0,1 % em 4 km), com y crescendo para o SUL, como numa tela.

Dados © colaboradores do OpenStreetMap, licença ODbL. O crédito vai no JSON e
na página do lab.
"""
import glob
import json
import math
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict

PASTA, SAIDA = sys.argv[1], sys.argv[2]
OESTE, SUL, LESTE, NORTE = -46.665, -23.575, -46.625, -23.535

# Velocidade típica em km/h por tipo de via — o mesmo critério para todo o mapa.
VELOCIDADE = {
    "motorway": 70, "motorway_link": 45, "trunk": 60, "trunk_link": 40,
    "primary": 45, "primary_link": 35, "secondary": 40, "secondary_link": 30,
    "tertiary": 35, "tertiary_link": 28, "unclassified": 30, "residential": 30,
    "living_street": 15,
}

# Pontos de interesse: nome no OSM → rótulo curto no lab.
POIS = {
    "Museu de Arte de São Paulo": "MASP",
    "Hospital Sírio Libanês": "Hospital Sírio-Libanês",
    "Universidade Presbiteriana Mackenzie": "Mackenzie",
    "Edifício Copan": "Copan",
    "Praça da República": "Praça da República",
    "Teatro Municipal de São Paulo": "Theatro Municipal",
    "Catedral da Sé": "Catedral da Sé",
    "Mercado Municipal Kinjo Yamato": "Mercadão",
    "Mosteiro de São Bento": "Mosteiro de São Bento",
    "Praça da Liberdade-Japão": "Liberdade",
    "Escada do Bixiga": "Bixiga",
    "Estação da Luz": "Estação da Luz",
    "Hospital Beneficência Portuguesa": "Beneficência Portuguesa",
    "Edifício Martinelli": "Martinelli",
    "Instituto Moreira Salles - IMS Paulista": "IMS Paulista",
}

lat0 = (SUL + NORTE) / 2
lon0 = (OESTE + LESTE) / 2
R = 6371008.8


def projetar(lat, lon):
    x = math.radians(lon - lon0) * R * math.cos(math.radians(lat0))
    y = -math.radians(lat - lat0) * R
    return x, y


coords = {}
vias = {}
pois_brutos = {}
for f in sorted(glob.glob(f"{PASTA}/*.osm")):
    for _, el in ET.iterparse(f):
        if el.tag == "node":
            coords[int(el.get("id"))] = (float(el.get("lat")), float(el.get("lon")))
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            if tags.get("name") in POIS:
                pois_brutos[tags["name"]] = [(float(el.get("lat")), float(el.get("lon")))]
            el.clear()
        elif el.tag == "way":
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            refs = [int(n.get("ref")) for n in el.findall("nd")]
            hw = tags.get("highway")
            if hw in VELOCIDADE and tags.get("access") not in ("no", "private") and tags.get("area") != "yes":
                vias[int(el.get("id"))] = (hw, tags.get("name") or "", tags.get("oneway"), tags.get("junction"), refs)
            if tags.get("name") in POIS and tags["name"] not in pois_brutos:
                pois_brutos[tags["name"]] = refs  # resolvido depois, quando os nós existirem
            el.clear()


def dentro(n):
    lat, lon = coords[n]
    return SUL <= lat <= NORTE and OESTE <= lon <= LESTE


# ---------------------------------------------------------------- arcos dirigidos
nomes = []
indice_nome = {}


def nome_id(s):
    if s not in indice_nome:
        indice_nome[s] = len(nomes)
        nomes.append(s)
    return indice_nome[s]


arcos = []  # (a, b, hw, nome)
uso = defaultdict(int)
for hw, nome, oneway, junction, refs in vias.values():
    refs = [n for n in refs if n in coords]
    mao = 0
    if oneway in ("yes", "1", "true") or junction in ("roundabout", "circular") or hw == "motorway":
        mao = 1
    if oneway == "-1":
        mao = -1
    if oneway == "no":
        mao = 0
    for a, b in zip(refs, refs[1:]):
        if not (dentro(a) and dentro(b)):
            continue
        if mao >= 0:
            arcos.append((a, b, hw, nome))
        if mao <= 0:
            arcos.append((b, a, hw, nome))
        uso[a] += 1
        uso[b] += 1

saidas = defaultdict(list)
entradas = defaultdict(list)
for i, (a, b, _, _) in enumerate(arcos):
    saidas[a].append(i)
    entradas[b].append(i)

# ---------------------------------------------------------------- maior componente fortemente conexa (Kosaraju, iterativo)
vertices = list({a for a, *_ in arcos} | {b for _, b, *_ in arcos})
visto = set()
ordem = []
for v in vertices:
    if v in visto:
        continue
    pilha = [(v, iter(saidas[v]))]
    visto.add(v)
    while pilha:
        u, it = pilha[-1]
        for i in it:
            w = arcos[i][1]
            if w not in visto:
                visto.add(w)
                pilha.append((w, iter(saidas[w])))
                break
        else:
            pilha.pop()
            ordem.append(u)
comp = {}
for v in reversed(ordem):
    if v in comp:
        continue
    pilha = [v]
    comp[v] = v
    while pilha:
        u = pilha.pop()
        for i in entradas[u]:
            w = arcos[i][0]
            if w not in comp:
                comp[w] = v
                pilha.append(w)
tamanho = defaultdict(int)
for v, c in comp.items():
    tamanho[c] += 1
maior = max(tamanho, key=tamanho.get)
vivos = {v for v, c in comp.items() if c == maior}
arcos = [a for a in arcos if a[0] in vivos and a[1] in vivos]
saidas = defaultdict(list)
entradas = defaultdict(list)
for i, (a, b, _, _) in enumerate(arcos):
    saidas[a].append(i)
    entradas[b].append(i)

# ---------------------------------------------------------------- compactar cadeias sem cruzamento
# Um nó é "cruzamento" se não é um simples ponto do meio de uma rua: grau de
# entrada/saída diferente de 1 (mão única) ou de 2 (mão dupla), ou troca de nome.
def eh_cruzamento(v):
    vizinhos = {arcos[i][1] for i in saidas[v]} | {arcos[i][0] for i in entradas[v]}
    if len(vizinhos) != 2:
        return True
    nomes_aqui = {arcos[i][3] for i in saidas[v]} | {arcos[i][3] for i in entradas[v]}
    tipos = {arcos[i][2] for i in saidas[v]} | {arcos[i][2] for i in entradas[v]}
    return len(nomes_aqui) > 1 or len(tipos) > 1 or len(saidas[v]) != len(entradas[v])


cruzamentos = [v for v in vivos if eh_cruzamento(v)]
id_novo = {v: k for k, v in enumerate(sorted(cruzamentos))}
arestas = []
geometria = []
feitos = set()
for i0, (a, b, hw, nome) in enumerate(arcos):
    if a not in id_novo or i0 in feitos:
        continue
    caminho = [a, b]
    feitos.add(i0)
    metros = 0.0
    segundos = 0.0
    atual, prev, i = b, a, i0
    while True:
        pa, pb = projetar(*coords[prev]), projetar(*coords[atual])
        d = math.dist(pa, pb)
        metros += d
        segundos += d / (VELOCIDADE[arcos[i][2]] / 3.6)
        if atual in id_novo:
            break
        prox = [j for j in saidas[atual] if arcos[j][1] != prev]
        if not prox:
            break
        i = prox[0]
        feitos.add(i)
        prev, atual = atual, arcos[i][1]
        caminho.append(atual)
    if atual not in id_novo:
        continue
    pontos = [projetar(*coords[n]) for n in caminho[1:-1]]
    arestas.append([id_novo[a], id_novo[atual], round(segundos * 10), round(metros), nome_id(nome), list(VELOCIDADE).index(hw)])
    geometria.append([round(c * 10) for p in pontos for c in p])

xy = [None] * len(id_novo)
for v, k in id_novo.items():
    x, y = projetar(*coords[v])
    xy[k] = (round(x * 10), round(y * 10))


def mais_perto(lat, lon):
    x, y = projetar(lat, lon)
    return min(range(len(xy)), key=lambda k: (xy[k][0] / 10 - x) ** 2 + (xy[k][1] / 10 - y) ** 2)


pois = []
for nome_osm, rotulo in POIS.items():
    bruto = pois_brutos.get(nome_osm)
    if not bruto:
        print("sem ponto:", nome_osm, file=sys.stderr)
        continue
    pts = [coords[r] if isinstance(r, int) else r for r in bruto if not isinstance(r, int) or r in coords]
    if not pts:
        continue
    lat = sum(p[0] for p in pts) / len(pts)
    lon = sum(p[1] for p in pts) / len(pts)
    if not (SUL <= lat <= NORTE and OESTE <= lon <= LESTE):
        print("fora do recorte:", nome_osm, file=sys.stderr)
        continue
    x, y = projetar(lat, lon)
    pois.append({"nome": rotulo, "x": round(x * 10), "y": round(y * 10), "no": mais_perto(lat, lon)})

meia_x, meia_y = projetar(SUL, LESTE)
saida = {
    "cidade": "São Paulo — Centro e Paulista",
    "fonte": "OpenStreetMap",
    "credito": "© OpenStreetMap contributors (ODbL)",
    "licenca": "https://www.openstreetmap.org/copyright",
    "recorte": [OESTE, SUL, LESTE, NORTE],
    "unidade": "decímetros (x para leste, y para o sul, origem no centro do recorte)",
    "largura": round(2 * abs(meia_x) * 10),
    "altura": round(2 * abs(meia_y) * 10),
    "tipos": list(VELOCIDADE),
    "velocidades": list(VELOCIDADE.values()),
    "nos": [c for p in xy for c in p],
    "arestas": [c for a in arestas for c in a],
    "geometria": geometria,
    "nomes": nomes,
    "pois": pois,
}
with open(SAIDA, "w") as f:
    json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(xy)} cruzamentos, {len(arestas)} arestas, {sum(len(g) for g in geometria) // 2} pontos de geometria, {len(pois)} pontos de interesse", file=sys.stderr)
