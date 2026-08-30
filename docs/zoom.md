# O zoom contínuo: o interior aparece dentro da caixa

**Status:** decidido, e implementado no lab das portas.
**Data:** 2026-08-29
**Depende de:** `depth.md` (§6.2 e §6.3), spec do motor composicional
**Substitui:** o drill-down por troca de vista, que era o único gesto de descida

## 1. O problema

Descer um nível trocava a tela inteira. Duplo clique num objeto e a vista anterior
desaparecia, dando lugar a outro desenho, com outro sistema de coordenadas, outro
enquadramento e outra escala. Funciona, e foi o que permitiu chegar ao transistor — mas
custa a coisa que este projeto vende.

O que se perde num corte:

- **A relação entre os níveis.** O leitor vê o interior e não vê mais de que ele é o
  interior. Ele tem que reconstruir de memória onde estava, o que é exatamente o trabalho
  que a ferramenta deveria poupar
- **A continuidade do fluxo.** `depth.md` §6.2 já tinha decidido que descer segue a carga e
  não reinicia. Uma troca de tela reinicia a leitura, mesmo sem reiniciar o modelo
- **A escala como informação.** Que a ULA é grande e um transistor é minúsculo é um fato
  sobre o sistema. Duas telas do mesmo tamanho apagam esse fato

E há uma perda mais específica, que é a que motivou a decisão: **não dá para espiar.** Para
saber o que tem dentro de um bloco é preciso se comprometer com a descida. A curiosidade que
este projeto persegue é justamente a que quer olhar antes de decidir.

## 2. A decisão

> **Zoom contínuo com nível de detalhe.** O interior de um objeto é desenhado **dentro da
> caixa dele**, e aparece por transparência conforme a caixa cresce na tela. Não há troca
> de vista, não há corte: há uma câmera.

Três regras a sustentam.

**A caixa é a moldura, e o recorte é real.** O interior é desenhado com `clipPath` na caixa
do pai. Nada é pintado fora porque não há regra a esquecer — é a mesma decisão que
`depth.md` §6 chamou de contenção estrutural, agora com uma implementação.

**O detalhe entra por tamanho na tela, não por profundidade.** O gatilho não é "o leitor
está no nível 2"; é "esta caixa está grande o bastante para o interior dela ser legível". A
consequência é que dois blocos do mesmo desenho podem estar em estados de detalhe
diferentes ao mesmo tempo, e isso é correto: um está perto, o outro está longe.

**O interior roda.** Não é uma miniatura nem uma pré-visualização. É o mesmo mundo, o mesmo
tick, o mesmo livro-caixa. Um transistor desenhado com dois pixels de altura está comutando
de verdade, e é por isso que ele pode ser desenhado ali.

### 2.1 O que **não** muda: o formato de view

A primeira leitura do problema dizia que as posições precisariam passar a ser relativas ao
pai, e que o formato de view teria que mudar. **Está errado**, e vale registrar por que.

Uma `View` já declara a moldura dela (`width`, `height`), e o pai já declara a caixa que o
filho ocupa (`place.w`, `place.h`). A transformação entre os dois espaços fica **totalmente
determinada** por esses quatro números: é uma escala e uma translação, e o desenho a
calcula. Nada precisa ser autorado, nada precisa ser mantido em dois lugares, e nenhuma
view existente muda.

O aninhamento é, portanto, **derivado** — como tudo o que este motor desenha. Uma view não
sabe que está sendo desenhada dentro de outra, e não deve saber.

### 2.2 A escala é uniforme, e o interior é centrado

A caixa do pai e a moldura do filho raramente têm a mesma proporção. Esticar o interior para
preencher a caixa distorceria o desenho — e num esquemático a proporção **é** informação:
uma rede CMOS em paralelo desenhada esticada deixa de parecer paralela.

Então a escala é uniforme, pelo lado que aperta, e o interior fica centrado na caixa, com
folga nos dois lados do eixo sobrando. É letterbox, e é a escolha honesta.

## 3. O invariante

Sem uma regra, isto vira a coisa que o projeto mais evita: um desenho bonito afirmando algo
que o modelo não disse. A regra é uma frase:

> **O interior desenhado dentro de uma caixa é a view cujo `focus` é aquela caixa.**

Ou seja: o aninhamento não é uma escolha de apresentação, é uma consequência da árvore. Um
desenho que pusesse dentro da caixa `x` uma view focada em `y` estaria dizendo que `y` mora
em `x` — uma afirmação estrutural, feita por um componente de desenho, sem nada por trás.

O invariante é cobrado por `interiorDisagreement`, no mesmo espírito de `viewDisagreement`:
devolve texto e não booleano, porque "está errado" manda procurar, e dizer qual caixa recebeu
qual interior é o que faz o teste servir para consertar.

Vale junto com os que já existiam, e não os substitui: a view aninhada continua tendo que
concordar com a árvore, continua não podendo inventar nem esconder objeto, e continua tendo
que declarar `collapsed` para não desenhar um interior.

## 4. O que isto habilita, e que estava travado

**As fases do handbook como camadas de abstração.** Uma fase do roadmap é um nível de
abstração, e o zoom é o gesto de subir e descer entre elas. Isso deixa de ser metáfora
editorial e vira a mesma coordenada.

**Cenários.** Com o detalhe governado por escala, um cenário passa a ser *um mundo
configurado com um enquadramento inicial* — mesmo `.model`, recorte e complexidade
escolhidos. Complexidade que cresce degrau a degrau deixa de exigir motor novo e vira
configuração.

**Seguir a carga** (`depth.md` §6.3). A câmera que acompanha um item precisa exatamente
disto: que a carga exista nos dois níveis ao mesmo tempo, desenhada nos dois, sem que
descer seja um evento.

## 5. O custo, e por que ele é aceitável

Desenhar o interior de tudo o que está grande na tela multiplica os nós de SVG. O limite não
é o modelo — `depth.md` §1 já registra que profundidade quase não custa processamento,
porque o custo é das folhas ativas — é o **desenho**.

A contenção é a própria regra do nível de detalhe: um interior só é desenhado quando a caixa
dele passa do limiar em pixels. Longe, ele não existe no DOM. Isso torna o custo
proporcional ao que está **visível e legível**, que é o que se quer.

Não é a otimização recusada em `depth.md` §5.1. Aquela fazia a **simulação** depender do
foco, e por isso quebrava o determinismo. Esta faz o **desenho** depender do foco, que é o
que desenho sempre fez.

## 6. Decisões abertas

1. **Zoom por gesto contra zoom por alvo.** Hoje a roda aproxima onde o cursor está. Clicar
   num bloco para enquadrá-lo é o gesto complementar, e ainda não existe
2. **Onde o rótulo mora quando a caixa é grande.** Um bloco muito ampliado tem o nome no
   meio do interior dele. Proposta: o rótulo migra para a borda quando o interior aparece
3. **Profundidade máxima de aninhamento por quadro.** Três níveis simultâneos já foram
   testados; um limite explícito ainda não foi necessário e não foi escrito
4. ~~**O que acontece com os fios que cruzam a fronteira.**~~ **Fechada em 29/08/2026.** O
   canal atravessa: com o interior aberto, o caminho segue até a peça de dentro que de fato
   recebe, e começa na que de fato emitiu. Quem recebe é dito pelos bornes de entrada; quem
   emite, pela resolução das emissões (`emissoesPorPorta`). O desenho não escolhe nenhuma das
   duas pontas — se escolhesse, estaria afirmando ligações que ninguém declarou
5. **O gesto de toque.** A roda é o gesto do desktop; num aparelho de toque o equivalente é
   a pinça, e ela não existe. O e2e do zoom é declaradamente só de desktop por isso — não
   porque o teste seja frouxo. Enquanto não houver pinça, num telefone o drill-down continua
   sendo o duplo clique, que continua funcionando

## 7. O que quebrou no caminho, e vale não redescobrir

**`clip-path` é resolvido no espaço do próprio elemento**, transformação dele inclusive.
Recorte e transformação postos no mesmo `<g>` faziam o retângulo de recorte ser escalado
junto com o interior e cair fora da caixa. O sintoma foi cruel: o interior existia no DOM,
com opacidade 1 e tamanho certo, e a tela mostrava uma caixa vazia. O recorte vai num grupo
sem transformação, e a transformação num grupo por dentro.

**`onWheel` do React é ouvinte passivo.** `preventDefault` não faz nada, e aproximar rola a
página. O sintoma manda procurar no lugar errado, porque o desenho fica parado e quem se
mexe é a página. O ouvinte é nativo e declaradamente não passivo, e há teste para isso.

**A carga desenhada antes das caixas some atrás delas.** A esteira ia por baixo dos objetos,
e a carga desaparecia em toda caixa que cruzava — inclusive na caixa em que estava entrando,
que é exatamente o momento que se quer ver. Ela vai por cima.

**Animação SMIL não dispara em elemento recém-inserido.** O `begin` de um `<animate>` conta a
partir do início da linha do tempo do documento, e não de quando o elemento entrou nela. Como
cada tick cria elementos novos, o intervalo deles já nascia no passado, e a carga aparecia
congelada no valor final — opacidade zero. A esteira foi para animação CSS (`offset-path`),
que começa quando o elemento entra.

**Traço não é escala.** Sem `vector-effect: non-scaling-stroke`, a 20× uma borda de 1px vira
uma faixa de 20 e o desenho some debaixo do próprio contorno. Traço é notação, e notação tem
tamanho fixo.
