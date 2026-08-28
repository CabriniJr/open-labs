# Visão e escopo

**Status:** rascunho para discussão. Nada aqui é compromisso de entrega.
**Data:** 2026-08-28

Este documento existe para tornar a direção discutível — e para registrar as objeções
junto com a visão, porque uma visão sem objeção anotada é uma visão que ninguém revisou.

---

## 1. O que é

Um **lab de plataforma na web**: você despacha um manifesto que já existe no seu
repositório — um `docker compose` e os arquivos de configuração que ele monta — e a
ferramenta monta um modelo interativo. Blocos abríveis, simulação rodando, decisão de
configuração aparecendo como comportamento.

O material didático não é escrito ao lado do modelo: ele **é uma travessia do modelo**.

Analogia curta: **um Wokwi para plataforma**. Em vez de placa e firmware, manifesto e
configuração.

## 2. Para quem

| Público | O que ganha |
|---|---|
| Estudante de ops e infraestrutura | Ver o mecanismo antes de ter cluster, sem precisar de ambiente |
| Time de plataforma | Discutir uma decisão de configuração olhando a consequência; onboarding com trilha executável |
| Autor de documentação | Material derivado do modelo, que não desatualiza em relação a ele |

Esse público define duas coisas: a entrada é `compose` porque é a linguagem que ele já
escreve, e o catálogo prioritário é o que ele opera.

## 3. O que não é

- Não é simulador de capacidade nem previsor de desempenho
- Não é editor de grafo livre: o canvas é **gerado do modelo**
- Não é validador de arquitetura. Validar comportamento real é trabalho do ambiente real

A régua é **"a decisão aparece?"**, não "o número está certo?". Fidelidade
**qualitativa**: a fila enche, o backpressure chega, a mensagem cai.

## 4. Pacote de modelo

A unidade de extensão. O Luigi propôs chamar de `.modler`, com os objetos internos
como `.modlet`. O conceito está certo; a nomenclatura é **decisão aberta** — ver §10.

Um pacote de modelo declara quatro coisas:

| Parte | Conteúdo |
|---|---|
| **Reconhecimento** | Que imagens ele resolve (`confluentinc/cp-kafka`, `otel/opentelemetry-collector*`) |
| **Estrutura** | A subárvore de objetos: quem contém quem, portas, canais |
| **Leitura de configuração** | Como extrair parâmetros do formato **nativo** da ferramenta — o mesmo YAML do Collector, as mesmas variáveis de ambiente. Nunca um formato inventado |
| **Explicação** | Texto por objeto, com âncora na especificação oficial |

O que um pacote **não** traz é comportamento novo. Comportamento vive nos arquétipos
(`kind`) do motor, que são revisados e compartilhados. Ver a objeção em §9.3.

### 4.1 Configuração nativa destrava a validação

Se o pacote lê o formato real, o mesmo arquivo roda no modelo **e** no componente de
verdade dentro do `labs/<slug>/`. Comparar os dois qualitativamente transforma o
contrato de fidelidade de promessa em teste. É a diferença entre modelo confiável e
modelo bonito, e nenhum simulador didático existente faz isso.

## 5. As três camadas de importação

Um `compose` descreve topologia, não o interior dos componentes.

| Camada | Origem | Produz |
|---|---|---|
| Esqueleto | `services`, `depends_on`, `networks`, `ports` | Blocos da raiz e canais entre eles |
| Recheio | Resolvedor de imagem para pacote de modelo | A subárvore interna de cada bloco |
| Ajuste | `environment` e **arquivos de config montados por `volumes`** | Os parâmetros que fazem a decisão aparecer |

A terceira camada é a que entrega a promessa: é no arquivo montado que vivem as
decisões que interessam. Ler só o `compose` daria um diagrama de serviços, e disso já
existe meia dúzia de ferramentas.

Serviço sem pacote correspondente vira **bloco explicitamente opaco**, marcado como não
modelado. Nunca caixa vazia que sugere conhecimento que não existe.

## 6. Escopo da v0

**Um alvo só: OpenTelemetry.** É o assunto de estudo em curso, e é onde os fenômenos
mais didáticos aparecem — amostragem, lote, fila, backpressure na exportação.

A v0 fecha quando:

- [ ] A árvore do TracerProvider está fiel e completa, com âncora na spec por objeto
- [ ] Backpressure emerge do modelo, sem roteiro (ver §9.1)
- [ ] Um `compose` com Collector é importado nas três camadas da §5
- [ ] O mesmo arquivo de configuração roda no modelo e no lab real, e os dois concordam
- [ ] A página do handbook é gerada da travessia da árvore

Não faz parte da v0: catálogo, contrato de plugin, extração do motor para repo próprio.

## 7. Catálogo direcional

**Direção, não compromisso.** O critério de avanço é o anterior ter fechado.

Listar catálogo é barato; terminar um alvo é caro. Este catálogo serve para testar se a
abstração aguenta, não para prometer entregas.

### 7.1 Componentes de pipeline

Fluxo de dados por portas. É o que os arquétipos atuais descrevem bem.

| Alvo | Fenômeno que ensina | Nota |
|---|---|---|
| OpenTelemetry | Amostragem, lote, fila, exportação | **v0** |
| Kafka | Partição, grupo de consumo, rebalance, lag | Segundo alvo — o mais exigente, e é isso que o qualifica |
| Prometheus | Coleta por pull, séries, retenção, remote write | Contraste útil com o push do OTel |
| Mosquitto / MQTT | QoS, sessão persistente, tópico curinga | Broker pequeno, ótimo para provar reuso |
| PostgreSQL | WAL, réplica, atraso de replicação | Ver §8: talvez não seja modelo |

### 7.2 Camada de plataforma

**Aqui a hipótese do projeto é frágil.** Os arquétipos atuais foram desenhados para
fluxo de mensagens; esta camada tem fenômenos de natureza diferente.

| Alvo | Fenômeno central | Por que não encaixa direto |
|---|---|---|
| Docker | Ciclo de vida, rede, volume, namespace | O fenômeno é **estado e isolamento**, não fluxo de dados |
| Linux | Escalonador, page cache, cgroup, syscall | Outro nível de abstração inteiro. Ver §8 |
| Kubernetes | Laço de reconciliação: desejado contra observado | O fenômeno é **controle com realimentação**, não pipeline. Exige regime de execução próprio |

O Kubernetes é o caso que mais ensina sobre o motor: um laço de reconciliação não é uma
ordem topológica de tick. Ou o motor passa a aceitar **regime de execução declarado por
composto**, ou esta camada fica fora para sempre. Isso é a mesma conclusão que o Ptolemy
II alcançou com o conceito de *director* por nível hierárquico.

## 8. Modelar ou embarcar: a pergunta que precede o catálogo

Para parte dos alvos, o componente **real** roda no navegador. Nesses casos, modelar
significa construir uma versão pior e menos fiel de algo que já existe pronto.

| Alvo | Existe real no navegador? | Consequência |
|---|---|---|
| PostgreSQL | **PGlite** — Postgres compilado para WASM, Apache-2.0, ~3 MB | Embarcar o real para consulta e plano de execução. Réplica e WAL continuam modelo: o PGlite roda em modo de conexão única |
| Linux | **v86** — emulador x86 em WASM que roda Linux de verdade | Emular é mais fiel e mais barato de manter do que modelar escalonador |
| MQTT | Brokers MQTT em JavaScript rodam de fato | Embarcar o real; modelar só o que o broker não deixa observar |
| Kafka | Não. É JVM | Modelar |
| Kubernetes | Não como cluster | Modelar o laço de reconciliação |
| OTel Collector | A investigar — é Go, e Go compila para WASM | Se for viável, é fidelidade máxima. Não assumir antes de testar |

**Critério:** se o real roda no navegador e o mecanismo interno é observável, embarque;
se não roda, ou se o interesse didático está justamente no que ele esconde, modele.

Consequência de arquitetura: um pacote de modelo pode ser **um invólucro sobre um
componente real embarcado**, e não só uma árvore simulada. Isso é uma decisão de design
que ainda não existe na spec do motor, e é melhor decidi-la antes de o catálogo crescer.

## 9. Objeções e hipóteses frágeis

### 9.1 Backpressure não emerge do motor atual

`Behavior` devolve `{ state, out: Emission[] }` — a folha emite e pronto. `Wire` não tem
capacidade nem política de recusa. Isso modela **overflow**, não backpressure.

Faltam: capacidade e política no canal, emissão que pode falhar, e regime "bloqueada"
propagando para trás. A perturbação mais forte da spec — janela do receptor fechando,
exportação parando, fila enchendo, dado caindo — **é** backpressure em três níveis, e
hoje teria de ser roteirizada. Roteiro é a única coisa que este projeto não pode aceitar.

### 9.2 Um conjunto de arquétipos para todos os domínios é a hipótese mais frágil

O catálogo da §7 tem pelo menos três famílias semânticas: fluxo de dados, estado e
isolamento, controle com realimentação. A tese do projeto — mapear tudo em `kind` —
assume que um conjunto serve às três. **Isso não está provado.**

Como testar barato: depois do Kafka, tentar o alvo mais distante (Kubernetes ou Linux) e
ver o que quebra. Testar só com pipelines parecidos confirmaria a hipótese por
construção, o que não é confirmação nenhuma.

### 9.3 "A IA vai entrar em peso" é o maior risco, não o acelerador

O único ativo do projeto é a fidelidade. Um modelo errado com desenho bonito é pior que
não ter ferramenta, porque o leitor sai confiante e errado.

Geração assistida produz texto plausível, e plausível é exatamente o que passa em
revisão superficial. Usar IA em peso **sem** o portão de verificação industrializa a
mentira em escala.

O guia de autoria já tem a regra certa: toda afirmação técnica rastreia para um link, e
o que não rastreia é cortado, não amaciado. O que falta é isso ser **CI e não
disciplina**:

- Todo parâmetro resolve para um ajuste real documentado, com link que o CI verifica
- Todo comportamento novo entra com teste que o compara ao componente real do lab
- Pacote de terceiro passa pelo mesmo portão, senão o projeto vira coleção de modelos de
  qualidade desconhecida

Papel correto da IA: **gerar o candidato**. Quem aceita é o teste contra o real.

### 9.4 Dispersão é o risco número um, e não é técnico

Estado de hoje: fase inicial, sem licença declarada, entrega 2 na primeira de seis
sessões, motor sem backpressure. Um catálogo de nove alvos e duas camadas, nesse
contexto, é convite para nenhum fechar.

Mitigação já adotada: catálogo é direção, avanço exige o anterior fechado, e nenhum
`kind` novo entra sem pagar em dois domínios distintos.

### 9.5 Material didático de plataforma apodrece

Defaults mudam de versão. Um lab que ensina `maxQueueSize` 2048 fica errado em silêncio
quando o upstream muda. Como cada parâmetro já vai declarar procedência e link, vale um
teste que confronte o valor declarado com o upstream e falhe quando divergir.

### 9.6 Nomenclatura: `.modler` tem dois problemas

**Grafia.** Não é palavra em inglês nem em português; será lido como erro de digitação
de *modeler*. Para um sufixo de arquivo público isso custa caro e para sempre: gente
digitando errado, busca dividida, correção eterna. `.modlet` herda o problema.

**Sobrecarga.** Um `.modler` seria ao mesmo tempo pacote de distribuição, árvore de
objetos, leitor de configuração e conteúdo didático — quatro coisas com ciclos de vida
diferentes.

**Sobre `.modlet`:** os objetos internos já têm nome no motor — são objetos com `kind`.
Criar um terceiro vocabulário entre motor e conteúdo contraria a regra da spec de que o
vocabulário do motor nunca vira conteúdo.

Recomendação: sem invenção. `<slug>.model.yaml` para a parte declarativa, pacote
publicado como `@ovh/model-<slug>`. Se houver vontade de marca própria, `.rig` é o
melhor candidato curto — em simulação, *rig* é a montagem de teste, e o termo está livre.

## 10. Referências e o que tomar de cada uma

| Referência | O que tomar | Cuidado |
|---|---|---|
| **Wokwi** | Projeto é dado; compartilhável por URL; biblioteca de peças como ativo | Os elementos são MIT mas **só apresentação**; o motor de simulação é fechado. Aqui a escolha é o inverso |
| **PhET** | O método: nenhum controle sem medidor que responda a ele na mesma tela | Código sob GPL-3 e simulações relicenciadas para CC BY-NC. Referência de método é livre; **importar código ou asset não é** |
| **Cisco Packet Tracer** | A experiência de montar topologia e ver o pacote andar | **Proprietário.** Referência de sensação, nunca de código. O análogo aberto é o `containerlab`, que monta topologia declarada em YAML com containers de verdade |
| **Logisim Evolution** | Prova de que abrir o bloco e ver o mecanismo ensina | GPL-3, domínio de circuitos |
| **Ptolemy II** | *Director* por nível: regime de execução declarado por composto | Java, desktop, acadêmico |
| **LikeC4** | Vista como projeção do modelo; e a stack que ele já validou | MIT. É diagrama, não simulação |

`containerlab` merece atenção especial: é topologia declarativa em YAML virando lab
executável em containers. É a mesma premissa de entrada deste projeto, já provada, em
outro domínio.

## 11. Decisões abertas

Em ordem de urgência — as três primeiras travam o resto.

1. **Licença.** Repositório público sem `LICENSE` é, por padrão, todos os direitos
   reservados. Proposta: Apache-2.0 no código (concessão de patente) e CC BY-SA no
   conteúdo. Bloqueia divulgação e contribuição externa
2. **Backpressure no modelo** e **regime de execução por composto**. Mexem no núcleo;
   depois custa reescrita
3. **Nomenclatura do pacote** (§9.6). Sufixo de arquivo é a coisa mais difícil de mudar
   depois que existe ecossistema
4. **Pacote declarativo ou código?** Declarativo faz o ecossistema crescer e mantém a
   revisão viável; código dá poder e transfere risco para quem revisa. Proposta:
   declarativo por padrão, e `kind` novo entra no núcleo, revisado
5. **Modelar ou embarcar** (§8), por alvo
6. **Branch default:** `entrega-1` envelhece mal. Decidir sobre `main`
7. **Quando o motor sai para repo próprio.** Proposta: depois do segundo domínio

## 12. O que este documento não é

Não é plano de entrega, não é spec e não substitui as specs em
`docs/superpowers/specs/`. Quando uma decisão daqui for tomada, ela vira spec ou ADR, e
esta seção passa a apontar para lá.
