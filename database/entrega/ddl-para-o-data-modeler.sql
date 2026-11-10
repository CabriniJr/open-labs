-- =====================================================================
-- OpenLabs no Telecentro — Script DDL (Oracle)
-- Global Solution 2026.2 · Database Design
--
-- Gerado por database/gerar.mjs a partir de database/esquema.mjs.
-- Ordem de execução: 01-ddl.sql → 02-dml.sql → 03-dql.sql.
-- =====================================================================

-- Cópia de 01-ddl.sql sem o bloco de limpeza, para importar no Oracle Data Modeler.

-- ---------------------------------------------------------------------
-- 1. Tabelas (CREATE TABLE): colunas, tipos, obrigatoriedade e padrões
-- ---------------------------------------------------------------------

-- Espaço comunitário e gratuito onde o OpenLabs roda, com computadores e Wi-Fi público.
CREATE TABLE T_TELECENTRO (
  id_telecentro   NUMBER(6) NOT NULL,
  nm_telecentro   VARCHAR2(80) NOT NULL,
  nm_bairro       VARCHAR2(60) NOT NULL,
  nm_cidade       VARCHAR2(60) NOT NULL,
  sg_uf           CHAR(2) NOT NULL,
  nr_computadores NUMBER(3) NOT NULL,
  ds_faixa_rede   VARCHAR2(18) NOT NULL,
  dt_inauguracao  DATE NOT NULL
);

-- Pessoa da equipe que atende os alunos no telecentro.
CREATE TABLE T_MONITOR (
  id_monitor    NUMBER(6) NOT NULL,
  id_telecentro NUMBER(6) NOT NULL,
  nm_monitor    VARCHAR2(80) NOT NULL,
  ds_email      VARCHAR2(120) NOT NULL,
  dt_admissao   DATE NOT NULL
);

-- Pessoa da comunidade cadastrada para usar os laboratórios.
CREATE TABLE T_ALUNO (
  id_aluno      NUMBER(8) NOT NULL,
  id_telecentro NUMBER(6) NOT NULL,
  nm_aluno      VARCHAR2(80) NOT NULL,
  dt_nascimento DATE NOT NULL,
  ds_email      VARCHAR2(120) NULL,
  dt_cadastro   DATE NOT NULL,
  st_ativo      CHAR(1) DEFAULT 'S' NOT NULL
);

-- Equipamento da rede do telecentro, com o endereço e a VLAN do projeto de redes.
CREATE TABLE T_COMPUTADOR (
  id_computador  NUMBER(6) NOT NULL,
  id_telecentro  NUMBER(6) NOT NULL,
  nm_hostname    VARCHAR2(30) NOT NULL,
  ds_endereco_ip VARCHAR2(15) NULL,
  nr_vlan        NUMBER(4) NOT NULL
);

-- Um curso do OpenLabs (redes, OpenTelemetry, Kubernetes…), com roteiro, artigos e labs.
CREATE TABLE T_HANDBOOK (
  id_handbook NUMBER(4) NOT NULL,
  cd_slug     VARCHAR2(40) NOT NULL,
  nm_handbook VARCHAR2(80) NOT NULL,
  ds_assunto  VARCHAR2(40) NOT NULL,
  st_estagio  VARCHAR2(10) NOT NULL
);

-- Uma etapa do roteiro de um handbook: a ordem em que os conceitos se sustentam.
CREATE TABLE T_FASE (
  id_fase     NUMBER(6) NOT NULL,
  id_handbook NUMBER(4) NOT NULL,
  nr_ordem    NUMBER(2) NOT NULL,
  nm_fase     VARCHAR2(80) NOT NULL
);

-- Um laboratório interativo: um modelo que roda e que o aluno pode quebrar.
CREATE TABLE T_LAB (
  id_lab        NUMBER(6) NOT NULL,
  id_fase       NUMBER(6) NOT NULL,
  cd_slug       VARCHAR2(60) NOT NULL,
  nm_lab        VARCHAR2(120) NOT NULL,
  tp_interacao  VARCHAR2(10) NOT NULL,
  nr_minutos    NUMBER(3) NOT NULL,
  st_disponivel CHAR(1) DEFAULT 'S' NOT NULL
);

-- Questionário de fim de lab (checkpoint) que mede o que o aluno entendeu.
CREATE TABLE T_AVALIACAO (
  id_avaliacao NUMBER(6) NOT NULL,
  id_lab       NUMBER(6) NOT NULL,
  nm_avaliacao VARCHAR2(100) NOT NULL,
  nr_questoes  NUMBER(2) NOT NULL,
  pc_aprovacao NUMBER(3) NOT NULL
);

-- O andamento de um aluno num lab. Resolve o relacionamento muitos-para-muitos entre aluno e lab.
CREATE TABLE T_PROGRESSO (
  id_progresso NUMBER(10) NOT NULL,
  id_aluno     NUMBER(8) NOT NULL,
  id_lab       NUMBER(6) NOT NULL,
  dt_inicio    DATE NOT NULL,
  dt_conclusao DATE NULL
);

-- Uma entrega de avaliação feita por um aluno, com a nota. Resolve o muitos-para-muitos entre aluno e avaliação.
CREATE TABLE T_TENTATIVA (
  id_tentativa NUMBER(10) NOT NULL,
  id_aluno     NUMBER(8) NOT NULL,
  id_avaliacao NUMBER(6) NOT NULL,
  dt_envio     DATE NOT NULL,
  nr_acertos   NUMBER(2) NOT NULL,
  vl_nota      NUMBER(4,2) NOT NULL
);

-- ---------------------------------------------------------------------
-- 2. Restrições (ALTER TABLE): chaves primárias, únicas e regras de valor
-- ---------------------------------------------------------------------

ALTER TABLE T_TELECENTRO ADD CONSTRAINT PK_TELECENTRO PRIMARY KEY (id_telecentro);
ALTER TABLE T_TELECENTRO ADD CONSTRAINT CK_TELECENTRO_COMPUTADORES CHECK (nr_computadores >= 0);
ALTER TABLE T_TELECENTRO ADD CONSTRAINT UK_TELECENTRO_FAIXA_REDE UNIQUE (ds_faixa_rede);

ALTER TABLE T_MONITOR ADD CONSTRAINT PK_MONITOR PRIMARY KEY (id_monitor);
ALTER TABLE T_MONITOR ADD CONSTRAINT UK_MONITOR_EMAIL UNIQUE (ds_email);

ALTER TABLE T_ALUNO ADD CONSTRAINT PK_ALUNO PRIMARY KEY (id_aluno);
ALTER TABLE T_ALUNO ADD CONSTRAINT UK_ALUNO_EMAIL UNIQUE (ds_email);
ALTER TABLE T_ALUNO ADD CONSTRAINT CK_ALUNO_ATIVO CHECK (st_ativo IN ('S', 'N'));

ALTER TABLE T_COMPUTADOR ADD CONSTRAINT PK_COMPUTADOR PRIMARY KEY (id_computador);
ALTER TABLE T_COMPUTADOR ADD CONSTRAINT CK_COMPUTADOR_VLAN CHECK (nr_vlan IN (10, 20, 30));
ALTER TABLE T_COMPUTADOR ADD CONSTRAINT UK_COMPUTADOR_HOSTNAME UNIQUE (id_telecentro, nm_hostname);

ALTER TABLE T_HANDBOOK ADD CONSTRAINT PK_HANDBOOK PRIMARY KEY (id_handbook);
ALTER TABLE T_HANDBOOK ADD CONSTRAINT UK_HANDBOOK_SLUG UNIQUE (cd_slug);
ALTER TABLE T_HANDBOOK ADD CONSTRAINT CK_HANDBOOK_ESTAGIO CHECK (st_estagio IN ('building', 'planned'));

ALTER TABLE T_FASE ADD CONSTRAINT PK_FASE PRIMARY KEY (id_fase);
ALTER TABLE T_FASE ADD CONSTRAINT CK_FASE_ORDEM CHECK (nr_ordem > 0);
ALTER TABLE T_FASE ADD CONSTRAINT UK_FASE_HANDBOOK_ORDEM UNIQUE (id_handbook, nr_ordem);

ALTER TABLE T_LAB ADD CONSTRAINT PK_LAB PRIMARY KEY (id_lab);
ALTER TABLE T_LAB ADD CONSTRAINT UK_LAB_SLUG UNIQUE (cd_slug);
ALTER TABLE T_LAB ADD CONSTRAINT CK_LAB_INTERACAO CHECK (tp_interacao IN ('fluxo', 'estado', 'filme', 'direto'));
ALTER TABLE T_LAB ADD CONSTRAINT CK_LAB_MINUTOS CHECK (nr_minutos > 0);
ALTER TABLE T_LAB ADD CONSTRAINT CK_LAB_DISPONIVEL CHECK (st_disponivel IN ('S', 'N'));

ALTER TABLE T_AVALIACAO ADD CONSTRAINT PK_AVALIACAO PRIMARY KEY (id_avaliacao);
ALTER TABLE T_AVALIACAO ADD CONSTRAINT CK_AVALIACAO_QUESTOES CHECK (nr_questoes > 0);
ALTER TABLE T_AVALIACAO ADD CONSTRAINT CK_AVALIACAO_APROVACAO CHECK (pc_aprovacao BETWEEN 0 AND 100);

ALTER TABLE T_PROGRESSO ADD CONSTRAINT PK_PROGRESSO PRIMARY KEY (id_progresso);
ALTER TABLE T_PROGRESSO ADD CONSTRAINT UK_PROGRESSO_ALUNO_LAB UNIQUE (id_aluno, id_lab);
ALTER TABLE T_PROGRESSO ADD CONSTRAINT CK_PROGRESSO_DATAS CHECK (dt_conclusao IS NULL OR dt_conclusao >= dt_inicio);

ALTER TABLE T_TENTATIVA ADD CONSTRAINT PK_TENTATIVA PRIMARY KEY (id_tentativa);
ALTER TABLE T_TENTATIVA ADD CONSTRAINT CK_TENTATIVA_ACERTOS CHECK (nr_acertos >= 0);
ALTER TABLE T_TENTATIVA ADD CONSTRAINT CK_TENTATIVA_NOTA CHECK (vl_nota BETWEEN 0 AND 10);

-- ---------------------------------------------------------------------
-- 3. Relacionamentos (ALTER TABLE): chaves estrangeiras
-- ---------------------------------------------------------------------

-- um telecentro tem 1 ou muitos monitores; um monitor trabalha em exatamente 1 telecentro
ALTER TABLE T_MONITOR ADD CONSTRAINT FK_MONITOR_TELECENTRO FOREIGN KEY (id_telecentro) REFERENCES T_TELECENTRO (id_telecentro);

-- um telecentro tem 0 ou muitos alunos; um aluno pertence a exatamente 1 telecentro
ALTER TABLE T_ALUNO ADD CONSTRAINT FK_ALUNO_TELECENTRO FOREIGN KEY (id_telecentro) REFERENCES T_TELECENTRO (id_telecentro);

-- um telecentro tem 0 ou muitos computadores; um computador fica em exatamente 1 telecentro
ALTER TABLE T_COMPUTADOR ADD CONSTRAINT FK_COMPUTADOR_TELECENTRO FOREIGN KEY (id_telecentro) REFERENCES T_TELECENTRO (id_telecentro);

-- um handbook tem 1 ou muitas fases; uma fase pertence a exatamente 1 handbook
ALTER TABLE T_FASE ADD CONSTRAINT FK_FASE_HANDBOOK FOREIGN KEY (id_handbook) REFERENCES T_HANDBOOK (id_handbook);

-- uma fase tem 0 ou muitos labs; um lab está em exatamente 1 fase
ALTER TABLE T_LAB ADD CONSTRAINT FK_LAB_FASE FOREIGN KEY (id_fase) REFERENCES T_FASE (id_fase);

-- um lab tem 0 ou muitas avaliações; uma avaliação é de exatamente 1 lab
ALTER TABLE T_AVALIACAO ADD CONSTRAINT FK_AVALIACAO_LAB FOREIGN KEY (id_lab) REFERENCES T_LAB (id_lab);

-- um aluno tem 0 ou muitos progressos; um progresso é de exatamente 1 aluno
ALTER TABLE T_PROGRESSO ADD CONSTRAINT FK_PROGRESSO_ALUNO FOREIGN KEY (id_aluno) REFERENCES T_ALUNO (id_aluno);
-- um lab tem 0 ou muitos progressos; um progresso é de exatamente 1 lab
ALTER TABLE T_PROGRESSO ADD CONSTRAINT FK_PROGRESSO_LAB FOREIGN KEY (id_lab) REFERENCES T_LAB (id_lab);

-- um aluno tem 0 ou muitas tentativas; uma tentativa é de exatamente 1 aluno
ALTER TABLE T_TENTATIVA ADD CONSTRAINT FK_TENTATIVA_ALUNO FOREIGN KEY (id_aluno) REFERENCES T_ALUNO (id_aluno);
-- uma avaliação tem 0 ou muitas tentativas; uma tentativa é de exatamente 1 avaliação
ALTER TABLE T_TENTATIVA ADD CONSTRAINT FK_TENTATIVA_AVALIACAO FOREIGN KEY (id_avaliacao) REFERENCES T_AVALIACAO (id_avaliacao);

-- ---------------------------------------------------------------------
-- 4. Comentários: o dicionário de dados dentro do próprio banco
--    (o Oracle Data Modeler os importa junto com as tabelas)
-- ---------------------------------------------------------------------

COMMENT ON TABLE T_TELECENTRO IS 'Espaço comunitário e gratuito onde o OpenLabs roda, com computadores e Wi-Fi público.';
COMMENT ON COLUMN T_TELECENTRO.id_telecentro IS 'Identificador do telecentro.';
COMMENT ON COLUMN T_TELECENTRO.nm_telecentro IS 'Nome do telecentro.';
COMMENT ON COLUMN T_TELECENTRO.nm_bairro IS 'Bairro onde fica.';
COMMENT ON COLUMN T_TELECENTRO.nm_cidade IS 'Cidade onde fica.';
COMMENT ON COLUMN T_TELECENTRO.sg_uf IS 'Sigla do estado.';
COMMENT ON COLUMN T_TELECENTRO.nr_computadores IS 'Quantos computadores o telecentro oferece.';
COMMENT ON COLUMN T_TELECENTRO.ds_faixa_rede IS 'Faixa de endereços da rede local (a mesma da disciplina de redes), ex.: 192.168.10.0/24.';
COMMENT ON COLUMN T_TELECENTRO.dt_inauguracao IS 'Data de abertura ao público.';

COMMENT ON TABLE T_MONITOR IS 'Pessoa da equipe que atende os alunos no telecentro.';
COMMENT ON COLUMN T_MONITOR.id_monitor IS 'Identificador do monitor.';
COMMENT ON COLUMN T_MONITOR.id_telecentro IS 'Telecentro onde trabalha.';
COMMENT ON COLUMN T_MONITOR.nm_monitor IS 'Nome do monitor.';
COMMENT ON COLUMN T_MONITOR.ds_email IS 'E-mail de contato (único).';
COMMENT ON COLUMN T_MONITOR.dt_admissao IS 'Data em que começou no telecentro.';

COMMENT ON TABLE T_ALUNO IS 'Pessoa da comunidade cadastrada para usar os laboratórios.';
COMMENT ON COLUMN T_ALUNO.id_aluno IS 'Identificador do aluno.';
COMMENT ON COLUMN T_ALUNO.id_telecentro IS 'Telecentro onde se cadastrou.';
COMMENT ON COLUMN T_ALUNO.nm_aluno IS 'Nome do aluno.';
COMMENT ON COLUMN T_ALUNO.dt_nascimento IS 'Data de nascimento (para turmas por faixa etária).';
COMMENT ON COLUMN T_ALUNO.ds_email IS 'E-mail, opcional: nem todo aluno tem um.';
COMMENT ON COLUMN T_ALUNO.dt_cadastro IS 'Data do cadastro.';
COMMENT ON COLUMN T_ALUNO.st_ativo IS 'S = frequenta; N = afastado.';

COMMENT ON TABLE T_COMPUTADOR IS 'Equipamento da rede do telecentro, com o endereço e a VLAN do projeto de redes.';
COMMENT ON COLUMN T_COMPUTADOR.id_computador IS 'Identificador do equipamento.';
COMMENT ON COLUMN T_COMPUTADOR.id_telecentro IS 'Telecentro onde está.';
COMMENT ON COLUMN T_COMPUTADOR.nm_hostname IS 'Nome na rede (como no Packet Tracer).';
COMMENT ON COLUMN T_COMPUTADOR.ds_endereco_ip IS 'IP fixo; vazio quando o endereço vem do DHCP.';
COMMENT ON COLUMN T_COMPUTADOR.nr_vlan IS 'VLAN: 10 equipe, 20 cidadão (Wi-Fi), 30 servidores.';

COMMENT ON TABLE T_HANDBOOK IS 'Um curso do OpenLabs (redes, OpenTelemetry, Kubernetes…), com roteiro, artigos e labs.';
COMMENT ON COLUMN T_HANDBOOK.id_handbook IS 'Identificador do handbook.';
COMMENT ON COLUMN T_HANDBOOK.cd_slug IS 'Código usado no endereço do site, ex.: networks.';
COMMENT ON COLUMN T_HANDBOOK.nm_handbook IS 'Nome do handbook.';
COMMENT ON COLUMN T_HANDBOOK.ds_assunto IS 'Assunto em uma ou duas palavras.';
COMMENT ON COLUMN T_HANDBOOK.st_estagio IS 'building = em construção; planned = planejado.';

COMMENT ON TABLE T_FASE IS 'Uma etapa do roteiro de um handbook: a ordem em que os conceitos se sustentam.';
COMMENT ON COLUMN T_FASE.id_fase IS 'Identificador da fase.';
COMMENT ON COLUMN T_FASE.id_handbook IS 'Handbook a que pertence.';
COMMENT ON COLUMN T_FASE.nr_ordem IS 'Posição no roteiro (1, 2, 3…).';
COMMENT ON COLUMN T_FASE.nm_fase IS 'Título da fase.';

COMMENT ON TABLE T_LAB IS 'Um laboratório interativo: um modelo que roda e que o aluno pode quebrar.';
COMMENT ON COLUMN T_LAB.id_lab IS 'Identificador do lab.';
COMMENT ON COLUMN T_LAB.id_fase IS 'Fase do roteiro em que o lab está.';
COMMENT ON COLUMN T_LAB.cd_slug IS 'Código usado no endereço, ex.: telecentro-network.';
COMMENT ON COLUMN T_LAB.nm_lab IS 'Título do lab.';
COMMENT ON COLUMN T_LAB.tp_interacao IS 'Tipo de modelo: fluxo, estado, filme ou manipulação direta.';
COMMENT ON COLUMN T_LAB.nr_minutos IS 'Tempo estimado para completar, em minutos.';
COMMENT ON COLUMN T_LAB.st_disponivel IS 'S = publicado; N = em breve.';

COMMENT ON TABLE T_AVALIACAO IS 'Questionário de fim de lab (checkpoint) que mede o que o aluno entendeu.';
COMMENT ON COLUMN T_AVALIACAO.id_avaliacao IS 'Identificador da avaliação.';
COMMENT ON COLUMN T_AVALIACAO.id_lab IS 'Lab avaliado.';
COMMENT ON COLUMN T_AVALIACAO.nm_avaliacao IS 'Título da avaliação.';
COMMENT ON COLUMN T_AVALIACAO.nr_questoes IS 'Quantidade de questões.';
COMMENT ON COLUMN T_AVALIACAO.pc_aprovacao IS 'Percentual mínimo para aprovar.';

COMMENT ON TABLE T_PROGRESSO IS 'O andamento de um aluno num lab. Resolve o relacionamento muitos-para-muitos entre aluno e lab.';
COMMENT ON COLUMN T_PROGRESSO.id_progresso IS 'Identificador do registro de progresso.';
COMMENT ON COLUMN T_PROGRESSO.id_aluno IS 'Aluno.';
COMMENT ON COLUMN T_PROGRESSO.id_lab IS 'Lab.';
COMMENT ON COLUMN T_PROGRESSO.dt_inicio IS 'Quando o aluno abriu o lab pela primeira vez.';
COMMENT ON COLUMN T_PROGRESSO.dt_conclusao IS 'Quando concluiu; vazio enquanto está em andamento.';

COMMENT ON TABLE T_TENTATIVA IS 'Uma entrega de avaliação feita por um aluno, com a nota. Resolve o muitos-para-muitos entre aluno e avaliação.';
COMMENT ON COLUMN T_TENTATIVA.id_tentativa IS 'Identificador da tentativa.';
COMMENT ON COLUMN T_TENTATIVA.id_aluno IS 'Aluno que respondeu.';
COMMENT ON COLUMN T_TENTATIVA.id_avaliacao IS 'Avaliação respondida.';
COMMENT ON COLUMN T_TENTATIVA.dt_envio IS 'Quando a tentativa foi entregue.';
COMMENT ON COLUMN T_TENTATIVA.nr_acertos IS 'Quantas questões acertou.';
COMMENT ON COLUMN T_TENTATIVA.vl_nota IS 'Nota de 0 a 10.';
