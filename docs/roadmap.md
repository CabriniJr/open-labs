# Plano de construção

**Status:** proposta. Substitui nada — as sessões S1 a S6 da spec do motor continuam
válidas no que não conflita.
**Data:** 2026-08-28
**Depende de:** `VISION.md`, `kinds.md` e `depth.md`

Ordenado por **o que destrava o quê**, não por facilidade nem por empolgação. Cada fase
tem critério de saída verificável; fase sem critério é intenção.

---

## F0 — Destravar

Sem código. É a fase mais curta e a que mais importa.

| Item | Por que trava |
|---|---|
| `LICENSE` (Apache-2.0) e `LICENSE-content` (CC BY-SA) | Repositório público sem licença é, por padrão, todos os direitos reservados. Hoje ninguém pode reusar nada, o que contradiz a intenção do projeto |
| Decidir `entrega-1` contra `main` | A branch default envelhece mal e confunde quem chega |
| Nomenclatura do pacote | Sufixo de arquivo é a coisa mais difícil de mudar depois que existe ecossistema (`VISION.md` §9.6) |
| Unidade de recurso | Se sair `MB` e `vCPU`, a ferramenta será usada para dimensionar, que é o que ela não é (§7.2) |

**Saída:** os quatro decididos e registrados em ADR.

---

## F1 — Núcleo: as três mudanças que não podem ser feitas depois

Recurso, backpressure e transformação mexem no contrato de comportamento. Fazer depois de
existirem arquétipos e pacotes significa reescrever todos.

**São uma fase só de propósito.** Contenção de recurso *é* backpressure; separar produziria
dois mecanismos concorrentes para o mesmo fenômeno.

| Mudança | Onde |
|---|---|
| Emissão que pode falhar | `Behavior` deixa de devolver `out` presumido; passa a saber o que foi aceito |
| Capacidade e política no canal | `Wire` ganha capacidade e política de recusa (bloqueia, descarta novo, descarta velho) |
| Regime propagando para trás | O estado "bloqueada" sobe a cadeia |
| Recurso como porta | `arbiter` como folha; pedido e concessão viram tráfego de porta, e o medidor segue honesto |
| `transform` como arquétipo | Sai do `channel` e do `sink`. A carga muda em um lugar só |

**Saída:**
- A perturbação da janela do receptor fechando derruba dado **por emergência**, sem roteiro
- Estourar memória mata o bloco e perde o que estava retido
- O property test do invariante visual passa: nenhuma aresta tem carga de forma diferente
  nas duas pontas, exceto saindo de `transform`
- `seek` continua exato com eventos de parâmetro e de recurso no histórico

**Risco:** é a fase que pode revelar que a arquitetura de tick único não aguenta. Se
revelar, é agora que sai barato.

---

## F2 — Prova do motor: o que já está planejado, e basta

**Corrigido em 28/08/2026.** A versão anterior desta fase propunha um "lab de prova"
mínimo — a fila enchendo. Era redundante: a spec do handbook
(`docs/superpowers/specs/2026-08-28-otel-visual-handbook-design.md` §10) **já tem a prova em
dois estágios**, e melhor desenhada.

| Estágio | O que é | Papel |
|---|---|---|
| **Hero da Entrega 1** | Mini-simulação real embutida na landing, sobre `depth-core` e `otel-domain` de verdade | Primeiro teste do motor, sem depender do motor completo |
| **Piloto da Entrega 2** | *Anatomy of a Trace* com os quatro níveis, mais o anexo W3C Trace Context | Prova da profundidade. Nasce com os quatro porque prova parcial não prova nada |

Nada a acrescentar aqui. A correção que este documento precisava era **retirar** uma fase, não
inventar outra.

### F2.1 O que o piloto exige de verdade

E uma estimativa deste plano precisa ser corrigida junto. A afirmação de que "o primeiro lab
não exige nenhum arquétipo novo" valia para o lab da fila, **não** para o piloto:

| Nível | O que exige |
|---|---|
| L0 · Flow | O que já existe |
| L1 · Mechanism | Capacidade e política — F1 |
| **L2 · Wire** | **Canal abrível.** O enquadramento HTTP/2 mora dentro do `channel` |
| **L3 · Payload** | **Carga abrível.** O documento OTLP como objeto com interior |

L2 e L3 são o custo real do piloto, e são também o diferencial (`why-simulate.md` §14).

---

## F3 — Palco

Adotar React Flow antes de investir em desenho próprio (`stack.md` §1).

| Item | Nota |
|---|---|
| Nós aninhados com `parentId` e `extent: "parent"` | É a moldura com clamp, de graça |
| Handles como portas | Entrada, saída, descarte, e as portas de **controle** |
| Duas espécies de linha | Dado em traço grosso, controle em tracejado fino (`kinds.md` §1.1) |
| Foco por caminho, breadcrumb, selecionar contra abrir | Já especificado na §4 da spec do motor |
| Deep link com semente, foco, tick e seleção | Sem a semente na URL, o handbook não pode apontar para um fenômeno |

**Saída:** abrir o provider, descer até a fila, selecionar uma carga, avançar, e ver a forma
dela mudar ao atravessar o `transform` — tudo por smoke automatizado.

---

## F4 — `otel` como primeiro pacote de modelo

Aqui o projeto deixa de ser motor e passa a ser produto.

| Item | Nota |
|---|---|
| Árvore fiel do TracerProvider | Cada objeto com âncora na spec oficial |
| Importador de manifesto, três camadas | Esqueleto do compose, recheio por resolvedor de imagem, ajuste por `environment` e arquivo montado (`VISION.md` §5) |
| Leitura da configuração nativa | O mesmo YAML do Collector, não formato inventado |
| Contrato de fidelidade no CI | Todo parâmetro resolve para ajuste real documentado, com link que o CI verifica |
| Validação contra o real | O mesmo arquivo roda no modelo e no `labs/<slug>/`, e os dois concordam qualitativamente |

**Saída:** despachar um `compose` com Collector e receber o modelo montado, sem edição
manual. Serviço sem pacote aparece como bloco opaco declarado, nunca como caixa vazia.

**Risco:** é a fase onde a fidelidade é ganha ou perdida. Se o modelo e o lab real
discordarem e a discordância for resolvida ajustando o *modelo* para parecer certo, o
projeto virou teatro.

---

## F5 — Handbook gerado da travessia

Cada objeto já carrega explicação com âncora. O handbook é uma **ordem de visita** sobre a
árvore, não um documento paralelo.

**Saída:** a página do lab é gerada do modelo, e mudar a árvore muda a página. Nenhum texto
técnico sem link para a fonte.

---

## F6 — Kafka: o segundo alvo

**Revisado em 28/08/2026.** Era "o teste da tese do projeto", medido pelo custo relativo do
segundo pacote. Com o corte de escopo que fez cada `model` ser ilha
(`why-simulate.md` §9), reuso deixou de ser requisito — logo, deixou de ser critério de
saída. O Kafka volta a ser simplesmente o segundo alvo.

Arquétipos da onda 2: `log`, `deliver`, `supervisor`.

**Saída:** o `model` do Kafka existe, com handbook próprio, e o `log` ensina atraso por
leitor — o fenômeno mais estranho ao TracerProvider e o que justifica o Kafka ser o segundo.

O que continua valendo observar, agora como informação e não como nota de aprovação:
**quantos arquétipos novos o Kafka exigiu além dos três previstos.** Um ou dois é normal.
Cinco significa que o catálogo está sendo derivado caso a caso — e aí o problema é do
catálogo, não do reuso.

---

## F6b — CPU: a prova de genericidade

Um caminho de dados de CPU, com **assembly como entrada** e drill-down até a porta
lógica. Detalhamento completo em `theory.md` §7.

Por que aqui e não antes: um terceiro alvo só prova alguma coisa se os dois primeiros
já fecharam. Por que **antes** de F7: extrair o motor tendo visto só domínios de
mensageria (OTel, Kafka) é extrair um motor de mensageria com outro nome. A CPU é o
alvo mais distante que ainda cabe nas primitivas, e é justamente por isso que ela é o
teste.

Ela já nomeou três lacunas do motor, todas legítimas e nenhuma resolvível com um
`kind` novo (`theory.md` §7.4):

| Lacuna | O que falta |
|---|---|
| Linha de controle sem semântica | sinal entregue muda o que o ator faz no ciclo, contado como tráfego e nunca como carga |
| Ler sem consumir | banco de registradores como ator que responde a pedido — nenhum ator espia o estado de outro |
| Combinacional × registrado | o tick ganha fases: acomodação até o ponto fixo, depois entrega do que atravessa aresta registrada |

E uma menor: **escala de tempo é do mundo, não do motor** — 100 ms no OTel, ~0,3 ns na
CPU. A constante vira propriedade do `WorldSpec`, com unidade.

**Saída:** um pacote `cpu-domain` que importa exclusivamente `depth-core` e `depth-ui`,
executa um programa em assembly de verdade, abre até a porta lógica, e **não obrigou
`depth-core` a saber o que é um registrador**. Commits em `depth-core` fechando as três
lacunas contam a favor; vocabulário de CPU dentro dele reprova.

---

## F7 — Extração do motor

Só depois de F6 e F6b. Motor extraído antes de dois casos completos fica genérico e inútil, e
motor sem conteúdo não atrai ninguém em open source.

Nesta fase entram o contrato de plugin, o pacote publicável e a decisão do repositório
próprio.

---

## Como medir se está dando certo

| Sinal | Bom | Ruim |
|---|---|---|
| Arquétipos novos por alvo | Cai a cada alvo | Constante ou crescendo |
| `modelet` por fenômeno | Menos `modelet` que fenômeno | Trinta `modelet` para oito fenômenos é reimplementação (`why-simulate.md` §3.1) |
| Parâmetro sem procedência | Zero, garantido por CI | "Depois a gente ancora" |
| Fenômeno que precisou de roteiro | Zero | Qualquer um |
| Discordância entre modelo e lab real | Resolvida corrigindo o modelo **ou** declarando o que não é modelado | Resolvida deixando o modelo bonito |

O quarto é o mais importante. No dia em que um fenômeno precisar ser roteirizado para
aparecer, o projeto deixou de ser simulação e passou a ser animação — e nenhum dos outros
sinais importa mais.

## Onde a autoria assistida entra, e onde não entra

O Luigi quer usar IA em peso na produção de pacotes. Isso funciona **com** portão e é
perigoso sem, porque o único ativo do projeto é a fidelidade e geração assistida produz
texto plausível (`VISION.md` §9.3).

| Entra bem | Não entra |
|---|---|
| Rascunhar a composição de um pacote a partir da documentação oficial | Escrever comportamento de arquétipo sem revisão |
| Levantar e organizar fontes antes de escrever | Ser a fonte de uma afirmação técnica |
| Propor a ordem de ensino de uma trilha | Decidir o que é fiel |
| Encontrar divergência entre o modelo e a documentação | Resolver a divergência sozinha |

O que torna isso seguro é a §4.1 da visão: **pacote é dado validado por schema.** Compor
dado errado é localizável e difável; comportamento errado escondido numa função, não.

## Ordem, em uma linha

```
F0 destravar → F1 núcleo → F3 palco → F2 piloto (Entregas 1 e 2) → F2b arquétipos → F4 otel → F5 handbook → F6 kafka → F6b cpu → F7 motor
```

O piloto e o palco se sobrepõem: não há lab sem palco, e o palco só se justifica pelo lab. E a
onda de arquétipos vem **depois** do piloto, porque o piloto revela quais são realmente
necessários.

O playground (`why-simulate.md` §10) não é fase: ele nasce de graça ao fim de F3, porque é a
mesma paleta e a mesma engine, sem exigência de procedência.

Nenhuma fase começa antes de a anterior ter fechado o critério de saída. O sinal de alarme
mais confiável do projeto é começar o Kafka antes de o OTel estar fechado.
