# OpenLabs no Telecentro — API

API Java (Spring Boot + JDBC) que publica os dados do OpenLabs no Telecentro: telecentros, alunos, labs, progresso e avaliações.
Entrega da disciplina Domain Driven Design – Java, Global Solution 2026.2 (FIAP).

| | |
|---|---|
| **API no ar (Render)** | https://openlabs-telecentro-api.onrender.com |
| **Swagger UI (testar pelo navegador)** | https://openlabs-telecentro-api.onrender.com/swagger-ui.html |
| **Repositório da API** | https://github.com/Bkfighte/openlabs-telecentro-api |
| **Repositório do site OpenLabs** | https://github.com/CabriniJr/open-labs |

> O serviço está no plano gratuito do Render, que dorme sem uso. A primeira requisição depois de um tempo parado pode levar **perto de 1 minuto**; as seguintes respondem em poucos segundos.

## Ficha da CitizenTech

| Campo | Valor |
|---|---|
| Nome da CitizenTech | OpenLabs no Telecentro |
| Cidade e bairro | São Paulo (SP) — Jardim Ângela, no Telecentro Jardim Ângela |
| Cidadão beneficiado | Quem não tem computador nem internet em casa e quer aprender tecnologia: estudantes de escola pública, jovens e adultos da comunidade. |
| Problema, em uma frase | O ensino de tecnologia gratuito e prático não chega a quem mais precisa dele. |
| Como funciona | Um telecentro comunitário oferece Wi-Fi gratuito e computadores; o OpenLabs roda no servidor local, com laboratórios interativos que funcionam mesmo sem internet. |
| O que cada parte faz | A rede separa equipe, Wi-Fi público e servidores em VLANs e protege o servidor do OpenLabs; o banco de dados guarda telecentros, alunos, labs e avaliações; a API publica esses dados; os algoritmos e a análise de dados medem o uso e o aprendizado. |
| Link do repositório | https://github.com/CabriniJr/open-labs (site) · https://github.com/Bkfighte/openlabs-telecentro-api (API) |
| Indicador de impacto | Alunos ativos por telecentro e avaliações concluídas por mês. |
| ODS conectados | ODS 4, ODS 9, ODS 10, ODS 11 |

## Ferramentas e versões

| Ferramenta | Versão |
|---|---|
| Java (JDK) | 21 (Eclipse Temurin 21.0.13) |
| Maven | 3.9.16, pelo Maven Wrapper (`mvnw`): não precisa instalar |
| Spring Boot | 3.5.16 (`spring-boot-starter-web` e `spring-boot-starter-validation`) |
| Driver JDBC Oracle | `ojdbc11` 23.7 |
| springdoc-openapi (Swagger UI) | 2.8.17 |
| JUnit | 5.12 |
| Banco de dados | Oracle da FIAP (`oracle.fiap.com.br:1521:ORCL`) |
| Deploy | Render (Web Service com Docker): imagens `maven:3.9-eclipse-temurin-21` e `eclipse-temurin:21-jre` |

A persistência é **JDBC puro** (classe `ConnectionFactory` + DAOs com `PreparedStatement`), sem JPA nem Hibernate.

## Arquitetura

Fluxo de uma requisição: **Controller → BO → DAO → ConnectionFactory → Oracle**.

```
br.com.openlabs.telecentro
├── model/        Entidades do domínio: EntidadeBase, Telecentro, Aluno, Lab, Avaliacao, Progresso, Tentativa, TipoInteracao
├── dao/          LeituraDao<T>, CrudDao<T> e um DAO por tabela (JDBC puro)
├── bo/           Casos de uso: TelecentroBo, AlunoBo, CatalogoBo, ProgressoBo, TentativaBo, IndicadorBo
├── controller/   Um controller REST por recurso + InicioController (GET /)
├── dto/          Records de entrada (…Request, com Bean Validation) e de saída (…Response)
├── exception/    Exceções do domínio e TratadorDeExcecoes (@RestControllerAdvice), que devolve ErroResposta
└── connection/   ConnectionFactory (DriverManager, credenciais por variável de ambiente)
```

- As **regras de uma entidade** ficam na própria entidade. Exemplos: aluno inativo não começa lab, a nota é calculada pela avaliação, um lab não é concluído duas vezes.
- O **BO** busca os dados no DAO, chama o método de domínio e persiste.
- O **controller** recebe e devolve DTOs. A entidade nunca sai da API.

Documentação em `docs/`:

- [`docs/endpoints.md`](docs/endpoints.md): tabela de endpoints, com exemplos de requisição e resposta.
- [`docs/diagrama-classes.puml`](docs/diagrama-classes.puml): diagramas de classes em UML ([domínio](docs/diagrama-classes-dominio.png), [camadas](docs/diagrama-classes.png) e [DTOs e exceções](docs/diagrama-classes-dto-exception.png)).
- [`docs/prints/`](docs/prints): prints do Swagger e do deploy no Render.

## Como executar

### 1. Pré-requisitos

- **Java 21** instalado (`java -version` deve mostrar 21).
- Um usuário no **Oracle da FIAP** (RM e senha).
- Git, para clonar o repositório.

O Maven não precisa ser instalado: o projeto usa o Maven Wrapper (`mvnw`), que baixa o Maven 3.9.16 sozinho na primeira execução.

### 2. Criar as tabelas no Oracle (só uma vez)

No SQL Developer, conectado com o seu usuário, rode **na ordem** (F5 = Executar Script):

1. `db/01-ddl.sql`: cria as 10 tabelas;
2. `db/02-dml.sql`: insere os dados de exemplo.

> Não rode o `01-ddl.sql` de novo depois que a API estiver em uso: ele apaga as tabelas e tudo o que a API gravou.

### 3. Clonar e configurar as credenciais

```bash
git clone https://github.com/Bkfighte/openlabs-telecentro-api.git
cd openlabs-telecentro-api
```

A API lê a conexão de três variáveis de ambiente (as credenciais nunca ficam no código):

| Variável | Valor |
|---|---|
| `DB_URL` | opcional; o padrão é `jdbc:oracle:thin:@oracle.fiap.com.br:1521:ORCL` |
| `DB_USER` | o seu usuário (RM) |
| `DB_PASSWORD` | a sua senha |

### 4. Rodar

**Windows (PowerShell):**

```powershell
$env:DB_USER = "RMxxxxx"
$env:DB_PASSWORD = "sua-senha"
.\mvnw.cmd spring-boot:run
```

**Linux, macOS ou Git Bash:**

```bash
export DB_USER=RMxxxxx DB_PASSWORD=sua-senha
./mvnw spring-boot:run
```

Abra **http://localhost:8080/swagger-ui.html** e teste os endpoints pelo navegador (botão *Try it out*). `GET /` responde `{"status":"no ar"}`.

### 5. Rodar os testes

Os testes de domínio (JUnit 5) não precisam de banco:

```bash
./mvnw test          # Windows: .\mvnw.cmd test
```

## Deploy no Render

O `Dockerfile` tem duas etapas: a primeira compila e roda os testes com Maven, e a segunda só executa o `.jar` com Java 21.

1. No Render: **New → Web Service**, ligado a este repositório do GitHub, com runtime **Docker** e plano **Free**.
2. Em *Environment Variables*, cadastre `DB_URL`, `DB_USER` e `DB_PASSWORD`, sem aspas.
3. O Render informa a porta pela variável `PORT`, que o `application.properties` já lê. A cada push na branch `main`, ele faz um novo deploy.

Teste de fumaça depois de cada deploy: `GET /`, `GET /alunos` e um `POST /alunos` seguido do `DELETE` do aluno criado.

## Uso de IA

O uso de IA neste projeto está registrado em [`prompts.md`](prompts.md), como pede a Global Solution.
