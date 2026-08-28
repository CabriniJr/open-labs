# Profundidade: autoria, execução e custo

**Status:** proposta para discussão.
**Data:** 2026-08-28
**Depende de:** `VISION.md`, `kinds.md`

A pergunta "bottom-up ou top-down?" esconde **três** perguntas com respostas diferentes.
Misturá-las é o que faz a decisão parecer impossível.

| Pergunta | Resposta |
|---|---|
| **Execução** — quem produz o comportamento observado? | **Bottom-up**, e não é negociável |
| **Autoria** — em que ordem o modelo é escrito? | **Top-down**, com fechamento progressivo |
| **Currículo** — em que ordem o leitor conhece as peças? | **Bottom-up**, ao estilo Factorio |

As três podem coexistir, e é justamente por coexistirem que a discussão trava quando são
tratadas como uma só.

## 0. O que Factorio dá aqui, e o que não dá

A intuição de que Factorio sugere bottom-up está certa — mas sobre o **currículo**, não
sobre o drill-down.

**Factorio é plano.** Não existe drill-down nele: uma montadora não abre para revelar o
mecanismo interno. A composição em Factorio é a **receita** — minério vira placa, placa vira
engrenagem, engrenagem vira cinta — e ela se espalha no plano, não em camadas aninhadas. A
profundidade dele é espacial e sequencial, não hierárquica.

Então:

| Factorio dá | Factorio não dá |
|---|---|
| **Currículo bottom-up**: você começa com o mecanismo simples e vai compondo para cima | Modelo de drill-down. Não há interior de bloco para abrir |
| A gramática de cano contra máquina (`kinds.md` §1) | Hierarquia de abstração |
| Backpressure aprendido sem texto | Fidelidade a sistema real |

Para o drill-down, as referências certas são outras: Logisim, com subcircuito que abre, e
Ptolemy II, com composição hierárquica de atores. Usar Factorio para decidir a arquitetura
de profundidade seria aplicar a referência fora do domínio em que ela vale.

---

## 1. Execução é bottom-up, e a spec está certa

A spec do motor já decide: só folha tem comportamento; composto não tem comportamento
próprio, e o que ele faz é o resultado de rodar os filhos.

Isso não é preferência de estilo. É o que impede o nível de cima de mentir sobre o de
baixo. Se um composto pudesse ter comportamento próprio, o L0 e o interior seriam duas
verdades independentes, e elas divergiriam no primeiro ajuste de parâmetro — em silêncio, e
passando nos testes.

**Consequência boa e pouco óbvia:** profundidade praticamente não custa processamento. O
custo é proporcional ao número de **folhas ativas**, não ao número de níveis. Uma árvore de
seis níveis com trinta folhas custa o mesmo que uma árvore de dois níveis com trinta
folhas.

---

## 2. Autoria é top-down, senão nada aparece na tela

Autorar bottom-up significaria implementar a fila, o gatilho, o exportador, o enquadramento
HTTP/2 e os bytes **antes** de existir qualquer coisa visível. Isso é caro, lento, e
constrói profundidade que talvez nunca seja usada — que é a descrição exata de trabalho
desperdiçado.

O caminho proposto: **declarar o bloco raso primeiro e aprofundar depois**, com três estados
possíveis por bloco.

| Estado | O que é | Honesto? |
|---|---|---|
| **Opaco** | Bloco declarado sem interior e **marcado como não modelado** | Sim. É a caixa que admite não saber |
| **Aproximado** | Folha com comportamento simplificado, com a simplificação declarada | Sim, e é onde o modelo passa a maior parte da vida |
| **Refinado** | A folha foi substituída por filhos que produzem o comportamento | Sim |

O único estado proibido é o quarto: **interior detalhado que não é derivado** — roteiro
desenhado para parecer certo. É o único caso em que o modelo mente, e é contra ele que todo
o resto existe.

---

## 3. O mecanismo que torna o aprofundamento seguro

Aqui está o ponto que resolve a preocupação com erro acumulado por camada.

Quando uma folha aproximada é substituída por uma subárvore, as duas versões passam a
existir — e podem ser comparadas:

> **Teste de refinamento.** Rodar o modelo com a folha aproximada e com a subárvore que a
> substitui deve produzir comportamento equivalente **na fronteira** do bloco, com a mesma
> semente.

Isso é automatizável e é property test, no mesmo espírito do teste 2 da spec do motor
(agregado é fronteira). E o valor dele é duplo:

- **Aprofundar deixa de ser risco.** Cada nível novo tem de concordar com o nível que ele
  substitui
- **Quando não concorda, a informação é preciosa.** Significa que a aproximação de cima
  estava mentindo. Descobrir isso é o resultado mais útil que o teste pode dar

Sem esse teste, cada camada nova é uma aposta, e o medo de aprofundar é justificado. Com
ele, profundidade é incremento verificado.

### 3.1 Equivalência "na fronteira" precisa de definição

Equivalência exata não vai acontecer — a folha é aproximação. O que precisa ser definido, e
está aberto:

- **Qualitativa:** os mesmos regimes acontecem, na mesma ordem, e as mesmas perturbações
  produzem o mesmo desfecho. Compatível com a régua declarada do projeto ("a decisão
  aparece?")
- **Quantitativa com tolerância:** volume por porta dentro de uma faixa. Mais forte, e
  arrisca falhar por ruído

Proposta: qualitativa, verificando sequência de regimes e conservação — nada aparece nem
desaparece sem um objeto que crie ou descarte.

---

## 4. Até onde descer

### 4.1 Cada nível paga em fenômeno

A spec já tem o critério de abertura: um objeto é abrível se seus filhos trocam mensagens
que o leitor consegue ver acontecer. Vale somar um critério de custo:

> Um nível novo só existe se revelar um **fenômeno** novo — uma decisão, um regime, ou uma
> perturbação possível. Nível que só revela campos é prosa no inspector, não profundidade.

O custo de um nível não é implementação. É **manutenção e fidelidade**: cada nível novo é um
conjunto de afirmações técnicas que precisam de âncora e que podem apodrecer quando o
upstream muda.

### 4.2 O problema não é a árvore ser profunda — é o lab começar longe

Insight que reenquadra a preocupação: a spec já permite que **cada lab declare sua própria
raiz**. Então uma árvore de seis níveis é perfeitamente navegável se os labs começarem no
nível certo.

Se o leitor precisa de mais de duas ou três descidas para chegar ao fenômeno que o lab
prometeu, o problema não é a profundidade da árvore — é o **enquadramento do lab**. A
correção é mover a raiz para baixo, não podar a árvore.

Isso separa duas coisas que estavam juntas: a árvore pode ser profunda (fidelidade), e cada
lab é raso (usabilidade).

---

### 4.3 O currículo é bottom-up, e ele se implementa movendo a raiz

Aqui as duas ideias se encaixam sem conflito.

Um currículo ao estilo Factorio — conhecer a peça simples antes da composição — **não exige
autorar bottom-up nem mudar o motor**. Ele se implementa como uma sequência de labs cuja
raiz sobe:

| Lab | Raiz declarada | Fenômeno |
|---|---|---|
| 1 | a fila | enche, drena, transborda |
| 2 | o lote e o gatilho | por que esperar antes de mandar |
| 3 | o BatchSpanProcessor | fila mais lote mais exportação, juntos |
| 4 | o TracerProvider | onde isso vive, e o que decide antes |
| 5 | provider mais canal | o que acontece quando a saída fecha |

A árvore é a mesma nos cinco. Muda só onde o leitor entra — e a spec já permite isso, porque
cada sessão declara sua raiz.

Consequência prática: **o primeiro lab não deve ser o TracerProvider inteiro.** Deve ser a
fila. O leitor conhece a peça, entende o regime dela, e só então a vê dentro de algo maior.
Isso é exatamente o gesto que Factorio faz, e é gratuito aqui.

### 4.4 Os dois modos têm currículos opostos, e isso precisa ser declarado

Há uma tensão real entre o currículo bottom-up e a premissa de entrada do produto.

| Modo | Público (`VISION.md` §2) | Direção |
|---|---|---|
| **Trilha** | Estudante de ops | **Bottom-up.** Começa com uma peça; cada lab acrescenta uma |
| **Importar** | Time de plataforma | **Top-down.** Recebe o sistema inteiro do próprio `compose` e desce |

Quem despacha um `compose` recebe tudo de uma vez — o oposto de Factorio, onde você começa
com uma cinta e uma broca. Os dois modos são legítimos e servem os dois públicos declarados,
mas têm necessidades de interface diferentes: a trilha precisa de sequência e progresso; o
importar precisa de visão geral e busca.

**Tentar servir os dois com a mesma tela falha nos dois.** Melhor declarar que são dois
modos sobre o mesmo modelo do que descobrir isso depois, quando a interface já estiver
comprometida com um deles.

Nota de escopo: a v0 precisa de **um** modo. O modo trilha é o que exercita o currículo e o
handbook gerado; o modo importar é o que exercita as três camadas de importação. Escolher
qual vem primeiro é decisão aberta — e a resposta provavelmente é a trilha, porque ela não
depende do parser nem do resolvedor de imagem.



## 5. Custo: o que realmente cresce

Profundidade não custa. **Cardinalidade** custa.

Descer até os bytes multiplica o número de objetos em trânsito: um span vira um documento,
que vira N quadros, que viram M bytes. Isso é explosão de itens, não de níveis.

O motor já tem a peça para conter isso: `Message` tem **peso**. Uma carga de peso N
representa N itens sem instanciar N objetos. Um lote de 512 spans é uma mensagem de peso
512, e o desenho mostra isso como massa, não como 512 partículas.

### 5.1 A otimização tentadora e o problema dela

A ideia natural seria **materializar só o interior do bloco em foco** e rodar o resto na
versão folha aproximada. Custo constante, profundidade ilimitada.

**Isso quebra duas garantias do projeto.** Se a materialização depende do foco, então o
resultado da simulação depende de onde o usuário estava olhando. Duas pessoas abrindo o
mesmo deep link, com navegação diferente, veriam execuções diferentes — e o handbook não
poderia mais apontar para um fenômeno específico. O determinismo deixa de valer no que
importa.

Recomendação: **materializar tudo sempre**, e conter o custo com peso. Um lab didático tem
dezenas de blocos, não milhares; a otimização resolve um problema que provavelmente não
existe. Se um dia existir, ela volta **junto com** o teste de refinamento da §3 como
obrigatório, e o caminho de foco entra no histórico como evento — nunca como estado
implícito.

---

## 6. Apresentação

### 6.-1 Os quatro níveis já existem, e mapeiam nas roles do motor

**Corrigido em 28/08/2026.** Este documento foi escrito assumindo profundidade recursiva
homogênea. A spec do handbook (§4) já define **quatro níveis nomeados**, e a reconciliação é
melhor que qualquer das duas versões isoladas.

| Nível | O que mostra | O que se abre | `Role` em `model.ts` |
|---|---|---|---|
| **L0 · Flow** | Topologia, telemetria fluindo | — é a vista de cima | `node` |
| **L1 · Mechanism** | Engrenagens dentro de um componente | Um bloco | `node` |
| **L2 · Wire** | O protocolo carregando aquilo | **Um cano** | `channel` |
| **L3 · Payload** | O dado, campo a campo | **Uma carga** | `message` |

Os níveis **não são graus de contenção** — são os **tipos de coisa que se abre**. E o motor já
tem exatamente essas três roles. A recursão acontece dentro de L1; L2 e L3 são mudanças de
natureza, não de profundidade.

Duas consequências que valem mais que a arrumação:

**O conflito cano-transformação se resolve sozinho.** `VISION.md` §7.4 registrou a tensão entre
"cano nunca transforma" e a spec dizendo que o `channel` pode transformar a carga. Com L2 sendo
*o canal aberto*, o enquadramento HTTP/2 é um bloco **dentro** do cano — que é precisamente a
resolução que havia sido proposta. A spec do handbook já apontava para lá.

**O `weight` da mensagem ganha um lugar visual.** L3 abre uma carga; uma carga de peso 512 é um
lote, e abri-la mostra os 512. Contenção de cardinalidade (§5) e nível L3 são a mesma peça.


### 6.0 O drill-down é orientado por fluxo, não por contenção

Registrado em 28/08/2026, e é o ponto que organiza toda a apresentação.

Há duas formas de descer numa hierarquia, e elas produzem produtos diferentes:

| | Por contenção | **Por fluxo** |
|---|---|---|
| O que você faz | Abre o componente e vê os filhos | **Segue a carga** |
| Metáfora | Explorador de arquivos | Acompanhar um item na esteira |
| Ao entrar num bloco | Começa do zero, olhando um conteúdo | Continua no caminho, um nível abaixo |
| O que orienta o layout | Ordem de declaração | **A direção do fluxo** |

O motor já está preparado para a segunda: `tree.ts` tem `flowChildren`, `entryLeaf` e
`exitLeaf` — ou seja, um composto sabe por onde o fluxo entra e sai dele. Isso é o que permite
descer **no meio de uma cadeia** e continuar seguindo, em vez de se perder.

Consequências de desenho, todas derivadas:

- **Descer preserva continuidade.** A carga que estava na entrada do bloco aparece entrando no
  `entryLeaf`. Não há salto, não há recomeço
- **A ordem de leitura interna é o fluxo**, não a declaração. Favorece layout da esquerda para
  a direita, que é o que dagre já dá
- **O foco é um caminho**, não um nó — a razão de ser breadcrumb e não escada

### 6.1 O recurso que isso habilita: seguir a carga

> Selecione uma carga e mande a vista **acompanhá-la**. Quando ela cruza a fronteira de um
> bloco, o foco desce sozinho. Quando ela sai, o foco sobe.

É a câmera seguindo o item. Em Factorio você faz isso com os olhos, porque o mundo é plano;
aqui o nível muda junto.

Vale destacar porque é o argumento mais concreto a favor do motor (`why-simulate.md` §7.2):
**isso é impossível com visualizadores independentes por conceito.** Exige que a mesma carga
exista nos dois níveis ao mesmo tempo, derivada — e é exatamente o que a vista agregada como
projeção de fronteira garante.


O que o leitor experimenta ao descer, e as regras que sustentam isso.

| Regra | Por quê |
|---|---|
| **Descer nunca reinicia** | Mesma razão de mudar parâmetro não zerar o tick: o leitor perde o estado que acabou de construir e nunca vê a transição, que é onde está o aprendizado |
| **Contenção é estrutural** | O interior é desenhado dentro de uma moldura com recorte real. Nada é pintado fora porque não há regra a esquecer |
| **Selecionar não é abrir** | O curioso precisa poder perguntar "o que é isso?" sem se perder |
| **Breadcrumb, não escada** | Não existe "nível 2". Existe um caminho, e o caminho é a navegação |
| **O bloco opaco se declara opaco** | Bloco sem interior tem aparência própria de "não modelado". Nunca uma caixa vazia que sugere conhecimento que não existe |
| **A vista de cima é projeção, não resumo autorado** | O que aparece na borda de um bloco fechado é exatamente o que cruzou as portas dele |

A última é a que faz as outras funcionarem: se a vista agregada é derivada, então descer
nunca contradiz o que estava sendo mostrado. Descer **detalha**, não corrige.

---

## 7. Decisões abertas

1. **Definição de equivalência de fronteira** para o teste de refinamento (§3.1). Proposta:
   qualitativa, por sequência de regimes mais conservação
2. **Materializar tudo ou por foco** (§5.1). Proposta: tudo, contendo por peso
3. **Qual modo vem primeiro na v0** (§4.4): trilha ou importar. Proposta: trilha, porque não
   depende do parser de manifesto nem do resolvedor de imagem
4. **Ordem dos labs da trilha** (§4.3). Proposta: começar pela fila, não pelo provider
5. **Profundidade máxima do primeiro pacote.** Sugestão: até a fila e o gatilho, deixando o
   interior do canal — enquadramento HTTP/2 — como aproximado e declarado, para ser refinado
   depois com o teste da §3 valendo
6. **Como o bloco opaco aparece** sem parecer defeito da ferramenta
