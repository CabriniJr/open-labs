"""Gera o ZIP da entrega de Data Science: ``entrega/GS-Data-Science.zip``.

    python empacotar.py

Contém o notebook **executado** (``analise.ipynb``), a base em CSV com a fonte
(``dados/sessoes_telecentro.csv`` + ``dados/FONTE.md``), o ``integrantes.txt`` com
nomes e RMs, o anexo de como a análise aparece no OpenLabs
(``GS-Data-Science-OpenLabs.pdf``, de ``gerar_pdf_openlabs.mjs``) e os scripts que
geram tudo isso.

Os integrantes vêm de ``entrega/equipe.json`` ou, se ele não existir, de
``../database/entrega/equipe.json`` (a equipe é a mesma nas disciplinas). Os dois
ficam fora do Git.

Antes de empacotar, o script confere três coisas: que o CSV é o que
``gerar_dados.py`` produz com a semente fixa, que o notebook tem saídas e
nenhuma célula com erro, e que nenhuma pessoa está no treino e no teste ao mesmo
tempo (o notebook falharia no ``assert``).
"""

from __future__ import annotations

import csv
import io
import json
import sys
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ENTREGA = AQUI / "entrega"
ZIP = ENTREGA / "GS-Data-Science.zip"
EQUIPES = (ENTREGA / "equipe.json", AQUI.parent / "database" / "entrega" / "equipe.json")
RAIZ = "data-science-openlabs-telecentro"
ARQUIVOS = ["analise.ipynb", "dados/sessoes_telecentro.csv", "dados/FONTE.md", "README.md", "requirements.txt", "gerar_dados.py", "montar_notebook.py"]


def integrantes() -> str:
    for caminho in EQUIPES:
        if caminho.exists():
            d = json.loads(caminho.read_text(encoding="utf-8"))
            linhas = [f"{d.get('equipe', '')} · {d.get('solucao', 'OpenLabs no Telecentro')}", "Data Science & Statistical Computing · GS 2026.2 CitizenTech", ""]
            linhas += [f"{nome} - RM {rm}" for nome, rm in sorted(d["integrantes"], key=lambda p: p[0].casefold())]
            return "\n".join(linhas) + "\n"
    raise SystemExit("Falta entrega/equipe.json (ou ../database/entrega/equipe.json) com os integrantes: a disciplina pede o TXT com nomes e RMs.")


def conferir() -> None:
    sys.path.insert(0, str(AQUI))
    import gerar_dados

    esperado = io.StringIO()
    w = csv.DictWriter(esperado, fieldnames=gerar_dados.COLUNAS, lineterminator="\n")
    w.writeheader()
    w.writerows(gerar_dados.gerar())
    if (AQUI / "dados" / "sessoes_telecentro.csv").read_text(encoding="utf-8") != esperado.getvalue():
        raise SystemExit("O CSV não é o que gerar_dados.py produz. Rode `python gerar_dados.py` e depois `python montar_notebook.py`.")

    nb = json.loads((AQUI / "analise.ipynb").read_text(encoding="utf-8"))
    codigo = [c for c in nb["cells"] if c["cell_type"] == "code"]
    if any(not c.get("outputs") and c["source"] for c in codigo[:3]) or not any(c.get("outputs") for c in codigo):
        raise SystemExit("O notebook não foi executado. Rode `python montar_notebook.py`.")
    erros = [o for c in codigo for o in c.get("outputs", []) if o.get("output_type") == "error"]
    if erros:
        raise SystemExit(f"O notebook tem {len(erros)} célula(s) com erro.")
    imagens = sum("image/png" in o.get("data", {}) for c in codigo for o in c.get("outputs", []))
    print(f"Conferido: CSV reproduzível, notebook executado sem erro, {imagens} gráficos.")


def principal() -> None:
    conferir()
    texto = integrantes()
    ENTREGA.mkdir(exist_ok=True)
    (ENTREGA / "integrantes.txt").write_text(texto, encoding="utf-8")
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for nome in ARQUIVOS:
            z.write(AQUI / nome, f"{RAIZ}/{nome}")
        z.writestr(f"{RAIZ}/integrantes.txt", texto)
        anexo = ENTREGA / "GS-Data-Science-OpenLabs.pdf"
        if anexo.exists():
            z.write(anexo, f"{RAIZ}/GS-Data-Science-OpenLabs.pdf")
        else:
            print("AVISO: sem entrega/GS-Data-Science-OpenLabs.pdf (o anexo do OpenLabs). Gere com `node gerar_pdf_openlabs.mjs` e o site no ar.")
    print(f"Gerado: {ZIP} ({ZIP.stat().st_size / 1024:.0f} KB)")
    print(texto)


if __name__ == "__main__":
    principal()
