# Kubernetes e OpenTelemetry no espaço

As cenas destes dois handbooks usam `@ovh/stage3d`: o filme derivado do domínio
é desenhado em Three.js, com duas lentes do mesmo estado. **Iso** usa câmera
ortográfica; **3D** usa perspectiva. Os handbooks oferecem atalhos para abrir os
labs diretamente com `?view=3d#experiment`.

## Experimentos

| Lab | O que a cena explica |
|---|---|
| Pod lifecycle | Pods na fila ou no nó ao qual foram vinculados, reservas de requests, substituição de Pods e reinício de containers |
| Hard context and baggage | A topologia de serviços que compartilha traceparent e baggage, e o efeito de perder os headers |
| Agent or gateway | Pods de aplicação, agents por nó, gateways e backend; onde cada implantação guarda conexões, contexto e filas |

## Interação

- Arrastar gira a câmera. Shift + arrastar desloca o enquadramento.
- `+` e `−` aproximam e afastam. **Reset camera**, `0` e duplo clique recuperam
  o enquadramento inicial.
- Com o palco focado, as setas giram; Shift + setas desloca a câmera. Essas
  teclas não mudam capítulos nem avançam a simulação.
- Clicar numa peça seleciona a entidade do modelo por ray casting. **Inspect
  scene** oferece a mesma seleção por uma lista textual, para teclado e celular.
- A vista escolhida fica na URL. O link guarda a vista, não um cluster real,
  manifesto editado ou resultado do experimento.

No lab de Kubernetes, a seleção acompanha as vistas Tree / Cluster / Iso / 3D.
O inspetor mostra o Pod selecionado ou, ao selecionar um nó, CPU e memória
reservadas e disponíveis a partir de `nodeResources`. O controlador, o scheduler
e a fila têm descrições próprias. Reiniciar um container mantém o UID do Pod;
excluir um Pod controlado permite que o modelo crie outro UID. A disposição
espacial cresce com a quantidade real de Pods, sem empilhar recursos numa última
posição compartilhada.

Nos labs de OpenTelemetry, as vistas Sequence / Topology / Iso / 3D compartilham
o relógio do player. A inspeção lê o quadro da vista ativa; a narração e os
detalhes continuam no mesmo instante. Alterar o encaminhamento de headers ou o
roteamento por trace ID recalcula o modelo sem reiniciar o player.

## Fronteiras

São modelos didáticos locais. Não há conexão a um cluster Kubernetes ou a um
backend de observabilidade. Reservas não são uso medido; o scheduler é first-fit
em dois nós fixos e os tempos de startup e backoff são simplificados. No lab de
implantação, a topologia e os spans são definidos pelo modelo, não descobertos de
uma instalação real. Cada página descreve os limites do seu experimento.

O renderizador não conhece estes domínios: recebe `Film` e `Frame`, mantém o
desenho sob demanda, pausa fora da tela, limita DPR a 2 e libera geometrias,
materiais e renderer no descarte. Three.js só é carregado quando o leitor escolhe
uma vista espacial. O SVG permanece disponível para a leitura plana.

## Verificação

`pnpm qa:labs --only=labs/<slug>/` audita desktop e celular com CPU a 4×. Além da
vista padrão, mede Iso e 3D, verifica acessibilidade e transbordamento e fotografa
os capítulos e as vistas em temas claro e escuro. O CI guarda os relatórios e
as fotografias de cada lab em artefatos separados. Alertas de desempenho são
registrados; erros de página, console, controles sem nome ou rolagem horizontal
reprovam o QA. `--strict` também reprova alertas.
