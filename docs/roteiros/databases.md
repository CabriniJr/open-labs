# Roteiro do handbook de bancos de dados

O contrato de conteúdo do *Databases Visual Handbook*: um roteiro por lab — a
pergunta, o mal-entendido, a mídia, o showcase, a simulação, o que a altura
significa no 3D, os ícones, as correlações e o critério de pronto. O de forma
está em `.claude/skills/openlabs-lab/SKILL.md`. Atualize este arquivo no mesmo
PR que cria ou muda um lab.

## Por que existe

Nasceu da Global Solution 2026.2 da FIAP (CitizenTech): **acesso gratuito à
educação tecnológica**, com o OpenLabs rodando num telecentro comunitário. O
banco que o handbook explica é **o do próprio OpenLabs no telecentro**:
telecentros, monitores, alunos, computadores, o catálogo de handbooks, fases e
labs, o progresso e as notas. O assunto é como um banco relacional funciona;
o OpenLabs é o exemplo que o aluno já conhece.

## As regras que valem para todo lab deste handbook

1. **Uma pergunta, um mal-entendido**, como no handbook de OTel.
2. **Uma fonte só.** O esquema (`esquema.ts`), os dados (`dados.ts`) e as
   consultas (`consultas.ts`) de `packages/database-domain` geram os scripts
   do Oracle em `database/` (`node database/gerar.mjs`) **e** alimentam o lab.
   Um teste falha se os scripts ficarem para trás (`gerar.mjs --check`).
3. **O banco decide, o filme desenha.** Se uma escrita passa ou é recusada, e
   o que uma consulta devolve, vem do `motor.ts`, com o código de erro do
   Oracle (ORA-00001, ORA-01400, ORA-02290, ORA-02291, ORA-02292…). Nada no
   filme ou na simulação escreve um resultado à mão.
4. **A altura no 3D é a ordem de criação** (`nivelDe`): quantos degraus de
   chave estrangeira separam a tabela de uma que não aponta para ninguém. As
   do chão são criadas e preenchidas primeiro; cada tabela fica de pé sobre as
   que ela referencia.
5. **A cor da tabela é o grupo** (`TOM_DO_GRUPO`): cadastro, catálogo,
   acompanhamento (as associativas). **A cor da ficha é o que ela faz**
   (`TOM_DA_FICHA`): escrita, consulta de chave, junção, agrupamento; vermelho
   é o que o banco recusou.
6. **Identificadores não se traduzem.** Nomes de tabela e coluna, SQL e a
   saída do Oracle ficam como estão (`translate="no"`, `locale: skip-file`);
   a explicação em volta é traduzida.

## Ícones (`ICONES_BANCO`)

Cada tabela leva o desenho do que uma linha dela é.

| ícone | tabela |
|---|---|
| prédio | `T_TELECENTRO` |
| pessoa com crachá | `T_MONITOR` |
| pessoa | `T_ALUNO` |
| tela | `T_COMPUTADOR` |
| livro | `T_HANDBOOK` |
| degrau | `T_FASE` |
| frasco | `T_LAB` |
| lista com marcas | `T_AVALIACAO` |
| barra enchendo | `T_PROGRESSO` |
| lápis | `T_TENTATIVA` |
| janela do app (`ICONE_APP`) | o balcão do telecentro, de onde saem as escritas |

## Fase 1 — tabelas, chaves e regras

#### telecentro-database — *How the OpenLabs database works in a telecentre* · disponível (filme + diagrama + 3D + livre)
- **Pergunta.** O que um banco relacional faz com os dados do OpenLabs num telecentro — como guarda, liga, protege e responde?
- **Mal-entendido.** "Chave estrangeira é só uma coluna com o id" / "CHECK recusa NULL" / "com dados bons, INNER e LEFT dão o mesmo" / "N:N cabe numa coluna com a lista de ids" / "texto vazio e NULL são diferentes" (no Oracle, não são).
- **Modelo.** `database-domain/telecentro/`: `esquema.ts` (10 tabelas, PK, UK, CHECK, FK e a cardinalidade), `dados.ts` (de 5 a 15 linhas por tabela, simuladas), `motor.ts` (inserir, apagar e as três consultas, imutável, com a ordem NOT NULL → tipo → PK/UK → CHECK → FK), `expressao.ts` (CHECK com lógica de três valores), `simulacao.ts` (linha válida sugerida e os erros clássicos).
- **Showcase.** `filmeDoBanco`: nove capítulos — o mapa das dez tabelas; uma tabela é uma grade com chave; INSERT de uma aluna atravessando as regras (a FK vai até T_TELECENTRO e volta); 1:N com o pé de galinha; N:N com a tabela associativa; o banco diz não; INNER JOIN; GROUP BY; LEFT OUTER JOIN. A aluna inserida no capítulo 3 aparece nos resultados das consultas. O painel mostra o SQL do passo, a resposta do banco e o resultado. **Interativo:** a escrita errada (telecentro 77, nota 11, mesmo lab duas vezes) e o LEFT/INNER da consulta 3 refazem o filme.
- **Vistas.** *Diagram* (SVG próprio: cartões com colunas, PK/FK/UK, nulos marcados com `?`, tipos só com a câmera perto, ligações das chaves estrangeiras com pé de galinha — tudo calculado em `LIGACOES_DO_BANCO`), *Blocks* e *3D*.
- **Legenda e cardinalidade escritas.** O diagrama traz a legenda no alto (PK sublinhada, FK, UK, `?` para nulo, e os três pés de galinha) e escreve a cardinalidade em cada ligação: `1` no pai, `0..N` ou `1..N` na filha. PK e FK têm cor própria (`kind-3` e `kind-4`; a FK é da mesma cor da ficha que consulta a chave).
- **O que é o quê (`BancoDicionario`).** Abaixo do palco: os dez conceitos (tabela, atributo, PK, FK, UK, NULL, CHECK, relacionamento, cardinalidade, tabela associativa), cada um com um desenho nas marcas do diagrama e o exemplo daqui; a tabela das 10 relações com a cardinalidade; e um quadro por tabela com cada atributo — chave (PK, FK → tabela, UK), tipo, NULL/NOT NULL, regra (DEFAULT, CHECK) e o que guarda. Tudo lido do esquema; as descrições em inglês ficam em `labels.ts` (`SOBRE_A_COLUNA`, `CONCEITOS`), e um teste exige uma para cada coluna.
- **Monte de verdade no Oracle (`BancoOracle`).** O fim da página é um passo a passo no Oracle da FIAP: conectar o SQL Developer, rodar o DDL (com o trecho real de T_ALUNO), conferir no dicionário do Oracle as tabelas, as constraints por tipo e os relacionamentos, rodar o DML e contar as linhas, rodar as três consultas, provar as regras com três escritas erradas, desenhar no Data Modeler e entregar. Cada passo tem o código com botão de copiar e o que a tela deve mostrar — calculado em `oracle.ts` a partir do esquema e do motor. Os scripts são servidos para baixar por `labs/telecentro-database/[file].ts`, direto de `database/`.
- **Simulação (livre).** `BancoLab`: escrever uma linha em qualquer tabela (o INSERT aparece ao vivo), os botões de erro clássico, a saída do script como no SQL Developer, as tabelas com a linha nova acesa, e as três consultas rodando sobre o banco que o leitor mudou.
- **Contraparte real.** `database/`: `01-ddl.sql`, `02-dml.sql`, `03-dql.sql` para o Oracle da FIAP, o DDL para o Data Modeler e o documento de entrega (`database/README.md`).
- **Pronto quando.** Testes do motor, da simulação e do filme verdes; `gerar.mjs --check` em dia; `qa:labs` passando nos dois modos; os scripts rodados no Oracle e o diagrama do Data Modeler no PDF da entrega.

## Fase 2 — fazendo perguntas

#### join-by-hand — *Pair two tables by hand and watch the JOIN* · disponível (filme + livre)
- **Pergunta.** O que um JOIN faz com as linhas de duas tabelas — e para onde vão as que não têm par?
- **Mal-entendido.** "Com dados bons, INNER e LEFT dão o mesmo" / "condição no ON ou no WHERE é a mesma coisa" / "COUNT(*) e COUNT(coluna) contam o mesmo" / "o JOIN devolve uma linha por aluno".
- **Modelo.** `database-domain/juncao/modelo.ts`: T_ALUNO × T_TENTATIVA, as linhas do `bancoInicial()` (as mesmas do 02-dml.sql). `linhasDaJuncao({ tipo, filtro })` (INNER/LEFT; filtro `vl_nota >= 7` em lugar nenhum, no WHERE ou no ON), `grupos` (COUNT(*) × COUNT(te.id_tentativa)), `comparacoes` (o laço aninhado: 144 pares, 12 verdadeiros), `ligar`/`andamento` (o leitor liga os pares à mão; o ON decide). Números conferidos em teste: INNER 12, LEFT 17, LEFT+WHERE 8 (= INNER), LEFT+ON 14; COUNT(*) dá 1 a quem nunca tentou.
- **Showcase.** `filmeDaJuncao`: seis capítulos — as duas tabelas; o ON em cada par (o aluno 1 contra as 12 tentativas, depois os 144); um aluno vira tantas linhas quantos pares; quem não tem par (NULL com LEFT, apagado com INNER); o filtro da nota no WHERE ou no ON; GROUP BY com a contagem escolhida (vermelho em quem COUNT(*) conta errado). **Interativo:** INNER/LEFT, WHERE/ON e COUNT(*)/COUNT(coluna) refazem o filme. O painel mostra o SQL e o resultado do passo.
- **Simulação (livre).** `JuncaoLab`: escolher um aluno, tocar nas tentativas dele; o ON recusa a tentativa de outro aluno, a nota baixa com o filtro no ON e a tentativa já ligada (uma FK é um valor só). O placar conta os pares; "deixar o banco" completa; o resultado do leitor ao lado do resultado do banco.
- **Correlação.** A consulta 3 da entrega é este LEFT JOIN filtrado por `IS NULL` (teste: os mesmos alunos).

## Fase 3 — do modelo ao servidor

#### normalize-a-spreadsheet — *Split one spreadsheet until every fact lives in one place* · disponível (filme + livre)
- **Pergunta.** Por que o OpenLabs tem dez tabelas e não uma planilha?
- **Mal-entendido.** "Normalizar é economizar espaço" / "1FN é ter chave primária" / "3FN deixa tudo lento" / "modelo lógico e banco são projetos diferentes".
- **Modelo.** `database-domain/normalizacao/modelo.ts`: a planilha do monitor (uma linha por aluno, tentativas numa célula) montada dos MESMOS dados; `tabelasDa(etapa)` para planilha, 1FN, 2FN e 3FN — a 3FN são as tabelas reais (teste: mesmas linhas do 02-dml.sql). As anomalias são medidas: `celulasARenomear` (4 → 5 → 4 → 1), `cabeSozinho` (telecentro sem aluno só na 3FN), `perdidosAoApagar` (apagar as tentativas da avaliação 6 leva lab e handbook até a 2FN), alunos que cabem (12, 7, 12, 12). `createTable` reproduz o CREATE TABLE do 01-ddl.sql (teste) e `ENDPOINTS_DO_ALUNO` liga a tabela à API Java.
- **Showcase.** `filmeDaNormalizacao`: cinco capítulos — a planilha; 1FN (a planilha fica vermelha: 5 alunos somem); 2FN (três tabelas, as colunas viajam); 3FN (as sete tabelas reais, com ícones e as chaves estrangeiras); do modelo ao servidor (CREATE TABLE com IDENTITY e o POST /alunos que o motor responde com o id 13).
- **Simulação (livre).** `NormalizacaoLab`: abas por forma normal, as tabelas com PK/FK, e três anomalias para tentar (renomear o telecentro acende as células; abrir um telecentro sem alunos; apagar as tentativas da avaliação 6 mostra o que some). Na 3FN, o CREATE TABLE e a tabela de endpoints GET/POST/PUT/DELETE.

## Artigos

| Fase | Artigo | Lab |
|---|---|---|
| 1 | *A foreign key is a promise the database keeps* — FK nos dois sentidos (ORA-02291/02292), a pilha de regras, cardinalidade e associativas | telecentro-database |
| 2 | *NULL is not a value, it is a question mark* — UNKNOWN, IS NULL, CHECK e NULL, LEFT+WHERE, COUNT | join-by-hand |
| 3 | *One fact, one place — the third normal form* — as três anomalias medidas, 1FN/2FN/3FN, chave substituta | normalize-a-spreadsheet |
| 3 | *From the diagram to the server: DDL, DML and DQL* — o que o diagrama precisa dizer, os três scripts, a API | normalize-a-spreadsheet |

Fontes: Codd (1970, 1971), Kent (1983) e a documentação do Oracle 19c (Data Integrity, constraint, Nulls, Joins, COUNT, CREATE/ALTER TABLE, INSERT, SELECT) e do Data Modeler. Nenhum texto do site cita a disciplina ou a entrega.

## Correlações

- ← `telecentro-network` (redes): `T_COMPUTADOR` guarda o hostname, o IP e a VLAN da mesma rede; `ds_faixa_rede` de cada telecentro é a faixa do projeto de redes.
- → a API Java da GS (DDD Java) lê e escreve estas mesmas tabelas no Oracle da FIAP; toda PK é IDENTITY para o POST não mandar id.
- ↔ `join-by-hand` e `normalize-a-spreadsheet` usam as linhas de `dados.ts`: mudar um dado muda os três labs e os scripts.
