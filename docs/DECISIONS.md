# Decisões e ideias consolidadas

**Data:** 2026-08-28
**Papel deste documento:** ponto de entrada. As ideias que sobreviveram, as que foram
recusadas, e as réguas que decidem discussão futura. Os outros documentos aprofundam; este
resolve.

Ordem de leitura para quem chega: **este** → `VISION.md` → `kinds.md` → `depth.md` →
`model-format.md` → `why-simulate.md` → `roadmap.md`. `theory.md` é opcional e fora da
ordem: é o motor descrito nos formalismos de que ele é instância (grafo hierárquico,
redes de Petri coloridas, cadeias de Markov) e, principalmente, a lista do que ele
**não** modela. O desenho da fase F6 está em
`superpowers/specs/2026-08-29-cpu-model-design.md`. A spec do handbook
(`superpowers/specs/2026-08-28-otel-visual-handbook-design.md`) tem precedência sobre todos
em matéria de conteúdo e currículo.

---

## 1. A ideia-mãe: a gramática de Factorio

Tudo se organiza em torno de uma gramática que se aprende sem tutorial, e ela é emprestada de
Factorio:

> **A cinta transporta. A máquina transforma. O fio de circuito carrega sinal, não item.**

Traduzida, dá quatro famílias e uma distinção que a spec do motor ainda não fazia.

| Família | O que faz | Fica no caminho do dado? |
|---|---|---|
| **Cano** | Transporta. **Nunca** altera a carga | Sim — é o caminho |
| **Processador de fluxo** | Age sobre o dado que o atravessa | Sim |
| **Controlador** | Observa, concede, dispara. Não recebe a carga | **Não** |
| **Placa** | Dado anexado, consultado e não atravessado | Não |

Consequência visual direta, e também de Factorio: **duas espécies de linha.** Dado em traço
grosso; controle em tracejado fino. A pergunta "por onde o dado passa?" se responde olhando
só as linhas grossas.

### 1.1 O que Factorio dá, e o que não dá

Vale ser preciso, porque a referência foi aplicada fora do domínio dela uma vez nesta
discussão.

| Factorio dá | Factorio **não** dá |
|---|---|
| A gramática acima | Modelo de drill-down — Factorio é **plano**, uma montadora não abre |
| Currículo bottom-up: peça simples primeiro, composição depois | Hierarquia de abstração |
| Backpressure aprendido sem uma linha de texto | Fidelidade a sistema real |
| A ideia de receita e conservação de matéria | — |

Para drill-down, as referências certas são **Logisim** (subcircuito que abre) e **Ptolemy II**
(composição hierárquica de atores, com regime de execução declarado por nível).

---

## 2. As sete ideias que sobreviveram

Cada uma com o problema que resolve, porque ideia sem problema é enfeite.

### 2.1 O invariante cano-transforma-bloco

**A forma da carga muda exclusivamente na saída de um `transform`.** Resolve: onde a
transformação acontece deixa de ser convenção e passa a ser garantia, porque vira property
test — para toda aresta, o kind da carga é igual nas duas pontas, exceto saindo de um
`transform`.

### 2.2 A família controlador

Árbitro, relógio e supervisor **não ficam no caminho do dado**. Resolve: sem essa família,
seria preciso inventar fluxo onde não existe — o mesmo erro que a placa (`static`) foi criada
para evitar.

### 2.3 Recurso como porta

Um `arbiter` que é folha recebe pedidos e devolve concessões. Resolve **três lacunas com uma
peça**: recurso finito, atribuição dinâmica, e — porque negar concessão é frear quem pede —
**backpressure**. Conceder memória e atribuir partição a um consumidor são a mesma forma com
política diferente.

### 2.4 Os quatro níveis são tipos de coisa, não graus de contenção

L0 e L1 abrem um **bloco**; L2 abre um **cano**; L3 abre uma **carga**. E `model.ts` já tem
exatamente essas roles: `node`, `channel`, `message`. Resolve dois problemas de uma vez: a
recursão convive com níveis nomeados, e o conflito "o `channel` pode transformar a carga?"
desaparece — com L2 sendo o canal aberto, o enquadramento HTTP/2 é um bloco **dentro** do
cano.

### 2.5 Três eixos de profundidade, não um

**Execução** é bottom-up (só folha tem comportamento). **Autoria** é top-down (declarar raso,
refinar depois). **Currículo** é bottom-up, à Factorio. Resolve: a pergunta "bottom-up ou
top-down?" era três perguntas, e por isso não tinha resposta.

E o currículo bottom-up se implementa **movendo a raiz do lab**, sem tocar no motor.

### 2.6 O teste de refinamento

Trocar uma folha aproximada por uma subárvore exige equivalência **na fronteira**, com a mesma
semente. Resolve: aprofundar deixa de ser aposta. E quando a equivalência falha, a informação
é preciosa — significa que a aproximação de cima estava mentindo.

Bônus: **ligar dois `model` um dia é este mesmo teste aplicado à raiz.** Nenhum mecanismo
novo.

### 2.7 Seguir a carga

Selecione uma carga e o foco **desce sozinho** quando ela cruza a fronteira de um bloco, e
sobe quando ela sai. É a câmera acompanhando o item — em Factorio você faz com os olhos porque
o mundo é plano; aqui o nível muda junto.

Resolve o argumento mais difícil do projeto: **isso é impossível com um visualizador dedicado
por conceito**, porque exige a mesma carga existindo em dois níveis ao mesmo tempo, derivada.

---

## 3. As réguas que decidem discussão futura

Somam-se aos cinco princípios da spec do handbook, não os substituem.

| Régua | Uso |
|---|---|
| **A ferramenta ensina; não opera** | Regra-mãe. Se a resposta é "faça de verdade", o real ganha |
| **"A decisão aparece?", não "o número está certo?"** | Fidelidade é qualitativa |
| **Só precisa ser simulado o que vai ser apresentado** | Trava de escopo do motor |
| **Arquétipo entra pagando em dois alvos** | Generalizar por evidência, não por antecipação |
| **Nível novo precisa revelar fenômeno novo** | Nível que só revela campo é prosa no inspector |
| **Se precisa de condicional no YAML, precisa de um `kind`** | Impede o formato de virar linguagem de programação |
| **Fenômeno que precisou de roteiro deve ser zero** | O dia em que um precisar, é animação e não simulação |
| **`model` que não cabe num handbook é dois `model`** | Trava contra escopo inflado |

---

## 4. Vocabulário — fechado

| Termo | É | Não é |
|---|---|---|
| `kind` | Primitivo do motor, comportamento em código. Dezenove | Conteúdo |
| `modelet` | **Estrutura interna** de composição: portas, `params`, `teaches` | Unidade de reuso |
| **anexo** (The Wire) | **A unidade de reuso visível**, já na spec do handbook §5 | Vocabulário do motor |
| `model` | Uma tecnologia **como ela é operada**: `otel-collector`, não `opentelemetry` | Guarda-chuva |

`.modler` e `.modlet` estão mortos. Sufixo proposto: `<slug>.model.yaml`.

---

## 5. O que foi recusado, e por quê

Registrado para não ser redescoberto.

| Recusado | Motivo |
|---|---|
| Gerar configuração para produção | OTelBin, Coralogix (×2) e Bindplane já ocupam. E muda a régua de qualidade |
| Ler telemetria do Collector real | A ferramenta ensina, não opera. E animar item individual a partir de agregado seria mentira nova |
| Intercâmbio entre `model`s implementado | O que trava não é formato, é regime de execução |
| Canvas livre estilo Excalidraw | Permitiria modelo inválido, e a honestidade estrutural é o ativo inteiro |
| tldraw, WebContainers, CheerpX | Licença |
| `rate`, `breaker`, `lock`, `coordinator`, `scale` | Não pagam em dois alvos ainda |
| Plataforma no escopo (Docker, Linux, K8s) | Trocada por orçamento finito de recurso |

---

## 6. O diferencial, em uma frase

> **Ver o mesmo dado atravessar os quatro níveis, até o frame e o byte.**

L0 e L1 todo mundo faz. Ninguém desce ao frame HTTP/2 e ao campo do protobuf **mantendo a
identidade do dado**. A exigência não é ter quatro vistas — é serem a mesma coisa, e é isso
que exige o motor.

---

## 7. Estado das decisões

### Fechadas

Nomenclatura · a ferramenta ensina e não opera · `model` é ilha com porto · reuso não é
requisito · playground é editor de grafo com regras · segue com o motor · a gramática ·
os quatro níveis como tipos de coisa.

### Abertas, e nesta ordem de urgência

1. **Licença.** `LICENSE` (Apache-2.0) e `LICENSE-content` (CC BY-SA). Repositório público sem
   licença é todos os direitos reservados — hoje nada disto pode ser reusado por ninguém
2. **`entrega-1` contra `main`** como branch default
3. **Recurso, backpressure e `transform` desenhados juntos.** Contenção de recurso *é*
   backpressure; separar produziria dois mecanismos concorrentes
4. **Unidade de recurso.** Se sair `MB` e `vCPU`, a ferramenta será usada para dimensionar
5. **Equivalência de fronteira** para o teste de refinamento
6. **Realimentação e conservação** — registrar como lacuna declarada, não construir
7. **Quando o motor sai para repositório próprio** — depois de dois casos, não antes

---

## 8. As três coisas baratas que faltam, e nenhuma exige o motor

1. **Predição antes da revelação.** Perguntar o que a pessoa acha que vai acontecer **antes**
   de rodar. É o achado mais replicado da pesquisa em simulação didática
2. **O mal-entendido que cada lab desfaz.** "As pessoas acham que o span vai direto para o
   backend." Vira campo no `teaches`, e força escrever para quem já tem ideia errada — que é
   o caso real
3. **`docs/authoring.md` como interface pública.** O teste de "ser base para outros handbooks"
   é um handbook escrito por outra pessoa, e o que habilita isso é o guia, não o motor
