-- =====================================================================
-- OpenLabs no Telecentro — Script DML (Oracle)
-- Global Solution 2026.2 · Database Design
--
-- Gerado por database/gerar.mjs a partir de packages/database-domain.
--
-- Dados de exemplo: pelo menos cinco linhas em cada tabela.
-- Handbooks, fases e labs são o catálogo real do OpenLabs.
-- Telecentros, monitores, alunos, computadores, progresso e notas são
-- SIMULADOS: nomes fictícios e e-mails no domínio reservado example.com.
-- Nenhum dado pessoal real foi usado.
--
-- Rodar depois de 01-ddl.sql. A ordem dos INSERTs respeita as chaves
-- estrangeiras: primeiro quem é referenciado, depois quem referencia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- T_TELECENTRO (5) — a faixa de rede segue o padrão 192.168.X.0/24 da
-- disciplina de redes; o telecentro 1 é o da equipe 10.
-- ---------------------------------------------------------------------
INSERT INTO T_TELECENTRO (id_telecentro, nm_telecentro, nm_bairro, nm_cidade, sg_uf, nr_computadores, ds_faixa_rede, dt_inauguracao) VALUES (1, 'Telecentro Jardim Ângela', 'Jardim Ângela', 'São Paulo', 'SP', 20, '192.168.10.0/24', DATE '2024-03-15');
INSERT INTO T_TELECENTRO (id_telecentro, nm_telecentro, nm_bairro, nm_cidade, sg_uf, nr_computadores, ds_faixa_rede, dt_inauguracao) VALUES (2, 'Telecentro Cidade Tiradentes', 'Cidade Tiradentes', 'São Paulo', 'SP', 15, '192.168.11.0/24', DATE '2023-08-01');
INSERT INTO T_TELECENTRO (id_telecentro, nm_telecentro, nm_bairro, nm_cidade, sg_uf, nr_computadores, ds_faixa_rede, dt_inauguracao) VALUES (3, 'Telecentro Capão Redondo', 'Capão Redondo', 'São Paulo', 'SP', 18, '192.168.12.0/24', DATE '2022-05-20');
INSERT INTO T_TELECENTRO (id_telecentro, nm_telecentro, nm_bairro, nm_cidade, sg_uf, nr_computadores, ds_faixa_rede, dt_inauguracao) VALUES (4, 'Telecentro Jardim Gramacho', 'Jardim Gramacho', 'Duque de Caxias', 'RJ', 12, '192.168.13.0/24', DATE '2025-02-10');
INSERT INTO T_TELECENTRO (id_telecentro, nm_telecentro, nm_bairro, nm_cidade, sg_uf, nr_computadores, ds_faixa_rede, dt_inauguracao) VALUES (5, 'Telecentro Vila Kennedy', 'Vila Kennedy', 'Rio de Janeiro', 'RJ', 10, '192.168.14.0/24', DATE '2025-09-01');

-- ---------------------------------------------------------------------
-- T_MONITOR (6) — todo telecentro tem pelo menos um monitor.
-- ---------------------------------------------------------------------
INSERT INTO T_MONITOR (id_monitor, id_telecentro, nm_monitor, ds_email, dt_admissao) VALUES (1, 1, 'Renata Siqueira', 'renata.siqueira@example.com', DATE '2024-03-01');
INSERT INTO T_MONITOR (id_monitor, id_telecentro, nm_monitor, ds_email, dt_admissao) VALUES (2, 1, 'Paulo Freitas', 'paulo.freitas@example.com', DATE '2025-01-15');
INSERT INTO T_MONITOR (id_monitor, id_telecentro, nm_monitor, ds_email, dt_admissao) VALUES (3, 2, 'Sandra Vieira', 'sandra.vieira@example.com', DATE '2023-07-20');
INSERT INTO T_MONITOR (id_monitor, id_telecentro, nm_monitor, ds_email, dt_admissao) VALUES (4, 3, 'Marcos Antunes', 'marcos.antunes@example.com', DATE '2022-05-02');
INSERT INTO T_MONITOR (id_monitor, id_telecentro, nm_monitor, ds_email, dt_admissao) VALUES (5, 4, 'Tatiane Lopes', 'tatiane.lopes@example.com', DATE '2025-02-01');
INSERT INTO T_MONITOR (id_monitor, id_telecentro, nm_monitor, ds_email, dt_admissao) VALUES (6, 5, 'Vinícius Prates', 'vinicius.prates@example.com', DATE '2025-08-25');

-- ---------------------------------------------------------------------
-- T_ALUNO (12) — e-mail é opcional (NULL para quem não tem); dois alunos
-- estão afastados (st_ativo = 'N').
-- ---------------------------------------------------------------------
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (1, 1, 'Ana Beatriz Souza', DATE '2008-04-12', 'ana.souza@example.com', DATE '2026-08-03', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (2, 1, 'Bruno Henrique Lima', DATE '2007-11-30', NULL, DATE '2026-08-05', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (3, 1, 'Camila Ferreira Rocha', DATE '1995-02-18', 'camila.rocha@example.com', DATE '2026-08-10', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (4, 1, 'Diego Alves Martins', DATE '2009-07-07', NULL, DATE '2026-09-01', 'N');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (5, 2, 'Eduarda Nunes Prado', DATE '2006-01-25', 'eduarda.prado@example.com', DATE '2026-07-14', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (6, 2, 'Felipe Cardoso Reis', DATE '1988-09-09', NULL, DATE '2026-07-20', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (7, 2, 'Gabriela Monteiro Dias', DATE '2010-03-03', 'gabriela.dias@example.com', DATE '2026-09-12', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (8, 3, 'Henrique Batista Costa', DATE '1979-12-01', 'henrique.costa@example.com', DATE '2026-06-02', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (9, 3, 'Isabela Rezende Paiva', DATE '2008-10-21', NULL, DATE '2026-06-15', 'N');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (10, 4, 'João Victor Teixeira', DATE '2007-05-05', 'joao.teixeira@example.com', DATE '2026-10-01', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (11, 4, 'Larissa Moura Campos', DATE '1999-08-14', NULL, DATE '2026-10-03', 'S');
INSERT INTO T_ALUNO (id_aluno, id_telecentro, nm_aluno, dt_nascimento, ds_email, dt_cadastro, st_ativo) VALUES (12, 5, 'Mateus Oliveira Barros', DATE '2005-06-30', 'mateus.barros@example.com', DATE '2026-10-20', 'S');

-- ---------------------------------------------------------------------
-- T_COMPUTADOR (6) — os mesmos nomes e endereços do projeto de redes: o
-- servidor tem IP fixo; os outros recebem endereço por DHCP (NULL).
-- ---------------------------------------------------------------------
INSERT INTO T_COMPUTADOR (id_computador, id_telecentro, nm_hostname, ds_endereco_ip, nr_vlan) VALUES (1, 1, 'SRV-OPENLABS', '192.168.10.162', 30);
INSERT INTO T_COMPUTADOR (id_computador, id_telecentro, nm_hostname, ds_endereco_ip, nr_vlan) VALUES (2, 1, 'PC-MONITOR', NULL, 10);
INSERT INTO T_COMPUTADOR (id_computador, id_telecentro, nm_hostname, ds_endereco_ip, nr_vlan) VALUES (3, 1, 'LAPTOP-CIDADAO', NULL, 20);
INSERT INTO T_COMPUTADOR (id_computador, id_telecentro, nm_hostname, ds_endereco_ip, nr_vlan) VALUES (4, 2, 'SRV-OPENLABS', '192.168.11.162', 30);
INSERT INTO T_COMPUTADOR (id_computador, id_telecentro, nm_hostname, ds_endereco_ip, nr_vlan) VALUES (5, 2, 'PC-MONITOR', NULL, 10);
INSERT INTO T_COMPUTADOR (id_computador, id_telecentro, nm_hostname, ds_endereco_ip, nr_vlan) VALUES (6, 3, 'SRV-OPENLABS', '192.168.12.162', 30);

-- ---------------------------------------------------------------------
-- T_HANDBOOK (5) — o catálogo real do OpenLabs.
-- ---------------------------------------------------------------------
INSERT INTO T_HANDBOOK (id_handbook, cd_slug, nm_handbook, ds_assunto, st_estagio) VALUES (1, 'networks', 'Networks Visual Handbook', 'redes', 'building');
INSERT INTO T_HANDBOOK (id_handbook, cd_slug, nm_handbook, ds_assunto, st_estagio) VALUES (2, 'otel', 'OpenTelemetry Visual Handbook', 'observabilidade', 'building');
INSERT INTO T_HANDBOOK (id_handbook, cd_slug, nm_handbook, ds_assunto, st_estagio) VALUES (3, 'kubernetes', 'Kubernetes Visual Handbook', 'Kubernetes', 'building');
INSERT INTO T_HANDBOOK (id_handbook, cd_slug, nm_handbook, ds_assunto, st_estagio) VALUES (4, 'splunk', 'Splunk Visual Handbook', 'Splunk', 'building');
INSERT INTO T_HANDBOOK (id_handbook, cd_slug, nm_handbook, ds_assunto, st_estagio) VALUES (5, 'algorithms', 'Algorithms Visual Handbook', 'algoritmos', 'building');

-- ---------------------------------------------------------------------
-- T_FASE (9) — fases reais dos roteiros; nr_ordem é a posição no
-- roteiro.
-- ---------------------------------------------------------------------
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (1, 1, 1, 'A network you can walk through');
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (2, 1, 2, 'Leaving the building');
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (3, 1, 3, 'Who may talk to whom');
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (4, 2, 1, 'The problem');
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (5, 2, 2, 'The model');
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (6, 2, 5, 'Operating at scale');
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (7, 3, 1, 'A workload becomes real');
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (8, 4, 2, 'Where a byte stream becomes events');
INSERT INTO T_FASE (id_fase, id_handbook, nr_ordem, nm_fase) VALUES (9, 5, 1, 'What holds the data');

-- ---------------------------------------------------------------------
-- T_LAB (8) — labs reais; os dois de redes ainda em breve têm
-- st_disponivel = 'N'.
-- ---------------------------------------------------------------------
INSERT INTO T_LAB (id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel) VALUES (1, 1, 'telecentro-network', 'What happens when a learner joins the telecentre Wi-Fi', 'filme', 30, 'S');
INSERT INTO T_LAB (id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel) VALUES (2, 1, 'subnetting-by-need', 'Splitting a /24 by how many people need it', 'direto', 20, 'N');
INSERT INTO T_LAB (id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel) VALUES (3, 3, 'acl-order', 'Move one ACL line and watch what breaks', 'direto', 15, 'N');
INSERT INTO T_LAB (id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel) VALUES (4, 4, 'three-pillars', 'Three pillars,  one blind spot', 'fluxo', 25, 'S');
INSERT INTO T_LAB (id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel) VALUES (5, 5, 'anatomy-of-a-trace', 'Anatomy of a Trace', 'fluxo', 30, 'S');
INSERT INTO T_LAB (id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel) VALUES (6, 6, 'backpressure-and-drops', 'Backpressure and drops', 'filme', 25, 'S');
INSERT INTO T_LAB (id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel) VALUES (7, 7, 'pod-lifecycle', 'A manifest,  a Pod,  and the controller that replaces it', 'estado', 20, 'S');
INSERT INTO T_LAB (id_lab, id_fase, cd_slug, nm_lab, tp_interacao, nr_minutos, st_disponivel) VALUES (8, 8, 'splunk-ingest', 'Where parsing happens,  and what it costs', 'fluxo', 25, 'S');

-- ---------------------------------------------------------------------
-- T_AVALIACAO (6) — um checkpoint por lab publicado.
-- ---------------------------------------------------------------------
INSERT INTO T_AVALIACAO (id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao) VALUES (1, 1, 'Checkpoint: a rede do telecentro', 5, 70);
INSERT INTO T_AVALIACAO (id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao) VALUES (2, 4, 'Checkpoint: três pilares', 5, 60);
INSERT INTO T_AVALIACAO (id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao) VALUES (3, 5, 'Checkpoint: anatomia de um trace', 4, 60);
INSERT INTO T_AVALIACAO (id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao) VALUES (4, 6, 'Checkpoint: backpressure', 5, 70);
INSERT INTO T_AVALIACAO (id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao) VALUES (5, 7, 'Checkpoint: ciclo de vida do Pod', 3, 60);
INSERT INTO T_AVALIACAO (id_avaliacao, id_lab, nm_avaliacao, nr_questoes, pc_aprovacao) VALUES (6, 8, 'Checkpoint: onde o parsing acontece', 4, 60);

-- ---------------------------------------------------------------------
-- T_PROGRESSO (15) — dt_conclusao NULL = lab ainda em andamento.
-- ---------------------------------------------------------------------
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (1, 1, 1, DATE '2026-08-04', DATE '2026-08-04');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (2, 1, 4, DATE '2026-08-11', DATE '2026-08-18');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (3, 1, 5, DATE '2026-08-25', NULL);
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (4, 2, 1, DATE '2026-08-06', DATE '2026-08-13');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (5, 3, 1, DATE '2026-08-12', DATE '2026-08-12');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (6, 3, 7, DATE '2026-08-19', DATE '2026-08-26');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (7, 5, 4, DATE '2026-07-15', DATE '2026-07-15');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (8, 5, 6, DATE '2026-07-22', DATE '2026-08-05');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (9, 6, 8, DATE '2026-07-21', NULL);
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (10, 7, 1, DATE '2026-09-13', DATE '2026-09-20');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (11, 8, 4, DATE '2026-06-03', DATE '2026-06-03');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (12, 8, 8, DATE '2026-06-10', DATE '2026-06-24');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (13, 10, 1, DATE '2026-10-02', DATE '2026-10-09');
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (14, 11, 1, DATE '2026-10-04', NULL);
INSERT INTO T_PROGRESSO (id_progresso, id_aluno, id_lab, dt_inicio, dt_conclusao) VALUES (15, 12, 7, DATE '2026-10-21', DATE '2026-10-21');

-- ---------------------------------------------------------------------
-- T_TENTATIVA (12) — nota = acertos ÷ questões × 10. Um aluno pode
-- tentar de novo (a aluna 7 refez o checkpoint de redes e subiu de 4
-- para 8).
-- ---------------------------------------------------------------------
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (1, 1, 1, DATE '2026-08-04', 4, 8.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (2, 1, 2, DATE '2026-08-18', 5, 10.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (3, 2, 1, DATE '2026-08-13', 3, 6.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (4, 3, 1, DATE '2026-08-12', 5, 10.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (5, 3, 5, DATE '2026-08-26', 2, 6.67);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (6, 5, 2, DATE '2026-07-15', 3, 6.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (7, 5, 4, DATE '2026-08-05', 4, 8.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (8, 7, 1, DATE '2026-09-20', 2, 4.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (9, 7, 1, DATE '2026-09-21', 4, 8.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (10, 8, 2, DATE '2026-06-03', 4, 8.00);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (11, 8, 6, DATE '2026-06-24', 3, 7.50);
INSERT INTO T_TENTATIVA (id_tentativa, id_aluno, id_avaliacao, dt_envio, nr_acertos, vl_nota) VALUES (12, 10, 1, DATE '2026-10-09', 5, 10.00);

COMMIT;
