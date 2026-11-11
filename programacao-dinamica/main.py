"""Planejador do OpenLabs no Telecentro — demonstração de ponta a ponta.

    python main.py                      # as três pessoas simuladas + a agenda do dia
    python main.py --aluno Rafa         # só uma pessoa
    python main.py --aluno Rafa --sessao 120 --tabela
    python main.py --agenda             # só a agenda do computador de atendimento
    python main.py --lugares            # os lugares do mapa que dá para usar

Só biblioteca padrão do Python 3.10+. Nada é baixado: o mapa vem no projeto.
"""

from __future__ import annotations

import argparse
import sys

from planejador.agenda import Agenda, carregar_agenda
from planejador.mapa import (
    Cobertura,
    Mapa,
    caminho_ate_telecentro,
    carregar_mapa,
    dijkstra_multifonte,
    dijkstra_um_par,
    minutos_a_pe,
    ruas_da_rota,
)
from planejador.medidor import Contador
from planejador.sessao import mochila_forca_bruta, mochila_gulosa, mochila_memoizada, mochila_tabulada
from planejador.telecentro import Aluno, Telecentro, carregar_telecentros
from planejador.trilha import Trilha, carregar_trilha

#: Quinze minutos a pé, no passo de quem anda devagar (1 m/s): o raio do indicador.
RAIO_DO_INDICADOR_M = 15 * 60 * 1.0


def num(n: float) -> str:
    """1964 -> '1.964', como se escreve em português."""
    return f"{n:,.0f}".replace(",", ".")


def titulo(texto: str) -> None:
    print()
    print(texto)
    print("─" * len(texto))


def parte_mapa(mapa: Mapa, telecentros: list[Telecentro], cobertura: Cobertura, contagem: Contador, aluno: Aluno) -> None:
    titulo(f"1. Grafos · o telecentro mais perto de {aluno.nome}")
    metros = cobertura.distancia[aluno.no]
    if metros == float("inf"):
        print("Nenhum telecentro alcançável a pé deste ponto.")
        return
    t = telecentros[cobertura.dono[aluno.no]]
    rota = caminho_ate_telecentro(cobertura, aluno.no)
    print(f"Mora perto de {aluno.mora_perto_de}. Mais perto: {t.nome} ({t.perto_de}).")
    print(f"{num(metros)} m a pé · {minutos_a_pe(metros, aluno.velocidade_m_s):.0f} min no passo de {aluno.nome} ({aluno.velocidade_m_s} m/s) · {len(rota) - 1} trechos de rua.")
    trechos = ruas_da_rota(mapa, rota)
    print("Caminho: " + " → ".join(f"{rua} ({m:.0f} m)" for rua, m in trechos if m >= 40))

    # A comparação: uma busca por telecentro contra a busca multi-fonte única.
    pares = Contador()
    for tc in telecentros:
        dijkstra_um_par(mapa, aluno.no, tc.no, pares)
    print(
        f"Trabalho: {len(telecentros)} buscas de um par = {num(pares['resolvidos'])} cruzamentos resolvidos, só para esta pessoa;"
        f" a busca multi-fonte resolveu {num(contagem['resolvidos'])} uma vez e responde o mapa inteiro."
    )


def parte_trilha(trilha: Trilha, aluno: Aluno) -> list:
    titulo(f"2. Grafos + Memoização · a trilha até {aluno.objetivo}")
    objetivo = trilha.labs[aluno.objetivo]
    faltam = sorted(trilha.antes(aluno.objetivo) - aluno.concluidos, key=trilha.ordem.index)
    feitos = ", ".join(sorted(aluno.concluidos)) or "nenhum"
    print(f"Já fez: {feitos}.")
    print(f"Objetivo: {objetivo.titulo} ({objetivo.minutos} min).")
    if faltam:
        print(f"Antes dele faltam {len(faltam)} lab(s), {trilha.minutos_para_liberar(aluno.objetivo, set(aluno.concluidos))} min: {' → '.join(faltam)}.")
    else:
        print("Nenhum pré-requisito pendente: já dá para abrir.")
    minutos, cadeia = trilha.critico(aluno.objetivo)
    print(f"Caminho crítico do catálogo até ele: {' → '.join(cadeia)} ({minutos} min).")
    liberados = trilha.liberados(set(aluno.concluidos))
    print(f"Liberados hoje: {len(liberados)} labs.")
    return liberados


def parte_sessao(liberados: list, aluno: Aluno, sessao: int, mostrar_tabela: bool) -> None:
    titulo(f"3. Tabulação · o que cabe em {sessao} min de computador")
    tab = Contador()
    plano = mochila_tabulada(liberados, sessao, tab)
    for lab in plano.labs:
        print(f"  • {lab.titulo} [{lab.slug}] — {lab.minutos} min, {lab.pontos} pts")
    print(f"Total: {plano.pontos} pontos em {plano.minutos} de {sessao} min.")

    memo = Contador()
    mochila_memoizada(liberados, sessao, memo)
    bruta = Contador()
    conferida = mochila_forca_bruta(liberados, sessao, bruta)
    gulosa, _ = mochila_gulosa(liberados, sessao)
    print(
        f"Trabalho: tabela {tab['celulas']} células · memoizada {memo['chamadas']} chamadas"
        f" · força bruta {bruta['subconjuntos']} subconjuntos (confere: {conferida} pts)."
    )
    if gulosa < plano.pontos:
        print(f"A regra gulosa (pontos por minuto) faria só {gulosa} pts.")
    if mostrar_tabela:
        imprimir_tabela(plano.tabela, liberados, sessao)


def imprimir_tabela(tabela, labs, sessao: int) -> None:
    passo = 5 if sessao <= 120 else 15
    colunas = list(range(0, sessao + 1, passo))
    print()
    print("T[i][t] — pontos máximos com os i primeiros labs e t minutos")
    print("lab".ljust(26) + "".join(f"{t:>4}" for t in colunas))
    for i, linha in enumerate(tabela):
        nome = "(nenhum)" if i == 0 else labs[i - 1].slug[:24]
        print(nome.ljust(26) + "".join(f"{linha[t]:>4}" for t in colunas))


def parte_agenda(agenda: Agenda) -> None:
    titulo("4. Memoização e Tabulação · o computador de atendimento, um dia")
    total, _, escolhidos = agenda.tabulada()
    for p in escolhidos:
        print(f"  • {p.horario}  {p.quem:<9} {p.motivo:<16} prioridade {p.peso}")
    print(f"Prioridade somada: {total}, com {len(escolhidos)} de {agenda.n} pedidos.")

    gulosa = agenda.gulosa()
    perdidos = [p.quem for p in escolhidos if p.peso >= 4 and p not in gulosa]
    print(
        f"A regra 'o que termina primeiro' atenderia {len(gulosa)} pedidos, mas só {sum(p.peso for p in gulosa)} de prioridade"
        + (f" — e deixaria sem atendimento: {', '.join(perdidos)}." if perdidos else ".")
    )
    ing, mem = Contador(), Contador()
    agenda.ingenua(ing)
    agenda.memoizada(mem)
    print(f"Trabalho: recursão ingênua {num(ing['chamadas'])} chamadas · memoizada {mem['chamadas']} · tabela {agenda.n} células.")


def parte_cobertura(mapa: Mapa, telecentros: list[Telecentro], cobertura: Cobertura) -> None:
    titulo("Indicador de impacto · cobertura a pé")
    perto = sum(1 for d in cobertura.distancia if d <= RAIO_DO_INDICADOR_M)
    print(f"{perto} de {mapa.n} cruzamentos ({100 * perto / mapa.n:.0f}%) ficam a até 15 min a pé (1 m/s) de um telecentro.")
    por_tc = [0] * len(telecentros)
    for dono in cobertura.dono:
        if dono >= 0:
            por_tc[dono] += 1
    for t, k in zip(telecentros, por_tc):
        print(f"  {t.nome:<22} é o mais perto de {k} cruzamentos")


def principal(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Planejador do OpenLabs no Telecentro (Programação Dinâmica).")
    ap.add_argument("--aluno", help="nome de uma das pessoas simuladas (dados/telecentros.json)")
    ap.add_argument("--sessao", type=int, help="minutos de computador (substitui o da pessoa)")
    ap.add_argument("--tabela", action="store_true", help="imprime a tabela da mochila")
    ap.add_argument("--agenda", action="store_true", help="só a agenda do computador de atendimento")
    ap.add_argument("--lugares", action="store_true", help="lista os lugares do mapa")
    args = ap.parse_args(argv)

    if args.agenda:
        parte_agenda(carregar_agenda())
        return 0

    mapa = carregar_mapa()
    if args.lugares:
        print("\n".join(sorted(mapa.lugares)))
        return 0

    telecentros, alunos = carregar_telecentros(mapa)
    trilha = carregar_trilha()
    if args.aluno:
        alunos = [a for a in alunos if a.nome.lower() == args.aluno.lower()]
        if not alunos:
            print(f"Pessoa desconhecida: {args.aluno!r}.", file=sys.stderr)
            return 2

    print("OpenLabs no Telecentro · planejador")
    print(f"Mapa: {mapa.n} cruzamentos, {mapa.arestas()} trechos de rua a pé · {mapa.credito}")
    contagem = Contador()
    cobertura = dijkstra_multifonte(mapa, [t.no for t in telecentros], contagem)

    for aluno in alunos:
        print()
        print(f"═══ {aluno.nome} — {aluno.perfil} ═══")
        parte_mapa(mapa, telecentros, cobertura, contagem, aluno)
        liberados = parte_trilha(trilha, aluno)
        parte_sessao(liberados, aluno, args.sessao or aluno.sessao_minutos, args.tabela)

    if not args.aluno:
        parte_cobertura(mapa, telecentros, cobertura)
        parte_agenda(carregar_agenda())
    return 0


if __name__ == "__main__":
    sys.exit(principal())
