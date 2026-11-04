# Framework interativo e Pod lifecycle

**Data:** 16/10/2026. **Escopo pedido pelo Luigi:** registrar a separação e fazer
uma POC em um Kubernetes Visual Handbook, com manifesto manipulável, ciclo de
vida, escala, gauges e uma apresentação próxima da árvore de recursos do Argo.

## 1. A decisão

O framework do OpenLabs suporta **diferentes modelos de interação**. O motor de
fluxos é uma capacidade desse framework. Mermaid é o contrato estrutural
canônico **dos cenários que usam o motor de fluxos**, não uma obrigação de todos
os labs ou de todos os handbooks. Nenhuma sintaxe Mermaid foi rebaixada a
visualização derivada, nem substituída por YAML de fluxo.

Há três caminhos, escolhidos pelo fenômeno:

| Caminho | Contrato | Execução | Exemplos |
| --- | --- | --- | --- |
| Fluxo composicional | `.mmd`, objetos, portas e relações; domínio em TS | `depth-core` | Collector, CPU, máquina RPN |
| Estado/reconciliação | Eventos e transições puras, entrada nativa | `interactive-core` + domínio | Pod lifecycle |
| Manipulação direta | Função de entradas para resultado | Função de domínio | Cardinalidade |

Um handbook combina esses caminhos conforme o assunto. O framework oferece
ferramentas, bibliotecas e estruturas para autoria/testes; não impõe uma única
representação de mundo. A prova de generalidade deve vir de casos concretos,
não de um sistema de plugins antecipado.

Esta decisão amplia a ADR §9. Também revê, especificamente para ensino do ciclo
de vida, o antigo corte que tirava Kubernetes do catálogo. Não autoriza um
emulador de plataforma completo nem uma ferramenta de operação de cluster.

### Referências de experiência e direção do produto

Em 17/10/2026, Luigi descreveu a plataforma como **“um Instruqt para conceitos
e teoria”** e trouxe os diagramas animados do **KodeKloud** como inspiração
visual e comportamental. São referências de intenção do produto, não uma
declaração de equivalência ou de integração com essas plataformas.

A unidade de aprendizagem é uma experiência guiada: **prever → alterar →
observar → explicar → transferir**. O movimento torna o mecanismo observável:
uma mudança de estado, reserva ou identidade deve ter causa inspecionável.
Animação, quando usada, acompanha o modelo e respeita pausa e passos; não
substitui a regra que produz o resultado. A árvore de recursos do Argo continua
a referência específica de organização visual deste lab.

O handbook organiza essas experiências em uma trilha, com teoria, experimentos
e fontes. No futuro Studio AI-first, autores devem conseguir compor essa
jornada com modelos de fluxo, estado ou manipulação direta. Distribuição
versionada de handbooks e execução privada em empresas são requisitos de
direção; sua implementação e o Studio completo não fazem parte desta POC.

## 2. A pequena biblioteca independente

`@ovh/interactive-core` fornece `InteractiveModel<S, E>` e `InteractiveSession`:
estado inicial, transição por evento explícito, snapshots, replay e ramificação
ao editar o passado. Estados/eventos precisam ser clonáveis. A biblioteca não
importa `depth-core`, `depth-ui`, Mermaid nem pacotes de domínio. A guarda de
fronteira verifica isso. Não tem tempo implícito nem aleatoriedade de parede.

O domínio escolhe se um evento significa tick, alteração de parâmetro ou gesto.
O relógio do browser só despacha eventos; não decide resultados. O histórico
tem teto (600 eventos no lab), e a execução pausa ao alcançá-lo. Esta é a POC
da biblioteca, não uma declaração de API estável.

## 3. O modelo Kubernetes

`@ovh/kubernetes-domain` interpreta um subconjunto explícito do manifesto real:
`v1/Pod` ou `apps/v1/Deployment`, um container, requests, limits, image,
restartPolicy e graça. Deployments exigem estratégia `Recreate`. Campos não
modelados, YAML inválido e quantidades incompatíveis são recusados antes de
alterar o experimento. Um sandbox possui uma única workload/namespace.

As três responsabilidades são separadas:

- ReplicaSet cria/subtrai Pods para manter o desejado. Não há escalonamento
  automático: `replicas` é entrada, não consequência do uso de CPU.
- Scheduler faz first-fit por requests em dois nodes de 2000m/2048Mi. Um Pod
  não soma capacidade de nodes. O binding do UID não muda depois de atribuído.
- Kubelet inicia e reinicia containers. OOM com restart mantém UID, node e
  reserva; exclusão com dono leva a um Pod novo. Sem dono, não há reposição.

O estado guarda separadamente fase de API, motivo de exibição, readiness,
última terminação, contador de restart e prazo de exclusão. CrashLoopBackOff
e Terminating não viram fases inventadas. Reservas saem quando o Pod termina
de ser removido; um container em backoff ainda ocupa sua reserva.

Mudança de template em Deployment faz Recreate. Escala não cria outra revisão.
Mudança de recursos em Pod isolado é recusada com explicação: resize in-place
não está modelado. Reaplicar um Pod já excluído cria outro UID.

## 4. Visualização e autoria

O manifesto é o desejado e só entra após Apply; rascunho e aplicado têm estados
visuais distintos. A árvore inspirada no Argo representa **propriedade**, não
transporte. A atribuição de node aparece em badges e em gauges por node. Não
usa `Stage`, `Wire`, `Behavior` ou `.mmd` para fingir fluxo onde há reconciliação.

Os gauges mostram capacidade allocatable menos **requests reservados**, e não
consumo real. A carga é sintética, ajustável separadamente. CPU acima do limite
é sinalizada como throttling; memória acima do limite produz OOM/restart.

A página oferece manifestos, seis experimentos, execução/passos, inspeção de
Pods, exclusão, eventos derivados e histórico. O tema é do handbook; texto
visível segue em inglês. A POC é estática e não acessa credenciais/cluster.

O Kubernetes Handbook usa o caminho de submissão versionado entregue pelo
Claude: `handbooks/kubernetes/handbook.yaml`, contrato `openlabs/handbook/v1`,
tema e currículo no manifesto, catálogo carregado automaticamente e CODEOWNERS
derivado do maintainer. Não mantém um segundo cadastro em TypeScript. Esse
manifesto descreve o handbook; o YAML de Kubernetes é a entrada do experimento,
e as transições de domínio continuam em TypeScript.

## 5. Fidelidade e limites

Startup fixo em dois passos, backoff encurtado (2/4/8), imagem disponível por
catálogo simulado, dois nodes e first-fit são **simplificações declaradas**.
Um passo avança um segundo simulado; eventos de edição não avançam o relógio.
Não há API server real, HPA, autoscaler de nodes, probes, sidecars, afinidade,
quotas, rede, volumes, cgroups ou eviction por pressão no node. A árvore mostra
somente revisões com Pods e a atual, não o histórico completo de ReplicaSets.

`labs/pod-lifecycle/` fornece manifestos reais e protocolo de conferência.
Um teste verifica igualdade dos manifestos iniciais; isso **não** prova
equivalência contra um cluster. A carga sintética não afirma consumo de nginx.
A verificação ao vivo precisa ser registrada separadamente, quando realizada.

Fontes primárias consultadas em 16/10/2026: [Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/),
[resources](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
e [Deployment strategy](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#strategy).
Argo é referência de apresentação, sem código/assets importados ou integração.

## 6. Critério de aceite da POC

1. O Kubernetes Handbook aparece no catálogo com artigo e lab alcançáveis.
2. Editar e aplicar o manifesto altera o desejado, e os passos reconciliam.
3. Escala, falta de capacidade, falha de imagem, OOM, exclusão e scale-to-zero
   produzem estados e reservas coerentes, por testes de modelo.
4. Container restart e substituição de Pod têm identidades distintas.
5. Histórico preserva estado; campo não modelado não é aceito silenciosamente.
6. A UI é operável por teclado, não alarga a página mobile e permite ler o
   grafo internamente. Testes de browser verificam mudanças observáveis.

Releases independentes, empacotamento público, contrato de plugin e Studio
completo continuam trabalho posterior. Esta POC entrega um caso concreto para
amadurecer essas decisões sem prender todos os cenários ao motor de fluxos.
