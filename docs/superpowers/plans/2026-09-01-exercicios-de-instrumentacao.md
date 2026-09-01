# Exercícios de instrumentação — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a seção `Instrument it` no lab dos provedores — dois exercícios de
lacuna cujo bloco certo é **extraído** de um arquivo Java que roda de verdade em
`labs/providers/`, com placar de acerto de primeira no mapa.

**Architecture:** Três camadas com fronteiras duras. `labs/providers/` é a contraparte real
e a **única fonte** do código certo. `packages/otel-domain/src/exercicios/` guarda a
definição — arquivo, marcador, distratores — e **não** guarda a resposta. `apps/site`
extrai no build (Node), desenha a peça (React, neutra de domínio) e guarda o placar.

**Tech Stack:** Java 21 + OpenTelemetry Java SDK (versão fixada na Task 1), Docker Compose,
TypeScript estrito, pnpm workspaces, vitest, Playwright, Astro + ilhas React.

**Spec:** `docs/superpowers/specs/2026-09-01-exercicios-de-instrumentacao-design.md` — **ler
antes da primeira linha de código.** As decisões D1–D5 não se reabrem aqui.

---

## Escopo: dois blocos que fecham sozinhos

O **Bloco A** é a contraparte real. Ele já era pendência declarada do round anterior (bloco
E do plano de 31/08), vale por si — é o princípio 3 do handbook, "todo lab tem contraparte
real" — e **pode ser mergeado sozinho**. Se o exercício for adiado, o Bloco A continua tendo
valor; o contrário não é verdade.

Os blocos B–F dependem do A e não fazem sentido sem ele.

---

## O idioma do repo — ler antes de escrever qualquer teste

**Comandos, da raiz:**

```bash
pnpm typecheck                       # tsc -b
pnpm test                            # vitest run (unit + dom)
pnpm boundaries                      # a fronteira motor↔domínio
pnpm catalogo                        # cor escrita fora do catálogo
pnpm build
pnpm --filter @ovh/site test:e2e     # Playwright
pnpm vitest run <caminho>            # um arquivo só
```

**Convenções que não se negociam:**

- **commit sem `Co-Authored-By: Claude` e sem `Claude-Session`** — vale para este repo;
- código e comentário em **português**; tudo que o leitor vê, em **inglês**;
- `verbatimModuleSyntax` → `import type` para tipo, e import interno com sufixo **`.js`**;
- `exactOptionalPropertyTypes` → campo opcional entra por spread condicional, nunca por
  `undefined`;
- `noUncheckedIndexedAccess` → todo acesso indexado devolve `T | undefined`;
- CSS de componente **não escreve tinta**: `pnpm catalogo` reprova hexadecimal e `rgb(`,
  **inclusive dentro de comentário**.

---

## Estrutura de arquivos

Criar:

| Arquivo | Responsabilidade |
| --- | --- |
| `labs/providers/compose.yaml` | app + Collector, e nada mais |
| `labs/providers/README.md` | o que observar, e o que **não** dá para ver ali |
| `labs/providers/app/pom.xml` | a versão do SDK, fixada |
| `labs/providers/app/Dockerfile` | build multi-stage, sem exigir JDK na máquina |
| `labs/providers/app/src/main/java/checkout/Checkout.java` | a aplicação, com os marcadores |
| `labs/providers/collector.yaml` | receiver OTLP + exportador de depuração |
| `packages/otel-domain/src/exercicios/tipos.ts` | `DefinicaoDeExercicio`, `Distrator` |
| `packages/otel-domain/src/exercicios/providers.ts` | os dois exercícios, como dado |
| `packages/otel-domain/src/exercicios/exercicios.test.ts` | as regras sobre a definição |
| `apps/site/src/lib/exercicios.ts` | a extração, em build-time |
| `apps/site/src/lib/exercicios.test.ts` | o recorte bate com o arquivo |
| `apps/site/src/lib/placar.ts` | `ovh:placar:v1` |
| `apps/site/src/components/Exercicio.tsx` | a peça, neutra de domínio |
| `apps/site/src/components/Exercicio.css` | sem tinta própria |
| `apps/site/src/components/Exercicio.test.tsx` | o comportamento da peça |
| `apps/site/tests/exercicio.spec.ts` | e2e, incluindo o caminho por teclado |

Modificar:

| Arquivo | O quê |
| --- | --- |
| `packages/otel-domain/src/index.ts` | barril: exportar os exercícios |
| `apps/site/src/pages/labs/providers.astro` | a seção `Instrument it` |
| `apps/site/src/components/Roadmap.tsx` | o `n/m first try` no nó |
| `apps/site/src/components/Roadmap.css` | o estilo do placar no nó |
| `docs/PROGRESS.md`, `docs/roadmap.md` | o registro |

---

## Bloco A — a contraparte real

### Task 1: o esqueleto do lab, com a versão fixada por consulta

**Files:**
- Create: `labs/providers/app/pom.xml`, `labs/providers/app/Dockerfile`,
  `labs/providers/collector.yaml`, `labs/providers/compose.yaml`

- [ ] **Step 1: conferir as três versões — elas já foram consultadas, e não se inventam**

Consultadas em 2026-09-01 no repositório canônico, e é este o número que vai no arquivo:

| Artefato | Versão | Onde foi lido |
| --- | --- | --- |
| `io.opentelemetry:opentelemetry-bom` | **1.65.0** | `repo1.maven.org/.../opentelemetry-bom/maven-metadata.xml`, campo `<release>` |
| `io.opentelemetry.semconv:opentelemetry-semconv` | **1.43.0** | idem — e ele é **fora do BOM**, ver Task 2 |
| `otel/opentelemetry-collector-contrib` | **0.159.0** | maior tag estável no Docker Hub |

Confira antes de escrever, porque o número envelhece:

```bash
curl -s https://repo1.maven.org/maven2/io/opentelemetry/opentelemetry-bom/maven-metadata.xml | grep '<release>'
curl -s https://repo1.maven.org/maven2/io/opentelemetry/semconv/opentelemetry-semconv/maven-metadata.xml | grep '<release>'
curl -s "https://hub.docker.com/v2/repositories/otel/opentelemetry-collector-contrib/tags?page_size=100" \
  | grep -o '"name":"[0-9]\+\.[0-9]\+\.[0-9]\+"' | sed 's/"name":"//;s/"//' | sort -V | tail -1
```

> **`search.maven.org` não responde neste ambiente** — foi por onde a primeira versão deste
> plano mandava consultar, e ela falha em silêncio devolvendo vazio. O `maven-metadata.xml`
> do `repo1` é a fonte canônica e responde.

Se as consultas devolverem vazio, **use os números da tabela** — eles foram lidos, não
inventados. O que não se pode é escrever um número plausível sem tê-lo lido em lugar nenhum:
um `pom.xml` que não resolve envenena todo o Bloco B.

- [ ] **Step 2: `labs/providers/app/pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>info.openlabs</groupId>
  <artifactId>checkout</artifactId>
  <version>1.0.0</version>
  <packaging>jar</packaging>

  <properties>
    <maven.compiler.release>21</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>

  <dependencyManagement>
    <dependencies>
      <!--
        A versão é fixada, e é ela que o exercício mostra na tela. Nada de
        `-alpha` nem de incubador: o handbook só ensina API estável.
      -->
      <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-bom</artifactId>
        <version>1.65.0</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <dependencies>
    <dependency>
      <groupId>io.opentelemetry</groupId>
      <artifactId>opentelemetry-api</artifactId>
    </dependency>
    <dependency>
      <groupId>io.opentelemetry</groupId>
      <artifactId>opentelemetry-sdk</artifactId>
    </dependency>
    <dependency>
      <groupId>io.opentelemetry</groupId>
      <artifactId>opentelemetry-exporter-otlp</artifactId>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-shade-plugin</artifactId>
        <version>3.5.2</version>
        <executions>
          <execution>
            <phase>package</phase>
            <goals><goal>shade</goal></goals>
            <configuration>
              <transformers>
                <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
                  <mainClass>checkout.Checkout</mainClass>
                </transformer>
              </transformers>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 3: `labs/providers/app/Dockerfile`**

```dockerfile
# Multi-stage: quem clona o repo não precisa de JDK nem de Maven na máquina.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/checkout-1.0.0.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

- [ ] **Step 4: `labs/providers/collector.yaml`**

```yaml
# O Collector mais simples que existe: recebe OTLP e imprime.
# É a borda do lab, e ela é opaca de propósito — o que acontece DENTRO dele é o
# lab `collector-pipeline`, e não este.
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  debug:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [debug]
```

- [ ] **Step 5: `labs/providers/compose.yaml`**

```yaml
# Duas variáveis, e são as duas que o lab da tela também tem. Mexer nelas aqui e
# no lab tem de produzir a mesma história — é isso que "contraparte real"
# significa.
services:
  collector:
    image: otel/opentelemetry-collector-contrib:0.159.0
    command: ["--config=/etc/collector.yaml"]
    volumes:
      - ./collector.yaml:/etc/collector.yaml:ro

  checkout:
    build: ./app
    depends_on: [collector]
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://collector:4317
      OTEL_TRACES_SAMPLER_ARG: "1.0"
      OTEL_BSP_SCHEDULE_DELAY: "5000"
```

> ⚠️ **Confirme que a imagem baixa** antes de commitar:
> `docker pull otel/opentelemetry-collector-contrib:0.159.0`. A primeira versão deste plano
> trazia `0.111.0`, que é de outra época — o aviso pagou por si.

- [ ] **Step 6: Commit**

```bash
git add labs/providers
git commit -m "feat(labs): o esqueleto da contraparte real dos provedores"
```

---

### Task 2: a aplicação, com os marcadores que o exercício recorta

**Files:**
- Create: `labs/providers/app/src/main/java/checkout/Checkout.java`

- [ ] **Step 1: escrever o arquivo**

Os marcadores **não são decoração**: `apps/site/src/lib/exercicios.ts` os lê no build, e um
teste falha se eles sumirem. Os dois `trecho` abaixo são exatamente os ids que a Task 6
declara.

```java
package checkout;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;

import static io.opentelemetry.semconv.ServiceAttributes.SERVICE_NAME;

/** O checkout: uma rota, instrumentada à mão. */
public final class Checkout {

  private static OpenTelemetry instalarSdk() {
    // <handbook:trecho id="onde-mora-o-service-name">
    Resource recurso =
        Resource.getDefault().merge(
            // <handbook:lacuna>
            Resource.create(Attributes.of(SERVICE_NAME, "checkout"))
            // </handbook:lacuna>
        );

    SdkTracerProvider provider =
        SdkTracerProvider.builder()
            .setResource(recurso)
            .addSpanProcessor(
                BatchSpanProcessor.builder(OtlpGrpcSpanExporter.builder().build()).build())
            .build();
    // </handbook:trecho>

    return OpenTelemetrySdk.builder().setTracerProvider(provider).buildAndRegisterGlobal();
  }

  private static void atender(OpenTelemetry otel) {
    // <handbook:trecho id="de-onde-vem-o-tracer">
    // <handbook:lacuna>
    Tracer tracer = otel.getTracer("checkout.http");
    // </handbook:lacuna>

    Span span = tracer.spanBuilder("GET /checkout").startSpan();
    try (var escopo = span.makeCurrent()) {
      span.setAttribute("http.route", "/checkout");
    } finally {
      span.end();
    }
    // </handbook:trecho>
  }

  public static void main(String[] args) throws InterruptedException {
    OpenTelemetry otel = instalarSdk();
    for (int i = 0; i < 60; i++) {
      atender(otel);
      Thread.sleep(1000);
    }
  }
}
```

> ⚠️ **`SERVICE_NAME` vem de `opentelemetry-semconv`, e ele NÃO está no BOM.** Acrescente ao
> `pom.xml`, com versão própria, e **registre no README** que ela é a exceção:
>
> ```xml
> <dependency>
>   <groupId>io.opentelemetry.semconv</groupId>
>   <artifactId>opentelemetry-semconv</artifactId>
>   <version>1.43.0</version>
> </dependency>
> ```
>
> Se o import continuar quebrando, confira o pacote da constante na versão instalada com
> `unzip -l ~/.m2/repository/io/opentelemetry/semconv/opentelemetry-semconv/1.43.0/*.jar | grep -i serviceattributes`
> — o nome da classe mudou de lugar mais de uma vez, e o exercício não pode nascer com um
> import que não resolve.

- [ ] **Step 2: rodar de verdade**

Run: `cd labs/providers && docker compose up --build`
Expected: o Collector imprime spans com `Name: GET /checkout` e um recurso com
`service.name: checkout`. Deixe rodar dois ciclos do lote (dez segundos) antes de derrubar.

Se não subir, **conserte aqui**. Um arquivo que não roda quebra a premissa inteira do
Bloco B.

- [ ] **Step 3: `labs/providers/README.md`**

Escreva, em inglês: o que o compose sobe, como rodar, **o que observar** (o lote saindo a
cada cinco segundos; o `resource` chegando uma camada acima dos spans no envelope) e **o
que não dá para ver ali** — a fila enchendo, e o lote partindo por tempo em vez de tamanho.
Essas duas são o que o lab da tela mostra e o terminal não, e dizer isso é o argumento do
projeto inteiro.

- [ ] **Step 4: Commit**

```bash
git add labs/providers
git commit -m "feat(labs): o checkout instrumentado à mão, e o que ele não mostra"
```

---

## Bloco B — a extração

> **A ordem de execução dentro deste bloco é 3 → 6 → 4 → 5.** A extração (Task 4) só tem o
> que extrair depois de a definição (Task 6) existir; a numeração segue a leitura — tipos,
> extração, mutação, dado —, e a execução segue a dependência.

### Task 3: os tipos, e o que eles deliberadamente não têm

**Files:**
- Create: `packages/otel-domain/src/exercicios/tipos.ts`

- [ ] **Step 1: escrever o arquivo**

```ts
/**
 * A definição de um exercício.
 *
 * Note o que **não** está aqui: o código da resposta certa. Ele é extraído do
 * arquivo que roda, no build (`apps/site/src/lib/exercicios.ts`), e por isso não
 * existe como escrevê-lo errado nem como ele envelhecer em silêncio. O que é
 * autoral são os distratores e as explicações — explicação, não veredito.
 */
export interface Distrator {
  readonly id: string;
  /** O código que vai na lacuna. Mesma forma do certo: ver `porqueMesmaForma`. */
  readonly codigo: string;
  /** Por que isto PARECE certo, e o que a spec diz. Escrito para quem já acredita nele. */
  readonly porque: string;
  /** A âncora na spec. Obrigatória, como em `MAL_ENTENDIDOS`. */
  readonly fonte: string;
}

export interface DefinicaoDeExercicio {
  readonly id: string;
  /** O id do lab a que ele pertence, como no mapa. */
  readonly lab: string;
  /** A frase da aplicação: o que ela faz, o que já existe. Em inglês. */
  readonly cenario: string;
  /** O caminho, a partir da raiz do repo, do arquivo que roda. */
  readonly arquivo: string;
  /** O id do marcador `<handbook:trecho id="…">` dentro dele. */
  readonly trecho: string;
  /** A pergunta, em inglês. */
  readonly pergunta: string;
  /** Por que o bloco certo é o certo. */
  readonly porqueCerto: string;
  readonly fonteCerto: string;
  readonly distratores: readonly Distrator[];
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/otel-domain/src/exercicios/tipos.ts
git commit -m "feat(otel): o tipo do exercício, sem campo para a resposta certa"
```

---

### Task 4: a extração, e o teste que a torna verdadeira

**Files:**
- Create: `apps/site/src/lib/exercicios.ts`
- Test: `apps/site/src/lib/exercicios.test.ts`

- [ ] **Step 1: escrever o teste que falha**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCICIOS_DOS_PROVEDORES } from "@ovh/otel-domain";
import { montarExercicio } from "./exercicios.js";

describe("o recorte sai do arquivo que roda", () => {
  it.each(EXERCICIOS_DOS_PROVEDORES.map((e) => [e.id, e] as const))(
    "%s: o marcador existe e o trecho não vem vazio",
    (_id, definicao) => {
      const montado = montarExercicio(definicao);
      expect(montado.antes.length + montado.depois.length).toBeGreaterThan(0);
      expect(montado.certo.codigo.trim().length).toBeGreaterThan(0);
    },
  );

  it("o bloco certo é, caractere por caractere, o que está entre os marcadores de lacuna", () => {
    // É ESTE teste que transforma "a resposta é extraída" de promessa em fato.
    const definicao = EXERCICIOS_DOS_PROVEDORES[0]!;
    const montado = montarExercicio(definicao);
    const fonte = lerArquivo(definicao.arquivo);
    expect(fonte).toContain(montado.certo.codigo.trim());
  });

  it("nenhum distrator é igual ao certo — senão o exercício vira moeda", () => {
    for (const definicao of EXERCICIOS_DOS_PROVEDORES) {
      const montado = montarExercicio(definicao);
      const normal = (s: string) => s.replace(/\s+/gu, " ").trim();
      for (const bloco of montado.blocos) {
        if (bloco.certo === true) continue;
        expect(normal(bloco.codigo), bloco.id).not.toBe(normal(montado.certo.codigo));
      }
    }
  });

  it("a ordem dos blocos é estável entre dois builds", () => {
    // Sorteio real quebraria o SSG: o servidor renderiza uma ordem e o cliente
    // hidrata com outra. A ordem sai do id, e por isso é a mesma sempre.
    const definicao = EXERCICIOS_DOS_PROVEDORES[0]!;
    const a = montarExercicio(definicao).blocos.map((b) => b.id);
    const b = montarExercicio(definicao).blocos.map((b) => b.id);
    expect(a).toEqual(b);
  });

  it("um marcador que não existe FALHA, e diz qual", () => {
    const quebrado = { ...EXERCICIOS_DOS_PROVEDORES[0]!, trecho: "nao-existe" };
    expect(() => montarExercicio(quebrado)).toThrow(/nao-existe/u);
  });
});

function lerArquivo(caminho: string): string {
  // `readFileSync` importado no topo: `require` não existe num módulo ESM, e o
  // pacote é `"type": "module"`.
  return readFileSync(new URL(`../../../../${caminho}`, import.meta.url), "utf8");
}
```

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run apps/site/src/lib/exercicios.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: implementar `apps/site/src/lib/exercicios.ts`**

```ts
import { readFileSync } from "node:fs";
import type { DefinicaoDeExercicio, Distrator } from "@ovh/otel-domain";

/**
 * A extração, e ela roda no **build**.
 *
 * O frontmatter do Astro executa em Node, então ler o arquivo aqui é ler uma vez,
 * na geração da página. A ilha recebe o resultado como propriedade e nunca toca
 * no sistema de arquivos — o que é obrigatório, porque ela roda no navegador.
 */

/** A raiz do repositório, a partir deste arquivo: lib → src → site → apps → raiz. */
const RAIZ = new URL("../../../../", import.meta.url);

export interface BlocoDeCodigo {
  readonly id: string;
  readonly codigo: string;
  readonly porque: string;
  readonly fonte: string;
  readonly certo?: true;
}

export interface ExercicioMontado {
  readonly id: string;
  readonly lab: string;
  readonly cenario: string;
  readonly pergunta: string;
  readonly arquivo: string;
  /** A versão do SDK, lida do `pom.xml` do lab. Aparece na tela ao lado do código. */
  readonly versao: string;
  /** O código acima da lacuna, já sem os marcadores. */
  readonly antes: string;
  readonly depois: string;
  readonly certo: BlocoDeCodigo;
  /** Os três, na ordem em que a tela os mostra. Estável entre builds. */
  readonly blocos: readonly BlocoDeCodigo[];
}

const abre = (id: string): string => `<handbook:trecho id="${id}">`;
const FECHA_TRECHO = "</handbook:trecho>";
const ABRE_LACUNA = "<handbook:lacuna>";
const FECHA_LACUNA = "</handbook:lacuna>";

/** Tira a indentação comum, para o trecho não nascer torto na tela. */
function desindentar(linhas: readonly string[]): string {
  const uteis = linhas.filter((l) => l.trim().length > 0);
  const minimo = uteis.reduce(
    (menor, l) => Math.min(menor, l.length - l.trimStart().length),
    Number.POSITIVE_INFINITY,
  );
  const corte = Number.isFinite(minimo) ? minimo : 0;
  return linhas.map((l) => l.slice(corte)).join("\n").replace(/^\n+|\n+$/gu, "");
}

/** Ordem estável, derivada do id: sorteio quebraria a hidratação do SSG. */
function embaralharPorSemente<T>(itens: readonly T[], semente: string): readonly T[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < semente.length; i += 1) {
    h ^= semente.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const giro = h % Math.max(1, itens.length);
  return [...itens.slice(giro), ...itens.slice(0, giro)];
}

/** A versão do BOM, lida do `pom.xml`: uma fonte só para o número que a tela mostra. */
function versaoDoBom(): string {
  const pom = readFileSync(new URL("labs/providers/app/pom.xml", RAIZ), "utf8");
  const achado = /<artifactId>opentelemetry-bom<\/artifactId>\s*<version>([^<]+)<\/version>/u.exec(pom);
  if (achado?.[1] === undefined) {
    throw new Error(
      "não achei a versão do opentelemetry-bom em labs/providers/app/pom.xml — " +
        "a tela mostra esse número, e ele não pode ser escrito em dois lugares",
    );
  }
  return achado[1];
}

export function montarExercicio(definicao: DefinicaoDeExercicio): ExercicioMontado {
  const fonte = readFileSync(new URL(definicao.arquivo, RAIZ), "utf8");

  const inicio = fonte.indexOf(abre(definicao.trecho));
  if (inicio < 0) {
    throw new Error(
      `exercício "${definicao.id}": o marcador <handbook:trecho id="${definicao.trecho}"> ` +
        `não está em ${definicao.arquivo}. O recorte sai do arquivo que roda, e sem o ` +
        `marcador não há de onde recortar.`,
    );
  }
  const fim = fonte.indexOf(FECHA_TRECHO, inicio);
  if (fim < 0) {
    throw new Error(`exercício "${definicao.id}": o trecho "${definicao.trecho}" não fecha`);
  }

  const corpo = fonte.slice(fonte.indexOf("\n", inicio) + 1, fonte.lastIndexOf("\n", fim));
  const linhas = corpo.split("\n").filter((l) => !l.includes("<handbook:trecho"));

  const iAbre = linhas.findIndex((l) => l.includes(ABRE_LACUNA));
  const iFecha = linhas.findIndex((l) => l.includes(FECHA_LACUNA));
  if (iAbre < 0 || iFecha < 0 || iFecha <= iAbre) {
    throw new Error(
      `exercício "${definicao.id}": o trecho "${definicao.trecho}" não tem lacuna ` +
        `(${ABRE_LACUNA} … ${FECHA_LACUNA})`,
    );
  }

  const certo: BlocoDeCodigo = {
    id: `${definicao.id}-certo`,
    codigo: desindentar(linhas.slice(iAbre + 1, iFecha)),
    porque: definicao.porqueCerto,
    fonte: definicao.fonteCerto,
    certo: true,
  };

  const paraBloco = (d: Distrator): BlocoDeCodigo => ({
    id: d.id,
    codigo: d.codigo,
    porque: d.porque,
    fonte: d.fonte,
  });

  return {
    id: definicao.id,
    lab: definicao.lab,
    cenario: definicao.cenario,
    pergunta: definicao.pergunta,
    arquivo: definicao.arquivo,
    versao: versaoDoBom(),
    antes: desindentar(linhas.slice(0, iAbre)),
    depois: desindentar(linhas.slice(iFecha + 1)),
    certo,
    blocos: embaralharPorSemente([certo, ...definicao.distratores.map(paraBloco)], definicao.id),
  };
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `pnpm vitest run apps/site/src/lib/exercicios.test.ts`
Expected: PASS. (Depende da Task 6 existir — se ela ainda não existe, faça a Task 6 antes
e volte aqui.)

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/exercicios.ts apps/site/src/lib/exercicios.test.ts
git commit -m "feat(site): a resposta certa é extraída do arquivo que roda, e há teste"
```

---

### Task 5: teste de mutação da extração

**Files:**
- Modify: nenhum. É uma verificação manual, e ela vai para o registro.

- [ ] **Step 1:** apague a linha `// <handbook:lacuna>` do `Checkout.java`.
- [ ] **Step 2:** Run `pnpm vitest run apps/site/src/lib/exercicios.test.ts`.
      Expected: FAIL, com a mensagem que nomeia o exercício e diz o que falta.
- [ ] **Step 3:** restaure a linha e confirme que volta a passar.
- [ ] **Step 4:** anote o resultado — ele entra no `PROGRESS.md` na Task 12. Sem esta
      verificação, "a resposta é extraída" é promessa; com ela, é fato.

---

### Task 6: os dois exercícios, como dado

**Files:**
- Create: `packages/otel-domain/src/exercicios/providers.ts`
- Test: `packages/otel-domain/src/exercicios/exercicios.test.ts`
- Modify: `packages/otel-domain/src/index.ts`

- [ ] **Step 1: escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { MAPA_OTEL } from "../../../../apps/site/src/data/roadmap.js";
import { EXERCICIOS_DOS_PROVEDORES } from "./providers.js";

describe("a definição do exercício", () => {
  it("todo bloco carrega a âncora na spec, como os mal-entendidos", () => {
    for (const e of EXERCICIOS_DOS_PROVEDORES) {
      expect(e.fonteCerto, e.id).toMatch(/^https:\/\/(opentelemetry\.io|www\.w3\.org)\//u);
      for (const d of e.distratores) {
        expect(d.fonte, d.id).toMatch(/^https:\/\/(opentelemetry\.io|www\.w3\.org)\//u);
      }
    }
  });

  it("cada exercício tem exatamente dois distratores", () => {
    // Um só vira sim/não; três empurram a lacuna para fora da tela.
    for (const e of EXERCICIOS_DOS_PROVEDORES) {
      expect(e.distratores.length, e.id).toBe(2);
    }
  });

  it("todo id é único, porque o placar é indexado por ele", () => {
    const ids = EXERCICIOS_DOS_PROVEDORES.flatMap((e) => [e.id, ...e.distratores.map((d) => d.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo exercício aponta para um arquivo dentro de labs/", () => {
    for (const e of EXERCICIOS_DOS_PROVEDORES) {
      expect(e.arquivo, e.id).toMatch(/^labs\//u);
    }
  });

  it("todo exercício pertence a um lab que EXISTE no mapa", () => {
    // Sem isto, um exercício órfão renderiza uma seção que o mapa não conhece, e
    // o placar conta para um nó que não existe. É a mesma regra de fonte única
    // que já vale para o catálogo de labs.
    const doMapa = new Set(MAPA_OTEL.labs.map((l) => l.id));
    for (const e of EXERCICIOS_DOS_PROVEDORES) {
      expect(doMapa.has(e.lab), `${e.id} aponta para o lab "${e.lab}"`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run packages/otel-domain/src/exercicios/exercicios.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: implementar `providers.ts`**

```ts
import type { DefinicaoDeExercicio } from "./tipos.js";

const ARQUIVO = "labs/providers/app/src/main/java/checkout/Checkout.java";

/**
 * Os exercícios do lab dos provedores.
 *
 * Cada distrator é **um mal-entendido nomeado** — a mesma régua da tabela
 * `MAL_ENTENDIDOS`, e escrito para quem já acredita nele. Nenhum deles é um erro
 * bobo: os dois aparecem em código de produção.
 */
export const EXERCICIOS_DOS_PROVEDORES: readonly DefinicaoDeExercicio[] = [
  {
    id: "de-onde-vem-o-tracer",
    lab: "providers",
    arquivo: ARQUIVO,
    trecho: "de-onde-vem-o-tracer",
    cenario:
      "The checkout service already installs an SDK at start-up. This method handles one " +
      "request, and it needs a span.",
    pergunta: "Where does the Tracer come from?",
    porqueCerto:
      "A Tracer only ever comes from a provider. Asking the OpenTelemetry instance you " +
      "installed is what ties this span to that provider's resource, sampler and " +
      "processors — everything that decides whether it leaves the process.",
    fonteCerto: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#tracer-creation",
    distratores: [
      {
        id: "de-onde-vem-o-tracer-novo-provider",
        codigo: 'Tracer tracer = SdkTracerProvider.builder().build().get("checkout.http");',
        porque:
          "This compiles, runs, and never raises — which is exactly why it is dangerous. " +
          "You just built a second provider with a default resource, so these spans go " +
          "out with a different service.name than the rest of the process, and the " +
          "backend quietly stops correlating them.",
        fonte: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
      },
      {
        id: "de-onde-vem-o-tracer-global",
        codigo: 'Tracer tracer = GlobalOpenTelemetry.getTracer("checkout.http");',
        porque:
          "Not wrong in general — it is how a library with no handle finds the SDK. It is " +
          "wrong HERE: this method already has the instance, and reaching for the global " +
          "hides which provider you are talking to, so the same code behaves differently " +
          "depending on whether anything registered one.",
        fonte:
          "https://opentelemetry.io/docs/specs/otel/trace/api/#behavior-of-the-api-in-the-absence-of-an-installed-sdk",
      },
    ],
  },
  {
    id: "onde-mora-o-service-name",
    lab: "providers",
    arquivo: ARQUIVO,
    trecho: "onde-mora-o-service-name",
    cenario:
      "The same service, at start-up. Everything it exports has to say which service it " +
      "came from.",
    pergunta: "Where does service.name belong?",
    porqueCerto:
      "It is a Resource attribute, and the Resource belongs to the provider. That is why " +
      "it sits one layer above the spans in the OTLP envelope — and why every span, " +
      "metric and log this process produces carries it without anyone setting it twice.",
    fonteCerto: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
    distratores: [
      {
        id: "onde-mora-o-service-name-no-span",
        codigo: 'span.setAttribute("service.name", "checkout");',
        porque:
          "The single most common way to get this wrong. It sets a span attribute that " +
          "happens to be spelled service.name — and backends read the one on the " +
          "resource, one layer above. Your spans look annotated and stay unattributed.",
        fonte:
          "https://opentelemetry.io/docs/specs/otel/trace/api/#set-attributes",
      },
      {
        id: "onde-mora-o-service-name-no-escopo",
        codigo: 'Tracer tracer = otel.getTracer("checkout");',
        porque:
          "The instrumentation scope names the library that produced the telemetry, not " +
          "the service that ran it. It is the middle layer of the envelope, and putting " +
          "the service there leaves the resource empty.",
        fonte: "https://opentelemetry.io/docs/specs/otel/glossary/#instrumentation-scope",
      },
    ],
  },
];
```

- [ ] **Step 4: exportar no barril**

Em `packages/otel-domain/src/index.ts`, acrescente:

```ts
export { EXERCICIOS_DOS_PROVEDORES } from "./exercicios/providers.js";
export type { DefinicaoDeExercicio, Distrator } from "./exercicios/tipos.js";
```

- [ ] **Step 5: rodar e ver passar**

Run: `pnpm vitest run packages/otel-domain/src/exercicios/exercicios.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/otel-domain/src
git commit -m "feat(otel): os dois exercícios dos provedores, com o distrator ancorado na spec"
```

---

## Bloco C — a peça

### Task 7: o placar

**Files:**
- Create: `apps/site/src/lib/placar.ts`
- Test: `apps/site/src/lib/placar.test.ts`

- [ ] **Step 1: escrever o teste que falha**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { lerPlacar, registrar, CHAVE_DO_PLACAR } from "./placar.js";

afterEach(() => window.localStorage.clear());

describe("o placar guarda o acerto de PRIMEIRA", () => {
  it("nasce vazio", () => {
    expect(lerPlacar()).toEqual({});
  });

  it("acertar de primeira fica registrado como primeira", () => {
    registrar("e1", true);
    expect(lerPlacar()["e1"]).toBe("primeira");
  });

  it("errar registra depois, e acertar em seguida NÃO promove", () => {
    // É a regra inteira: premia prever, não tentar até ficar verde.
    registrar("e1", false);
    registrar("e1", true);
    expect(lerPlacar()["e1"]).toBe("depois");
  });

  it("não encosta na chave do progresso do mapa", () => {
    registrar("e1", true);
    expect(CHAVE_DO_PLACAR).not.toBe("ovh:progress:v1");
    expect(window.localStorage.getItem("ovh:progress:v1")).toBeNull();
  });

  it("storage indisponível não derruba a página", () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error("modo privado"); };
    expect(() => registrar("e2", true)).not.toThrow();
    window.localStorage.setItem = original;
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run apps/site/src/lib/placar.test.ts`
Expected: FAIL — módulo não existe.

> O projeto `dom` do vitest já inclui `apps/site/src/**/*.test.tsx`. **Este arquivo é `.ts`**
> e cai no projeto `node`, que não tem `window`. Acrescente
> `"apps/site/src/lib/placar.test.ts"` ao `include` do projeto `dom` em
> `vitest.workspace.ts`, e **remova-o** do casamento do `node` se ele passar a casar duas
> vezes (o `node` inclui `apps/site/src/**/*.test.ts`). A forma mais simples é nomear o
> teste `placar.test.tsx`; prefira isso.

- [ ] **Step 3: implementar**

```ts
/**
 * O placar: quem acertou **de primeira**.
 *
 * A métrica é escolhida. Contar acertos totais recompensaria a segunda tentativa,
 * que é o hábito que este handbook não quer ensinar — é a mesma razão pela qual a
 * peça de predição não deixa trocar a resposta.
 *
 * Chave própria: `ovh:progress:v1` guarda quais labs foram lidos, e mexer nela
 * apagaria o progresso de quem já leu.
 */
export const CHAVE_DO_PLACAR = "ovh:placar:v1";

export type Resultado = "primeira" | "depois";
export type Placar = Readonly<Record<string, Resultado>>;

export function lerPlacar(): Placar {
  try {
    const bruto = window.localStorage.getItem(CHAVE_DO_PLACAR);
    if (bruto === null) return {};
    const lido: unknown = JSON.parse(bruto);
    if (typeof lido !== "object" || lido === null) return {};
    const saida: Record<string, Resultado> = {};
    for (const [chave, valor] of Object.entries(lido as Record<string, unknown>)) {
      if (valor === "primeira" || valor === "depois") saida[chave] = valor;
    }
    return saida;
  } catch {
    return {};
  }
}

export function registrar(exercicio: string, acertou: boolean): void {
  const atual = lerPlacar();
  // A primeira resposta é a que vale, e ela não se refaz. Uma segunda chamada
  // para o mesmo exercício não muda nada.
  if (atual[exercicio] !== undefined) return;
  try {
    window.localStorage.setItem(
      CHAVE_DO_PLACAR,
      JSON.stringify({ ...atual, [exercicio]: acertou ? "primeira" : "depois" }),
    );
  } catch {
    // Modo privado ou storage cheio: o exercício segue funcionando sem memória.
  }
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `pnpm vitest run apps/site/src/lib/placar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/lib/placar.ts apps/site/src/lib/placar.test.tsx vitest.workspace.ts
git commit -m "feat(site): o placar do acerto de primeira, em chave própria"
```

---

### Task 8: a peça, e o caminho por teclado antes do arraste

**Files:**
- Create: `apps/site/src/components/Exercicio.tsx`, `Exercicio.css`
- Test: `apps/site/src/components/Exercicio.test.tsx`

- [ ] **Step 1: escrever o teste que falha**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Exercicio } from "./Exercicio.js";

afterEach(() => { cleanup(); window.localStorage.clear(); });

const montado = {
  id: "e1",
  lab: "providers",
  cenario: "The checkout service already installs an SDK.",
  pergunta: "Where does the Tracer come from?",
  arquivo: "labs/providers/app/src/main/java/checkout/Checkout.java",
  antes: "OpenTelemetry otel = GlobalOpenTelemetry.get();",
  depois: 'Span span = tracer.spanBuilder("GET /checkout").startSpan();',
  certo: {
    id: "e1-certo",
    codigo: 'Tracer tracer = otel.getTracer("checkout.http");',
    porque: "A Tracer only ever comes from a provider.",
    fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#tracer-creation",
    certo: true as const,
  },
  blocos: [
    {
      id: "e1-errado",
      codigo: "Tracer tracer = new SdkTracer();",
      porque: "You just built a second provider.",
      fonte: "https://opentelemetry.io/docs/specs/otel/resource/sdk/",
    },
    {
      id: "e1-certo",
      codigo: 'Tracer tracer = otel.getTracer("checkout.http");',
      porque: "A Tracer only ever comes from a provider.",
      fonte: "https://opentelemetry.io/docs/specs/otel/trace/sdk/#tracer-creation",
      certo: true as const,
    },
  ],
};

describe("o exercício de instrumentação", () => {
  it("a explicação NÃO está no documento antes de responder", () => {
    render(<Exercicio exercicio={montado} />);
    expect(screen.queryByText(/only ever comes from a provider/u)).toBeNull();
  });

  it("escolher pelo TECLADO encaixa o bloco, sem arraste nenhum", () => {
    // Arrastar é a camada de cima. Se só ela funcionasse, metade dos leitores
    // ficaria de fora — e a peça de predição já nasceu botão puro.
    render(<Exercicio exercicio={montado} />);
    fireEvent.click(screen.getByRole("button", { name: /getTracer/u }));
    expect(screen.getByText(/only ever comes from a provider/u)).not.toBeNull();
  });

  it("o veredito é ATRIBUTO, e não só cor", () => {
    render(<Exercicio exercicio={montado} />);
    fireEvent.click(screen.getByRole("button", { name: /new SdkTracer/u }));
    expect(
      screen.getByRole("button", { name: /new SdkTracer/u }).getAttribute("data-veredito"),
    ).toBe("errado");
    expect(
      screen.getByRole("button", { name: /getTracer/u }).getAttribute("data-veredito"),
    ).toBe("certo");
  });

  it("depois de responder, os dois blocos mostram a explicação — inclusive o não escolhido", () => {
    render(<Exercicio exercicio={montado} />);
    fireEvent.click(screen.getByRole("button", { name: /new SdkTracer/u }));
    expect(screen.getByText(/second provider/u)).not.toBeNull();
    expect(screen.getByText(/only ever comes from a provider/u)).not.toBeNull();
  });

  it("a escolha não se refaz", () => {
    render(<Exercicio exercicio={montado} />);
    fireEvent.click(screen.getByRole("button", { name: /new SdkTracer/u }));
    for (const nome of [/new SdkTracer/u, /getTracer/u]) {
      expect((screen.getByRole("button", { name: nome }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `pnpm vitest run apps/site/src/components/Exercicio.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: implementar `Exercicio.tsx`**

```tsx
import { useState } from "react";
import type { ExercicioMontado } from "../lib/exercicios.js";
import { registrar } from "../lib/placar.js";

/**
 * Um exercício de instrumentação: o código com uma lacuna, e três blocos.
 *
 * **Botão primeiro, arraste depois.** Cada bloco é um `<button>`: clicar escolhe.
 * O arraste é uma camada por cima disso e some sem prejuízo — se ele fosse o
 * único caminho, metade dos leitores ficaria de fora.
 *
 * A escolha não se refaz, pela mesma razão da peça de predição: o compromisso é o
 * mecanismo. E a explicação só entra no DOM depois da resposta — escondê-la com
 * CSS a deixaria legível no inspetor e, pior, para quem usa leitor de tela.
 */
export interface ExercicioProps {
  readonly exercicio: ExercicioMontado;
}

export function Exercicio({ exercicio }: ExercicioProps) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const respondeu = escolhido !== null;

  const escolher = (id: string): void => {
    if (respondeu) return;
    setEscolhido(id);
    registrar(exercicio.id, id === exercicio.certo.id);
  };

  const veredito = (bloco: { readonly id: string; readonly certo?: true }): string | undefined => {
    if (!respondeu) return undefined;
    if (bloco.certo === true) return "certo";
    return bloco.id === escolhido ? "errado" : "outro";
  };

  const preenchida = respondeu
    ? exercicio.blocos.find((b) => b.id === escolhido)?.codigo
    : undefined;

  return (
    <div className="exercicio" data-respondeu={respondeu ? "true" : undefined}>
      <p className="exercicio__cenario">{exercicio.cenario}</p>
      <p className="exercicio__pergunta">{exercicio.pergunta}</p>

      <pre className="exercicio__codigo mono">
        <code>
          {exercicio.antes}
          {"\n"}
          <span className="exercicio__lacuna" data-cheia={respondeu ? "true" : undefined}>
            {preenchida ?? " "}
          </span>
          {"\n"}
          {exercicio.depois}
        </code>
      </pre>

      <ul className="exercicio__blocos">
        {exercicio.blocos.map((bloco) => (
          <li key={bloco.id}>
            <button
              type="button"
              className="exercicio__bloco mono"
              onClick={() => escolher(bloco.id)}
              disabled={respondeu}
              aria-pressed={bloco.id === escolhido}
              data-veredito={veredito(bloco)}
              draggable={!respondeu}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", bloco.id)}
            >
              {bloco.codigo}
            </button>
            {respondeu ? (
              <p className="exercicio__porque">
                {bloco.porque}{" "}
                <a href={bloco.fonte} rel="noopener">
                  spec&nbsp;→
                </a>
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {respondeu ? null : (
        <p className="exercicio__aviso">
          Pick one. You cannot change it afterwards — and that is the point.
        </p>
      )}

      {/*
        De onde este código veio, e em que versão. Sem isto o leitor não tem como
        saber que a assinatura que ele acabou de escolher é de uma versão fixada —
        e a spec do handbook exige que toda afirmação técnica seja rastreável.
      */}
      <p className="exercicio__origem mono">
        {exercicio.arquivo} · OpenTelemetry Java {exercicio.versao}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: escrever `Exercicio.css`**

Sem tinta escrita — **nem em comentário**, que é como `pnpm catalogo` já pegou uma vez.

```css
/*
  Só token: a cor mora no catálogo do site e no do palco, e em lugar nenhum aqui.
  A gramática do veredito é a mesma da Predicao.css de propósito — quem já
  respondeu uma predição reconhece o certo e o errado sem reaprender.
*/
.exercicio {
  padding: var(--space-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-3);
  background: var(--paper-raised);
}

.exercicio__cenario {
  max-width: var(--measure);
  margin: 0 0 var(--space-1);
  color: var(--ink-muted);
  line-height: 1.6;
}

.exercicio__pergunta {
  margin: 0 0 var(--space-1);
  font-weight: 600;
}

.exercicio__codigo {
  overflow-x: auto;
  margin: 0 0 var(--space-2);
  padding: var(--space-1);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--paper);
  font-size: var(--size-step--1);
  line-height: 1.7;
}

/* A lacuna é um lugar vazio que se vê: pontilhada enquanto espera, cheia depois. */
.exercicio__lacuna {
  display: inline-block;
  min-width: 24ch;
  padding: 0 0.3rem;
  border: 1px dashed var(--accent);
  border-radius: var(--radius-1);
}

.exercicio__lacuna[data-cheia="true"] {
  border-style: solid;
}

.exercicio__blocos {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.exercicio__bloco {
  width: 100%;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: var(--radius-1);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--size-step--1);
  text-align: left;
  cursor: grab;
}

.exercicio__bloco:hover:not(:disabled) {
  border-color: var(--accent);
}

.exercicio__bloco:disabled {
  cursor: default;
}

/* O veredito é atributo, e não só cor: leitor de tela não lê borda. */
.exercicio__bloco[data-veredito="certo"] {
  border-color: var(--accent);
  font-weight: 600;
}

.exercicio__bloco[data-veredito="errado"] {
  border-color: var(--ink-muted);
  text-decoration: line-through;
}

.exercicio__bloco[data-veredito="outro"] {
  opacity: 0.6;
}

.exercicio__porque {
  max-width: var(--measure);
  margin: 0.35rem 0 0;
  color: var(--ink-muted);
  font-size: var(--size-step--1);
  line-height: 1.6;
}

.exercicio__aviso,
.exercicio__origem {
  margin: var(--space-1) 0 0;
  color: var(--ink-faint);
  font-size: var(--size-step--1);
}
```

- [ ] **Step 5: rodar e ver passar**

Run: `pnpm vitest run apps/site/src/components/Exercicio.test.tsx && pnpm catalogo`
Expected: PASS, e "Catálogo da linguagem visual intacto".

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/components/Exercicio.tsx apps/site/src/components/Exercicio.css apps/site/src/components/Exercicio.test.tsx
git commit -m "feat(site): a peça do exercício, com o teclado antes do arraste"
```

---

## Bloco D — a página e o mapa

### Task 9: a seção `Instrument it` na página do lab

**Files:**
- Modify: `apps/site/src/pages/labs/providers.astro`

- [ ] **Step 1:** no frontmatter, acrescente:

```ts
import { EXERCICIOS_DOS_PROVEDORES } from "@ovh/otel-domain";
import { Exercicio } from "../../components/Exercicio.tsx";
import { montarExercicio } from "../../lib/exercicios";
import "../../components/Exercicio.css";

// A extração roda AQUI, no build: o frontmatter do Astro executa em Node. A ilha
// recebe o resultado pronto e nunca toca no sistema de arquivos.
const exercicios = EXERCICIOS_DOS_PROVEDORES.map(montarExercicio);
```

- [ ] **Step 2:** acrescente a seção **depois** da seção `Break it` e **antes** de
      *What people get wrong*:

```astro
<section class="lab-prosa editorial">
  <div class="prose">
    <h2>Instrument it</h2>
    <p>
      Two decisions from the file that actually runs in
      <code>labs/providers/</code>. The correct block is not written here — it is
      lifted out of that file, so it cannot drift from the code that compiles.
      The wrong ones are real: both of them ship to production regularly.
    </p>
  </div>
  <div class="lab-exercicios">
    {exercicios.map((exercicio) => (
      <Exercicio client:visible exercicio={exercicio} />
    ))}
  </div>
</section>
```

- [ ] **Step 3:** acrescente ao `<style>` da página:

```css
.lab-exercicios {
  display: grid;
  gap: var(--space-2);
  grid-column: 1 / -1;
  margin-block-start: var(--space-2);
}
```

- [ ] **Step 4:** Run `pnpm build`
      Expected: 33 páginas, sem erro. Se o build reclamar de `node:fs` no cliente, a
      importação de `montarExercicio` vazou para a ilha — ela só pode ser chamada no
      frontmatter.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/pages/labs/providers.astro
git commit -m "feat(site): a seção Instrument it no lab dos provedores"
```

---

### Task 10: o `n/m first try` no nó do mapa

**Files:**
- Modify: `apps/site/src/components/Roadmap.tsx`, `apps/site/src/components/Roadmap.css`

- [ ] **Step 1:** em `Roadmap.tsx`, acrescente aos imports:

```ts
import { EXERCICIOS_DOS_PROVEDORES } from "@ovh/otel-domain";
import { lerPlacar } from "../lib/placar.js";
```

- [ ] **Step 2:** ao lado do `useState` de `done`, acrescente:

```ts
/**
 * Quantos exercícios cada lab tem sai da LISTA DE EXERCÍCIOS, e de nenhum outro
 * lugar. Uma segunda lista escrita à mão é o defeito que este repo já teve duas
 * vezes — o catálogo de labs, e o `href` do mapa.
 */
const exerciciosPorLab = new Map<string, string[]>();
for (const e of EXERCICIOS_DOS_PROVEDORES) {
  exerciciosPorLab.set(e.lab, [...(exerciciosPorLab.get(e.lab) ?? []), e.id]);
}

const [placar, setPlacar] = useState<Readonly<Record<string, string>>>({});
useEffect(() => setPlacar(lerPlacar()), []);
```

- [ ] **Step 3:** dentro do `return` do nó de lab, logo antes do `</div>` que fecha
      `.roadmap__node`, acrescente:

```tsx
{(() => {
  const desteLab = exerciciosPorLab.get(lab.id) ?? [];
  // Nó sem exercício não mostra `0/0`: zero de zero se lê como "você não fez",
  // e a pessoa não deixou de fazer nada.
  if (desteLab.length === 0) return null;
  const dePrimeira = desteLab.filter((id) => placar[id] === "primeira").length;
  return (
    <span className="roadmap__placar mono">
      {dePrimeira}/{desteLab.length} first try
    </span>
  );
})()}
```

- [ ] **Step 4:** em `Roadmap.css`:

```css
.roadmap__placar {
  display: block;
  margin-block-start: 0.15rem;
  color: var(--ink-faint);
  font-size: var(--size-step--1);
}
```

- [ ] **Step 5:** Run `pnpm typecheck && pnpm test`
      Expected: PASS. Se `landing.spec.ts` reclamar do texto do nó, o seletor dele
      passou a casar com o placar — restrinja o seletor a `.roadmap__node-title`.

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/components/Roadmap.tsx apps/site/src/components/Roadmap.css
git commit -m "feat(site): o acerto de primeira aparece no nó do mapa"
```

---

## Bloco E — o e2e

### Task 11: o exercício na tela, e o teclado cobrado

**Files:**
- Create: `apps/site/tests/exercicio.spec.ts`

- [ ] **Step 1: escrever o teste**

```ts
import { expect, test } from "@playwright/test";

/**
 * O que só a página responde. As regras sobre a definição e sobre a extração têm
 * teste de unidade; repeti-las aqui seria pagar caro por uma segunda opinião pior.
 */

test("a explicação não aparece antes de o leitor se comprometer", async ({ page }) => {
  await page.goto("labs/providers/");
  const secao = page.locator(".exercicio").first();
  await secao.scrollIntoViewIfNeeded();
  await expect(secao.locator(".exercicio__porque")).toHaveCount(0);
});

test("o caminho por TECLADO encaixa o bloco, sem arraste nenhum", async ({ page }) => {
  await page.goto("labs/providers/");
  const secao = page.locator(".exercicio").first();
  await secao.scrollIntoViewIfNeeded();

  const primeiro = secao.locator(".exercicio__bloco").first();
  await primeiro.focus();
  await page.keyboard.press("Enter");

  await expect(secao.locator(".exercicio__porque").first()).toBeVisible();
  await expect(secao.locator('.exercicio__lacuna[data-cheia="true"]')).toBeVisible();
});

test("a escolha não se refaz, e o placar do mapa conta o de primeira", async ({ page }) => {
  await page.goto("labs/providers/");
  const secao = page.locator(".exercicio").first();
  await secao.scrollIntoViewIfNeeded();

  const certo = secao.locator('.exercicio__bloco[data-veredito]').first();
  await secao.locator(".exercicio__bloco").first().click();
  await expect(secao.locator(".exercicio__bloco").first()).toBeDisabled();
  await expect(certo).toHaveAttribute("data-veredito", /certo|errado/u);

  await page.goto("handbooks/otel/");
  await expect(page.locator(".roadmap__placar").first()).toContainText("first try");
});
```

- [ ] **Step 2:** Run `pnpm --filter @ovh/site test:e2e tests/exercicio.spec.ts`
      Expected: PASS nos dois projetos.

- [ ] **Step 3: Commit**

```bash
git add apps/site/tests/exercicio.spec.ts
git commit -m "test(site): o exercício na tela, com o teclado cobrado"
```

---

## Bloco F — fechar a rodada

### Task 12: o registro

- [ ] **Step 1:** `docs/PROGRESS.md` com a rodada. Inclua, nominalmente: que a resposta
      certa é **extraída** e não escrita; o resultado do **teste de mutação** da Task 5; e
      a fraqueza que **fica** — as explicações são autorais e podem envelhecer sem aviso.
- [ ] **Step 2:** `docs/roadmap.md` §F4: a contraparte real do bloco E deixou de ser
      pendência.
- [ ] **Step 3:** `docs/DECISIONS.md` §8.1 ganha a nota de que a predição virou duas peças
      — predição e exercício —, e que as duas dividem a mesma regra de não refazer.
- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: o registro da rodada dos exercícios de instrumentação"
```

---

## Os portões — rodar nesta ordem, da raiz

```bash
pnpm install --frozen-lockfile
pnpm boundaries
pnpm catalogo        # tinta em comentário reprova aqui
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ovh/site test:e2e
```

E, uma vez, à mão: `cd labs/providers && docker compose up --build`. **A CI não compila
Java**, e é decisão: a contraparte existe para uma pessoa rodar, e um job de Maven no CI
custaria mais do que protege — o que o CI precisa saber sobre aquele arquivo é que os
marcadores estão lá, e isso é teste de Node.

---

## Auto-revisão do plano

**Onde ele pode dar errado:**

1. **As três versões** (Task 1). Foram consultadas em 2026-09-01 e estão na tabela; o Step 1
   manda reconferir e **proíbe inventar**. O endpoint `search.maven.org` que a primeira
   versão deste plano usava **não responde** e falha devolvendo vazio — daí a fonte ter
   mudado para o `maven-metadata.xml` do `repo1`.
2. **`SERVICE_NAME` fora do BOM** (Task 2). Já está avisado no lugar, com o que fazer.
3. **A ilha importando `node:fs`** (Task 9). Sai no `pnpm build`, com erro claro. A regra é
   uma: `montarExercicio` só é chamado no frontmatter.
4. **O teste do placar no projeto errado do vitest** (Task 7). Avisado no Step 2, com a
   saída mais simples — nomear o arquivo `.tsx`.
5. **O seletor da landing casando com o placar** (Task 10). Avisado no Step 5.
6. **O round crescer.** Se o Bloco A não fechar — o compose não sobe, a versão não resolve —
   **pare e abra PR só do A**, ou nem isso. Os blocos B–F não têm de onde extrair sem ele, e
   começá-los assim mesmo produziria exatamente a fraqueza que a spec §4 existe para remover.

**O que este plano deliberadamente não faz:** montar-do-zero, achar-o-erro, XP/streak/badges,
Python, exercício sem lab, e correção pelo modelo. Os motivos estão na §12 da spec, e nenhum
deles é "não deu tempo".
