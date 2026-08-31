# Refino gráfico e pedagógico dos labs — desenho

**Data:** 2026-08-30. **Origem:** auditoria agêntica em três frentes (gráfica, sobre as
telas reais dos três labs no Chrome; de modelo, sobre `cpu-domain`; de conteúdo, sobre a
Ficha e a camada de descrição).

## O problema

Os labs amadureceram como simulação e ficaram para trás como desenho. A auditoria achou
três coisas que a tela **afirma e não cumpre**, um zoom que não é zoom, e um painel de
detalhes que explica o objeto em vocabulário do motor — o leitor clica em `PC` e descobre
que aquilo é um `buffer` de capacidade um, nunca que é o endereço da próxima instrução.

## O princípio que muda

O critério de profundidade era **"abrir isto ensina algo ao motor"**. Ele estava certo
enquanto o alvo era amadurecer o motor, e cumpriu: a F6 bateu o critério de reentrada e o
sinal de parada apareceu — abrir a unidade lógica seria repetir o trabalho do somador.

A partir daqui o critério é **"abrir isto ensina algo a quem lê"**. Quem lê a tela não
ganha nada com prova feita em outro lugar do modelo. A unidade lógica volta a ser
candidata a abrir, e ela não é a única.

Isto não revoga o critério antigo: ele continua valendo para decidir o que o **motor**
precisa ganhar. São duas perguntas diferentes, e a F6 confundiu as duas porque, até ali,
as respostas coincidiam.

## Decisões tomadas (2026-08-30, pelo Luigi)

1. **A descrição de domínio mora em `labels.ts`**, num mapa `DESCRICOES` ao lado de
   `ROTULOS`, travado por teste bidirecional. O medo escrito no topo de `Ficha.tsx` era de
   uma segunda descrição do **modelo** — topologia e comportamento — divergindo do que está
   desenhado. "O que é um PC" não é derivável do modelo, então não pode divergir dele; só
   pode ficar órfã num rename, e é isso que o teste tranca. Mantém a decisão de "um arquivo
   só para traduzir", que é o que torna a versão pt-BR para as aulas uma troca de arquivo.
2. **O sentido da cor é local ao nível de abstração**, com legenda no palco nomeando a
   convenção do nível atual. Um diagrama de blocos e um esquemático são duas linguagens de
   desenho; ninguém confunde porque nunca aparecem no mesmo quadro, e o breadcrumb já diz em
   qual o leitor está.
3. **As mentiras vêm antes do refino.** Defeito onde a tela ou o texto afirma o que não é
   tem precedência sobre qualquer melhoria.
4. **Cores e simbologia são consistentes entre labs**, por catálogo com fonte única, não por
   disciplina.

## Entrega 0 (transversal) — o catálogo da linguagem visual

Cor e forma viram um catálogo nomeado, num lugar só em `depth-ui`. Nenhum lab escreve cor
ou forma própria.

- O catálogo é lido **por nome** de sentido — `linha-de-controle`, `nivel-alto`,
  `conduzindo`, `alimentacao`, `terra` —, nunca por valor. É o que faz a mesma leitura valer
  nos dois temas sem virar dois desenhos.
- Cada **nível de abstração** tem seu registro declarado no catálogo. Vermelho quer dizer
  controle no diagrama de blocos e alimentação no esquemático, e isso está escrito, não
  implícito.
- A **legenda do palco é lida do catálogo**. Escrita à mão, ela é uma segunda fonte e
  diverge — o defeito de sempre.
- **Guarda:** cor ou forma declarada fora do catálogo reprova o CI, como
  `scripts/check-boundaries.mjs` já reprova vocabulário de domínio no motor.

Consequência aceita: a troca para a convenção preto/vermelho acontece **nos três labs de
uma vez**. No RPN, "controle" é a pilha pedindo o próximo símbolo à fita — o mesmo eixo do
motor num domínio sem eletrônica nenhuma. Vermelho ali continua querendo dizer controle, e é
isso que prova que a convenção é do motor e não da CPU.

## Entrega 1 — o que a tela afirma passa a ser verdade

1. **A porta acesa passa a existir.** O texto do lab de gates promete que "uma porta acesa
   é uma porta cuja saída é 1; uma apagada rodou e disse zero". A auditoria comparou o
   estilo computado (`fill`, `stroke`) das caixas com `a=b=0` e com `a=6,b=7`: idênticos. O
   corpo da porta passa a carregar o valor emitido, **persistente enquanto o valor durar**,
   não um flash no tick da mudança.
   **Teste:** compara o estilo computado de uma porta em 1 contra uma em 0 e exige que
   difiram — cobra o desenho, não o atributo, que é a lição da caixa recolhida (o atributo
   certo com desenho errado passou por resolvido e não estava). Mutação obrigatória.
2. **Seleção fora do enquadramento não é seleção.** Descer até o NAND, ler a ficha e voltar
   ao topo pelo breadcrumb deixava a ficha mostrando `NAND / bit1-xor2-g2` — descrição de
   peça que não está em tela. A correção é regra sobre o substantivo certo, não "limpar ao
   clicar no breadcrumb": senão sobra sempre um caminho de navegação não coberto.
3. **Os sinais de controle param de vazar.** `datapath.ts` emite `"ler"`, `"escrever"`,
   `"nada"`, `"ula"`, `"mem"`, `"pc4"` crus no payload, e `carga.ts` imprime na linha
   tracejada. Passam a ser os nomes do livro: `MemRead`, `MemWrite`, `RegWrite`, `ALUSrc`,
   `MemToReg`. A guarda de idioma passa a varrer o payload das mensagens de sinal, não só o
   `label` do nó — ela existe para isto e não pegou porque nenhuma daquelas palavras tem
   acento.
4. **O transistor ganha símbolo próprio.** Hoje ele herda o trapézio do seletor e a ficha o
   descreve como "a mux is a router". Não é só texto ruim: é símbolo errado. Um transistor
   não é uma escolha, é uma chave.
5. **Os 32 somadores completos entram em ordem e ganham nome.** A grade mostrava bit1, bit2,
   bit3 e pulava para bit14, bit13, bit12 — quem tenta seguir o vai-um em cascata não
   consegue. E o rótulo é o id cru (`bit0`), não "full adder".
6. **`sub` não passa pelo somador — declarado.** `sub` é resolvido como número dentro da
   unidade lógica, sem visitar o somador de 32 bits. É simplificação legítima, mas o
   comentário atual de `alu.ts` só declara que a lógica bit-a-bit ficou de fora, o que
   sugere que o resto desce. Meia declaração é meia mentira.

## Entrega 2 — a cor diz o que a coisa é

Aplicação do catálogo da Entrega 0.

- **Blocos:** dado preto, controle vermelho, fiel à figura canônica. "Preto" e "vermelho"
  são token, não tinta — preto puro morre no tema escuro. A convenção é a leitura.
- **Esquemático:** vermelho é Vdd, preto é terra.
- **Transistor:** PMOS e NMOS distintos por forma **e** cor; conduzindo contra cortado como
  estado persistente. Hoje os sete objetos daquele nível são o mesmo azul, e a resposta de
  "por que esta porta deu 1" está em texto pequeno.
- **Nível lógico no fio:** 1 e 0 legíveis de relance, enquanto o valor durar.
- A legenda do palco resolve de quebra o série-contra-paralelo, hoje legível só por quem já
  sabe a convenção — e ele é o que separa NAND de NOR.

## Entrega 3 — o movimento é específico, e o pacote se transforma

- **A regra da esteira do RPN vira geral.** O pulso viajando pelo conduíte é a melhor
  animação de trânsito dos três labs; os barramentos da CPU e os fios do gates só mudam um
  texto. Todo conduíte que carrega valor em trânsito ganha o pulso.
- **A carga muda de cara no caminho.** Palavra de 32 bits saindo da memória de instruções →
  campos nomeados saindo do decodificador → dois operandos entrando na ULA → um resultado
  saindo. A transformação é o que se está ensinando e hoje acontece dentro da caixa,
  invisível. **Vem do payload que o modelo já emite** — inventada pelo desenho seria enfeite,
  e enfeite é o que este projeto não faz.
- **Gesto por peça, não por família.** A forma continua vindo da família; o gesto passa a ser
  da peça.

## Entrega 4 — o zoom vira zoom

A auditoria capturou o quadro imediatamente após o duplo clique e um segundo depois: o
primeiro já mostra o layout final. Não há quadro intermediário, nem escala, nem fade. A
caixa que se abre não cresce até virar a tela — some, e um layout recalculado do zero
aparece no lugar.

A caixa clicada passa a crescer até ocupar o enquadramento, revelando o interior; sair
encolhe de volta para a caixa de origem.

**É a entrega de maior risco técnico**, e por isso é a última das visuais: a vista de dentro
é recalculada do zero e **não sabe onde a caixa estava**. A continuidade espacial não existe
para ser animada — precisa ser construída antes.

## Entrega 5 — a ficha diz o que a peça é

- `DESCRICOES` ao lado de `ROTULOS`, com teste nas duas direções: nenhum objeto da árvore
  sem descrição, nenhuma descrição apontando para id que não existe.
- E o que não custa uma linha de prosa, porque o motor já tem o dado:
  - **o conteúdo do estado composto** — os 32 registradores, a memória, a pilha — hoje
    apagado por um filtro `typeof v !== "object"` em `Ficha.tsx`, justamente nos objetos onde
    "o que tem aí dentro agora?" é a pergunta;
  - **os nomes das portas** (`op`, `selb`, `acesso`, `cond`), hoje reduzidos a "3 in · 2 out";
  - **os vizinhos por nome**, hoje só no DOT em sintaxe graphviz;
  - **dado contra controle** na lista de fios, que `Wire.line` já marca.
- Reaproveitando `Inspector.tsx`, que já existe, já faz diff entre ticks e não é usado por
  ninguém.

## Entrega 6 — profundidade em mais peças

Pelo critério novo. Candidatos, com o que cada um ensina:

| peça | o que abrir ensina |
| --- | --- |
| banco de registradores | endereçamento por número, e `x0` que não guarda |
| unidade de controle | a tabela de controle virando desenho |
| decodificador de instrução | a palavra se abrindo em campos — par natural da Entrega 3 |
| memória principal | mesmo padrão já aplicado à memória de instruções |
| unidade de desvio | a comparação que decide o próximo PC |
| unidade lógica | hoje folha por uma razão que acabou de cair |

Junto vai o **segundo programa** no lab. Hoje roda um só (soma 1..n) e nunca se vê ao vivo
um `jal`/`jalr` com endereço de retorno, um desvio **não** tomado, nem uma linha nascer na
memória por um `sw` em endereço comum. O motor prova tudo isso em teste; a tela não mostra.

E a dívida menor: a tabela de operação da ULA está escrita à mão em dois lugares
(`unidadeLogica` e o atalho da `ula`). Hoje concordam porque `shortcutDisagreement` cobra,
mas é o ponto de maior atrito para o próximo refino.

## Fora de escopo

- Reabrir a ULA em transistores para 32 bits (~1600 transistores). A fatia desce por um
  caminho, e ele já está aberto.
- Pipeline, cache, hierarquia de memória, CSR. Interrupção continua reservada para o ATmega,
  onde é o fenômeno-alvo.
- Camada de idioma (pt-BR). O `DESCRICOES` é desenhado para que ela seja uma troca de
  arquivo, mas ela não é desta entrega.
