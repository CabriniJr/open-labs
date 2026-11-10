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
| `entrega/GS-Database-Design.pdf` | capa, sumário, objetivo e escopo, funcionalidades, modelo, dicionário | sim (itens 1 e 2) |
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

## O que a equipe ainda precisa fazer

1. **Rodar os scripts no Oracle da FIAP** (seção 1). Se algum der erro, mande a mensagem.
2. **Gerar o diagrama no Data Modeler** e pôr a imagem no PDF (seção 2).
3. **Preencher a capa do PDF:** nome da equipe, integrantes **em ordem alfabética** com RM, e confirmar o nome da solução.
4. **Entregar no Teams:** o PDF e os três `.sql`. Os arquivos vão no envio, nunca como link para a nuvem; o enunciado proíbe link de diagrama em nuvem.
