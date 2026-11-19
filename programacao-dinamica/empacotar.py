"""Gera o ZIP da entrega no Teams: ``entrega/GS-Dynamic-Programming.zip``.

    python empacotar.py              # gera o ZIP e confere
    python empacotar.py --verificar  # só confere um ZIP já gerado

O ZIP leva o handbook de algoritmos em Python (``handbook/``), os testes, a
referência dos labs, uma cópia do mapa (que no repositório mora no pacote dos
labs), o site do OpenLabs já construído (``site/``, para ``python main.py --servir``)
e o README com os integrantes.

Os integrantes vêm de ``entrega/equipe.json``, que fica fora do Git porque tem
dados dos alunos. Se ele não existir, vale o da entrega de Database Design
(``../database/entrega/equipe.json``): a equipe é a mesma. O formato é o mesmo:
``{ "equipe": "...", "solucao": "...", "integrantes": [["Nome", "RM"], ...] }``.

A conferência abre o ZIP numa pasta temporária, longe do repositório, e roda lá
os testes e o ``main.py``: se faltar um arquivo, ela falha aqui e não na mão do
professor.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ENTREGA = AQUI / "entrega"
ZIP = ENTREGA / "GS-Dynamic-Programming.zip"
RAIZ_NO_ZIP = "openlabs-handbook-de-algoritmos"
SITE = AQUI.parent / "apps" / "site" / "dist"
MAPA = AQUI.parent / "packages" / "algo-domain" / "src" / "mapa-real" / "sao-paulo.json"
EQUIPES = (ENTREGA / "equipe.json", AQUI.parent / "database" / "entrega" / "equipe.json")

ARQUIVOS = ["main.py", "benchmark.py", "prompts.md", "exportar_referencia.mjs", "tests/__init__.py", "tests/test_handbook.py", "dados/referencia_openlabs.json"]
PASTAS = ["handbook"]


def equipe() -> dict | None:
    for caminho in EQUIPES:
        if caminho.exists():
            dados = json.loads(caminho.read_text(encoding="utf-8"))
            if not dados.get("integrantes"):
                raise SystemExit(f"{caminho}: 'integrantes' está vazio.")
            return dados
    return None


def readme_com_integrantes(dados: dict | None) -> str:
    texto = (AQUI / "README.md").read_text(encoding="utf-8")
    if dados is None:
        return texto
    linhas = sorted(dados["integrantes"], key=lambda par: par[0].casefold())
    bloco = ["## Integrantes", ""]
    if dados.get("equipe"):
        bloco += [f"**{dados['equipe']}**.", ""]
    bloco += ["| Nome | RM |", "|---|---|"] + [f"| {nome} | {rm} |" for nome, rm in linhas]
    novo = "<!-- INTEGRANTES:INICIO -->\n" + "\n".join(bloco) + "\n<!-- INTEGRANTES:FIM -->"
    return re.sub(r"<!-- INTEGRANTES:INICIO -->.*?<!-- INTEGRANTES:FIM -->", lambda _: novo, texto, flags=re.S)


def gerar() -> None:
    dados = equipe()
    if dados is None:
        print("AVISO: sem entrega/equipe.json — o README vai sem nomes e RMs, e a disciplina pede os dois.")
    if not MAPA.exists():
        raise SystemExit(f"Mapa não encontrado em {MAPA}.")
    ENTREGA.mkdir(exist_ok=True)
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{RAIZ_NO_ZIP}/README.md", readme_com_integrantes(dados))
        for nome in ARQUIVOS:
            z.write(AQUI / nome, f"{RAIZ_NO_ZIP}/{nome}")
        for pasta in PASTAS:
            for arquivo in sorted((AQUI / pasta).rglob("*")):
                if arquivo.is_file() and "__pycache__" not in arquivo.parts:
                    z.write(arquivo, f"{RAIZ_NO_ZIP}/{arquivo.relative_to(AQUI).as_posix()}")
        z.write(MAPA, f"{RAIZ_NO_ZIP}/dados/sao-paulo.json")
        if not (SITE / "index.html").exists():
            raise SystemExit("Falta o site construído em apps/site/dist: rode `pnpm build` na raiz do repositório.")
        for arquivo in sorted(SITE.rglob("*")):
            if arquivo.is_file():
                z.write(arquivo, f"{RAIZ_NO_ZIP}/site/{arquivo.relative_to(SITE).as_posix()}")
    print(f"Gerado: {ZIP} ({ZIP.stat().st_size / 1024:.0f} KB)")


def servidor_ok(pasta: Path, env: dict) -> None:
    """Sobe ``main.py --servir`` de dentro do ZIP e abre as páginas como o navegador abriria."""
    import time
    import urllib.request

    p = subprocess.Popen([sys.executable, "main.py", "--servir", "--sem-navegador", "--porta", "8765"], cwd=pasta, env=env,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen("http://127.0.0.1:8765/", timeout=1)
                break
            except OSError:
                time.sleep(0.2)
        for caminho in ("/handbooks/algorithms/", "/labs/knapsack-session/", "/labs/greedy-change/", "/labs/shortest-path/", "/labs/how-work-grows/"):
            with urllib.request.urlopen(f"http://127.0.0.1:8765{caminho}", timeout=5) as r:
                html = r.read().decode("utf-8")
            if r.status != 200 or "<html" not in html.lower():
                raise SystemExit(f"--servir não serviu {caminho}")
        js = next((pasta / "site" / "_astro").glob("*.js"))
        with urllib.request.urlopen(f"http://127.0.0.1:8765/_astro/{js.name}", timeout=5) as r:
            if "javascript" not in r.headers.get("Content-Type", ""):
                raise SystemExit(f"--servir mandou {js.name} como {r.headers.get('Content-Type')}: o navegador recusaria")
    finally:
        p.terminate()
        p.wait(timeout=10)


def verificar() -> None:
    if not ZIP.exists():
        raise SystemExit(f"Não há ZIP em {ZIP}. Rode sem --verificar primeiro.")
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(ZIP) as z:
        z.extractall(tmp)
        pasta = Path(tmp) / RAIZ_NO_ZIP
        env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"}
        for comando in (
            [sys.executable, "-X", "utf8", "-m", "unittest", "discover", "-s", "tests", "-t", "."],
            [sys.executable, "-X", "utf8", "main.py"],
        ):
            r = subprocess.run(comando, cwd=pasta, env=env, capture_output=True, text=True, encoding="utf-8")
            if r.returncode != 0:
                print(r.stdout[-2000:], r.stderr[-2000:])
                raise SystemExit(f"Falhou dentro do ZIP: {' '.join(comando[3:])}")
        if not (pasta / "dados" / "sao-paulo.json").exists():
            raise SystemExit("O mapa não está no ZIP.")
        servidor_ok(pasta, env)
        nomes = z.namelist()
        readme = z.read(f"{RAIZ_NO_ZIP}/README.md").decode("utf-8")
    print(f"Conferido: {len(nomes)} arquivos; testes, main.py e o site em localhost rodam fora do repositório.")
    if "_preencha" in readme:
        print("AVISO: o README do ZIP ainda não tem os integrantes.")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # console cp1252 do Windows
    if "--verificar" not in sys.argv:
        gerar()
    verificar()
