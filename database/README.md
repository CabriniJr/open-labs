# Banco de dados do OpenLabs no Telecentro

Entrega da disciplina **Database Design** (Global Solution 2026.2 · CitizenTech).

O site do OpenLabs é estático: até aqui, o pouco que ele lembra fica no navegador de
cada pessoa. Num telecentro isso não basta. É preciso saber:
- quais telecentros existem;
- quem são os alunos, os monitores e os equipamentos de rede;
- que labs cada aluno fez e como foi nas avaliações.

Este banco guarda isso, com **10 tabelas** em três grupos:

| Grupo | Tabelas |
|---|---|
| Cadastro | `T_TELECENTRO`, `T_MONITOR`, `T_ALUNO`, `T_COMPUTADOR` |
| Catálogo | `T_HANDBOOK`, `T_FASE`, `T_LAB`, `T_AVALIACAO` |
| Acompanhamento | `T_PROGRESSO` (aluno × lab), `T_TENTATIVA` (aluno × avaliação) |

O diagrama de conferência está em [MODELO.md](MODELO.md).

**O mesmo banco funcionando, no site:** o handbook *Databases* do OpenLabs tem o lab
[`labs/telecentro-database`](../apps/site/src/pages/labs/telecentro-database.astro)
(`/labs/telecentro-database/` no site). Ele mostra estas tabelas, chaves e consultas em
filme, diagrama e 3D, e roda o banco no navegador para tentar os erros. No fim da página há o
**passo a passo no Oracle**: conectar o SQL Developer, rodar cada script, conferir cada requisito
com uma consulta ao dicionário do Oracle (tabelas, PK, FK, relacionamentos, linhas), ver as regras
recusando dados e gerar o diagrama no Data Modeler — com o que a tela deve mostrar em cada passo. O roteiro do lab
está em [`docs/roteiros/databases.md`](../docs/roteiros/databases.md).

## Arquivos

| Arquivo | O que é | Vai na entrega? |
|---|---|---|
| `01-ddl.sql` | `CREATE TABLE` + `ALTER TABLE` (PK, UK, CHECK, FK) + comentários | sim (item 3) |
| `02-dml.sql` | `INSERT`: de 5 a 15 linhas por tabela, dados simulados | sim (item 4) |
| `03-dql.sql` | as três consultas pedidas | sim (item 5) |
| `entrega/GS-Database-Design.pdf` | capa, sumário, objetivo e escopo, funcionalidades, diagramas do Data Modeler, relacionamentos, dicionário | sim (itens 1 e 2) |
| `entrega/ddl-para-o-data-modeler.sql` | o DDL sem o bloco de limpeza, para importar no Data Modeler | não |
| `gerar.mjs` | gera os três scripts, o `MODELO.md` e o documento (`--pdf` gera o PDF; `--check` só confere) | não |
| `../packages/database-domain` | a fonte: `esquema.ts` (tabelas), `dados.ts` (linhas), `consultas.ts` (as três consultas) | não |

**Mudar uma tabela, um dado ou uma consulta:** edite `packages/database-domain/src/telecentro/`
(`esquema.ts`, `dados.ts` ou `consultas.ts`) e rode `node database/gerar.mjs --pdf`. Os três
scripts, o diagrama, o dicionário de dados do PDF e o lab do site mudam juntos. Um teste
(`pnpm test`) falha se os scripts desta pasta ficarem diferentes do que o pacote gera.

## 1. Rodar os scripts no Oracle da FIAP

1. Abra o **SQL Developer** e conecte com o seu usuário do Oracle da FIAP.
2. Abra `01-ddl.sql` e use **Executar Script** (F5, não Ctrl+Enter, que roda uma linha só).
   - O começo do script apaga as tabelas de uma execução anterior. Assim dá para rodar de novo sem erro.
3. Faça o mesmo com `02-dml.sql`. Ele termina com `COMMIT`.
4. Abra `03-dql.sql` e rode cada consulta com Ctrl+Enter, com o cursor dentro dela, ou o script inteiro com F5.
5. Os resultados esperados estão abaixo. Um print de cada resultado reforça a entrega.

## 2. Gerar o diagrama no Oracle Data Modeler (item 2 do PDF)

O diagrama tem de sair do Data Modeler. Ele pode **desenhar sozinho** a partir do DDL:

1. Abra o **Oracle SQL Developer Data Modeler**. Ele também existe dentro do SQL Developer, em *Arquivo → Data Modeler*.
2. **File → Import → DDL File** → escolha `entrega/ddl-para-o-data-modeler.sql`.
3. Na lista de bancos, escolha a versão do Oracle da FIAP (19c, ou a mais próxima) → **Next** → **Finish**.
   - O Data Modeler cria o **modelo relacional**: as 10 tabelas, com colunas, PKs, FKs e as linhas de relacionamento.
   - Ele mostra um relatório da importação. Avisos sobre `COMMENT ON` podem ser ignorados.
4. Organize o desenho: clique com o botão direito no fundo → **Auto Layout**. Depois arraste as tabelas até nenhuma linha cruzar outra tabela.
5. Para ter também o **modelo lógico** (entidades), use o botão **Engineer to Logical Model** (as setas `<<` na barra) → **Engineer**.
6. Exporte a imagem: **File → Print Diagram → To Image File** (PNG).
7. Ponha a imagem no lugar do quadro amarelo da seção 4 do PDF.

**Qual diagrama entregar.** O slide pede "tabelas, atributos, chaves primárias, chaves
estrangeiras, relacionamentos e cardinalidades". Tudo isso aparece no diagrama
**relacional**. O lógico mostra as entidades, mas não as colunas de FK. Entreguem o
relacional; se couber, ponham também o lógico.

## 3. Resultados esperados

Conferidos executando os três scripts num PostgreSQL embutido, com os tipos do Oracle
trocados pelos equivalentes. No Oracle o conteúdo é o mesmo; a ordem de nomes acentuados
pode variar.

**Consulta 1 (INNER JOIN):** 12 linhas, uma por aluno, com o telecentro.

**Consulta 2 (INNER JOIN + GROUP BY):** alunos ativos por telecentro.

| Telecentro | Cidade | Ativos | Primeiro cadastro | Último cadastro |
|---|---|---|---|---|
| Telecentro Cidade Tiradentes | São Paulo | 3 | 2026-07-14 | 2026-09-12 |
| Telecentro Jardim Ângela | São Paulo | 3 | 2026-08-03 | 2026-08-10 |
| Telecentro Jardim Gramacho | Duque de Caxias | 2 | 2026-10-01 | 2026-10-03 |
| Telecentro Capão Redondo | São Paulo | 1 | 2026-06-02 | 2026-06-02 |
| Telecentro Vila Kennedy | Rio de Janeiro | 1 | 2026-10-20 | 2026-10-20 |

**Consulta 3 (LEFT OUTER JOIN + WHERE + ORDER BY):** alunos ativos sem nenhuma avaliação.

| Aluno | E-mail | Cadastro |
|---|---|---|
| Felipe Cardoso Reis | — | 2026-07-20 |
| Larissa Moura Campos | — | 2026-10-03 |
| Mateus Oliveira Barros | mateus.barros@example.com | 2026-10-20 |

**Constraints:** as seguintes tentativas são recusadas pelo banco:
- nota 11;
- VLAN 40;
- aluno em telecentro inexistente;
- o mesmo aluno duas vezes no mesmo lab;
- conclusão antes do início;
- e-mail repetido;
- `st_ativo = 'X'`;
- apagar telecentro com alunos;
- lab sem nome.

## 4. O mesmo banco na API Java (Domain Driven Design)

A API Spring Boot da disciplina de Java usa **estas mesmas tabelas**, no mesmo schema do Oracle
da FIAP. Não existe um segundo banco: o que a API grava aparece nas consultas do `03-dql.sql`, e
o diagrama do Data Modeler serve também de DER para o documento de Java.

- **IDs gerados pelo banco.** Toda chave primária é `GENERATED BY DEFAULT ON NULL AS IDENTITY`.
  O POST da API não manda o id: o Oracle gera o próximo número, que começa depois dos ids dos
  dados de exemplo. Exemplo: o primeiro aluno novo recebe o `id_aluno` 13.
  - Com JPA: `@Id @GeneratedValue(strategy = GenerationType.IDENTITY)`.
  - Com JDBC (DAO): `conn.prepareStatement(sql, new String[] {"ID_ALUNO"})` e depois `getGeneratedKeys()`.
- **Erros do banco viram respostas HTTP.** A camada de exceções da API traduz as constraints.
  Os casos abaixo são sugestões de mapeamento:

  | Erro do Oracle | Constraint | Resposta da API |
  |---|---|---|
  | `ORA-00001` | `UNIQUE` (e-mail repetido) | 409 |
  | `ORA-02290` | `CHECK` (nota 11) | 400 |
  | `ORA-01400` | `NOT NULL` | 400 |
  | `ORA-02291` | FK sem pai (telecentro inexistente) | 400 ou 404 |
  | `ORA-02292` | apagar pai com filhos (telecentro com alunos) | 409 |

- **Credenciais fora do código.** No render.com, usuário, senha e URL
  (`jdbc:oracle:thin:@oracle.fiap.com.br:1521:ORCL`) vão em variáveis de ambiente, nunca no GitHub.
- **Cuidado ao rodar de novo o `01-ddl.sql`.** O script apaga e recria as tabelas, e com elas
  tudo o que a API gravou. Depois que a API estiver no ar, só rodem o DDL e o DML de novo se
  quiserem voltar aos dados de exemplo.

## Como gerar o documento de entrega

1. Rode os três scripts no Oracle (seção 1). Em 10/11/2026 eles rodaram no Oracle da FIAP:
   10 tabelas, 10 FKs, 10 IDENTITY, as três consultas iguais às da seção 3 e as nove regras recusando.
2. Exporte os diagramas do Data Modeler (seção 2) em SVG, com **File → Print Diagram → To SVG File**,
   como `entrega/diagrama-relacional.svg` e `entrega/diagrama-logico.svg` (PNG também serve).
3. Crie `entrega/equipe.json` com a capa: `{ "equipe", "solucao", "integrantes": [["Nome", "RM"], …] }`.
   O gerador põe os integrantes em ordem alfabética.
4. Rode `node database/gerar.mjs --pdf`. Com o PyMuPDF instalado, o sumário sai com o número das páginas.

Os diagramas, o `equipe.json` e o PDF ficam fora do Git (`entrega/.gitignore`): são artefatos da
entrega e dados dos alunos. Entrega no Teams: o PDF e os três `.sql`, como arquivos, nunca como link.
