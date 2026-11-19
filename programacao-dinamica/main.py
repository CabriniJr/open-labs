"""O handbook de algoritmos do OpenLabs, em Python — a entrega de Dynamic Programming.

    python main.py                      # o índice: o handbook, as aulas e os links dos labs
    python main.py todas                # as quatro aulas, uma depois da outra
    python main.py mochila              # uma aula (crescimento, caminho, troco ou mochila)
    python main.py mochila --passo      # com o passo a passo: a tabela enchendo
    python main.py mochila --abrir      # e abre o lab gráfico no navegador
    python main.py --servir             # o OpenLabs inteiro em http://localhost:8000, sem internet

Opções de cada aula:

    python main.py crescimento --n 16
    python main.py caminho --cenario errands           (short, across, aimed, maze, tour, errands)
    python main.py troco --sistema toy --valor 6        (brl, pre-decimal, toy, no-one)
    python main.py mochila --cenario rafa --sessao 120  (rafa, trap, cida)

Só a biblioteca padrão do Python 3.10+. Nada para instalar.
"""

from __future__ import annotations

import argparse
import http.server
import math
import sys
import threading

import webbrowser
from functools import partial
from pathlib import Path

from handbook import AULAS, HANDBOOK, LOCAL, aula
from handbook import caminho as ca
from handbook import crescimento as cr
from handbook import mochila as mo
from handbook import troco as tr

AQUI = Path(__file__).resolve().parent
LARGURA = 78


def titulo(texto: str, char: str = "═") -> None:
    print()
    print(char * LARGURA)
    print(texto)
    print(char * LARGURA)


def secao(texto: str) -> None:
    print()
    print(texto)
    print("─" * len(texto))


def n_(x: float) -> str:
    """Número com separador de milhar, como se lê em português."""
    return f"{x:,.0f}".replace(",", ".")


def cabecalho(id_: str, local: bool) -> None:
    a = aula(id_)
    titulo(f"Fase {a.fase} · {a.titulo}")
    print(f"Técnica: {a.tecnicas}")
    print(f"Pergunta: {a.pergunta}")
    print(f"Lab gráfico (mesmos dados, mesmos números): {a.url(local)}")


def rodape(id_: str, args: argparse.Namespace) -> None:
    a = aula(id_)
    print()
    print(f"→ Veja isto acontecendo, com animação e simulação: {a.url(args.local)}")
    if args.abrir:
        webbrowser.open(a.url(args.local))


# ───────────────────────────────────────────── fase 3 · crescimento


def aula_crescimento(args: argparse.Namespace) -> None:
    cabecalho("crescimento", args.local)
    n = args.n
    v = cr.entrada_do_lab(n)
    print(f"\nA entrada do lab (semente 1, n = {n}): {v}")
    print("São todos pares. O alvo do lab é 1, ímpar: nenhum subconjunto chega lá, e a força bruta")
    print("é obrigada a tentar todos. É o pior caso, e é ele que o lab mede.")

    secao("1. Força bruta: todos os subconjuntos")
    fb = cr.forca_bruta(v, 1)
    print(f"Tentou {n_(fb.trabalho)} subconjuntos = 2^{n}. Achou? {'sim' if fb.achou else 'não'}.")

    secao("2. Quando a tabela ganha: o mesmo vetor do lab, n crescendo")
    print("Alvo = soma de tudo + 1: ímpar e maior que tudo, impossível — ninguém para cedo.")
    print(f"{'n':>4} {'força bruta (2ⁿ)':>18} {'memoização':>12} {'tabela n×(alvo+1)':>19}   quem trabalha menos")
    for k in (4, 8, 12, 16, 20):
        vk = cr.entrada_do_lab(k)
        alvo_k = sum(vk) + 1
        me_k = cr.memoizada(vk, alvo_k).trabalho
        tb_k = cr.tabela(vk, alvo_k)[0].trabalho
        quem = "força bruta" if 2 ** k < min(me_k, tb_k) else "a PD"
        print(f"{k:>4} {n_(2 ** k):>18} {n_(me_k):>12} {n_(tb_k):>19}   {quem}")
    print("Com poucos itens a força bruta ainda é barata. A cada item ela DOBRA; a tabela só cresce um pouco.")

    secao("3. Um alvo que existe")
    alvo = v[0] + v[2] + v[-1]
    me = cr.memoizada(v, alvo)
    tb, T = cr.tabela(v, alvo)
    print(f"Alvo {alvo}: memoização acha {me.itens} ({n_(me.trabalho)} chamadas); a tabela acha {tb.itens} ({n_(tb.trabalho)} células).")

    if args.passo:
        secao("Passo a passo: o que cada linha da tabela já alcança")
        pequeno = v[:6]
        alvo_p = pequeno[0] + pequeno[3]
        _, Tp = cr.tabela(pequeno, alvo_p)
        print(f"Itens {pequeno}, alvo {alvo_p}. T[i][s] = dá para somar s com os i primeiros itens.")
        for i, linha in enumerate(Tp):
            somas = [s for s, ok in enumerate(linha) if ok]
            novo = "" if i == 0 else f"  (+ item {pequeno[i - 1]})"
            print(f"  linha {i}: somas alcançáveis {somas}{novo}")
        print(f"  T[{len(pequeno)}][{alvo_p}] = {Tp[-1][alvo_p]}")

    secao("O que levar desta aula")
    print("2ⁿ dobra a cada item: com n = 40, um computador que tenta um bilhão por segundo levaria 18 minutos;")
    print("com n = 60, 36 anos. A tabela custa n × alvo: cresce com o tamanho dos NÚMEROS, não com 2ⁿ.")
    print("É por isso que a soma de subconjunto é 'pseudo-polinomial' — e é a mesma ideia da mochila (fase 8).")
    rodape("crescimento", args)


# ───────────────────────────────────────────── fase 6 · caminho


def aula_caminho(args: argparse.Namespace) -> None:
    cabecalho("caminho", args.local)
    c = ca.carregar_cidade()
    print(f"\nO grafo: {n_(c.n)} cruzamentos (vértices) e {n_(len(c.de))} trechos de rua (arestas dirigidas). {c.credito}.")
    cenarios = {k: (nome, paradas) for k, nome, paradas in ca.CENARIOS}
    nome, paradas = cenarios[args.cenario]
    print(f"Cenário do lab: {nome}.")
    nos = [c.lugares[p][1] for p in paradas]

    if len(nos) == 2:
        secao("Dijkstra, de uma ponta à outra")
        r = ca.dijkstra(c, nos[0], nos[1])
        print(f"{c.lugares[paradas[0]][0]} → {c.lugares[paradas[1]][0]}: {ca.em_minutos(r.tempo)}, {r.metros:.0f} m, {len(r.arestas)} trechos.")
        print(f"Cruzamentos resolvidos até achar o destino: {n_(r.resolvidos)} de {n_(c.n)}.")
        print("Pelas ruas: " + " → ".join(f"{rua} ({m:.0f} m)" for rua, m in ca.ruas(c, r)))
        if args.passo:
            secao("Passo a passo: os primeiros cruzamentos que o Dijkstra fecha")
            print("Cada um sai da fila com a menor distância aberta — e essa distância já é a definitiva.")
            for k, (u, d) in enumerate(r.fechados[:15], 1):
                print(f"  {k:2d}. cruzamento {u:4d} fechado a {d / 10:6.1f} s da origem")
            print(f"  … e assim até o destino, no passo {r.resolvidos}.")
    else:
        secao("1. Um Dijkstra por par de paradas: a matriz de tempos")
        T = ca.tempos_entre(c, nos)
        rot = [c.lugares[p][0][:18] for p in paradas]
        print(" " * 20 + "".join(f"{r_:>20}" for r_ in rot))
        for i, linha in enumerate(T):
            print(f"{rot[i]:<20}" + "".join(f"{ca.em_minutos(t):>20}" for t in linha))

        secao("2. A melhor ordem por PD sobre subconjuntos (Held–Karp)")
        o = ca.melhor_ordem(T)
        bruta, tb, tentadas = ca.forca_bruta_da_ordem(T)
        print("Saindo de " + c.lugares[paradas[0]][0] + ": " + " → ".join(c.lugares[paradas[i]][0] for i in o.ordem))
        print(f"Tempo total: {ca.em_minutos(o.tempo)}. A PD resolveu {o.estados} estados (S, j); a força bruta tentou {tentadas} ordens e {'concorda' if bruta == o.ordem and tb == o.tempo else 'DISCORDA'}.")
        if args.passo:
            secao("Passo a passo: por que a PD cresce devagar")
            for k in range(3, 13):
                print(f"  {k:2d} paradas: ordens = {n_(math.factorial(k - 1)):>13}   estados da PD ≤ {n_((2 ** (k - 1)) * (k - 1)):>9}")

    secao("O que levar desta aula")
    print("Um mapa é um grafo. Dijkstra é guloso, mas no critério certo: a menor distância ainda aberta.")
    print("Já a ORDEM de várias paradas não é gulosa: ir sempre à parada mais perto pode sair caro.")
    print("A PD resolve cada 'cheguei em j tendo passado por S' uma vez só, e reaproveita.")
    rodape("caminho", args)


# ───────────────────────────────────────────── fase 7 · troco


def aula_troco(args: argparse.Namespace) -> None:
    cabecalho("troco", args.local)
    s = tr.sistema(args.sistema)
    valor = args.valor or s.valor
    print(f"\nSistema: {s.nome}, moedas {list(s.moedas)}. {s.nota}")
    print(f"Troco pedido: {valor}.")

    secao("1. O guloso: a maior moeda que cabe")
    g = tr.guloso(s.moedas, valor)
    if g.moedas is None:
        print(f"Não fecha: sobram {g.sobra}. ({g.passos} moedas examinadas)")
    else:
        print(f"{' + '.join(map(str, g.moedas))} = {valor}: {len(g.moedas)} moedas ({g.passos} moedas examinadas).")

    secao("2. A tabela: todos os valores de 0 até o pedido (Tabulação)")
    o = tr.otimo(s.moedas, valor)
    if o.moedas is None:
        print(f"Não há como pagar {valor} com estas moedas. ({n_(o.passos)} passos)")
    else:
        print(f"{' + '.join(map(str, o.moedas))} = {valor}: {len(o.moedas)} moedas ({n_(o.passos)} passos = {valor} × {len(s.moedas)}).")

    secao("3. A mesma recorrência de cima para baixo")
    _, resolvidos = tr.memoizado(s.moedas, valor)
    if valor <= 40:
        _, chamadas = tr.sem_memoria(s.moedas, valor)
        print(f"Sem memória: {n_(chamadas)} chamadas. Com memória (Memoização): {n_(resolvidos)} valores resolvidos, cada um uma vez.")
    else:
        print(f"Com memória (Memoização): {n_(resolvidos)} valores resolvidos. Sem memória o número de chamadas explode; tente --valor 30.")

    ce = tr.menor_contraexemplo(s.moedas)
    print()
    print("Este sistema é canônico até 500: o guloso nunca erra." if ce is None else f"O menor valor em que o guloso erra (ou não fecha e a tabela fecha) neste sistema: {ce}.")

    if args.passo:
        secao("Passo a passo: a tabela, valor por valor")
        t = tr.tabela(s.moedas, valor)
        for v in range(0, min(valor, 40) + 1):
            m = "—" if math.isinf(t.minimo[v]) else int(t.minimo[v])
            u = "" if t.ultima[v] is None else f"(última moeda {t.ultima[v]}, vem de minimo[{v - t.ultima[v]}])"
            print(f"  minimo[{v:3d}] = {m!s:>2}  {u}")
        if valor > 40:
            print(f"  … até minimo[{valor}].")

    secao("O que levar desta aula")
    print("O guloso decide uma vez e não volta atrás. A tabela pergunta 'qual é o melhor para v?' para todo v,")
    print("e cada resposta usa as anteriores. Custa valor × moedas, e nunca erra.")
    rodape("troco", args)


# ───────────────────────────────────────────── fase 8 · mochila


def aula_mochila(args: argparse.Namespace) -> None:
    cabecalho("mochila", args.local)
    c = mo.cenario(args.cenario)
    sessao = args.sessao if args.sessao is not None else c.sessao
    itens = mo.itens_do_cenario(c)
    print(f"\nCenário do lab: {c.nome}. {c.nota}")
    print(f"Sessão: {sessao} minutos. Labs liberados:")
    for it in itens:
        print(f"  • {it.titulo:<28} {it.minutos:3d} min  {it.pontos} pts  ({it.pontos / it.minutos:.3f} pts/min)")

    secao("1. A gulosa: pontos por minuto")
    esc, pts, mins = mo.gulosa(itens, sessao)
    print(f"{', '.join(itens[k].titulo for k in esc)} → {pts} pts em {mins} de {sessao} min.")

    secao("2. A tabela T[i][c] (Tabulação)")
    r = mo.tabulada(itens, sessao)
    print(f"{', '.join(itens[k].titulo for k in r.escolhidos)} → {r.pontos} pts em {r.minutos} de {sessao} min.")
    print(f"{n_(r.celulas)} células calculadas. A força bruta (2^{len(itens)} subconjuntos) {'confirma' if mo.forca_bruta(itens, sessao) == r.pontos else 'DISCORDA'}.")
    if pts < r.pontos:
        print(f"A gulosa deixou {r.pontos - pts} ponto(s) na mesa.")
    else:
        print("Aqui a gulosa acertou — mas só porque teve sorte com os números.")

    secao("3. A recorrência de cima para baixo")
    _, sem = mo.sem_memoria(itens, sessao)
    _, com = mo.memoizada(itens, sessao)
    print(f"Sem memória: {n_(sem)} chamadas. Com memória (Memoização): {n_(com)} chamadas.")

    if args.passo:
        secao("Passo a passo: a tabela inteira")
        colunas = sessao // mo.PASSO
        marcadas = set(r.caminho)
        print("Colunas em minutos; [x] = células que a reconstrução visita, de baixo para cima.")
        print("lab".ljust(24) + "".join(f"{c_ * mo.PASSO:>5}" for c_ in range(colunas + 1)))
        for i, linha in enumerate(r.T):
            nome = "—" if i == 0 else itens[i - 1].titulo[:22]
            print(nome.ljust(24) + "".join((f"[{x}]" if (i, c_) in marcadas else f"{x}").rjust(5) for c_, x in enumerate(linha)))
        pq = mo.por_que(itens, r.T, len(itens), colunas)
        print(f"\nT[{len(itens)}][{colunas}] = max(deixa = {pq['deixa']}, leva = {pq['leva']}) = {pq['valor']}")

    secao("O que levar desta aula")
    print("Cada célula responde 'o melhor com estes labs e este tempo' e usa as de cima. A tabela lembra,")
    print("então nada é calculado duas vezes. É o mesmo plano que o lab mostra, célula por célula.")
    rodape("mochila", args)


# ───────────────────────────────────────────── índice e servidor


def indice(args: argparse.Namespace) -> None:
    titulo("OpenLabs · o handbook de algoritmos, em Python")
    print("O OpenLabs é uma plataforma gratuita para aprender tecnologia vendo funcionar: cada tema vira")
    print("um lab com animação e simulação, que roda no navegador — inclusive no computador público de um")
    print("telecentro, e até sem internet. Esta entrega é o handbook *Algorithms* do OpenLabs em código:")
    print("os mesmos algoritmos, dados e números dos labs, para ler, rodar e mudar.")
    print(f"\nO handbook no ar: {HANDBOOK}")
    print("\nAs aulas (cada uma é um lab do handbook):")
    for a in AULAS:
        print(f"\n  python main.py {a.id:<12} fase {a.fase} · {a.titulo}")
        print(f"  {'':27}{a.tecnicas}")
        print(f"  {'':27}{a.url(args.local)}")
    print("\nOutros jeitos de rodar:")
    print("  python main.py todas              as quatro aulas")
    print("  python main.py troco --passo      com o passo a passo")
    print("  python main.py troco --abrir      e abre o lab no navegador")
    print(f"  python main.py --servir           o OpenLabs inteiro em {LOCAL}, sem internet")
    print("  python benchmark.py               a eficiência, medida")
    print("  python -m unittest discover -s tests -t .   os testes (e a conferência contra os labs)")


def pasta_do_site() -> Path | None:
    for p in (AQUI / "site", AQUI.parent / "apps" / "site" / "dist"):
        if (p / "index.html").exists():
            return p
    return None


def servir(args: argparse.Namespace) -> None:
    site = pasta_do_site()
    if site is None:
        raise SystemExit("Não achei o site em site/. No ZIP ele vem pronto; no repositório, rode `pnpm build` antes.")

    class Handler(http.server.SimpleHTTPRequestHandler):
        # O Windows às vezes registra .js como text/plain, e o navegador recusa o módulo.
        extensions_map = {
            **http.server.SimpleHTTPRequestHandler.extensions_map,
            ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
            ".json": "application/json", ".wasm": "application/wasm", ".webp": "image/webp", ".woff2": "font/woff2",
        }

        def log_message(self, *a: object) -> None:  # silencioso: a aula é a página, não o log
            pass

    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", args.porta), partial(Handler, directory=str(site)))
    url = f"http://localhost:{args.porta}/handbooks/algorithms/"
    titulo("OpenLabs no seu computador")
    print(f"Servindo {site}")
    print(f"Abra: {url}")
    print("Tudo roda aqui: sem internet, sem conta, sem instalar nada. Ctrl+C para parar.")
    if not args.sem_navegador:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nParado.")
    finally:
        servidor.server_close()


AULAS_POR_ID = {"crescimento": aula_crescimento, "caminho": aula_caminho, "troco": aula_troco, "mochila": aula_mochila}


def principal(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="O handbook de algoritmos do OpenLabs, em Python (entrega de Dynamic Programming).")
    p.add_argument("aula", nargs="?", choices=[*AULAS_POR_ID, "todas"], help="a aula para rodar; sem ela, o índice")
    p.add_argument("--passo", action="store_true", help="mostra o passo a passo (a tabela enchendo, a fila do Dijkstra)")
    p.add_argument("--abrir", action="store_true", help="abre o lab gráfico da aula no navegador")
    p.add_argument("--local", action="store_true", help=f"os links apontam para {LOCAL} (use com --servir)")
    p.add_argument("--servir", action="store_true", help=f"sobe o OpenLabs inteiro em {LOCAL}, sem internet")
    p.add_argument("--porta", type=int, default=8000)
    p.add_argument("--sem-navegador", action="store_true", help="com --servir, não abre o navegador")
    p.add_argument("--n", type=int, default=12, help="crescimento: quantos itens (1 a 20)")
    p.add_argument("--cenario", help="caminho: short, across, aimed, maze, tour, errands · mochila: rafa, trap, cida")
    p.add_argument("--sistema", default="toy", help="troco: brl, pre-decimal, toy, no-one")
    p.add_argument("--valor", type=int, help="troco: o valor pedido (1 a 500)")
    p.add_argument("--sessao", type=int, help="mochila: minutos de sessão (múltiplo de 5, até 180)")
    args = p.parse_args(argv)

    if args.servir:
        servir(args)
        return 0
    if args.aula is None:
        indice(args)
        return 0
    ids = list(AULAS_POR_ID) if args.aula == "todas" else [args.aula]
    for id_ in ids:
        a = argparse.Namespace(**vars(args))
        if a.cenario is None or (id_ == "caminho" and a.cenario not in {k for k, _, _ in ca.CENARIOS}) or (id_ == "mochila" and a.cenario not in {c.id for c in mo.CENARIOS}):
            a.cenario = {"caminho": "errands", "mochila": "rafa"}.get(id_)
        try:
            AULAS_POR_ID[id_](a)
        except (ValueError, KeyError) as e:
            print(f"\nErro: {e}", file=sys.stderr)
            return 2
    print()
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # console cp1252 do Windows
    sys.exit(principal())
