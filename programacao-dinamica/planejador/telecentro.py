"""Os telecentros e as pessoas simuladas, ligados ao mapa e ao catálogo."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .mapa import Mapa

DADOS = Path(__file__).resolve().parent.parent / "dados" / "telecentros.json"


@dataclass(frozen=True)
class Telecentro:
    nome: str
    perto_de: str
    computadores: int
    no: int


@dataclass(frozen=True)
class Aluno:
    nome: str
    perfil: str
    mora_perto_de: str
    no: int
    velocidade_m_s: float
    sessao_minutos: int
    concluidos: frozenset[str]
    objetivo: str


def carregar_telecentros(mapa: Mapa, caminho: Path = DADOS) -> tuple[list[Telecentro], list[Aluno]]:
    dados = json.loads(caminho.read_text(encoding="utf-8"))

    def no_de(lugar: str) -> int:
        if lugar not in mapa.lugares:
            raise ValueError(f"Lugar fora do mapa: {lugar!r}. Conhecidos: {', '.join(sorted(mapa.lugares))}.")
        return mapa.lugares[lugar]

    telecentros = [Telecentro(t["nome"], t["perto_de"], t["computadores"], no_de(t["perto_de"])) for t in dados["telecentros"]]
    alunos = [
        Aluno(
            a["nome"],
            a["perfil"],
            a["mora_perto_de"],
            no_de(a["mora_perto_de"]),
            float(a["velocidade_m_s"]),
            int(a["sessao_minutos"]),
            frozenset(a["concluidos"]),
            a["objetivo"],
        )
        for a in dados["alunos"]
    ]
    return telecentros, alunos
