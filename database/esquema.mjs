// O banco de dados do OpenLabs num telecentro, descrito uma vez só.
//
// O site do OpenLabs é estático: até aqui, o pouco que ele lembra (idioma,
// tentativas de avaliação) fica no navegador de cada pessoa. Num telecentro
// isso não basta — é preciso saber quais telecentros existem, quem são os
// alunos e os monitores, que labs cada aluno fez e como foi nas avaliações.
// Este arquivo é a fonte de verdade desse banco: o DDL (01-ddl.sql), o
// dicionário de dados do documento de entrega e o diagrama de conferência
// (MODELO.md) são gerados daqui por `gerar.mjs`. Mudar uma coluna aqui muda os três.
//
// Convenção de nomes (a das aulas de Database Design): tabelas T_<NOME>;
// colunas com prefixo de tipo — id_ (identificador), nm_ (nome), ds_
// (descrição), dt_ (data), nr_ (número), st_ (situação), vl_ (valor),
// cd_ (código), sg_ (sigla), tp_ (tipo), pc_ (percentual).

/**
 * @typedef {{ nome: string, tipo: string, nulo?: boolean, padrao?: string, check?: string, unico?: boolean, descricao: string }} Coluna
 * @typedef {{ coluna: string, tabela: string, cardinalidade: string }} Estrangeira
 * @typedef {{ nome: string, descricao: string, pk: string, colunas: Coluna[], fks?: Estrangeira[], unicos?: string[][], checks?: { nome: string, expressao: string }[] }} Tabela
 */

/** @type {Tabela[]} — na ordem de criação: quem é referenciado vem antes. */
export const TABELAS = [
  {
    nome: "T_TELECENTRO",
    descricao: "Espaço comunitário e gratuito onde o OpenLabs roda, com computadores e Wi-Fi público.",
    pk: "id_telecentro",
    colunas: [
      { nome: "id_telecentro", tipo: "NUMBER(6)", descricao: "Identificador do telecentro." },
      { nome: "nm_telecentro", tipo: "VARCHAR2(80)", descricao: "Nome do telecentro." },
      { nome: "nm_bairro", tipo: "VARCHAR2(60)", descricao: "Bairro onde fica." },
      { nome: "nm_cidade", tipo: "VARCHAR2(60)", descricao: "Cidade onde fica." },
      { nome: "sg_uf", tipo: "CHAR(2)", descricao: "Sigla do estado." },
      { nome: "nr_computadores", tipo: "NUMBER(3)", check: "nr_computadores >= 0", descricao: "Quantos computadores o telecentro oferece." },
      { nome: "ds_faixa_rede", tipo: "VARCHAR2(18)", unico: true, descricao: "Faixa de endereços da rede local (a mesma da disciplina de redes), ex.: 192.168.10.0/24." },
      { nome: "dt_inauguracao", tipo: "DATE", descricao: "Data de abertura ao público." },
    ],
  },
  {
    nome: "T_MONITOR",
    descricao: "Pessoa da equipe que atende os alunos no telecentro.",
    pk: "id_monitor",
    colunas: [
      { nome: "id_monitor", tipo: "NUMBER(6)", descricao: "Identificador do monitor." },
      { nome: "id_telecentro", tipo: "NUMBER(6)", descricao: "Telecentro onde trabalha." },
      { nome: "nm_monitor", tipo: "VARCHAR2(80)", descricao: "Nome do monitor." },
      { nome: "ds_email", tipo: "VARCHAR2(120)", unico: true, descricao: "E-mail de contato (único)." },
      { nome: "dt_admissao", tipo: "DATE", descricao: "Data em que começou no telecentro." },
    ],
    fks: [{ coluna: "id_telecentro", tabela: "T_TELECENTRO", cardinalidade: "um telecentro tem 1 ou muitos monitores; um monitor trabalha em exatamente 1 telecentro" }],
  },
  {
    nome: "T_ALUNO",
    descricao: "Pessoa da comunidade cadastrada para usar os laboratórios.",
    pk: "id_aluno",
    colunas: [
      { nome: "id_aluno", tipo: "NUMBER(8)", descricao: "Identificador do aluno." },
      { nome: "id_telecentro", tipo: "NUMBER(6)", descricao: "Telecentro onde se cadastrou." },
      { nome: "nm_aluno", tipo: "VARCHAR2(80)", descricao: "Nome do aluno." },
      { nome: "dt_nascimento", tipo: "DATE", descricao: "Data de nascimento (para turmas por faixa etária)." },
      { nome: "ds_email", tipo: "VARCHAR2(120)", nulo: true, unico: true, descricao: "E-mail, opcional: nem todo aluno tem um." },
      { nome: "dt_cadastro", tipo: "DATE", descricao: "Data do cadastro." },
      { nome: "st_ativo", tipo: "CHAR(1)", padrao: "'S'", check: "st_ativo IN ('S', 'N')", descricao: "S = frequenta; N = afastado." },
    ],
    fks: [{ coluna: "id_telecentro", tabela: "T_TELECENTRO", cardinalidade: "um telecentro tem 0 ou muitos alunos; um aluno pertence a exatamente 1 telecentro" }],
  },
  {
    nome: "T_COMPUTADOR",
    descricao: "Equipamento da rede do telecentro, com o endereço e a VLAN do projeto de redes.",
    pk: "id_computador",
    colunas: [
      { nome: "id_computador", tipo: "NUMBER(6)", descricao: "Identificador do equipamento." },
      { nome: "id_telecentro", tipo: "NUMBER(6)", descricao: "Telecentro onde está." },
      { nome: "nm_hostname", tipo: "VARCHAR2(30)", descricao: "Nome na rede (como no Packet Tracer)." },
      { nome: "ds_endereco_ip", tipo: "VARCHAR2(15)", nulo: true, descricao: "IP fixo; vazio quando o endereço vem do DHCP." },
      { nome: "nr_vlan", tipo: "NUMBER(4)", check: "nr_vlan IN (10, 20, 30)", descricao: "VLAN: 10 equipe, 20 cidadão (Wi-Fi), 30 servidores." },
    ],
    fks: [{ coluna: "id_telecentro", tabela: "T_TELECENTRO", cardinalidade: "um telecentro tem 0 ou muitos computadores; um computador fica em exatamente 1 telecentro" }],
    unicos: [["id_telecentro", "nm_hostname"]],
  },
  {
    nome: "T_HANDBOOK",
    descricao: "Um curso do OpenLabs (redes, OpenTelemetry, Kubernetes…), com roteiro, artigos e labs.",
    pk: "id_handbook",
    colunas: [
      { nome: "id_handbook", tipo: "NUMBER(4)", descricao: "Identificador do handbook." },
      { nome: "cd_slug", tipo: "VARCHAR2(40)", unico: true, descricao: "Código usado no endereço do site, ex.: networks." },
      { nome: "nm_handbook", tipo: "VARCHAR2(80)", descricao: "Nome do handbook." },
      { nome: "ds_assunto", tipo: "VARCHAR2(40)", descricao: "Assunto em uma ou duas palavras." },
      { nome: "st_estagio", tipo: "VARCHAR2(10)", check: "st_estagio IN ('building', 'planned')", descricao: "building = em construção; planned = planejado." },
    ],
  },
  {
    nome: "T_FASE",
    descricao: "Uma etapa do roteiro de um handbook: a ordem em que os conceitos se sustentam.",
    pk: "id_fase",
    colunas: [
      { nome: "id_fase", tipo: "NUMBER(6)", descricao: "Identificador da fase." },
      { nome: "id_handbook", tipo: "NUMBER(4)", descricao: "Handbook a que pertence." },
      { nome: "nr_ordem", tipo: "NUMBER(2)", check: "nr_ordem > 0", descricao: "Posição no roteiro (1, 2, 3…)." },
      { nome: "nm_fase", tipo: "VARCHAR2(80)", descricao: "Título da fase." },
    ],
    fks: [{ coluna: "id_handbook", tabela: "T_HANDBOOK", cardinalidade: "um handbook tem 1 ou muitas fases; uma fase pertence a exatamente 1 handbook" }],
    unicos: [["id_handbook", "nr_ordem"]],
  },
  {
    nome: "T_LAB",
    descricao: "Um laboratório interativo: um modelo que roda e que o aluno pode quebrar.",
    pk: "id_lab",
    colunas: [
      { nome: "id_lab", tipo: "NUMBER(6)", descricao: "Identificador do lab." },
      { nome: "id_fase", tipo: "NUMBER(6)", descricao: "Fase do roteiro em que o lab está." },
      { nome: "cd_slug", tipo: "VARCHAR2(60)", unico: true, descricao: "Código usado no endereço, ex.: telecentro-network." },
      { nome: "nm_lab", tipo: "VARCHAR2(120)", descricao: "Título do lab." },
      { nome: "tp_interacao", tipo: "VARCHAR2(10)", check: "tp_interacao IN ('fluxo', 'estado', 'filme', 'direto')", descricao: "Tipo de modelo: fluxo, estado, filme ou manipulação direta." },
      { nome: "nr_minutos", tipo: "NUMBER(3)", check: "nr_minutos > 0", descricao: "Tempo estimado para completar, em minutos." },
      { nome: "st_disponivel", tipo: "CHAR(1)", padrao: "'S'", check: "st_disponivel IN ('S', 'N')", descricao: "S = publicado; N = em breve." },
    ],
    fks: [{ coluna: "id_fase", tabela: "T_FASE", cardinalidade: "uma fase tem 0 ou muitos labs; um lab está em exatamente 1 fase" }],
  },
  {
    nome: "T_AVALIACAO",
    descricao: "Questionário de fim de lab (checkpoint) que mede o que o aluno entendeu.",
    pk: "id_avaliacao",
    colunas: [
      { nome: "id_avaliacao", tipo: "NUMBER(6)", descricao: "Identificador da avaliação." },
      { nome: "id_lab", tipo: "NUMBER(6)", descricao: "Lab avaliado." },
      { nome: "nm_avaliacao", tipo: "VARCHAR2(100)", descricao: "Título da avaliação." },
      { nome: "nr_questoes", tipo: "NUMBER(2)", check: "nr_questoes > 0", descricao: "Quantidade de questões." },
      { nome: "pc_aprovacao", tipo: "NUMBER(3)", check: "pc_aprovacao BETWEEN 0 AND 100", descricao: "Percentual mínimo para aprovar." },
    ],
    fks: [{ coluna: "id_lab", tabela: "T_LAB", cardinalidade: "um lab tem 0 ou muitas avaliações; uma avaliação é de exatamente 1 lab" }],
  },
  {
    nome: "T_PROGRESSO",
    descricao: "O andamento de um aluno num lab. Resolve o relacionamento muitos-para-muitos entre aluno e lab.",
    pk: "id_progresso",
    colunas: [
      { nome: "id_progresso", tipo: "NUMBER(10)", descricao: "Identificador do registro de progresso." },
      { nome: "id_aluno", tipo: "NUMBER(8)", descricao: "Aluno." },
      { nome: "id_lab", tipo: "NUMBER(6)", descricao: "Lab." },
      { nome: "dt_inicio", tipo: "DATE", descricao: "Quando o aluno abriu o lab pela primeira vez." },
      { nome: "dt_conclusao", tipo: "DATE", nulo: true, descricao: "Quando concluiu; vazio enquanto está em andamento." },
    ],
    fks: [
      { coluna: "id_aluno", tabela: "T_ALUNO", cardinalidade: "um aluno tem 0 ou muitos progressos; um progresso é de exatamente 1 aluno" },
      { coluna: "id_lab", tabela: "T_LAB", cardinalidade: "um lab tem 0 ou muitos progressos; um progresso é de exatamente 1 lab" },
    ],
    unicos: [["id_aluno", "id_lab"]],
    checks: [{ nome: "CK_PROGRESSO_DATAS", expressao: "dt_conclusao IS NULL OR dt_conclusao >= dt_inicio" }],
  },
  {
    nome: "T_TENTATIVA",
    descricao: "Uma entrega de avaliação feita por um aluno, com a nota. Resolve o muitos-para-muitos entre aluno e avaliação.",
    pk: "id_tentativa",
    colunas: [
      { nome: "id_tentativa", tipo: "NUMBER(10)", descricao: "Identificador da tentativa." },
      { nome: "id_aluno", tipo: "NUMBER(8)", descricao: "Aluno que respondeu." },
      { nome: "id_avaliacao", tipo: "NUMBER(6)", descricao: "Avaliação respondida." },
      { nome: "dt_envio", tipo: "DATE", descricao: "Quando a tentativa foi entregue." },
      { nome: "nr_acertos", tipo: "NUMBER(2)", check: "nr_acertos >= 0", descricao: "Quantas questões acertou." },
      { nome: "vl_nota", tipo: "NUMBER(4,2)", check: "vl_nota BETWEEN 0 AND 10", descricao: "Nota de 0 a 10." },
    ],
    fks: [
      { coluna: "id_aluno", tabela: "T_ALUNO", cardinalidade: "um aluno tem 0 ou muitas tentativas; uma tentativa é de exatamente 1 aluno" },
      { coluna: "id_avaliacao", tabela: "T_AVALIACAO", cardinalidade: "uma avaliação tem 0 ou muitas tentativas; uma tentativa é de exatamente 1 avaliação" },
    ],
  },
];

/** Nome de constraint: o Oracle aceita até 128 caracteres, mas 30 é o limite das versões antigas e o hábito das aulas. */
export function nomeDaConstraint(prefixo, tabela, sufixo = "") {
  const base = `${prefixo}_${tabela.replace(/^T_/u, "")}${sufixo ? `_${sufixo}` : ""}`.toUpperCase();
  if (base.length > 30) throw new Error(`constraint ${base} passa de 30 caracteres`);
  return base;
}
