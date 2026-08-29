# Bloco 2 — Fan-out, multiplicidade e atalho provado

> **Para quem executa:** este plano foi escrito e executado na mesma sessão, então ele
> registra **decisões, assinaturas e invariantes** em vez de transcrever cada passo de TDD.
> O que ele não abre mão: cada tarefa tem teste antes de implementação, e cada uma fecha com
> os três verdes (`typecheck`, `test`, `boundaries`) e um commit.

**Objetivo:** fechar o contrato do motor que a CPU exige — uma saída alimentando vários
destinos, as duas marcas de multiplicidade, e o atalho de execução que só vale se um teste
provar que ele concorda com a composição.

**Depende de:** Bloco 1 (`7ec989b..eb5ce17`). **Spec:** `2026-08-29-cpu-model-design.md`
§3.3, §3.4, §3.5 e §11.2.

**Nenhuma linha deste plano menciona CPU.** A guarda de fronteira agora vigia dois domínios,
e o segundo é justamente esse.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Situação |
|---|---|---|
| `packages/depth-core/src/wiring.ts` | Ganha `resolveTargets` (lista). `resolveTarget` continua, definido em cima dela | modificar |
| `packages/depth-core/src/scheduler.ts` | Lança uma cópia por destino | modificar |
| `packages/depth-core/src/validate.ts` | Perde a recusa de fan-out; ganha as regras de `width`, `replicas` e `shortcut` | modificar |
| `packages/depth-core/src/model.ts` | `Wire.width`, `ObjectSpec.replicas`, `ObjectSpec.shortcut` | modificar |
| `packages/depth-core/src/tree.ts` | `entryLeaf`/`exitLeaf` param num contêiner com atalho | modificar |
| `packages/depth-core/src/shortcut.ts` | A projeção de fronteira e o teste de equivalência | criar |
| `packages/model-format/src/compile.ts` | Perde a recusa de fan-out | modificar |
| `docs/kinds.md` | `tee` sai do catálogo, com o motivo | modificar |

---

## Task 1: fan-out nativo

**Decisão.** `n` fios de dado saindo da mesma porta entregam `n` cópias. `out:` conta **uma
emissão**; cada destino conta o seu `in:`. As duas contagens divergirem é o esperado, e é
informação: é quanto a saída se espalhou.

A recusa que `f281ece` acrescentou sai — ela existia porque o motor percorria só o primeiro
fio, e agora ele percorre todos. **O que não pode voltar é o silêncio:** se o fan-out fosse
implementado só no confronto, a acomodação (que já percorre todos os fios desde o Bloco 1)
e o confronto discordariam, e o mesmo desenho entregaria diferente conforme o regime da
porta. Por isso o teste cobre as duas fases.

```ts
/** Todos os destinos de carga de `(from, port)`. Lista vazia = porta sem fio. */
export function resolveTargets(
  tree: TreeIndex,
  wires: readonly Wire[],
  from: string,
  port: PortId,
): readonly (string | Drop)[];
```

`resolveTarget` passa a ser `resolveTargets(...)[0] ?? null` — um mecanismo só.

**Testes:** duas cópias com ids diferentes; `out:` conta 1 e cada `in:` conta 1; leque no
regime `settle` entrega igual ao leque no `clocked`; porta sem fio continua em `.unwired`;
o encaminhamento implícito de `pipeline` continua valendo quando não há fio.

**Também:** `validate.ts` e `compile.ts` perdem a recusa; os testes das duas viram
aceitação, e um deles passa a **provar a entrega dupla** em vez de só não lançar.

## Task 2: `tee` sai do catálogo

Ele seria um segundo mecanismo para o mesmo fenômeno. A régua do projeto — arquétipo entra
pagando em dois alvos — o reprova agora que a junção é nativa. `docs/kinds.md` registra a
remoção **com o motivo**, em vez de apagar a linha: quem reler precisa achar a discussão.

## Task 3: `Wire.width`

`width?: number` — a linha é um feixe de `N` vias. Inteiro `>= 2`; declarar `1` é ruído e é
recusado. **A marca não muda contagem nenhuma**, e há teste dizendo isso: se um dia alguém
fizer `width` multiplicar peso, o teste cai. É a diferença entre "o desenho informa" e "o
número mente".

## Task 4: `ObjectSpec.replicas`

`replicas?: number` — `N` objetos idênticos, um desenhado.

**O invariante que impede a mentira:** um nó com `replicas: N` precisa ter exatamente `N`
filhos de fluxo, todos do mesmo `kind`. A marca diz "desenhe um destes N"; os N existem de
verdade e é deles que os números saem. Sem esse invariante, `×32` seria um rótulo sobre um
único objeto, e o leitor leria a conta de um achando que é a de trinta e dois — que é a
mentira silenciosa de sempre.

Recusa também `replicas` em folha (não há o que replicar) e `N < 2`.

## Task 5: `ObjectSpec.shortcut`

`shortcut?: Behavior<S>` num contêiner: quando presente, **o contêiner age e os filhos não
rodam**. Roda sempre — nunca "quando ninguém está olhando", porque isso faria a resposta do
modelo depender do que o leitor abriu, e a vista deixaria de ser projeção do mesmo run.

Consequências, e são elas que fazem funcionar:

- `actors()` inclui o contêiner com atalho e **exclui toda a subárvore dele**
- `entryLeaf`/`exitLeaf` param no contêiner com atalho: para a fiação, ele é folha
- recusado em folha, e recusado junto com `behavior` (seriam dois comportamentos)

## Task 6: a prova de equivalência

```ts
/** O que o mundo FORA de `id` enxerga: estado e livro-caixa dos de fora. */
export function boundaryProjection(
  tree: TreeIndex,
  state: WorldState,
  id: string,
): { nodes: Record<string, unknown>; ledger: Record<string, number> };

/** Roda os dois caminhos e devolve a primeira divergência, ou `null`. */
export function shortcutDisagreement(
  spec: WorldSpec,
  id: string,
  ticks: number,
  params?: Readonly<Record<string, number>>,
): string | null;
```

`shortcutDisagreement` monta dois mundos a partir do mesmo `spec` — um com o atalho, outro
com ele removido — roda os dois com a mesma semente e compara a **projeção de fronteira** a
cada tick. Compara estado e livro-caixa de quem está de fora, e não ids de mensagem: os
emissores são diferentes por construção, e exigir id igual reprovaria um atalho correto.

O teste do bloco usa `fast-check` sobre sequências de entrada e um composto de dois
estágios com atalho equivalente — e, **por mutação**, um atalho propositalmente errado
(que erra por um) precisa ser reprovado. Sem essa segunda metade, a propriedade provaria só
que coisas iguais são iguais.

## Task 7: superfície pública e `PROGRESS.md`

Exporta `resolveTargets`, `boundaryProjection`, `shortcutDisagreement` e os tipos novos.
`PROGRESS.md` registra o bloco, incluindo o que ficou de fora.

---

## Fora do escopo

- **Desenhar** `×N` e `/N`. As marcas passam a existir e a ser validadas; desenhá-las é
  `depth-ui`, no Bloco 3, junto das views.
- **Expandir réplicas automaticamente** a partir de um modelet. Quem instancia os N é quem
  escreve o modelo; o motor cobra que eles existam.
