# Túneis no cruzamento — desenho

**Data:** 2026-09-08.
**Alcance:** o palco (`packages/depth-ui`), e portanto os dois handbooks de uma vez.
**Precedência:** `DECISIONS.md` manda; depois a spec do handbook
(`2026-08-28-otel-visual-handbook-design.md`); depois o refino gráfico
(`2026-08-30-refino-grafico-e-pedagogico-design.md`), de onde vêm o catálogo e a medida de
espaguete. Este documento não revoga nenhum dos três.

---

## 1. O defeito

O Luigi, olhando os labs: *"estamos tendo quebras e sobreposição de faixas, assim como
Factorio, podemos resolver isso com figuras como 'túneis' — sistema que permite essas
passagens sem confundir e sem sobrepor belts"*.

O que se vê na tela (medido em 08/09/2026, viewport de 1600): no `micro`, fios pretos
cortam os dois barramentos verdes; no `cpu`, o mesmo com o barramento de instrução e o de
dados. Em nenhum desses pontos o desenho diz se o fio **fala** com o barramento ou só
**passa por cima dele**.

O projeto já tem metade da resposta: **o T ganha pontinho de junção e o X não ganha**, e a
ausência do ponto é o que diz que dois fios não se falam. É uma convenção de esquemático,
correta e antiga — e ela é **muda por ausência**. O leitor que não conhece a convenção não
tem como saber que a falta de um pontinho significa alguma coisa; e num cruzamento entre um
fio magro e uma faixa larga, o ponto que não está lá é pequeno demais para ser notado como
ausente.

O túnel troca uma ausência por uma presença.

## 2. A tese

**Onde dois fios se cruzam, um mergulha.** Ele some alguns pixels antes do cruzamento e
reaparece depois, com uma **boca** em cada ponta. Quem passa por cima segue inteiro.

É a gramática do Factorio, que é a gramática deste projeto desde o `DECISIONS.md` §1: o
belt subterrâneo existe lá pela mesma razão que aqui — a única forma de duas esteiras se
cruzarem sem que o jogador tenha de adivinhar o que se mistura com o quê.

E é regra única, **sem exceção a decorar**: vale em todo cruzamento, nos dois handbooks. Uma
regra com exceção ("só quando engana") obriga o leitor a saber quando ela vale, e um leitor
que precisa saber isso não ganhou nada.

## 3. Quem mergulha, e por que isso não pode ser sorteio

Decidido, na ordem, e a primeira regra que resolver decide:

1. **o fio mais estreito mergulha sob o mais largo** — fio magro passa por baixo do
   barramento, e não o contrário. A faixa larga é a que o leitor está seguindo;
2. **empate: o vertical mergulha sob o horizontal** — o olho segue a linha deitada;
3. **empate ainda: a ordem dos identificadores das arestas.**

A terceira existe para que a decisão seja **total**. Um critério que empata em algum caso
deixa aquele caso para o acaso da ordem de renderização, e aí a mesma vista desenha
diferente entre dois carregamentos — o mesmo defeito que fez os blocos do exercício de
instrumentação serem embaralhados por semente e não por sorteio.

## 4. A decisão que sustenta o resto: o buraco é máscara, não outro `d`

A implementação óbvia é partir o caminho do fio que mergulha em dois `path`. Ela limpa a
tela **e cega a medida**.

`meada()` lê os `d` que a página desenhou, e dois trechos que não se tocam não se cruzam. Com
os caminhos partidos, o `cpu` passaria de quinze cruzamentos para perto de zero **sem que
uma linha do desenho tivesse melhorado**, e o teto viraria a descrição de um estrago que
ninguém mais vê. É exatamente a mentira silenciosa que o `otel-vh-defeito-mentira-silenciosa`
descreve, e desta vez com a agravante de a própria guarda ter sido desligada pela mudança.

Então:

> **O `d` do fio continua inteiro. O vazio é uma `<mask>` que fura o traço nos pontos de
> travessia.**

O que isso compra, e é o ponto do desenho inteiro: a medida não precisa ser ensinada sobre
túneis, nem confiar que alguém a ensinou. Ela lê o mesmo `d` de antes. **Não existe caminho
pelo qual o túnel encoste no número** — a validação está no lugar onde a violação é
impossível, e não numa checagem que alguém tem de lembrar de escrever.

O grupo de cada aresta (`<g data-de data-para>`) já contém os quatro `path` com o mesmo `d`
— leito, trilho, marcha, pulso. A máscara se aplica ao grupo, então o vazio vale para os
quatro de uma vez, incluindo o pulso animado. Um fio aceso mergulha aceso.

## 5. Uma fonte por fato

Os pontos de túnel saem da **mesma função** que acha os cruzamentos: `seCruzam`, de
`packages/depth-ui/src/espaguete.ts`, hoje privada, que passa a ser exportada como
`cruzamentos(caminhos)` devolvendo os pontos, e não só a contagem.

Um segundo detector de cruzamento — um para desenhar, outro para medir — discordaria do
primeiro exatamente no dia em que um deles ficasse errado. É a régua que o repo já pagou
para aprender duas vezes: os labs saem do mapa, e o `href` sai de um lugar só.

Consequência aceita: `espaguete.ts` deixa de ser só uma medida e passa a ser **a geometria
dos encontros** — cruzamento, sobreposição, junção e agora travessia. O nome do arquivo
envelheceu; renomear fica para quando ele sair para repo próprio, pela mesma razão que
`@ovh/` continua `@ovh/`.

## 6. A boca

Um triângulo pequeno, do tamanho e da cor do fio que mergulha, apontando **para dentro do
chão** na entrada e **para fora** na saída — a mesma leitura do belt subterrâneo. O par é o
que o olho usa para reconstituir a linha, então as duas bocas são sempre do mesmo tamanho e
do mesmo lado da lacuna.

Ela entra no **catálogo** do `stage.css` como forma lida por sentido, sem tinta escrita fora
— `pnpm catalogo` reprova hexadecimal, inclusive em comentário. A cor não é própria: a boca
usa o token do fio a que pertence, senão um túnel de linha de controle sairia preto e diria
que ali passa dado.

No DOM, cada boca carrega `data-tunel` com a chave da aresta dona. É o que permite ao teste
cobrar **par**, e não só presença — e é a diferença entre o desenho que você vê e o atributo
que estava certo enquanto o CSS não pintava.

## 7. O que a suíte passa a cobrar

Em `apps/site/tests/espaguete.spec.ts`, por lab, e todos com mutação (apagar a regra, ver
cair, restaurar):

1. **nenhum cruzamento nu** — todo cruzamento desenhado tem exatamente um par de bocas;
2. **nenhuma boca órfã** — toda boca cai sobre um cruzamento real. Sem isto, uma boca solta
   é um fio que parece quebrado, que é o defeito que abriu esta rodada;
3. **boca vem em par** — duas, mesma `data-tunel`, mesma lacuna. Uma sozinha é a quebra;
4. **os tetos não mudam** — 15 no `cpu`, 7 no `micro`, 5 no `gates`, 4 no `rpn`, 1 no
   `providers`. Túnel resolve a **leitura**, não o orçamento: se ele abatesse, a saída barata
   para uma vista embaralhada passaria a ser tunelar em vez de reorganizar;
5. **sobreposição cega continua zero** — túnel não conserta sobreposição. Dois fios andando
   na mesma reta continuam se lendo como um só, e continuam proibidos;
6. **a contagem de túneis aparece ao lado** da de cruzamentos, como número informativo. Um
   lab com quinze cruzamentos e três túneis está com doze cruzamentos nus e falhando o item 1.

E, porque desenho se confere olhando: um passo manual de captura dos cinco labs, antes e
depois. Depois de mexer no desenho, olhar o desenho.

## 8. O que este round deliberadamente não faz

- **Soltar o roteador.** Com o cruzamento legível, cruzar deixa de ser caro, e os pesos de
  hoje (`atravessar caixa` 100, `repetir reta` 1) passam a poder ser reequilibrados para o
  roteador organizar corredores em vez de fugir deles — que é o ganho que o Luigi nomeou
  ("desenho coerente e organizado dos fluxos"). Fica para a **rodada seguinte**, de
  propósito: com o túnel entrando sozinho e os tetos parados, dá para ver o que o túnel fez.
  Mudar os dois juntos deixaria a piora sem dono;
- **Túnel declarado no modelo.** O autor não escolhe onde um fio mergulha. O túnel é
  desenho, sai da geometria, e o domínio não ganha vocabulário novo — a fronteira do CI
  continua sem se pronunciar sobre isto porque não há o que pronunciar;
- **Ponte (a curvinha).** Quebra a regra do cotovelo reto, e pior: `segmentos()` não sabe ler
  arco e o pula calado. A medida passaria a dizer "limpo" sobre um trecho que ela não
  consegue ler;
- **Só o corte, sem boca.** É a convenção discreta, e discreta é o defeito: no laptop de 1280
  o rótulo do palco chega com 8,4 pixels, e uma lacuna sem símbolo naquela escala é
  indistinguível de um fio que acabou.

## 9. As peças

| Arquivo | O quê |
| --- | --- |
| `packages/depth-ui/src/espaguete.ts` | `cruzamentos()` exportado: os pontos, não só a conta |
| `packages/depth-ui/src/tunel.ts` (novo) | quem mergulha, e onde ficam as bocas e a lacuna |
| `packages/depth-ui/src/tunel.test.ts` (novo) | a decisão é total, estável e determinística |
| `packages/depth-ui/src/Stage.tsx` | a `<mask>` por aresta, e as bocas |
| `packages/depth-ui/src/stage.css` | a boca no catálogo, sem tinta escrita |
| `apps/site/tests/espaguete.spec.ts` | os cinco invariantes da §7 |
