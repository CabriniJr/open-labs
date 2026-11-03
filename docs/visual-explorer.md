# Exploração visual: 2D, isométrico e 3D

O `SceneViewport`, de `@ovh/depth-ui`, é o invólucro compartilhado dos palcos
composicionais e de `MotionStage`. O modo inicial continua sendo o diagrama 2D.
As vistas espaciais são outra apresentação do estado atual: mudar de câmera não
avança o relógio, não modifica o modelo e não reinicia o experimento.

## Uso

| Controle | Efeito |
|---|---|
| 2D | Diagrama original, incluindo zoom contínuo, inspeção e entrada nos objetos |
| Isometric | Projeção ortográfica com a mesma escala nos três eixos |
| 3D | Projeção em perspectiva, com órbita livre |
| Arrastar | Orbitar no 3D; mover o quadro no isométrico |
| Shift + arrastar | Mover o quadro no 3D |
| + / − | Aproximar e afastar |
| Setas, com o palco focado | Mover a câmera; não muda o capítulo |
| 0 ou Reset view | Recuperar o enquadramento inicial |
| Clique / espaço | Inspecionar uma peça |
| Duplo clique / Enter | Entrar numa peça, quando o palco oferece navegação |
| Scene contents | Lista textual das peças visíveis, com seleção e abertura |

A tela cheia usa a API do navegador e acompanha a saída por Esc. Quando não
está disponível, o controle informa isso sem quebrar a navegação. O botão de
ajuda explica os gestos no próprio palco. Não há animação automática de câmera;
os relógios existentes continuam respeitando `prefers-reduced-motion`.

## Contrato e implementação

`SpatialScene` contém caixas, caminhos e marcadores em coordenadas do modelo.
`spatialFromStage` agrega os pontos dos fios às peças visíveis e lê as mensagens
de `WorldState.flight`. `spatialFromFrame` lê visibilidade, deslocamento,
escala, avanço e tom de cada entidade do quadro do filme. Nenhum dos adaptadores
importa um domínio ou altera o estado que recebeu.

O renderizador usa SVG com projeção matemática de coordenadas tridimensionais,
volumes extrudados, descarte de faces traseiras e ordenação de peças por
profundidade. Não depende de WebGL, GPU dedicada ou recursos de rede. Rótulos
permanecem voltados para o leitor. A geometria espacial só é calculada quando
uma vista espacial está ativa. O SVG 2D permanece montado para preservar seus
ouvintes, foco e estado de câmera ao voltar.

As vistas espaciais são uma visão estrutural resumida. Os símbolos técnicos,
tabelas internas, portas individuais, bornes que atravessam a moldura, túneis e
renderizações `custom` completas continuam no diagrama 2D. A extrusão indica
separação visual, não uma dimensão física do sistema. Labs com interfaces
próprias, como o ciclo de vida de Pod, mantêm seus controles específicos.

## Descoberta e identidade visual

A home, o cabeçalho e os cartões usam o tema do handbook e os tokens existentes.
O catálogo de labs oferece busca, seleção de handbook, disponibilidade e estado
vazio. Os filtros vivem nos parâmetros `q`, `handbook` e `status` da URL, de modo
que uma seleção pode ser compartilhada e sobrevive ao recarregamento. Não existe
catálogo paralelo: as entradas continuam saindo de `HANDBOOKS`.

## Verificação

Os testes unitários verificam projeção isométrica, perspectiva, câmera e
preservação de estado. Os testes de interação verificam seleção, retorno ao
diagrama montado e isolamento das teclas da câmera em relação ao player. O
Playwright exercita os dois motores e os filtros em desktop e celular. As
capturas produzidas ficam no artefato `browser-review` do CI.
