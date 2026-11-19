# Prompts usados (IA como copiloto)

Os combinados da GS pedem que a equipe registre os prompts usados com IA. Este arquivo registra os desta parte. A ferramenta foi o Claude Code, assistente de programação da Anthropic, usado dentro do repositório do OpenLabs.

## 11/11/2026: a primeira versão

**Pedido da equipe:**

> vamos seguir o desenvolvimento e melhorias da plataforma, também vamos fazer os entregaveis da gs relacionados, foco agora é algoritmos

A primeira versão foi um "planejador do telecentro": o telecentro mais perto a pé, o que estudar na sessão e quem usa o computador de atendimento.

## 19/11/2026: a entrega passa a ser o handbook de algoritmos

**Pedidos da equipe:**

> calma voce errou programação dinâmica, a nossa missão é com o ensino e estudo dos temas, temos a aba do open labs para isso, para ensinar de forma grafica e simulações para democratizar o ensino e eexepmlos de códigos todos gratuitos, é esse vies que eu quero

> é o open labs, não como o open labs faz, é literalmente o handbook de algoritomos

> quero que isso fique claro na entrega, que de para o professor acessar de forma facil, e que tenha entregaveis e um python por exemplo que de para fazer isso

> quero também que você reforce a missão do open labs, que deixe isso claro na plataforma, de uma opção para rodar em localhost, tipo o cara subir na máquina dele mesmo

**O que a IA fez:**

- reescreveu a entrega como o handbook *Algorithms* do OpenLabs em Python (`handbook/`): uma aula por lab (fases 3, 6, 7 e 8), portando o código TypeScript dos labs (`packages/algo-domain`) com os mesmos dados e cenários;
- acrescentou a versão memoizada e a tabulada onde o lab só mostra uma, e a melhor ordem de paradas por Held–Karp, onde o lab tenta as permutações;
- criou a referência exportada do código dos labs (`exportar_referencia.mjs`) e os testes que conferem o Python contra ela;
- escreveu o `main.py` (o índice, as aulas, `--passo`, `--abrir` e `--servir`), o `benchmark.py` e este README;
- no site, acrescentou à página inicial a seção "Por que o OpenLabs existe", com a missão e como rodar no próprio computador.

**Uma correção que a revisão pegou:** a primeira versão da aula de crescimento comparava a força bruta com a tabela só em n = 12, onde a tabela ainda custa **mais** (8 712 células contra 4 096 subconjuntos). A aula passou a mostrar n de 4 a 20 e onde a PD passa a ganhar.

## O que a equipe precisa conferir e saber explicar

- [ ] as quatro recorrências (seção "Os algoritmos" do README) e por que cada uma é Programação Dinâmica (subproblemas que se repetem + subestrutura ótima);
- [ ] a diferença entre memoização (de cima para baixo, guardando) e tabulação (de baixo para cima, preenchendo), em `troco.py` e `mochila.py`;
- [ ] por que a soma de subconjunto pela tabela é pseudo-polinomial, e em que n ela passa a ganhar da força bruta;
- [ ] por que o Dijkstra pode fechar um cruzamento de vez, e por que a ORDEM de várias paradas não é gulosa;
- [ ] o que `melhor(S, j)` significa no Held–Karp, e por que são 2ᵏ × k estados;
- [ ] como a reconstrução da mochila sabe quais labs entraram;
- [ ] o que a referência dos labs garante, e o que aconteceria se um lab mudasse sem ela.
