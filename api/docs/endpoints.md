# Endpoints da API

Base: **https://openlabs-telecentro-api.onrender.com** · Swagger UI: **https://openlabs-telecentro-api.onrender.com/swagger-ui.html**

Todas as requisições e respostas são JSON. Datas no formato `aaaa-mm-dd`. Os exemplos abaixo são respostas reais da API com os dados de `db/02-dml.sql`.

## Tabela de endpoints

| Método | Rota | O que faz | Sucesso | Erros possíveis |
|---|---|---|---|---|
| GET | `/` | Nome do serviço, status e link do Swagger | 200 | — |
| GET | `/telecentros` | Lista os telecentros | 200 | — |
| GET | `/telecentros/{id}` | Busca um telecentro | 200 | 404 |
| POST | `/telecentros` | Cria um telecentro | 201 + `Location` | 400, 409 (faixa de rede repetida), 422 |
| PUT | `/telecentros/{id}` | Atualiza um telecentro | 200 | 400, 404, 409, 422 |
| DELETE | `/telecentros/{id}` | Exclui um telecentro | 204 | 404, 409 (tem alunos) |
| GET | `/telecentros/{id}/indicadores` | Indicador de impacto do telecentro | 200 | 404 |
| GET | `/alunos?telecentro={id}` | Lista os alunos (filtro por telecentro é opcional) | 200 | — |
| GET | `/alunos/{id}` | Busca um aluno | 200 | 404 |
| POST | `/alunos` | Cadastra um aluno (nasce ativo, com a data de hoje) | 201 + `Location` | 400, 404 (telecentro), 409 (e-mail repetido), 422 |
| PUT | `/alunos/{id}` | Atualiza o cadastro | 200 | 400, 404, 409, 422 |
| PUT | `/alunos/{id}/desativacao` | Desativa o aluno | 200 | 404, 422 (já inativo) |
| DELETE | `/alunos/{id}` | Exclui o aluno | 204 | 404, 409 (tem progresso ou tentativas) |
| GET | `/labs` | Catálogo de labs | 200 | — |
| GET | `/labs/{id}` | Busca um lab | 200 | 404 |
| GET | `/avaliacoes?lab={id}` | Lista as avaliações (filtro por lab é opcional) | 200 | — |
| GET | `/avaliacoes/{id}` | Busca uma avaliação | 200 | 404 |
| GET | `/alunos/{id}/progressos` | Progresso do aluno nos labs | 200 | 404 |
| POST | `/progressos` | O aluno começa um lab hoje | 201 | 400, 404, 409 (já começou), 422 |
| PUT | `/progressos/{id}/conclusao` | O aluno conclui o lab hoje | 200 | 404, 422 (já concluído) |
| DELETE | `/progressos/{id}` | Remove o registro de progresso | 204 | 404 |
| GET | `/alunos/{id}/tentativas` | Avaliações enviadas pelo aluno | 200 | 404 |
| POST | `/tentativas` | Envia uma avaliação; a API calcula a nota | 201 | 400, 404, 422 |
| DELETE | `/tentativas/{id}` | Remove uma tentativa lançada errada | 204 | 404 |

## Formato dos erros

Todo erro sai no mesmo formato (`ErroResposta`):

```json
{
  "status": 422,
  "erro": "Unprocessable Entity",
  "mensagem": "O aluno já está inativo.",
  "caminho": "/alunos/13/desativacao",
  "momento": "2026-11-16T10:45:56.669"
}
```

| Status | Quando |
|---|---|
| 400 | Campo obrigatório faltando, formato inválido, JSON mal formado ou valor que o banco recusa (CHECK, NOT NULL, tamanho) |
| 404 | O id pedido não existe, ou um id informado no corpo aponta para registro que não existe |
| 409 | Valor que precisa ser único já existe, ou o registro tem outros ligados a ele e não pode ser excluído |
| 422 | Uma regra de negócio do domínio foi violada (ex.: aluno inativo começar um lab) |
| 500 | Erro inesperado. A resposta não mostra detalhes; o log do servidor registra o erro |

---

## Início

### `GET /` → 200

```json
{ "servico": "OpenLabs no Telecentro - API", "status": "no ar", "swagger": "/swagger-ui.html" }
```

## Telecentros

### `GET /telecentros/1` → 200

```json
{
  "id": 1,
  "nome": "Telecentro Jardim Ângela",
  "bairro": "Jardim Ângela",
  "cidade": "São Paulo",
  "uf": "SP",
  "numeroComputadores": 20,
  "faixaRede": "192.168.10.0/24",
  "dataInauguracao": "2024-03-15"
}
```

### `POST /telecentros` → 201

Requisição (o `PUT /telecentros/{id}` usa o mesmo corpo):

```json
{
  "nome": "Telecentro Teste",
  "bairro": "Grajau",
  "cidade": "Sao Paulo",
  "uf": "SP",
  "numeroComputadores": 8,
  "faixaRede": "192.168.99.0/24",
  "dataInauguracao": "2026-11-16"
}
```

Resposta, com o cabeçalho `Location: https://openlabs-telecentro-api.onrender.com/telecentros/6`:

```json
{
  "id": 6,
  "nome": "Telecentro Teste",
  "bairro": "Grajau",
  "cidade": "Sao Paulo",
  "uf": "SP",
  "numeroComputadores": 8,
  "faixaRede": "192.168.99.0/24",
  "dataInauguracao": "2026-11-16"
}
```

Erros de exemplo:

- `"uf": "sp"` → **422** `"A UF deve ter 2 letras maiúsculas, ex.: SP."`
- `"numeroComputadores": -1` → **422** `"O número de computadores não pode ser negativo."`
- `"nome": ""` e `"numeroComputadores": 5000` → **400** `"nome: é obrigatório; numeroComputadores: deve ser no máximo 999"`
- mesma `faixaRede` de outro telecentro → **409**

### `DELETE /telecentros/1` → 409

```json
{
  "status": 409,
  "erro": "Conflict",
  "mensagem": "O registro tem outros registros ligados a ele e não pode ser excluído.",
  "caminho": "/telecentros/1",
  "momento": "2026-11-16T12:17:03.182"
}
```

### `GET /telecentros/1/indicadores` → 200

O indicador de impacto da Ficha: alunos ativos do telecentro e avaliações enviadas por mês, mais labs concluídos e média das notas.

```json
{
  "idTelecentro": 1,
  "telecentro": "Telecentro Jardim Ângela",
  "alunosAtivos": 3,
  "avaliacoesPorMes": { "2026-08": 5 },
  "labsConcluidos": 5,
  "mediaNotas": 8.13
}
```

## Alunos

### `GET /alunos?telecentro=2` → 200

```json
[
  { "id": 5, "idTelecentro": 2, "nome": "Eduarda Nunes Prado", "dataNascimento": "2006-01-25", "email": "eduarda.prado@example.com", "dataCadastro": "2026-07-14", "ativo": true },
  { "id": 6, "idTelecentro": 2, "nome": "Felipe Cardoso Reis", "dataNascimento": "1988-09-09", "email": null, "dataCadastro": "2026-07-20", "ativo": true },
  { "id": 7, "idTelecentro": 2, "nome": "Gabriela Monteiro Dias", "dataNascimento": "2010-03-03", "email": "gabriela.dias@example.com", "dataCadastro": "2026-09-12", "ativo": true }
]
```

### `POST /alunos` → 201

Requisição (o `PUT /alunos/{id}` usa o mesmo corpo; `email` é opcional):

```json
{ "idTelecentro": 1, "nome": "Aluno Teste API", "dataNascimento": "2009-05-20", "email": "teste.api@example.com" }
```

Resposta, com `Location: https://openlabs-telecentro-api.onrender.com/alunos/13`:

```json
{ "id": 13, "idTelecentro": 1, "nome": "Aluno Teste API", "dataNascimento": "2009-05-20", "email": "teste.api@example.com", "dataCadastro": "2026-11-16", "ativo": true }
```

Erros de exemplo:

- `"nome": ""` e `"email": "nao-eh-email"` → **400** `"nome: é obrigatório; email: deve ser um e-mail válido"`
- `"dataNascimento": "2099-01-01"` → **422** `"A data de nascimento não pode estar no futuro."`
- `"dataNascimento": "15/03/2008"` → **400** (formato de data errado)
- `"email": "ana.souza@example.com"` (já usado) → **409**
- `"idTelecentro": 999` → **404** `"Um registro relacionado não existe. Confira os ids informados."`

### `PUT /alunos/13/desativacao` → 200

```json
{ "id": 13, "idTelecentro": 2, "nome": "Aluno Teste Atualizado", "dataNascimento": "2009-05-21", "email": null, "dataCadastro": "2026-11-16", "ativo": false }
```

Chamar de novo → **422** `"O aluno já está inativo."`

### `DELETE /alunos/1` → 409

O aluno 1 tem progresso nos labs, então o Oracle recusa a exclusão (`ORA-02292`) e a API devolve 409.

## Labs e avaliações

### `GET /labs/2` → 200

```json
{ "id": 2, "idFase": 1, "slug": "subnetting-by-need", "nome": "Splitting a /24 by how many people need it", "tipoInteracao": "DIRETO", "minutosEstimados": 20, "disponivel": false }
```

### `GET /avaliacoes?lab=1` → 200

```json
[ { "id": 1, "idLab": 1, "nome": "Checkpoint: a rede do telecentro", "numeroQuestoes": 5, "percentualAprovacao": 70 } ]
```

## Progresso

### `POST /progressos` → 201

```json
{ "idAluno": 2, "idLab": 4 }
```

```json
{ "id": 17, "idAluno": 2, "idLab": 4, "dataInicio": "2026-11-16", "dataConclusao": null, "concluido": false }
```

Erros de exemplo:

- `{ "idAluno": 4, "idLab": 1 }` (aluno 4 inativo) → **422** `"Aluno inativo não pode começar um lab."`
- `{ "idAluno": 1, "idLab": 2 }` (lab 2 indisponível) → **422** `"O lab 'Splitting a /24 by how many people need it' ainda não está disponível."`
- `{ "idAluno": 1, "idLab": 1 }` (já começou) → **409**

### `PUT /progressos/17/conclusao` → 200

```json
{ "id": 17, "idAluno": 2, "idLab": 4, "dataInicio": "2026-11-16", "dataConclusao": "2026-11-16", "concluido": true }
```

Chamar de novo → **422** `"Este lab já foi concluído."`

## Tentativas

### `POST /tentativas` → 201

O cliente manda só os acertos. A API calcula a nota (acertos ÷ questões × 10, com 2 casas) e diz se ela aprova.

```json
{ "idAluno": 2, "idAvaliacao": 5, "acertos": 2 }
```

```json
{ "id": 13, "idAluno": 2, "idAvaliacao": 5, "dataEnvio": "2026-11-16", "acertos": 2, "nota": 6.67, "aprovado": true }
```

Erros de exemplo:

- `{ "idAluno": 4, ... }` (aluno inativo) → **422** `"Aluno inativo não pode enviar avaliação."`
- `"acertos": 9` numa avaliação de 3 questões → **422** `"Os acertos devem ficar entre 0 e 3."`
- `"acertos": -1` → **400** `"acertos: não pode ser negativo"`

### `GET /alunos/7/tentativas` → 200

```json
[
  { "id": 8, "idAluno": 7, "idAvaliacao": 1, "dataEnvio": "2026-09-20", "acertos": 2, "nota": 4.00, "aprovado": false },
  { "id": 9, "idAluno": 7, "idAvaliacao": 1, "dataEnvio": "2026-09-21", "acertos": 4, "nota": 8.00, "aprovado": true }
]
```
