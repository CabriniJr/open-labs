# Autoria independente e distribuição

**Data:** 18/10/2026. Continuação autorizada por Luigi após a POC de Pod
lifecycle. O objetivo deste passo é provar autoria e consumo fora do monorepo,
sem depender de uma promessa de extração futura.

## Relação entre plataforma, framework e handbooks

A plataforma organiza jornadas de conceitos: prever, alterar, observar,
explicar e transferir. Instruqt é a referência de jornada trazida por Luigi;
os diagramas animados do KodeKloud inspiram a observabilidade dos mecanismos.
Essas referências não prescrevem um único motor.

| Parte | Responsabilidade | Fronteira entregue agora |
| --- | --- | --- |
| Handbook | Currículo, teoria, fontes e referências aos labs | Projeto próprio e bundle de conteúdo validado |
| Framework | Contratos, ferramentas e runtimes reutilizáveis | SDK de autoria e runtime de estado instaláveis |
| Host | Catálogo, navegação, renderização e implementações dos labs | API de leitura e lista de labs exigidos; integração fica a cargo do host |
| Studio AI-first | Compor e revisar a jornada, com feedback imediato | Reutiliza futuramente contrato sem I/O e diagnósticos JSON existentes |

Mermaid é contrato estrutural dos cenários composicionais de fluxo. Os
contratos de estado e de manipulação direta seguem independentes dele. Não
criamos um novo formato de comportamento nem um plugin universal antes de ter
uma prova de integração concreta.

## A prova de independência

Dois tarballs alpha são construídos em staging com JavaScript compilado,
declarações, licença e documentação. O pacote de autoria inclui um CLI que não
compila TypeScript ao ser usado. O runtime de estado não conhece um domínio,
um renderizador ou o motor de fluxos. Cada pacote tem sua versão explícita;
não há regra que obrigue versões futuras a andarem juntas.

Uma instalação npm em pasta temporária externa verifica o caminho real. Não
há symlink para os pacotes do workspace, Astro, Vitest ou TypeScript no projeto
consumidor. A instalação ainda precisa resolver as dependências runtime
`yaml` e `zod` pelo registry/cache configurado; não declaramos instalação
air-gapped nem independência de todas as dependências.

O teste também transfere o Kubernetes Handbook para o layout externo, exporta
seu artigo, lê o bundle pelo pacote instalado e lista sua dependência do lab.
Uma edição inválida reprova tanto check quanto export. O mesmo teste executa
rewind e ramificação no runtime instalado.

## Um contrato, dois layouts

No monorepo, a submissão mantém o layout e o CODEOWNERS já entregues pelo
Claude. Fora dele, um projeto contém `handbook.yaml` e `articles/`. O nome da
pasta externa não é a identidade do conteúdo. Gerador de manifesto, coerência
do currículo e validação mecânica dos artigos são funções comuns.

A exportação antiga só escrevia o JSON. Agora `criarPacote` chama o mesmo
`lerPacote` que o consumidor usa, e ambos recusam conteúdo que violaria as
regras. O wire format `openlabs/bundle/v1` é preservado, com teste contra um
artefato congelado da PR #17. Não usamos uma versão de SDK como se fosse
versão do formato ou do conteúdo.

## A fronteira do conteúdo executável

O bundle transporta Markdown e metadados, não código de lab. O leitor expõe
`labsExigidos`, que a aplicação resolve contra suas implementações. Isso torna
a lacuna observável sem inventar que um link seja um simulador instalado.

Uma futura distribuição de labs terá de declarar entrada, capacidades e
compatibilidade com o host, além de carregar a implementação. Sua revisão e
validação são diferentes das de conteúdo editorial. Ainda não existe ABI
aprovada ou execução automática de código recebido nesta entrega.

## O próximo passo do Studio

O Studio deve conseguir abrir um projeto, editar currículo/artigos, mostrar
diagnósticos por arquivo, pré-visualizar os resultados e exportar o mesmo
artefato validado. A IA propõe dados ou alterações revisáveis; fontes e regras
de domínio continuam verificáveis. O contrato sem filesystem e `check --json`
são a base entregue para isso, e não uma declaração de Studio pronto.

Releases públicas de registry, extração de todos os pacotes do motor,
importação automática no site e hospedagem corporativa completa ficam fora
deste passo. Os artefatos locais são concretos, instaláveis e revisáveis antes
de qualquer publicação.
